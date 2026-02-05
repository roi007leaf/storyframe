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

  // Check if it would go off-screen, if so position to the left instead
  const maxLeft = window.innerWidth - sidebar.position.width;
  let adjustedLeft = newLeft;

  if (newLeft > maxLeft) {
    // Position to the left of parent instead
    adjustedLeft = Math.max(0, parentRect.left - sidebar.position.width);
  }

  // Use setPosition for ApplicationV2
  if (!sidebar.element) {
    console.warn('StoryFrame: Sidebar element not found, cannot position');
    return;
  }

  sidebar.setPosition({
    left: adjustedLeft,
    top: newTop,
    height: newHeight,
  });

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
 * Show pending rolls popup
 */
export async function onShowPendingRolls(_event, target, sidebar) {
  const state = game.storyframe.stateManager.getState();
  const pendingRolls = state?.pendingRolls || [];

  if (pendingRolls.length === 0) {
    ui.notifications.info('No pending rolls');
    return;
  }

  // Build pending rolls data with names
  const rollsData = await Promise.all(
    pendingRolls.map(async (r) => {
      const participant = state.participants?.find((p) => p.id === r.participantId);
      const actor = participant ? await fromUuid(participant.actorUuid) : null;
      return {
        ...r,
        participantId: r.participantId,
        participantName: actor?.name || 'Unknown',
        participantImg: actor?.img || 'icons/svg/mystery-man.svg',
        skillName: SkillCheckHandlers.getSkillName(r.skillSlug),
        actionName: r.actionSlug ? SkillCheckHandlers.getActionName(r.skillSlug, r.actionSlug) : null,
      };
    }),
  );

  // Group data based on current mode
  let groupedData;
  if (sidebar.pendingRollsGroupMode === 'actor') {
    groupedData = groupPendingRollsByActor(rollsData);
  } else {
    groupedData = groupPendingRollsBySkill(rollsData);
  }

  // Remove existing popup if any
  document.querySelector('.storyframe-pending-rolls-popup')?.remove();

  // Create popup
  const popup = document.createElement('div');
  popup.className = 'storyframe-pending-rolls-popup';

  // Generate grouped HTML
  const groupsHtml = renderPendingRollsGroups(groupedData, sidebar.pendingRollsGroupMode);

  popup.innerHTML = `
    <div class="popup-header">
      <span class="popup-title">Pending Rolls (${rollsData.length})</span>
      <div class="popup-header-actions">
        <button type="button" class="group-toggle-btn" data-mode="${sidebar.pendingRollsGroupMode}" aria-label="Toggle grouping">
          <i class="fas fa-${sidebar.pendingRollsGroupMode === 'actor' ? 'users' : 'list'}"></i>
          <span>${sidebar.pendingRollsGroupMode === 'actor' ? 'By PC' : 'By Skill'}</span>
        </button>
        <button type="button" class="popup-close" aria-label="Close">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>
    <div class="popup-body">
      ${groupsHtml}
    </div>
    <div class="popup-footer">
      <button type="button" class="cancel-all-btn">Cancel All</button>
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
      title.textContent = `Pending Rolls (${remaining})`;

      // Close popup if no more rolls
      if (remaining === 0) {
        popup.remove();
      }

      ui.notifications.info('Roll request cancelled');
    });
  });

  // Cancel all rolls
  cancelAllBtn.addEventListener('click', async () => {
    for (const roll of rollsData) {
      await game.storyframe.socketManager.requestRemovePendingRoll(roll.id);
    }
    popup.remove();
    ui.notifications.info('All roll requests cancelled');
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
    ui.notifications.info('No active challenges');
    return;
  }

  // Remove existing popup if any
  document.querySelector('.storyframe-challenges-popup')?.remove();

  // Create popup
  const popup = document.createElement('div');
  popup.className = 'storyframe-challenges-popup';

  const challengesHtml = activeChallenges
    .map(
      (challenge) => `
    <div class="challenge-item" data-challenge-id="${challenge.id}">
      <div class="challenge-item-header">
        ${challenge.image ? `<img src="${challenge.image}" alt="${challenge.name}" class="challenge-thumb" />` : '<i class="fas fa-flag-checkered challenge-icon"></i>'}
        <div class="challenge-info">
          <div class="challenge-name">${challenge.name || 'Unnamed Challenge'}</div>
          <div class="challenge-meta">${challenge.options?.length || 0} option(s)</div>
        </div>
        <button type="button" class="clear-challenge-btn" data-challenge-id="${challenge.id}" aria-label="Clear ${challenge.name}">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>
  `,
    )
    .join('');

  popup.innerHTML = `
    <div class="popup-header">
      <span class="popup-title">Active Challenges (${activeChallenges.length})</span>
      <button type="button" class="popup-close" aria-label="Close">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="popup-body">
      ${challengesHtml}
    </div>
    <div class="popup-footer">
      <button type="button" class="clear-all-btn">Clear All</button>
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
      title.textContent = `Active Challenges (${remaining})`;

      // Close popup if no more challenges
      if (remaining === 0) {
        popup.remove();
        ui.notifications.info('All challenges cleared');
      } else {
        ui.notifications.info('Challenge cleared');
      }
    });
  });

  // Clear all challenges
  clearAllBtn.addEventListener('click', async () => {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: 'Clear All Challenges' },
      content: '<p>Clear all active challenges?</p>',
      yes: { label: 'Clear All' },
      no: { label: 'Cancel' },
      rejectClose: false,
    });

    if (!confirmed) return;

    await game.storyframe.socketManager.requestClearAllChallenges();
    popup.remove();
    ui.notifications.info('All challenges cleared');
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
export async function onShowProficiencyFilter(_event, target, skillSlug, sidebar) {
  ui.notifications.info('Proficiency filtering not implemented in base class');
}

/**
 * Show check DCs popup for a skill
 */
export async function onShowCheckDCsPopup(_event, target, sidebar) {
  const skillName = target.dataset.skill;

  // Find all checks for this skill from context
  const context = await sidebar._prepareContext();
  const skillGroup = context.journalCheckGroups.find((g) => g.skillName === skillName);

  if (!skillGroup?.checks?.length) return;

  // Shift+click: add all checks for this skill to batch
  if (_event.shiftKey) {
    if (sidebar.selectedParticipants.size === 0) {
      ui.notifications.warn('Select PCs first to use batch selection');
      return;
    }

    const skillSlug = SystemAdapter.getSkillSlugFromName(skillName) || skillName.toLowerCase();

    // Add all checks for this skill to batch
    skillGroup.checks.forEach((check) => {
      const checkId = `journal:${skillSlug}:${check.dc}`;

      // Check if already in batch
      const existingIndex = sidebar.batchedChecks.findIndex(c => c.checkId === checkId);

      if (existingIndex === -1) {
        // Add to batch if not already there
        sidebar.batchedChecks.push({
          skill: skillSlug,
          dc: check.dc,
          isSecret: check.isSecret || false,
          actionSlug: null,
          checkId,
        });
      }
    });

    // Update batch highlights
    SkillCheckHandlers.updateBatchHighlights(sidebar);
    return;
  }

  // Get visible DCs for this skill
  const normalizedSkill = skillName.toLowerCase();
  const visibleDCs = sidebar._visibleChecks?.get(normalizedSkill) || new Set();

  // Create popup menu
  const menu = document.createElement('div');
  menu.className = 'storyframe-dc-popup';

  menu.innerHTML = `
    <div class="dc-popup-header">${skillName}</div>
    <div class="dc-popup-items">
      ${skillGroup.checks.map((check, idx) => {
    const isVisible = visibleDCs.has(String(check.dc));
    const secretIcon = check.isSecret ? '<i class="fas fa-eye-slash" style="font-size: 0.7em; opacity: 0.7; margin-left: 4px;"></i>' : '';
    return `
        <button type="button"
                class="dc-option ${isVisible ? 'in-view' : ''}"
                data-dc="${check.dc}"
                data-check-index="${idx}"
                data-skill="${check.skillName}"
                data-is-secret="${check.isSecret || false}"
                data-tooltip="${check.label}${check.isSecret ? ' (Secret)' : ''}">
          ${check.dc}${secretIcon}
        </button>
      `;
  }).join('')}
    </div>
  `;

  // Position above button (CSS handles all styling)
  const rect = target.getBoundingClientRect();
  document.body.appendChild(menu);

  menu.style.bottom = `${window.innerHeight - rect.top + 4}px`;
  menu.style.left = `${rect.left}px`;

  // Attach click handlers to DC buttons with shift-click for global batch
  menu.querySelectorAll('.dc-option').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const dc = parseInt(btn.dataset.dc);
      const skill = btn.dataset.skill;
      const isSecret = btn.dataset.isSecret === 'true';

      // Shift-click: add to global batch
      if (e.shiftKey) {
        const skillSlug = SystemAdapter.getSkillSlugFromName(skill) || skill.toLowerCase();
        const checkId = `journal:${skillSlug}:${dc}`;

        // Check if already in global batch
        const existingIndex = sidebar.batchedChecks.findIndex(c => c.checkId === checkId);

        if (existingIndex !== -1) {
          // Remove from global batch
          sidebar.batchedChecks.splice(existingIndex, 1);
          btn.classList.remove('selected');
        } else {
          // Add to global batch
          sidebar.batchedChecks.push({
            skill: skillSlug,
            dc,
            isSecret,
            actionSlug: null,
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

      // Set DC and request check
      sidebar.currentDC = dc;
      const dcInput = sidebar.element.querySelector('#dc-input');
      if (dcInput) dcInput.value = dc;

      // Set secret toggle if this is a secret check
      sidebar.secretRollEnabled = isSecret;
      const secretToggle = sidebar.element.querySelector('#secret-roll-toggle');
      if (secretToggle) secretToggle.checked = isSecret;

      if (sidebar.selectedParticipants.size > 0) {
        const skillSlug = SystemAdapter.getSkillSlugFromName(skill) || skill.toLowerCase();
        if (skillSlug) {
          await SkillCheckHandlers.requestSkillCheck(sidebar, skillSlug, Array.from(sidebar.selectedParticipants));
        }
      } else {
        ui.notifications.warn('Select PCs first');
      }
    });

    // Mark as selected if already in global batch
    const skillSlug = SystemAdapter.getSkillSlugFromName(btn.dataset.skill) || btn.dataset.skill.toLowerCase();
    const dc = parseInt(btn.dataset.dc);
    const checkId = `journal:${skillSlug}:${dc}`;
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
  const dc = parseInt(target.dataset.dc);
  const skillName = target.dataset.skill;

  if (isNaN(dc)) return;

  // Set the DC
  sidebar.currentDC = dc;
  const dcInput = sidebar.element.querySelector('#dc-input');
  if (dcInput) dcInput.value = dc;

  // If PCs are selected and we have a skill, request the roll
  if (sidebar.selectedParticipants.size > 0 && skillName) {
    // Map skill name to slug using SystemAdapter
    const skillSlug = SystemAdapter.getSkillSlugFromName(skillName) || skillName.toLowerCase();

    if (skillSlug) {
      await SkillCheckHandlers.requestSkillCheck(sidebar, skillSlug, Array.from(sidebar.selectedParticipants));
    } else {
      ui.notifications.warn(`Unknown skill: ${skillName}`);
    }
  } else if (sidebar.selectedParticipants.size === 0) {
    ui.notifications.warn('Select PCs first to request a roll');
  } else {
    ui.notifications.info(`Set DC to ${dc}`);
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
    ui.notifications.info(`No specific actions for ${SkillCheckHandlers.getSkillName(skillSlug)}`);
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
    btn.addEventListener('click', async (e) => {
      const actionSlug = btn.dataset.actionSlug;
      const actionSkill = btn.dataset.skill;

      // Shift-click: add to global batch
      if (e.shiftKey) {
        if (sidebar.selectedParticipants.size === 0) {
          ui.notifications.warn('Select PCs first to use batch selection');
          return;
        }

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
            dc: null,
            isSecret: false,
            actionSlug,
            checkId,
          });
          btn.classList.add('selected');
        }

        // Update batch highlights in sidebar
        SkillCheckHandlers.updateBatchHighlights(sidebar);
        return;
      }

      // Normal click: send immediately
      menu.remove();

      if (sidebar.selectedParticipants.size === 0) {
        ui.notifications.warn('No PCs selected');
        return;
      }

      // Request skill check with action context
      await SkillCheckHandlers.requestSkillCheck(
        sidebar,
        actionSkill,
        Array.from(sidebar.selectedParticipants),
        actionSlug,
      );
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
    if (!grouped[roll.participantId]) {
      grouped[roll.participantId] = {
        id: roll.participantId,
        name: roll.participantName,
        img: roll.participantImg || 'icons/svg/mystery-man.svg',
        rolls: [],
      };
    }
    grouped[roll.participantId].rolls.push(roll);
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
            <div class="pending-roll-item" data-request-id="${roll.id}">
              <div class="roll-info">
                <span class="skill-name">${roll.skillName}${roll.actionName ? ` (${roll.actionName})` : ''}</span>
                ${roll.dc ? `<span class="dc-badge">DC ${roll.dc}</span>` : ''}
              </div>
              <button type="button" class="cancel-roll-btn" data-request-id="${roll.id}">
                <i class="fas fa-times"></i>
              </button>
            </div>
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
            <div class="pending-roll-item" data-request-id="${roll.id}">
              <div class="roll-info">
                <img src="${roll.participantImg || 'icons/svg/mystery-man.svg'}" alt="${roll.participantName}" class="participant-avatar-small" />
                <span class="participant-name">${roll.participantName}</span>
                ${roll.dc ? `<span class="dc-badge">DC ${roll.dc}</span>` : ''}
              </div>
              <button type="button" class="cancel-roll-btn" data-request-id="${roll.id}">
                <i class="fas fa-times"></i>
              </button>
            </div>
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
    ui.notifications.info('No saved scenes');
    return;
  }

  // Remove existing popup if any
  document.querySelector('.storyframe-scenes-popup')?.remove();

  // Create popup
  const popup = document.createElement('div');
  popup.className = 'storyframe-scenes-popup';

  const scenesHtml = scenes
    .map(
      (scene) => `
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
          <button type="button" class="edit-scene-btn" data-scene-id="${scene.id}" aria-label="Edit ${scene.name}">
            <i class="fas fa-pencil-alt"></i>
          </button>
          <button type="button" class="delete-scene-btn" data-scene-id="${scene.id}" aria-label="Delete ${scene.name}">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    </div>
  `,
    )
    .join('');

  popup.innerHTML = `
    <div class="popup-header">
      <span class="popup-title">Saved Scenes (${scenes.length})</span>
      <button type="button" class="popup-close" aria-label="Close">
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

  // Delete individual scene
  popup.querySelectorAll('.delete-scene-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const sceneId = btn.dataset.sceneId;
      const scene = scenes.find(s => s.id === sceneId);

      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: 'Delete Scene' },
        content: `<p>Delete scene "${scene.name}"?</p>`,
        yes: { label: 'Delete' },
        no: { label: 'Cancel', default: true },
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
      title.textContent = `Saved Scenes (${remaining})`;

      // Close popup if no more scenes
      if (remaining === 0) {
        popup.remove();
      }

      // Re-render sidebar to hide manage button if needed
      sidebar.render();

      ui.notifications.info(`Deleted scene "${scene.name}"`);
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
