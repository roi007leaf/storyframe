/**
 * UI Helper Handler for GM Sidebar
 * Handles positioning, popups, scroll management, and other UI utilities
 */

import { extractParentElement } from '../../../utils/element-utils.mjs';
import * as SystemAdapter from '../../../system-adapter.mjs';

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
        skillName: sidebar._getSkillName(r.skillSlug),
        actionName: r.actionSlug ? sidebar._getActionName(r.skillSlug, r.actionSlug) : null,
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

  // Style the popup (see original implementation for full styling)
  popup.style.cssText = `
    position: fixed;
    z-index: 10001;
    background: #1a1a2e;
    border: 1px solid #3d3d5c;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    width: 320px;
    max-height: 400px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `;

  // Position to bottom-left of the button
  const rect = target.getBoundingClientRect();
  popup.style.top = `${rect.bottom + 8}px`;
  popup.style.left = `${rect.left}px`;

  // Style header, body, items (see original for full styling)
  const header = popup.querySelector('.popup-header');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: rgba(0,0,0,0.3);
    border-bottom: 1px solid rgba(255,255,255,0.1);
  `;

  const title = popup.querySelector('.popup-title');
  title.style.cssText = `
    font-size: 13px;
    font-weight: 700;
    color: #ffffff;
  `;

  const headerActions = popup.querySelector('.popup-header-actions');
  headerActions.style.cssText = `
    display: flex;
    gap: 8px;
    align-items: center;
  `;

  // Style group toggle button
  const toggleBtn = popup.querySelector('.group-toggle-btn');
  toggleBtn.style.cssText = `
    background: rgba(94, 129, 172, 0.2);
    border: 1px solid rgba(94, 129, 172, 0.4);
    color: #ffffff;
    padding: 4px 10px;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    transition: all 0.15s;
  `;

  toggleBtn.addEventListener('mouseenter', () => {
    toggleBtn.style.background = 'rgba(94, 129, 172, 0.3)';
  });
  toggleBtn.addEventListener('mouseleave', () => {
    toggleBtn.style.background = 'rgba(94, 129, 172, 0.2)';
  });

  // Toggle handler
  toggleBtn.addEventListener('click', () => {
    sidebar.pendingRollsGroupMode = sidebar.pendingRollsGroupMode === 'actor' ? 'skill' : 'actor';
    onShowPendingRolls(_event, target, sidebar);
  });

  const closeBtn = popup.querySelector('.popup-close');
  closeBtn.style.cssText = `
    background: transparent;
    border: none;
    color: #888;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    transition: all 0.15s;
  `;

  // Style body
  const body = popup.querySelector('.popup-body');
  body.style.cssText = `
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  `;

  // Style roll groups and items (truncated - see original for full implementation)

  // Style footer
  const footer = popup.querySelector('.popup-footer');
  footer.style.cssText = `
    padding: 12px 16px;
    border-top: 1px solid rgba(255,255,255,0.1);
    display: flex;
    justify-content: flex-end;
  `;

  const cancelAllBtn = popup.querySelector('.cancel-all-btn');
  cancelAllBtn.style.cssText = `
    background: rgba(255,100,100,0.2);
    border: 1px solid rgba(255,100,100,0.3);
    color: #ff6b6b;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  `;

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

  // Get visible DCs for this skill
  const normalizedSkill = skillName.toLowerCase();
  const visibleDCs = sidebar._visibleChecks?.get(normalizedSkill) || new Set();

  // Create popup menu (see original for full implementation)
  const menu = document.createElement('div');
  menu.className = 'storyframe-dc-popup';

  menu.innerHTML = `
    <div class="dc-popup-header">${skillName}</div>
    <div class="dc-popup-items">
      ${skillGroup.checks.map((check) => {
    const isVisible = visibleDCs.has(String(check.dc));
    const secretIcon = check.isSecret ? '<i class="fas fa-eye-slash" style="font-size: 0.7em; opacity: 0.7; margin-left: 4px;"></i>' : '';
    return `
        <button type="button"
                class="dc-option ${isVisible ? 'in-view' : ''}"
                data-dc="${check.dc}"
                data-skill="${check.skillName}"
                data-is-secret="${check.isSecret || false}"
                data-tooltip="${check.label}${check.isSecret ? ' (Secret)' : ''}">
          ${check.dc}${secretIcon}
        </button>
      `;
  }).join('')}
    </div>
  `;

  // Position above button
  const rect = target.getBoundingClientRect();
  document.body.appendChild(menu);

  menu.style.cssText = `
    position: fixed;
    bottom: ${window.innerHeight - rect.top + 4}px;
    left: ${rect.left}px;
    z-index: 10000;
    background: #1a1a2e;
    border: 1px solid #3d3d5c;
    border-radius: 8px;
    padding: 0;
    min-width: 100px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  `;

  // Style buttons and attach handlers (see original for full implementation)
  menu.querySelectorAll('.dc-option').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const dc = parseInt(btn.dataset.dc);
      const skill = btn.dataset.skill;
      const isSecret = btn.dataset.isSecret === 'true';
      menu.remove();

      // Set DC and request check
      sidebar.currentDC = dc;
      const dcInput = sidebar.element.querySelector('#dc-input');
      if (dcInput) dcInput.value = dc;

      // Set secret toggle if this is a secret check
      sidebar.secretRollEnabled = isSecret;
      sidebar.render();

      if (sidebar.selectedParticipants.size > 0) {
        const skillSlug = SystemAdapter.getSkillSlugFromName(skill) || skill.toLowerCase();
        if (skillSlug) {
          await sidebar._requestSkillCheck(skillSlug, Array.from(sidebar.selectedParticipants));
        }
      } else {
        ui.notifications.warn('Select PCs first');
      }
    });
  });

  // Close on click outside
  const closeHandler = (e) => {
    if (!menu.contains(e.target)) {
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
      await sidebar._requestSkillCheck(skillSlug, Array.from(sidebar.selectedParticipants));
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
    ui.notifications.info(`No specific actions for ${sidebar._getSkillName(skillSlug)}`);
    return;
  }

  const skillName = sidebar._getSkillName(skillSlug);

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

  // Position near the click
  const rect = event.target.getBoundingClientRect();
  menu.style.cssText = `
    position: fixed;
    top: ${rect.bottom + 4}px;
    left: ${rect.left}px;
    z-index: 10000;
    background: #1a1a2e;
    border: 1px solid #3d3d5c;
    border-radius: 8px;
    padding: 0;
    min-width: 160px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    overflow: hidden;
  `;

  // Add handlers (see original for full implementation)
  menu.querySelectorAll('.action-option').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const actionSlug = btn.dataset.actionSlug;
      const actionSkill = btn.dataset.skill;
      menu.remove();

      if (sidebar.selectedParticipants.size === 0) {
        ui.notifications.warn('No PCs selected');
        return;
      }

      // Request skill check with action context
      await sidebar._requestSkillCheck(
        actionSkill,
        Array.from(sidebar.selectedParticipants),
        actionSlug,
      );
    });
  });

  // Close on click outside
  const closeHandler = (e) => {
    if (!menu.contains(e.target)) {
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
