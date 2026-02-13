/**
 * ToTranslate — Popup Script
 *
 * Manages extension settings (source/target language, Ollama URL, model)
 * stored in chrome.storage.sync.  Also provides a "Test Connection" button
 * that verifies the Ollama server is reachable and lists available models.
 */

// ---------------------------------------------------------------------------
// Supported languages
// ---------------------------------------------------------------------------

const SUPPORTED_LANGUAGES = {
  af: "Afrikaans", am: "Amharic", ar: "Arabic", az: "Azerbaijani",
  be: "Belarusian", bg: "Bulgarian", bn: "Bengali", ca: "Catalan",
  cs: "Czech", cy: "Welsh", da: "Danish", de: "German",
  el: "Greek", en: "English", es: "Spanish", et: "Estonian",
  fa: "Persian", fi: "Finnish", fr: "French", ga: "Irish",
  gl: "Galician", gu: "Gujarati", ha: "Hausa", hi: "Hindi",
  hr: "Croatian", hu: "Hungarian", hy: "Armenian", id: "Indonesian",
  is: "Icelandic", it: "Italian", ja: "Japanese", ka: "Georgian",
  kk: "Kazakh", km: "Khmer", kn: "Kannada", ko: "Korean",
  lt: "Lithuanian", lv: "Latvian", mk: "Macedonian", ml: "Malayalam",
  mn: "Mongolian", mr: "Marathi", ms: "Malay", mt: "Maltese",
  my: "Myanmar (Burmese)", ne: "Nepali", nl: "Dutch", no: "Norwegian",
  pa: "Punjabi", pl: "Polish", pt: "Portuguese", ro: "Romanian",
  ru: "Russian", sk: "Slovak", sl: "Slovenian", so: "Somali",
  sq: "Albanian", sr: "Serbian", sv: "Swedish", sw: "Swahili",
  ta: "Tamil", te: "Telugu", th: "Thai", tr: "Turkish",
  uk: "Ukrainian", ur: "Urdu", uz: "Uzbek", vi: "Vietnamese",
  zh: "Chinese", zu: "Zulu",
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULTS = {
  sourceLang: "en",
  targetLang: "zh",
  ollamaUrl: "http://localhost:11434",
  model: "translategemma:4b",
};

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------

const $sourceLang = document.getElementById("source-lang");
const $targetLang = document.getElementById("target-lang");
const $ollamaUrl = document.getElementById("ollama-url");
const $model = document.getElementById("model-name");
const $swapBtn = document.getElementById("swap-btn");
const $testBtn = document.getElementById("test-btn");
const $saveBtn = document.getElementById("save-btn");
const $status = document.getElementById("status");

// ---------------------------------------------------------------------------
// Populate language dropdowns
// ---------------------------------------------------------------------------

function populateDropdowns() {
  const sorted = Object.entries(SUPPORTED_LANGUAGES).sort((a, b) =>
    a[1].localeCompare(b[1])
  );

  for (const [code, name] of sorted) {
    const optSrc = new Option(`${name} (${code})`, code);
    const optTgt = new Option(`${name} (${code})`, code);
    $sourceLang.appendChild(optSrc);
    $targetLang.appendChild(optTgt);
  }
}

// ---------------------------------------------------------------------------
// Load / Save settings
// ---------------------------------------------------------------------------

async function loadSettings() {
  const settings = await chrome.storage.sync.get(DEFAULTS);
  $sourceLang.value = settings.sourceLang;
  $targetLang.value = settings.targetLang;
  $ollamaUrl.value = settings.ollamaUrl;
  $model.value = settings.model;
}

async function saveSettings() {
  const settings = {
    sourceLang: $sourceLang.value,
    targetLang: $targetLang.value,
    ollamaUrl: $ollamaUrl.value.replace(/\/+$/, ""), // strip trailing slash
    model: $model.value.trim(),
  };

  await chrome.storage.sync.set(settings);
  showStatus("Settings saved.", "success");
}

// ---------------------------------------------------------------------------
// Swap languages
// ---------------------------------------------------------------------------

function swapLanguages() {
  const tmp = $sourceLang.value;
  $sourceLang.value = $targetLang.value;
  $targetLang.value = tmp;
}

// ---------------------------------------------------------------------------
// Test connection
// ---------------------------------------------------------------------------

async function testConnection() {
  showStatus("Connecting to Ollama...", "info");
  $testBtn.disabled = true;

  try {
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: "testConnection", ollamaUrl: $ollamaUrl.value.replace(/\/+$/, "") },
        (resp) => {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
          if (!resp?.success) return reject(new Error(resp?.error || "Connection failed"));
          resolve(resp);
        }
      );
    });

    const models = response.models || [];
    if (models.length === 0) {
      showStatus("Connected, but no models found. Run: ollama pull translategemma:4b", "error");
    } else {
      showStatus(`Connected! Available models: ${models.join(", ")}`, "success");
    }
  } catch (err) {
    showStatus(`Connection failed: ${err.message}`, "error");
  } finally {
    $testBtn.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Status display
// ---------------------------------------------------------------------------

/**
 * Show a status message in the popup.
 *
 * @param {string} msg   - Message text.
 * @param {"success"|"error"|"info"} type - Visual style.
 */
function showStatus(msg, type) {
  $status.textContent = msg;
  $status.className = `status ${type}`;
  $status.hidden = false;
}

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------

$saveBtn.addEventListener("click", saveSettings);
$testBtn.addEventListener("click", testConnection);
$swapBtn.addEventListener("click", swapLanguages);

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

populateDropdowns();
loadSettings();
