use tauri::{Emitter, Window};
use std::thread;
use std::time::Duration;
use std::sync::atomic::{AtomicU64, Ordering};

// Global latest request id
static LATEST_REQUEST_ID: AtomicU64 = AtomicU64::new(0);

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn detect(window: Window, prompt: String) {
    // Get new request id (atomically increment)
    let request_id = LATEST_REQUEST_ID.fetch_add(1, Ordering::SeqCst) + 1;
    
    thread::spawn(move || {
        // mock ai response delay
        thread::sleep(Duration::from_millis(3000));
        
        // Check if it is the latest request
        let current_latest = LATEST_REQUEST_ID.load(Ordering::SeqCst);
        if request_id != current_latest {
            // Not the latest request, skip emit
            println!("Request {} skipped (latest is {})", request_id, current_latest);
            return;
        }
        
        let response_text = prompt + "This is AI generated text...";
        
        window.emit("ai-token", response_text).unwrap();
        
        // emit ai-done event to frontend
        window.emit("ai-done", "done").unwrap();
        
        println!("Request {} completed successfully", request_id);
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
