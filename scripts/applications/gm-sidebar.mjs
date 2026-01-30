const MODULE_ID = 'storyframe';

function validatePosition(saved) {
  return {
    top: Math.max(0, Math.min(saved.top || 0, window.innerHeight - 50)),
    left: Math.max(0, Math.min(saved.left || 0, window.innerWidth - 100)),
    width: Math.max(200, Math.min(saved.width || 300, window.innerWidth)),
    height: Math.max(150, Math.min(saved.height || 500, window.innerHeight))
  };
}

/**
 * GM Sidebar for StoryFrame
 * Separate window for NPCs and PCs management
 */
export class GMSidebarApp extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: 'storyframe-gm-sidebar',
    classes: ['storyframe', 'gm-sidebar'],
    window: {
      title: 'StoryFrame - Characters',
      icon: 'fas fa-users',
      resizable: true,
      minimizable: true
    },
    position: {
      width: 300,
      height: 500
    },
    actions: {
      addSpeakerFromImage: GMSidebarApp._onAddSpeakerFromImage,
      setSpeaker: GMSidebarApp._onSetSpeaker,
      removeSpeaker: GMSidebarApp._onRemoveSpeaker,
      clearSpeaker: GMSidebarApp._onClearSpeaker,
      togglePCsPanel: GMSidebarApp._onTogglePCsPanel,
      addAllPCs: GMSidebarApp._onAddAllPCs,
      toggleParticipantSelection: GMSidebarApp._onToggleParticipantSelection,
      removeParticipant: GMSidebarApp._onRemoveParticipant,
      toggleSelectAll: GMSidebarApp._onToggleSelectAll,
      requestSkill: GMSidebarApp._onRequestSkill,
      openSkillMenu: GMSidebarApp._onOpenSkillMenu,
      setDCSelect: GMSidebarApp._onSetDCSelect,
      cancelRoll: GMSidebarApp._onCancelRoll
    }
  };

  static PARTS = {
    content: {
      template: 'modules/storyframe/templates/gm-sidebar.hbs',
      scrollable: ['.speaker-gallery', '.panel-content']
    }
  };

  constructor(options = {}) {
    super(options);
    this._stateRestored = false;

    // Panel state
    this.pcsPanelCollapsed = false;
    this.selectedParticipants = new Set();
    this.currentDC = null;

    // Load saved position
    const savedPosition = game.settings.get(MODULE_ID, 'gmSidebarPosition');
    if (savedPosition && Object.keys(savedPosition).length > 0) {
      this.position = { ...this.position, ...validatePosition(savedPosition) };
    }
  }

  async _prepareContext(options) {
    const state = game.storyframe.stateManager.getState();
    if (!state) {
      return {
        speakers: [],
        activeSpeaker: null,
        hasSpeakers: false,
        participants: [],
        hasParticipants: false,
        selectedCount: 0,
        allSelected: false,
        currentDC: null,
        pendingRolls: [],
        quickButtonSkills: [],
        pcsPanelCollapsed: this.pcsPanelCollapsed
      };
    }

    // Resolve speakers (NPCs)
    const speakers = await Promise.all(
      state.speakers.map(async speaker => {
        const resolved = await game.storyframe.stateManager.resolveSpeaker(speaker);
        const result = {
          id: speaker.id,
          img: resolved.img,
          name: resolved.name
        };

        if (speaker.actorUuid) {
          const actor = await fromUuid(speaker.actorUuid);
          if (!actor) {
            result.actorDeleted = true;
          }
        }

        return result;
      })
    );

    // Resolve participants (PCs)
    const participants = await Promise.all(
      (state.participants || []).map(async p => {
        const actor = await fromUuid(p.actorUuid);
        return {
          id: p.id,
          actorUuid: p.actorUuid,
          userId: p.userId,
          img: actor?.img || 'icons/svg/mystery-man.svg',
          name: actor?.name || 'Unknown',
          selected: this.selectedParticipants.has(p.id)
        };
      })
    );

    // Pending rolls with names
    const pendingRolls = await Promise.all(
      (state.pendingRolls || []).map(async r => {
        const participant = state.participants?.find(p => p.id === r.participantId);
        return {
          ...r,
          participantName: participant ? await this._resolveParticipantName(participant) : 'Unknown',
          skillName: this._getSkillName(r.skillSlug)
        };
      })
    );

    // Quick button skills from settings
    const quickSkillsSetting = game.settings.get(MODULE_ID, 'quickButtonSkills');
    const quickSkills = quickSkillsSetting.split(',').map(s => s.trim()).filter(Boolean);
    const quickButtonSkills = quickSkills.map(slug => ({
      slug,
      name: this._getSkillName(slug),
      shortName: this._getSkillShortName(slug)
    }));

    const selectedCount = this.selectedParticipants.size;
    const allSelected = participants.length > 0 && selectedCount === participants.length;

    return {
      speakers,
      activeSpeaker: state.activeSpeaker,
      hasSpeakers: speakers.length > 0,
      participants,
      hasParticipants: participants.length > 0,
      selectedCount,
      allSelected,
      currentDC: this.currentDC,
      pendingRolls,
      quickButtonSkills,
      pcsPanelCollapsed: this.pcsPanelCollapsed
    };
  }

  async _onRender(context, options) {
    super._onRender(context, options);
    this._attachDragDropHandlers();

    if (!this._stateRestored) {
      const wasMinimized = game.settings.get(MODULE_ID, 'gmSidebarMinimized');
      if (wasMinimized) {
        this.minimize();
      }
      this._stateRestored = true;
    }
  }

  _attachDragDropHandlers() {
    // NPC gallery drop zone
    const gallery = this.element.querySelector('.speaker-gallery');
    if (gallery) {
      gallery.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        gallery.classList.add('drag-over');
      });

      gallery.addEventListener('dragleave', (e) => {
        if (e.target === gallery) {
          gallery.classList.remove('drag-over');
        }
      });

      gallery.addEventListener('drop', async (e) => {
        e.preventDefault();
        gallery.classList.remove('drag-over');

        // Try StoryFrameImage data first
        const plainData = e.dataTransfer.getData('text/plain');
        if (plainData) {
          try {
            const imageData = JSON.parse(plainData);
            if (imageData.type === 'StoryFrameImage') {
              const label = await foundry.applications.api.DialogV2.prompt({
                window: { title: 'NPC Name' },
                content: '<input type="text" name="label" placeholder="Enter NPC name" autofocus>',
                ok: {
                  label: 'Add',
                  callback: (event, button, dialog) => button.form.elements.label.value
                },
                rejectClose: false
              });

              if (label) {
                await game.storyframe.socketManager.requestAddSpeaker({
                  imagePath: imageData.src,
                  label
                });
              }
              return;
            }
          } catch (err) {
            // Not JSON, continue to Actor handling
          }
        }

        // Handle Actor drops
        const data = TextEditor.getDragEventData(e);
        if (data.type === 'Actor') {
          const actor = await fromUuid(data.uuid);
          if (!actor) return;

          // Reject player characters
          if (actor.type === 'character') {
            const isPlayerOwned = game.users.some(user =>
              !user.isGM && actor.testUserPermission(user, 'OWNER')
            );
            if (isPlayerOwned) {
              ui.notifications.warn('Player characters should be added to the PCs section');
              return;
            }
          }

          await game.storyframe.socketManager.requestAddSpeaker({
            actorUuid: data.uuid,
            label: actor.name
          });
        }
      });
    }

    // PC drop zone
    const pcZone = this.element.querySelector('[data-drop-zone="participant"]');
    if (pcZone) {
      pcZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        pcZone.classList.add('drag-over');
      });

      pcZone.addEventListener('dragleave', (e) => {
        if (e.target === pcZone) {
          pcZone.classList.remove('drag-over');
        }
      });

      pcZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        pcZone.classList.remove('drag-over');

        const data = TextEditor.getDragEventData(e);
        if (data.type === 'Actor') {
          const actor = await fromUuid(data.uuid);
          if (!actor) return;

          if (actor.type !== 'character') {
            ui.notifications.warn('Only player characters can be added as PCs');
            return;
          }

          const owningUser = game.users.find(user =>
            !user.isGM && actor.testUserPermission(user, 'OWNER')
          );

          if (!owningUser) {
            ui.notifications.warn(`No player owner found for ${actor.name}`);
            return;
          }

          await game.storyframe.socketManager.requestAddParticipant({
            actorUuid: data.uuid,
            userId: owningUser.id
          });
        }
      });
    }
  }

  async _onClose(options) {
    await game.settings.set(MODULE_ID, 'gmSidebarPosition', {
      top: this.position.top,
      left: this.position.left,
      width: this.position.width,
      height: this.position.height
    });
    await game.settings.set(MODULE_ID, 'gmSidebarMinimized', this.minimized);

    return super._onClose(options);
  }

  // --- Helper Methods ---

  _getPlayerCharacters() {
    return game.actors.filter(actor => {
      if (actor.type !== 'character') return false;
      return game.users.some(user =>
        !user.isGM && actor.testUserPermission(user, 'OWNER')
      );
    });
  }

  _getSkillName(slug) {
    const skillMap = {
      'per': 'Perception',
      'acr': 'Acrobatics',
      'arc': 'Arcana',
      'ath': 'Athletics',
      'cra': 'Crafting',
      'dec': 'Deception',
      'dip': 'Diplomacy',
      'itm': 'Intimidation',
      'med': 'Medicine',
      'nat': 'Nature',
      'occ': 'Occultism',
      'prf': 'Performance',
      'rel': 'Religion',
      'soc': 'Society',
      'ste': 'Stealth',
      'sur': 'Survival',
      'thi': 'Thievery'
    };
    return skillMap[slug] || slug.toUpperCase();
  }

  _getSkillShortName(slug) {
    const shortNames = {
      per: 'Per', acr: 'Acr', arc: 'Arc', ath: 'Ath', cra: 'Cra',
      dec: 'Dec', dip: 'Dip', itm: 'Itm', med: 'Med', nat: 'Nat',
      occ: 'Occ', prf: 'Prf', rel: 'Rel', soc: 'Soc', ste: 'Ste',
      sur: 'Sur', thi: 'Thi'
    };
    return shortNames[slug] || slug.substring(0, 3);
  }

  async _resolveParticipantName(participant) {
    const actor = await fromUuid(participant.actorUuid);
    return actor?.name || 'Unknown';
  }

  async _requestSkillCheck(skillSlug, participantIds) {
    const state = game.storyframe.stateManager.getState();
    if (!state) return;

    let sentCount = 0;
    let offlineCount = 0;

    for (const participantId of participantIds) {
      const participant = state.participants.find(p => p.id === participantId);
      if (!participant) continue;

      const user = game.users.get(participant.userId);
      if (!user?.active) {
        offlineCount++;
        continue;
      }

      const requestId = foundry.utils.randomID();
      const request = {
        id: requestId,
        participantId: participant.id,
        actorUuid: participant.actorUuid,
        userId: participant.userId,
        skillSlug,
        dc: this.currentDC,
        timestamp: Date.now()
      };

      await game.storyframe.socketManager.requestAddPendingRoll(request);
      await game.storyframe.socketManager.triggerSkillCheckOnPlayer(participant.userId, request);
      sentCount++;
    }

    const skillName = this._getSkillName(skillSlug);
    if (sentCount > 0) {
      ui.notifications.info(`Requested ${skillName} check from ${sentCount} PC(s)`);
    }
    if (offlineCount > 0) {
      ui.notifications.warn(`${offlineCount} PC(s) offline - skipped`);
    }
  }

  // --- Action Handlers ---

  static async _onAddSpeakerFromImage(event, target) {
    new FilePicker({
      type: 'image',
      callback: async (path) => {
        const label = await foundry.applications.api.DialogV2.prompt({
          window: { title: 'NPC Name' },
          content: '<input type="text" name="label" placeholder="Enter NPC name" autofocus>',
          ok: {
            label: 'Add',
            callback: (event, button, dialog) => button.form.elements.label.value
          },
          rejectClose: false
        });

        if (label) {
          await game.storyframe.socketManager.requestAddSpeaker({
            imagePath: path,
            label
          });
        }
      }
    }).render(true);
  }

  static async _onSetSpeaker(event, target) {
    const speakerId = target.closest('[data-speaker-id]')?.dataset.speakerId;
    if (speakerId) {
      await game.storyframe.socketManager.requestSetActiveSpeaker(speakerId);
    }
  }

  static async _onRemoveSpeaker(event, target) {
    event.stopPropagation();
    const speakerId = target.closest('[data-speaker-id]')?.dataset.speakerId;
    if (!speakerId) return;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: 'Remove NPC' },
      content: '<p>Remove this NPC from the list?</p>',
      yes: { label: 'Remove' },
      no: { label: 'Cancel', default: true },
      rejectClose: false
    });

    if (confirmed) {
      await game.storyframe.socketManager.requestRemoveSpeaker(speakerId);
    }
  }

  static async _onClearSpeaker(event, target) {
    await game.storyframe.socketManager.requestSetActiveSpeaker(null);
  }

  static async _onTogglePCsPanel(event, target) {
    this.pcsPanelCollapsed = !this.pcsPanelCollapsed;
    this.render();
  }

  static async _onAddAllPCs(event, target) {
    const pcs = this._getPlayerCharacters();

    if (pcs.length === 0) {
      ui.notifications.warn('No player characters found');
      return;
    }

    for (const actor of pcs) {
      const owningUser = game.users.find(user =>
        !user.isGM && actor.testUserPermission(user, 'OWNER')
      );

      if (owningUser) {
        await game.storyframe.socketManager.requestAddParticipant({
          actorUuid: actor.uuid,
          userId: owningUser.id
        });
      }
    }

    ui.notifications.info(`Added ${pcs.length} PC(s)`);
  }

  static async _onToggleParticipantSelection(event, target) {
    const participantId = target.closest('[data-participant-id]')?.dataset.participantId;
    if (!participantId) return;

    if (this.selectedParticipants.has(participantId)) {
      this.selectedParticipants.delete(participantId);
    } else {
      this.selectedParticipants.add(participantId);
    }

    this.render();
  }

  static async _onRemoveParticipant(event, target) {
    event.stopPropagation();
    const participantId = target.closest('[data-participant-id]')?.dataset.participantId;
    if (!participantId) return;

    await game.storyframe.socketManager.requestRemoveParticipant(participantId);
    this.selectedParticipants.delete(participantId);
  }

  static async _onToggleSelectAll(event, target) {
    const state = game.storyframe.stateManager.getState();
    const allParticipantIds = (state.participants || []).map(p => p.id);

    if (this.selectedParticipants.size === allParticipantIds.length) {
      this.selectedParticipants.clear();
    } else {
      this.selectedParticipants = new Set(allParticipantIds);
    }

    this.render();
  }

  static async _onRequestSkill(event, target) {
    const skillSlug = target.dataset.skill;
    if (!skillSlug) return;

    if (this.selectedParticipants.size === 0) {
      ui.notifications.warn('No PCs selected');
      return;
    }

    await this._requestSkillCheck(skillSlug, Array.from(this.selectedParticipants));
  }

  static async _onOpenSkillMenu(event, target) {
    const allSkills = [
      { slug: 'per', name: 'Perception' },
      { slug: 'acr', name: 'Acrobatics' },
      { slug: 'arc', name: 'Arcana' },
      { slug: 'ath', name: 'Athletics' },
      { slug: 'cra', name: 'Crafting' },
      { slug: 'dec', name: 'Deception' },
      { slug: 'dip', name: 'Diplomacy' },
      { slug: 'itm', name: 'Intimidation' },
      { slug: 'med', name: 'Medicine' },
      { slug: 'nat', name: 'Nature' },
      { slug: 'occ', name: 'Occultism' },
      { slug: 'prf', name: 'Performance' },
      { slug: 'rel', name: 'Religion' },
      { slug: 'soc', name: 'Society' },
      { slug: 'ste', name: 'Stealth' },
      { slug: 'sur', name: 'Survival' },
      { slug: 'thi', name: 'Thievery' }
    ];

    const appInstance = this;

    // Remove any existing skill menu
    document.querySelector('.storyframe-skill-menu')?.remove();

    // Create popup menu
    const menu = document.createElement('div');
    menu.className = 'storyframe-skill-menu';
    menu.innerHTML = allSkills.map(s =>
      `<button type="button" class="skill-option" data-skill="${s.slug}">${s.name}</button>`
    ).join('');

    // Position near the button
    const rect = target.getBoundingClientRect();
    menu.style.cssText = `
      position: fixed;
      top: ${rect.top - 10}px;
      left: ${rect.right + 5}px;
      z-index: 10000;
      background: var(--color-bg-option);
      border: 1px solid var(--color-border-dark);
      border-radius: 4px;
      padding: 4px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      max-height: 300px;
      overflow-y: auto;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    `;

    // Add click handlers
    menu.querySelectorAll('.skill-option').forEach(btn => {
      btn.style.cssText = `
        padding: 6px 12px;
        background: transparent;
        border: none;
        color: var(--color-text-dark-primary);
        cursor: pointer;
        text-align: left;
        border-radius: 3px;
        font-size: 12px;
      `;
      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'var(--color-bg-btn-hover)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'transparent';
      });
      btn.addEventListener('click', async () => {
        const skillSlug = btn.dataset.skill;
        menu.remove();

        if (appInstance.selectedParticipants.size === 0) {
          ui.notifications.warn('No PCs selected');
          return;
        }
        await appInstance._requestSkillCheck(skillSlug, Array.from(appInstance.selectedParticipants));
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

  static async _onSetDCSelect(event, target) {
    const value = target.value;
    if (value === '') {
      this.currentDC = null;
    } else {
      const dc = parseInt(value);
      if (!isNaN(dc)) {
        this.currentDC = dc;
      }
    }
  }

  static async _onCancelRoll(event, target) {
    const requestId = target.closest('[data-request-id]')?.dataset.requestId;
    if (!requestId) return;

    await game.storyframe.socketManager.requestRemovePendingRoll(requestId);
    ui.notifications.info('Roll request cancelled');
  }
}
