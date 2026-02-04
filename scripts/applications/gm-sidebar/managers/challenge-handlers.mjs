/**
 * Challenge Management Handler for GM Sidebar
 * Handles challenge presentation, library management, and multi-challenge support
 */

import { ChallengeBuilderDialog } from '../../challenge-builder.mjs';
import { MODULE_ID } from '../../../constants.mjs';
import * as SystemAdapter from '../../../system-adapter.mjs';
import { extractParentElement } from '../../../utils/element-utils.mjs';

/**
 * Present a new challenge
 */
export async function onPresentChallenge(_event, _target, sidebar) {
  // No participant requirement - challenge is broadcast to all players
  const builder = new ChallengeBuilderDialog(new Set());
  builder.render(true);
}

/**
 * Clear a challenge (or all challenges if no ID provided)
 */
export async function onClearChallenge(_event, target, sidebar) {
  // Support both old behavior (clear all) and new behavior (clear specific)
  const challengeId = target?.dataset?.challengeId;

  if (challengeId) {
    await game.storyframe.socketManager.requestRemoveChallenge(challengeId);
    ui.notifications.info('Challenge cleared');
  } else {
    await game.storyframe.socketManager.requestClearActiveChallenge();
    ui.notifications.info('All challenges cleared');
  }
}

/**
 * Remove a specific challenge
 */
export async function onRemoveChallenge(_event, target, sidebar) {
  const challengeId = target.dataset.challengeId;
  if (!challengeId) return;

  await game.storyframe.socketManager.requestRemoveChallenge(challengeId);
  ui.notifications.info('Challenge cleared');
}

/**
 * Clear all challenges
 */
export async function onClearAllChallenges(_event, _target, sidebar) {
  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title: 'Clear All Challenges' },
    content: '<p>Clear all active challenges?</p>',
    yes: { label: 'Clear All' },
    no: { label: 'Cancel' },
    rejectClose: false,
  });

  if (!confirmed) return;

  await game.storyframe.socketManager.requestClearAllChallenges();
  ui.notifications.info('All challenges cleared');
}

/**
 * Toggle collapse state for active challenge
 */
export async function onToggleChallengeCollapse(_event, target, sidebar) {
  const challengeId = target.closest('[data-challenge-id]')?.dataset.challengeId;
  if (!challengeId) return;

  const currentState = sidebar.collapsedChallenges.get(challengeId) || false;
  sidebar.collapsedChallenges.set(challengeId, !currentState);
  sidebar.render();
}

/**
 * Toggle collapse state for library challenge
 */
export async function onToggleLibraryChallengeCollapse(_event, target, sidebar) {
  const challengeId = target.closest('[data-challenge-id]')?.dataset.challengeId;
  if (!challengeId) return;

  const currentState = sidebar.collapsedLibraryChallenges.get(challengeId) || false;
  sidebar.collapsedLibraryChallenges.set(challengeId, !currentState);
  sidebar.render();
}

/**
 * Present a saved challenge from library
 */
export async function onPresentSavedChallenge(_event, target, sidebar) {
  const challengeId = target.dataset.challengeId;
  const savedChallenges = game.settings.get(MODULE_ID, 'challengeLibrary') || [];
  const template = savedChallenges.find(c => c.id === challengeId);

  if (!template) {
    ui.notifications.error('Challenge not found');
    return;
  }

  // Create challenge data from template
  const challengeData = {
    id: foundry.utils.randomID(),
    name: template.name,
    image: template.image,
    selectedParticipants: [], // Broadcast to all players
    options: template.options,
  };

  const success = await game.storyframe.socketManager.requestAddChallenge(challengeData);

  if (!success) {
    ui.notifications.error(`A challenge named "${challengeData.name}" is already active. Clear it first or rename this challenge.`);
    return;
  }

  ui.notifications.info(`Challenge "${challengeData.name}" presented to all players`);
}

/**
 * Edit a saved challenge from library
 */
export async function onEditChallenge(_event, target, sidebar) {
  const challengeId = target.dataset.challengeId;
  const savedChallenges = game.settings.get(MODULE_ID, 'challengeLibrary') || [];
  const template = savedChallenges.find(c => c.id === challengeId);

  if (!template) {
    ui.notifications.error('Challenge not found');
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
export async function onDeleteChallenge(_event, target, sidebar) {
  const challengeId = target.dataset.challengeId;

  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title: 'Delete Challenge' },
    content: '<p>Delete this challenge from library?</p>',
    yes: { label: 'Delete' },
    no: { label: 'Cancel' },
    rejectClose: false,
  });

  if (!confirmed) return;

  const savedChallenges = game.settings.get(MODULE_ID, 'challengeLibrary') || [];
  const filtered = savedChallenges.filter(c => c.id !== challengeId);
  await game.settings.set(MODULE_ID, 'challengeLibrary', filtered);

  ui.notifications.info('Challenge deleted from library');
  sidebar.render();
}

/**
 * Create a challenge from selected journal text
 */
export async function onCreateChallengeFromSelection(_event, _target, sidebar) {
  // Get the journal content element
  const content = getJournalContent(sidebar);
  if (!content) {
    ui.notifications.warn('No journal content found');
    return;
  }

  // Get selected text from the journal
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    ui.notifications.warn('No text selected in journal');
    return;
  }

  // Check if selection is within the journal content
  const range = selection.getRangeAt(0);
  if (!content.contains(range.commonAncestorContainer)) {
    ui.notifications.warn('Selection must be within the journal content');
    return;
  }

  // Create a temporary container with the selected HTML
  const fragment = range.cloneContents();
  const tempContainer = document.createElement('div');
  tempContainer.appendChild(fragment);

  // Parse checks from the selected content
  const checks = sidebar._parseChecksFromContent(tempContainer);

  if (checks.length === 0) {
    ui.notifications.warn('No skill checks found in selected text');
    return;
  }

  // Prompt for challenge name
  const challengeName = await foundry.applications.api.DialogV2.prompt({
    window: { title: 'Create Challenge' },
    content: '<p>Enter a name for this challenge:</p><input type="text" name="challengeName" autofocus>',
    ok: {
      label: 'Create',
      callback: (_event, button, _dialog) => button.form.elements.challengeName.value,
    },
    rejectClose: false,
  });

  if (!challengeName) return;

  // Create options from checks - each check becomes an option
  const options = checks.map((check) => {
    // Extract description without DC reference
    let description = check.label || '';
    // Remove common DC patterns like "DC 15" or "(DC 15)" from description
    description = description.replace(/\(?\s*DC\s*\d+\s*\)?/gi, '').trim();
    // If description is empty after cleaning, use skill name
    if (!description) {
      description = check.skillName.charAt(0).toUpperCase() + check.skillName.slice(1);
    }

    // Map skill name to short slug for the challenge system
    const skillSlug = SystemAdapter.getSkillSlugFromName(check.skillName) || check.skillName;

    return {
      id: foundry.utils.randomID(),
      description,
      skillOptions: [{
        skill: skillSlug || check.skillName,
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

  ui.notifications.info(`Challenge "${challengeName}" created with ${checks.length} check(s)`);

  // Rerender to show new challenge in library
  sidebar.render();

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
    ui.notifications.warn('No journal content found');
    return;
  }

  // Get selected text from the journal
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    ui.notifications.warn('No text selected in journal');
    return;
  }

  // Check if selection is within the journal content
  const range = selection.getRangeAt(0);
  if (!content.contains(range.commonAncestorContainer)) {
    ui.notifications.warn('Selection must be within the journal content');
    return;
  }

  // Create a temporary container with the selected HTML
  const fragment = range.cloneContents();
  const tempContainer = document.createElement('div');
  tempContainer.appendChild(fragment);

  // Parse checks from the selected content
  const checks = sidebar._parseChecksFromContent(tempContainer);

  if (checks.length === 0) {
    ui.notifications.warn('No skill checks found in selected text');
    return;
  }

  // Get current participants
  const state = game.storyframe.stateManager.getState();
  if (!state?.participants || state.participants.length === 0) {
    ui.notifications.warn('No participants added. Add PCs first.');
    return;
  }

  // Enrich participants with actor data
  const enrichedParticipants = await Promise.all(
    state.participants.map(async (p) => {
      const actor = await fromUuid(p.actorUuid);
      return {
        id: p.id,
        name: actor?.name || p.name || 'Unknown',
        img: actor?.img || p.img || 'icons/svg/mystery-man.svg',
      };
    }),
  );

  // Import and show the roll request dialog
  const { RollRequestDialog } = await import('../../roll-request-dialog.mjs');
  const dialog = new RollRequestDialog(checks, enrichedParticipants);
  dialog.render(true);

  const result = await dialog.wait();

  if (!result || result.length === 0) {
    return;
  }

  // Send roll requests for each check
  for (const check of checks) {
    // Map skill name to slug using SystemAdapter
    const skillSlug = SystemAdapter.getSkillSlugFromName(check.skillName) || check.skillName.toLowerCase();

    // Set DC
    sidebar.currentDC = check.dc;
    const dcInput = sidebar.element.querySelector('#dc-input');
    if (dcInput) dcInput.value = check.dc;

    // Set secret roll toggle
    sidebar.secretRollEnabled = check.isSecret;

    // Send request
    await sidebar._requestSkillCheck(skillSlug, result, null, false);
  }

  // Reset secret toggle
  sidebar.secretRollEnabled = false;
  sidebar.render();

  // Clear selection
  selection.removeAllRanges();
}

/**
 * Prepare challenge context data for template
 */
export function prepareChallengesContext(sidebar, state) {
  if (!state) return {
    activeChallenges: [],
    activeChallenge: null,
    hasActiveChallenge: false,
    savedChallenges: [],
    hasSavedChallenges: false,
  };

  // Active challenges (multi-challenge support)
  const activeChallenges = (state?.activeChallenges || []).map(c => ({
    ...c,
    collapsed: sidebar.collapsedChallenges.get(c.id) || false,
    options: c.options.map(opt => ({
      ...opt,
      skillOptions: opt.skillOptions.map(so => {
        const skillName = getSkillName(so.skill);
        const actionName = so.action ? getActionName(so.skill, so.action) : null;
        const displayText = actionName ? `${skillName} (${actionName})` : skillName;
        return {
          ...so,
          skillName,
          actionName,
          displayText,
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
        const skillName = getSkillName(so.skill);
        const actionName = so.action ? getActionName(so.skill, so.action) : null;
        return {
          skillName,
          actionName,
          dc: so.dc,
          isSecret: so.isSecret || false,
          displayText: actionName ? `${skillName} (${actionName})` : skillName,
        };
      });

      return {
        index: idx + 1,
        description: opt.description,
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
