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

/**
 * Setup ctrl+click handlers for inline check repost buttons
 * When ctrl+clicking a "send to chat" button on a PF2e inline check,
 * open the Roll Requester Dialog instead of the normal chat behavior
 * @private
 */
function _setupInlineCheckCtrlClickHandlers(contentArea) {
  if (!game.user.isGM) return;

  // Find all inline checks with repost buttons (PF2e format)
  const inlineChecks = contentArea.querySelectorAll('a.inline-check.with-repost[data-pf2-check][data-pf2-dc]');


  inlineChecks.forEach((checkElement) => {
    // Find the repost icon within this check
    const repostIcon = checkElement.querySelector('[data-pf2-repost]');
    if (!repostIcon) {
      console.warn('StoryFrame: No repost icon found for check', checkElement);
      return;
    }

    // Add click listener to the repost icon (use capture phase to intercept before PF2e)
    const handleCtrlClick = async (event) => {
      // Only intercept if ctrl key is pressed
      if (!event.ctrlKey) return;

      // Prevent default PF2e repost behavior
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      console.log('StoryFrame: CTRL+click intercepted on repost button');

      // Extract check data from the inline check element
      const skillName = checkElement.dataset.pf2Check;
      const dc = parseInt(checkElement.dataset.pf2Dc);
      const traits = checkElement.dataset.pf2Traits || '';
      const isSecret = traits.includes('secret');

      // Determine if this is a save or skill check (before dialog)
      const saveTypes = new Set(['fortitude', 'reflex', 'will']);
      const checkType = saveTypes.has(skillName.toLowerCase()) ? 'save' : 'skill';

      // Get state and validate participants exist
      const state = game.storyframe.stateManager.getState();
      if (!state?.participants || state.participants.length === 0) {
        ui.notifications.warn(game.i18n.localize('STORYFRAME.Notifications.SkillCheck.SelectPCsFirst'));
        return;
      }

      // Enrich participants with actor data
      const enrichedParticipants = await Promise.all(
        state.participants.map(async (p) => {
          const actor = await fromUuid(p.actorUuid);
          return {
            id: p.id,
            name: actor?.name || p.name || game.i18n.localize('STORYFRAME.UI.Labels.Unknown'),
            img: actor?.img || p.img || 'icons/svg/mystery-man.svg',
          };
        })
      );

      // Create check for dialog (single check)
      const checksForDialog = [{
        skillName: skillName,
        dc: dc,
        isSecret: isSecret,
        checkType: checkType
      }];

      // Import and show Roll Requester Dialog
      const { RollRequestDialog } = await import('../applications/roll-request-dialog.mjs');
      const dialog = new RollRequestDialog(checksForDialog, enrichedParticipants);
      dialog.render(true);

      // Wait for result
      const result = await dialog.wait();

      // Handle both old format (array) and new format (object)
      const selectedIds = result?.selectedIds || result || [];
      const allowOnlyOne = result?.allowOnlyOne || false;

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
        // Import skill check handlers
        const { requestSkillCheck } = await import('../applications/gm-sidebar/managers/skill-check-handlers.mjs');
        const SystemAdapter = await import('../system-adapter.mjs');

        // Convert skill/save name to slug (checkType already determined above)
        const checkSlug = checkType === 'save'
          ? (SystemAdapter.getSaveSlugFromName(skillName) || skillName.toLowerCase())
          : (SystemAdapter.getSkillSlugFromName(skillName) || skillName.toLowerCase());

        // Generate group ID if allow-only-one is enabled
        const batchGroupId = allowOnlyOne ? foundry.utils.randomID() : null;


        // Set DC and secret state
        sidebar.currentDC = dc;
        const dcInput = sidebar.element.querySelector('#dc-input');
        if (dcInput) dcInput.value = dc;

        sidebar.secretRollEnabled = isSecret;

        // Send request with correct check type and group ID
        await requestSkillCheck(sidebar, checkSlug, selectedIds, null, false, checkType, batchGroupId, allowOnlyOne);

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
    repostIcon.addEventListener('click', handleCtrlClick, { capture: true });
  });
}
