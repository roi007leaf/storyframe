/**
 * Vendor Library Loader
 * Lazy-loads external libraries via ESM CDN imports.
 * Each library is loaded once and cached for subsequent calls.
 */

const _cache = new Map();

/**
 * Load a library by key. Returns cached module if already loaded.
 * @param {string} key - Library identifier
 * @returns {Promise<any>} The loaded module
 */
async function load(key) {
  if (_cache.has(key)) return _cache.get(key);

  const urls = LIBRARIES[key];
  if (!urls) throw new Error(`Unknown vendor library: ${key}`);

  let lastError;
  for (const url of urls) {
    try {
      const mod = await import(url);
      const resolved = mod.default ?? mod;
      _cache.set(key, resolved);
      return resolved;
    } catch (e) {
      lastError = e;
      console.warn(`StoryFrame | Failed to load ${key} from ${url}:`, e.message);
    }
  }

  console.error(`StoryFrame | Could not load ${key} from any CDN source`);
  throw lastError;
}

/**
 * CDN sources per library (primary + fallback)
 */
const LIBRARIES = {
  autoAnimate: [
    'https://cdn.jsdelivr.net/npm/@formkit/auto-animate@0.8.2/index.mjs',
    'https://unpkg.com/@formkit/auto-animate@0.8.2/index.mjs',
  ],
  sortable: [
    'https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/+esm',
    'https://unpkg.com/sortablejs@1.15.6/modular/sortable.esm.js',
  ],
  motion: [
    'https://cdn.jsdelivr.net/npm/motion@12/+esm',
    'https://unpkg.com/motion@12/dist/motion.mjs',
  ],
  typeit: [
    'https://cdn.jsdelivr.net/npm/typeit@8/+esm',
    'https://unpkg.com/typeit@8/dist/index.es.js',
  ],
};

/**
 * Convenience accessors — each returns a Promise
 */
export const getAutoAnimate = () => load('autoAnimate');
export const getSortable     = () => load('sortable');
export const getMotion       = () => load('motion');
export const getTypeIt       = () => load('typeit');

/**
 * Pre-warm libraries in the background (non-blocking).
 * Call during module init to reduce first-use latency.
 * @param {...string} keys - Library keys to preload
 */
export function preload(...keys) {
  for (const key of keys) {
    load(key).catch(() => {}); // Swallow — will retry on actual use
  }
}
