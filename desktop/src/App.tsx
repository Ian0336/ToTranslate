import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  readText,
  writeText,
} from "@tauri-apps/plugin-clipboard-manager";
import { SORTED_LANGUAGES, SUPPORTED_LANGUAGES } from "./languages";
import "./App.css";

type Settings = {
  sourceLang: string;
  targetLang: string;
  ollamaUrl: string;
  model: string;
};

const DEFAULT_SETTINGS: Settings = {
  sourceLang: "en",
  targetLang: "zh",
  ollamaUrl: "http://localhost:11434",
  model: "translategemma:4b",
};

const SETTINGS_KEY = "totranslate.settings";

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "streaming" | "error"
  >("idle");
  const [showSettings, setShowSettings] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const triggerTranslate = useCallback((text: string, s: Settings) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setOutput("");
      setStatus("idle");
      return;
    }
    setStatus("loading");
    invoke("translate", {
      text,
      sourceCode: s.sourceLang,
      sourceName: SUPPORTED_LANGUAGES[s.sourceLang] ?? s.sourceLang,
      targetCode: s.targetLang,
      targetName: SUPPORTED_LANGUAGES[s.targetLang] ?? s.targetLang,
      ollamaUrl: s.ollamaUrl,
      model: s.model,
    }).catch((e) => {
      setStatus("error");
      setOutput(`⚠ ${String(e)}`);
    });
  }, []);

  useEffect(() => {
    const unChunk = listen<string>("translation-chunk", (e) => {
      setOutput(e.payload);
      setStatus("streaming");
    });
    const unDone = listen<string>("translation-done", (e) => {
      if (e.payload) setOutput(e.payload);
      setStatus("idle");
    });
    const unError = listen<string>("translation-error", (e) => {
      setOutput(`⚠ ${e.payload}`);
      setStatus("error");
    });
    return () => {
      unChunk.then((un) => un());
      unDone.then((un) => un());
      unError.then((un) => un());
    };
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => triggerTranslate(input, settings), 400);
    return () => clearTimeout(handle);
  }, [input, settings, triggerTranslate]);

  useEffect(() => {
    const unShown = listen("window-shown", async () => {
      try {
        const text = await readText();
        if (text && text.trim()) {
          setInput(text);
          setTimeout(() => {
            const ta = textareaRef.current;
            if (ta) {
              ta.focus();
              ta.select();
            }
          }, 0);
        } else {
          setTimeout(() => textareaRef.current?.focus(), 0);
        }
      } catch {
        setTimeout(() => textareaRef.current?.focus(), 0);
      }
    });
    return () => {
      unShown.then((un) => un());
    };
  }, []);

  useEffect(() => {
    const win = getCurrentWindow();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        win.hide();
      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (output) writeText(output).catch(() => {});
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [output]);

  const swap = () => {
    const newInput = output && status !== "error" ? output : input;
    const newSettings = {
      ...settings,
      sourceLang: settings.targetLang,
      targetLang: settings.sourceLang,
    };
    setSettings(newSettings);
    setInput(newInput);
    setOutput("");
  };

  return (
    <main className="panel" data-tauri-drag-region>
      <header className="lang-bar" data-tauri-drag-region>
        <select
          className="lang-select"
          value={settings.sourceLang}
          onChange={(e) =>
            setSettings({ ...settings, sourceLang: e.target.value })
          }
        >
          {SORTED_LANGUAGES.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
        <button className="icon-btn" onClick={swap} title="Swap languages">
          ⇄
        </button>
        <select
          className="lang-select"
          value={settings.targetLang}
          onChange={(e) =>
            setSettings({ ...settings, targetLang: e.target.value })
          }
        >
          {SORTED_LANGUAGES.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
        <button
          className="icon-btn"
          onClick={() => setShowSettings((v) => !v)}
          title="Settings"
        >
          ⚙
        </button>
      </header>

      <textarea
        ref={textareaRef}
        className="source"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Paste or type to translate…"
        autoFocus
        spellCheck={false}
      />

      <div className={`output status-${status}`}>
        {output || (status === "loading" ? "Translating…" : "")}
      </div>

      <footer className="hint">
        <kbd>Esc</kbd> hide · <kbd>⌘⏎</kbd> copy translation
      </footer>

      {showSettings && (
        <div className="settings-sheet">
          <label>
            <span>Ollama URL</span>
            <input
              type="text"
              value={settings.ollamaUrl}
              onChange={(e) =>
                setSettings({ ...settings, ollamaUrl: e.target.value })
              }
            />
          </label>
          <label>
            <span>Model</span>
            <input
              type="text"
              value={settings.model}
              onChange={(e) =>
                setSettings({ ...settings, model: e.target.value })
              }
            />
          </label>
          <button
            className="icon-btn close"
            onClick={() => setShowSettings(false)}
          >
            Close
          </button>
        </div>
      )}
    </main>
  );
}

export default App;
