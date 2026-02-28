/**
 * UI Helper Handler for GM Sidebar
 * Handles positioning, popups, scroll management, and other UI utilities
 */

import { MODULE_ID } from '../../../constants.mjs';
import * as SystemAdapter from '../../../system-adapter.mjs';
import { extractParentElement } from '../../../utils/element-utils.mjs';
import * as SkillCheckHandlers from './skill-check-handlers.mjs';

/**
 * Position the drawer adjacent to the parent journal sheet
 * @param {number} retryCount - Number of retry attempts remaining
 */
export function positionAsDrawer(sidebar, retryCount = 3) {
  // Check if parent exists and has element (ApplicationV2 doesn't have .rendered property)
  if (!sidebar.parentInterface?.element) {
    console.warn('StoryFrame: Parent interface not ready for positioning', {
      hasElement: !!sidebar.parentInterface?.element,
      retryCount,
    });
    // Retry if we have attempts left
    if (retryCount > 0) {
      setTimeout(() => positionAsDrawer(sidebar, retryCount - 1), 100);
    }
    return;
  }

  // ApplicationV2 uses element directly (HTMLElement), not jQuery/array
  const parentEl = extractParentElement(sidebar.parentInterface);
  if (!parentEl) return;
  const parentRect = parentEl.getBoundingClientRect();

  // Check if parent has valid dimensions (not at 0,0 with no size)
  if (parentRect.width === 0 || parentRect.height === 0) {
    if (retryCount > 0) {
      setTimeout(() => positionAsDrawer(sidebar, retryCount - 1), 100);
    }
    return;
  }

  // Position to the right of the parent window
  const newLeft = parentRect.right;
  const newTop = parentRect.top;
  const newHeight = parentRect.height;

  // Use default width for drawer mode (user may have resized in floating mode)
  const defaultWidth = sidebar.constructor.DEFAULT_OPTIONS?.position?.width || 330;

  // Check if it would go off-screen, if so position to the left instead
  const maxLeft = window.innerWidth - defaultWidth;
  let adjustedLeft = newLeft;

  if (newLeft > maxLeft) {
    // Position to the left of parent instead
    adjustedLeft = Math.max(0, parentRect.left - defaultWidth);
  }

  // Use setPosition for ApplicationV2
  if (!sidebar.element) {
    console.warn('StoryFrame: Sidebar element not found, cannot position');
    return;
  }

  try {
    sidebar.setPosition({
      left: adjustedLeft,
      top: newTop,
      width: defaultWidth,
      height: newHeight,
    });
  } catch (e) {
    // Foundry's _updatePosition can fail if element isn't fully in DOM yet (e.g. MEJ async render)
    if (retryCount > 0) {
      setTimeout(() => positionAsDrawer(sidebar, retryCount - 1), 100);
    }
    return;
  }

  // Match parent z-index + 1 to appear above it
  const parentZIndex = parseInt(window.getComputedStyle(parentEl).zIndex) || 99;
  sidebar.element.style.zIndex = parentZIndex + 1;
}

/**
 * Start tracking parent journal sheet movements and state changes
 */
export function startTrackingParent(sidebar) {
  if (!sidebar.parentInterface?.element) {
    return;
  }

  // ApplicationV2 uses element directly (HTMLElement), not jQuery/array
  const element = extractParentElement(sidebar.parentInterface);

  // Create a MutationObserver to watch for style and class changes
  sidebar._parentObserver = new MutationObserver((mutations) => {
    if (!sidebar.rendered || !sidebar.parentInterface) return;

    for (const mutation of mutations) {
      if (mutation.attributeName === 'style') {
        positionAsDrawer(sidebar, 0); // No retries during tracking updates
        break;
      }
      if (mutation.attributeName === 'class') {
        // Handle minimize/maximize
        const isMinimized = element.classList.contains('minimized');
        if (isMinimized && sidebar.rendered) {
          sidebar.element.style.display = 'none';
        } else if (!isMinimized && sidebar.rendered) {
          sidebar.element.style.display = '';
          positionAsDrawer(sidebar, 0);
        }
        break;
      }
    }
  });

  sidebar._parentObserver.observe(element, {
    attributes: true,
    attributeFilter: ['style', 'class'],
  });
}

/**
 * Stop tracking parent window movements
 */
export function stopTrackingParent(sidebar) {
  if (sidebar._parentObserver) {
    sidebar._parentObserver.disconnect();
    sidebar._parentObserver = null;
  }
}

/**
 * Save scroll positions of scrollable containers
 */
export function saveScrollPositions(sidebar) {
  if (!sidebar.element) return null;

  const positions = {};
  const container = sidebar.element.querySelector('.gm-sidebar-container');
  if (container) {
    positions.main = container.scrollTop;
  }

  return positions;
}

/**
 * Restore scroll positions of scrollable containers
 * Uses multiple timing approaches and mutation observer to ensure it works
 */
export function restoreScrollPositions(sidebar, positions) {
  if (!sidebar.element || !positions) return;

  const restore = () => {
    const container = sidebar.element?.querySelector('.gm-sidebar-container');
    if (container && positions.main !== undefined && container.scrollTop !== positions.main) {
      container.scrollTop = positions.main;
      return true;
    }
    return false;
  };

  // Try immediate restore
  restore();

  // Try after animation frame
  requestAnimationFrame(() => restore());

  // Try with small delays
  setTimeout(() => restore(), 0);
  setTimeout(() => restore(), 10);
  setTimeout(() => restore(), 50);

  // Also set up a mutation observer to restore on DOM changes
  const container = sidebar.element?.querySelector('.gm-sidebar-container');
  if (container && positions.main !== undefined) {
    const observer = new MutationObserver(() => {
      if (restore()) {
        observer.disconnect();
      }
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
    });

    // Disconnect after 500ms to avoid memory leaks
    setTimeout(() => observer.disconnect(), 500);
  }
}

/**
 * Return a z-index value that places a popup above the sidebar.
 * The sidebar gets a dynamic inline z-index from positionAsDrawer; popups must
 * read that value at creation time so they always render on top.
 */
export function _aboveSidebarZIndex(sidebar) {
  const el = sidebar?.element;
  if (!el) return 100001;
  // Use getComputedStyle so we capture z-index set by !important CSS rules
  // (e.g. cinematic/base.css sets #storyframe-gm-sidebar to 100000 !important
  // globally, not just in cinematic mode, so inline-style reads miss it).
  const z = parseInt(window.getComputedStyle(el).zIndex) || 0;
  return Math.max(z + 1, 100001);
}

/**
 * Show pending rolls popup
 */
export async function onShowPendingRolls(_event, target, sidebar) {
  const state = game.storyframe.stateManager.getState();
  const pendingRolls = state?.pendingRolls || [];

  if (pendingRolls.length === 0) {
    ui.notifications.info(game.i18n.localize('STORYFRAME.Notifications.PendingRolls.NoPendingRolls'));
    return;
  }

  // Build pending rolls data with names
  const rollsData = await Promise.all(
    pendingRolls.map(async (r) => {
      const actor = r.actorUuid ? await fromUuid(r.actorUuid) : null;

      // Get appropriate name based on check type
      const checkType = r.checkType || 'skill';
      let checkName;
      if (checkType === 'save') {
        const saves = SystemAdapter.getSaves();
        checkName = saves[r.skillSlug]?.name || r.skillSlug.toUpperCase();
      } else {
        checkName = SkillCheckHandlers.getSkillName(r.skillSlug);
      }

      // Build action name with variant if present
      let actionName = null;
      if (r.actionSlug) {
        actionName = SkillCheckHandlers.getActionName(r.skillSlug, r.actionSlug);
        if (r.actionVariant) {
          const variantName = r.actionVariant.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
          actionName = `${actionName}: ${variantName}`;
        }
      }

      return {
        ...r,
        actorUuid: r.actorUuid,
        actorName: actor?.name || game.i18n.localize('STORYFRAME.UI.Labels.Unknown'),
        actorImg: actor?.img || 'icons/svg/mystery-man.svg',
        skillName: checkName,
        actionName,
        checkType: checkType,
      };
    }),
  );

  // Pre-process: Combine allow-only-one groups into single items
  const processedRolls = [];
  const batchGroups = new Map();

  rollsData.forEach(roll => {
    if (roll.allowOnlyOne && roll.batchGroupId) {
      // Part of an allow-only-one group
      const groupKey = `${roll.actorUuid}:${roll.batchGroupId}`;
      if (!batchGroups.has(groupKey)) {
        batchGroups.set(groupKey, {
          id: roll.batchGroupId,  // Use group ID for cancel operations
          isAllowOnlyOne: true,
          batchGroupId: roll.batchGroupId,
          actorUuid: roll.actorUuid,
          actorName: roll.actorName,
          actorImg: roll.actorImg,
          groupedRolls: [],
          skillName: `Choose One (${0})`,  // Will update count
          dc: null,  // Multiple DCs
        });
      }
      batchGroups.get(groupKey).groupedRolls.push(roll);
    } else {
      // Regular roll
      processedRolls.push(roll);
    }
  });

  // Add batch groups to processed rolls with updated count
  batchGroups.forEach(group => {
    group.skillName = `Choose One (${group.groupedRolls.length})`;
    processedRolls.push(group);
  });

  // Group data based on current mode
  let groupedData;
  if (sidebar.pendingRollsGroupMode === 'actor') {
    groupedData = groupPendingRollsByActor(processedRolls);
  } else {
    groupedData = groupPendingRollsBySkill(processedRolls);
  }

  // Remove existing popup if any
  document.querySelector('.storyframe-pending-rolls-popup')?.remove();

  // Create popup
  const popup = document.createElement('div');
  popup.className = 'storyframe-pending-rolls-popup';

  // Generate grouped HTML
  const groupsHtml = renderPendingRollsGroups(groupedData, sidebar.pendingRollsGroupMode);

  const toggleGroupingLabel = game.i18n.localize('STORYFRAME.UI.Labels.ToggleGrouping');
  const byPCLabel = game.i18n.localize('STORYFRAME.UI.Labels.ByPC');
  const bySkillLabel = game.i18n.localize('STORYFRAME.UI.Labels.BySkill');
  const closeLabel = game.i18n.localize('STORYFRAME.UI.Labels.Close');
  const cancelAllLabel = game.i18n.localize('STORYFRAME.UI.Labels.CancelAll');
  const pendingRollsTitle = game.i18n.format('STORYFRAME.UI.Labels.PendingRolls', { count: rollsData.length });

  popup.innerHTML = `
    <div class="popup-header">
      <span class="popup-title">${pendingRollsTitle}</span>
      <div class="popup-header-actions">
        <button type="button" class="group-toggle-btn" data-mode="${sidebar.pendingRollsGroupMode}" aria-label="${toggleGroupingLabel}">
          <i class="fas fa-${sidebar.pendingRollsGroupMode === 'actor' ? 'users' : 'list'}"></i>
          <span>${sidebar.pendingRollsGroupMode === 'actor' ? byPCLabel : bySkillLabel}</span>
        </button>
        <button type="button" class="popup-close" aria-label="${closeLabel}">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>
    <div class="popup-body">
      ${groupsHtml}
    </div>
    <div class="popup-footer">
      <button type="button" class="cancel-all-btn">${cancelAllLabel}</button>
    </div>
  `;

  // Position popup (CSS handles all styling)
  const rect = target.getBoundingClientRect();
  popup.style.top = `${rect.bottom + 8}px`;
  popup.style.left = `${rect.left}px`;

  // Get references to elements for event handlers
  const title = popup.querySelector('.popup-title');
  const toggleBtn = popup.querySelector('.group-toggle-btn');
  const closeBtn = popup.querySelector('.popup-close');
  const cancelAllBtn = popup.querySelector('.cancel-all-btn');

  // Toggle handler
  toggleBtn.addEventListener('click', () => {
    sidebar.pendingRollsGroupMode = sidebar.pendingRollsGroupMode === 'actor' ? 'skill' : 'actor';
    onShowPendingRolls(_event, target, sidebar);
  });

  // Event handlers
  closeBtn.addEventListener('click', () => popup.remove());

  // Cancel individual roll
  popup.querySelectorAll('.cancel-roll-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const requestId = btn.dataset.requestId;
      await game.storyframe.socketManager.requestRemovePendingRoll(requestId);

      // Remove item from popup
      const item = btn.closest('.pending-roll-item');
      item.remove();

      // Update count in header
      const remaining = popup.querySelectorAll('.pending-roll-item').length;
      title.textContent = game.i18n.format('STORYFRAME.UI.Labels.PendingRolls', { count: remaining });

      // Close popup if no more rolls
      if (remaining === 0) {
        popup.remove();
      }

      ui.notifications.info(game.i18n.localize('STORYFRAME.Notifications.PendingRolls.RollCancelled'));
    });
  });

  // Cancel entire allow-only-one group
  popup.querySelectorAll('.cancel-group-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const batchGroupId = btn.dataset.batchGroupId;
      const actorUuid = btn.dataset.actorUuid;

      // Find all rolls in this group for this actor
      const groupRolls = rollsData.filter(r =>
        r.batchGroupId === batchGroupId && r.actorUuid === actorUuid && !r.isAllowOnlyOne
      );

      // Remove all rolls in group
      for (const roll of groupRolls) {
        await game.storyframe.socketManager.requestRemovePendingRoll(roll.id);
      }

      // Remove group item from popup
      const groupItem = btn.closest('.pending-roll-item');
      const subItems = groupItem.nextElementSibling;
      groupItem.remove();
      if (subItems?.classList.contains('group-sub-items')) {
        subItems.remove();
      }

      // Update count and check if empty
      const remaining = popup.querySelectorAll('.pending-roll-item').length;
      title.textContent = game.i18n.format('STORYFRAME.UI.Labels.PendingRolls', { count: remaining });

      if (remaining === 0) {
        popup.remove();
      }

      ui.notifications.info(game.i18n.format('STORYFRAME.Notifications.Roll.GroupRollsDismissed', { count: groupRolls.length }));
    });
  });

  // Cancel individual sub-roll from allow-only-one group
  popup.querySelectorAll('.cancel-sub-roll-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const requestId = btn.dataset.requestId;
      await game.storyframe.socketManager.requestRemovePendingRoll(requestId);

      // Remove this sub-item
      const subItem = btn.closest('.sub-roll-item');
      subItem.remove();

      // Check if group is now empty
      const groupItem = subItem.closest('.group-sub-items').previousElementSibling;
      const remainingSubItems = subItem.closest('.group-sub-items').querySelectorAll('.sub-roll-item').length;

      if (remainingSubItems === 0) {
        // Remove entire group if no sub-items left
        groupItem.remove();
        subItem.closest('.group-sub-items').remove();
      } else {
        // Update count in group header
        const groupHeader = groupItem.querySelector('.skill-name, .participant-name');
        if (groupHeader) {
          groupHeader.textContent = groupHeader.textContent.replace(/\(\d+\)/, `(${remainingSubItems})`);
        }
      }

      // Update total count
      const remaining = popup.querySelectorAll('.pending-roll-item').length;
      title.textContent = game.i18n.format('STORYFRAME.UI.Labels.PendingRolls', { count: remaining });

      if (remaining === 0) {
        popup.remove();
      }

      ui.notifications.info(game.i18n.localize('STORYFRAME.Notifications.PendingRolls.RollCancelled'));
    });
  });

  // Cancel all rolls
  cancelAllBtn.addEventListener('click', async () => {
    for (const roll of rollsData) {
      await game.storyframe.socketManager.requestRemovePendingRoll(roll.id);
    }
    popup.remove();
    ui.notifications.info(game.i18n.localize('STORYFRAME.Notifications.PendingRolls.AllRollsCancelled'));
  });

  // Close on click outside
  const closeHandler = (e) => {
    if (!popup.contains(e.target) && !target.contains(e.target)) {
      popup.remove();
      document.removeEventListener('click', closeHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 10);

  // Close on escape
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      popup.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  document.body.appendChild(popup);
  popup.style.zIndex = _aboveSidebarZIndex(sidebar);

  // Adjust position if off-screen
  const popupRect = popup.getBoundingClientRect();
  if (popupRect.right > window.innerWidth - 10) {
    popup.style.left = `${window.innerWidth - popupRect.width - 10}px`;
  }
  if (popupRect.bottom > window.innerHeight - 10) {
    popup.style.top = `${rect.top - popupRect.height - 8}px`;
  }
  if (popupRect.left < 10) {
    popup.style.left = '10px';
  }
  if (popupRect.top < 10) {
    popup.style.top = '10px';
  }
}

/**
 * Show active challenges popup
 */
export async function onShowActiveChallenges(_event, target, sidebar) {
  const state = game.storyframe.stateManager.getState();
  const activeChallenges = state?.activeChallenges || [];

  if (activeChallenges.length === 0) {
    ui.notifications.info(game.i18n.localize('STORYFRAME.Notifications.Challenge.NoChallenges'));
    return;
  }

  // Remove existing popup if any
  document.querySelector('.storyframe-challenges-popup')?.remove();

  // Create popup
  const popup = document.createElement('div');
  popup.className = 'storyframe-challenges-popup';

  const unknownLabel = game.i18n.localize('STORYFRAME.UI.Labels.Unknown');
  const challengesHtml = activeChallenges
    .map(
      (challenge) => {
        const clearLabel = game.i18n.format('STORYFRAME.UI.Tooltips.ClearChallenge', { name: challenge.name });
        return `
    <div class="challenge-item" data-challenge-id="${challenge.id}">
      <div class="challenge-item-header">
        ${challenge.image ? `<img src="${challenge.image}" alt="${challenge.name}" class="challenge-thumb" />` : '<i class="fas fa-flag-checkered challenge-icon"></i>'}
        <div class="challenge-info">
          <div class="challenge-name">${challenge.name || unknownLabel}</div>
          <div class="challenge-meta">${challenge.options?.length || 0} option(s)</div>
        </div>
        <button type="button" class="clear-challenge-btn" data-challenge-id="${challenge.id}" aria-label="${clearLabel}">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>
  `;
      },
    )
    .join('');

  const activeChallengesTitle = game.i18n.format('STORYFRAME.UI.Labels.ActiveChallenges', { count: activeChallenges.length });
  const closeLabel = game.i18n.localize('STORYFRAME.UI.Labels.Close');
  const clearAllLabel = game.i18n.localize('STORYFRAME.UI.Labels.ClearAll');

  popup.innerHTML = `
    <div class="popup-header">
      <span class="popup-title">${activeChallengesTitle}</span>
      <button type="button" class="popup-close" aria-label="${closeLabel}">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="popup-body">
      ${challengesHtml}
    </div>
    <div class="popup-footer">
      <button type="button" class="clear-all-btn">${clearAllLabel}</button>
    </div>
  `;

  // Position popup (CSS handles all styling)
  const rect = target.getBoundingClientRect();
  popup.style.top = `${rect.bottom + 8}px`;
  popup.style.left = `${rect.left}px`;

  // Event handlers
  const closeBtn = popup.querySelector('.popup-close');
  const title = popup.querySelector('.popup-title');
  const clearAllBtn = popup.querySelector('.clear-all-btn');

  closeBtn.addEventListener('click', () => popup.remove());

  // Clear individual challenge
  popup.querySelectorAll('.clear-challenge-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const challengeId = btn.dataset.challengeId;

      await game.storyframe.socketManager.requestRemoveChallenge(challengeId);

      // Remove item from popup
      const item = btn.closest('.challenge-item');
      item.remove();

      // Update count in header
      const remaining = popup.querySelectorAll('.challenge-item').length;
      title.textContent = game.i18n.format('STORYFRAME.UI.Labels.ActiveChallenges', { count: remaining });

      // Close popup if no more challenges
      if (remaining === 0) {
        popup.remove();
        ui.notifications.info(game.i18n.localize('STORYFRAME.Notifications.Challenge.AllChallengesCleared'));
      } else {
        ui.notifications.info(game.i18n.localize('STORYFRAME.Notifications.Challenge.ChallengeCleared'));
      }
    });
  });

  // Clear all challenges
  clearAllBtn.addEventListener('click', async () => {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('STORYFRAME.Dialogs.ClearAllChallenges.Title') },
      content: `<p>${game.i18n.localize('STORYFRAME.Dialogs.ClearAllChallenges.Content')}</p>`,
      yes: { label: game.i18n.localize('STORYFRAME.Dialogs.ClearAllChallenges.Button') },
      no: { label: game.i18n.localize('STORYFRAME.Dialogs.Cancel') },
      rejectClose: false,
    });

    if (!confirmed) return;

    await game.storyframe.socketManager.requestClearAllChallenges();
    popup.remove();
    ui.notifications.info(game.i18n.localize('STORYFRAME.Notifications.Challenge.AllChallengesCleared'));
  });

  // Close on click outside
  const closeHandler = (e) => {
    if (!popup.contains(e.target) && !target.contains(e.target)) {
      popup.remove();
      document.removeEventListener('click', closeHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 10);

  // Close on escape
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      popup.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  document.body.appendChild(popup);
  popup.style.zIndex = _aboveSidebarZIndex(sidebar);

  // Adjust position if off-screen (match pending rolls positioning)
  const popupRect = popup.getBoundingClientRect();
  if (popupRect.right > window.innerWidth - 10) {
    popup.style.left = `${window.innerWidth - popupRect.width - 10}px`;
  }
  if (popupRect.bottom > window.innerHeight - 10) {
    popup.style.top = `${rect.top - popupRect.height - 8}px`;
  }
  if (popupRect.left < 10) {
    popup.style.left = '10px';
  }
  if (popupRect.top < 10) {
    popup.style.top = '10px';
  }
}

/**
 * Show proficiency filter popup (stub - system-specific implementation)
 */
export async function onShowProficiencyFilter(_event, _target, _skillSlug, _sidebar) {
  ui.notifications.info(game.i18n.localize('STORYFRAME.Errors.ProficiencyFilteringNotImplemented'));
}

/**
 * Show check DCs popup for a skill
 */
export async function onShowCheckDCsPopup(_event, target, sidebar) {
  const skillName = target.dataset.skill;
  const checkType = target.dataset.checkType || 'skill';

  // Find all checks for this skill/save from context
  const context = await sidebar._prepareContext();

  // Try to get the appropriate group list, with fallback to journalCheckGroups for backward compatibility
  let groupList;
  if (checkType === 'save') {
    groupList = context.journalSaveGroups;
  } else {
    groupList = [
      ...(context.journalSkillGroups || context.journalCheckGroups || []),
      ...(context.journalLoreGroups || []),
    ];
  }

  const skillGroup = groupList?.find((g) => g.skillName === skillName);

  if (!skillGroup?.checks?.length) {
    console.warn('StoryFrame: No checks found for', skillName, 'in', groupList);
    return;
  }

  // Shift+click: add all checks for this skill/save to batch
  if (_event.shiftKey) {
    // Use appropriate slug converter based on check type
    const checkSlug = checkType === 'save'
      ? (SystemAdapter.getSaveSlugFromName(skillName) || skillName.toLowerCase())
      : (SystemAdapter.getSkillSlugFromName(skillName) || skillName.toLowerCase());

    // Toggle: if all checks already batched, remove them; otherwise add missing ones
    const checkIds = skillGroup.checks.map(check => `journal:${checkSlug}:${check.dc}`);
    const allBatched = checkIds.every(id => sidebar.batchedChecks.some(c => c.checkId === id));

    if (allBatched) {
      sidebar.batchedChecks = sidebar.batchedChecks.filter(c => !checkIds.includes(c.checkId));
    } else {
      skillGroup.checks.forEach((check) => {
        const checkId = `journal:${checkSlug}:${check.dc}`;
        if (!sidebar.batchedChecks.some(c => c.checkId === checkId)) {
          sidebar.batchedChecks.push({
            skill: checkSlug,
            dc: check.dc,
            isSecret: check.isSecret || false,
            actionSlug: null,
            checkType: checkType,
            checkId,
          });
        }
      });
    }

    // Update batch highlights
    SkillCheckHandlers.updateBatchHighlights(sidebar);
    return;
  }

  // Get visible DCs for this skill
  const normalizedSkill = skillName.toLowerCase();
  const visibleDCs = sidebar._visibleChecks?.get(normalizedSkill) || new Set();

  // Create popup menu
  const menu = document.createElement('div');
  menu.className = `storyframe-dc-popup ${checkType === 'save' ? 'save-popup' : 'skill-popup'}`;

  menu.innerHTML = `
    <div class="dc-popup-header">${skillName}</div>
    <div class="dc-popup-items">
      ${skillGroup.checks.map((check, idx) => {
    const hasDc = check.dc != null && !isNaN(check.dc);
    const isVisible = hasDc && visibleDCs.has(String(check.dc));
    const secretIcon = check.isSecret ? '<i class="fas fa-eye-slash" style="font-size: 0.7em; opacity: 0.7; margin-left: 4px;"></i>' : '';
    const dcDisplay = hasDc ? check.dc : '—';
    return `
        <button type="button"
                class="dc-option ${isVisible ? 'in-view' : ''}"
                data-dc="${hasDc ? check.dc : ''}"
                data-check-index="${idx}"
                data-skill="${check.skillName}"
                data-is-secret="${check.isSecret || false}"
                data-tooltip="${check.label}${check.isSecret ? ' (Secret)' : ''}">
          ${dcDisplay}${secretIcon}
        </button>
      `;
  }).join('')}
    </div>
  `;

  // Position above button (CSS handles all styling)
  const rect = target.getBoundingClientRect();
  document.body.appendChild(menu);
  menu.style.zIndex = _aboveSidebarZIndex(sidebar);

  menu.style.bottom = `${window.innerHeight - rect.top + 4}px`;
  menu.style.left = `${rect.left}px`;

  // Attach click handlers to DC buttons with shift-click for global batch
  menu.querySelectorAll('.dc-option').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const rawDc = btn.dataset.dc;
      const dc = rawDc ? parseInt(rawDc) : null;
      const skill = btn.dataset.skill;
      const isSecret = btn.dataset.isSecret === 'true';

      // Shift-click: add to global batch
      if (e.shiftKey) {
        // Use appropriate slug converter based on check type
        const checkSlug = checkType === 'save'
          ? (SystemAdapter.getSaveSlugFromName(skill) || skill.toLowerCase())
          : (SystemAdapter.getSkillSlugFromName(skill) || skill.toLowerCase());
        const checkId = `journal:${checkSlug}:${dc}`;

        // Check if already in global batch
        const existingIndex = sidebar.batchedChecks.findIndex(c => c.checkId === checkId);

        if (existingIndex !== -1) {
          // Remove from global batch
          sidebar.batchedChecks.splice(existingIndex, 1);
          btn.classList.remove('selected');
        } else {
          // Add to global batch
          sidebar.batchedChecks.push({
            skill: checkSlug,
            dc,
            isSecret,
            actionSlug: null,
            checkType: checkType,
            checkId,
          });
          btn.classList.add('selected');
        }

        // Update batch highlights in sidebar
        SkillCheckHandlers.updateBatchHighlights(sidebar);
        return;
      }

      // Normal click: send single check immediately
      menu.remove();

      // Set DC and request check (use sidebar's current DC if check has no DC)
      if (dc != null && !isNaN(dc)) {
        sidebar.currentDC = dc;
        const dcInput = sidebar.element.querySelector('#dc-input');
        if (dcInput) dcInput.value = dc;
      }

      // Set secret toggle if this is a secret check
      sidebar.secretRollEnabled = isSecret;
      const secretToggle = sidebar.element.querySelector('#secret-roll-toggle');
      if (secretToggle) secretToggle.checked = isSecret;

      // Use appropriate slug converter based on check type
      const checkSlug = checkType === 'save'
        ? (SystemAdapter.getSaveSlugFromName(skill) || skill.toLowerCase())
        : (SystemAdapter.getSkillSlugFromName(skill) || skill.toLowerCase());
      if (checkSlug) {
        // Open roll requester dialog then send
        const { getAllPlayerPCs } = await import('../../../system-adapter.mjs');
        const pcs = await getAllPlayerPCs();
        if (pcs.length === 0) {
          ui.notifications.warn(game.i18n.localize('STORYFRAME.Notifications.NoPlayerCharactersFound'));
          return;
        }
        const { RollRequestDialog } = await import('../../roll-request-dialog.mjs');

        // For lore skill checks, compute eligibility so the dialog can block drag-to-link
        // for PCs that don't have the lore skill. All PCs remain visible in the dialog.
        let eligiblePcIds = null;
        if (checkType === 'skill' && checkSlug.includes('-lore')) {
          const eligibilityResults = await Promise.all(
            pcs.map(async pc => {
              const actor = await fromUuid(pc.actorUuid);
              if (!actor) return false;
              return SkillCheckHandlers.actorHasSkill(sidebar, actor, checkSlug);
            })
          );
          const lorePcs = pcs.filter((_, i) => eligibilityResults[i]);
          if (lorePcs.length === 0) {
            ui.notifications.warn(game.i18n.format('STORYFRAME.Notifications.SkillCheck.NoPlayersHaveSkill', { skillName: SkillCheckHandlers.getSkillName(checkSlug) }));
            return;
          }
          eligiblePcIds = new Set(lorePcs.map(p => p.id));
        }

        const checks = [{ skillName: checkSlug, dc, isSecret, checkType, eligiblePcIds }];
        const result = await RollRequestDialog.subscribe(checks, pcs);
        const selectedIds = result?.selectedIds || result || [];
        const allowOnlyOne = result?.allowOnlyOne || false;
        const batchGroupId = result?.batchGroupId ?? null;
        if (selectedIds && selectedIds.length > 0) {
          await SkillCheckHandlers.requestSkillCheck(sidebar, checkSlug, selectedIds, null, false, checkType, batchGroupId, allowOnlyOne, null, result.checks[0].isSecret ?? false);
        }
      }
    });

    // Mark as selected if already in global batch
    const btnCheckSlug = checkType === 'save'
      ? (SystemAdapter.getSaveSlugFromName(btn.dataset.skill) || btn.dataset.skill.toLowerCase())
      : (SystemAdapter.getSkillSlugFromName(btn.dataset.skill) || btn.dataset.skill.toLowerCase());
    const rawDcVal = btn.dataset.dc;
    const dcVal = rawDcVal ? parseInt(rawDcVal) : null;
    const checkId = `journal:${btnCheckSlug}:${dcVal}`;
    if (sidebar.batchedChecks.some(c => c.checkId === checkId)) {
      btn.classList.add('selected');
    }
  });

  // Close on click outside
  const closeHandler = (e) => {
    if (!menu.contains(e.target) && !target.contains(e.target)) {
      menu.remove();
      document.removeEventListener('click', closeHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 10);
}

/**
 * Apply a journal check
 */
export async function onApplyJournalCheck(_event, target, sidebar) {
  const rawDc = target.dataset.dc;
  const dc = rawDc ? parseInt(rawDc) : null;
  const skillName = target.dataset.skill;

  // Set the DC if present, otherwise use sidebar's current DC
  if (dc != null && !isNaN(dc)) {
    sidebar.currentDC = dc;
    const dcInput = sidebar.element.querySelector('#dc-input');
    if (dcInput) dcInput.value = dc;
  }

  // If we have a skill, open roll requester and request the roll
  if (skillName) {
    const skillSlug = SystemAdapter.getSkillSlugFromName(skillName) || skillName.toLowerCase();

    if (skillSlug) {
      const { getAllPlayerPCs } = await import('../../../system-adapter.mjs');
      const pcs = await getAllPlayerPCs();
      if (pcs.length === 0) {
        ui.notifications.warn(game.i18n.localize('STORYFRAME.Notifications.NoPlayerCharactersFound'));
        return;
      }
      const { RollRequestDialog } = await import('../../roll-request-dialog.mjs');

      // For lore skill checks, compute eligibility so the dialog can block drag-to-link
      // for PCs that don't have the lore skill. All PCs remain visible in the dialog.
      let eligiblePcIds = null;
      if (skillSlug.includes('-lore')) {
        const eligibilityResults = await Promise.all(
          pcs.map(async pc => {
            const actor = await fromUuid(pc.actorUuid);
            if (!actor) return false;
            return SkillCheckHandlers.actorHasSkill(sidebar, actor, skillSlug);
          })
        );
        const lorePcs = pcs.filter((_, i) => eligibilityResults[i]);
        if (lorePcs.length === 0) {
          ui.notifications.warn(game.i18n.format('STORYFRAME.Notifications.SkillCheck.NoPlayersHaveSkill', { skillName: SkillCheckHandlers.getSkillName(skillSlug) }));
          return;
        }
        eligiblePcIds = new Set(lorePcs.map(p => p.id));
      }

      const checks = [{ skillName: skillSlug, dc, isSecret: false, checkType: 'skill', eligiblePcIds }];
      const result = await RollRequestDialog.subscribe(checks, pcs);
      const selectedIds = result?.selectedIds || result || [];
      const allowOnlyOne = result?.allowOnlyOne || false;
      const batchGroupId = result?.batchGroupId ?? null;
      if (selectedIds && selectedIds.length > 0) {
        await SkillCheckHandlers.requestSkillCheck(sidebar, skillSlug, selectedIds, null, false, 'skill', batchGroupId, allowOnlyOne, null, result.checks[0].isSecret ?? false);
      }
    } else {
      ui.notifications.warn(game.i18n.format('STORYFRAME.Notifications.SkillCheck.UnknownSkill', { skillName }));
    }
  } else {
    ui.notifications.info(game.i18n.format('STORYFRAME.Notifications.DC.DCSet', { dc }));
  }
}

/**
 * Show skill actions context menu
 */
export function showSkillActionsMenu(event, skillSlug, sidebar) {
  const skills = SystemAdapter.getSkills();
  const skill = skills[skillSlug];
  const actions = skill?.actions;

  if (!actions || actions.length === 0) {
    return;
  }

  const skillName = SkillCheckHandlers.getSkillName(skillSlug);

  // Remove any existing menu
  document.querySelector('.storyframe-skill-actions-menu')?.remove();

  // Create popup menu (see original for full implementation)
  const menu = document.createElement('div');
  menu.className = 'storyframe-skill-actions-menu';
  menu.innerHTML = `
    <div class="menu-header">${skillName} Actions</div>
    <div class="menu-actions">
      ${actions.map((a) => `<button type="button" class="action-option" data-action-slug="${a.slug}" data-skill="${skillSlug}">${a.name}</button>`).join('')}
    </div>
  `;

  // Position near the click (CSS handles all styling)
  const rect = event.target.getBoundingClientRect();
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.left = `${rect.left}px`;

  // Attach click handlers to action buttons with shift+click for batch
  menu.querySelectorAll('.action-option').forEach((btn) => {
    // Attach hover handlers for action variants
    let hoverTimeout = null;

    btn.addEventListener('mouseenter', (e) => {
      const actionSlug = btn.dataset.actionSlug;
      if (!actionSlug) return;

      // Cancel any pending hide
      if (window._variantPopupHideTimeout) {
        clearTimeout(window._variantPopupHideTimeout);
        window._variantPopupHideTimeout = null;
      }

      // Delay showing popup slightly
      hoverTimeout = setTimeout(() => {
        showActionVariantsPopup(e, actionSlug, sidebar);
      }, 300);
    });

    btn.addEventListener('mouseleave', () => {
      clearTimeout(hoverTimeout);
      hideActionVariantsPopup();
    });

    btn.addEventListener('click', async (e) => {
      const actionSlug = btn.dataset.actionSlug;
      const actionSkill = btn.dataset.skill;

      // Shift-click: add to global batch
      if (e.shiftKey) {
        const checkId = `action:${actionSkill}:${actionSlug}`;

        // Check if already in global batch
        const existingIndex = sidebar.batchedChecks.findIndex(c => c.checkId === checkId);

        if (existingIndex !== -1) {
          // Remove from global batch
          sidebar.batchedChecks.splice(existingIndex, 1);
          btn.classList.remove('selected');
        } else {
          // Add to global batch
          sidebar.batchedChecks.push({
            skill: actionSkill,
            dc: sidebar.currentDC,
            isSecret: sidebar.secretRollEnabled || false,
            actionSlug,
            checkType: 'skill',
            checkId,
          });
          btn.classList.add('selected');
        }

        // Update batch highlights in sidebar
        SkillCheckHandlers.updateBatchHighlights(sidebar);
        return;
      }

      // Normal click: open roll requester then send
      menu.remove();

      const { getAllPlayerPCs } = await import('../../../system-adapter.mjs');
      const pcs = await getAllPlayerPCs();
      if (pcs.length === 0) {
        ui.notifications.warn(game.i18n.localize('STORYFRAME.Notifications.NoPlayerCharactersFound'));
        return;
      }
      const { RollRequestDialog } = await import('../../roll-request-dialog.mjs');
      const checks = [{ skillName: actionSkill, dc: sidebar.currentDC, isSecret: sidebar.secretRollEnabled, checkType: 'skill', actionSlug }];
      const result = await RollRequestDialog.subscribe(checks, pcs);
      const selectedIds = result?.selectedIds || result || [];
      const allowOnlyOne = result?.allowOnlyOne || false;
      const batchGroupId = result?.batchGroupId ?? null;
      if (selectedIds && selectedIds.length > 0) {
        await SkillCheckHandlers.requestSkillCheck(sidebar, actionSkill, selectedIds, actionSlug, false, 'skill', batchGroupId, allowOnlyOne, null, result.checks[0].isSecret ?? false);
      }
    });

    // Mark as selected if already in global batch
    const checkId = `action:${btn.dataset.skill}:${btn.dataset.actionSlug}`;
    if (sidebar.batchedChecks.some(c => c.checkId === checkId)) {
      btn.classList.add('selected');
    }
  });

  // Close on click outside
  const closeHandler = (e) => {
    if (!menu.contains(e.target) && !event.target.contains(e.target)) {
      menu.remove();
      document.removeEventListener('click', closeHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 10);

  document.body.appendChild(menu);
  menu.style.zIndex = _aboveSidebarZIndex(sidebar);

  // Adjust position if off-screen
  const menuRect = menu.getBoundingClientRect();
  if (menuRect.right > window.innerWidth) {
    menu.style.left = `${window.innerWidth - menuRect.width - 10}px`;
  }
  if (menuRect.bottom > window.innerHeight) {
    menu.style.top = `${rect.top - menuRect.height - 4}px`;
  }
}

/**
 * Show action variants popup on hover
 */
export function showActionVariantsPopup(event, actionSlug, sidebar) {
  // Import PF2E_ACTION_VARIANTS at runtime
  import('../../../system/pf2e/actions.mjs').then((module) => {
    const { PF2E_ACTION_VARIANTS } = module;

    const variants = PF2E_ACTION_VARIANTS[actionSlug];
    if (!variants || variants.length === 0) return;

    // Remove existing popup
    document.querySelector('.storyframe-action-variants-popup')?.remove();

    const popup = document.createElement('div');
    popup.className = 'storyframe-action-variants-popup';

    popup.innerHTML = `
      <div class="variants-list">
        ${variants.map(v => `
          <div class="variant-item" data-variant-slug="${v.slug}">${v.name}</div>
        `).join('')}
      </div>
    `;

    // Position to the right of the button
    const actionButton = event.target.closest('[data-action-slug]');
    const rect = actionButton.getBoundingClientRect();
    popup.style.top = `${rect.top}px`;
    popup.style.left = `${rect.right + 8}px`;

    document.body.appendChild(popup);
    popup.style.zIndex = _aboveSidebarZIndex(sidebar);

    // Adjust if off-screen
    const popupRect = popup.getBoundingClientRect();
    if (popupRect.right > window.innerWidth - 10) {
      popup.style.left = `${rect.left - popupRect.width - 8}px`;
    }
    if (popupRect.bottom > window.innerHeight - 10) {
      popup.style.top = `${window.innerHeight - popupRect.height - 10}px`;
    }
    if (popupRect.top < 10) {
      popup.style.top = '10px';
    }

    // Pre-mark variants already in batch
    popup.querySelectorAll('.variant-item').forEach((item) => {
      const checkId = `action:${actionButton.dataset.skill}:${actionSlug}:${item.dataset.variantSlug}`;
      if (sidebar?.batchedChecks.some(c => c.checkId === checkId)) {
        item.classList.add('selected');
      }
    });

    // Attach click handlers to variant items
    popup.querySelectorAll('.variant-item').forEach((item) => {
      item.addEventListener('click', async (e) => {
        const skillSlug = actionButton.dataset.skill;
        const variantSlug = item.dataset.variantSlug;

        // Shift-click: add to batch
        if (e.shiftKey) {
          const checkId = `action:${skillSlug}:${actionSlug}:${variantSlug}`;
          const existingIndex = sidebar?.batchedChecks.findIndex(c => c.checkId === checkId) ?? -1;
          if (existingIndex !== -1) {
            sidebar.batchedChecks.splice(existingIndex, 1);
          } else {
            sidebar?.batchedChecks.push({
              skill: skillSlug,
              dc: sidebar?.currentDC ?? null,
              isSecret: sidebar?.secretRollEnabled || false,
              actionSlug,
              actionVariant: variantSlug,
              checkType: 'skill',
              checkId,
            });
          }
          popup.remove();
          document.querySelector('.storyframe-skill-actions-menu')?.remove();
          if (sidebar) SkillCheckHandlers.updateBatchHighlights(sidebar);
          return;
        }

        // Close all popups
        popup.remove();
        document.querySelector('.storyframe-skill-actions-menu')?.remove();

        // Open roll requester then trigger action with variant
        const { getAllPlayerPCs } = await import('../../../system-adapter.mjs');
        const pcs = await getAllPlayerPCs();
        if (pcs.length === 0) {
          ui.notifications.warn(game.i18n.localize('STORYFRAME.Notifications.NoPlayerCharactersFound'));
          return;
        }
        const { RollRequestDialog } = await import('../../roll-request-dialog.mjs');
        const checks = [{ skillName: skillSlug, dc: sidebar?.currentDC, isSecret: sidebar?.secretRollEnabled, checkType: 'skill', actionSlug, actionVariant: variantSlug }];
        const result = await RollRequestDialog.subscribe(checks, pcs);
        const selectedIds = result?.selectedIds || result || [];
        const allowOnlyOne = result?.allowOnlyOne || false;
        const batchGroupId = result?.batchGroupId ?? null;
        if (selectedIds && selectedIds.length > 0) {
          await SkillCheckHandlers.requestSkillCheck(
            sidebar,
            skillSlug,
            selectedIds,
            actionSlug,
            false,
            'skill',
            batchGroupId,
            allowOnlyOne,
            variantSlug,
            result.checks[0].isSecret ?? false,
          );
        }
      });
    });

    // Keep popup visible when hovering over it
    popup.addEventListener('mouseenter', () => {
      // Cancel any pending hide
      if (window._variantPopupHideTimeout) {
        clearTimeout(window._variantPopupHideTimeout);
        window._variantPopupHideTimeout = null;
      }
    });

    popup.addEventListener('mouseleave', () => {
      hideActionVariantsPopup();
    });
  });
}

/**
 * Hide action variants popup
 */
export function hideActionVariantsPopup() {
  // Delay slightly to allow moving to popup
  window._variantPopupHideTimeout = setTimeout(() => {
    document.querySelector('.storyframe-action-variants-popup')?.remove();
    window._variantPopupHideTimeout = null;
  }, 100);
}

/**
 * Attach action variant hover handlers
 */
export function attachActionVariantHoverHandlers(sidebar) {
  const actionButtons = sidebar.element.querySelectorAll('[data-action-slug]');

  actionButtons.forEach((btn) => {
    let hoverTimeout = null;

    btn.addEventListener('mouseenter', (e) => {
      const actionSlug = btn.dataset.actionSlug;
      if (!actionSlug) return;

      // Cancel any pending hide
      if (window._variantPopupHideTimeout) {
        clearTimeout(window._variantPopupHideTimeout);
        window._variantPopupHideTimeout = null;
      }

      // Delay showing popup slightly
      hoverTimeout = setTimeout(() => {
        showActionVariantsPopup(e, actionSlug, sidebar);
      }, 300);
    });

    btn.addEventListener('mouseleave', () => {
      clearTimeout(hoverTimeout);
      hideActionVariantsPopup();
    });
  });
}

/**
 * Attach skill action context menu handlers
 */
export function attachSkillActionContextMenu(sidebar) {
  const skillButtons = sidebar.element.querySelectorAll('.skill-btn[data-skill]');
  skillButtons.forEach((btn) => {
    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const skillSlug = btn.dataset.skill;
      if (skillSlug) {
        showSkillActionsMenu(e, skillSlug, sidebar);
      }
    });
  });
}

// --- Helper Functions ---

/**
 * Group pending rolls by actor
 */
export function groupPendingRollsByActor(rollsData) {
  const grouped = {};

  rollsData.forEach(roll => {
    const key = roll.actorUuid || 'unknown';
    if (!grouped[key]) {
      grouped[key] = {
        id: key,
        name: roll.actorName,
        img: roll.actorImg || 'icons/svg/mystery-man.svg',
        rolls: [],
      };
    }
    grouped[key].rolls.push(roll);
  });

  return Object.values(grouped).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Group pending rolls by skill
 */
export function groupPendingRollsBySkill(rollsData) {
  const grouped = {};

  rollsData.forEach(roll => {
    const skillKey = roll.skillName + (roll.actionName ? ` (${roll.actionName})` : '');
    if (!grouped[skillKey]) {
      grouped[skillKey] = {
        skillName: roll.skillName,
        actionName: roll.actionName,
        displayName: skillKey,
        rolls: [],
      };
    }
    grouped[skillKey].rolls.push(roll);
  });

  return Object.values(grouped).sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/**
 * Render grouped pending rolls HTML
 */
export function renderPendingRollsGroups(groups, mode) {
  if (mode === 'actor') {
    // Group by PC: show PC avatar + name header, skill names in items
    return groups.map(group => `
      <div class="pending-roll-group">
        <div class="group-header">
          <img src="${group.img}" alt="${group.name}" class="group-avatar" />
          <span class="group-name">${group.name}</span>
          <span class="group-count">${group.rolls.length}</span>
        </div>
        <div class="group-items">
          ${group.rolls.map(roll => `
            ${roll.isAllowOnlyOne ? `
              <div class="pending-roll-item allow-only-one-group-item" data-batch-group-id="${roll.batchGroupId}">
                <div class="roll-info">
                  <i class="fas fa-hand-pointer allow-only-one-icon"></i>
                  <span class="skill-name">${roll.skillName}</span>
                </div>
                <button type="button" class="cancel-group-btn" data-batch-group-id="${roll.batchGroupId}" data-actor-uuid="${roll.actorUuid}">
                  <i class="fas fa-times"></i>
                </button>
              </div>
              <div class="group-sub-items">
                ${roll.groupedRolls.map(subRoll => `
                  <div class="sub-roll-item">
                    <span class="sub-skill-name">${subRoll.skillName}${subRoll.actionName ? ` (${subRoll.actionName})` : ''}</span>
                    ${subRoll.dc ? `<span class="dc-badge">DC ${subRoll.dc}</span>` : ''}
                    ${subRoll.isSecretRoll ? `<span class="secret-badge-popup"><i class="fas fa-eye-slash"></i></span>` : ''}
                    <button type="button" class="cancel-sub-roll-btn" data-request-id="${subRoll.id}" data-batch-group-id="${roll.batchGroupId}">
                      <i class="fas fa-times"></i>
                    </button>
                  </div>
                `).join('')}
              </div>
            ` : `
              <div class="pending-roll-item" data-request-id="${roll.id}">
                <div class="roll-info">
                  <span class="skill-name">${roll.skillName}${roll.actionName ? ` (${roll.actionName})` : ''}</span>
                  ${roll.dc ? `<span class="dc-badge">DC ${roll.dc}</span>` : ''}
                  ${roll.isSecretRoll ? `<span class="secret-badge-popup"><i class="fas fa-eye-slash"></i></span>` : ''}
                </div>
                <button type="button" class="cancel-roll-btn" data-request-id="${roll.id}">
                  <i class="fas fa-times"></i>
                </button>
              </div>
            `}
          `).join('')}
        </div>
      </div>
    `).join('');
  } else {
    // Group by Skill: show skill name header, PC avatars in items
    return groups.map(group => `
      <div class="pending-roll-group">
        <div class="group-header skill-group-header">
          <i class="fas fa-dice-d20"></i>
          <span class="group-name">${group.displayName}</span>
          <span class="group-count">${group.rolls.length}</span>
        </div>
        <div class="group-items">
          ${group.rolls.map(roll => `
            ${roll.isAllowOnlyOne ? `
              <div class="pending-roll-item allow-only-one-group-item" data-batch-group-id="${roll.batchGroupId}">
                <div class="roll-info">
                  <i class="fas fa-hand-pointer allow-only-one-icon"></i>
                  <img src="${roll.actorImg}" alt="${roll.actorName}" class="participant-avatar-small" />
                  <span class="participant-name">${roll.actorName} - Choose One (${roll.groupedRolls.length})</span>
                </div>
                <button type="button" class="cancel-group-btn" data-batch-group-id="${roll.batchGroupId}" data-actor-uuid="${roll.actorUuid}">
                  <i class="fas fa-times"></i>
                </button>
              </div>
              <div class="group-sub-items">
                ${roll.groupedRolls.map(subRoll => `
                  <div class="sub-roll-item">
                    <span class="sub-skill-name">${subRoll.skillName}${subRoll.actionName ? ` (${subRoll.actionName})` : ''}</span>
                    ${subRoll.dc ? `<span class="dc-badge">DC ${subRoll.dc}</span>` : ''}
                    ${subRoll.isSecretRoll ? `<span class="secret-badge-popup"><i class="fas fa-eye-slash"></i></span>` : ''}
                    <button type="button" class="cancel-sub-roll-btn" data-request-id="${subRoll.id}" data-batch-group-id="${roll.batchGroupId}">
                      <i class="fas fa-times"></i>
                    </button>
                  </div>
                `).join('')}
              </div>
            ` : `
              <div class="pending-roll-item" data-request-id="${roll.id}">
                <div class="roll-info">
                  <img src="${roll.actorImg || 'icons/svg/mystery-man.svg'}" alt="${roll.actorName}" class="participant-avatar-small" />
                  <span class="participant-name">${roll.actorName}</span>
                  ${roll.dc ? `<span class="dc-badge">DC ${roll.dc}</span>` : ''}
                  ${roll.isSecretRoll ? `<span class="secret-badge-popup"><i class="fas fa-eye-slash"></i></span>` : ''}
                </div>
                <button type="button" class="cancel-roll-btn" data-request-id="${roll.id}">
                  <i class="fas fa-times"></i>
                </button>
              </div>
            `}
          `).join('')}
        </div>
      </div>
    `).join('');
  }
}

/**
 * Show saved speaker scenes popup
 */
export async function onShowSavedScenes(_event, target, sidebar) {
  const scenes = game.settings.get(MODULE_ID, 'speakerScenes') || [];

  if (scenes.length === 0) {
    ui.notifications.info(game.i18n.localize('STORYFRAME.Notifications.Scene.NoSavedScenes'));
    return;
  }

  // Remove existing popup if any
  document.querySelector('.storyframe-scenes-popup')?.remove();

  // Create popup
  const popup = document.createElement('div');
  popup.className = 'storyframe-scenes-popup';

  const scenesHtml = scenes
    .map(
      (scene) => {
        const editLabel = game.i18n.format('STORYFRAME.UI.Tooltips.EditScene', { name: scene.name });
        const updateLabel = game.i18n.format('STORYFRAME.UI.Tooltips.UpdateScene', { name: scene.name });
        const deleteLabel = game.i18n.format('STORYFRAME.UI.Tooltips.DeleteScene', { name: scene.name });
        return `
    <div class="scene-item" data-scene-id="${scene.id}">
      <div class="scene-item-header">
        <div class="scene-icon-wrapper">
          <i class="fas fa-users scene-icon"></i>
        </div>
        <div class="scene-info">
          <div class="scene-name">${scene.name}</div>
          <div class="scene-meta">${scene.speakers.length} speaker(s)</div>
        </div>
        <div class="scene-actions">
          <button type="button" class="edit-scene-btn" data-scene-id="${scene.id}" aria-label="${editLabel}">
            <i class="fas fa-pencil-alt"></i>
          </button>
          <button type="button" class="update-scene-btn" data-tooltip="Update scene with current speakers" data-scene-id="${scene.id}" aria-label="${updateLabel}">
            <i class="fas fa-sync-alt"></i>
          </button>
          <button type="button" class="delete-scene-btn" data-scene-id="${scene.id}" aria-label="${deleteLabel}">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    </div>
  `;
      },
    )
    .join('');

  const savedScenesTitle = game.i18n.format('STORYFRAME.UI.Labels.SavedScenes', { count: scenes.length });
  const closeLabel = game.i18n.localize('STORYFRAME.UI.Labels.Close');

  popup.innerHTML = `
    <div class="popup-header">
      <span class="popup-title">${savedScenesTitle}</span>
      <button type="button" class="popup-close" aria-label="${closeLabel}">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="popup-body">
      ${scenesHtml}
    </div>
  `;

  // Position popup
  const rect = target.getBoundingClientRect();
  popup.style.top = `${rect.bottom + 8}px`;
  popup.style.left = `${rect.left}px`;

  // Event handlers
  const closeBtn = popup.querySelector('.popup-close');
  const title = popup.querySelector('.popup-title');

  closeBtn.addEventListener('click', () => popup.remove());

  // Edit individual scene
  popup.querySelectorAll('.edit-scene-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const sceneId = btn.dataset.sceneId;
      const scene = scenes.find(s => s.id === sceneId);

      // Close popup
      popup.remove();

      // Open scene editor
      const { showSceneEditor } = await import('../../../scene-editor.mjs');
      const journalElement = document.querySelector('.journal-entry-pages');
      await showSceneEditor({
        sceneId: scene.id,
        sceneName: scene.name,
        speakers: scene.speakers || [],
        journalElement,
      });

      // Re-render sidebar after edit
      sidebar.render();
    });
  });

  // Update scene with current speakers
  popup.querySelectorAll('.update-scene-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const sceneId = btn.dataset.sceneId;

      // Get current speakers from state
      const state = game.storyframe.stateManager.getState();
      const currentSpeakers = state?.speakers || [];

      if (currentSpeakers.length === 0) {
        ui.notifications.warn(game.i18n.localize('STORYFRAME.Notifications.Scene.NoSpeakersToAdd'));
        return;
      }

      // Clean speaker data - only save source properties
      const cleanedSpeakers = currentSpeakers.map(s => ({
        id: s.id,
        actorUuid: s.actorUuid,
        imagePath: s.imagePath,
        label: s.label,
      }));

      // Update the scene
      const updatedScenes = scenes.map(s =>
        s.id === sceneId
          ? { ...s, speakers: cleanedSpeakers, updatedAt: Date.now() }
          : s
      );

      await game.settings.set(MODULE_ID, 'speakerScenes', updatedScenes);

      // Update the scene item's speaker count in the popup
      const sceneItem = btn.closest('.scene-item');
      const metaElement = sceneItem.querySelector('.scene-meta');
      metaElement.textContent = `${cleanedSpeakers.length} speaker(s)`;
    });
  });

  // Helper function to load a scene
  const loadScene = async (scene) => {
    // Load the scene's speakers
    await game.storyframe.socketManager.requestUpdateSpeakers(scene.speakers || []);

    // Close popup
    popup.remove();

    // Re-render sidebar to show the loaded speakers
    sidebar.render();
  };

  // Load scene on click
  popup.querySelectorAll('.scene-item').forEach((item) => {
    item.addEventListener('click', async (e) => {
      // Don't trigger if clicking on action buttons
      if (e.target.closest('.edit-scene-btn') || e.target.closest('.update-scene-btn') || e.target.closest('.delete-scene-btn')) {
        return;
      }

      const sceneId = item.dataset.sceneId;
      const scene = scenes.find(s => s.id === sceneId);

      if (scene) {
        await loadScene(scene);
      }
    });

    // Load scene on right-click
    item.addEventListener('contextmenu', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Don't trigger if clicking on action buttons
      if (e.target.closest('.edit-scene-btn') || e.target.closest('.update-scene-btn') || e.target.closest('.delete-scene-btn')) {
        return;
      }

      const sceneId = item.dataset.sceneId;
      const scene = scenes.find(s => s.id === sceneId);

      if (scene) {
        await loadScene(scene);
      }
    });
  });

  // Delete individual scene
  popup.querySelectorAll('.delete-scene-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const sceneId = btn.dataset.sceneId;
      const scene = scenes.find(s => s.id === sceneId);

      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: game.i18n.localize('STORYFRAME.Dialogs.DeleteScene.Title') },
        content: `<p>${game.i18n.format('STORYFRAME.Dialogs.DeleteScene.Content', { name: scene.name })}</p>`,
        yes: { label: game.i18n.localize('STORYFRAME.Dialogs.DeleteScene.Button') },
        no: { label: game.i18n.localize('STORYFRAME.Dialogs.Cancel'), default: true },
        rejectClose: false,
      });

      if (!confirmed) return;

      const filtered = scenes.filter(s => s.id !== sceneId);
      await game.settings.set(MODULE_ID, 'speakerScenes', filtered);

      // Remove item from popup
      const item = btn.closest('.scene-item');
      item.remove();

      // Update count in header
      const remaining = popup.querySelectorAll('.scene-item').length;
      title.textContent = game.i18n.format('STORYFRAME.UI.Labels.SavedScenes', { count: remaining });

      // Close popup if no more scenes
      if (remaining === 0) {
        popup.remove();
      }

      // Re-render sidebar to hide manage button if needed
      sidebar.render();

      ui.notifications.info(game.i18n.format('STORYFRAME.Notifications.Scene.SceneDeleted', { name: scene.name }));
    });
  });

  // Close on click outside
  const closeHandler = (e) => {
    if (!popup.contains(e.target) && !target.contains(e.target)) {
      popup.remove();
      document.removeEventListener('click', closeHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 10);

  // Close on escape
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      popup.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  document.body.appendChild(popup);
  popup.style.zIndex = _aboveSidebarZIndex(sidebar);

  // Adjust position if off-screen
  const popupRect = popup.getBoundingClientRect();
  if (popupRect.right > window.innerWidth - 10) {
    popup.style.left = `${window.innerWidth - popupRect.width - 10}px`;
  }
  if (popupRect.bottom > window.innerHeight - 10) {
    popup.style.top = `${rect.top - popupRect.height - 8}px`;
  }
  if (popupRect.left < 10) {
    popup.style.left = '10px';
  }
  if (popupRect.top < 10) {
    popup.style.top = '10px';
  }
}
