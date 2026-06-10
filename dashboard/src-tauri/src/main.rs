#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod backend;

use std::sync::Mutex;
use tauri::Manager;

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![quit_app])
        .setup(|app| {
            // Spawn backend services and database and hold their handles in app state
            app.manage(Mutex::new(backend::spawn_services(app)));
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building DevFoundry application");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            // When the application exits, drop the Subprocesses which kills the child processes
            if let Some(backend_state) = app_handle.try_state::<Mutex<backend::Subprocesses>>() {
                if let Ok(mut lock) = backend_state.lock() {
                    lock.backend = None;
                    lock.db = None;
                }
            }
        }
    });
}
