// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // `lousa --mcp` runs this binary as the MCP stdio proxy for an external
    // agent instead of launching the app (ADR-0011). Branch before any GUI
    // or env setup: the proxy must work headless.
    if std::env::args().any(|arg| arg == "--mcp") {
        lousa_lib::mcp::proxy::run();
    }

    // WebKitGTK's DMA-BUF renderer crashes the webview on Wayland + NVIDIA
    // (GDK "Error 71" at window creation) because of the driver's explicit-sync
    // protocol. Disabling explicit sync avoids the crash while keeping the
    // hardware-accelerated renderer — blanket WEBKIT_DISABLE_DMABUF_RENDERER=1
    // forced CPU rasterization and made drawing visibly slow. The variable is
    // only read by the NVIDIA driver, so it is harmless elsewhere. Users can
    // still override either variable explicitly, including setting
    // WEBKIT_DISABLE_DMABUF_RENDERER=1 if their setup crashes regardless.
    // See https://github.com/tauri-apps/tauri/issues/9304
    #[cfg(target_os = "linux")]
    if std::env::var_os("__NV_DISABLE_EXPLICIT_SYNC").is_none() {
        std::env::set_var("__NV_DISABLE_EXPLICIT_SYNC", "1");
    }

    lousa_lib::run()
}
