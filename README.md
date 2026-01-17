# AlltoComplete

A Tauri desktop application that provides intelligent text completion using local LLM (Ollama).

## ✨ Features

- **Smart Completion**: Automatically calls local LLM to generate completion suggestions as you type
- **Debounce**: Waits 500ms after you stop typing before triggering AI request
- **Tab Accept**: Press Tab to append the first suggested word to your input
- **Latest Request Priority**: Only returns the most recent request result; older requests are ignored

## 🔧 Prerequisites

1. **Ollama** - Local LLM service
   ```bash
   # macOS
   brew install ollama
   
   # Or download from https://ollama.ai
   ```

2. **Download a model**
   ```bash
   ollama pull qwen2.5:3b
   ```

3. **Make sure Ollama is running**
   ```bash
   ollama serve
   ```

## 🚀 Development

```bash
# Install dependencies
pnpm install

# Development mode
npm run tauri dev

# Build for production
npm run tauri build
```

## 📖 Usage

1. Launch the application
2. Type text in the input field
3. After 500ms of inactivity, AI suggestions will appear below
4. Press **Tab** to append the first suggested word to your input
5. Keep typing or press Tab again to accept more suggestions

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + TypeScript + Vite |
| Backend | Rust + Tauri |
| AI | Ollama (qwen2.5:3b) |

## 📁 Project Structure

```
alltoComplete/
├── src/                  # React frontend
│   └── App.tsx          # Main application logic
├── src-tauri/           # Rust backend
│   └── src/lib.rs       # Tauri commands
└── scripts/             # Python test scripts
    └── main.py          # Ollama API testing
```

## ⚙️ Configuration

Edit `src-tauri/src/lib.rs` to adjust LLM parameters:

```rust
"model": "qwen2.5:3b",      // Model name
"num_predict": 8,            // Number of tokens to generate
"temperature": 0.1,          // Creativity (0-1)
```

## 📝 License

MIT
