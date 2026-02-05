/**
 * Skill Check Handler for GM Sidebar
 * Handles skill check requests, batch processing, skill menus, and proficiency checks
 */

import * as SystemAdapter from '../../../system-adapter.mjs';
import { MODULE_ID } from '../../../constants.mjs';
import * as ParticipantHandlers from './participant-handlers.mjs';

/**
 * Request a skill check (single skill button click)
 */
export async function onRequestSkill(_event, target, sidebar) {
  const skillSlug = target.dataset.skill;
  if (!skillSlug) return;

  // Shift+click adds to batch selection
  if (_event.shiftKey) {
    // Require PC selection for batch mode
    if (sidebar.selectedParticipants.size === 0) {
      ui.notifications.warn(game.i18n.localize('STORYFRAME.Notifications.SkillCheck.SelectPCsForBatch'));
      return;
    }

    sidebar._shiftKeyDown = true;

    // Create check ID for this skill (without DC/action)
    const checkId = `skill:${skillSlug}`;

    // Check if already batched
    const existingIndex = sidebar.batchedChecks.findIndex(c => c.checkId === checkId);

    if (existingIndex !== -1) {
      // Remove from batch if already selected
      sidebar.batchedChecks.splice(existingIndex, 1);
    } else {
      // Add to batch (no DC or action specified)
      sidebar.batchedChecks.push({
        skill: skillSlug,
        dc: null,
        isSecret: false,
        actionSlug: null,
        checkId,
      });
    }

    // Update visual highlighting
    updateBatchHighlights(sidebar);
    return;
  }

  // Normal click: send single skill
  if (sidebar.selectedParticipants.size === 0) {
    ui.notifications.warn(game.i18n.localize('STORYFRAME.Notifications.SkillCheck.NoPCsSelected'));
    return;
  }
  await requestSkillCheck(sidebar, skillSlug, Array.from(sidebar.selectedParticipants));
}

/**
 * Send batch skill check request
 */
export async function onSendBatch(_event, _target, sidebar) {
  if (sidebar.batchedChecks.length === 0) return;

  if (sidebar.selectedParticipants.size === 0) {
    ui.notifications.warn(game.i18n.localize('STORYFRAME.Notifications.SkillCheck.NoPCsSelected'));
    return;
  }

  await sendBatchSkillCheck(sidebar);
}

/**
 * Core skill check request logic
 */
export async function requestSkillCheck(sidebar, skillSlug, participantIds, actionSlug = null, suppressNotifications = false) {
  const state = game.storyframe.stateManager.getState();
  if (!state) return { sentCount: 0, offlineCount: 0, missingSkillCount: 0, sentIds: new Set(), offlineIds: new Set(), missingIds: new Set(), offlineNames: new Set(), missingNames: new Set() };

  // Check if secret roll is enabled (toggle button or action with secret trait)
  let isSecretRoll = sidebar.secretRollEnabled || false;

  // Auto-detect actions with secret trait in PF2e
  if (!isSecretRoll && actionSlug && game.pf2e) {
    isSecretRoll = await actionHasSecretTrait(actionSlug);
  }

  let sentCount = 0;
  let offlineCount = 0;
  let missingSkillCount = 0;
  const sentIds = new Set();
  const offlineIds = new Set();
  const missingIds = new Set();
  const offlineNames = new Set();
  const missingNames = new Set();

  for (const participantId of participantIds) {
    const participant = state.participants.find((p) => p.id === participantId);
    if (!participant) continue;

    // Validate that the participant has this skill
    const actor = await fromUuid(participant.actorUuid);

    if (actor) {
      const hasSkill = await actorHasSkill(sidebar, actor, skillSlug);
      if (!hasSkill) {
        missingSkillCount++;
        missingIds.add(participantId);
        missingNames.add(actor.name);
        continue;
      }
    }

    const user = game.users.find(u => u.active && !u.isGM && actor?.testUserPermission?.(u, 'OWNER'));

    if (!user) {
      offlineCount++;
      offlineIds.add(participantId);
      if (actor) {
        offlineNames.add(actor.name);
      }
      continue;
    }

    const requestId = foundry.utils.randomID();
    const request = {
      id: requestId,
      participantId: participant.id,
      actorUuid: participant.actorUuid,
      userId: participant.userId,
      skillSlug,
      actionSlug,
      dc: sidebar.currentDC,
      isSecretRoll,
      timestamp: Date.now(),
    };

    await game.storyframe.socketManager.requestAddPendingRoll(request);
    await game.storyframe.socketManager.triggerSkillCheckOnPlayer(participant.userId, request);
    sentCount++;
    sentIds.add(participantId);
  }

  const skillName = getSkillName(skillSlug);
  const actionName = actionSlug ? getActionName(skillSlug, actionSlug) : null;
  const checkName = actionName ? `${skillName} (${actionName})` : skillName;

  if (!suppressNotifications) {
    if (sentCount > 0) {
      ui.notifications.info(game.i18n.format('STORYFRAME.Notifications.SkillCheck.CheckRequested', { checkName, count: sentCount }));
    }
    if (offlineCount > 0) {
      const names = Array.from(offlineNames).join(', ');
      ui.notifications.warn(game.i18n.format('STORYFRAME.Notifications.SkillCheck.PlayersOffline', { names }));
    }
    if (missingSkillCount > 0) {
      const names = Array.from(missingNames).join(', ');
      ui.notifications.warn(game.i18n.format('STORYFRAME.Notifications.SkillCheck.PlayersLackSkill', { names, skillName }));
    }

    // Clear selection after sending rolls
    clearParticipantSelection(sidebar);
  }

  return { sentCount, offlineCount, missingSkillCount, sentIds, offlineIds, missingIds, offlineNames, missingNames };
}

/**
 * Send batch skill check request
 */
export async function sendBatchSkillCheck(sidebar) {
  if (sidebar.selectedParticipants.size === 0) {
    ui.notifications.warn(game.i18n.localize('STORYFRAME.Notifications.SkillCheck.NoPCsSelected'));
    return;
  }

  if (sidebar.batchedChecks.length === 0) {
    return;
  }

  const participantIds = Array.from(sidebar.selectedParticipants);

  // Track unique participant IDs and names across all checks
  const uniqueSentIds = new Set();
  const uniqueOfflineIds = new Set();
  const uniqueMissingIds = new Set();
  const uniqueOfflineNames = new Set();
  const participantMissingSkills = new Map(); // participantName -> Set of skill names

  // Get system skills for name lookup
  const systemSkills = SystemAdapter.getSkills();

  // Save count before clearing
  const checkCount = sidebar.batchedChecks.length;

  // Send request for each batched check (suppress individual notifications)
  for (const check of sidebar.batchedChecks) {
    // Set DC if specified
    const previousDC = sidebar.currentDC;
    const previousSecret = sidebar.secretRollEnabled;

    if (check.dc !== null) {
      sidebar.currentDC = check.dc;
    }
    if (check.isSecret) {
      sidebar.secretRollEnabled = true;
    }

    const result = await requestSkillCheck(sidebar, check.skill, participantIds, check.actionSlug, true);

    // Restore previous DC/secret state
    sidebar.currentDC = previousDC;
    sidebar.secretRollEnabled = previousSecret;

    // Add unique participant IDs and names to sets
    result.sentIds.forEach(id => uniqueSentIds.add(id));
    result.offlineIds.forEach(id => uniqueOfflineIds.add(id));
    result.missingIds.forEach(id => uniqueMissingIds.add(id));
    result.offlineNames.forEach(name => uniqueOfflineNames.add(name));

    // Track which skills each participant is missing
    result.missingNames.forEach(name => {
      if (!participantMissingSkills.has(name)) {
        participantMissingSkills.set(name, new Set());
      }
      const skillName = systemSkills[check.skill]?.name || check.skill;
      participantMissingSkills.get(name).add(skillName);
    });
  }

  // Clear batch selection
  sidebar.batchedChecks = [];
  updateBatchHighlights(sidebar);

  // Clear participant selection
  clearParticipantSelection(sidebar);

  // Show single aggregated notification with unique participant names
  if (uniqueSentIds.size > 0) {
    ui.notifications.info(game.i18n.format('STORYFRAME.Notifications.SkillCheck.MultipleChecksRequested', { checkCount, uniqueCount: uniqueSentIds.size }), { permanent: false });
  }
  if (uniqueOfflineNames.size > 0) {
    const names = Array.from(uniqueOfflineNames).join(', ');
    const notification = ui.notifications.warn(game.i18n.format('STORYFRAME.Notifications.SkillCheck.PlayersOffline', { names }), { permanent: true });
    setTimeout(() => notification.remove(), 15000); // Show for 15 seconds
  }
  if (participantMissingSkills.size > 0) {
    // Build message showing each participant and their missing skills
    const messages = Array.from(participantMissingSkills.entries()).map(([name, skills]) => {
      const skillList = Array.from(skills).join(', ');
      return game.i18n.format('STORYFRAME.Notifications.SkillCheck.PlayerMissingSkills', { name, skillList });
    });
    const notification = ui.notifications.warn(game.i18n.format('STORYFRAME.Notifications.SkillCheck.SkippedMissingSkills', { details: messages.join('; ') }), { permanent: true });
    setTimeout(() => notification.remove(), 15000); // Show for 15 seconds
  }
}

/**
 * Update visual highlights for batched skills
 */
export function updateBatchHighlights(sidebar) {
  // Remove all existing batch highlights from regular skills
  sidebar.element.querySelectorAll('.skill-btn-wrapper.batched').forEach(wrapper => {
    wrapper.classList.remove('batched');
  });

  // Remove all existing batch highlights from lore skills
  sidebar.element.querySelectorAll('.lore-skill-wrapper.batched').forEach(wrapper => {
    wrapper.classList.remove('batched');
  });

  // Remove all existing batch highlights from journal checks
  sidebar.element.querySelectorAll('.journal-check-wrapper.batched').forEach(wrapper => {
    wrapper.classList.remove('batched');
  });

  // Collect skills by source type
  const batchedRegularSkills = new Set();
  const batchedLoreSkills = new Set();
  const batchedJournalSkills = new Set();
  const batchedActionSkills = new Set();

  sidebar.batchedChecks.forEach(check => {
    // Determine source type from checkId
    if (check.checkId.startsWith('journal:')) {
      batchedJournalSkills.add(check.skill);
    } else if (check.checkId.startsWith('action:')) {
      batchedActionSkills.add(check.skill);
    } else if (check.checkId.startsWith('skill:')) {
      // Regular skills and lore skills both use "skill:" prefix
      // Lore skills have different slugs (e.g., "cooking-lore")
      if (check.skill.includes('-lore')) {
        batchedLoreSkills.add(check.skill);
      } else {
        batchedRegularSkills.add(check.skill);
      }
    }
  });

  // Highlight regular skill buttons
  batchedRegularSkills.forEach(skillSlug => {
    const wrapper = sidebar.element.querySelector(`.skill-btn[data-skill="${skillSlug}"]`)?.closest('.skill-btn-wrapper');
    if (wrapper) {
      wrapper.classList.add('batched');
    }
  });

  // Highlight lore skill buttons
  batchedLoreSkills.forEach(skillSlug => {
    const wrapper = sidebar.element.querySelector(`.skill-btn.lore[data-skill="${skillSlug}"]`)?.closest('.lore-skill-wrapper');
    if (wrapper) {
      wrapper.classList.add('batched');
    }
  });

  // Highlight journal check buttons
  const skills = SystemAdapter.getSkills();
  batchedJournalSkills.forEach(skillSlug => {
    let skillName = skills[skillSlug]?.name;

    // If not found in system skills, it might be a lore skill or custom skill
    // Capitalize the slug for matching (e.g., "cooking lore" -> "Cooking Lore")
    if (!skillName) {
      skillName = skillSlug.split(' ').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
    }

    const wrapper = sidebar.element.querySelector(`.journal-skill-btn[data-skill="${skillName}"]`)?.closest('.journal-check-wrapper');
    if (wrapper) {
      wrapper.classList.add('batched');
    }
  });

  // Highlight skill action buttons (same as regular for now)
  batchedActionSkills.forEach(skillSlug => {
    const wrapper = sidebar.element.querySelector(`.skill-btn[data-skill="${skillSlug}"]`)?.closest('.skill-btn-wrapper');
    if (wrapper) {
      wrapper.classList.add('batched');
    }
  });

  // Update send batch button visibility and count
  const sendBatchBtn = sidebar.element.querySelector('.send-batch-btn');
  if (sendBatchBtn) {
    const batchCount = sidebar.batchedChecks.length;
    const countSpan = sendBatchBtn.querySelector('.batch-count');

    if (batchCount > 0) {
      sendBatchBtn.style.display = '';
      if (countSpan) {
        countSpan.textContent = batchCount;
      }
    } else {
      sendBatchBtn.style.display = 'none';
    }
  }
}

/**
 * Open skill menu for all available skills
 */
export async function onOpenSkillMenu(_event, target, sidebar) {
  // Get system-specific skills
  const systemSkills = SystemAdapter.getSkills();
  const allSkills = Object.entries(systemSkills).map(([slug, skill]) => ({
    slug,
    name: skill.name,
    isLore: false,
  }));

  // Add lore skills from participants
  const state = game.storyframe.stateManager.getState();
  const participantLores = await sidebar.constructor._getLoreSkills(state, sidebar.selectedParticipants);
  allSkills.push(...participantLores);

  // Remove any existing skill menu
  document.querySelector('.storyframe-skill-menu')?.remove();

  // Create popup menu
  const menu = document.createElement('div');
  menu.className = 'storyframe-skill-menu';

  const regularSkills = allSkills.filter((s) => !s.isLore);
  const loreSkills = allSkills.filter((s) => s.isLore);

  let menuHTML = regularSkills
    .map(
      (s) =>
        `<button type="button" class="skill-option" data-skill="${s.slug}">${s.name}</button>`,
    )
    .join('');

  if (loreSkills.length > 0) {
    menuHTML += '<div class="skill-divider"></div>';
    menuHTML += loreSkills
      .map(
        (s) =>
          `<button type="button" class="skill-option lore" data-skill="${s.slug}" data-is-lore="true"><i class="fas fa-book"></i> ${s.name}</button>`,
      )
      .join('');
  }

  menu.innerHTML = menuHTML;

  // Position near the button
  const rect = target.getBoundingClientRect();
  menu.style.cssText = `
    position: fixed;
    top: ${rect.top}px;
    left: ${rect.right + 8}px;
    z-index: 10000;
    background: #1a1a2e;
    border: 1px solid #3d3d5c;
    border-radius: 8px;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 320px;
    overflow-y: auto;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  `;

  // Style divider
  const divider = menu.querySelector('.skill-divider');
  if (divider) {
    divider.style.cssText = `
      height: 1px;
      background: rgba(255, 255, 255, 0.1);
      margin: 4px 8px;
    `;
  }

  // Add click handlers
  menu.querySelectorAll('.skill-option').forEach((btn) => {
    const isLore = btn.classList.contains('lore');
    btn.style.cssText = `
      padding: 8px 14px;
      background: transparent;
      border: none;
      color: ${isLore ? '#aaa' : '#e0e0e0'};
      cursor: pointer;
      text-align: left;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      transition: background 0.15s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'rgba(94, 129, 172, 0.3)';
      btn.style.color = '#ffffff';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'transparent';
      btn.style.color = '#e0e0e0';
    });
    btn.addEventListener('click', async () => {
      const skillSlug = btn.dataset.skill;
      menu.remove();

      if (sidebar.selectedParticipants.size === 0) {
        ui.notifications.warn(game.i18n.localize('STORYFRAME.Notifications.SkillCheck.NoPCsSelected'));
        return;
      }

      // For lore skills, pass the slug as-is (it's the lore name slugified)
      await requestSkillCheck(sidebar, skillSlug, Array.from(sidebar.selectedParticipants));
    });
  });

  // Close on click outside
  const closeHandler = (e) => {
    if (!menu.contains(e.target) && e.target !== target) {
      menu.remove();
      document.removeEventListener('click', closeHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 10);

  document.body.appendChild(menu);

  // Adjust position if off-screen
  const menuRect = menu.getBoundingClientRect();
  if (menuRect.right > window.innerWidth) {
    menu.style.left = `${rect.left - menuRect.width - 5}px`;
  }
  if (menuRect.bottom > window.innerHeight) {
    menu.style.top = `${window.innerHeight - menuRect.height - 10}px`;
  }
}

/**
 * Open skill configuration panel
 */
export async function onOpenSkillConfig(_event, target, sidebar) {
  // Get system-specific skills
  const systemSkills = SystemAdapter.getSkills();
  const allSkills = Object.entries(systemSkills).map(([slug, skill]) => ({
    slug,
    name: skill.name,
  }));

  // Get current selected skills
  const currentSetting = game.settings.get(MODULE_ID, 'quickButtonSkills');
  const selectedSlugs = new Set(
    currentSetting
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

  // Remove any existing config panel
  document.querySelector('.storyframe-skill-config')?.remove();

  // Create config panel
  const panel = document.createElement('div');
  panel.className = 'storyframe-skill-config';

  const checkboxesHtml = allSkills
    .map(
      (s) => `
    <label class="skill-checkbox-item" data-slug="${s.slug}">
      <input type="checkbox" value="${s.slug}" ${selectedSlugs.has(s.slug) ? 'checked' : ''}>
      <span class="skill-label">${s.name}</span>
    </label>
  `,
    )
    .join('');

  panel.innerHTML = `
    <div class="config-header">
      <span class="config-title">Quick Skill Buttons</span>
      <button type="button" class="config-close" aria-label="Close">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="config-body">
      <p class="config-hint">Select skills to show as quick buttons</p>
      <div class="skill-checkboxes">${checkboxesHtml}</div>
    </div>
  `;

  // Style the panel (truncated for brevity - see original implementation)
  panel.style.cssText = `
    position: fixed;
    z-index: 10001;
    background: #1a1a2e;
    border: 1px solid #3d3d5c;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    width: 280px;
    max-height: 420px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `;

  // Position near the button
  const rect = target.getBoundingClientRect();
  panel.style.top = `${rect.top}px`;
  panel.style.left = `${rect.right + 8}px`;

  // Style header, body, checkboxes, etc. (see original implementation for full styling)
  const header = panel.querySelector('.config-header');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: rgba(0,0,0,0.3);
    border-bottom: 1px solid rgba(255,255,255,0.1);
  `;

  const title = panel.querySelector('.config-title');
  title.style.cssText = `
    font-size: 13px;
    font-weight: 700;
    color: #ffffff;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  `;

  const closeBtn = panel.querySelector('.config-close');
  closeBtn.style.cssText = `
    background: transparent;
    border: none;
    color: #888;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    transition: all 0.15s;
  `;
  closeBtn.addEventListener('mouseenter', () => {
    closeBtn.style.background = 'rgba(255,255,255,0.1)';
    closeBtn.style.color = '#fff';
  });
  closeBtn.addEventListener('mouseleave', () => {
    closeBtn.style.background = 'transparent';
    closeBtn.style.color = '#888';
  });

  // Style body
  const body = panel.querySelector('.config-body');
  body.style.cssText = `
    flex: 1;
    padding: 12px 16px;
    overflow-y: auto;
  `;

  const hint = panel.querySelector('.config-hint');
  hint.style.cssText = `
    font-size: 11px;
    color: #888;
    margin: 0 0 12px 0;
  `;

  // Style checkboxes container
  const checkboxes = panel.querySelector('.skill-checkboxes');
  checkboxes.style.cssText = `
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  `;

  // Style checkbox items
  panel.querySelectorAll('.skill-checkbox-item').forEach((item) => {
    item.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      background: rgba(0,0,0,0.2);
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s;
      border: 1px solid transparent;
    `;

    const checkbox = item.querySelector('input');
    checkbox.style.cssText = `
      width: 16px;
      height: 16px;
      accent-color: #5e81ac;
      cursor: pointer;
      margin: 0;
    `;

    const label = item.querySelector('.skill-label');
    label.style.cssText = `
      font-size: 12px;
      color: #e0e0e0;
      font-weight: 500;
    `;

    // Update styling based on checked state
    const updateItemStyle = () => {
      if (checkbox.checked) {
        item.style.background = 'rgba(94, 129, 172, 0.2)';
        item.style.borderColor = 'rgba(94, 129, 172, 0.4)';
        label.style.color = '#ffffff';
      } else {
        item.style.background = 'rgba(0,0,0,0.2)';
        item.style.borderColor = 'transparent';
        label.style.color = '#e0e0e0';
      }
    };
    updateItemStyle();

    item.addEventListener('mouseenter', () => {
      if (!checkbox.checked) {
        item.style.background = 'rgba(255,255,255,0.05)';
      }
    });
    item.addEventListener('mouseleave', () => {
      updateItemStyle();
    });

    // Handle checkbox change
    checkbox.addEventListener('change', async () => {
      updateItemStyle();

      // Update setting
      const selected = [];
      panel.querySelectorAll('.skill-checkbox-item input:checked').forEach((cb) => {
        selected.push(cb.value);
      });

      // Maintain order from allSkills
      const orderedSelected = allSkills
        .filter((s) => selected.includes(s.slug))
        .map((s) => s.slug);

      await game.settings.set(MODULE_ID, 'quickButtonSkills', orderedSelected.join(','));
    });
  });

  // Close button handler
  closeBtn.addEventListener('click', () => panel.remove());

  // Close on click outside
  const closeHandler = (e) => {
    if (!panel.contains(e.target) && e.target !== target) {
      panel.remove();
      document.removeEventListener('click', closeHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 10);

  document.body.appendChild(panel);

  // Adjust position if off-screen
  const panelRect = panel.getBoundingClientRect();
  if (panelRect.right > window.innerWidth) {
    panel.style.left = `${rect.left - panelRect.width - 8}px`;
  }
  if (panelRect.bottom > window.innerHeight) {
    panel.style.top = `${window.innerHeight - panelRect.height - 10}px`;
  }
}

// --- Helper Functions ---

/**
 * Get skill name from slug
 */
export function getSkillName(slug) {
  const skills = SystemAdapter.getSkills();
  const skill = skills[slug];
  if (skill?.name) return skill.name;

  // Handle lore skills - slug is like "cooking-lore" or "warfare-lore"
  if (slug.includes('-lore')) {
    return slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }

  return slug.toUpperCase();
}

/**
 * Get skill short name from slug
 */
export function getSkillShortName(slug) {
  return SystemAdapter.getSkillShortName(slug);
}

/**
 * Get skill icon from slug
 */
export function getSkillIcon(slug) {
  const iconMap = {
    // PF2e skills
    per: 'fa-eye',
    acr: 'fa-person-running',
    arc: 'fa-wand-sparkles',
    ath: 'fa-dumbbell',
    cra: 'fa-hammer',
    dec: 'fa-mask',
    dip: 'fa-handshake',
    itm: 'fa-fist-raised',
    med: 'fa-kit-medical',
    nat: 'fa-leaf',
    occ: 'fa-book-skull',
    prf: 'fa-music',
    rel: 'fa-cross',
    soc: 'fa-users',
    ste: 'fa-user-secret',
    sur: 'fa-compass',
    thi: 'fa-hand-holding',
    // D&D 5e additional
    ani: 'fa-paw',
    his: 'fa-scroll',
    ins: 'fa-lightbulb',
    inv: 'fa-search',
    prc: 'fa-eye',
    slt: 'fa-hand-sparkles',
  };
  return iconMap[slug] || 'fa-dice-d20';
}

/**
 * Get action name from skill and action slug
 */
export function getActionName(skillSlug, actionSlug) {
  const skills = SystemAdapter.getSkills();
  const skill = skills[skillSlug];
  const actions = skill?.actions;
  if (!actions) return null;
  const action = actions.find((a) => a.slug === actionSlug);
  return action?.name || null;
}

/**
 * Map skills with proficiency information
 */
export async function mapSkillsWithProficiency(categorySlugs, allSkills, participants) {
  const mapped = categorySlugs
    .map(slug => allSkills.find(s => s.slug === slug))
    .filter(Boolean);

  return mapped;
}

/**
 * Check if actor has a specific skill (system-specific - override in subclass)
 */
export async function actorHasSkill(sidebar, actor, skillSlug) {
  // Call the sidebar's system-specific implementation
  if (sidebar._actorHasSkill) {
    return await sidebar._actorHasSkill(actor, skillSlug);
  }
  // Base implementation always returns true
  return true;
}

/**
 * Check if actor is proficient in skill (system-specific - override in subclass)
 */
export async function isActorProficientInSkill(actor, skillSlug) {
  // Base implementation - override in subclasses
  return false;
}

/**
 * Get available skills from selected participants (system-specific)
 */
export async function getAvailableSkills(state, selectedParticipants) {
  return new Set();
}

/**
 * Get lore skills from participants (system-specific)
 */
export async function getLoreSkills(state, selectedParticipants) {
  return [];
}

/**
 * Check if an action has the secret trait (makes it a blind GM roll)
 */
export async function actionHasSecretTrait(actionSlug) {
  if (!game.pf2e?.actions) return false;

  try {
    // Search the actions compendium for this action
    const pack = game.packs.get('pf2e.actionspf2e');
    if (!pack) return false;

    // Convert slug to title case for searching (e.g., 'seek' -> 'Seek')
    const actionName = actionSlug.split('-').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');

    // Search by name
    const actionItem = pack.index.find(i => i.name.toLowerCase() === actionName.toLowerCase());
    if (!actionItem) return false;

    // Get full document to check traits
    const doc = await pack.getDocument(actionItem._id);
    return doc?.system?.traits?.value?.includes('secret') || false;
  } catch (error) {
    console.warn(`${MODULE_ID} | Error checking action traits:`, error);
    return false;
  }
}

/**
 * Clear participant selection without re-rendering
 */
function clearParticipantSelection(sidebar) {
  // Clear the selection set
  sidebar.selectedParticipants.clear();

  // Update all participant elements to remove selected state
  const participants = sidebar.element.querySelectorAll('[data-participant-id]');
  participants.forEach((el) => {
    el.classList.remove('selected');
    el.setAttribute('aria-selected', 'false');
  });

  // Update the UI elements to reflect the cleared selection
  ParticipantHandlers.updateSelectAllCheckbox(sidebar);
}
