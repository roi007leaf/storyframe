/**
 * Challenge Management Handler for GM Sidebar
 * Handles challenge presentation, library management, and multi-challenge support
 */

import { ChallengeBuilderDialog } from '../../challenge-builder.mjs';
import { MODULE_ID } from '../../../constants.mjs';
import * as SystemAdapter from '../../../system-adapter.mjs';
import * as SkillCheckHandlers from './skill-check-handlers.mjs';
import { extractParentElement } from '../../../utils/element-utils.mjs';

/**
 * Present a new challenge
 */
export async function onPresentChallenge(_event, _target, _sidebar) {
  // No participant requirement - challenge is broadcast to all players
  const builder = new ChallengeBuilderDialog(new Set());
  builder.render(true);
}

/**
 * Clear a challenge (or all challenges if no ID provided)
 */
export async function onClearChallenge(_event, target, _sidebar) {
  // Support both old behavior (clear all) and new behavior (clear specific)
  const challengeId = target?.dataset?.challengeId;

  if (challengeId) {
    await game.storyframe.socketManager.requestRemoveChallenge(challengeId);
    ui.notifications.info(game.i18n.localize('STORYFRAME.Notifications.Challenge.ChallengeCleared'));
  } else {
    await game.storyframe.socketManager.requestClearActiveChallenge();
    ui.notifications.info(game.i18n.localize('STORYFRAME.Notifications.Challenge.AllChallengesCleared'));
  }
}

/**
 * Remove a specific challenge
 */
export async function onRemoveChallenge(_event, target, _sidebar) {
  const challengeId = target.dataset.challengeId;
  if (!challengeId) return;

  await game.storyframe.socketManager.requestRemoveChallenge(challengeId);
  ui.notifications.info(game.i18n.localize('STORYFRAME.Notifications.Challenge.ChallengeCleared'));
}

/**
 * Clear all challenges
 */
export async function onClearAllChallenges(_event, _target, _sidebar) {
  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title: game.i18n.localize('STORYFRAME.Dialogs.ClearAllChallenges.Title') },
    content: `<p>${game.i18n.localize('STORYFRAME.Dialogs.ClearAllChallenges.Content')}</p>`,
    yes: { label: game.i18n.localize('STORYFRAME.Dialogs.ClearAllChallenges.Button') },
    no: { label: game.i18n.localize('STORYFRAME.Dialogs.Cancel') },
    rejectClose: false,
  });

  if (!confirmed) return;

  await game.storyframe.socketManager.requestClearAllChallenges();
  ui.notifications.info(game.i18n.localize('STORYFRAME.Notifications.Challenge.AllChallengesCleared'));
}

/**
 * Toggle collapse state for active challenge
 */
export async function onToggleChallengeCollapse(_event, target, sidebar) {
  const challengeId = target.closest('[data-challenge-id]')?.dataset.challengeId;
  if (!challengeId) return;

  const currentState = sidebar.collapsedChallenges.get(challengeId) || false;
  sidebar.collapsedChallenges.set(challengeId, !currentState);

  // Update DOM directly
  const challengeCard = sidebar.element.querySelector(`[data-challenge-id="${challengeId}"]`);
  if (challengeCard) {
    if (!currentState) {
      challengeCard.classList.add('collapsed');
    } else {
      challengeCard.classList.remove('collapsed');
    }

    // Update chevron icon
    const chevron = challengeCard.querySelector('.collapse-icon');
    if (chevron) {
      chevron.className = !currentState ? 'fas fa-chevron-right collapse-icon' : 'fas fa-chevron-down collapse-icon';
    }

    // Update aria-expanded
    const header = challengeCard.querySelector('[data-action="toggleChallengeCollapse"]');
    if (header) {
      header.setAttribute('aria-expanded', currentState ? 'true' : 'false');
    }
  }
}

/**
 * Toggle collapse state for library challenge
 */
export async function onToggleLibraryChallengeCollapse(_event, target, sidebar) {
  const challengeId = target.closest('[data-challenge-id]')?.dataset.challengeId;
  if (!challengeId) return;

  const currentState = sidebar.collapsedLibraryChallenges.get(challengeId) || false;
  sidebar.collapsedLibraryChallenges.set(challengeId, !currentState);

  // Update DOM directly
  const challengeCard = sidebar.element.querySelector(`.lib-challenge-card[data-challenge-id="${challengeId}"]`);
  if (challengeCard) {
    if (!currentState) {
      challengeCard.classList.add('collapsed');
    } else {
      challengeCard.classList.remove('collapsed');
    }

    // Update chevron icon
    const chevron = challengeCard.querySelector('.collapse-icon');
    if (chevron) {
      chevron.className = !currentState ? 'fas fa-chevron-right collapse-icon' : 'fas fa-chevron-down collapse-icon';
    }

    // Update aria-expanded
    const header = challengeCard.querySelector('.lib-card-header');
    if (header) {
      header.setAttribute('aria-expanded', currentState ? 'true' : 'false');
    }
  }
}

/**
 * Present a saved challenge from library
 */
export async function onPresentSavedChallenge(_event, target, _sidebar) {
  const challengeId = target.dataset.challengeId;
  const savedChallenges = game.settings.get(MODULE_ID, 'challengeLibrary') || [];
  const template = savedChallenges.find(c => c.id === challengeId);

  if (!template) {
    ui.notifications.error(game.i18n.localize('STORYFRAME.Notifications.Challenge.ChallengeNotFound'));
    return;
  }

  // Create challenge data from template
  const challengeData = {
    id: foundry.utils.randomID(),
    name: template.name,
    image: template.image,
    options: template.options,
    templateId: challengeId,  // track which library template this came from
  };

  const success = await game.storyframe.socketManager.requestAddChallenge(challengeData);

  if (!success) {
    ui.notifications.error(game.i18n.format('STORYFRAME.Notifications.Challenge.ChallengeDuplicateName', { name: challengeData.name }));
    return;
  }

  ui.notifications.info(game.i18n.format('STORYFRAME.Notifications.Challenge.ChallengePresentedAll', { name: challengeData.name }));
}

/**
 * Edit a saved challenge from library
 */
export async function onEditChallenge(_event, target, _sidebar) {
  const challengeId = target.dataset.challengeId;
  const savedChallenges = game.settings.get(MODULE_ID, 'challengeLibrary') || [];
  const template = savedChallenges.find(c => c.id === challengeId);

  if (!template) {
    ui.notifications.error(game.i18n.localize('STORYFRAME.Notifications.Challenge.ChallengeNotFound'));
    return;
  }

  // Open builder in edit mode
  const builder = new ChallengeBuilderDialog(new Set(), {
    editMode: true,
    templateId: challengeId,
    templateData: template,
  });
  builder.render(true);
}

/**
 * Delete a challenge from library
 */
export async function onDeleteChallenge(_event, target, _sidebar) {
  const challengeId = target.dataset.challengeId;

  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title: game.i18n.localize('STORYFRAME.Dialogs.DeleteChallenge.Title') },
    content: `<p>${game.i18n.localize('STORYFRAME.Dialogs.DeleteChallenge.Content')}</p>`,
    yes: { label: game.i18n.localize('STORYFRAME.Dialogs.DeleteChallenge.Button') },
    no: { label: game.i18n.localize('STORYFRAME.Dialogs.Cancel') },
    rejectClose: false,
  });

  if (!confirmed) return;

  const savedChallenges = game.settings.get(MODULE_ID, 'challengeLibrary') || [];
  const filtered = savedChallenges.filter(c => c.id !== challengeId);
  await game.settings.set(MODULE_ID, 'challengeLibrary', filtered);

  ui.notifications.info(game.i18n.localize('STORYFRAME.Notifications.Challenge.ChallengeDeleted'));
  // Note: Setting update triggers updateSetting hook which re-renders sidebar
}

/**
 * Create a challenge from selected journal text
 */
export async function onCreateChallengeFromSelection(_event, _target, sidebar) {
  // Get the journal content element
  const content = getJournalContent(sidebar);
  if (!content) {
    ui.notifications.warn(game.i18n.localize('STORYFRAME.Notifications.Challenge.NoJournalContent'));
    return;
  }

  // Get selected text from the journal
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    ui.notifications.warn(game.i18n.localize('STORYFRAME.Notifications.Challenge.NoTextSelected'));
    return;
  }

  // Check if selection is within the journal content
  const range = selection.getRangeAt(0);
  if (!content.contains(range.commonAncestorContainer)) {
    ui.notifications.warn(game.i18n.localize('STORYFRAME.Notifications.Challenge.SelectionNotInContent'));
    return;
  }

  // Create a temporary container with the selected HTML
  const fragment = range.cloneContents();
  const tempContainer = document.createElement('div');
  tempContainer.appendChild(fragment);

  // Parse checks from the selected content
  const checks = sidebar._parseChecksFromContent(tempContainer);

  if (checks.length === 0) {
    ui.notifications.warn(game.i18n.localize('STORYFRAME.Notifications.Challenge.NoSkillChecksFound'));
    return;
  }

  // Prompt for challenge name
  const challengeName = await foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.localize('STORYFRAME.Dialogs.CreateChallenge.Title') },
    content: `<p>${game.i18n.localize('STORYFRAME.Dialogs.CreateChallenge.Content')}</p><input type="text" name="challengeName" autofocus>`,
    ok: {
      label: game.i18n.localize('STORYFRAME.Dialogs.CreateChallenge.Button'),
      callback: (_event, button, _dialog) => button.form.elements.challengeName.value,
    },
    rejectClose: false,
  });

  if (!challengeName) return;

  // Create options from checks - each check becomes an option
  const options = checks.map((check) => {
    // Map skill/save name to slug based on check type
    const checkType = check.checkType || 'skill';
    const checkSlug = checkType === 'save'
      ? (SystemAdapter.getSaveSlugFromName(check.skillName) || check.skillName)
      : (SystemAdapter.getSkillSlugFromName(check.skillName) || check.skillName);

    return {
      id: foundry.utils.randomID(),
      skillOptions: [{
        skill: checkSlug,
        checkType: checkType,  // NEW: Preserve check type
        dc: check.dc,
        action: null,
        isSecret: check.isSecret || false,
      }],
    };
  });

  // Create challenge template
  const template = {
    id: foundry.utils.randomID(),
    name: challengeName,
    image: null,
    options,
    createdAt: Date.now(),
  };

  // Save to library
  const savedChallenges = game.settings.get(MODULE_ID, 'challengeLibrary') || [];
  savedChallenges.push(template);
  await game.settings.set(MODULE_ID, 'challengeLibrary', savedChallenges);

  ui.notifications.info(game.i18n.format('STORYFRAME.Notifications.Challenge.ChallengeCreated', { name: challengeName, count: checks.length }));
  // Note: Setting update triggers updateSetting hook which re-renders sidebar

  // Clear selection
  selection.removeAllRanges();
}

/**
 * Request rolls from selected journal text
 */
export async function onRequestRollsFromSelection(_event, _target, sidebar) {
  // Get the journal content element
  const content = getJournalContent(sidebar);
  if (!content) {
    ui.notifications.warn(game.i18n.localize('STORYFRAME.Notifications.Challenge.NoJournalContent'));
    return;
  }

  // Get selected text from the journal
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    ui.notifications.warn(game.i18n.localize('STORYFRAME.Notifications.Challenge.NoTextSelected'));
    return;
  }

  // Check if selection is within the journal content
  const range = selection.getRangeAt(0);
  if (!content.contains(range.commonAncestorContainer)) {
    ui.notifications.warn(game.i18n.localize('STORYFRAME.Notifications.Challenge.SelectionNotInContent'));
    return;
  }

  // Create a temporary container with the selected HTML
  const fragment = range.cloneContents();
  const tempContainer = document.createElement('div');
  tempContainer.appendChild(fragment);

  // Parse checks from the selected content
  const checks = sidebar._parseChecksFromContent(tempContainer);

  if (checks.length === 0) {
    ui.notifications.warn(game.i18n.localize('STORYFRAME.Notifications.Challenge.NoSkillChecksFound'));
    return;
  }

  // Get all player PCs
  const { getAllPlayerPCs } = await import('../../../system-adapter.mjs');
  const pcs = await getAllPlayerPCs();
  if (pcs.length === 0) {
    ui.notifications.warn('No player-owned characters found in the world.');
    return;
  }

  // Subscribe to (or open) the singleton roll request dialog
  const { RollRequestDialog } = await import('../../roll-request-dialog.mjs');
  const result = await RollRequestDialog.subscribe(checks, pcs);

  if (!result || result.length === 0) {
    return;
  }

  const selectedIds = result?.selectedIds || result || [];
  const allowOnlyOne = result?.allowOnlyOne || false;
  if (!selectedIds || selectedIds.length === 0) return;

  // batchGroupId is generated by the dialog and shared across all concurrent subscribers
  const batchGroupId = result?.batchGroupId ?? null;

  // Send roll requests for each surviving check (respects per-row removals in the dialog)
  for (const check of (result.checks || [])) {
    // Map skill name to slug using SystemAdapter
    const skillSlug = SystemAdapter.getSkillSlugFromName(check.skillName) || check.skillName.toLowerCase();

    // Set DC
    sidebar.currentDC = check.dc;
    const dcInput = sidebar.element.querySelector('#dc-input');
    if (dcInput) dcInput.value = check.dc;

    // Set secret roll toggle
    sidebar.secretRollEnabled = check.isSecret;

    // Send request with shared batch group ID
    await SkillCheckHandlers.requestSkillCheck(sidebar, skillSlug, selectedIds, null, false, 'skill', batchGroupId, allowOnlyOne);
  }

  // Reset secret toggle
  sidebar.secretRollEnabled = false;

  // Update secret button directly
  const secretBtn = sidebar.element.querySelector('.secret-roll-btn');
  if (secretBtn) {
    secretBtn.classList.remove('active');
    secretBtn.setAttribute('aria-pressed', 'false');
  }

  // Clear selection
  selection.removeAllRanges();
}

/**
 * Prepare challenge context data for template
 */
export async function prepareChallengesContext(sidebar, state) {
  if (!state) return {
    activeChallenges: [],
    activeChallenge: null,
    hasActiveChallenge: false,
    savedChallenges: [],
    hasSavedChallenges: false,
  };

  // Import SystemAdapter for save names
  const SystemAdapter = await import('../../../system-adapter.mjs');
  const systemSaves = SystemAdapter.getSaves();

  // Active challenges (multi-challenge support)
  const activeChallenges = (state?.activeChallenges || []).map(c => ({
    ...c,
    collapsed: sidebar.collapsedChallenges.get(c.id) || false,
    options: c.options.map(opt => ({
      ...opt,
      skillOptions: opt.skillOptions.map(so => {
        const checkType = so.checkType || 'skill';

        // Get name based on check type (saves don't capitalize)
        let checkName;
        if (checkType === 'save') {
          checkName = systemSaves[so.skill]?.name || so.skill;
        } else {
          checkName = getSkillName(so.skill);
        }

        const actionName = so.action ? getActionName(so.skill, so.action) : null;
        const displayText = actionName ? `${checkName} (${actionName})` : checkName;
        return {
          ...so,
          skillName: checkName,
          actionName,
          displayText,
          checkType,
          isSecret: so.isSecret || false,
          minProficiency: so.minProficiency || 0
        };
      })
    }))
  }));

  // Backward compatibility
  const activeChallenge = activeChallenges[0] || null;
  const hasActiveChallenge = activeChallenges.length > 0;

  // Load and enrich saved challenges for library
  const savedChallengesRaw = game.settings.get(MODULE_ID, 'challengeLibrary') || [];
  const savedChallenges = savedChallengesRaw.map(c => {
    const optionsPreview = c.options.map((opt, idx) => {
      const skillOptions = opt.skillOptions.map(so => {
        const checkType = so.checkType || 'skill';

        // Get name based on check type (saves don't capitalize)
        let checkName;
        if (checkType === 'save') {
          checkName = systemSaves[so.skill]?.name || so.skill;
        } else {
          checkName = getSkillName(so.skill);
        }

        const actionName = so.action ? getActionName(so.skill, so.action) : null;
        const minProf = so.minProficiency || 0;
        const profLabels = ['', 'T', 'E', 'M', 'L'];
        return {
          skillName: checkName,
          actionName,
          dc: so.dc,
          isSecret: so.isSecret || false,
          checkType,
          displayText: actionName ? `${checkName} (${actionName})` : checkName,
          minProficiency: minProf,
          minProficiencyLabel: minProf > 0 ? (profLabels[minProf] ?? String(minProf)) : null,
        };
      });

      return {
        index: idx + 1,
        name: opt.name,
        skillOptions,
      };
    });

    return {
      id: c.id,
      name: c.name,
      image: c.image,
      options: optionsPreview,
      collapsed: sidebar.collapsedLibraryChallenges.get(c.id) || false,
    };
  });

  return {
    activeChallenges,
    activeChallenge,
    hasActiveChallenge,
    savedChallenges,
    hasSavedChallenges: savedChallenges.length > 0,
  };
}

// --- Helper Functions ---

/**
 * Get journal content element
 */
function getJournalContent(sidebar) {
  const element = extractParentElement(sidebar.parentInterface);
  if (!element) return null;

  // Try multiple selectors for different journal sheet types
  return element.querySelector('.journal-entry-pages') ||
    element.querySelector('.journal-entry-content') ||
    element.querySelector('.scrollable') ||
    element.querySelector('.journal-page-content')?.parentElement ||
    element;
}

/**
 * Get skill name from slug
 */
function getSkillName(slug) {
  const skills = SystemAdapter.getSkills();
  const skill = skills[slug];
  if (skill?.name) return skill.name;

  // Handle lore skills
  if (slug.includes('-lore')) {
    return slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }

  return slug.toUpperCase();
}

/**
 * Get action name from skill and action slug
 */
function getActionName(skillSlug, actionSlug) {
  const skills = SystemAdapter.getSkills();
  const skill = skills[skillSlug];
  const actions = skill?.actions;
  if (!actions) return null;
  const action = actions.find((a) => a.slug === actionSlug);
  return action?.name || null;
}
