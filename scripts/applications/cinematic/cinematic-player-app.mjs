import * as SystemAdapter from '../../system-adapter.mjs';
import { PlayerViewerApp } from '../player-viewer.mjs';
import { PF2E_ACTION_DISPLAY_NAMES } from '../../system/pf2e/actions.mjs';
import { CinematicSceneBase } from './cinematic-base-app.mjs';
import { MODULE_ID } from '../../constants.mjs';

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
      togglePlayerVolume: CinematicPlayerApp._onTogglePlayerVolume,
      toggleJournalSidebar: CinematicPlayerApp._onToggleJournalSidebar,
      openPlayerJournal: CinematicPlayerApp._onOpenPlayerJournal,
      openPlayerJournalPage: CinematicPlayerApp._onOpenPlayerJournalPage,
      closePlayerJournal: CinematicPlayerApp._onClosePlayerJournal,
      minimizePlayerJournal: CinematicPlayerApp._onMinimizePlayerJournal,
      restorePlayerMinimized: CinematicPlayerApp._onRestorePlayerMinimized,
      closePlayerMinimized: CinematicPlayerApp._onClosePlayerMinimized,
      createPlayerNote: CinematicPlayerApp._onCreatePlayerNote,
      togglePlayerJournalSwitcher: CinematicPlayerApp._onTogglePlayerJournalSwitcher,
      editPlayerJournal: CinematicPlayerApp._onEditPlayerJournal,
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
    this.playerJournalPanelOpen = false;
    this.playerJournalId = null;
    this.playerJournalPageId = null;
    this.playerMinimizedJournals = [];
    this.playerJournalSearchQuery = '';
    this.playerJournalFontSize = game.settings.get(MODULE_ID, 'cinematicJournalFontSize') ?? 0.75;
    this.playerVolumeExpanded = false;
  }

  async _prepareContext(_options) {
    const base = await super._prepareContext(_options);
    const state = game.storyframe.stateManager?.getState();

    const currentVolume = game.settings.get('core', 'globalPlaylistVolume') ?? 0.5;

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
        playerVolumeExpanded: this.playerVolumeExpanded,
        currentVolume,
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
      playerVolumeExpanded: this.playerVolumeExpanded,
      currentVolume,
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

    // Volume slider
    if (this.playerVolumeExpanded) this._bindVolumeSlider();

    // Camera row (A/V feed mirroring)
    this._initCameraRow();
  }

  async _onClose(_options) {
    if (this._playerChatHookId != null) {
      Hooks.off('createChatMessage', this._playerChatHookId);
      this._playerChatHookId = null;
    }
    // Re-collapse sidebar if the player expanded it during cinematic
    if (this._playerExpandedSidebar && ui.sidebar && !ui.sidebar._collapsed) {
      ui.sidebar.collapse();
      this._playerExpandedSidebar = false;
    }
    this.playerChatExpanded = false;
    this.playerJournalPanelOpen = false;
    this.playerJournalId = null;
    this.playerJournalPageId = null;
    this.playerMinimizedJournals = [];
    this.playerJournalSearchQuery = '';

    // Notify GM that this player no longer has cinematic open
    try {
      game.storyframe.socketManager?.socket?.executeAsGM('reportCinematicStatus', game.user.id, false);
    } catch { /* ignore if socket unavailable */ }

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

  static _onToggleJournalSidebar() {
    this.playerJournalPanelOpen = !this.playerJournalPanelOpen;
    const panel = this.element?.querySelector('.cinematic-player-journal-panel');
    if (!panel) return;
    panel.classList.toggle('hidden', !this.playerJournalPanelOpen);
    if (this.playerJournalPanelOpen) this._updatePlayerJournalPanel();
  }

  static _onOpenPlayerJournal(_event, target) {
    const journalId = target.closest('[data-journal-id]')?.dataset.journalId;
    if (!journalId) return;
    if (this.playerJournalId && this.playerJournalId !== journalId) {
      if (!this.playerMinimizedJournals.some(m => m.id === this.playerJournalId)) {
        this.playerMinimizedJournals.push({ id: this.playerJournalId, pageId: this.playerJournalPageId });
      }
    }
    this.playerMinimizedJournals = this.playerMinimizedJournals.filter(m => m.id !== journalId);
    this.playerJournalId = journalId;
    this.playerJournalPageId = null;
    this.element?.querySelector('.journal-switcher-dropdown')?.classList.add('hidden');
    this._updatePlayerJournalPanel();
  }

  static _onOpenPlayerJournalPage(_event, target) {
    const journalId = target.closest('[data-journal-id]')?.dataset.journalId;
    const pageId = target.dataset.pageId;
    if (!journalId) return;
    this.playerJournalId = journalId;
    this.playerJournalPageId = pageId || null;
    this._updatePlayerJournalPanel();
  }

  static _onClosePlayerJournal() {
    this.playerJournalId = null;
    this.playerJournalPageId = null;
    this._updatePlayerJournalPanel();
  }

  static _onMinimizePlayerJournal() {
    if (this.playerJournalId && !this.playerMinimizedJournals.some(m => m.id === this.playerJournalId)) {
      this.playerMinimizedJournals.push({ id: this.playerJournalId, pageId: this.playerJournalPageId });
    }
    this.playerJournalId = null;
    this.playerJournalPageId = null;
    this._updatePlayerJournalPanel();
  }

  static _onRestorePlayerMinimized(_event, target) {
    const journalId = target.closest('[data-journal-id]')?.dataset.journalId;
    if (!journalId) return;
    const entry = this.playerMinimizedJournals.find(m => m.id === journalId);
    if (this.playerJournalId && this.playerJournalId !== journalId) {
      if (!this.playerMinimizedJournals.some(m => m.id === this.playerJournalId)) {
        this.playerMinimizedJournals.push({ id: this.playerJournalId, pageId: this.playerJournalPageId });
      }
    }
    this.playerMinimizedJournals = this.playerMinimizedJournals.filter(m => m.id !== journalId);
    this.playerJournalId = journalId;
    this.playerJournalPageId = entry?.pageId || null;
    this._updatePlayerJournalPanel();
  }

  static _onClosePlayerMinimized(_event, target) {
    const journalId = target.closest('[data-journal-id]')?.dataset.journalId;
    if (!journalId) return;
    this.playerMinimizedJournals = this.playerMinimizedJournals.filter(m => m.id !== journalId);
    this._updatePlayerJournalPanel();
  }

  static async _onCreatePlayerNote() {
    let noteName;
    try {
      noteName = await foundry.applications.api.DialogV2.prompt({
        window: { title: game.i18n.localize('JOURNAL.Create') || 'New Note' },
        content: `<div style="padding:4px 0"><label style="font-size:0.85rem;color:rgba(255,255,255,0.7)">${game.i18n.localize('DOCUMENT.Name') || 'Name'}</label><input type="text" name="name" value="My Notes" style="width:100%;margin-top:4px" autofocus></div>`,
        ok: { callback: (_e, button) => button.form.elements.name.value.trim() },
      });
    } catch { return; }
    if (!noteName) return;
    try {
      const entry = await JournalEntry.create({ name: noteName });
      if (entry) {
        await entry.createEmbeddedDocuments('JournalEntryPage', [{ name: noteName, type: 'text', text: { content: '', format: 1 } }]);
        this.playerJournalId = entry.id;
        this.playerJournalPageId = null;
        this._updatePlayerJournalPanel();
      }
    } catch {
      ui.notifications.warn('Could not create journal — ask your GM to grant journal creation permission.');
    }
  }

  static _onTogglePlayerJournalSwitcher() {
    const panel = this.element?.querySelector('.cinematic-player-journal-panel');
    const dropdown = panel?.querySelector('.journal-switcher-dropdown');
    if (!dropdown) return;
    const hidden = dropdown.classList.toggle('hidden');
    if (!hidden) dropdown.querySelector('.journal-switcher-search')?.focus();
  }

  static _onEditPlayerJournal() {
    const entry = game.journal.get(this.playerJournalId);
    entry?.sheet?.render(true);
  }

  async _updatePlayerJournalPanel() {
    const panel = this.element?.querySelector('.cinematic-player-journal-panel');
    if (!panel) return;

    const esc = foundry.utils.escapeHTML;
    const q = this.playerJournalSearchQuery.toLowerCase();

    const allJournals = game.journal.contents
      .filter(j => j.testUserPermission(game.user, 'OBSERVER'))
      .sort((a, b) => a.name.localeCompare(b.name));

    let journalEntries;
    if (q) {
      journalEntries = [];
      for (const j of allJournals) {
        const nameMatch = j.name.toLowerCase().includes(q);
        const matchingPages = j.pages.contents
          .filter(p => p.type === 'text' && p.name.toLowerCase().includes(q))
          .map(p => ({ id: p.id, name: p.name }));
        if (nameMatch || matchingPages.length > 0) {
          journalEntries.push({ id: j.id, name: j.name, pageCount: j.pages.size, matchingPages: nameMatch ? [] : matchingPages });
        }
      }
    } else {
      journalEntries = allJournals.map(j => ({ id: j.id, name: j.name, pageCount: j.pages.size, matchingPages: [] }));
    }

    let html = '';

    // Minimized pills
    for (const m of this.playerMinimizedJournals) {
      const entry = game.journal.get(m.id);
      if (!entry) continue;
      const pageName = m.pageId ? entry.pages.get(m.pageId)?.name : null;
      const label = pageName ? `${esc(entry.name)} (${esc(pageName)})` : esc(entry.name);
      html += `<div class="journal-minimized-pill" data-action="restorePlayerMinimized" data-journal-id="${m.id}">
        <i class="fas fa-book-open" aria-hidden="true"></i>
        <span class="journal-pill-text"><span>${label}</span></span>
        <button type="button" class="journal-pill-close" data-action="closePlayerMinimized" data-journal-id="${m.id}"><i class="fas fa-times" aria-hidden="true"></i></button>
      </div>`;
    }

    if (this.playerJournalId) {
      const entry = game.journal.get(this.playerJournalId);
      if (!entry) { this.playerJournalId = null; return this._updatePlayerJournalPanel(); }

      const textPages = entry.pages.contents
        .filter(p => p.type === 'text')
        .sort((a, b) => (a.sort || 0) - (b.sort || 0));
      const pageId = this.playerJournalPageId || textPages[0]?.id;
      const page = entry.pages.get(pageId);
      const rawContent = page?.text?.content ?? '';
      const content = rawContent
        ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(rawContent, { relativeTo: entry })
        : `<p style="opacity:0.5;font-size:0.8rem">${game.i18n.localize('STORYFRAME.CinematicScene.NoContent') || 'No content.'}</p>`;

      const isOwner = entry.testUserPermission(game.user, 'OWNER');

      html += `<div class="journal-viewer-header">
        <i class="fas fa-book-open" aria-hidden="true"></i>
        <button type="button" class="journal-viewer-title" data-action="togglePlayerJournalSwitcher">
          ${esc(entry.name)}<i class="fas fa-caret-down journal-switcher-caret" aria-hidden="true"></i>
        </button>
        <i class="fas fa-font journal-font-icon-sm" aria-hidden="true"></i>
        <input type="range" class="journal-font-size-slider" min="0.5" max="1.5" step="0.05" value="${this.playerJournalFontSize}" data-tooltip="${game.i18n.localize('STORYFRAME.CinematicScene.JournalFontSize') || 'Font size'}">
        <i class="fas fa-font journal-font-icon-lg" aria-hidden="true"></i>
        ${isOwner ? `<button type="button" class="journal-header-btn" data-action="editPlayerJournal" data-tooltip="${game.i18n.localize('STORYFRAME.CinematicScene.EditJournal') || 'Edit'}"><i class="fas fa-pencil" aria-hidden="true"></i></button>` : ''}
        <button type="button" class="journal-header-btn" data-action="minimizePlayerJournal" data-tooltip="${game.i18n.localize('STORYFRAME.CinematicScene.Minimize') || 'Minimize'}"><i class="fas fa-minus" aria-hidden="true"></i></button>
        <button type="button" class="journal-header-btn" data-action="closePlayerJournal" data-tooltip="${game.i18n.localize('STORYFRAME.UI.Labels.Close') || 'Close'}"><i class="fas fa-times" aria-hidden="true"></i></button>
      </div>`;

      html += `<div class="journal-switcher-dropdown hidden">
        <input type="text" class="journal-switcher-search" placeholder="${game.i18n.localize('STORYFRAME.CinematicScene.SearchJournals') || 'Search journals...'}">
        <div class="journal-switcher-list">`;
      for (const j of journalEntries) {
        const active = j.id === this.playerJournalId ? ' active' : '';
        html += `<div class="journal-switcher-item${active}" data-action="openPlayerJournal" data-journal-id="${j.id}"><i class="fas fa-book" aria-hidden="true"></i><span>${esc(j.name)}</span></div>`;
      }
      html += `</div></div>`;

      if (textPages.length > 1) {
        html += `<div class="journal-page-tabs">`;
        for (const p of textPages) {
          const active = p.id === pageId ? ' active' : '';
          html += `<button type="button" class="journal-page-tab${active}" data-action="openPlayerJournalPage" data-journal-id="${entry.id}" data-page-id="${p.id}">${esc(p.name)}</button>`;
        }
        html += `</div>`;
      }

      html += `<div class="journal-content-scroll"><div class="journal-content-body">${content}</div></div>`;
    } else {
      html += `<div class="player-journal-list-header">
        <h4><i class="fas fa-book" aria-hidden="true"></i> ${game.i18n.localize('STORYFRAME.CinematicScene.Journal') || 'Journal'}</h4>
        <button type="button" class="player-journal-new-btn" data-action="createPlayerNote" data-tooltip="${game.i18n.localize('STORYFRAME.CinematicScene.NewNote') || 'New Note'}">
          <i class="fas fa-plus" aria-hidden="true"></i>
        </button>
      </div>`;
      html += `<div class="journal-search-row">
        <input type="text" class="journal-search-input player-journal-search" placeholder="${game.i18n.localize('STORYFRAME.CinematicScene.SearchJournals') || 'Search journals...'}" value="${esc(this.playerJournalSearchQuery)}">
      </div>`;
      html += `<div class="journal-entry-list">`;
      if (journalEntries.length === 0) {
        html += `<div class="left-panel-empty">${game.i18n.localize('STORYFRAME.CinematicScene.NoJournalsFound') || 'No journals found.'}</div>`;
      } else {
        for (const j of journalEntries) {
          html += `<div class="journal-entry-item" data-action="openPlayerJournal" data-journal-id="${j.id}">
            <i class="fas fa-book" aria-hidden="true"></i><span>${esc(j.name)}</span>
            ${j.pageCount > 1 ? `<span class="journal-page-count">${j.pageCount}</span>` : ''}
          </div>`;
          for (const p of j.matchingPages) {
            html += `<div class="journal-entry-item journal-page-match" data-action="openPlayerJournalPage" data-journal-id="${j.id}" data-page-id="${p.id}">
              <i class="fas fa-file-alt" aria-hidden="true"></i><span>${esc(p.name)}</span>
            </div>`;
          }
        }
      }
      html += `</div>`;
    }

    panel.innerHTML = html;
    this._bindPlayerJournalListeners();
  }

  _bindPlayerJournalListeners() {
    const panel = this.element?.querySelector('.cinematic-player-journal-panel');
    if (!panel) return;

    // Search input in list view
    const searchInput = panel.querySelector('.player-journal-search');
    if (searchInput) {
      if (this.playerJournalSearchQuery) {
        searchInput.focus();
        searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
      }
      searchInput.addEventListener('input', (e) => {
        this.playerJournalSearchQuery = e.target.value;
        this._updatePlayerJournalPanel();
      });
    }

    // Font size on content + slider
    const body = panel.querySelector('.journal-content-body');
    if (body) body.style.fontSize = `${this.playerJournalFontSize}rem`;

    panel.querySelector('.journal-font-size-slider')?.addEventListener('input', (e) => {
      this.playerJournalFontSize = parseFloat(e.target.value);
      panel.querySelector('.journal-content-body')?.style.setProperty('font-size', `${this.playerJournalFontSize}rem`);
      game.settings.set(MODULE_ID, 'cinematicJournalFontSize', this.playerJournalFontSize);
    });

    // Switcher search live filter
    panel.querySelector('.journal-switcher-search')?.addEventListener('input', (e) => {
      const sq = e.target.value.toLowerCase();
      panel.querySelectorAll('.journal-switcher-item').forEach(item => {
        item.style.display = item.querySelector('span')?.textContent?.toLowerCase().includes(sq) ? '' : 'none';
      });
    });

    // Journal image popout buttons (open in new tab)
    panel.querySelectorAll('.journal-content-body img').forEach(img => {
      if (img.closest('.journal-img-wrapper')) return;
      const wrapper = document.createElement('div');
      wrapper.classList.add('journal-img-wrapper');
      img.parentNode.insertBefore(wrapper, img);
      wrapper.appendChild(img);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.classList.add('journal-img-show-btn');
      btn.innerHTML = '<i class="fas fa-up-right-from-square"></i>';
      btn.title = game.i18n.localize('STORYFRAME.CinematicScene.PopoutImage') || 'Open in new tab';
      btn.addEventListener('click', () => window.open(img.src, '_blank'));
      wrapper.appendChild(btn);
    });

    // Pill scroll distances
    panel.querySelectorAll('.journal-pill-text').forEach(outer => {
      const inner = outer.querySelector('span');
      if (!inner) return;
      const overflow = inner.scrollWidth - outer.clientWidth;
      inner.style.setProperty('--sf-scroll-distance', overflow > 0 ? `-${overflow}px` : '0px');
    });
  }

  static _onTogglePlayerVolume() {
    this.playerVolumeExpanded = !this.playerVolumeExpanded;
    const panel = this.element?.querySelector('.cinematic-player-volume');
    panel?.classList.toggle('expanded', this.playerVolumeExpanded);
    if (this.playerVolumeExpanded) this._bindVolumeSlider();
  }

  _bindVolumeSlider() {
    const slider = this.element?.querySelector('.player-volume-slider');
    if (!slider || slider.dataset.bound) return;
    slider.dataset.bound = '1';
    let volTimer = null;
    slider.addEventListener('input', (e) => {
      const vol = parseFloat(e.target.value);
      clearTimeout(volTimer);
      volTimer = setTimeout(() => {
        game.settings.set('core', 'globalPlaylistVolume', vol);
      }, 150);
    });
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
