# ToTranslate

A local-first translation toolkit powered by [Ollama](https://ollama.com/) running on your machine. Translate any web page with one click using the `translategemma:4b` model.

## Project Structure

```
ToTranslate/
├── google-extension/ # Chrome extension — translate any web page with one click
└── desktop/          # Desktop app (Tauri) — standalone translation interface (coming soon)
```

## How It Works

1. **Ollama** runs locally and serves the `translategemma:4b` translation model.
2. The **Chrome extension** injects a floating "Translate" button on every page.
3. Click the button → all visible text is scraped, sent to Ollama, and the translation appears below each original text block.
4. Click again to clear all translations.

Settings (source/target language, Ollama URL, model) are configured via the extension popup.

---

## Prerequisites

- **[Ollama](https://ollama.com/)** installed and running
- **Chrome** or any Chromium-based browser

### Pull the translation model

```bash
ollama pull translategemma:4b
```

### Allow Chrome extension access (required)

Ollama blocks requests from Chrome extensions by default. You must set the `OLLAMA_ORIGINS` environment variable:

**Option A — run from terminal:**

```bash
OLLAMA_ORIGINS="chrome-extension://*" ollama serve
```

**Option B — macOS Ollama desktop app:**

```bash
# Set the env var globally, then restart the Ollama app
launchctl setenv OLLAMA_ORIGINS "chrome-extension://*"
```

**Option C — Linux systemd:**

```bash
sudo systemctl edit ollama
# Add under [Service]:
#   Environment="OLLAMA_ORIGINS=chrome-extension://*"
sudo systemctl restart ollama
```

---

## Chrome Extension Setup

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked** and select the `google-extension/` folder
4. The ToTranslate icon appears in your toolbar

### Usage

1. Navigate to any web page
2. Click the **Translate** tab on the right edge of the page
3. Translations appear below each text block as they complete
4. Click the tab again to **clear** all translations

### Extension Settings (popup)

Click the ToTranslate icon in the toolbar to open settings:

| Setting          | Default                    | Description                        |
|------------------|----------------------------|------------------------------------|
| Source Language   | English (en)               | Language of the page content       |
| Target Language   | Chinese (zh)               | Language to translate into         |
| Ollama Server URL | `http://localhost:11434`  | URL of your local Ollama server    |
| Model            | `translategemma:4b`        | Ollama model to use for translation |

Use **Test Connection** to verify Ollama is reachable and see available models.

---

## Translation Prompt

The extension uses the following prompt template (based on the TranslateGemma prompt guide):

```
You are a professional {SOURCE_LANG} ({SOURCE_CODE}) to {TARGET_LANG} ({TARGET_CODE}) translator.
Your goal is to accurately convey the meaning and nuances of the original {SOURCE_LANG} text
while adhering to {TARGET_LANG} grammar, vocabulary, and cultural sensitivities.
Produce only the {TARGET_LANG} translation, without any additional explanations or commentary.
Please translate the following {SOURCE_LANG} text into {TARGET_LANG}:

{TEXT}
```

---

## Extension File Structure

```
google-extension/
├── manifest.json              # Chrome Manifest V3
├── background/
│   └── background.js          # Service worker — Ollama API calls & prompt builder
├── content/
│   ├── content.js             # Floating button, DOM scraping, translation insertion
│   └── content.css            # Styles for button, translation blocks, toasts
└── popup/
    ├── popup.html             # Settings UI
    ├── popup.css              # Popup styles
    └── popup.js               # Settings logic & connection test
```

## License

See individual component directories for license information.
