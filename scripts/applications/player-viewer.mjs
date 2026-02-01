const MODULE_ID = 'storyframe';

import SystemAdapter from '../system-adapter.mjs';

// Map short skill slugs to full PF2e skill slugs
const PF2E_SKILL_SLUG_MAP = {
  per: 'perception', // Special case - uses actor.perception not actor.skills
  acr: 'acrobatics',
  arc: 'arcana',
  ath: 'athletics',
  cra: 'crafting',
  dec: 'deception',
  dip: 'diplomacy',
  itm: 'intimidation',
  med: 'medicine',
  nat: 'nature',
  occ: 'occultism',
  prf: 'performance',
  rel: 'religion',
  soc: 'society',
  ste: 'stealth',
  sur: 'survival',
  thi: 'thievery',
};

// Map short skill slugs to D&D 5e skill slugs
const DND5E_SKILL_SLUG_MAP = {
  acr: 'acr', // Acrobatics
  ani: 'ani', // Animal Handling
  arc: 'arc', // Arcana
  ath: 'ath', // Athletics
  dec: 'dec', // Deception
  his: 'his', // History
  ins: 'ins', // Insight
  itm: 'itm', // Intimidation
  inv: 'inv', // Investigation
  med: 'med', // Medicine
  nat: 'nat', // Nature
  prc: 'prc', // Perception
  prf: 'prf', // Performance
  per: 'per', // Persuasion
  rel: 'rel', // Religion
  slt: 'slt', // Sleight of Hand
  ste: 'ste', // Stealth
  sur: 'sur', // Survival
};

// Get the appropriate skill slug map for the current system
function getSkillSlugMap() {
  const system = SystemAdapter.detectSystem();
  return system === 'dnd5e' ? DND5E_SKILL_SLUG_MAP : PF2E_SKILL_SLUG_MAP;
}

// Map action slugs to PF2e action identifiers
const ACTION_DISPLAY_NAMES = {
  seek: 'Seek',
  'sense-direction': 'Sense Direction',
  balance: 'Balance',
  'tumble-through': 'Tumble Through',
  'maneuver-in-flight': 'Maneuver in Flight',
  squeeze: 'Squeeze',
  'recall-knowledge': 'Recall Knowledge',
  'decipher-writing': 'Decipher Writing',
  'identify-magic': 'Identify Magic',
  'learn-spell': 'Learn a Spell',
  climb: 'Climb',
  'force-open': 'Force Open',
  grapple: 'Grapple',
  'high-jump': 'High Jump',
  'long-jump': 'Long Jump',
  shove: 'Shove',
  swim: 'Swim',
  trip: 'Trip',
  disarm: 'Disarm',
  repair: 'Repair',
  craft: 'Craft',
  'identify-alchemy': 'Identify Alchemy',
  'create-a-diversion': 'Create a Diversion',
  impersonate: 'Impersonate',
  lie: 'Lie',
  feint: 'Feint',
  'gather-information': 'Gather Information',
  'make-an-impression': 'Make an Impression',
  request: 'Request',
  coerce: 'Coerce',
  demoralize: 'Demoralize',
  'administer-first-aid': 'Administer First Aid',
  'treat-disease': 'Treat Disease',
  'treat-poison': 'Treat Poison',
  'treat-wounds': 'Treat Wounds',
  'command-an-animal': 'Command an Animal',
  perform: 'Perform',
  'create-forgery': 'Create Forgery',
  subsist: 'Subsist',
  'conceal-an-object': 'Conceal an Object',
  hide: 'Hide',
  sneak: 'Sneak',
  track: 'Track',
  'cover-tracks': 'Cover Tracks',
  'palm-an-object': 'Palm an Object',
  steal: 'Steal',
  'pick-a-lock': 'Pick a Lock',
  'disable-device': 'Disable Device',
};

// Inline validatePosition
function validatePosition(saved) {
  return {
    top: Math.max(0, Math.min(saved.top || 0, window.innerHeight - 50)),
    left: Math.max(0, Math.min(saved.left || 0, window.innerWidth - 100)),
    width: Math.max(200, Math.min(saved.width || 400, window.innerWidth)),
    height: Math.max(150, Math.min(saved.height || 300, window.innerHeight)),
  };
}

/**
 * Player Viewer for StoryFrame
 * Gallery view showing ALL speakers with active highlight
 */
export class PlayerViewerApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
) {
  static DEFAULT_OPTIONS = {
    id: 'storyframe-player-viewer',
    classes: ['storyframe', 'player-viewer'],
    window: {
      title: 'StoryFrame',
      resizable: true,
      minimizable: true,
      icon: 'fas fa-book-open',
    },
    position: {
      width: 400,
      height: 300,
    },
    actions: {
      executeRoll: PlayerViewerApp._onExecuteRoll,
    },
  };

  static PARTS = {
    content: {
      template: 'modules/storyframe/templates/player-viewer.hbs',
    },
  };

  static HEADER_ACTIONS = {
    toggleLayout: {
      icon: 'fas fa-th',
      label: 'Toggle Layout',
      onclick: function () {
        this._onToggleLayout();
      },
    },
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

  async _prepareContext(_options) {
    const state = game.storyframe.stateManager.getState();
    const layout = game.settings.get(MODULE_ID, 'playerViewerLayout') || 'grid';

    // Find ALL participants for this player (they may control multiple PCs)
    const myParticipants = state?.participants?.filter((p) => p.userId === game.user.id) || [];
    const myParticipantIds = new Set(myParticipants.map(p => p.id));
    let pendingRolls = [];

    // Check if DCs should be shown to players based on system settings
    const currentSystem = SystemAdapter.detectSystem();
    let showDCs = true;

    if (currentSystem === 'pf2e') {
      // PF2e: Check metagame setting
      showDCs = game.pf2e?.settings?.metagame?.dcs ?? true;
    } else if (currentSystem === 'dnd5e') {
      // D&D 5e: Check challenge visibility setting
      const challengeVisibility = game.settings?.get('dnd5e', 'challengeVisibility') ?? 'all';
      // Show DC if: 'all' OR ('gm' AND user is GM)
      showDCs = challengeVisibility === 'all' || (challengeVisibility === 'gm' && game.user.isGM);
    }

    // Group pending rolls by actor
    let actorRollGroups = [];
    if (myParticipantIds.size > 0 && state?.pendingRolls) {
      const rolls = await Promise.all(
        state.pendingRolls
          .filter((roll) => myParticipantIds.has(roll.participantId))
          .map(async (roll) => {
            // Get participant and actor info
            const participant = state.participants.find(p => p.id === roll.participantId);
            const actor = participant ? await fromUuid(participant.actorUuid) : null;

            return {
              ...roll,
              skillName: PlayerViewerApp._getSkillDisplayName(roll.skillSlug),
              actionName: roll.actionSlug ? ACTION_DISPLAY_NAMES[roll.actionSlug] || null : null,
              dc: showDCs ? roll.dc : null,
              actorName: actor?.name || 'Unknown',
              actorImg: actor?.img || 'icons/svg/mystery-man.svg',
              actorId: participant?.actorUuid || 'unknown',
            };
          })
      );

      // Group by actor
      const groupedByActor = rolls.reduce((acc, roll) => {
        if (!acc[roll.actorId]) {
          acc[roll.actorId] = {
            actorId: roll.actorId,
            actorName: roll.actorName,
            actorImg: roll.actorImg,
            rolls: [],
          };
        }
        acc[roll.actorId].rolls.push(roll);
        return acc;
      }, {});

      actorRollGroups = Object.values(groupedByActor);
    }

    // No speakers - show empty state but still include pending rolls
    if (!state?.speakers || state.speakers.length === 0) {
      return { empty: true, layout, actorRollGroups };
    }

    // Resolve ALL speakers
    const speakers = await this._resolveSpeakers(state.speakers);

    return {
      speakers,
      activeSpeakerId: state.activeSpeaker,
      layout,
      empty: false,
      actorRollGroups,
    };
  }

  _onRender(context, _options) {
    super._onRender(context, _options);

    // Restore state on first render only
    if (!this._stateRestored) {
      const wasMinimized = game.settings.get(MODULE_ID, 'playerViewerMinimized');
      if (wasMinimized) {
        this.minimize();
      }
      this._stateRestored = true;
    }

    // Calculate optimal grid layout
    this._updateGridLayout(context);

    // Attach right-click handler for image enlargement
    this._attachImageContextMenu();
  }

  /**
   * Calculate and set optimal grid columns/rows based on speaker count
   */
  _updateGridLayout(context) {
    const gallery = this.element.querySelector('.speaker-gallery');
    if (!gallery || context.empty) return;

    const speakerCount = context.speakers?.length || 0;
    if (speakerCount === 0) return;

    // Calculate optimal grid dimensions
    const { columns, rows } = this._calculateGridDimensions(speakerCount);

    gallery.style.setProperty('--speaker-columns', columns);
    gallery.style.setProperty('--speaker-rows', rows);
  }

  /**
   * Calculate optimal grid dimensions for a given number of items
   */
  _calculateGridDimensions(count) {
    if (count <= 1) return { columns: 1, rows: 1 };
    if (count <= 2) return { columns: 2, rows: 1 };
    if (count <= 4) return { columns: 2, rows: 2 };
    if (count <= 6) return { columns: 3, rows: 2 };
    if (count <= 9) return { columns: 3, rows: 3 };
    if (count <= 12) return { columns: 4, rows: 3 };
    // For larger counts, aim for roughly square grid
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    return { columns: cols, rows };
  }

  /**
   * Attach right-click context menu for image enlargement
   */
  _attachImageContextMenu() {
    const images = this.element.querySelectorAll('.speaker-item img');
    images.forEach((img) => {
      img.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this._showEnlargedImage(img.src, img.alt);
      });
    });
  }

  /**
   * Show enlarged image in a popup
   */
  _showEnlargedImage(src, name) {
    // Remove existing popup if any
    document.querySelector('.storyframe-image-popup')?.remove();

    const popup = document.createElement('div');
    popup.className = 'storyframe-image-popup';
    popup.innerHTML = `
      <div class="popup-backdrop"></div>
      <div class="popup-content">
        <img src="${src}" alt="${name}">
        <div class="popup-name">${name}</div>
      </div>
    `;

    // Close on click anywhere
    popup.addEventListener('click', () => popup.remove());

    // Close on escape key
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        popup.remove();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    document.body.appendChild(popup);
  }

  async _resolveSpeakers(speakers) {
    return Promise.all(speakers.map((s) => this._resolveSpeaker(s)));
  }

  async _resolveSpeaker(speaker) {
    if (speaker.actorUuid) {
      const actor = await fromUuid(speaker.actorUuid);
      if (actor) {
        return {
          id: speaker.id,
          img: actor.img,
          name: actor.name,
        };
      } else {
        // Actor deleted - use fallback
        return {
          id: speaker.id,
          img: 'icons/svg/mystery-man.svg',
          name: speaker.label || 'Unknown',
        };
      }
    } else {
      // Custom image path
      return {
        id: speaker.id,
        img: speaker.imagePath || 'icons/svg/mystery-man.svg',
        name: speaker.label,
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

  async _onClose(_options) {
    // Save window position
    await game.settings.set(MODULE_ID, 'playerViewerPosition', {
      top: this.position.top,
      left: this.position.left,
      width: this.position.width,
      height: this.position.height,
    });

    // Save minimized state
    await game.settings.set(MODULE_ID, 'playerViewerMinimized', this.minimized);

    return super._onClose(_options);
  }

  /**
   * Method called by socket handler when GM sends a roll request.
   * Triggers re-render to display new roll prompt.
   */
  showRollPrompt(_requestData) {
    this.render();
  }

  /**
   * Get display name for a skill slug.
   * Static method for use in static action handlers.
   * @param {string} slug - Skill slug (e.g., 'dip', 'per')
   * @returns {string} Display name (e.g., 'Diplomacy', 'Perception')
   */
  static _getSkillDisplayName(slug) {
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
   * Execute PF2e skill roll when player clicks Roll button.
   * Static method for ApplicationV2 action handler pattern.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Button element
   */
  static async _onExecuteRoll(_event, target) {
    const requestId = target.dataset.requestId;
    if (!requestId) {
      console.error(`${MODULE_ID} | No requestId on roll button`);
      return;
    }

    const state = game.storyframe.stateManager.getState();
    const request = state.pendingRolls?.find((r) => r.id === requestId);
    if (!request) {
      ui.notifications.warn('Roll request not found');
      return;
    }

    // Find participant and get actor
    const participant = state.participants?.find((p) => p.id === request.participantId);
    if (!participant) {
      ui.notifications.error('Participant not found');
      return;
    }

    const actor = await fromUuid(participant.actorUuid);
    if (!actor) {
      ui.notifications.error('Actor not found');
      return;
    }

    // Execute roll based on system
    try {
      let roll;
      let actionExecuted = false;
      const currentSystem = SystemAdapter.detectSystem();
      const skillSlugMap = getSkillSlugMap();
      const fullSlug = skillSlugMap[request.skillSlug] || request.skillSlug;

      // Build roll options - only include DC if set
      const rollOptions = { skipDialog: false };
      if (request.dc !== null && request.dc !== undefined) {
        rollOptions.dc = { value: request.dc };
      }
      // Add blind roll mode if secret
      if (request.isSecretRoll) {
        rollOptions.rollMode = CONST.DICE_ROLL_MODES.BLIND;
      }

      if (currentSystem === 'pf2e') {
        // PF2e: Use action system if actionSlug provided
        if (request.actionSlug && game.pf2e?.actions) {
          actionExecuted = true;
          roll = await PlayerViewerApp._tryExecuteAction(actor, request.actionSlug, rollOptions);
        }

        // PF2e: Basic skill roll if no action
        if (!actionExecuted) {
          if (request.skillSlug === 'per') {
            // Perception uses actor.perception.roll()
            roll = await actor.perception.roll(rollOptions);
          } else {
            // Skills use actor.skills[fullSlug].roll()
            console.log('StoryFrame | Looking for skill:', { fullSlug, skills: actor.skills });
            const skill = actor.skills?.[fullSlug];
            if (!skill) {
              console.error('StoryFrame | Skill not found:', { fullSlug, availableSkills: Object.keys(actor.skills || {}) });
              ui.notifications.error(`Skill "${fullSlug}" not found on actor`);
              return;
            }
            roll = await skill.roll(rollOptions);
          }
        }
      } else if (currentSystem === 'dnd5e') {
        // D&D 5e: Use actor.rollSkill method
        // D&D 5e doesn't use actions, so ignore actionSlug

        // D&D 5e v4 API: rollSkill(config={}, dialog={}, message={})
        const config = { skill: fullSlug };
        const dialogConfig = {};
        const messageConfig = {};

        // Add DC for success/failure evaluation
        if (request.dc !== null && request.dc !== undefined) {
          config.target = request.dc;

          // Check D&D 5e challenge visibility setting
          const challengeVisibility = game.settings?.get('dnd5e', 'challengeVisibility') ?? 'all';

          // Show DC in message flavor only if visibility setting allows
          // 'all' = everyone sees DCs, 'gm' = only GM sees, 'none' = no one sees in chat
          if (challengeVisibility === 'all' || (challengeVisibility === 'gm' && game.user.isGM)) {
            const skillName = PlayerViewerApp._getSkillDisplayName(request.skillSlug);
            messageConfig.flavor = `${skillName} Check (DC ${request.dc})`;
          }
        }

        // Add secret roll mode if requested
        if (request.isSecretRoll) {
          messageConfig.rollMode = CONST.DICE_ROLL_MODES.BLIND;
        }

        const rollResult = await actor.rollSkill(config, dialogConfig, messageConfig);
        // D&D 5e rollSkill may return an array or single roll
        roll = Array.isArray(rollResult) ? rollResult[0] : rollResult;
      } else {
        ui.notifications.error(`Unsupported system: ${currentSystem}`);
        return;
      }

      // Check if roll was successful (not cancelled)
      if (!roll) {
        console.log('StoryFrame | Roll cancelled by player');
        return;
      }

      // Extract result data (handle both PF2e and D&D 5e formats)
      const result = {
        requestId: request.id,
        participantId: request.participantId,
        skillSlug: request.skillSlug,
        actionSlug: request.actionSlug,
        total: roll.total ?? 0,
        // PF2e has degreeOfSuccess, D&D 5e doesn't
        degreeOfSuccess: roll.degreeOfSuccess?.value || null,
        timestamp: Date.now(),
        chatMessageId: roll.message?.id || null,
      };

      // Submit result to GM via socket
      await game.storyframe.socketManager.requestSubmitRollResult(result);

      const skillName = PlayerViewerApp._getSkillDisplayName(request.skillSlug);
      const actionName = request.actionSlug ? ACTION_DISPLAY_NAMES[request.actionSlug] : null;
      const displayName = actionName ? `${skillName} (${actionName})` : skillName;
      ui.notifications.info(`${displayName} check submitted (${roll.total ?? 'N/A'})`);
    } catch (error) {
      console.error(`${MODULE_ID} | Error executing roll:`, error);
      ui.notifications.error('Failed to execute roll');
    }
  }

  /**
   * Try to execute a PF2e action using the game.pf2e.actions system.
   * @param {Actor} actor - The actor performing the action
   * @param {string} actionSlug - The action slug (e.g., 'demoralize', 'request')
   * @param {Object} rollOptions - Roll options including DC
   * @returns {Object|null} The roll result or null if action couldn't be executed
   */
  static async _tryExecuteAction(actor, actionSlug, rollOptions) {
    try {
      // Map our action slugs to PF2e action identifiers
      const pf2eActionMap = {
        demoralize: 'demoralize',
        feint: 'feint',
        grapple: 'grapple',
        shove: 'shove',
        trip: 'trip',
        disarm: 'disarm',
        balance: 'balance',
        'tumble-through': 'tumbleThrough',
        'maneuver-in-flight': 'maneuverInFlight',
        climb: 'climb',
        'force-open': 'forceOpen',
        'high-jump': 'highJump',
        'long-jump': 'longJump',
        swim: 'swim',
        seek: 'seek',
        hide: 'hide',
        sneak: 'sneak',
        'create-a-diversion': 'createADiversion',
        request: 'request',
        coerce: 'coerce',
        'make-an-impression': 'makeAnImpression',
        'gather-information': 'gatherInformation',
        lie: 'lie',
        impersonate: 'impersonate',
        'treat-wounds': 'treatWounds',
        'administer-first-aid': 'administerFirstAid',
        'command-an-animal': 'commandAnAnimal',
        'pick-a-lock': 'pickALock',
        'disable-device': 'disableDevice',
        steal: 'steal',
        'palm-an-object': 'palmAnObject',
        perform: 'perform',
        'recall-knowledge': 'recallKnowledge',
        'sense-direction': 'senseDirection',
        track: 'track',
        subsist: 'subsist',
      };

      const pf2eActionSlug = pf2eActionMap[actionSlug];
      if (!pf2eActionSlug) {
        return null;
      }

      // Check if the action exists in game.pf2e.actions
      const actionFn = game.pf2e.actions[pf2eActionSlug];
      if (typeof actionFn !== 'function') {
        return null;
      }

      // Build action options
      const actionOptions = {
        actors: [actor],
        skipDialog: false,
      };

      // Add DC if provided
      if (rollOptions.dc) {
        actionOptions.difficultyClass = rollOptions.dc;
      }

      // Execute the action - returns an array of results
      const results = await actionFn(actionOptions);

      // Return the first roll result if available
      if (results && results.length > 0 && results[0].roll) {
        return results[0].roll;
      }

      // Some actions return differently, try to extract the roll
      if (results && results[0]?.message) {
        return { total: 0, message: results[0].message };
      }

      return null;
    } catch (error) {
      console.warn(`${MODULE_ID} | Failed to execute PF2e action ${actionSlug}:`, error);
      return null;
    }
  }
}
