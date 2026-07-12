//! In-app side of the Agent Bridge: a local socket server that receives
//! JSON-RPC lines from the `--mcp` proxy, bridges each `tools/call` into the
//! webview as an event, and answers with the webview's result. Rust does no
//! canvas work here (ADR-0003) — it is transport and correlation only.

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{mpsc, LazyLock, Mutex};
use std::time::Duration;

use interprocess::local_socket::traits::{ListenerExt as _, Stream as _};
use interprocess::local_socket::{Listener, ListenerOptions, Stream};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};

use super::error_response;

/// Tool calls forwarded to the webview and awaiting `mcp_tool_result`.
static PENDING: LazyLock<Mutex<HashMap<u64, mpsc::Sender<Value>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));
static NEXT_CALL_ID: AtomicU64 = AtomicU64::new(1);

/// End-to-end budget for one tool call in the webview (layout + PNG export
/// of a large canvas can take a few seconds; 60s is comfortably above that).
const TOOL_TIMEOUT: Duration = Duration::from_secs(60);

pub fn start(app: AppHandle) {
    std::thread::spawn(move || {
        if let Err(err) = serve(app) {
            // Most likely a second Lousa instance already owns the socket.
            eprintln!("agent bridge: socket server not started: {err}");
        }
    });
}

fn serve(app: AppHandle) -> std::io::Result<()> {
    let listener = bind()?;
    for conn in listener.incoming() {
        match conn {
            Ok(stream) => {
                let app = app.clone();
                std::thread::spawn(move || handle_connection(&app, &stream));
            }
            Err(err) => eprintln!("agent bridge: rejected connection: {err}"),
        }
    }
    Ok(())
}

fn bind() -> std::io::Result<Listener> {
    match ListenerOptions::new()
        .name(super::socket_name()?)
        .create_sync()
    {
        // A crashed app leaves a stale socket file behind on Unix. If nothing
        // answers on it, remove it and bind again.
        #[cfg(unix)]
        Err(err) if err.kind() == std::io::ErrorKind::AddrInUse => {
            if Stream::connect(super::socket_name()?).is_ok() {
                return Err(err); // a live instance owns it — leave it alone
            }
            std::fs::remove_file(super::socket_path())?;
            ListenerOptions::new()
                .name(super::socket_name()?)
                .create_sync()
        }
        other => other,
    }
}

fn handle_connection(app: &AppHandle, stream: &Stream) {
    let mut reader = BufReader::new(stream);
    let mut line = String::new();
    loop {
        line.clear();
        match reader.read_line(&mut line) {
            Ok(0) | Err(_) => return, // proxy went away
            Ok(_) => {}
        }
        if line.trim().is_empty() {
            continue;
        }
        let Some(response) = handle_message(app, &line) else {
            continue; // notification — no reply
        };
        let mut writer = stream;
        if writer
            .write_all(response.to_string().as_bytes())
            .and_then(|()| writer.write_all(b"\n"))
            .and_then(|()| writer.flush())
            .is_err()
        {
            return;
        }
    }
}

/// Handle one JSON-RPC message; `None` means nothing should be written back.
/// The proxy answers `initialize`/`tools/list` itself, so only `tools/call`
/// (and `ping`) reach the app.
fn handle_message(app: &AppHandle, raw: &str) -> Option<Value> {
    let msg: Value = match serde_json::from_str(raw) {
        Ok(msg) => msg,
        Err(_) => return Some(error_response(Value::Null, -32700, "parse error")),
    };
    let id = msg.get("id").cloned()?;
    let result = match msg
        .get("method")
        .and_then(Value::as_str)
        .unwrap_or_default()
    {
        "ping" => json!({}),
        "tools/call" => {
            let name = msg
                .pointer("/params/name")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            let arguments = msg
                .pointer("/params/arguments")
                .cloned()
                .unwrap_or_else(|| json!({}));
            match call_tool(app, &name, arguments) {
                Ok(result) => result,
                // MCP prefers tool failures as an isError result, not a
                // protocol error — the agent can read and react to them.
                Err(message) => json!({
                    "content": [{ "type": "text", "text": message }],
                    "isError": true
                }),
            }
        }
        method => {
            return Some(error_response(
                id,
                -32601,
                &format!("method not supported by the Lousa bridge: {method}"),
            ))
        }
    };
    Some(json!({ "jsonrpc": "2.0", "id": id, "result": result }))
}

/// Emit the call to the webview and block this connection's thread until
/// `mcp_tool_result` resolves it (or the timeout passes).
fn call_tool(app: &AppHandle, name: &str, arguments: Value) -> Result<Value, String> {
    let call_id = NEXT_CALL_ID.fetch_add(1, Ordering::Relaxed);
    let (tx, rx) = mpsc::channel();
    PENDING.lock().unwrap().insert(call_id, tx);
    let outcome = app
        .emit(
            "mcp-tool-call",
            json!({ "callId": call_id, "name": name, "arguments": arguments }),
        )
        .map_err(|err| format!("could not reach the Lousa window: {err}"))
        .and_then(|()| {
            rx.recv_timeout(TOOL_TIMEOUT).map_err(|_| {
                format!(
                    "Lousa did not answer '{name}' within {}s — is a document open?",
                    TOOL_TIMEOUT.as_secs()
                )
            })
        });
    PENDING.lock().unwrap().remove(&call_id);
    outcome
}

#[tauri::command]
pub fn mcp_tool_result(call_id: u64, result: Value) {
    if let Some(tx) = PENDING.lock().unwrap().remove(&call_id) {
        let _ = tx.send(result);
    }
}

/// The path an agent's MCP config must spawn. Inside an AppImage,
/// `current_exe()` points into the transient squashfs mount — the APPIMAGE
/// env var carries the real on-disk path.
#[tauri::command]
pub fn mcp_binary_path() -> String {
    if let Ok(appimage) = std::env::var("APPIMAGE") {
        return appimage;
    }
    std::env::current_exe()
        .map(|path| path.display().to_string())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    #[test]
    fn tool_result_for_unknown_call_is_ignored() {
        // Must not panic or block when the call already timed out.
        super::mcp_tool_result(u64::MAX, json!({ "content": [] }));
    }
}
