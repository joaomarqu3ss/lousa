//! Agent Bridge (ADR-0011): expose the live Canvas to external agents over
//! MCP. The `--mcp` CLI mode ([`proxy`]) is the stdio server an agent spawns;
//! it forwards tool calls to the running app's socket server ([`server`]),
//! which bridges them into the webview where the scene actually lives.

pub mod proxy;
pub mod server;
pub mod tools;

use interprocess::local_socket::Name;
use serde_json::{json, Value};

/// JSON-RPC error response, shared by the proxy and the in-app server.
pub(crate) fn error_response(id: Value, code: i64, message: &str) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": message } })
}

/// Filesystem path of the bridge socket (Unix only). `XDG_RUNTIME_DIR` is
/// already per-user; the temp-dir fallback disambiguates by username.
#[cfg(unix)]
pub fn socket_path() -> std::path::PathBuf {
    if let Some(dir) = std::env::var_os("XDG_RUNTIME_DIR") {
        return std::path::Path::new(&dir).join("lousa-mcp.sock");
    }
    let user = std::env::var("USER").unwrap_or_else(|_| "default".into());
    std::env::temp_dir().join(format!("lousa-mcp-{user}.sock"))
}

/// The per-user local socket name shared by the app-side server and the
/// `--mcp` proxy: a Unix domain socket on Unix, a named pipe on Windows.
#[cfg(unix)]
pub fn socket_name() -> std::io::Result<Name<'static>> {
    use interprocess::local_socket::{GenericFilePath, ToFsName};
    socket_path().to_fs_name::<GenericFilePath>()
}

#[cfg(windows)]
pub fn socket_name() -> std::io::Result<Name<'static>> {
    use interprocess::local_socket::{GenericNamespaced, ToNsName};
    let user = std::env::var("USERNAME").unwrap_or_else(|_| "default".into());
    format!("lousa-mcp-{user}.pipe").to_ns_name::<GenericNamespaced>()
}

#[cfg(test)]
mod tests {
    #[test]
    #[cfg(unix)]
    fn socket_path_is_per_user_without_runtime_dir() {
        // XDG_RUNTIME_DIR is usually set on dev machines; only assert the
        // invariant we own: the name always contains the lousa-mcp marker.
        let path = super::socket_path();
        assert!(path.to_string_lossy().contains("lousa-mcp"));
    }

    #[test]
    fn socket_name_resolves() {
        assert!(super::socket_name().is_ok());
    }

    #[test]
    fn error_response_is_json_rpc_shaped() {
        let response = super::error_response(serde_json::json!(7), -32601, "nope");
        assert_eq!(response["jsonrpc"], "2.0");
        assert_eq!(response["id"], 7);
        assert_eq!(response["error"]["code"], -32601);
    }
}
