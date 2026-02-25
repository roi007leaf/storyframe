/**
 * Journal Sheet Hooks
 * Consolidated handlers for journal sheet rendering and lifecycle
 */

import { MODULE_ID } from '../constants.mjs';
import { findCloseButton, findJournalContent } from '../utils/dom-utils.mjs';
import { extractElement } from '../utils/element-utils.mjs';

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

  // Re-apply peek state if active (re-render replaces DOM, losing the class)
  if (sheet._sfPeeking) {
    const windowEl = element?.closest('.window-app') || element;
    windowEl.style.transition = 'opacity 0.2s ease-out';
    windowEl.classList.add('sf-peeking');
  }

  // Inject sidebar toggle button
  _injectSidebarToggleButton(sheet, element);

  // Enrich checks in journal content
  const { enrichChecks } = await import('../check-enricher.mjs');
  const contentArea = findJournalContent(element);
  if (contentArea) {
    enrichChecks(contentArea);

    // Set up ctrl+click handlers for inline check repost buttons
    _setupInlineCheckCtrlClickHandlers(contentArea);

    // Set up journal transparency when dragging actor links to canvas
    _setupActorDragTransparency(sheet, element, contentArea);
  } else {
    console.warn('StoryFrame: No content area found in journal');
  }

  // Handle sidebar state
  const sidebar = game.storyframe.gmSidebar;
  const autoOpen = game.settings.get(MODULE_ID, 'autoOpenSidebar');

  if (sidebar?.rendered) {
    // Sidebar is already open
    if (sidebar.parentInterface === sheet) {
      // Already attached to this sheet, just refresh
      sidebar.render();
    } else if (!sidebar.parentInterface) {
      // Sidebar is open standalone (not attached to any journal)
      // Auto-attach it to this journal for better UX
      sidebar.parentInterface = sheet;
      sidebar.element.classList.add('drawer');
      sidebar._stopTrackingParent();
      sidebar._startTrackingParent();
      sidebar._positionAsDrawer(3);
      // Render to update UI state
      sidebar.render();
      // Update all journal toggle buttons
      _updateAllJournalToggleButtons();
      return; // Skip individual update below
    }
    // If attached to a different journal, leave it there
  } else if (autoOpen) {
    // Sidebar not open, auto-open if setting enabled
    await _attachSidebarToSheet(sheet);
  }

  // Listen for minimize/maximize events on this journal
  _setupMinimizeMaximizeHandler(sheet);

  _updateToggleButtonState(sheet, element);
}

/**
 * Unified handler for all journal sheet close hooks
 * Handles sidebar reattachment when a journal is closed
 * @param {Object} sheet - The journal sheet instance
 */
export async function handleJournalClose(sheet) {
  if (!game.user.isGM) return;

  // Clean up minimize observer
  if (sheet._storyframeMinimizeObserver) {
    sheet._storyframeMinimizeObserver.disconnect();
    sheet._storyframeMinimizeObserver = null;
  }

  const sidebar = game.storyframe.gmSidebar;
  if (!sidebar || sidebar.parentInterface !== sheet) return;

  // Reset minimize flag
  if (sidebar._wasHiddenByMinimize) {
    sidebar._wasHiddenByMinimize = false;
  }

  // Find other open journals (all supported types)
  const openJournals = Object.values(ui.windows).filter(
    (app) => _isJournalApp(app) && app !== sheet && app.rendered,
  );

  if (openJournals.length > 0) {
    // Reattach to most recent
    const newParent = openJournals[openJournals.length - 1];
    sidebar.parentInterface = newParent;
    // Ensure sidebar is visible when reattaching
    if (sidebar.element) {
      sidebar.element.style.display = '';
    }
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
 * Check if an application is a supported journal-like window
 * @param {Object} app
 * @returns {boolean}
 * @private
 */
function _isJournalApp(app) {
  return (
    app instanceof foundry.applications.sheets.journal.JournalEntrySheet ||
    app.constructor.name === 'JournalEntrySheet5e' ||
    app.constructor.name === 'MetaMorphicJournalEntrySheet' ||
    app.constructor.name === 'EnhancedJournal'
  );
}

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
  toggleBtn.innerHTML = '<i class="fas fa-book-open"></i>';

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
    } else if (system === 'daggerheart') {
      const { GMSidebarAppDaggerheart } = await import('../applications/gm-sidebar/gm-sidebar-daggerheart.mjs');
      game.storyframe.gmSidebar = new GMSidebarAppDaggerheart();
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
    // Add drawer class when reattaching
    if (sidebar.element) {
      sidebar.element.classList.add('drawer');
    }
    sidebar._stopTrackingParent();
    sidebar._startTrackingParent();
    sidebar._positionAsDrawer(3);
  }
}

/**
 * Update all journal toggle buttons to reflect current state
 * @private
 */
export function _updateAllJournalToggleButtons() {
  const openJournals = Object.values(ui.windows).filter(
    (app) => _isJournalApp(app) && app.rendered,
  );

  for (const journal of openJournals) {
    const html = journal.element[0] || journal.element;
    _updateToggleButtonState(journal, html);
  }
}

/**
 * Setup ctrl+click handlers for inline check repost buttons
 * When ctrl+clicking a "send to chat" button on a PF2e inline check,
 * open the Roll Requester Dialog instead of the normal chat behavior
 * @private
 */
function _setupInlineCheckCtrlClickHandlers(contentArea) {
  if (!game.user.isGM) return;

  // Find all inline checks (PF2e format)
  const inlineChecks = contentArea.querySelectorAll('a.inline-check[data-pf2-check][data-pf2-dc]');


  inlineChecks.forEach((checkElement) => {
    // Find the repost icon within this check (if it exists)
    const repostIcon = checkElement.querySelector('[data-pf2-repost]');

    // Use repost icon if available, otherwise use the check element itself
    const clickTarget = repostIcon || checkElement;

    // Add click listener (use capture phase to intercept before PF2e)
    const handleCtrlClick = async (event) => {
      // Only intercept if ctrl key is pressed
      if (!event.ctrlKey) return;

      // Prevent default PF2e repost behavior
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      // Extract check data from the inline check element
      const skillName = checkElement.dataset.pf2Check;
      const dc = parseInt(checkElement.dataset.pf2Dc);
      const traits = checkElement.dataset.pf2Traits || '';
      const isSecret = traits.includes('secret');

      // Extract action slug from traits (e.g., "concentrate,secret,action:sense-motive" → "sense-motive")
      const actionTrait = traits.split(',').map(t => t.trim()).find(t => t.startsWith('action:'));
      const actionSlug = actionTrait ? actionTrait.slice('action:'.length) : null;

      // Extract custom display label (from name:xxx parameter → data-pf2-label attribute)
      const label = checkElement.dataset.pf2Label || null;

      // Determine if this is a save or skill check (before dialog)
      const saveTypes = new Set(['fortitude', 'reflex', 'will']);
      const checkType = saveTypes.has(skillName.toLowerCase()) ? 'save' : 'skill';

      // Pre-compute the slug now so it's stored in the check object for later sending
      const SystemAdapter = await import('../system-adapter.mjs');
      const checkSlug = checkType === 'save'
        ? (SystemAdapter.getSaveSlugFromName(skillName) || skillName.toLowerCase())
        : (SystemAdapter.getSkillSlugFromName(skillName) || skillName.toLowerCase());

      const checksForDialog = [{
        skillName: skillName,
        skillSlug: checkSlug,
        dc: dc,
        isSecret: isSecret,
        checkType: checkType,
        actionSlug: actionSlug,
        label: label,
      }];

      // Subscribe to (or open) the singleton roll request dialog
      const { RollRequestDialog } = await import('../applications/roll-request-dialog.mjs');
      const pcs = await SystemAdapter.getAllPlayerPCs();
      if (!RollRequestDialog._instance && pcs.length === 0) {
        ui.notifications.warn('No player-owned characters found in the world.');
        return;
      }

      const result = await RollRequestDialog.subscribe(checksForDialog, pcs);

      const selectedIds = result?.selectedIds || result || [];
      const allowOnlyOne = result?.allowOnlyOne || false;
      const batchGroupId = result?.batchGroupId ?? null;

      if (!selectedIds || selectedIds.length === 0) {
        return;
      }

      // Get sidebar reference
      const sidebar = game.storyframe.gmSidebar;
      if (!sidebar) {
        console.error('StoryFrame: Sidebar not available');
        ui.notifications.error('StoryFrame sidebar not available');
        return;
      }

      try {
        const { requestSkillCheck } = await import('../applications/gm-sidebar/managers/skill-check-handlers.mjs');

        // Each subscriber sends only its own check
        sidebar.currentDC = dc;
        const dcInput = sidebar.element.querySelector('#dc-input');
        if (dcInput) dcInput.value = dc;
        sidebar.secretRollEnabled = isSecret;

        await requestSkillCheck(sidebar, checkSlug, selectedIds, actionSlug || null, false, checkType, batchGroupId, allowOnlyOne, null, isSecret);

        // Reset secret toggle
        sidebar.secretRollEnabled = false;
        const secretBtn = sidebar.element.querySelector('.secret-roll-btn');
        if (secretBtn) {
          secretBtn.classList.remove('active');
          secretBtn.setAttribute('aria-pressed', 'false');
        }
      } catch (error) {
        console.error('StoryFrame: Error sending request:', error);
        ui.notifications.error('Failed to send roll request: ' + error.message);
      }
    };

    // Attach the handler with capture: true to run before PF2e's handlers
    clickTarget.addEventListener('click', handleCtrlClick, { capture: true });
  });
}

/**
 * Setup minimize/maximize handler for a journal sheet
 * Hides/shows the sidebar when the journal is minimized/maximized
 * @private
 */
function _setupMinimizeMaximizeHandler(sheet) {
  if (!sheet.element) return;

  // Extract the actual DOM element
  const element = extractElement(sheet.element, sheet);
  if (!element) return;

  // Clean up existing observer if present
  if (sheet._storyframeMinimizeObserver) {
    sheet._storyframeMinimizeObserver.disconnect();
    sheet._storyframeMinimizeObserver = null;
  }

  // Use MutationObserver to watch for minimize/maximize state changes
  sheet._storyframeMinimizeObserver = new MutationObserver((_mutations) => {
    const sidebar = game.storyframe.gmSidebar;
    if (!sidebar || sidebar.parentInterface !== sheet) return;

    // Check if the window has the minimized class
    const isMinimized = element.classList.contains('minimized');

    if (isMinimized && !sidebar._wasHiddenByMinimize) {
      // Hide sidebar when journal is minimized
      if (sidebar.rendered && sidebar.element) {
        sidebar.element.style.display = 'none';
        sidebar._wasHiddenByMinimize = true;
      }
    } else if (!isMinimized && sidebar._wasHiddenByMinimize) {
      // Show sidebar when journal is maximized
      if (sidebar.element) {
        sidebar.element.style.display = '';
        sidebar._wasHiddenByMinimize = false;
        // Reposition sidebar
        sidebar._positionAsDrawer(3);
      }
    }
  });

  // Observe class changes on the journal window element
  sheet._storyframeMinimizeObserver.observe(element, {
    attributes: true,
    attributeFilter: ['class'],
  });
}

// Active populate mode cleanup reference
let _activePopulateCleanup = null;

/**
 * Setup actor drag-to-populate for all actor links in journal content.
 * Dragging an actor link past a threshold enters "populate mode" where
 * left-clicks on the canvas create tokens. Right-click pans the canvas,
 * Escape or the cancel button exits populate mode.
 * @param {Object} sheet - The journal sheet instance
 * @param {HTMLElement} element - The journal window DOM element
 * @param {HTMLElement} contentArea - The scrollable content area
 * @private
 */
function _setupActorDragTransparency(sheet, element, contentArea) {
  const ACTOR_LINK_SELECTOR =
    'a.content-link[data-type="Actor"], a.content-link[data-uuid*="Actor."]';
  const actorLinks = contentArea.querySelectorAll(ACTOR_LINK_SELECTOR);
  if (!actorLinks.length) return;

  const DRAG_THRESHOLD = 5;

  for (const link of actorLinks) {
    link.classList.add('sf-draggable-actor');

    link.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      // Block ProseMirror from starting text selection
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startY = e.clientY;
      let activated = false;

      const onDragMove = (me) => {
        if (activated) return;
        if (
          Math.abs(me.clientX - startX) > DRAG_THRESHOLD ||
          Math.abs(me.clientY - startY) > DRAG_THRESHOLD
        ) {
          activated = true;
          document.removeEventListener('mousemove', onDragMove);
          document.removeEventListener('mouseup', onDragUp);
          _enterPopulateMode(sheet, element, link, me.clientX, me.clientY);
        }
      };

      const onDragUp = () => {
        if (!activated) {
          // Was a click, not a drag — trigger the content link normally
          document.removeEventListener('mousemove', onDragMove);
          document.removeEventListener('mouseup', onDragUp);
          link.dispatchEvent(
            new MouseEvent('click', { bubbles: true, cancelable: true }),
          );
        }
      };

      document.addEventListener('mousemove', onDragMove);
      document.addEventListener('mouseup', onDragUp);
    });
  }
}

/**
 * Enter populate mode: hides the journal window, shows a ghost cursor label
 * and cancel button, then listens for left-clicks on the canvas to create
 * tokens. Each click places token(s); right-click panning is preserved.
 * @param {Object} sheet - The journal sheet instance
 * @param {HTMLElement} element - The journal window DOM element
 * @param {HTMLElement} link - The actor content link element
 * @param {number} initialX - Initial cursor X position
 * @param {number} initialY - Initial cursor Y position
 * @private
 */
function _enterPopulateMode(sheet, element, link, initialX, initialY) {
  // Exit any existing populate mode first
  if (_activePopulateCleanup) {
    _activePopulateCleanup();
    _activePopulateCleanup = null;
  }

  const sidebar = game.storyframe?.gmSidebar;
  const sidebarEl =
    sidebar?.rendered && sidebar.parentInterface === sheet
      ? sidebar.element
      : null;
  const windowEl = element.closest('.window-app') || element;
  const boardEl = document.getElementById('board');

  // --- Visibility helpers ---
  const hideEl = (el) => {
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
    el.style.transition = 'opacity 0.2s ease-out';
  };
  const showEl = (el) => {
    el.style.opacity = '';
    el.style.pointerEvents = '';
    el.style.transition = '';
  };

  // Hide journal + sidebar, set crosshair on canvas
  hideEl(windowEl);
  if (sidebarEl) hideEl(sidebarEl);
  if (boardEl) boardEl.classList.add('sf-populating');

  // --- Parse actor info from link ---
  const uuid = link.dataset.uuid;
  const linkText = link.textContent.trim();
  const countMatch = linkText.match(/^(\d+)\s+(.+)$/);
  const total = Math.min(countMatch ? parseInt(countMatch[1]) : 1, 24);
  const actorName = countMatch ? countMatch[2] : linkText;
  const iconEl = link.querySelector('i');
  const iconClass = iconEl?.className || 'fa-solid fa-user';
  let remaining = total;

  // Pre-resolve actor token data (cached across placements)
  const tokenDataPromise = (async () => {
    try {
      const actor = await fromUuid(uuid);
      return actor ? (await actor.getTokenDocument()).toObject() : null;
    } catch (err) {
      console.error('StoryFrame: Error resolving actor:', err);
      return null;
    }
  })();

  // --- Create UI elements ---
  const ghost = document.createElement('div');
  ghost.className = 'sf-drag-ghost';
  const ghostLabel = () =>
    total > 1
      ? `<i class="${iconClass}"></i> ${remaining}/${total} ${actorName}`
      : `<i class="${iconClass}"></i> ${actorName}`;
  ghost.innerHTML = ghostLabel();
  ghost.style.left = `${initialX + 14}px`;
  ghost.style.top = `${initialY + 14}px`;
  document.body.appendChild(ghost);

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'sf-populate-cancel';
  cancelBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
  cancelBtn.title = 'Exit populate mode (Escape)';
  document.body.appendChild(cancelBtn);

  // --- Token placement (one per click) ---
  const placeToken = async (clientX, clientY) => {
    if (!boardEl || remaining <= 0) return;
    const boardRect = boardEl.getBoundingClientRect();
    if (
      clientX < boardRect.left || clientX > boardRect.right ||
      clientY < boardRect.top || clientY > boardRect.bottom
    ) return;

    const baseToken = await tokenDataPromise;
    if (!baseToken) return;

    try {
      // Convert client coords → canvas world coords
      const t = canvas.stage.worldTransform;
      const wx = ((clientX - boardRect.left) - t.tx) / t.a;
      const wy = ((clientY - boardRect.top) - t.ty) / t.d;

      const gridSize = canvas.grid.size;
      const tokenW = (baseToken.width || 1) * gridSize;
      const tokenH = (baseToken.height || 1) * gridSize;

      // Snap single token centered on cursor
      const snapped = canvas.grid.getSnappedPoint(
        { x: wx - tokenW / 2, y: wy - tokenH / 2 },
        { mode: CONST.GRID_SNAPPING_MODES.TOP_LEFT_VERTEX },
      );

      await canvas.scene.createEmbeddedDocuments('Token', [{
        ...baseToken,
        x: snapped.x,
        y: snapped.y,
      }]);

      remaining--;

      // Brief green flash as placement confirmation
      ghost.classList.add('sf-ghost-pulse');
      setTimeout(() => ghost.classList.remove('sf-ghost-pulse'), 300);

      if (remaining <= 0) {
        cleanup();
      } else {
        ghost.innerHTML = ghostLabel();
      }
    } catch (err) {
      console.error('StoryFrame: Error creating token:', err);
    }
  };

  // --- Event handlers ---
  const onMove = (e) => {
    ghost.style.left = `${e.clientX + 14}px`;
    ghost.style.top = `${e.clientY + 14}px`;
  };

  // Left-click on canvas → place tokens (capture phase blocks PIXI)
  const onBoardPointerDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    placeToken(e.clientX, e.clientY);
  };

  // Block residual click events from reaching Foundry
  const onBoardClick = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  };

  // Suppress context menu popup but allow right-click panning
  const onContextMenu = (e) => {
    e.preventDefault();
  };

  const onEscape = (ke) => {
    if (ke.key === 'Escape') {
      ke.preventDefault();
      ke.stopPropagation();
      cleanup();
    }
  };

  const cleanup = () => {
    _activePopulateCleanup = null;
    if (boardEl) {
      boardEl.removeEventListener('pointerdown', onBoardPointerDown, true);
      boardEl.removeEventListener('click', onBoardClick, true);
      boardEl.classList.remove('sf-populating');
    }
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('keydown', onEscape, true);
    document.removeEventListener('contextmenu', onContextMenu, true);
    ghost.remove();
    cancelBtn.remove();
    showEl(windowEl);
    if (sidebarEl) showEl(sidebarEl);
  };

  // --- Attach listeners ---
  if (boardEl) {
    boardEl.addEventListener('pointerdown', onBoardPointerDown, true);
    boardEl.addEventListener('click', onBoardClick, true);
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('keydown', onEscape, true);
  document.addEventListener('contextmenu', onContextMenu, true);
  cancelBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    cleanup();
  });

  _activePopulateCleanup = cleanup;
}

// ============================================================================
// Journal Peek Mode
// ============================================================================

/**
 * Find the active journal sheet and its associated sidebar element.
 * Priority: sidebar's parentInterface (if rendered), then topmost open journal.
 * @returns {{ sheet: Object|null, windowEl: HTMLElement|null, sidebarEl: HTMLElement|null }}
 * @private
 */
function _getActiveJournalAndSidebar() {
  const sidebar = game.storyframe?.gmSidebar;
  let sheet = null;

  // Priority 1: sidebar's parent interface
  if (sidebar?.rendered && sidebar.parentInterface?.element) {
    sheet = sidebar.parentInterface;
  }

  // Priority 2: topmost open journal
  if (!sheet) {
    const openJournals = Object.values(ui.windows).filter(
      (app) => _isJournalApp(app) && app.rendered,
    );
    if (openJournals.length > 0) {
      sheet = openJournals[openJournals.length - 1];
    }
  }

  if (!sheet) return { sheet: null, windowEl: null, sidebarEl: null };

  const element = extractElement(sheet.element, sheet);
  const windowEl = element?.closest('.window-app') || element;
  const sidebarEl =
    sidebar?.rendered && sidebar.parentInterface === sheet
      ? sidebar.element
      : null;

  return { sheet, windowEl, sidebarEl };
}

/** @private Raw keyup handler — stored so we can remove it on peek end. */
let _peekKeyupHandler = null;

/**
 * Start peeking at the canvas — journal fades out.
 * Sidebar visibility controlled by the peekHidesSidebar setting.
 * Uses a raw document keyup listener to detect release, because Foundry's
 * keybinding onUp fires spuriously when focus enters form elements.
 * @export
 */
export function peekCanvasStart() {
  const { sheet, windowEl, sidebarEl } = _getActiveJournalAndSidebar();
  if (!sheet || !windowEl) return;

  if (sheet._sfPeeking) return;
  sheet._sfPeeking = true;

  const TRANSITION = 'opacity 0.2s ease-out';

  windowEl.style.transition = TRANSITION;
  windowEl.classList.add('sf-peeking');

  const hideSidebar = game.settings.get(MODULE_ID, 'peekHidesSidebar') ?? true;
  if (sidebarEl && hideSidebar) {
    sidebarEl.style.transition = TRANSITION;
    sidebarEl.classList.add('sf-peeking');
  }

  // Determine which key to listen for from the keybinding config
  const bindings = game.keybindings.get(MODULE_ID, 'peekCanvas');
  const boundKey = bindings?.[0]?.key;
  if (boundKey) {
    _peekKeyupHandler = (e) => {
      if (e.code === boundKey) _peekCanvasEnd();
    };
    document.addEventListener('keyup', _peekKeyupHandler, true);
  }
}

/**
 * Stop peeking — journal fades back in.
 * @private
 */
function _peekCanvasEnd() {
  const { sheet, windowEl, sidebarEl } = _getActiveJournalAndSidebar();
  if (!sheet || !windowEl) return;

  if (!sheet._sfPeeking) return;
  sheet._sfPeeking = false;

  windowEl.classList.remove('sf-peeking');
  setTimeout(() => { windowEl.style.transition = ''; }, 250);

  if (sidebarEl) {
    sidebarEl.classList.remove('sf-peeking');
    setTimeout(() => { sidebarEl.style.transition = ''; }, 250);
  }

  // Clean up raw listener
  if (_peekKeyupHandler) {
    document.removeEventListener('keyup', _peekKeyupHandler, true);
    _peekKeyupHandler = null;
  }
}

/**
 * Handler for renderJournalEntryPageProseMirrorSheet hook (Daggerheart)
 * Sets up ctrl+click handlers on Daggerheart duality roll buttons
 * @param {Object} sheet - The page sheet instance
 * @param {*} html - The HTML element
 */
export async function handleDaggerheartPageRender(sheet, html) {
  if (!game.user.isGM) return;

  const element = extractElement(html, sheet);
  if (!element) return;

  _setupDaggerheartCheckCtrlClickHandlers(element);
}

/**
 * Setup ctrl+click handlers for Daggerheart duality roll buttons
 * Ctrl+clicking a .duality-roll-button opens the Roll Requester Dialog
 * @private
 */
function _setupDaggerheartCheckCtrlClickHandlers(contentArea) {
  if (!game.user.isGM) return;

  const dualityButtons = contentArea.querySelectorAll(
    'button.duality-roll-button[data-trait][data-difficulty]',
  );

  dualityButtons.forEach((button) => {
    button.addEventListener(
      'click',
      async (event) => {
        if (!event.ctrlKey) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        const traitFullName = button.dataset.trait?.toLowerCase();
        const dc = parseInt(button.dataset.difficulty);

        if (!traitFullName || isNaN(dc)) return;

        const { DAGGERHEART_TRAIT_NAME_MAP } = await import('../system/daggerheart/skills.mjs');
        const skillSlug = DAGGERHEART_TRAIT_NAME_MAP[traitFullName] || traitFullName;
        const skillName = traitFullName.charAt(0).toUpperCase() + traitFullName.slice(1);

        const checksForDialog = [
          {
            skillName: skillSlug,
            skillSlug: skillSlug,
            dc: dc,
            isSecret: false,
            checkType: 'skill',
            label: button.dataset.label || skillName,
          },
        ];

        const SystemAdapter = await import('../system-adapter.mjs');
        const { RollRequestDialog } = await import('../applications/roll-request-dialog.mjs');
        const pcs = await SystemAdapter.getAllPlayerPCs();
        if (!RollRequestDialog._instance && pcs.length === 0) {
          ui.notifications.warn('No player-owned characters found in the world.');
          return;
        }

        const result = await RollRequestDialog.subscribe(checksForDialog, pcs);

        const selectedIds = result?.selectedIds || result || [];
        const allowOnlyOne = result?.allowOnlyOne || false;
        const batchGroupId = result?.batchGroupId ?? null;

        if (!selectedIds || selectedIds.length === 0) return;

        const sidebar = game.storyframe.gmSidebar;
        if (!sidebar) {
          console.error('StoryFrame: Sidebar not available');
          ui.notifications.error('StoryFrame sidebar not available');
          return;
        }

        try {
          const { requestSkillCheck } = await import(
            '../applications/gm-sidebar/managers/skill-check-handlers.mjs'
          );

          sidebar.currentDC = dc;
          const dcInput = sidebar.element.querySelector('#dc-input');
          if (dcInput) dcInput.value = dc;
          sidebar.secretRollEnabled = false;

          await requestSkillCheck(
            sidebar,
            skillSlug,
            selectedIds,
            null,
            false,
            'skill',
            batchGroupId,
            allowOnlyOne,
            null,
            false,
          );
        } catch (error) {
          console.error('StoryFrame: Error sending request:', error);
          ui.notifications.error('Failed to send roll request: ' + error.message);
        }
      },
      { capture: true },
    );
  });
}
