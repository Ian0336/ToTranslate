use tauri::{Emitter, Window};
use std::thread;
use std::sync::atomic::{AtomicU64, Ordering};

// Global latest request id
static LATEST_REQUEST_ID: AtomicU64 = AtomicU64::new(0);

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn detect(window: Window, prompt: String) {
    // Get new request id (atomically increment)
    let request_id = LATEST_REQUEST_ID.fetch_add(1, Ordering::SeqCst) + 1;
    
    thread::spawn(move || {
        // Call Ollama API
        let resp = ureq::post("http://localhost:11434/api/generate")
            .send_json(ureq::json!({
                "model": "qwen2.5:3b",
                "prompt": prompt,
                "raw": true,
                "stream": false,
                "options": {
                    "temperature": 0.1,
                    "num_predict": 8,
                    "top_p": 0.9
                }
            }));

        // Check if still latest request
        let current_latest = LATEST_REQUEST_ID.load(Ordering::SeqCst);
        if request_id != current_latest {
            println!("Request {} skipped (latest is {})", request_id, current_latest);
            return;
        }

        match resp {
            Ok(response) => {
                match response.into_json::<serde_json::Value>() {
                    Ok(body) => {
                        let completion = body["response"].as_str().unwrap_or("");
                        let _ = window.emit("ai-token", completion);
                        let _ = window.emit("ai-done", "done");
                        println!("Request {} completed successfully", request_id);
                    }
                    Err(e) => {
                        let err_msg: String = e.to_string();
                        let _ = window.emit("ai-error", err_msg);
                    }
                }
            }
            Err(e) => {
                let err_msg: String = e.to_string();
                let _ = window.emit("ai-error", err_msg);
            }
        }
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
