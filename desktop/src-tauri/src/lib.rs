use std::sync::atomic::{AtomicU64, Ordering};
use std::thread;
use tauri::{Emitter, Manager, WebviewWindow};

#[cfg(desktop)]
use tauri::AppHandle;
#[cfg(desktop)]
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

static LATEST_REQUEST_ID: AtomicU64 = AtomicU64::new(0);

fn build_prompt(
    text: &str,
    source_code: &str,
    source_name: &str,
    target_code: &str,
    target_name: &str,
) -> String {
    format!(
        "You are a professional {source_name} ({source_code}) to {target_name} ({target_code}) translator. \
Your goal is to accurately convey the meaning and nuances of the original {source_name} text while adhering to {target_name} grammar, vocabulary, and cultural sensitivities.\n\
Produce only the {target_name} translation, without any additional explanations or commentary. Please translate the following {source_name} text into {target_name}:\n\n\
{text}"
    )
}

#[tauri::command]
fn translate(
    window: WebviewWindow,
    text: String,
    source_code: String,
    source_name: String,
    target_code: String,
    target_name: String,
    ollama_url: String,
    model: String,
) {
    let request_id = LATEST_REQUEST_ID.fetch_add(1, Ordering::SeqCst) + 1;

    thread::spawn(move || {
        let prompt = build_prompt(&text, &source_code, &source_name, &target_code, &target_name);
        let url = format!("{}/api/chat", ollama_url.trim_end_matches('/'));

        let resp = ureq::post(&url).send_json(ureq::json!({
            "model": model,
            "messages": [{ "role": "user", "content": prompt }],
            "stream": false,
        }));

        if request_id != LATEST_REQUEST_ID.load(Ordering::SeqCst) {
            return;
        }

        match resp {
            Ok(response) => match response.into_json::<serde_json::Value>() {
                Ok(body) => {
                    let translated = body["message"]["content"]
                        .as_str()
                        .unwrap_or("")
                        .trim()
                        .to_string();
                    let _ = window.emit("translation-result", translated);
                }
                Err(e) => {
                    let _ = window.emit("translation-error", e.to_string());
                }
            },
            Err(e) => {
                let _ = window.emit("translation-error", e.to_string());
            }
        }
    });
}

#[cfg(desktop)]
fn toggle_main_window(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    match window.is_visible() {
        Ok(true) => {
            let _ = window.hide();
        }
        _ => {
            let _ = window.center();
            let _ = window.show();
            let _ = window.set_focus();
            let _ = app.emit("window-shown", ());
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }));
    }

    builder = builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init());

    #[cfg(desktop)]
    {
        let toggle_shortcut =
            Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyT);
        let handler_shortcut = toggle_shortcut.clone();

        builder = builder
            .plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(move |app, scut, event| {
                        if scut == &handler_shortcut && event.state == ShortcutState::Pressed {
                            toggle_main_window(app);
                        }
                    })
                    .build(),
            )
            .setup(move |app| {
                #[cfg(target_os = "macos")]
                {
                    let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
                }
                app.global_shortcut().register(toggle_shortcut)?;
                Ok(())
            });
    }

    builder
        .invoke_handler(tauri::generate_handler![translate])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
