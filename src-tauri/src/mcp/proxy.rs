//! `lousa --mcp`: the MCP stdio server an external agent (Claude Code,
//! Codex) spawns. The handshake and tool catalog are static and live in this
//! same binary, so they are answered locally; each `tools/call` is forwarded
//! as-is to the running Lousa app over the local socket (ADR-0011). If no
//! app is running, the agent gets a clean, actionable error.

use std::io::{BufRead, BufReader, Write};

use interprocess::local_socket::traits::Stream as _;
use interprocess::local_socket::{RecvHalf, SendHalf, Stream};
use serde_json::{json, Value};

use super::error_response;

struct Connection {
    reader: BufReader<RecvHalf>,
    writer: SendHalf,
}

pub fn run() -> ! {
    let stdin = std::io::stdin();
    let mut conn: Option<Connection> = None;
    for line in stdin.lock().lines() {
        let Ok(line) = line else { break };
        if line.trim().is_empty() {
            continue;
        }
        let msg: Value = match serde_json::from_str(&line) {
            Ok(msg) => msg,
            Err(_) => {
                respond(&error_response(Value::Null, -32700, "parse error"));
                continue;
            }
        };
        let method = msg.get("method").and_then(Value::as_str).unwrap_or_default();
        let Some(id) = msg.get("id").cloned() else {
            continue; // notifications (e.g. notifications/initialized) need no reply
        };
        match method {
            "initialize" => {
                // Echo the client's protocol version: this proxy only pipes
                // tools/call through, which is stable across MCP revisions.
                let version = msg
                    .pointer("/params/protocolVersion")
                    .and_then(Value::as_str)
                    .unwrap_or("2024-11-05");
                respond(&json!({ "jsonrpc": "2.0", "id": id, "result": {
                    "protocolVersion": version,
                    "capabilities": { "tools": {} },
                    "serverInfo": { "name": "lousa", "version": env!("CARGO_PKG_VERSION") }
                } }));
            }
            "ping" => respond(&json!({ "jsonrpc": "2.0", "id": id, "result": {} })),
            "tools/list" => respond(&json!({ "jsonrpc": "2.0", "id": id, "result": {
                "tools": super::tools::catalog()
            } })),
            "tools/call" => {
                // Retry once with a fresh connection: the app may have been
                // restarted since the last call, leaving `conn` stale.
                let reply = forward(&mut conn, &line).or_else(|_| forward(&mut conn, &line));
                match reply {
                    Ok(raw) => print_raw(raw.trim_end()),
                    Err(_) => respond(&error_response(
                        id,
                        -32000,
                        "Lousa is not running (or its Agent Bridge is unreachable). \
                         Open the Lousa desktop app with a document visible, then try again.",
                    )),
                }
            }
            _ => respond(&error_response(id, -32601, &format!("method not found: {method}"))),
        }
    }
    std::process::exit(0);
}

/// Send one JSON-RPC line to the app and read the one-line reply, connecting
/// lazily. Any I/O failure invalidates the cached connection.
fn forward(conn: &mut Option<Connection>, line: &str) -> std::io::Result<String> {
    if conn.is_none() {
        let (reader, writer) = Stream::connect(super::socket_name()?)?.split();
        *conn = Some(Connection {
            reader: BufReader::new(reader),
            writer,
        });
    }
    let attempt = (|| {
        let live = conn.as_mut().expect("connection was just established");
        live.writer.write_all(line.as_bytes())?;
        live.writer.write_all(b"\n")?;
        live.writer.flush()?;
        let mut reply = String::new();
        if live.reader.read_line(&mut reply)? == 0 {
            return Err(std::io::Error::new(
                std::io::ErrorKind::UnexpectedEof,
                "the Lousa app closed the bridge",
            ));
        }
        Ok(reply)
    })();
    if attempt.is_err() {
        *conn = None;
    }
    attempt
}

fn respond(message: &Value) {
    print_raw(&message.to_string());
}

fn print_raw(raw: &str) {
    let mut stdout = std::io::stdout().lock();
    let _ = stdout.write_all(raw.as_bytes());
    let _ = stdout.write_all(b"\n");
    let _ = stdout.flush();
}
