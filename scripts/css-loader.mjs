/**
 * Lazy CSS Loader
 * Loads module stylesheets on-demand instead of all at init.
 * Reduces style recalculation overhead when StoryFrame UI isn't active.
 */

import { MODULE_ID } from './constants.mjs';

const _loaded = new Set();

/**
 * Load one or more module CSS files on demand.
 * Safe to call multiple times — already-loaded files are skipped.
 * @param {...string} paths - CSS file paths relative to the module root
 */
export function loadCSS(...paths) {
  for (const path of paths) {
    if (_loaded.has(path)) continue;
    _loaded.add(path);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `modules/${MODULE_ID}/${path}`;
    document.head.appendChild(link);
  }
}

// Grouped loaders for related components

export function loadGMSidebarCSS() {
  loadCSS(
    'styles/gm-sidebar-base.css',
    'styles/gm-sidebar-controls.css',
    'styles/gm-sidebar-journal.css',
    'styles/gm-sidebar-popups.css',
    'styles/dc-presets.css',
    'styles/dc-preset-dropdown.css',
  );
}

export function loadPlayerCSS() {
  loadCSS(
    'styles/player-viewer.css',
    'styles/player-sidebar.css',
  );
}

export function loadCinematicCSS() {
  loadCSS(
    'styles/cinematic/base.css',
    'styles/cinematic/gm.css',
    'styles/cinematic/player.css',
  );
}
