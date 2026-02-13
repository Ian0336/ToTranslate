/**
 * Background service worker for ToTranslate.
 *
 * Listens for messages from the content script, builds the translation
 * prompt, calls the Ollama chat API, and returns the translated text.
 */

// ---------------------------------------------------------------------------
// Supported languages (code → full name)
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
// Default settings
// ---------------------------------------------------------------------------

const DEFAULTS = {
  sourceLang: "en",
  targetLang: "zh",
  ollamaUrl: "http://localhost:11434",
  model: "translategemma:4b",
};

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

/**
 * Build the translation prompt following the TranslateGemma prompt guide.
 *
 * @param {string} text        - Text to translate.
 * @param {string} sourceCode  - ISO 639-1 source language code.
 * @param {string} targetCode  - ISO 639-1 target language code.
 * @returns {string} The formatted prompt string.
 */
function buildPrompt(text, sourceCode, targetCode) {
  const sourceLang = SUPPORTED_LANGUAGES[sourceCode] || sourceCode;
  const targetLang = SUPPORTED_LANGUAGES[targetCode] || targetCode;

  return (
    `You are a professional ${sourceLang} (${sourceCode}) to ` +
    `${targetLang} (${targetCode}) translator. ` +
    `Your goal is to accurately convey the meaning and nuances of the ` +
    `original ${sourceLang} text while adhering to ${targetLang} grammar, ` +
    `vocabulary, and cultural sensitivities.\n` +
    `Produce only the ${targetLang} translation, without any additional ` +
    `explanations or commentary. Please translate the following ` +
    `${sourceLang} text into ${targetLang}:\n\n` +
    text
  );
}

// ---------------------------------------------------------------------------
// Ollama API caller
// ---------------------------------------------------------------------------

/**
 * Send a translation request to the Ollama chat API.
 *
 * @param {string} text        - Text to translate.
 * @param {string} sourceCode  - Source language code.
 * @param {string} targetCode  - Target language code.
 * @param {string} ollamaUrl   - Base URL of the Ollama server.
 * @param {string} model       - Ollama model name.
 * @returns {Promise<string>}  - The translated text.
 */
async function translate(text, sourceCode, targetCode, ollamaUrl, model) {
  const prompt = buildPrompt(text, sourceCode, targetCode);
  const url = `${ollamaUrl}/api/chat`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Ollama API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return (data.message?.content ?? "").trim();
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "translate") {
    handleTranslate(message)
      .then((result) => sendResponse({ success: true, translated: result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    // Return true to indicate async response
    return true;
  }

  if (message.type === "testConnection") {
    handleTestConnection(message)
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

/**
 * Handle a translation request from the content script.
 */
async function handleTranslate(message) {
  const settings = await chrome.storage.sync.get(DEFAULTS);
  const ollamaUrl = message.ollamaUrl || settings.ollamaUrl;
  const model = message.model || settings.model;
  const sourceCode = message.sourceLang || settings.sourceLang;
  const targetCode = message.targetLang || settings.targetLang;

  return translate(message.text, sourceCode, targetCode, ollamaUrl, model);
}

/**
 * Handle a connection test request from the popup.
 */
async function handleTestConnection(message) {
  const url = message.ollamaUrl || DEFAULTS.ollamaUrl;
  const response = await fetch(`${url}/api/tags`);
  if (!response.ok) {
    throw new Error(`Ollama returned status ${response.status}`);
  }
  const data = await response.json();
  const models = (data.models || []).map((m) => m.name);
  return { success: true, models };
}
