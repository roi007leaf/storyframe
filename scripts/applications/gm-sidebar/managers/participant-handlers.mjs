/**
 * Participant Management Handler for GM Sidebar
 * Handles all participant (PC) related operations including add, remove, selection, and filtering
 */

/**
 * Add all player characters
 */
export async function onAddAllPCs(_event, _target, sidebar) {
  const pcs = getPlayerCharacters();

  if (pcs.length === 0) {
    ui.notifications.warn(game.i18n.localize('STORYFRAME.Notifications.Participant.NoPCsFound'));
    return;
  }

  for (const actor of pcs) {
    const owningUser = game.users.find(
      (user) => !user.isGM && actor.testUserPermission(user, 'OWNER'),
    );

    if (owningUser) {
      await game.storyframe.socketManager.requestAddParticipant({
        actorUuid: actor.uuid,
        userId: owningUser.id,
      });
    }
  }
}

/**
 * Add party PCs (system-specific - override in subclass)
 * Base implementation falls back to adding all PCs
 */
export async function onAddPartyPCs(_event, _target, sidebar) {
  // Default: fall back to adding all PCs
  return onAddAllPCs(_event, _target, sidebar);
}

/**
 * Toggle participant selection
 */
export async function onToggleParticipantSelection(_event, target, sidebar) {
  const participantElement = target.closest('[data-participant-id]');
  const participantId = participantElement?.dataset.participantId;
  if (!participantId) return;

  const isSelected = sidebar.selectedParticipants.has(participantId);

  if (isSelected) {
    sidebar.selectedParticipants.delete(participantId);
    participantElement.classList.remove('selected');
    participantElement.setAttribute('aria-selected', 'false');
  } else {
    sidebar.selectedParticipants.add(participantId);
    participantElement.classList.add('selected');
    participantElement.setAttribute('aria-selected', 'true');
  }

  // Update UI elements directly
  const state = game.storyframe.stateManager.getState();
  const totalParticipants = state?.participants?.length || 0;
  const selectedCount = sidebar.selectedParticipants.size;
  const allSelected = totalParticipants > 0 && selectedCount === totalParticipants;

  // Update count display
  const countDisplay = sidebar.element.querySelector('.selection-info .count');
  if (countDisplay) {
    countDisplay.textContent = `${selectedCount}/${totalParticipants}`;
    countDisplay.setAttribute('aria-label', game.i18n.format('STORYFRAME.UI.Tooltips.SelectedCount', { selected: selectedCount, total: totalParticipants }));
  }

  // Update selection-info class
  const selectionInfo = sidebar.element.querySelector('.selection-info');
  if (selectionInfo) {
    selectionInfo.classList.toggle('has-selection', selectedCount > 0);
  }

  // Update select all button
  const selectAllBtn = sidebar.element.querySelector('[data-action="toggleSelectAll"] i');
  if (selectAllBtn) {
    selectAllBtn.className = allSelected ? 'far fa-square' : 'fas fa-check-double';
  }

  // Update check-request-bar ready state
  const requestBar = sidebar.element.querySelector('.check-request-bar');
  if (requestBar) {
    requestBar.classList.toggle('ready', selectedCount > 0 && sidebar.currentDC);
  }

  // Re-render to update lore skills based on new selection
  sidebar.render();
}

/**
 * Remove a participant
 */
export async function onRemoveParticipant(event, target, sidebar) {
  event.stopPropagation();
  const participantId = target.closest('[data-participant-id]')?.dataset.participantId;
  if (!participantId) return;

  await game.storyframe.socketManager.requestRemoveParticipant(participantId);
  sidebar.selectedParticipants.delete(participantId);
}

/**
 * Toggle select all participants
 */
export async function onToggleSelectAll(_event, _target, sidebar) {
  const state = game.storyframe.stateManager.getState();
  const allParticipantIds = (state.participants || []).map((p) => p.id);

  const selectAll = sidebar.selectedParticipants.size !== allParticipantIds.length;

  if (selectAll) {
    sidebar.selectedParticipants = new Set(allParticipantIds);
  } else {
    sidebar.selectedParticipants.clear();
  }

  // Update all participant elements
  const participants = sidebar.element.querySelectorAll('[data-participant-id]');
  participants.forEach((el) => {
    if (selectAll) {
      el.classList.add('selected');
      el.setAttribute('aria-selected', 'true');
    } else {
      el.classList.remove('selected');
      el.setAttribute('aria-selected', 'false');
    }
  });

  // Update the UI elements to reflect the selection change
  updateSelectAllCheckbox(sidebar);

  // Re-render to update lore skills based on new selection
  sidebar.render();
}

/**
 * Update the select all checkbox and count display based on current selection
 */
export function updateSelectAllCheckbox(sidebar) {
  if (!sidebar.element) return;

  const state = game.storyframe.stateManager.getState();
  const totalParticipants = state?.participants?.length || 0;
  const selectedCount = sidebar.selectedParticipants.size;
  const allSelected = totalParticipants > 0 && selectedCount === totalParticipants;

  // Update count display
  const countDisplay = sidebar.element.querySelector('.selection-info .count');
  if (countDisplay) {
    countDisplay.textContent = `${selectedCount}/${totalParticipants}`;
    countDisplay.setAttribute('aria-label', game.i18n.format('STORYFRAME.UI.Tooltips.SelectedCount', { selected: selectedCount, total: totalParticipants }));
  }

  // Update selection-info class
  const selectionInfo = sidebar.element.querySelector('.selection-info');
  if (selectionInfo) {
    if (selectedCount > 0) {
      selectionInfo.classList.add('has-selection');
    } else {
      selectionInfo.classList.remove('has-selection');
    }
  }

  // Update select all button icon and tooltip
  const selectAllBtn = sidebar.element.querySelector('[data-action="toggleSelectAll"]');
  if (selectAllBtn) {
    const icon = selectAllBtn.querySelector('i');
    if (icon) {
      if (allSelected) {
        icon.className = 'far fa-square';
      } else {
        icon.className = 'fas fa-check-double';
      }
    }

    const tooltip = allSelected
      ? game.i18n.localize('STORYFRAME.UI.Tooltips.DeselectAll')
      : game.i18n.localize('STORYFRAME.UI.Tooltips.SelectAll');
    selectAllBtn.setAttribute('data-tooltip', tooltip);
    selectAllBtn.setAttribute('aria-label', tooltip);
  }

  // Update check-request-bar ready state
  const requestBar = sidebar.element.querySelector('.check-request-bar');
  if (requestBar) {
    if (selectedCount > 0 && sidebar.currentDC) {
      requestBar.classList.add('ready');
    } else {
      requestBar.classList.remove('ready');
    }
  }
}

/**
 * Clear all participants
 */
export async function onClearAllParticipants(_event, _target, sidebar) {
  const state = game.storyframe.stateManager.getState();
  if (!state?.participants?.length) return;

  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title: game.i18n.localize('STORYFRAME.Dialogs.ClearAllPCs.Title') },
    content: `<p>${game.i18n.localize('STORYFRAME.Dialogs.ClearAllPCs.Content')}</p>`,
    yes: { label: game.i18n.localize('STORYFRAME.Dialogs.ClearAllPCs.Button') },
    no: { label: game.i18n.localize('STORYFRAME.Dialogs.Cancel'), default: true },
    rejectClose: false,
  });

  if (confirmed) {
    await game.storyframe.socketManager.requestClearAllParticipants();
    sidebar.selectedParticipants.clear();
  }
}

/**
 * Get all player characters
 */
export function getPlayerCharacters() {
  return game.actors.filter((actor) => {
    if (actor.type !== 'character') return false;
    return game.users.some((user) => !user.isGM && actor.testUserPermission(user, 'OWNER'));
  });
}

/**
 * Prepare participant context data for template
 */
export async function prepareParticipantsContext(sidebar, state) {
  if (!state) return { participants: [], hasParticipants: false, selectedCount: 0, allSelected: false };

  // Resolve participants (PCs)
  const participants = await Promise.all(
    (state.participants || []).map(async (p) => {
      const actor = await fromUuid(p.actorUuid);
      return {
        id: p.id,
        actorUuid: p.actorUuid,
        userId: p.userId,
        img: actor?.img || 'icons/svg/mystery-man.svg',
        name: actor?.name || game.i18n.localize('STORYFRAME.UI.Labels.Unknown'),
        selected: sidebar.selectedParticipants.has(p.id),
      };
    }),
  );

  const selectedCount = sidebar.selectedParticipants.size;
  const allSelected = participants.length > 0 && selectedCount === participants.length;

  // Get selected participant data for avatar display
  const selectedParticipantData = participants
    .filter(p => sidebar.selectedParticipants.has(p.id))
    .map(p => ({
      id: p.id,
      name: p.name,
      img: p.img,
    }));

  return {
    participants,
    hasParticipants: participants.length > 0,
    totalParticipants: participants.length,
    selectedCount,
    allSelected,
    hasSelection: selectedCount > 0,
    selectedParticipantData,
  };
}
