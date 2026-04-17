/**
 * ToTranslate — Content Script (hybrid picking mode)
 *
 * Two ways to trigger a translation:
 *
 *   A. Block picking — click the floating button to enter picking mode.
 *      Hover over any block to highlight it, click to translate just that
 *      block. The translation is inserted below the original. Click the
 *      button again (or press Escape) to leave picking mode.
 *
 *   B. Text selection — highlight any text on the page. A small "Translate"
 *      popup appears near the selection. Click it to translate just the
 *      selected text; the result is shown in a floating card.
 *
 * A "Clear" pill appears next to the main button whenever at least one
 * translation exists on the page.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUTTON_ID = "totranslate-fab";
const CLEAR_ID = "totranslate-clear";
const SEL_POPUP_CLASS = "totranslate-sel-popup";
const FLOAT_CARD_CLASS = "totranslate-float-card";
const HOVER_CLASS = "totranslate-hover";
const PICKING_BODY_CLASS = "totranslate-picking";
const RESULT_CLASS = "totranslate-result";
const DONE_ATTR = "data-totranslate";

const MIN_TEXT_LENGTH = 2;

// Tags that should never be treated as translation targets
const SKIP_TAGS = new Set([
  "script", "style", "noscript", "svg", "textarea", "input",
  "select", "option", "iframe", "canvas", "video", "audio",
  "img", "br", "hr", "meta", "link", "head", "template", "math",
  "html", "body",
]);

// Inline-level tags — walked past when looking for a block container
const INLINE_TAGS = new Set([
  "a", "abbr", "b", "bdi", "bdo", "cite", "code", "data",
  "dfn", "em", "i", "kbd", "mark", "q", "rp", "rt", "ruby",
  "s", "samp", "small", "span", "strong", "sub", "sup", "time",
  "u", "var", "wbr", "del", "ins", "label", "font",
]);

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let pickingActive = false;
/** @type {HTMLElement|null} */
let hoveredBlock = null;
/** @type {HTMLElement|null} */
let selPopup = null;

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

/**
 * Is the element part of our own UI?  We never want to translate or
 * highlight our FAB, Clear button, toasts, selection popup, or any
 * previously inserted translation block.
 *
 * @param {Element|null} el
 * @returns {boolean}
 */
function isOurUi(el) {
  if (!el) return false;
  return !!(
    el.closest(`#${BUTTON_ID}`) ||
    el.closest(`#${CLEAR_ID}`) ||
    el.closest(`.${RESULT_CLASS}`) ||
    el.closest(`.${SEL_POPUP_CLASS}`) ||
    el.closest(`.${FLOAT_CARD_CLASS}`) ||
    el.closest(".totranslate-toast")
  );
}

/**
 * Walk up from an element until we find a block-level container that
 * is a sensible translation target. Inline wrappers (span, em, a...)
 * are skipped so hovering on a single word still highlights the whole
 * surrounding paragraph.
 *
 * @param {Element|null} el
 * @returns {HTMLElement|null}
 */
function findBlockContainer(el) {
  while (el && el !== document.body && el !== document.documentElement) {
    const tag = el.tagName?.toLowerCase();
    if (SKIP_TAGS.has(tag)) return null;
    if (!INLINE_TAGS.has(tag)) return /** @type {HTMLElement} */ (el);
    el = el.parentElement;
  }
  return null;
}

/**
 * Visible-text check for a block. We require at least MIN_TEXT_LENGTH
 * characters of actual text.
 */
function hasMeaningfulText(el) {
  const text = el.innerText?.trim() || "";
  return text.length >= MIN_TEXT_LENGTH;
}

// ---------------------------------------------------------------------------
// Floating action button (FAB) + Clear pill
// ---------------------------------------------------------------------------

function createButton() {
  if (document.getElementById(BUTTON_ID)) return;

  const btn = document.createElement("div");
  btn.id = BUTTON_ID;
  btn.title = "Translate — click a block to translate it";
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
  btn.addEventListener("click", onFabClick);
  document.body.appendChild(btn);

  const clear = document.createElement("div");
  clear.id = CLEAR_ID;
  clear.title = "Clear all translations";
  clear.textContent = "Clear";
  clear.addEventListener("click", () => {
    clearTranslations();
    updateFab();
  });
  document.body.appendChild(clear);

  updateFab();
}

function updateFab() {
  const btn = document.getElementById(BUTTON_ID);
  if (btn) {
    const label = btn.querySelector(".totranslate-fab-label");
    btn.classList.toggle("tt-picking", pickingActive);
    if (label) label.textContent = pickingActive ? "Cancel" : "Translate";
    btn.title = pickingActive
      ? "Exit picking mode (or press Escape)"
      : "Translate — click a block to translate it";
  }

  const clear = document.getElementById(CLEAR_ID);
  if (clear) {
    const hasAny = !!document.querySelector(`.${RESULT_CLASS}`);
    clear.classList.toggle("tt-visible", hasAny);
  }
}

function onFabClick() {
  if (pickingActive) exitPicking();
  else enterPicking();
}

// ---------------------------------------------------------------------------
// Picking mode (block hover + click)
// ---------------------------------------------------------------------------

function enterPicking() {
  pickingActive = true;
  document.body.classList.add(PICKING_BODY_CLASS);
  document.addEventListener("mousemove", onPickMouseMove, true);
  document.addEventListener("click", onPickClick, true);
  document.addEventListener("keydown", onPickKeyDown, true);
  updateFab();
}

function exitPicking() {
  pickingActive = false;
  document.body.classList.remove(PICKING_BODY_CLASS);
  document.removeEventListener("mousemove", onPickMouseMove, true);
  document.removeEventListener("click", onPickClick, true);
  document.removeEventListener("keydown", onPickKeyDown, true);
  clearHover();
  updateFab();
}

function clearHover() {
  if (hoveredBlock) {
    hoveredBlock.classList.remove(HOVER_CLASS);
    hoveredBlock = null;
  }
}

function onPickMouseMove(e) {
  // Don't fight with active text selection — let the user drag to select.
  const sel = window.getSelection();
  if (sel && !sel.isCollapsed) return clearHover();

  const target = document.elementFromPoint(e.clientX, e.clientY);
  if (!target || isOurUi(target)) return clearHover();

  const block = findBlockContainer(target);
  if (!block) return clearHover();
  if (block === hoveredBlock) return;
  if (!hasMeaningfulText(block)) return clearHover();

  clearHover();
  hoveredBlock = block;
  hoveredBlock.classList.add(HOVER_CLASS);
}

function onPickClick(e) {
  if (isOurUi(e.target)) return;

  // If the user just finished dragging a selection, let the selection
  // popup handle it rather than translating the whole block.
  const sel = window.getSelection();
  if (sel && sel.toString().trim().length >= MIN_TEXT_LENGTH) return;

  const target = document.elementFromPoint(e.clientX, e.clientY);
  if (!target) return;
  const block = findBlockContainer(target);
  if (!block || !hasMeaningfulText(block)) return;

  e.preventDefault();
  e.stopPropagation();

  clearHover();
  translateBlock(block);
}

function onPickKeyDown(e) {
  if (e.key === "Escape") exitPicking();
}

// ---------------------------------------------------------------------------
// Translation
// ---------------------------------------------------------------------------

/**
 * Send a single string to the background worker for translation.
 *
 * @param {string} text
 * @returns {Promise<string>}
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
 * Translate a block and insert the result below it. Shows a pending
 * placeholder immediately so the user sees something happen.
 *
 * @param {HTMLElement} el
 */
async function translateBlock(el) {
  if (el.hasAttribute(DONE_ATTR)) return; // already translated / in progress

  const text = el.innerText?.trim();
  if (!text) return;

  el.setAttribute(DONE_ATTR, "pending");
  const placeholder = insertResult(el, "…", true);
  updateFab();

  try {
    const translated = await translateText(text);
    placeholder.textContent = translated || "(empty)";
    placeholder.classList.remove("tt-pending");
    el.setAttribute(DONE_ATTR, "true");
  } catch (err) {
    console.error("[ToTranslate] Translation error:", err);
    placeholder.textContent = `⚠ ${err.message}`;
    placeholder.classList.remove("tt-pending");
    placeholder.classList.add("tt-error");
    el.removeAttribute(DONE_ATTR);
  }
  updateFab();
}

/**
 * Insert a result block below (or inside, for table cells) an element.
 *
 * @param {HTMLElement} el
 * @param {string} text
 * @param {boolean} pending
 * @returns {HTMLElement} the inserted block
 */
function insertResult(el, text, pending) {
  const block = document.createElement("div");
  block.className = RESULT_CLASS + (pending ? " tt-pending" : "");
  block.textContent = text;

  const tag = el.tagName.toLowerCase();
  if (tag === "td" || tag === "th") {
    el.appendChild(block);
  } else {
    el.insertAdjacentElement("afterend", block);
  }
  return block;
}

function clearTranslations() {
  document.querySelectorAll(`.${RESULT_CLASS}`).forEach((el) => el.remove());
  document.querySelectorAll(`[${DONE_ATTR}]`).forEach((el) => el.removeAttribute(DONE_ATTR));
  document.querySelectorAll(`.${FLOAT_CARD_CLASS}`).forEach((el) => el.remove());
}

// ---------------------------------------------------------------------------
// Text-selection popup + floating result card
// ---------------------------------------------------------------------------

function installSelectionListeners() {
  // Delay on mouseup — the selection isn't final until after the event.
  document.addEventListener("mouseup", () => {
    setTimeout(maybeShowSelPopup, 10);
  }, true);

  document.addEventListener("selectionchange", () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) hideSelPopup();
  });

  // Clicking outside selection & popup dismisses the popup.
  document.addEventListener("mousedown", (e) => {
    if (selPopup && !selPopup.contains(e.target)) {
      // Will be re-shown by maybeShowSelPopup on mouseup if selection survives.
      hideSelPopup();
    }
  }, true);
}

function maybeShowSelPopup() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return hideSelPopup();
  const text = sel.toString().trim();
  if (text.length < MIN_TEXT_LENGTH) return hideSelPopup();

  // Ignore selections inside our own UI (e.g. inside an existing result).
  const anchorEl = sel.anchorNode?.nodeType === Node.ELEMENT_NODE
    ? sel.anchorNode
    : sel.anchorNode?.parentElement;
  if (isOurUi(anchorEl)) return hideSelPopup();

  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  if (!rect || (rect.width === 0 && rect.height === 0)) return hideSelPopup();

  showSelPopup(text, rect);
}

function showSelPopup(text, rect) {
  hideSelPopup();
  const popup = document.createElement("div");
  popup.className = SEL_POPUP_CLASS;
  popup.textContent = "Translate";

  // Place just below the selection, clamped to viewport width.
  const top = window.scrollY + rect.bottom + 6;
  const left = Math.min(
    window.scrollX + rect.left,
    window.scrollX + document.documentElement.clientWidth - 110,
  );
  popup.style.top = `${top}px`;
  popup.style.left = `${left}px`;

  // Keep the selection alive when the user mouses into the popup.
  popup.addEventListener("mousedown", (e) => e.preventDefault());
  popup.addEventListener("click", (e) => {
    e.stopPropagation();
    translateSelection(text, rect);
  });

  document.body.appendChild(popup);
  selPopup = popup;
}

function hideSelPopup() {
  if (selPopup) {
    selPopup.remove();
    selPopup = null;
  }
}

async function translateSelection(text, rect) {
  hideSelPopup();
  const card = createFloatCard(rect);
  try {
    const translated = await translateText(text);
    card.body.textContent = translated || "(empty)";
  } catch (err) {
    console.error("[ToTranslate] Translation error:", err);
    card.body.textContent = `⚠ ${err.message}`;
    card.root.classList.add("tt-error");
  }
  updateFab();
}

/**
 * Create a floating card near a selection rect, with a close button
 * and a loading spinner. Returns the root and body elements.
 */
function createFloatCard(rect) {
  const root = document.createElement("div");
  root.className = FLOAT_CARD_CLASS;

  const body = document.createElement("div");
  body.className = "totranslate-float-body";
  body.textContent = "Translating…";
  root.appendChild(body);

  const close = document.createElement("div");
  close.className = "totranslate-float-close";
  close.textContent = "×";
  close.title = "Close";
  close.addEventListener("click", () => root.remove());
  root.appendChild(close);

  const top = window.scrollY + rect.bottom + 8;
  const left = Math.min(
    window.scrollX + rect.left,
    window.scrollX + document.documentElement.clientWidth - 340,
  );
  root.style.top = `${top}px`;
  root.style.left = `${left}px`;

  document.body.appendChild(root);
  updateFab();
  return { root, body };
}

// ---------------------------------------------------------------------------
// Toast (unused for now but kept for future use)
// ---------------------------------------------------------------------------

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

// Only inject UI in the top frame — but selection still works in iframes
// if all_frames is set in the manifest.
if (window.top === window) {
  createButton();
}
installSelectionListeners();
