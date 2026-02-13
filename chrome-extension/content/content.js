/**
 * ToTranslate — Content Script
 *
 * Injects a floating translate button on the right edge of every page.
 * When clicked the script:
 *   1. Collects all translatable text elements
 *   2. Sends each to the background worker for Ollama translation
 *   3. Inserts the translated text below the original element
 *
 * Clicking the button again while idle removes all translations.
 * Clicking while translating cancels the current run.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUTTON_ID = "totranslate-fab";
const RESULT_CLASS = "totranslate-result";
const DONE_ATTR = "data-totranslate";
const TRANSLATABLE = "p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd";

// Minimum visible text length to qualify for translation
const MIN_TEXT_LENGTH = 2;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** @type {"idle" | "translating" | "done"} */
let state = "idle";

/** Used to cancel an in-progress run */
let cancelled = false;

// ---------------------------------------------------------------------------
// Floating button
// ---------------------------------------------------------------------------

/**
 * Create and inject the floating translate button on the right edge.
 */
function createButton() {
  if (document.getElementById(BUTTON_ID)) return;

  const btn = document.createElement("div");
  btn.id = BUTTON_ID;
  btn.title = "Translate this page";
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 8l6 6"/>
      <path d="M4 14l6-6 2-3"/>
      <path d="M2 5h12"/>
      <path d="M7 2h1"/>
      <path d="M22 22l-5-10-5 10"/>
      <path d="M14 18h6"/>
    </svg>
    <span class="totranslate-fab-label">Translate</span>
  `;

  btn.addEventListener("click", onButtonClick);
  document.body.appendChild(btn);
}

/**
 * Update the button's visual state and label.
 *
 * @param {"idle"|"translating"|"done"} newState
 * @param {string} [label]
 */
function setButtonState(newState, label) {
  state = newState;
  const btn = document.getElementById(BUTTON_ID);
  if (!btn) return;

  const labelEl = btn.querySelector(".totranslate-fab-label");

  btn.classList.remove("tt-translating", "tt-done");

  switch (newState) {
    case "idle":
      btn.title = "Translate this page";
      if (labelEl) labelEl.textContent = "Translate";
      break;
    case "translating":
      btn.classList.add("tt-translating");
      btn.title = "Click to cancel";
      if (labelEl) labelEl.textContent = label || "0 %";
      break;
    case "done":
      btn.classList.add("tt-done");
      btn.title = "Click to remove translations";
      if (labelEl) labelEl.textContent = "Clear";
      break;
  }
}

// ---------------------------------------------------------------------------
// Element collection
// ---------------------------------------------------------------------------

/**
 * Return an array of leaf-level translatable elements on the page.
 *
 * "Leaf-level" means the element does not contain any other elements that
 * are themselves in the TRANSLATABLE selector list, preventing us from
 * translating both a parent and its children.
 *
 * @returns {HTMLElement[]}
 */
function getTranslatableElements() {
  const all = document.querySelectorAll(TRANSLATABLE);
  return Array.from(all).filter((el) => {
    // Skip elements already translated
    if (el.hasAttribute(DONE_ATTR)) return false;
    // Skip elements that contain other translatable children
    if (el.querySelector(TRANSLATABLE)) return false;
    // Skip hidden elements
    if (el.offsetParent === null && getComputedStyle(el).position !== "fixed") return false;
    // Skip very short text
    const text = el.innerText?.trim();
    if (!text || text.length < MIN_TEXT_LENGTH) return false;
    // Skip elements that are part of our extension UI
    if (el.closest(`#${BUTTON_ID}`) || el.classList.contains(RESULT_CLASS)) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Translation logic
// ---------------------------------------------------------------------------

/**
 * Translate a single text string via the background service worker.
 *
 * @param {string} text - Text to translate.
 * @returns {Promise<string>} The translated text.
 */
function translateText(text) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "translate", text }, (response) => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      if (!response?.success) {
        return reject(new Error(response?.error || "Translation failed"));
      }
      resolve(response.translated);
    });
  });
}

/**
 * Insert a translated text block below the given element.
 *
 * For table cells (td, th) the block is appended inside the cell.
 * For all other elements it is inserted as the next sibling.
 *
 * @param {HTMLElement} el   - The original element.
 * @param {string} text      - The translated text.
 */
function insertTranslation(el, text) {
  const block = document.createElement("div");
  block.className = RESULT_CLASS;
  block.textContent = text;

  const tag = el.tagName.toLowerCase();
  if (tag === "td" || tag === "th") {
    el.appendChild(block);
  } else {
    el.insertAdjacentElement("afterend", block);
  }
  el.setAttribute(DONE_ATTR, "true");
}

/**
 * Remove all translation blocks and reset element markers.
 */
function clearTranslations() {
  document.querySelectorAll(`.${RESULT_CLASS}`).forEach((el) => el.remove());
  document.querySelectorAll(`[${DONE_ATTR}]`).forEach((el) => el.removeAttribute(DONE_ATTR));
}

/**
 * Run the full translation pipeline.
 *
 * Collects elements, translates them one-by-one, and inserts results.
 * Updates the button with progress. Can be cancelled mid-run.
 */
async function runTranslation() {
  const elements = getTranslatableElements();
  const total = elements.length;

  if (total === 0) {
    showToast("No translatable text found on this page.");
    setButtonState("idle");
    return;
  }

  let completed = 0;

  for (const el of elements) {
    if (cancelled) break;

    const text = el.innerText.trim();
    try {
      const translated = await translateText(text);
      if (cancelled) break;
      if (translated) {
        insertTranslation(el, translated);
      }
    } catch (err) {
      console.error("[ToTranslate] Translation error:", err);
      // Insert error indicator but keep going
      insertTranslation(el, `⚠ ${err.message}`);
    }

    completed++;
    const pct = Math.round((completed / total) * 100);
    setButtonState("translating", `${pct} %`);
  }

  if (cancelled) {
    cancelled = false;
    setButtonState("idle");
  } else {
    setButtonState("done");
  }
}

// ---------------------------------------------------------------------------
// Button click handler
// ---------------------------------------------------------------------------

function onButtonClick() {
  switch (state) {
    case "idle":
      setButtonState("translating", "0 %");
      cancelled = false;
      runTranslation();
      break;
    case "translating":
      cancelled = true;
      break;
    case "done":
      clearTranslations();
      setButtonState("idle");
      break;
  }
}

// ---------------------------------------------------------------------------
// Toast notification
// ---------------------------------------------------------------------------

/**
 * Show a brief toast message at the bottom-right of the viewport.
 *
 * @param {string} msg - Message to display.
 */
function showToast(msg) {
  const toast = document.createElement("div");
  toast.className = "totranslate-toast";
  toast.textContent = msg;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("tt-show"));

  setTimeout(() => {
    toast.classList.remove("tt-show");
    toast.addEventListener("transitionend", () => toast.remove());
  }, 3000);
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

createButton();
