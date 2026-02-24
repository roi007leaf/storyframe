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

  // Inject sidebar toggle button
  _injectSidebarToggleButton(sheet, element);

  // Enrich checks in journal content
  const { enrichChecks } = await import('../check-enricher.mjs');
  const contentArea = findJournalContent(element);
  if (contentArea) {
    enrichChecks(contentArea);

    // Set up ctrl+click handlers for inline check repost buttons
    _setupInlineCheckCtrlClickHandlers(contentArea);
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
    (app) =>
      app instanceof foundry.applications.sheets.journal.JournalEntrySheet && app.rendered,
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
