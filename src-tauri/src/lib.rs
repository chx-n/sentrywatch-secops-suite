mod backend;

use backend::{check_backend_running, BackendState};
use std::sync::Arc;
use tauri::WindowEvent;

pub fn run() {
    let backend_state = Arc::new(BackendState::new());
    let backend_clone = Arc::clone(&backend_state);
    let backend_exit = Arc::clone(&backend_state);

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .manage(BackendState::new())
        .invoke_handler(tauri::generate_handler![check_backend_running])
        .setup(move |_app| {
            backend_clone.start();
            Ok(())
        })
        .on_window_event(move |_window, event| {
            if let WindowEvent::CloseRequested { .. } = event {
                backend_exit.stop();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running sentrywatch desktop application");
}
