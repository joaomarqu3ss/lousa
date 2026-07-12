// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // WebKitGTK's DMA-BUF renderer crashes the webview on some Wayland
    // setups (GDK "Error 71" at window creation, notably NVIDIA drivers).
    // Fall back to the EGL path unless the user overrides it explicitly.
    // See https://github.com/tauri-apps/tauri/issues/9304
    #[cfg(target_os = "linux")]
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    lousa_lib::run()
}
