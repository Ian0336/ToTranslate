import { useState, useEffect } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/core";
import { listen } from '@tauri-apps/api/event';
import "./App.css";

function App() {
  const [detectMsg, setDetectMsg] = useState("");

  async function detect(prompt: string) {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    invoke("detect", { prompt })
  }

  useEffect(() => {
    // 1. set listener
    // when Rust emits "ai-token" event, here we receive it
    const unlistenPromise = listen<string>('ai-token', (event: any) => {
      // event.payload is the token sent from Rust
      setDetectMsg(event.payload);
    });

    return () => {
      unlistenPromise.then((unlisten: any) => unlisten());
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    detect(e.target.value);
  };
  

  return (
    <main className="container">
      <h1>Welcome to Tauri + React</h1>

      <div className="row">
        <a href="https://vite.dev" target="_blank">
          <img src="/vite.svg" className="logo vite" alt="Vite logo" />
        </a>
        <a href="https://tauri.app" target="_blank">
          <img src="/tauri.svg" className="logo tauri" alt="Tauri logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <p>Click on the Tauri, Vite, and React logos to learn more.</p>

      
      <input
        id="greet-input"
        onChange={handleChange}
        placeholder="Enter a name..."
      />
      <p>{detectMsg}</p>
    </main>
  );
}

export default App;
