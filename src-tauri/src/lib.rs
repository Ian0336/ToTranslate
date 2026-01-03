use tauri::{Emitter, Window};
use std::thread;
use std::time::Duration;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn detect(window: Window, prompt: String) {
    thread::spawn(move || {
        // mock ai response delay
        thread::sleep(Duration::from_millis(3000));
        let response_text = prompt + "This is AI generated text...";
        
        window.emit("ai-token", response_text).unwrap();
        
        // emit ai-done event to frontend
        window.emit("ai-done", "done").unwrap();
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![detect])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
