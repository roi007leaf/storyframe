import * as SystemAdapter from '../../system-adapter.mjs';
import { PlayerViewerApp } from '../player-viewer.mjs';
import { PF2E_ACTION_DISPLAY_NAMES } from '../../system/pf2e/actions.mjs';
import { CinematicSceneBase } from './cinematic-base-app.mjs';

/**
 * Player-side Cinematic Scene app.
 * Shows roll panel, challenge panel, and player chat.
 */
export class CinematicPlayerApp extends CinematicSceneBase {
  static DEFAULT_OPTIONS = {
    actions: {
      toggleRollPanel: CinematicPlayerApp._onToggleRollPanel,
      executeRoll: CinematicPlayerApp._onExecuteRoll,
      selectChallengeOption: CinematicPlayerApp._onSelectChallengeOption,
      toggleChallengePanel: CinematicPlayerApp._onToggleChallengePanel,
      togglePlayerChat: CinematicPlayerApp._onTogglePlayerChat,
    },
  };

  static PARTS = {
    content: {
      template: 'modules/storyframe/templates/cinematic/player.hbs',
      scrollable: ['.roll-panel-content', '.challenge-panel-content', '.player-chat-messages'],
    },
  };

  constructor(options = {}) {
    super(options);
    this._playerChatHookId = null;
  }

  async _prepareContext(_options) {
    const base = await super._prepareContext(_options);
    const state = game.storyframe.stateManager?.getState();

    if (!state) {
      return {
        ...base,
        actorRollGroups: [],
        activeChallenges: [],
        totalPendingRolls: 0,
        totalChallenges: 0,
        hasPendingRolls: false,
        hasPendingChallenges: false,
        hasPendingContent: false,
        rollPanelExpanded: this.rollPanelExpanded,
        challengePanelExpanded: this.challengePanelExpanded,
        playerChatExpanded: this.playerChatExpanded,
      };
    }

    // Player pending rolls
    let actorRollGroups = [];
    let totalPendingRolls = 0;
    if (state.pendingRolls?.length > 0) {
      const myUserId = game.user.id;
      const myRolls = await Promise.all(
        state.pendingRolls
          .filter(roll => roll.userId === myUserId)
          .map(async roll => {
            const actor = roll.actorUuid ? await fromUuid(roll.actorUuid) : null;
            const skillName = PlayerViewerApp._getSkillDisplayName(roll.skillSlug);
            let actionName = null;
            if (roll.actionSlug) {
              actionName = PF2E_ACTION_DISPLAY_NAMES[roll.actionSlug] || null;
              if (roll.actionVariant && actionName) {
                const variantName = roll.actionVariant.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                actionName = `${actionName}: ${variantName}`;
              }
            }

            let showDC = true;
            const sys = SystemAdapter.detectSystem();
            if (sys === 'pf2e') showDC = game.pf2e?.settings?.metagame?.dcs ?? true;
            else if (sys === 'dnd5e') {
              const vis = game.settings?.get('dnd5e', 'challengeVisibility') ?? 'all';
              showDC = vis === 'all';
            }

            return {
              ...roll,
              skillName: actionName ? `${skillName} (${actionName})` : skillName,
              dc: showDC ? roll.dc : null,
              actorName: actor?.name || game.i18n.localize('STORYFRAME.UI.Labels.Unknown'),
              actorImg: actor?.img || 'icons/svg/mystery-man.svg',
              actorId: roll.actorUuid || 'unknown',
              allowOnlyOne: roll.allowOnlyOne || false,
              batchGroupId: roll.batchGroupId || null,
            };
          })
      );

      const groups = [];
      const actorBatchGroups = new Map();
      myRolls.forEach(roll => {
        if (roll.allowOnlyOne && roll.batchGroupId) {
          const groupKey = `${roll.actorId}:${roll.batchGroupId}`;
          if (!actorBatchGroups.has(groupKey)) {
            const group = { actorId: roll.actorId, actorName: roll.actorName, actorImg: roll.actorImg, rolls: [], hasAllowOnlyOne: true, batchGroupId: roll.batchGroupId };
            groups.push(group);
            actorBatchGroups.set(groupKey, group);
          }
          actorBatchGroups.get(groupKey).rolls.push(roll);
        } else {
          const regularKey = `${roll.actorId}:regular`;
          if (!actorBatchGroups.has(regularKey)) {
            const group = { actorId: roll.actorId, actorName: roll.actorName, actorImg: roll.actorImg, rolls: [], hasAllowOnlyOne: false };
            groups.push(group);
            actorBatchGroups.set(regularKey, group);
          }
          actorBatchGroups.get(regularKey).rolls.push(roll);
        }
      });
      actorRollGroups = groups;
      totalPendingRolls = myRolls.length;
    }

    // Player active challenges
    let activeChallenges = [];
    let totalChallenges = 0;
    if (state.activeChallenges?.length > 0) {
      let showDCs = true;
      const sys = SystemAdapter.detectSystem();
      if (sys === 'pf2e') showDCs = game.pf2e?.settings?.metagame?.dcs ?? true;
      else if (sys === 'dnd5e') {
        const vis = game.settings?.get('dnd5e', 'challengeVisibility') ?? 'all';
        showDCs = vis === 'all';
      }

      // Load system-specific class for proficiency checking (mirrors player-sidebar logic)
      let GMSidebar;
      if (sys === 'pf2e') {
        const { GMSidebarAppPF2e } = await import('../gm-sidebar/gm-sidebar-pf2e.mjs');
        GMSidebar = GMSidebarAppPF2e;
      } else if (sys === 'dnd5e') {
        const { GMSidebarAppDND5e } = await import('../gm-sidebar/gm-sidebar-dnd5e.mjs');
        GMSidebar = GMSidebarAppDND5e;
      } else if (sys === 'daggerheart') {
        const { GMSidebarAppDaggerheart } = await import('../gm-sidebar/gm-sidebar-daggerheart.mjs');
        GMSidebar = GMSidebarAppDaggerheart;
      } else {
        const { GMSidebarAppBase } = await import('../gm-sidebar/gm-sidebar-base.mjs');
        GMSidebar = GMSidebarAppBase;
      }

      const myActors = game.actors?.filter(a => a.type === 'character' && a.testUserPermission(game.user, 'OWNER')) || [];

      activeChallenges = await Promise.all(state.activeChallenges.map(async challenge => ({
        ...challenge,
        options: await Promise.all(challenge.options.map(async opt => ({
          ...opt,
          skillOptionsDisplay: await Promise.all(opt.skillOptions.map(async so => {
            const checkType = so.checkType || 'skill';
            let canRoll = true;
            if (checkType === 'skill' && so.minProficiency > 0) {
              canRoll = false;
              for (const actor of myActors) {
                const rank = await GMSidebar._getActorProficiencyRank(actor, so.skill);
                if (rank >= so.minProficiency) { canRoll = true; break; }
              }
            }
            return {
              ...so,
              skillName: PlayerViewerApp._getSkillDisplayName(so.skill),
              showDC: showDCs,
              canRoll,
            };
          })),
        }))),
      })));
      totalChallenges = activeChallenges.length;
    }

    const hasPendingRolls = totalPendingRolls > 0;
    const hasPendingChallenges = totalChallenges > 0;
    const hasPendingContent = hasPendingRolls || hasPendingChallenges;

    // Auto-expand panels on new arrivals
    if (hasPendingRolls && this._lastPendingCount === 0) this.rollPanelExpanded = true;
    this._lastPendingCount = totalPendingRolls;

    if (hasPendingChallenges && this._lastChallengeCount === 0) this.challengePanelExpanded = true;
    this._lastChallengeCount = totalChallenges;

    return {
      ...base,
      actorRollGroups,
      activeChallenges,
      totalPendingRolls,
      totalChallenges,
      hasPendingRolls,
      hasPendingChallenges,
      hasPendingContent,
      rollPanelExpanded: this.rollPanelExpanded,
      challengePanelExpanded: this.challengePanelExpanded,
      playerChatExpanded: this.playerChatExpanded,
    };
  }

  /** Targeted DOM update for player roll + challenge panels */
  async _refreshRollPanel() {
    const ctx = await this._prepareContext({});

    const rollPanel = this.element?.querySelector('.cinematic-roll-panel');
    if (rollPanel) {
      rollPanel.classList.toggle('hidden', !ctx.hasPendingRolls);
      rollPanel.classList.toggle('expanded', ctx.hasPendingRolls);
      const rollBadge = rollPanel.querySelector('.roll-badge');
      if (rollBadge) rollBadge.textContent = ctx.totalPendingRolls || '';
      const content = rollPanel.querySelector('.roll-panel-content');
      if (content) content.innerHTML = this._buildRollPanelHTML(ctx);
    }

    const challengePanel = this.element?.querySelector('.cinematic-challenge-panel');
    if (challengePanel) {
      challengePanel.classList.toggle('hidden', !ctx.hasPendingChallenges);
      const challengeBadge = challengePanel.querySelector('.challenge-badge');
      if (challengeBadge) challengeBadge.textContent = ctx.totalChallenges || '';
      if (ctx.hasPendingChallenges && !this.challengePanelExpanded) {
        this.challengePanelExpanded = true;
        challengePanel.classList.add('expanded');
      }
      const challengeContent = challengePanel.querySelector('.challenge-panel-content');
      if (challengeContent) challengeContent.innerHTML = this._buildChallengePanelHTML(ctx);
    }
  }

  _onRender(_context, _options) {
    super._onRender(_context, _options);

    // Re-attach player chat hook after re-render if chat was open
    if (this.playerChatExpanded) {
      const container = this.element?.querySelector('.player-chat-messages');
      if (container && !container.dataset.populated) {
        container.dataset.populated = '1';
        this._populateChatLog(container);
        if (this._playerChatHookId == null) {
          this._playerChatHookId = Hooks.on('createChatMessage', (msg) => {
            const el = this.element?.querySelector('.player-chat-messages');
            if (el) this._appendChatMessage(el, msg);
          });
        }
      }
    }

    // Camera row (A/V feed mirroring)
    this._initCameraRow();
  }

  async _onClose(_options) {
    if (this._playerChatHookId != null) {
      Hooks.off('createChatMessage', this._playerChatHookId);
      this._playerChatHookId = null;
    }
    this.playerChatExpanded = false;
    return super._onClose(_options);
  }

  // --- Action handlers ---

  static _onToggleRollPanel() {
    this.rollPanelExpanded = !this.rollPanelExpanded;
    this.element?.querySelector('.cinematic-roll-panel')?.classList.toggle('expanded', this.rollPanelExpanded);
  }

  static async _onExecuteRoll(_event, target) {
    await PlayerViewerApp._onExecuteRoll(_event, target);
  }

  static async _onSelectChallengeOption(_event, target) {
    await PlayerViewerApp._onSelectChallengeOption(_event, target);
  }

  static _onToggleChallengePanel() {
    this.challengePanelExpanded = !this.challengePanelExpanded;
    this.element?.querySelector('.cinematic-challenge-panel')?.classList.toggle('expanded', this.challengePanelExpanded);
  }

  static _onTogglePlayerChat() {
    this.playerChatExpanded = !this.playerChatExpanded;
    const panel = this.element?.querySelector('.cinematic-player-chat');
    panel?.classList.toggle('expanded', this.playerChatExpanded);
    if (this.playerChatExpanded) {
      const container = panel?.querySelector('.player-chat-messages');
      if (container && !container.dataset.populated) {
        container.dataset.populated = '1';
        this._populateChatLog(container);
        if (this._playerChatHookId == null) {
          this._playerChatHookId = Hooks.on('createChatMessage', (msg) => {
            const el = this.element?.querySelector('.player-chat-messages');
            if (el) this._appendChatMessage(el, msg);
          });
        }
      }
    }
  }
}
