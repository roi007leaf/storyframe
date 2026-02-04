/**
 * Journal Sheet Hooks
 * Consolidated handlers for journal sheet rendering and lifecycle
 */

import { MODULE_ID } from '../constants.mjs';
import { extractElement } from '../utils/element-utils.mjs';
import { findJournalContent, findCloseButton } from '../utils/dom-utils.mjs';

/**
 * Unified handler for all journal sheet render hooks
 * Supports: JournalSheet, JournalEntrySheet5e, MetaMorphicJournalEntrySheet
 * @param {Object} sheet - The journal sheet instance
 * @param {*} html - The HTML element (jQuery, array, or raw HTMLElement)
 */
export async function handleJournalRender(sheet, html) {
  if (!game.user.isGM) return;

  const element = extractElement(html, sheet);
  if (!element) {
    console.warn('StoryFrame: Could not extract element from journal sheet', html);
    return;
  }

  // Inject sidebar toggle button
  _injectSidebarToggleButton(sheet, element);

  // Enrich checks in journal content
  const { enrichChecks } = await import('../check-enricher.mjs');
  const contentArea = findJournalContent(element);
  if (contentArea) {
    enrichChecks(contentArea);
  }

  // Auto-open sidebar if setting enabled
  const sidebar = game.storyframe.gmSidebar;
  const autoOpen = game.settings.get(MODULE_ID, 'autoOpenSidebar');

  if (autoOpen && !sidebar?.rendered) {
    await _attachSidebarToSheet(sheet);
  }

  // If sidebar is already open and attached to this sheet, refresh
  if (sidebar?.rendered && sidebar.parentInterface === sheet) {
    sidebar.render();
  }

  _updateToggleButtonState(sheet, element);
}

/**
 * Unified handler for all journal sheet close hooks
 * Handles sidebar reattachment when a journal is closed
 * @param {Object} sheet - The journal sheet instance
 */
export async function handleJournalClose(sheet) {
  if (!game.user.isGM) return;

  const sidebar = game.storyframe.gmSidebar;
  if (!sidebar || sidebar.parentInterface !== sheet) return;

  // Find other open journals (all supported types)
  const openJournals = Object.values(ui.windows).filter(
    (app) =>
      (app instanceof foundry.applications.sheets.journal.JournalEntrySheet ||
        app.constructor.name === 'JournalEntrySheet5e' ||
        app.constructor.name === 'MetaMorphicJournalEntrySheet') &&
      app !== sheet &&
      app.rendered,
  );

  if (openJournals.length > 0) {
    // Reattach to most recent
    const newParent = openJournals[openJournals.length - 1];
    sidebar.parentInterface = newParent;
    sidebar._stopTrackingParent();
    sidebar._startTrackingParent();
    sidebar._positionAsDrawer(3);
    _updateAllJournalToggleButtons();
  } else {
    // No journals left, close sidebar
    sidebar.close();
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Inject sidebar toggle button into journal header
 * @private
 */
function _injectSidebarToggleButton(sheet, html) {
  // V13 journal sheets have buttons directly in .window-header
  const header = html.querySelector('.window-header');

  if (!header) {
    console.warn('StoryFrame: Could not find .window-header in journal', html);
    return;
  }

  // Don't add if already present
  if (header.querySelector('.storyframe-sidebar-toggle')) {
    return;
  }

  const toggleBtn = document.createElement('a');
  toggleBtn.className = 'header-button control storyframe-sidebar-toggle';
  toggleBtn.setAttribute('data-tooltip', 'Toggle StoryFrame Sidebar');
  toggleBtn.setAttribute('aria-label', 'Toggle StoryFrame sidebar');
  toggleBtn.innerHTML = '<i class="fas fa-users"></i>';

  toggleBtn.onclick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await _toggleSidebarForSheet(sheet);
  };

  // Insert before close button
  const closeBtn = findCloseButton(header);

  if (closeBtn) {
    header.insertBefore(toggleBtn, closeBtn);
  } else {
    header.appendChild(toggleBtn);
  }
}

/**
 * Update toggle button state to reflect sidebar visibility
 * @private
 */
function _updateToggleButtonState(sheet, html) {
  const toggleBtn = html.querySelector('.storyframe-sidebar-toggle');
  if (!toggleBtn) return;

  const sidebar = game.storyframe.gmSidebar;
  const isVisible = sidebar?.rendered && sidebar.parentInterface === sheet;

  toggleBtn.classList.toggle('active', isVisible);
  toggleBtn.setAttribute(
    'data-tooltip',
    isVisible ? 'Hide StoryFrame Sidebar' : 'Show StoryFrame Sidebar',
  );
}

/**
 * Toggle sidebar for a specific journal sheet
 * @private
 */
async function _toggleSidebarForSheet(sheet) {
  const sidebar = game.storyframe.gmSidebar;
  const isAttachedToThis = sidebar?.rendered && sidebar.parentInterface === sheet;

  if (isAttachedToThis) {
    await game.settings.set(MODULE_ID, 'gmSidebarVisible', false);
    sidebar.close();
  } else {
    await game.settings.set(MODULE_ID, 'gmSidebarVisible', true);
    await _attachSidebarToSheet(sheet);
  }

  _updateAllJournalToggleButtons();
}

/**
 * Attach sidebar to a journal sheet
 * Instantiates the correct system-specific sidebar subclass if needed
 * @private
 */
async function _attachSidebarToSheet(sheet) {
  if (!game.storyframe.gmSidebar) {
    // Instantiate correct subclass based on system
    const system = game.system.id;

    if (system === 'pf2e') {
      const { GMSidebarAppPF2e } = await import('../applications/gm-sidebar/gm-sidebar-pf2e.mjs');
      game.storyframe.gmSidebar = new GMSidebarAppPF2e();
    } else if (system === 'dnd5e') {
      const { GMSidebarAppDND5e } = await import('../applications/gm-sidebar/gm-sidebar-dnd5e.mjs');
      game.storyframe.gmSidebar = new GMSidebarAppDND5e();
    } else {
      const { GMSidebarAppBase } = await import('../applications/gm-sidebar/gm-sidebar-base.mjs');
      game.storyframe.gmSidebar = new GMSidebarAppBase();
    }
  }

  const sidebar = game.storyframe.gmSidebar;
  sidebar.parentInterface = sheet;
  sidebar._stateRestored = false;

  if (!sidebar.rendered) {
    sidebar.render(true);
  } else {
    sidebar._stopTrackingParent();
    sidebar._startTrackingParent();
    sidebar._positionAsDrawer(3);
  }
}

/**
 * Update all journal toggle buttons to reflect current state
 * @private
 */
function _updateAllJournalToggleButtons() {
  const openJournals = Object.values(ui.windows).filter(
    (app) =>
      app instanceof foundry.applications.sheets.journal.JournalEntrySheet && app.rendered,
  );

  for (const journal of openJournals) {
    const html = journal.element[0] || journal.element;
    _updateToggleButtonState(journal, html);
  }
}
