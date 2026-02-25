/**
 * Skill Check Handler for GM Sidebar
 * Handles skill check requests, batch processing, skill menus, and proficiency checks
 */

import { MODULE_ID } from '../../../constants.mjs';
import * as SystemAdapter from '../../../system-adapter.mjs';

/**
 * Request a skill check (single skill button click)
 * Opens roll requester dialog instead of requiring pre-selected participants
 */
export async function onRequestSkill(_event, target, sidebar) {
  const skillSlug = target.dataset.skill;
  if (!skillSlug) return;

  // Shift+click adds to batch selection
  if (_event.shiftKey) {
    sidebar._shiftKeyDown = true;
    const checkId = `skill:${skillSlug}`;
    const existingIndex = sidebar.batchedChecks.findIndex(c => c.checkId === checkId);

    if (existingIndex !== -1) {
      sidebar.batchedChecks.splice(existingIndex, 1);
    } else {
      sidebar.batchedChecks.push({
        skill: skillSlug,
        dc: sidebar.currentDC,
        isSecret: sidebar.secretRollEnabled || false,
        actionSlug: null,
        checkId,
      });
    }

    updateBatchHighlights(sidebar);
    return;
  }

  await openRollRequesterAndSend(sidebar, skillSlug, 'skill');
}

/**
 * Request a save check (save button click)
 */
export async function onRequestSave(_event, target, sidebar) {
  const saveSlug = target.dataset.save;
  if (!saveSlug) return;

  // Shift+click adds to batch selection
  if (_event.shiftKey) {
    sidebar._shiftKeyDown = true;
    const checkId = `save:${saveSlug}`;
    const existingIndex = sidebar.batchedChecks.findIndex(c => c.checkId === checkId);

    if (existingIndex !== -1) {
      sidebar.batchedChecks.splice(existingIndex, 1);
    } else {
      sidebar.batchedChecks.push({
        skill: saveSlug,
        dc: sidebar.currentDC,
        isSecret: sidebar.secretRollEnabled || false,
        actionSlug: null,
        checkType: 'save',
        checkId,
      });
    }

    updateBatchHighlights(sidebar);
    return;
  }

  await openRollRequesterAndSend(sidebar, saveSlug, 'save');
}

/**
 * Send batch skill check request
 */
export async function onSendBatch(_event, _target, sidebar) {
  if (sidebar.batchedChecks.length === 0) return;

  await sendBatchSkillCheck(sidebar);
}

/**
 * Open roll requester dialog, then send skill checks to selected actor UUIDs
 */
async function openRollRequesterAndSend(sidebar, skillSlug, checkType, actionSlug = null, actionVariant = null) {
  const { getAllPlayerPCs } = await import('../../../system-adapter.mjs');
  const pcs = await getAllPlayerPCs();
  if (pcs.length === 0) {
    ui.notifications.warn('No player-owned characters found in the world.');
    return;
  }

  const { RollRequestDialog } = await import('../../roll-request-dialog.mjs');
  const checks = [{ skillName: skillSlug, dc: sidebar.currentDC, isSecret: sidebar.secretRollEnabled, checkType, actionSlug, actionVariant }];
  const result = await RollRequestDialog.subscribe(checks, pcs);

  const selectedIds = result?.selectedIds || result || [];
  const allowOnlyOne = result?.allowOnlyOne || false;
  const batchGroupId = result?.batchGroupId ?? null;
  if (!selectedIds || selectedIds.length === 0) return;

  await requestSkillCheck(sidebar, skillSlug, selectedIds, actionSlug, false, checkType, batchGroupId, allowOnlyOne, actionVariant, result.checks[0].isSecret ?? false);
}

/**
 * Core skill/save check request logic
 * @param {Object} sidebar - Sidebar instance
 * @param {string} skillSlug - Skill or save slug
 * @param {Array} actorUuids - Array of actor UUID strings
 * @param {string} actionSlug - Optional action slug (skills only)
 * @param {boolean} suppressNotifications - Whether to suppress notifications
 * @param {string} checkType - 'skill' or 'save' (defaults to 'skill' for backward compatibility)
 * @param {string} batchGroupId - Optional group ID for "allow only one" feature
 * @param {boolean} allowOnlyOne - Whether this roll is part of an "allow only one" group
 * @param {string} actionVariant - Optional action variant (e.g., 'gesture' for Create a Diversion)
 */
export async function requestSkillCheck(sidebar, skillSlug, actorUuids, actionSlug = null, suppressNotifications = false, checkType = 'skill', batchGroupId = null, allowOnlyOne = false, actionVariant = null, isSecretOverride = null) {
  const state = game.storyframe.stateManager.getState();
  if (!state) return { sentCount: 0, offlineCount: 0, missingSkillCount: 0, sentIds: new Set(), offlineIds: new Set(), missingIds: new Set(), offlineNames: new Set(), missingNames: new Set() };

  let isSecretRoll;
  if (isSecretOverride !== null) {
    // Explicit value from caller — honour it and skip compendium auto-detection.
    // Inline @Check clicks pass the traits-based boolean so the author's intent is
    // respected (e.g. a Recall Knowledge check without 'secret' in traits is not secret).
    isSecretRoll = isSecretOverride;
  } else {
    // No explicit value — use sidebar toggle, then auto-detect from PF2e action compendium.
    isSecretRoll = sidebar.secretRollEnabled || false;
    if (!isSecretRoll && actionSlug && game.pf2e) {
      isSecretRoll = await actionHasSecretTrait(actionSlug);
    }
  }

  // Check if Monks TokenBar integration is enabled
  const useMTB = game.settings.get(MODULE_ID, 'useMonksTokenBar');
  let mtb = null;
  if (useMTB) {
    mtb = await import('../../../integrations/monks-tokenbar.mjs');
    if (!mtb.isActive()) mtb = null;
  }

  let sentCount = 0;
  let offlineCount = 0;
  let missingSkillCount = 0;
  const sentIds = new Set();
  const offlineIds = new Set();
  const missingIds = new Set();
  const offlineNames = new Set();
  const missingNames = new Set();
  const mtbActorUuids = [];

  for (const actorUuid of actorUuids) {
    const actor = await fromUuid(actorUuid);
    if (!actor) continue;

    if (checkType === 'skill') {
      const hasSkill = await actorHasSkill(sidebar, actor, skillSlug);
      if (!hasSkill) {
        missingSkillCount++;
        missingIds.add(actorUuid);
        missingNames.add(actor.name);
        continue;
      }
    }

    const user = game.users.find(u => u.active && !u.isGM && actor.testUserPermission?.(u, 'OWNER'));
    if (!user) {
      offlineCount++;
      offlineIds.add(actorUuid);
      offlineNames.add(actor.name);
      continue;
    }

    if (mtb) {
      // Route through Monks TokenBar — no pending roll needed
      mtbActorUuids.push(actorUuid);
    } else {
      const requestId = foundry.utils.randomID();
      const request = {
        id: requestId,
        actorUuid,
        userId: user.id,
        skillSlug,
        checkType,
        actionSlug,
        actionVariant,
        dc: sidebar.currentDC,
        isSecretRoll,
        timestamp: Date.now(),
        batchGroupId,
        allowOnlyOne,
      };

      await game.storyframe.socketManager.requestAddPendingRoll(request);
      await game.storyframe.socketManager.triggerSkillCheckOnPlayer(user.id, request);
    }
    sentCount++;
    sentIds.add(actorUuid);
  }

  // Batch-send to Monks TokenBar (one chat card for all participants)
  if (mtb && mtbActorUuids.length > 0) {
    const mtbSent = await mtb.requestRoll({
      actorUuids: mtbActorUuids,
      skillSlug,
      checkType,
      dc: sidebar.currentDC,
      isSecret: isSecretRoll,
    });

    // Fall back to native StoryFrame if MTB failed
    if (!mtbSent) {
      for (const actorUuid of mtbActorUuids) {
        const actor = await fromUuid(actorUuid);
        if (!actor) continue;
        const user = game.users.find(u => u.active && !u.isGM && actor.testUserPermission?.(u, 'OWNER'));
        if (!user) continue;
        const requestId = foundry.utils.randomID();
        const request = {
          id: requestId, actorUuid, userId: user.id, skillSlug, checkType,
          actionSlug, actionVariant, dc: sidebar.currentDC, isSecretRoll,
          timestamp: Date.now(), batchGroupId, allowOnlyOne,
        };
        await game.storyframe.socketManager.requestAddPendingRoll(request);
        await game.storyframe.socketManager.triggerSkillCheckOnPlayer(user.id, request);
      }
    }
  }

  // Get appropriate name and notification based on check type
  let checkName, notificationKey;
  if (checkType === 'save') {
    const systemSaves = SystemAdapter.getSaves();
    const saveName = systemSaves[skillSlug]?.name || skillSlug.toUpperCase();
    checkName = saveName;
    notificationKey = 'STORYFRAME.Notifications.SkillCheck.SaveRequested';
  } else {
    const skillName = getSkillName(skillSlug);
    const actionName = actionSlug ? getActionName(skillSlug, actionSlug) : null;
    checkName = actionName ? `${skillName} (${actionName})` : skillName;
    notificationKey = 'STORYFRAME.Notifications.SkillCheck.CheckRequested';
  }

  if (!suppressNotifications) {
    if (sentCount > 0) {
      ui.notifications.info(game.i18n.format(notificationKey, { checkName, count: sentCount }));
    }
    if (offlineCount > 0) {
      const names = Array.from(offlineNames).join(', ');
      ui.notifications.warn(game.i18n.format('STORYFRAME.Notifications.SkillCheck.PlayersOffline', { names }));
    }
    if (missingSkillCount > 0) {
      const names = Array.from(missingNames).join(', ');
      ui.notifications.warn(game.i18n.format('STORYFRAME.Notifications.SkillCheck.PlayersLackSkill', { names, skillName: checkName }));
    }
  }

  return { sentCount, offlineCount, missingSkillCount, sentIds, offlineIds, missingIds, offlineNames, missingNames };
}

/**
 * Send batch skill check request via roll requester
 */
export async function sendBatchSkillCheck(sidebar) {
  if (sidebar.batchedChecks.length === 0) return;

  const { getAllPlayerPCs } = await import('../../../system-adapter.mjs');
  const pcs = await getAllPlayerPCs();
  if (pcs.length === 0) {
    ui.notifications.warn('No player-owned characters found in the world.');
    return;
  }

  // Build checks array for the dialog
  const checksForDialog = sidebar.batchedChecks.map(check => ({
    skillName: check.skill,
    dc: check.dc ?? sidebar.currentDC,
    isSecret: check.isSecret,
    checkType: check.checkType || 'skill',
    actionSlug: check.actionSlug ?? null,
    actionVariant: check.actionVariant ?? null,
  }));

  const { RollRequestDialog } = await import('../../roll-request-dialog.mjs');
  const result = await RollRequestDialog.subscribe(checksForDialog, pcs);

  const selectedIds = result?.selectedIds || result || [];
  const allowOnlyOne = result?.allowOnlyOne || false;
  const batchGroupId = result?.batchGroupId ?? null;
  if (!selectedIds || selectedIds.length === 0) return;

  // Track unique IDs and names across all checks
  const uniqueSentIds = new Set();
  const uniqueOfflineIds = new Set();
  const uniqueMissingIds = new Set();
  const uniqueOfflineNames = new Set();
  const participantMissingSkills = new Map();

  const systemSkills = SystemAdapter.getSkills();
  // Use result.checks (surviving checks after any removals) rather than the original batchedChecks
  const survivingChecks = result.checks || [];
  const checkCount = survivingChecks.length;

  const hasSkills = survivingChecks.some(check => check.checkType !== 'save');
  const hasSaves = survivingChecks.some(check => check.checkType === 'save');

  // batchGroupId comes from the dialog result (shared across all concurrent subscribers)
  const effectiveAllowOnlyOne = allowOnlyOne || false;

  for (const check of survivingChecks) {
    const previousDC = sidebar.currentDC;
    const previousSecret = sidebar.secretRollEnabled;

    sidebar.currentDC = check.dc;
    sidebar.secretRollEnabled = check.isSecret || false;

    const checkResult = await requestSkillCheck(sidebar, check.skillName, selectedIds, check.actionSlug, true, check.checkType || 'skill', batchGroupId, effectiveAllowOnlyOne, check.actionVariant ?? null);

    sidebar.currentDC = previousDC;
    sidebar.secretRollEnabled = previousSecret;

    checkResult.sentIds.forEach(id => uniqueSentIds.add(id));
    checkResult.offlineIds.forEach(id => uniqueOfflineIds.add(id));
    checkResult.missingIds.forEach(id => uniqueMissingIds.add(id));
    checkResult.offlineNames.forEach(name => uniqueOfflineNames.add(name));

    checkResult.missingNames.forEach(name => {
      if (!participantMissingSkills.has(name)) {
        participantMissingSkills.set(name, new Set());
      }
      const ct = check.checkType || 'skill';
      let cn;
      if (ct === 'save') {
        const systemSaves = SystemAdapter.getSaves();
        cn = systemSaves[check.skillName]?.name || check.skillName;
      } else {
        cn = systemSkills[check.skillName]?.name || check.skillName;
      }
      participantMissingSkills.get(name).add(cn);
    });
  }

  // Clear batch selection
  sidebar.batchedChecks = [];
  updateBatchHighlights(sidebar);

  // Show aggregated notification
  if (uniqueSentIds.size > 0) {
    let notificationKey;
    if (hasSkills && hasSaves) {
      notificationKey = 'STORYFRAME.Notifications.SkillCheck.MultipleChecksAndSavesRequested';
    } else if (hasSaves) {
      notificationKey = 'STORYFRAME.Notifications.SkillCheck.MultipleSavesRequested';
    } else {
      notificationKey = 'STORYFRAME.Notifications.SkillCheck.MultipleChecksRequested';
    }
    ui.notifications.info(game.i18n.format(notificationKey, { checkCount, uniqueCount: uniqueSentIds.size }), { permanent: false });
  }
  if (uniqueOfflineNames.size > 0) {
    const names = Array.from(uniqueOfflineNames).join(', ');
    const notification = ui.notifications.warn(game.i18n.format('STORYFRAME.Notifications.SkillCheck.PlayersOffline', { names }), { permanent: true });
    setTimeout(() => notification.remove(), 15000);
  }
  if (participantMissingSkills.size > 0) {
    const messages = Array.from(participantMissingSkills.entries()).map(([name, skills]) => {
      const skillList = Array.from(skills).join(', ');
      return game.i18n.format('STORYFRAME.Notifications.SkillCheck.PlayerMissingSkills', { name, skillList });
    });
    const notification = ui.notifications.warn(game.i18n.format('STORYFRAME.Notifications.SkillCheck.SkippedMissingSkills', { details: messages.join('; ') }), { permanent: true });
    setTimeout(() => notification.remove(), 15000);
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

  // Remove all existing batch highlights from save buttons
  sidebar.element.querySelectorAll('.save-btn-wrapper.batched').forEach(wrapper => {
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

  // Remove all existing batch highlights from journal saves
  sidebar.element.querySelectorAll('.journal-save-wrapper.batched').forEach(wrapper => {
    wrapper.classList.remove('batched');
  });

  // Collect skills by source type
  const batchedRegularSkills = new Set();
  const batchedSaves = new Set();
  const batchedLoreSkills = new Set();
  const batchedJournalSkills = new Set();
  const batchedJournalSaves = new Set();
  const batchedActionSkills = new Set();

  sidebar.batchedChecks.forEach(check => {
    if (check.checkId.startsWith('journal:')) {
      if (check.checkType === 'save') {
        batchedJournalSaves.add(check.skill);
      } else {
        batchedJournalSkills.add(check.skill);
      }
    } else if (check.checkId.startsWith('action:')) {
      batchedActionSkills.add(check.skill);
    } else if (check.checkId.startsWith('save:')) {
      batchedSaves.add(check.skill);
    } else if (check.checkId.startsWith('skill:')) {
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

  // Highlight save buttons
  batchedSaves.forEach(saveSlug => {
    const wrapper = sidebar.element.querySelector(`.save-btn[data-save="${saveSlug}"]`)?.closest('.save-btn-wrapper');
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

  // Highlight journal save buttons
  const saves = SystemAdapter.getSaves();
  batchedJournalSaves.forEach(saveSlug => {
    let saveName = saves[saveSlug]?.name;

    if (!saveName) {
      saveName = saveSlug.charAt(0).toUpperCase() + saveSlug.slice(1);
    }

    const wrapper = sidebar.element.querySelector(`.journal-save-btn[data-skill="${saveName}"]`)?.closest('.journal-save-wrapper');
    if (wrapper) {
      wrapper.classList.add('batched');
    }
  });

  // Highlight skill action buttons
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
      if (countSpan) countSpan.textContent = batchCount;
    } else {
      sendBatchBtn.style.display = 'none';
    }
  }
}

/**
 * Open skill menu for all available skills
 */
export async function onOpenSkillMenu(_event, target, sidebar) {
  const systemSkills = SystemAdapter.getSkills();
  const allSkills = Object.entries(systemSkills).map(([slug, skill]) => ({
    slug,
    name: skill.name,
    isLore: false,
  }));

  // Add lore skills from all player PCs
  const loreSkills = await sidebar.constructor._getLoreSkills(null, null);
  allSkills.push(...loreSkills);

  // Remove any existing skill menu
  document.querySelector('.storyframe-skill-menu')?.remove();

  // Create popup menu
  const menu = document.createElement('div');
  menu.className = 'storyframe-skill-menu';

  const regularSkills = allSkills.filter((s) => !s.isLore);
  const loreSkillsFiltered = allSkills.filter((s) => s.isLore);

  let menuHTML = regularSkills
    .map(
      (s) =>
        `<button type="button" class="skill-option" data-skill="${s.slug}">${s.name}</button>`,
    )
    .join('');

  if (loreSkillsFiltered.length > 0) {
    menuHTML += '<div class="skill-divider"></div>';
    menuHTML += loreSkillsFiltered
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

      await openRollRequesterAndSend(sidebar, skillSlug, 'skill');
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
    // sf2e-anachronism skills
    com: 'fa-computer',
    pil: 'fa-jet-fighter-up',
    // D&D 5e additional
    ani: 'fa-paw',
    his: 'fa-scroll',
    ins: 'fa-lightbulb',
    inv: 'fa-search',
    prc: 'fa-eye',
    slt: 'fa-hand-sparkles',
    // Daggerheart traits
    agi: 'fa-person-running',
    str: 'fa-dumbbell',
    fin: 'fa-hand-sparkles',
    pre: 'fa-comments',
    kno: 'fa-book',
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
export async function mapSkillsWithProficiency(categorySlugs, allSkills, _participants) {
  const mapped = categorySlugs
    .map(slug => allSkills.find(s => s.slug === slug))
    .filter(Boolean);

  return mapped;
}

/**
 * Check if actor has a specific skill (system-specific - override in subclass)
 */
export async function actorHasSkill(sidebar, actor, skillSlug) {
  if (sidebar._actorHasSkill) {
    return await sidebar._actorHasSkill(actor, skillSlug);
  }
  return true;
}

/**
 * Check if actor has a specific save (system-specific)
 */
export async function actorHasSave(sidebar, actor, saveSlug) {
  if (sidebar._actorHasSave) {
    return await sidebar._actorHasSave(actor, saveSlug);
  }
  return true;
}

/**
 * Check if actor is proficient in skill (system-specific - override in subclass)
 */
export async function isActorProficientInSkill(_actor, _skillSlug) {
  return false;
}

/**
 * Get available skills from selected participants (system-specific)
 */
export async function getAvailableSkills(_state, _selectedParticipants) {
  return new Set();
}

/**
 * Get lore skills from participants (system-specific)
 */
export async function getLoreSkills(_state, _selectedParticipants) {
  return [];
}

/**
 * Check if an action has the secret trait (makes it a blind GM roll)
 */
export async function actionHasSecretTrait(actionSlug) {
  if (!game.pf2e?.actions) return false;

  try {
    const pack = game.packs.get('pf2e.actionspf2e');
    if (!pack) return false;

    const actionName = actionSlug.split('-').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');

    const actionItem = pack.index.find(i => i.name.toLowerCase() === actionName.toLowerCase());
    if (!actionItem) return false;

    const doc = await pack.getDocument(actionItem._id);
    return doc?.system?.traits?.value?.includes('secret') || false;
  } catch (error) {
    console.warn(`${MODULE_ID} | Error checking action traits:`, error);
    return false;
  }
}
