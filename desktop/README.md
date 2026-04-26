# ToTranslate (Desktop)

A summon-anywhere local translator. Press **⌘⇧T** from any app, get a floating panel that translates your clipboard via local Ollama.

## Features

- **Global hotkey** `Cmd+Shift+T` toggles a floating, always-on-top panel
- **Auto clipboard pickup** — opens with your latest copied text pre-filled
- **60+ languages** with one-click swap
- **Local & private** — runs entirely against your Ollama server
- **No dock icon** (macOS) — feels like a system utility

## Prerequisites

1. **Ollama** running locally:
   ```bash
   brew install ollama   # or download from https://ollama.ai
   ollama serve
   ```
2. **Pull a translation model** (default: `translategemma:4b`):
   ```bash
   ollama pull translategemma:4b
   ```

## Development

```bash
pnpm install
pnpm tauri dev
```

The window is hidden on launch. Press `Cmd+Shift+T` to summon it.

## Build

```bash
pnpm tauri build
```

## Usage

1. Copy any text in any app.
2. Press **⌘⇧T** — panel appears, your clipboard is pre-filled and translated.
3. Edit/replace the text to retranslate (debounced).
4. **⌘⏎** copies the translation back to your clipboard.
5. **Esc** hides the panel (process stays alive for instant re-summon).

## Settings

Click the ⚙ icon in the panel to change:
- **Ollama URL** (default `http://localhost:11434`)
- **Model** (default `translategemma:4b`)

Source/target language dropdowns persist across sessions.

## Tech

| Layer | Tech |
|-------|------|
| Frontend | React 19 + TypeScript + Vite |
| Backend | Rust + Tauri 2 |
| AI | Ollama (chat API, non-streaming) |
| Plugins | global-shortcut, clipboard-manager, single-instance |

## Project Structure

```
desktop/
├── src/
│   ├── App.tsx          # Translation panel UI
│   ├── App.css
│   └── languages.ts     # 60+ language code→name map
├── src-tauri/
│   ├── src/lib.rs       # translate command + hotkey wiring
│   ├── tauri.conf.json  # Window config (frameless, on-top, hidden on launch)
│   └── capabilities/
└── README.md
```

## Notes

- The translation prompt mirrors the chrome-extension's, so output quality is consistent across products.
- `Cmd+Shift+T` will override Chrome's "reopen closed tab" while this app is running. If you'd rather change it, edit the shortcut in `src-tauri/src/lib.rs` (search for `Modifiers::SUPER | Modifiers::SHIFT`).
