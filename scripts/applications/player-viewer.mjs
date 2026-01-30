const MODULE_ID = 'storyframe';

// Map short skill slugs to full PF2e skill slugs
const SKILL_SLUG_MAP = {
  'per': 'perception', // Special case - uses actor.perception not actor.skills
  'acr': 'acrobatics',
  'arc': 'arcana',
  'ath': 'athletics',
  'cra': 'crafting',
  'dec': 'deception',
  'dip': 'diplomacy',
  'itm': 'intimidation',
  'med': 'medicine',
  'nat': 'nature',
  'occ': 'occultism',
  'prf': 'performance',
  'rel': 'religion',
  'soc': 'society',
  'ste': 'stealth',
  'sur': 'survival',
  'thi': 'thievery'
};

// Inline validatePosition
function validatePosition(saved) {
  return {
    top: Math.max(0, Math.min(saved.top || 0, window.innerHeight - 50)),
    left: Math.max(0, Math.min(saved.left || 0, window.innerWidth - 100)),
    width: Math.max(200, Math.min(saved.width || 400, window.innerWidth)),
    height: Math.max(150, Math.min(saved.height || 300, window.innerHeight))
  };
}

/**
 * Player Viewer for StoryFrame
 * Gallery view showing ALL speakers with active highlight
 */
export class PlayerViewerApp extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: 'storyframe-player-viewer',
    classes: ['storyframe', 'player-viewer'],
    window: {
      title: 'StoryFrame',
      resizable: true,
      minimizable: true,
      icon: 'fas fa-book-open'
    },
    position: {
      width: 400,
      height: 300
    },
    actions: {
      executeRoll: PlayerViewerApp._onExecuteRoll
    }
  };

  static PARTS = {
    content: {
      template: 'modules/storyframe/templates/player-viewer.hbs'
    }
  };

  static HEADER_ACTIONS = {
    toggleLayout: {
      icon: 'fas fa-th',
      label: 'Toggle Layout',
      onclick: function() {
        this._onToggleLayout();
      }
    }
  };

  constructor(options = {}) {
    super(options);
    this._stateRestored = false;

    // Load saved position with validation
    const savedPosition = game.settings.get(MODULE_ID, 'playerViewerPosition');
    if (savedPosition && Object.keys(savedPosition).length > 0) {
      this.position = { ...this.position, ...validatePosition(savedPosition) };
    }
  }

  async _prepareContext(options) {
    const state = game.storyframe.stateManager.getState();
    const layout = game.settings.get(MODULE_ID, 'playerViewerLayout') || 'grid';

    // No speakers - show empty state
    if (!state?.speakers || state.speakers.length === 0) {
      return { empty: true, layout, pendingRolls: [] };
    }

    // Resolve ALL speakers
    const speakers = await this._resolveSpeakers(state.speakers);

    // Find this player's participant
    const myParticipant = state.participants?.find(p => p.userId === game.user.id);

    // Filter pending rolls for this player
    let pendingRolls = [];
    if (myParticipant && state.pendingRolls) {
      pendingRolls = state.pendingRolls
        .filter(roll => roll.participantId === myParticipant.id)
        .map(roll => ({
          ...roll,
          skillName: PlayerViewerApp._getSkillDisplayName(roll.skillSlug)
        }));
    }

    return {
      speakers,
      activeSpeakerId: state.activeSpeaker,
      layout,
      empty: false,
      pendingRolls
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);

    // Restore state on first render only
    if (!this._stateRestored) {
      const wasMinimized = game.settings.get(MODULE_ID, 'playerViewerMinimized');
      if (wasMinimized) {
        this.minimize();
      }
      this._stateRestored = true;
    }
  }

  async _resolveSpeakers(speakers) {
    return Promise.all(speakers.map(s => this._resolveSpeaker(s)));
  }

  async _resolveSpeaker(speaker) {
    if (speaker.actorUuid) {
      const actor = await fromUuid(speaker.actorUuid);
      if (actor) {
        return {
          id: speaker.id,
          img: actor.img,
          name: actor.name
        };
      } else {
        // Actor deleted - use fallback
        return {
          id: speaker.id,
          img: 'icons/svg/mystery-man.svg',
          name: speaker.label || 'Unknown'
        };
      }
    } else {
      // Custom image path
      return {
        id: speaker.id,
        img: speaker.imagePath || 'icons/svg/mystery-man.svg',
        name: speaker.label
      };
    }
  }

  async _onToggleLayout() {
    const current = game.settings.get(MODULE_ID, 'playerViewerLayout') || 'grid';
    const layouts = ['grid', 'list', 'horizontal'];
    const currentIndex = layouts.indexOf(current);
    const nextLayout = layouts[(currentIndex + 1) % layouts.length];

    await game.settings.set(MODULE_ID, 'playerViewerLayout', nextLayout);
    this.render();
  }

  async _onClose(options) {
    // Save window position
    await game.settings.set(MODULE_ID, 'playerViewerPosition', {
      top: this.position.top,
      left: this.position.left,
      width: this.position.width,
      height: this.position.height
    });

    // Save minimized state
    await game.settings.set(MODULE_ID, 'playerViewerMinimized', this.minimized);

    return super._onClose(options);
  }

  /**
   * Method called by socket handler when GM sends a roll request.
   * Triggers re-render to display new roll prompt.
   */
  showRollPrompt(requestData) {
    console.log(`${MODULE_ID} | PlayerViewerApp: showRollPrompt called`, requestData);
    this.render();
  }

  /**
   * Get display name for a skill slug.
   * Static method for use in static action handlers.
   * @param {string} slug - Skill slug (e.g., 'dip', 'per')
   * @returns {string} Display name (e.g., 'Diplomacy', 'Perception')
   */
  static _getSkillDisplayName(slug) {
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
    return skillMap[slug] || slug;
  }

  /**
   * Execute PF2e skill roll when player clicks Roll button.
   * Static method for ApplicationV2 action handler pattern.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Button element
   */
  static async _onExecuteRoll(event, target) {
    const requestId = target.dataset.requestId;
    if (!requestId) {
      console.error(`${MODULE_ID} | No requestId on roll button`);
      return;
    }

    const state = game.storyframe.stateManager.getState();
    const request = state.pendingRolls?.find(r => r.id === requestId);
    if (!request) {
      ui.notifications.warn('Roll request not found');
      return;
    }

    // Find participant and get actor
    const participant = state.participants?.find(p => p.id === request.participantId);
    if (!participant) {
      ui.notifications.error('Participant not found');
      return;
    }

    const actor = await fromUuid(participant.actorUuid);
    if (!actor) {
      ui.notifications.error('Actor not found');
      return;
    }

    // Execute PF2e roll
    try {
      let roll;
      const fullSlug = SKILL_SLUG_MAP[request.skillSlug] || request.skillSlug;

      // Build roll options - only include DC if set
      const rollOptions = { skipDialog: false };
      if (request.dc !== null && request.dc !== undefined) {
        rollOptions.dc = { value: request.dc };
      }

      if (request.skillSlug === 'per') {
        // Perception uses actor.perception.roll()
        roll = await actor.perception.roll(rollOptions);
      } else {
        // Skills use actor.skills[fullSlug].roll()
        const skill = actor.skills?.[fullSlug];
        if (!skill) {
          ui.notifications.error(`Skill "${fullSlug}" not found on actor`);
          return;
        }
        roll = await skill.roll(rollOptions);
      }

      // Extract result data
      const result = {
        requestId: request.id,
        participantId: request.participantId,
        skillSlug: request.skillSlug,
        total: roll.total,
        degreeOfSuccess: roll.degreeOfSuccess?.value || null,
        timestamp: Date.now(),
        chatMessageId: roll.message?.id || null
      };

      // Submit result to GM via socket
      await game.storyframe.socketManager.requestSubmitRollResult(result);

      const skillName = PlayerViewerApp._getSkillDisplayName(request.skillSlug);
      ui.notifications.info(`${skillName} check submitted (${roll.total})`);
    } catch (error) {
      console.error(`${MODULE_ID} | Error executing roll:`, error);
      ui.notifications.error('Failed to execute roll');
    }
  }
}
