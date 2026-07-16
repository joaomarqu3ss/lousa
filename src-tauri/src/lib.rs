mod export;
mod fs;
pub mod mcp;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            mcp::server::start(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            fs::read_text_file,
            fs::save_text_file,
            fs::read_workspace_dir,
            fs::new_note,
            fs::rename_path,
            fs::delete_path,
            export::write_binary_file,
            export::export_pdf,
            mcp::server::mcp_tool_result,
            mcp::server::mcp_binary_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
