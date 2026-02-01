const MODULE_ID = 'storyframe';

import * as SystemAdapter from '../system-adapter.mjs';

/**
 * Player Sidebar for StoryFrame
 * Drawer-style window that attaches to the player viewer
 * Shows challenges and pending rolls
 */
export class PlayerSidebarApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
) {
  static DEFAULT_OPTIONS = {
    id: 'storyframe-player-sidebar',
    classes: ['storyframe', 'player-sidebar', 'drawer'],
    window: {
      title: 'Storyframe',
      icon: 'fas fa-dice-d20',
      resizable: false,
      minimizable: false,
    },
    position: {
      width: 340,
      height: 600,
    },
    actions: {
      executeRoll: PlayerSidebarApp._onExecuteRoll,
      selectChallengeOption: PlayerSidebarApp._onSelectChallengeOption,
      toggleChallenge: PlayerSidebarApp._onToggleChallenge,
      togglePendingRolls: PlayerSidebarApp._onTogglePendingRolls,
    },
  };

  static PARTS = {
    content: {
      template: 'modules/storyframe/templates/player-sidebar.hbs',
      scrollable: ['.sidebar-content', '.challenge-options'],
    },
  };

  /** @type {PlayerViewerApp|null} Reference to the parent player viewer */
  parentViewer = null;

  /** @type {Function|null} Bound handler for parent position changes */
  _parentPositionHandler = null;

  constructor(options = {}) {
    super(options);

    // Panel state
    this.challengeCollapsed = false;
    this.pendingRollsCollapsed = false;

    // Parent reference (set externally when attaching)
    this.parentViewer = null;
  }

  /**
   * Position the drawer adjacent to the parent player viewer
   */
  _positionAsDrawer(retryCount = 3) {
    if (!this.parentViewer?.element || !this.element) {
      if (retryCount > 0) {
        setTimeout(() => this._positionAsDrawer(retryCount - 1), 100);
      }
      return;
    }

    const parentRect = this.parentViewer.element.getBoundingClientRect();

    this.setPosition({
      top: parentRect.top,
      left: parentRect.right,
      height: parentRect.height,
    });
  }

  /**
   * Start tracking parent window movements
   */
  _startTrackingParent() {
    if (!this.parentViewer?.element) return;

    const element = this.parentViewer.element instanceof HTMLElement
      ? this.parentViewer.element
      : this.parentViewer.element[0];

    this._parentObserver = new MutationObserver((mutations) => {
      if (!this.rendered || !this.parentViewer) return;

      for (const mutation of mutations) {
        if (mutation.attributeName === 'style') {
          this._positionAsDrawer(0);
          break;
        }
      }
    });

    this._parentObserver.observe(element, {
      attributes: true,
      attributeFilter: ['style'],
    });
  }

  /**
   * Stop tracking parent window movements
   */
  _stopTrackingParent() {
    if (this._parentObserver) {
      this._parentObserver.disconnect();
      this._parentObserver = null;
    }
  }

  async _prepareContext(_options) {
    const state = game.storyframe.stateManager.getState();

    if (!state) {
      return {
        actorRollGroups: [],
        activeChallenge: null,
        pendingRollsCollapsed: this.pendingRollsCollapsed,
      };
    }

    // Get current user's participants
    const myParticipants = state?.participants?.filter((p) => p.userId === game.user.id) || [];
    const myParticipantIds = new Set(myParticipants.map(p => p.id));

    // Check if DCs should be shown
    const currentSystem = game.pf2e ? 'pf2e' : (game.dnd5e ? 'dnd5e' : 'unknown');
    let showDCs = true;

    if (currentSystem === 'pf2e') {
      showDCs = game.pf2e?.settings?.metagame?.dcs ?? true;
    } else if (currentSystem === 'dnd5e') {
      const challengeVisibility = game.settings?.get('dnd5e', 'challengeVisibility') ?? 'all';
      showDCs = challengeVisibility === 'all' || (challengeVisibility === 'gm' && game.user.isGM);
    }

    // Get skill names helper
    const getSkillName = (slug) => {
      const skills = SystemAdapter.getSkills();
      const skill = skills[slug];
      if (skill?.name) return skill.name;

      // Handle lore skills
      if (slug.includes('-lore')) {
        return slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      }

      return slug.toUpperCase();
    };

    // Active challenge
    let activeChallenge = null;
    if (state?.activeChallenge && myParticipants.length > 0) {
      const enrichedOptions = state.activeChallenge.options.map(opt => ({
        ...opt,
        skillOptionsDisplay: opt.skillOptions.map(so => ({
          ...so,
          skillName: getSkillName(so.skill),
          dc: so.dc,
          action: so.action || null,
          showDC: showDCs,
        })),
      }));

      activeChallenge = {
        ...state.activeChallenge,
        options: enrichedOptions,
      };
    }

    // Group pending rolls by actor
    let actorRollGroups = [];
    if (myParticipantIds.size > 0 && state?.pendingRolls) {
      const rolls = await Promise.all(
        state.pendingRolls
          .filter((roll) => myParticipantIds.has(roll.participantId))
          .map(async (roll) => {
            const participant = state.participants.find(p => p.id === roll.participantId);
            const actor = participant ? await fromUuid(participant.actorUuid) : null;

            return {
              ...roll,
              skillName: getSkillName(roll.skillSlug),
              actionName: roll.actionSlug || null,
              dc: showDCs ? roll.dc : null,
              actorName: actor?.name || 'Unknown',
              actorImg: actor?.img || 'icons/svg/mystery-man.svg',
              actorId: participant?.actorUuid || 'unknown',
            };
          })
      );

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

    return {
      actorRollGroups,
      activeChallenge,
      challengeCollapsed: this.challengeCollapsed,
      pendingRollsCollapsed: this.pendingRollsCollapsed,
    };
  }

  async _onRender(context, _options) {
    super._onRender(context, _options);

    // Auto-close if no content to show
    const hasContent = context.activeChallenge || context.actorRollGroups.length > 0;
    if (!hasContent && this.rendered) {
      this.close();
      return;
    }

    // Position as drawer
    if (this.parentViewer) {
      this._positionAsDrawer(3);
      this._startTrackingParent();
    }
  }

  async _onClose(_options) {
    this._stopTrackingParent();
    return super._onClose(_options);
  }

  // --- Action Handlers ---

  static async _onExecuteRoll(_event, target) {
    // Delegate to PlayerViewerApp
    const requestId = target.dataset.requestId;
    if (!requestId) return;

    const state = game.storyframe.stateManager.getState();
    const request = state.pendingRolls?.find((r) => r.id === requestId);
    if (!request) {
      ui.notifications.warn('Roll request not found');
      return;
    }

    // Import and call the player viewer's execute roll logic
    const { PlayerViewerApp } = await import('./player-viewer.mjs');
    await PlayerViewerApp._onExecuteRoll(_event, target);
  }

  static async _onSelectChallengeOption(_event, target) {
    // Delegate to PlayerViewerApp
    const { PlayerViewerApp } = await import('./player-viewer.mjs');
    await PlayerViewerApp._onSelectChallengeOption(_event, target);
  }

  static async _onToggleChallenge(_event, _target) {
    this.challengeCollapsed = !this.challengeCollapsed;
    this.render();
  }

  static async _onTogglePendingRolls(_event, _target) {
    this.pendingRollsCollapsed = !this.pendingRollsCollapsed;
    this.render();
  }
}
