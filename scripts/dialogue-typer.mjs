/**
 * Dialogue Typer
 * Typewriter effect for cinematic dialogue display using TypeIt.
 * Creates a visual-novel-style text box below the active speaker spotlight.
 */

import { getTypeIt } from './vendor-loader.mjs';

let _TypeIt = null;
let _loadFailed = false;
let _activeInstance = null;

async function ensureTypeIt() {
  if (_TypeIt) return _TypeIt;
  if (_loadFailed) return null;
  try {
    _TypeIt = await getTypeIt();
    return _TypeIt;
  } catch {
    _loadFailed = true;
    return null;
  }
}

/**
 * Type out dialogue in the cinematic dialogue box.
 * Creates the box if it doesn't exist.
 *
 * @param {HTMLElement} container - The .cinematic-scene-container element
 * @param {string} text - Dialogue text to type
 * @param {Object} [options]
 * @param {'slow'|'normal'|'fast'} [options.speed='normal'] - Typing speed preset
 * @param {Function} [options.onComplete] - Callback when typing finishes
 * @returns {Object|null} TypeIt instance for control, or null if unavailable
 */
export async function typeDialogue(container, text, { speed = 'normal', onComplete } = {}) {
  const TypeIt = await ensureTypeIt();

  // Get or create the dialogue box
  let box = container.querySelector('.cinematic-dialogue-box');
  if (!box) {
    box = document.createElement('div');
    box.className = 'cinematic-dialogue-box';
    container.appendChild(box);
  }

  // Clear previous instance
  destroyDialogue(container);
  box.innerHTML = '';
  box.style.display = '';

  // If TypeIt isn't available, fall back to instant text
  if (!TypeIt) {
    box.textContent = text;
    onComplete?.();
    return null;
  }

  const speeds = { slow: 70, normal: 35, fast: 12 };

  _activeInstance = new TypeIt(box, {
    strings: text,
    speed: speeds[speed] ?? 35,
    waitUntilVisible: false,
    cursor: false,
    afterComplete: (instance) => {
      onComplete?.();
      instance.destroy();
      _activeInstance = null;
    },
  }).go();

  return _activeInstance;
}

/**
 * Immediately finish any in-progress typing and show full text.
 * @param {HTMLElement} container - The .cinematic-scene-container element
 */
export function skipDialogue(container) {
  if (_activeInstance) {
    try { _activeInstance.flush?.(); } catch { /* noop */ }
    try { _activeInstance.destroy(); } catch { /* noop */ }
    _activeInstance = null;
  }
}

/**
 * Remove the dialogue box entirely.
 * @param {HTMLElement} container - The .cinematic-scene-container element
 */
export function destroyDialogue(container) {
  skipDialogue(container);
  const box = container?.querySelector('.cinematic-dialogue-box');
  if (box) box.style.display = 'none';
}

/**
 * Check if dialogue is currently being typed.
 * @returns {boolean}
 */
export function isTyping() {
  return _activeInstance !== null;
}
