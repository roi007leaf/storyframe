import { MODULE_ID } from '../constants.mjs';
import SystemAdapter from '../system-adapter.mjs';
import { DND5E_SKILL_SLUG_MAP } from '../system/dnd5e/skills.mjs';
import { PF2E_ACTION_DISPLAY_NAMES } from '../system/pf2e/actions.mjs';
import { PF2E_SKILL_SLUG_MAP } from '../system/pf2e/skills.mjs';
import { DAGGERHEART_TRAIT_FULL_NAMES } from '../system/daggerheart/skills.mjs';

// Get the appropriate skill slug map for the current system
function getSkillSlugMap() {
  const system = SystemAdapter.detectSystem();
  if (system === 'dnd5e') return DND5E_SKILL_SLUG_MAP;
  if (system === 'daggerheart') return DAGGERHEART_TRAIT_FULL_NAMES;
  return PF2E_SKILL_SLUG_MAP;
}

// Inline validatePosition
function validatePosition(saved) {
  return {
    top: Math.max(0, Math.min(saved.top || 0, window.innerHeight - 50)),
    left: Math.max(0, Math.min(saved.left || 0, window.innerWidth - 100)),
    width: Math.max(200, Math.min(saved.width || 400, window.innerWidth)),
    height: Math.max(150, Math.min(saved.height || 300, window.innerHeight)),
  };
}

// Import action variant helpers
import { showActionVariantsPopup, hideActionVariantsPopup } from './gm-sidebar/managers/ui-helpers.mjs';

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
      title: 'STORYFRAME.WindowTitles.PlayerViewer',
      resizable: true,
      minimizable: true,
      icon: 'fas fa-book-open',
    },
    position: {
      width: 600,
      height: 500,
    },
    actions: {
      executeRoll: PlayerViewerApp._onExecuteRoll,
      selectChallengeOption: PlayerViewerApp._onSelectChallengeOption,
    },
  };

  static PARTS = {
    content: {
      template: 'modules/storyframe/templates/player-viewer.hbs',
      scrollable: ['.speaker-gallery', '.sidebar-content', '.challenge-options'],
    },
  };

  static HEADER_ACTIONS = {
    toggleLayout: {
      icon: 'fas fa-th',
      label: 'STORYFRAME.UI.Labels.ToggleLayout',
      onclick: function () {
        this._onToggleLayout();
      },
    },
  };

  /**
   * Check if player has relevant content (rolls/challenges for them)
   * @param {Object} state - StoryFrame state
   * @param {string} userId - Player user ID
   * @returns {boolean} True if player has pending rolls or relevant challenges
   */
  static hasPlayerRelevantContent(state, userId) {
    if (!state) return false;

    // Check pending rolls by userId
    const hasPendingRolls =
      state.pendingRolls?.some((roll) => roll.userId === userId) || false;

    // Check active challenges (broadcast to all players)
    const hasRelevantChallenges = (state.activeChallenges?.length || 0) > 0;

    return hasPendingRolls || hasRelevantChallenges;
  }

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

    // Filter by current user ID
    const myUserId = game.user.id;

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

    // Check if active challenges apply to this player
    let activeChallenge = null;
    if (state?.activeChallenges && state.activeChallenges.length > 0) {
      // Use first challenge for backward compatibility
      const firstChallenge = state.activeChallenges[0];
      const enrichedOptions = firstChallenge.options.map(opt => ({
        ...opt,
        skillOptionsDisplay: opt.skillOptions.map(so => ({
          ...so,
          skillName: PlayerViewerApp._getSkillDisplayName(so.skill),
          dc: so.dc, // Always include actual DC (needed for roll)
          action: so.action || null,
          showDC: showDCs, // Flag to control display only
        })),
      }));

      activeChallenge = {
        ...firstChallenge,
        options: enrichedOptions,
      };
    }

    // Group pending rolls by actor
    let actorRollGroups = [];
    if (state?.pendingRolls) {
      const rolls = await Promise.all(
        state.pendingRolls
          .filter((roll) => roll.userId === myUserId)
          .map(async (roll) => {
            // Get actor info from roll's actorUuid
            const actor = roll.actorUuid ? await fromUuid(roll.actorUuid) : null;
            let actorName = actor?.name || game.i18n.localize('STORYFRAME.UI.Labels.Unknown');

            // Build action name with variant if present
            let actionName = null;
            if (roll.actionSlug) {
              actionName = PF2E_ACTION_DISPLAY_NAMES[roll.actionSlug] || null;
              if (roll.actionVariant && actionName) {
                const variantName = roll.actionVariant.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                actionName = `${actionName}: ${variantName}`;
              }
            }

            return {
              ...roll,
              skillName: PlayerViewerApp._getSkillDisplayName(roll.skillSlug),
              actionName,
              dc: showDCs ? roll.dc : null,
              actorName,
              actorImg: actor?.img || 'icons/svg/mystery-man.svg',
              actorId: roll.actorUuid || 'unknown',
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
      return { empty: true, layout, actorRollGroups, activeChallenge };
    }

    // Filter hidden speakers from player view (GM always sees all)
    const visibleSpeakers = game.user.isGM
      ? state.speakers
      : state.speakers.filter((s) => !s.isHidden);

    // Resolve active speaker for spotlight
    let activeSpeaker = null;
    if (state.activeSpeaker) {
      const activeSpeakerData = visibleSpeakers.find((s) => s.id === state.activeSpeaker);
      if (activeSpeakerData) {
        activeSpeaker = await this._resolveSpeaker(activeSpeakerData);
      }
    }

    // Active speaker is shown in spotlight — exclude from gallery
    const gallerySpeakers = activeSpeaker
      ? visibleSpeakers.filter((s) => s.id !== state.activeSpeaker)
      : visibleSpeakers;

    const speakers = await this._resolveSpeakers(gallerySpeakers);
    const activeSpeakerId = activeSpeaker ? null : state.activeSpeaker;

    return {
      speakers,
      activeSpeakerId,
      activeSpeaker,
      layout,
      empty: false,
      actorRollGroups,
      activeChallenge,
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
    // Clean up old handlers first
    if (this._imageContextHandlers) {
      this._imageContextHandlers.forEach(({ img, handler }) => {
        img.removeEventListener('contextmenu', handler);
      });
    }
    this._imageContextHandlers = [];

    const images = this.element.querySelectorAll('.speaker-item img');
    images.forEach((img) => {
      const handler = (e) => {
        e.preventDefault();
        this._showEnlargedImage(img.src, img.alt);
      };
      img.addEventListener('contextmenu', handler);
      this._imageContextHandlers.push({ img, handler });
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

  /**
   * Attach action variant hover handlers
   */
  _attachActionVariantHoverHandlers() {
    const actionButtons = this.element.querySelectorAll('[data-action-slug]');

    actionButtons.forEach((btn) => {
      let hoverTimeout = null;

      btn.addEventListener('mouseenter', (e) => {
        const actionSlug = btn.dataset.actionSlug;
        if (!actionSlug) return;

        // Delay showing popup slightly
        hoverTimeout = setTimeout(() => {
          showActionVariantsPopup(e, actionSlug, this);
        }, 300);
      });

      btn.addEventListener('mouseleave', () => {
        clearTimeout(hoverTimeout);
        hideActionVariantsPopup();
      });
    });
  }

  async _resolveSpeakers(speakers) {
    return Promise.all(speakers.map((s) => this._resolveSpeaker(s)));
  }

  async _resolveSpeaker(speaker) {
    let name;
    let img;

    if (speaker.actorUuid) {
      const actor = await fromUuid(speaker.actorUuid);
      if (actor) {
        // Use imagePath override if set, otherwise fall back to actor portrait
        img = speaker.imagePath || actor.img;
        name = actor.name;
      } else {
        // Actor deleted - use fallback
        img = 'icons/svg/mystery-man.svg';
        name = speaker.label || game.i18n.localize('STORYFRAME.UI.Labels.Unknown');
      }
    } else {
      // Custom image path
      img = speaker.imagePath || 'icons/svg/mystery-man.svg';
      name = speaker.label;
    }

    // Hide name from players if flag is set
    if (speaker.isNameHidden && !game.user.isGM) {
      name = game.i18n.localize('STORYFRAME.UI.Labels.Unknown');
    }

    return {
      id: speaker.id,
      img,
      name,
    };
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

    // Clean up image context handlers
    if (this._imageContextHandlers) {
      this._imageContextHandlers.forEach(({ img, handler }) => {
        img.removeEventListener('contextmenu', handler);
      });
      this._imageContextHandlers = null;
    }

    // Remove any lingering image popups
    document.querySelector('.storyframe-image-popup')?.remove();

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
      ui.notifications.warn(game.i18n.localize('STORYFRAME.Notifications.Roll.RequestNotFound'));
      return;
    }

    // Get actor directly from request
    const actor = await fromUuid(request.actorUuid);
    if (!actor) {
      ui.notifications.error(game.i18n.localize('STORYFRAME.Notifications.Roll.ActorNotFound'));
      if (request.isSecretRoll) {
        await game.storyframe.socketManager.requestRemovePendingRoll(requestId);
      }
      return;
    }

    // Execute roll based on system
    try {
      let roll;
      let actionExecuted = false;
      const currentSystem = SystemAdapter.detectSystem();
      const skillSlugMap = getSkillSlugMap();
      const fullSlug = skillSlugMap[request.skillSlug] || request.skillSlug;

      // Determine if this is a save or skill check
      const checkType = request.checkType || 'skill';

      // Build roll options - only include DC if set
      const rollOptions = { skipDialog: false };
      if (request.dc !== null && request.dc !== undefined) {
        rollOptions.dc = { value: request.dc };
      }
      // Add action variant if provided
      if (request.actionVariant) {
        rollOptions.variant = request.actionVariant;
      }
      // Add blind roll mode if secret
      if (request.isSecretRoll) {
        rollOptions.rollMode = CONST.DICE_ROLL_MODES.BLIND;
        // Store info so createChatMessage hook can detect and notify GM
        window._storyframeCurrentBlindRoll = {
          requestId: requestId,
          actorId: actor.id,
        };
      }

      if (currentSystem === 'pf2e') {
        if (checkType === 'save') {
          // PF2e: Saving throw
          const save = actor.saves?.[fullSlug];
          if (!save) {
            ui.notifications.error(game.i18n.format('STORYFRAME.Notifications.Roll.SaveNotFound', { save: fullSlug, actor: actor.name }));
            return;
          }
          roll = await save.roll(rollOptions);
        } else {
          // PF2e: Use action system if actionSlug provided
          if (request.actionSlug && game.pf2e?.actions) {
            roll = await PlayerViewerApp._tryExecuteAction(actor, request.actionSlug, rollOptions);
            if (roll) {
              actionExecuted = true;
            }
          }

          // PF2e: Basic skill roll if no action or action failed
          if (!actionExecuted) {
            if (request.skillSlug === 'per') {
              // Perception uses actor.perception.roll()
              roll = await actor.perception.roll(rollOptions);
            } else {
              // Try to find the skill - check both actor.skills and actor.system.skills for lore skills
              let skill = actor.skills?.[fullSlug];

              // If not found and it's a lore skill, try actor.system.skills
              if (!skill && fullSlug.includes('-lore')) {
                skill = actor.system?.skills?.[fullSlug];
              }

              if (!skill) {
                ui.notifications.error(game.i18n.format('STORYFRAME.Notifications.Roll.SkillNotFound', { skill: fullSlug, actor: actor.name }));
                return;
              }
              roll = await skill.roll(rollOptions);
            }
          }
        }
      } else if (currentSystem === 'dnd5e') {
        // D&D 5e: Use actor.rollSkill or actor.rollAbilitySave method
        // D&D 5e doesn't use actions, so ignore actionSlug

        const config = {};
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
            const displayName = PlayerViewerApp._getSkillDisplayName(request.skillSlug);
            const checkLabel = checkType === 'save' ? 'Save' : 'Check';
            messageConfig.flavor = `${displayName} ${checkLabel} (DC ${request.dc})`;
          }
        }

        // Add secret roll mode if requested
        if (request.isSecretRoll) {
          messageConfig.rollMode = CONST.DICE_ROLL_MODES.BLIND;
        }

        let rollResult;
        if (checkType === 'save') {
          // D&D 5e: Saving throw
          config.ability = fullSlug;
          rollResult = await actor.rollSavingThrow(config, dialogConfig, messageConfig);
        } else {
          // D&D 5e: Skill check
          config.skill = fullSlug;
          rollResult = await actor.rollSkill(config, dialogConfig, messageConfig);
        }
        // D&D 5e rollSkill/rollSavingThrow may return an array or single roll
        roll = Array.isArray(rollResult) ? rollResult[0] : rollResult;
      } else if (currentSystem === 'daggerheart') {
        // Daggerheart: Use actor.diceRoll() with trait config
        // fullSlug is the full trait name (e.g., 'agility') from DAGGERHEART_TRAIT_FULL_NAMES
        const dhConfig = {
          roll: {
            trait: fullSlug,
            type: 'trait',
          },
          hasRoll: true,
          actionType: null,
        };
        if (request.dc !== null && request.dc !== undefined) {
          dhConfig.roll.difficulty = request.dc;
        }
        roll = await actor.diceRoll(dhConfig);
      } else {
        ui.notifications.error(game.i18n.format('STORYFRAME.Notifications.Roll.UnsupportedSystem', { system: currentSystem }));
        if (request.isSecretRoll) {
          await game.storyframe.socketManager.requestRemovePendingRoll(requestId);
        }
        return;
      }

      // Check if roll was successful (not cancelled)
      if (!roll) {
        // For blind rolls, closeCheckModifiersDialog hook will handle notification
        // Don't clear blind roll info - let the hook determine if rolled or cancelled
        return;
      }

      // Extract result data (handle both PF2e and D&D 5e formats)
      const result = {
        requestId: request.id,
        actorUuid: request.actorUuid,
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

      // If this roll was part of an "allow only one" group, dismiss other rolls for this actor
      if (request.batchGroupId && request.allowOnlyOne) {
        await PlayerViewerApp._dismissGroupRolls(
          request.batchGroupId,
          request.actorUuid,
          requestId
        );
      }
    } catch (error) {
      console.error(`${MODULE_ID} | Error executing roll:`, error);
      ui.notifications.error(game.i18n.localize('STORYFRAME.Notifications.Roll.RollFailed'));
      // Leave pending roll on error - player can retry
      // Exception: For secret rolls, remove pending roll as GM handles it
      if (request.isSecretRoll) {
        await game.storyframe.socketManager.requestRemovePendingRoll(requestId);
      }
    }
  }

  /**
   * Dismiss other rolls in an "allow only one" group for the same actor.
   * Called after a player successfully executes a roll from a grouped batch.
   * @param {string} batchGroupId - The shared group ID
   * @param {string} actorUuid - The actor UUID who rolled (only dismiss their other rolls)
   * @param {string} executedRequestId - The request that was executed (don't dismiss this one)
   */
  static async _dismissGroupRolls(batchGroupId, actorUuid, executedRequestId) {
    const state = game.storyframe.stateManager.getState();
    if (!state?.pendingRolls) return;

    // Find other rolls in the same group for the same actor
    const otherRolls = state.pendingRolls.filter(
      r => r.batchGroupId === batchGroupId
        && r.actorUuid === actorUuid
        && r.id !== executedRequestId
    );

    if (otherRolls.length === 0) return;

    // Remove all other rolls in group for this actor
    for (const roll of otherRolls) {
      await game.storyframe.socketManager.requestRemovePendingRoll(roll.id);
    }
  }

  /**
   * Handle challenge option selection.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Button element
   */
  static async _onSelectChallengeOption(_event, target) {
    const checkSlug = target.dataset.skill;
    const checkType = target.dataset.checkType || 'skill';
    const dc = target.dataset.dc ? parseInt(target.dataset.dc) : null;
    const actionSlug = target.dataset.actionSlug || null;
    const actionVariant = target.dataset.actionVariant || null;
    const isSecret = target.dataset.isSecret === 'true';
    const state = game.storyframe.stateManager.getState();

    // Find challenge ID from parent element
    const challengeCard = target.closest('[data-challenge-id]');
    const challengeId = challengeCard?.dataset.challengeId;

    if (!challengeId) {
      ui.notifications.error('Challenge ID not found');
      return;
    }

    // Look up challenge from activeChallenges array
    const challenge = state?.activeChallenges?.find(c => c.id === challengeId);

    if (!challenge) {
      ui.notifications.warn(game.i18n.localize('STORYFRAME.Notifications.Roll.ChallengeNoLongerActive'));
      return;
    }

    if (!checkSlug) {
      ui.notifications.error(game.i18n.localize('STORYFRAME.Notifications.Roll.InvalidSkill'));
      return;
    }

    // Build the valid actor pool: party members for PF2e, all owned characters elsewhere.
    // This mirrors the same logic used to populate the Roll Requester participant list.
    const allPCs = await SystemAdapter.getAllPlayerPCs();
    const myPCs = allPCs.filter(p => p.userId === game.user.id);

    // Prefer a selected token that belongs to the valid pool.
    const selectedToken = canvas?.tokens?.controlled?.[0];
    let myActor = null;
    if (selectedToken?.actor) {
      const uuid = selectedToken.actor.uuid;
      if (myPCs.some(p => p.actorUuid === uuid)) myActor = selectedToken.actor;
    }

    // Fall back to the first valid pool member, then any owned character.
    if (!myActor && myPCs.length > 0) {
      myActor = await fromUuid(myPCs[0].actorUuid);
    }
    if (!myActor) {
      myActor = game.actors?.find(a => a.type === 'character' && a.testUserPermission?.(game.user, 'OWNER'));
    }

    if (!myActor) {
      ui.notifications.error(game.i18n.localize('STORYFRAME.Notifications.Roll.ActorNotFound'));
      return;
    }

    const actorData = { actorUuid: myActor.uuid };

    // Execute appropriate roll based on check type
    if (checkType === 'save') {
      await PlayerViewerApp._executeSaveRoll(actorData, checkSlug, dc, isSecret);
    } else {
      await PlayerViewerApp._executeSkillRoll(actorData, checkSlug, dc, actionSlug, isSecret, actionVariant);
    }
  }

  /**
   * Execute skill roll for challenge option.
   * @param {Object} actorData - Object with actorUuid property
   * @param {string} skillSlug - Skill slug
   * @param {number} dc - DC value
   * @param {string|null} actionSlug - Optional action slug (PF2e only)
   * @param {boolean} isSecret - Whether this is a secret roll (GM only)
   */
  static async _executeSkillRoll(actorData, skillSlug, dc, actionSlug = null, isSecret = false, actionVariant = null) {
    const actor = await fromUuid(actorData.actorUuid);
    if (!actor) {
      ui.notifications.error(game.i18n.localize('STORYFRAME.Notifications.Roll.ActorNotFound'));
      return;
    }

    const currentSystem = SystemAdapter.detectSystem();
    const skillSlugMap = getSkillSlugMap();
    const fullSlug = skillSlugMap[skillSlug] || skillSlug;

    const rollOptions = { skipDialog: false };
    if (dc !== null && dc !== undefined) {
      rollOptions.dc = { value: dc };
    }
    // Add blind roll mode if secret
    if (isSecret) {
      rollOptions.rollMode = CONST.DICE_ROLL_MODES.BLIND;
    }
    // Add variant for PF2e actions (e.g. Create a Diversion: Gesture)
    if (actionVariant) {
      rollOptions.variant = actionVariant;
    }

    try {
      let roll;
      let actionExecuted = false;
      if (currentSystem === 'pf2e') {
        // Use action if provided, otherwise basic skill roll
        if (actionSlug && game.pf2e?.actions) {
          roll = await PlayerViewerApp._tryExecuteAction(actor, actionSlug, rollOptions);
          if (roll) {
            actionExecuted = true;
          }
        }

        // Fall back to basic skill roll if action not available or failed
        if (!actionExecuted) {
          // Basic skill roll
          if (skillSlug === 'per') {
            roll = await actor.perception.roll(rollOptions);
          } else {
            // Try to find the skill - check both actor.skills and actor.system.skills for lore skills
            let skill = actor.skills?.[fullSlug];

            // If not found and it's a lore skill, try actor.system.skills
            if (!skill && fullSlug.includes('-lore')) {
              skill = actor.system?.skills?.[fullSlug];
            }

            if (!skill) {
              ui.notifications.error(game.i18n.format('STORYFRAME.Notifications.Roll.SkillNotFound', { skill: fullSlug, actor: actor.name }));
              return;
            }
            roll = await skill.roll(rollOptions);
          }
        }
      } else if (currentSystem === 'dnd5e') {
        const config = { skill: fullSlug };
        if (dc !== null && dc !== undefined) {
          config.target = dc;
        }
        const rollResult = await actor.rollSkill(config, {}, {});
        roll = Array.isArray(rollResult) ? rollResult[0] : rollResult;
      } else if (currentSystem === 'daggerheart') {
        const dhConfig = {
          roll: {
            trait: fullSlug,
            type: 'trait',
          },
          hasRoll: true,
          actionType: null,
        };
        if (dc !== null && dc !== undefined) {
          dhConfig.roll.difficulty = dc;
        }
        if (rollOptions.rollMode) {
          dhConfig.rollMode = rollOptions.rollMode;
        }
        roll = await actor.diceRoll(dhConfig);
      } else {
        ui.notifications.error(game.i18n.format('STORYFRAME.Notifications.Roll.UnsupportedSystem', { system: currentSystem }));
        return;
      }

      if (!roll) return;

    } catch (error) {
      console.error(`${MODULE_ID} | Error executing challenge roll:`, error);
      ui.notifications.error(game.i18n.localize('STORYFRAME.Notifications.Roll.RollFailed'));
    }
  }

  /**
   * Execute save roll for challenge option.
   * @param {Object} actorData - Object with actorUuid property
   * @param {string} saveSlug - Save slug (e.g., 'fortitude', 'str')
   * @param {number} dc - DC value
   * @param {boolean} isSecret - Whether this is a secret roll (GM only)
   */
  static async _executeSaveRoll(actorData, saveSlug, dc, isSecret = false) {
    const actor = await fromUuid(actorData.actorUuid);
    if (!actor) {
      ui.notifications.error(game.i18n.localize('STORYFRAME.Notifications.Roll.ActorNotFound'));
      return;
    }

    const currentSystem = SystemAdapter.detectSystem();
    const rollOptions = { skipDialog: false };
    if (dc !== null && dc !== undefined) {
      rollOptions.dc = { value: dc };
    }
    if (isSecret) {
      rollOptions.rollMode = CONST.DICE_ROLL_MODES.BLIND;
    }

    try {
      let roll;
      if (currentSystem === 'pf2e') {
        const save = actor.saves?.[saveSlug];
        if (!save) {
          ui.notifications.error(game.i18n.format('STORYFRAME.Notifications.Roll.SaveNotFound', { save: saveSlug, actor: actor.name }));
          return;
        }
        roll = await save.roll(rollOptions);
      } else if (currentSystem === 'dnd5e') {
        const config = { ability: saveSlug };
        if (dc !== null && dc !== undefined) config.target = dc;
        const rollResult = await actor.rollSavingThrow(config, {}, {});
        roll = Array.isArray(rollResult) ? rollResult[0] : rollResult;
      } else if (currentSystem === 'daggerheart') {
        // Daggerheart has no saving throws
        return;
      } else {
        ui.notifications.error(game.i18n.format('STORYFRAME.Notifications.Roll.UnsupportedSystem', { system: currentSystem }));
        return;
      }

      if (!roll) return;
    } catch (error) {
      console.error(`${MODULE_ID} | Error executing challenge save roll:`, error);
      ui.notifications.error(game.i18n.localize('STORYFRAME.Notifications.Roll.RollFailed'));
    }
  }

  /**
   * Try to execute a PF2e action using the game.pf2e.actions system.
   * @param {Actor} actor - The actor performing the action
   * @param {string} actionSlug - The action slug (e.g., 'demoralize', 'request')
   * @param {Object} rollOptions - Roll options including DC and optional variant
   * @returns {Object|null} The roll result or null if action couldn't be executed
   */
  static async _tryExecuteAction(actor, actionSlug, rollOptions) {
    try {
      // Map our action slugs to PF2e action identifiers
      const pf2eActionMap = {
        'follow-the-expert': 'followTheExpert',
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
        'decipher-writing': 'decipherWriting',
        'identify-magic': 'identifyMagic',
        'learn-spell': 'learnSpell',
        'borrow-an-arcane-spell': 'borrowAnArcaneSpell',
        'sense-direction': 'senseDirection',
        track: 'track',
        'cover-tracks': 'coverTracks',
        'create-forgery': 'createForgery',
        subsist: 'subsist',
        craft: 'craft',
        repair: 'repair',
        'identify-alchemy': 'identifyAlchemy',
        'sense-motive': 'senseMotive',
        squeeze: 'squeeze',
        'treat-disease': 'treatDisease',
        'treat-poison': 'treatPoison',
        'conceal-an-object': 'concealAnObject',
        reposition: 'reposition',
        'avoid-notice': 'avoidNotice',
        'grab-an-edge': 'grabAnEdge',
        // sf2e-anachronism actions (Computers) — registered via game.pf2e.actions.set(slug)
        'access-infosphere': 'access-infosphere',
        hack: 'hack',
        'operate-device': 'operate-device',
        // sf2e-anachronism actions (Piloting) — registered via game.pf2e.actions.set(slug)
        drive: 'drive',
        navigate: 'navigate',
        'plot-course': 'plot-course',
        'run-over': 'run-over',
        stop: 'stop',
        stunt: 'stunt',
        'take-control': 'take-control',
      };

      const pf2eActionSlug = pf2eActionMap[actionSlug];
      if (!pf2eActionSlug) {
        console.warn(`StoryFrame: Action slug "${actionSlug}" not found in pf2eActionMap`);
        return null;
      }

      // Check if the action exists in game.pf2e.actions
      // Support both Collection API (.get) used by sf2e-anachronism and legacy property access
      const actionFn = game.pf2e.actions.get?.(pf2eActionSlug) ?? game.pf2e.actions[pf2eActionSlug];
      // Accept both legacy function actions and new BaseAction instances (which use .use())
      const isCallable = typeof actionFn === 'function';
      const isBaseAction = actionFn && typeof actionFn.use === 'function';
      if (!isCallable && !isBaseAction) {
        // Fallback: try to load action from compendium (for sf2e-anachronism actions)
        const compendiumResult = await PlayerViewerApp._tryExecuteActionFromCompendium(actor, actionSlug, rollOptions);
        if (compendiumResult !== undefined) return compendiumResult;

        console.warn(`StoryFrame: PF2e action "${pf2eActionSlug}" not found in game.pf2e.actions`, {
          actionSlug,
          pf2eActionSlug,
        });
        return null;
      }

      // Build action options matching @check enricher behavior
      // PF2e actions handle their own dialogs and traits automatically
      const actionOptions = {
        actors: [actor],
      };

      // Add DC if provided - use object format to support visibility like @check
      if (rollOptions.dc) {
        actionOptions.difficultyClass = rollOptions.dc;
      }

      // Add rollMode if provided (for secret rolls)
      if (rollOptions.rollMode) {
        actionOptions.rollMode = rollOptions.rollMode;
      }

      // Add event parameter to support modifier keys (shift/ctrl/alt for adjustments)
      if (rollOptions.event) {
        actionOptions.event = rollOptions.event;
      }

      // Add variant if provided (required for actions like Create a Diversion, Perform, etc.)
      if (rollOptions.variant) {
        actionOptions.variant = rollOptions.variant;
      } else {
        // Default variants for actions that require them
        const defaultVariants = {
          'createADiversion': 'gesture',
          'perform': 'dance',
          'administerFirstAid': 'stabilize',
        };
        if (defaultVariants[pf2eActionSlug]) {
          actionOptions.variant = defaultVariants[pf2eActionSlug];
        }
      }

      // Execute the action — BaseAction instances use .use(), legacy actions are called directly
      const results = await (isBaseAction ? actionFn.use(actionOptions) : actionFn(actionOptions));

      // Return the first roll result if available
      if (results && results.length > 0 && results[0].roll) {
        return results[0].roll;
      }

      // Some actions return differently, try to extract the roll
      if (results && results[0]?.message) {
        return { total: 0, message: results[0].message };
      }

      // If we got here, the action executed but didn't return a roll in expected format
      // Return truthy value to indicate action was executed (action posts to chat itself)
      return { executed: true };
    } catch (error) {
      console.warn(`${MODULE_ID} | Failed to execute PF2e action ${actionSlug}:`, error);
      return null;
    }
  }

  /**
   * Fallback: execute a PF2e action by loading it from the compendium and rolling the actor's statistic.
   * Used for sf2e-anachronism actions that may not yet be present in game.pf2e.actions.
   * @param {Actor} actor - The actor performing the action
   * @param {string} actionSlug - The action slug (e.g., 'access-infosphere')
   * @param {Object} rollOptions - Roll options (dc, rollMode, skipDialog)
   * @returns {Object|undefined} Roll result / executed sentinel, or undefined if not a known sf2e action
   */
  static async _tryExecuteActionFromCompendium(actor, actionSlug, rollOptions) {
    // Map sf2e-anachronism action slugs to their compendium sourceIds and actor statistics.
    // sourceIds sourced from pf2e-hud constants.ts for cross-module consistency.
    const SF2E_ACTION_SOURCES = {
      'access-infosphere': { sourceId: 'Compendium.sf2e-anachronism.actions.Item.Yn4jLPVWVE1vtAaF', statistic: 'computers' },
      hack: { sourceId: 'Compendium.sf2e-anachronism.actions.Item.RF8xNJ8QsMwogerB', statistic: 'computers' },
      'operate-device': { sourceId: 'Compendium.sf2e-anachronism.actions.Item.wWtBcshahm11stMY', statistic: 'computers' },
      drive: { sourceId: 'Compendium.pf2e.actionspf2e.Item.uS3qDAgOkZ7b8ERL', statistic: 'piloting' },
      navigate: { sourceId: 'Compendium.sf2e-anachronism.actions.Item.hsUKPqTdAvWwsqH2', statistic: 'piloting' },
      'plot-course': { sourceId: 'Compendium.sf2e-anachronism.actions.Item.LXqcXRayK58inaKoo', statistic: 'piloting' },
      'run-over': { sourceId: 'Compendium.pf2e.actionspf2e.Item.lID4rJHAVZB6tavf', statistic: 'piloting' },
      stop: { sourceId: 'Compendium.pf2e.actionspf2e.Item.9gDMkIfDifh61yLz', statistic: 'piloting' },
      stunt: { sourceId: 'Compendium.sf2e-anachronism.actions.Item.7KMyRISNqp7JTzMn', statistic: 'piloting' },
      'take-control': { sourceId: 'Compendium.pf2e.actionspf2e.Item.yh9O9BQjwWrAIiuf', statistic: 'piloting' },
    };

    const source = SF2E_ACTION_SOURCES[actionSlug];
    if (!source) return undefined; // Not a known sf2e action — let caller decide next step

    try {
      const item = await fromUuid(source.sourceId);
      if (!item) {
        console.warn(`${MODULE_ID} | Compendium item not found: ${source.sourceId}`);
        return undefined;
      }

      const stat = actor.getStatistic?.(source.statistic) ?? actor.skills?.[source.statistic];
      if (!stat) {
        console.warn(`${MODULE_ID} | Actor "${actor.name}" has no "${source.statistic}" statistic`);
        return undefined;
      }

      const statRollOptions = { item, skipDialog: rollOptions.skipDialog ?? false };
      if (rollOptions.dc) statRollOptions.dc = rollOptions.dc;
      if (rollOptions.rollMode) statRollOptions.rollMode = rollOptions.rollMode;

      const result = await stat.roll(statRollOptions);
      // Return result if rolled, or executed sentinel if cancelled (prevents fallback to basic skill roll)
      return result ?? { executed: true };
    } catch (error) {
      console.warn(`${MODULE_ID} | Compendium fallback failed for "${actionSlug}":`, error);
      return undefined;
    }
  }
}
