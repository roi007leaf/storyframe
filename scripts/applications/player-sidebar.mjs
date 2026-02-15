import * as SystemAdapter from '../system-adapter.mjs';
import { extractParentElement } from '../utils/element-utils.mjs';
import { PF2E_ACTION_DISPLAY_NAMES } from '../system/pf2e/actions.mjs';

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
      title: 'STORYFRAME.WindowTitles.PlayerSidebar',
      icon: 'fas fa-dice-d20',
      resizable: true,
      minimizable: false,
    },
    position: {
      width: 340,
      height: 600,
    },
    actions: {
      executeRoll: PlayerSidebarApp._onExecuteRoll,
      selectChallengeOption: PlayerSidebarApp._onSelectChallengeOption,
      switchTab: PlayerSidebarApp._onSwitchTab,
      toggleChallengeCollapse: PlayerSidebarApp._onToggleChallengeCollapse,
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

    // Tab state: null = challenge tab, 'rolls' = rolls tab
    // Default to rolls tab if there are pending rolls, else challenge
    this.currentTab = null;

    // Track collapsed state for multiple challenges
    this.collapsedChallenges = new Map();  // challengeId -> boolean

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

    const element = extractParentElement(this.parentViewer);

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
        currentTab: this.currentTab,
        totalPendingRolls: 0,
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

    // Get save names helper
    const getSaveName = (slug) => {
      const saves = SystemAdapter.getSaves();
      const save = saves[slug];
      if (save?.name) return save.name;
      return slug.toUpperCase();
    };

    // Get skill icon helper
    const getSkillIcon = (slug) => {
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
    };

    // Get DC difficulty helper
    const getDCDifficulty = (dc) => {
      if (!dc) return 'moderate';
      if (dc <= 10) return 'trivial';
      if (dc <= 15) return 'low';
      if (dc <= 20) return 'moderate';
      if (dc <= 30) return 'high';
      return 'extreme';
    };

    // Get action display name helper
    const getActionName = (actionSlug) => {
      if (!actionSlug) return null;
      // For PF2e, use the action display names mapping
      if (game.system.id === 'pf2e' && PF2E_ACTION_DISPLAY_NAMES[actionSlug]) {
        return PF2E_ACTION_DISPLAY_NAMES[actionSlug];
      }
      // Fallback: convert slug to title case
      return actionSlug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    // Active challenges (multi-challenge support)
    let activeChallenges = [];
    if (state?.activeChallenges && myParticipants.length > 0) {
      // Get system-specific GM sidebar class for proficiency checking (once)
      let GMSidebar;
      if (game.system.id === 'pf2e') {
        const { GMSidebarAppPF2e } = await import('./gm-sidebar/gm-sidebar-pf2e.mjs');
        GMSidebar = GMSidebarAppPF2e;
      } else if (game.system.id === 'dnd5e') {
        const { GMSidebarAppDND5e } = await import('./gm-sidebar/gm-sidebar-dnd5e.mjs');
        GMSidebar = GMSidebarAppDND5e;
      } else {
        const { GMSidebarAppBase } = await import('./gm-sidebar/gm-sidebar-base.mjs');
        GMSidebar = GMSidebarAppBase;
      }

      activeChallenges = await Promise.all(state.activeChallenges.map(async challenge => {
        const enrichedOptions = await Promise.all(challenge.options.map(async opt => ({
          ...opt,
          skillOptionsDisplay: await Promise.all(opt.skillOptions.map(async so => {
            // Determine if this is a save or skill check
            const checkType = so.checkType || 'skill';

            // Check if player meets proficiency requirement (skills only, not saves)
            let canRoll = true;
            if (checkType === 'skill' && so.minProficiency && so.minProficiency > 0) {
              // Check proficiency for this player's participant(s)
              canRoll = false;

              for (const p of myParticipants) {
                const actor = await fromUuid(p.actorUuid);
                if (!actor) continue;

                const rank = await GMSidebar._getActorProficiencyRank(actor, so.skill);
                if (rank >= so.minProficiency) {
                  canRoll = true;
                  break;
                }
              }
            }

            // Get appropriate name and icon based on check type
            let checkName, checkIcon;
            if (checkType === 'save') {
              checkName = getSaveName(so.skill);
              const saves = SystemAdapter.getSaves();
              checkIcon = saves[so.skill]?.icon || 'fa-shield';
            } else {
              checkName = getSkillName(so.skill);
              checkIcon = getSkillIcon(so.skill);
            }

            const actionDisplayName = getActionName(so.action);

            // Build localized tooltip and aria-label
            let tooltip, ariaLabel;
            if (canRoll) {
              if (checkType === 'save') {
                tooltip = game.i18n.format('STORYFRAME.UI.Tooltips.RollSave', { save: checkName });
                ariaLabel = tooltip + (showDCs && so.dc ? ` DC ${so.dc}` : '');
              } else {
                tooltip = actionDisplayName
                  ? game.i18n.format('STORYFRAME.UI.Tooltips.RollSkillWithAction', { skill: checkName, action: actionDisplayName })
                  : game.i18n.format('STORYFRAME.UI.Tooltips.RollSkill', { skill: checkName });
                ariaLabel = tooltip + (showDCs && so.dc ? ` DC ${so.dc}` : '');
              }
            } else {
              tooltip = game.i18n.localize('STORYFRAME.UI.Tooltips.InsufficientProficiency');
              ariaLabel = game.i18n.localize('STORYFRAME.UI.Tooltips.LockedInsufficientProficiency');
            }

            return {
              ...so,
              skillName: checkName,
              skillIcon: checkIcon,
              checkType,  // NEW
              dc: so.dc,
              dcDifficulty: getDCDifficulty(so.dc),
              action: so.action, // Keep original slug for data attribute
              actionName: actionDisplayName, // Add display name
              isSecret: so.isSecret || false,
              showDC: showDCs,
              canRoll,
              minProficiency: so.minProficiency || 0,
              tooltip,
              ariaLabel,
            };
          })),
        })));

        return {
          ...challenge,
          options: enrichedOptions,
          collapsed: this.collapsedChallenges.get(challenge.id) ?? false,
        };
      }));
    }

    // Backward compatibility
    const activeChallenge = activeChallenges[0] || null;
    const hasActiveChallenges = activeChallenges.length > 0;

    // Group pending rolls by actor
    let actorRollGroups = [];
    if (myParticipantIds.size > 0 && state?.pendingRolls) {
      const rolls = await Promise.all(
        state.pendingRolls
          .filter((roll) => myParticipantIds.has(roll.participantId))
          .map(async (roll) => {
            const participant = state.participants.find(p => p.id === roll.participantId);
            const actor = participant ? await fromUuid(participant.actorUuid) : null;

            // Determine if this is a save or skill check
            const checkType = roll.checkType || 'skill';
            const checkSlug = roll.skillSlug; // skillSlug is used for both skills and saves

            // Get appropriate name based on check type
            const checkName = checkType === 'save' ? getSaveName(checkSlug) : getSkillName(checkSlug);
            const actionName = getActionName(roll.actionSlug);

            // Build localized tooltip and aria-label
            let tooltip, ariaLabel;
            if (checkType === 'save') {
              tooltip = game.i18n.format('STORYFRAME.UI.Tooltips.RollSave', { save: checkName });
              ariaLabel = game.i18n.format('STORYFRAME.UI.AriaLabels.RollCheck', { check: checkName });
            } else {
              tooltip = actionName
                ? game.i18n.format('STORYFRAME.UI.Tooltips.RollSkillWithAction', { skill: checkName, action: actionName })
                : game.i18n.format('STORYFRAME.UI.Tooltips.RollSkill', { skill: checkName });
              ariaLabel = game.i18n.format('STORYFRAME.UI.Tooltips.RollSkillCheck', { skill: checkName });
            }

            return {
              ...roll,
              skillName: checkName,
              skillIcon: getSkillIcon(checkSlug),
              actionName,
              dc: showDCs ? roll.dc : null,
              dcDifficulty: getDCDifficulty(roll.dc),
              actorName: actor?.name || game.i18n.localize('STORYFRAME.UI.Labels.Unknown'),
              actorImg: actor?.img || 'icons/svg/mystery-man.svg',
              actorId: participant?.actorUuid || 'unknown',
              checkType,
              tooltip,
              ariaLabel,
              allowOnlyOne: roll.allowOnlyOne || false,
              batchGroupId: roll.batchGroupId || null,
            };
          })
      );

      // Group rolls by actor AND batchGroupId to separate allow-only-one groups
      const groups = [];
      const actorBatchGroups = new Map(); // Track which batchGroupIds we've seen per actor

      rolls.forEach(roll => {
        if (roll.allowOnlyOne && roll.batchGroupId) {
          // Part of an allow-only-one group
          const groupKey = `${roll.actorId}:${roll.batchGroupId}`;

          if (!actorBatchGroups.has(groupKey)) {
            // Create new allow-only-one group
            const group = {
              actorId: roll.actorId,
              actorName: roll.actorName,
              actorImg: roll.actorImg,
              rolls: [],
              hasAllowOnlyOne: true,
              batchGroupId: roll.batchGroupId,
            };
            groups.push(group);
            actorBatchGroups.set(groupKey, group);
          }

          // Add roll to its group
          actorBatchGroups.get(groupKey).rolls.push(roll);
        } else {
          // Regular roll - group with other regular rolls for same actor
          const regularGroupKey = `${roll.actorId}:regular`;

          if (!actorBatchGroups.has(regularGroupKey)) {
            const group = {
              actorId: roll.actorId,
              actorName: roll.actorName,
              actorImg: roll.actorImg,
              rolls: [],
              hasAllowOnlyOne: false,
            };
            groups.push(group);
            actorBatchGroups.set(regularGroupKey, group);
          }

          actorBatchGroups.get(regularGroupKey).rolls.push(roll);
        }
      });

      actorRollGroups = groups;
    }

    // Auto-switch to rolls tab only on first render if there are pending rolls
    if (actorRollGroups.length > 0 && this.currentTab === null && !hasActiveChallenges && !this._hasInitialized) {
      this.currentTab = 'rolls';
      this._hasInitialized = true;
    }

    const totalPendingRolls = actorRollGroups.reduce((sum, group) => sum + group.rolls.length, 0);

    return {
      actorRollGroups,
      activeChallenges,
      activeChallenge,
      hasActiveChallenges,
      currentTab: this.currentTab,
      totalPendingRolls,
    };
  }

  async _onRender(context, _options) {
    super._onRender(context, _options);

    // Auto-close if no content to show
    const hasContent = context.hasActiveChallenges || context.actorRollGroups.length > 0;
    if (!hasContent && this.rendered) {
      this.close();
      return;
    }

    // Position as drawer
    if (this.parentViewer) {
      this._positionAsDrawer(3);
      this._startTrackingParent();
    }

    // Add keyboard shortcuts
    this._setupKeyboardShortcuts();
  }

  /**
   * Setup keyboard shortcuts for quick actions
   */
  _setupKeyboardShortcuts() {
    if (this._keyHandler) return; // Already setup

    this._keyHandler = (event) => {
      // Ignore if typing in input field
      if (event.target.matches('input, textarea')) return;

      // Tab key switches between tabs
      if (event.key === 'Tab' && !event.shiftKey) {
        event.preventDefault();
        if (this.currentTab === null) {
          this.currentTab = 'rolls';
        } else {
          this.currentTab = null;
        }
        this.render();
      }

      // Escape closes sidebar
      if (event.key === 'Escape') {
        this.close();
        event.preventDefault();
      }
    };

    document.addEventListener('keydown', this._keyHandler);
  }

  async _onClose(_options) {
    this._stopTrackingParent();
    // Remove keyboard handler
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
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
      ui.notifications.warn(game.i18n.localize('STORYFRAME.Notifications.Roll.RequestNotFound'));
      return;
    }

    // Add rolling animation
    target.classList.add('rolling');

    try {
      // Import and call the player viewer's execute roll logic
      const { PlayerViewerApp } = await import('./player-viewer.mjs');
      await PlayerViewerApp._onExecuteRoll(_event, target);
    } finally {
      // Remove rolling class immediately after attempt
      // Animation is 400ms, but we need button clickable right away if cancelled
      target.classList.remove('rolling');
    }
  }

  static async _onSelectChallengeOption(_event, target) {
    // Delegate to PlayerViewerApp
    const { PlayerViewerApp } = await import('./player-viewer.mjs');
    await PlayerViewerApp._onSelectChallengeOption(_event, target);
  }

  static async _onSwitchTab(_event, target) {
    const tab = target.dataset.tab;
    this.currentTab = tab === 'challenge' ? null : 'rolls';
    this.render();
  }

  static async _onToggleChallengeCollapse(_event, target) {
    const challengeId = target.closest('[data-challenge-id]')?.dataset.challengeId;
    if (!challengeId) return;

    const currentState = this.collapsedChallenges.get(challengeId) || false;
    this.collapsedChallenges.set(challengeId, !currentState);
    this.render();
  }
}
