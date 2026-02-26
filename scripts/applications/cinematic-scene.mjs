import { MODULE_ID } from '../constants.mjs';
import * as SystemAdapter from '../system-adapter.mjs';
import { PlayerViewerApp } from './player-viewer.mjs';
import { PF2E_ACTION_DISPLAY_NAMES } from '../system/pf2e/actions.mjs';

/**
 * Cinematic Scene Mode for StoryFrame
 * Fullscreen immersive overlay showing speakers with film strip,
 * GM controls side panel, and non-intrusive roll UI for players.
 */
export class CinematicSceneApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
) {
  static DEFAULT_OPTIONS = {
    id: 'storyframe-cinematic-scene',
    classes: ['storyframe', 'cinematic-scene'],
    window: {
      title: 'STORYFRAME.CinematicScene.Title',
      frame: false,
      minimizable: false,
      resizable: false,
    },
    position: {
      width: window.innerWidth,
      height: window.innerHeight,
      top: 0,
      left: 0,
    },
    actions: {
      exitScene: CinematicSceneApp._onExitScene,
      switchSpeaker: CinematicSceneApp._onSwitchSpeaker,
      toggleSidePanel: CinematicSceneApp._onToggleSidePanel,
      toggleRollPanel: CinematicSceneApp._onToggleRollPanel,
      executeRoll: CinematicSceneApp._onExecuteRoll,
      selectChallengeOption: CinematicSceneApp._onSelectChallengeOption,
      requestQuickSkill: CinematicSceneApp._onRequestQuickSkill,
      toggleSecretRoll: CinematicSceneApp._onToggleSecretRoll,
      togglePresetDropdown: CinematicSceneApp._onTogglePresetDropdown,
      openGMSidebar: CinematicSceneApp._onOpenGMSidebar,
      toggleLeftPanel: CinematicSceneApp._onToggleLeftPanel,
      loadSpeakerScene: CinematicSceneApp._onLoadSpeakerScene,
      musicPlayPause: CinematicSceneApp._onMusicPlayPause,
      musicStop: CinematicSceneApp._onMusicStop,
      musicNext: CinematicSceneApp._onMusicNext,
      musicPrev: CinematicSceneApp._onMusicPrev,
      musicPlayTrack: CinematicSceneApp._onMusicPlayTrack,
      musicShuffle: CinematicSceneApp._onMusicShuffle,
      musicRepeat: CinematicSceneApp._onMusicRepeat,
      togglePlaylistExpand: CinematicSceneApp._onTogglePlaylistExpand,
      musicPlayPlaylist: CinematicSceneApp._onMusicPlayPlaylist,
      cancelPendingRoll: CinematicSceneApp._onCancelPendingRoll,
      journalOpen: CinematicSceneApp._onJournalOpen,
      journalClose: CinematicSceneApp._onJournalClose,
      journalMinimize: CinematicSceneApp._onJournalMinimize,
      journalExpand: CinematicSceneApp._onJournalExpand,
      journalSelectPage: CinematicSceneApp._onJournalSelectPage,
      journalOpenPage: CinematicSceneApp._onJournalOpenPage,
      toggleChallengePanel: CinematicSceneApp._onToggleChallengePanel,
      togglePlayerChat: CinematicSceneApp._onTogglePlayerChat,
      openCharacterSheet: CinematicSceneApp._onOpenCharacterSheet,
      presentSavedChallenge: CinematicSceneApp._onPresentSavedChallenge,
      removeChallenge: CinematicSceneApp._onRemoveChallenge,
      closeImagePreview: CinematicSceneApp._onCloseImagePreview,
      relaunchForPlayers: CinematicSceneApp._onRelaunchForPlayers,
      editSpeaker: CinematicSceneApp._onEditSpeaker,
      removeSpeaker: CinematicSceneApp._onRemoveSpeaker,
      toggleSpeakerVisibility: CinematicSceneApp._onToggleSpeakerVisibility,
      toggleSpeakerHidden: CinematicSceneApp._onToggleSpeakerHidden,
      cycleSpeakerImageNext: CinematicSceneApp._onCycleSpeakerImageNext,
      cycleSpeakerImagePrev: CinematicSceneApp._onCycleSpeakerImagePrev,
      addSpeakerAltImage: CinematicSceneApp._onAddSpeakerAltImage,
      removeSpeakerAltImage: CinematicSceneApp._onRemoveSpeakerAltImage,
    },
  };

  static PARTS = {
    content: {
      template: 'modules/storyframe/templates/cinematic-scene.hbs',
      scrollable: ['.roll-panel-content', '.challenge-panel-content', '.side-panel-speakers', '.left-panel-scenes', '.left-panel-playlists', '.journal-content-scroll', '.journal-entry-list'],
    },
  };

  constructor(options = {}) {
    super(options);
    this.sidePanelOpen = false;
    this.rollPanelExpanded = false;
    this._lastPendingCount = 0;
    this._escHandler = null;
    this.currentDC = null;
    this.secretRollEnabled = false;
    this.batchedChecks = [];
    this.leftPanelOpen = game.user?.isGM ?? false;
    this.expandedPlaylistIds = new Set();
    this.musicSearchQuery = '';
    this.openJournalId = null;
    this.openJournalPageId = null;
    this.journalMinimized = false;
    this.journalSearchQuery = '';
    this.challengePanelExpanded = false;
    this.playerChatExpanded = false;
    this._lastChallengeCount = 0;
    this.previewImageSrc = null;
    const savedHeights = game.settings.get(MODULE_ID, 'cinematicSectionHeights') || {};
    this._sectionHeights = { scenes: savedHeights.scenes ?? null, journal: savedHeights.journal ?? null, music: savedHeights.music ?? null, controls: savedHeights.controls ?? null, chat: savedHeights.chat ?? null };
    const savedWidths = game.settings.get(MODULE_ID, 'cinematicPanelWidths') || {};
    this._panelWidths = { left: savedWidths.left ?? null, right: savedWidths.right ?? null };
    this._playlistHookIds = [];
    this._prevSpeakerKey = '';
    this._prevActiveKey = '';
    this._prevParticipantKey = '';
    this._prevSpeakerFlagsKey = '';
    this._floatingPanelPositions = game.settings.get(MODULE_ID, 'cinematicFloatingPanelPositions') || {};
    this._debouncedMusicUpdate = foundry.utils.debounce(() => this._updateMusicDisplay(), 150);
    this._debouncedRender = foundry.utils.debounce(() => this.render(), 150);

    // Auto-open currently viewed journal and close the window (GM only)
    if (game.user?.isGM) {
      const sidebar = game.storyframe.gmSidebar;
      if (sidebar?.parentInterface?.document) {
        this.openJournalId = sidebar.parentInterface.document.id;
        // Try to get the currently viewed page from the DOM active page element
        const pi = sidebar.parentInterface;
        const piEl = pi.element?.jquery ? pi.element[0] : pi.element;
        const activePage = piEl?.querySelector?.('.journal-entry-page.active');
        const pageId = activePage?.dataset?.pageId
          || pi.document.pages.contents.find(p => p.type === 'text')?.id;
        if (pageId) this.openJournalPageId = pageId;
      }
      // Find open journal windows, use as fallback, and close them
      const openJournalSheets = Object.values(ui.windows).filter(w =>
        w.document?.documentName === 'JournalEntry' && w.rendered
      );
      if (!this.openJournalId && openJournalSheets.length > 0) {
        const sheet = openJournalSheets[0];
        this.openJournalId = sheet.document.id;
        const sheetEl = sheet.element?.jquery ? sheet.element[0] : sheet.element;
        const activePage = sheetEl?.querySelector?.('.journal-entry-page.active');
        const pageId = activePage?.dataset?.pageId
          || sheet.document.pages.contents.find(p => p.type === 'text')?.id;
        if (pageId) this.openJournalPageId = pageId;
      }
      for (const sheet of openJournalSheets) sheet.close();
    }
  }

  async _prepareContext(_options) {
    const state = game.storyframe.stateManager?.getState();
    const isGM = game.user.isGM;

    if (!state) {
      return { isGM, activeSpeaker: null, inactiveSpeakers: [], allSpeakers: [], actorRollGroups: [], activeChallenges: [], hasPendingContent: false, hasPendingRolls: false, hasPendingChallenges: false, sidePanelOpen: this.sidePanelOpen, rollPanelExpanded: this.rollPanelExpanded, challengePanelExpanded: this.challengePanelExpanded, gmPendingRolls: [], savedChallenges: [], gmActiveChallenges: [], journalEntries: [], openJournal: null, journalMinimized: false, journalSearchQuery: '', previewImageSrc: this.previewImageSrc };
    }

    // Filter speakers by visibility
    const visibleSpeakers = isGM
      ? state.speakers || []
      : (state.speakers || []).filter(s => !s.isHidden);

    // Resolve all speakers
    const allSpeakers = await this._resolveSpeakers(visibleSpeakers);
    const activeSpeakerId = state.activeSpeaker;

    // Split active vs inactive
    let activeSpeaker = null;
    let inactiveSpeakers = allSpeakers;
    if (activeSpeakerId) {
      activeSpeaker = allSpeakers.find(s => s.id === activeSpeakerId) || null;
      inactiveSpeakers = allSpeakers.filter(s => s.id !== activeSpeakerId);
    }

    // Prepare roll data (players only)
    let actorRollGroups = [];
    let totalPendingRolls = 0;
    if (!isGM && state.pendingRolls) {
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

            // Check DC visibility
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

      // Group by actor, with allow-only-one awareness (mirrors player-sidebar logic)
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

    // GM: pending rolls overview
    let gmPendingRolls = [];
    if (isGM && state.pendingRolls?.length > 0) {
      gmPendingRolls = await Promise.all(
        state.pendingRolls.map(async roll => {
          const actor = roll.actorUuid ? await fromUuid(roll.actorUuid) : null;
          const user = game.users.get(roll.userId);
          return {
            id: roll.id,
            actorName: actor?.name || 'Unknown',
            actorImg: actor?.img || 'icons/svg/mystery-man.svg',
            playerName: user?.name || 'Unknown',
            skillName: PlayerViewerApp._getSkillDisplayName(roll.skillSlug),
            dc: roll.dc,
          };
        })
      );
    }

    // Prepare challenge data (players only)
    let activeChallenges = [];
    let totalChallenges = 0;
    if (!isGM && state.activeChallenges?.length > 0) {
      let showDCs = true;
      const sys = SystemAdapter.detectSystem();
      if (sys === 'pf2e') showDCs = game.pf2e?.settings?.metagame?.dcs ?? true;
      else if (sys === 'dnd5e') {
        const vis = game.settings?.get('dnd5e', 'challengeVisibility') ?? 'all';
        showDCs = vis === 'all';
      }

      activeChallenges = state.activeChallenges.map(challenge => ({
        ...challenge,
        options: challenge.options.map(opt => ({
          ...opt,
          skillOptionsDisplay: opt.skillOptions.map(so => ({
            ...so,
            skillName: PlayerViewerApp._getSkillDisplayName(so.skill),
            showDC: showDCs,
          })),
        })),
      }));
      totalChallenges = activeChallenges.length;
    }

    const hasPendingRolls = totalPendingRolls > 0;
    const hasPendingChallenges = totalChallenges > 0;
    const hasPendingContent = hasPendingRolls || hasPendingChallenges;

    // Auto-expand roll panel when new rolls arrive
    if (hasPendingRolls && this._lastPendingCount === 0) {
      this.rollPanelExpanded = true;
    }
    this._lastPendingCount = totalPendingRolls;

    // Auto-expand challenge panel when new challenges arrive
    if (hasPendingChallenges && this._lastChallengeCount === 0) {
      this.challengePanelExpanded = true;
    }
    this._lastChallengeCount = totalChallenges;

    // GM: build skills list and check for participants
    let quickSkills = [];
    let hasParticipants = false;
    if (isGM) {
      hasParticipants = (state.participants?.length || 0) > 0;
      if (hasParticipants) {
        const skills = SystemAdapter.getSkills();
        quickSkills = Object.entries(skills).map(([slug, skill]) => ({
          slug,
          name: skill.name,
          icon: this._getSkillIcon(slug),
        }));
      }
    }

    // GM: left panel data (speaker scenes + playlists)
    let speakerScenes = [];
    let playlists = [];
    let nowPlaying = null;
    let currentVolume = 0.5;
    let shuffleActive = false;
    let repeatActive = false;
    let musicSearchResults = [];
    if (isGM) {
      speakerScenes = game.settings.get(MODULE_ID, 'speakerScenes') || [];
      playlists = game.playlists.contents.map(p => ({
        id: p.id, name: p.name, playing: p.playing, mode: p.mode,
        expanded: this.expandedPlaylistIds.has(p.id),
        trackCount: p.sounds.size,
        tracks: this.expandedPlaylistIds.has(p.id)
          ? p.sounds.contents.map(s => ({ id: s.id, name: s.name, playing: s.playing }))
          : [],
      }));
      nowPlaying = this._getNowPlaying();
      if (nowPlaying) {
        const pl = game.playlists.get(nowPlaying.playlistId);
        const sound = pl?.sounds.get(nowPlaying.soundId);
        if (sound) currentVolume = sound.volume;
        if (pl) shuffleActive = pl.mode === CONST.PLAYLIST_MODES.SHUFFLE;
        if (sound) repeatActive = sound.repeat;
      }
      // Search across all playlists
      if (this.musicSearchQuery) {
        const q = this.musicSearchQuery.toLowerCase();
        for (const p of game.playlists) {
          for (const s of p.sounds) {
            if (s.name.toLowerCase().includes(q)) {
              musicSearchResults.push({ id: s.id, name: s.name, playlistId: p.id, playlistName: p.name, playing: s.playing });
            }
          }
        }
      }
    }

    // PC row — available to everyone
    const pcRow = (state.participants || []).map(p => {
      const actor = globalThis.fromUuidSync?.(p.actorUuid);
      if (!actor) return null;
      return { actorUuid: p.actorUuid, name: actor.name, img: actor.img };
    }).filter(Boolean);

    // GM: challenge controls
    let savedChallenges = [];
    let gmActiveChallenges = [];
    if (isGM) {
      savedChallenges = (game.settings.get(MODULE_ID, 'challengeLibrary') || []).map(c => ({ id: c.id, name: c.name }));
      gmActiveChallenges = (state.activeChallenges || []).map(c => ({ id: c.id, name: c.name }));
    }

    // GM: journal data
    let journalEntries = [];
    let openJournal = null;
    if (isGM) {
      const allJournals = game.journal.contents
        .filter(j => j.testUserPermission(game.user, 'OBSERVER'))
        .sort((a, b) => a.name.localeCompare(b.name));
      if (this.journalSearchQuery) {
        const q = this.journalSearchQuery.toLowerCase();
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
      if (this.openJournalId) {
        const entry = game.journal.get(this.openJournalId);
        if (entry) {
          const pages = entry.pages.contents
            .filter(p => p.type === 'text')
            .sort((a, b) => a.sort - b.sort)
            .map(p => ({ id: p.id, name: p.name }));
          const activePage = this.openJournalPageId
            ? entry.pages.get(this.openJournalPageId)
            : entry.pages.contents.find(p => p.type === 'text');
          let enrichedContent = '';
          if (activePage?.text?.content) {
            enrichedContent = await TextEditor.enrichHTML(activePage.text.content, { async: true });
          }
          openJournal = {
            id: entry.id, name: entry.name, pages,
            activePageId: activePage?.id || null,
            enrichedContent,
          };
        } else {
          this.openJournalId = null;
        }
      }
    }

    return {
      isGM,
      activeSpeaker,
      activeSpeakerId,
      inactiveSpeakers,
      allSpeakers,
      actorRollGroups,
      activeChallenges,
      totalPendingRolls,
      totalChallenges,
      hasPendingContent,
      sidePanelOpen: this.sidePanelOpen,
      rollPanelExpanded: this.rollPanelExpanded,
      challengePanelExpanded: this.challengePanelExpanded,
      playerChatExpanded: this.playerChatExpanded,
      hasPendingRolls,
      hasPendingChallenges,
      pcRow,
      quickSkills,
      hasParticipants,
      currentDC: this.currentDC,
      secretRollEnabled: this.secretRollEnabled,
      leftPanelOpen: this.leftPanelOpen,
      speakerScenes,
      playlists,
      nowPlaying,
      currentVolume,
      shuffleActive,
      repeatActive,
      musicSearchQuery: this.musicSearchQuery,
      musicSearchResults,
      gmPendingRolls,
      savedChallenges,
      gmActiveChallenges,
      journalEntries,
      openJournal,
      journalMinimized: this.journalMinimized,
      journalSearchQuery: this.journalSearchQuery,
      previewImageSrc: this.previewImageSrc,
      speakerControlsMode: game.settings.get(MODULE_ID, 'speakerControlsMode') ?? 'hover',
    };
  }

  /**
   * Called by socket manager instead of render() — checks what changed and does targeted updates.
   * Only does a full render when structural elements (speakers, participants) change.
   */
  async _onStateChange() {
    if (!this.rendered) return;
    const state = game.storyframe.stateManager?.getState();
    if (!state) return;

    // Build keys to detect structural vs roll/challenge changes
    // GM: isHidden/isNameHidden don't affect DOM structure, track separately
    // Players: isHidden is structural (speaker appears/disappears)
    const speakerKey = game.user.isGM
      ? (state.speakers || []).map(s => `${s.id}:${s.imagePath}`).join('|')
      : (state.speakers || []).map(s => `${s.id}:${s.isHidden}:${s.imagePath}`).join('|');
    const speakerFlagsKey = game.user.isGM
      ? (state.speakers || []).map(s => `${s.id}:${s.isHidden}:${s.isNameHidden}`).join('|')
      : '';
    const activeKey = state.activeSpeaker || '';
    const participantKey = (state.participants || []).map(p => p.id).join(',');

    const structuralChange = speakerKey !== this._prevSpeakerKey
      || activeKey !== this._prevActiveKey
      || participantKey !== this._prevParticipantKey;
    const flagsChanged = game.user.isGM && speakerFlagsKey !== this._prevSpeakerFlagsKey;

    this._prevSpeakerKey = speakerKey;
    this._prevSpeakerFlagsKey = speakerFlagsKey;
    this._prevActiveKey = activeKey;
    this._prevParticipantKey = participantKey;

    if (structuralChange) {
      this.render();
    } else {
      if (flagsChanged) this._updateSpeakerFlagsInDOM(state);
      this._refreshRollPanel();
    }
  }

  /** Targeted update for roll panel without full re-render */
  async _refreshRollPanel() {
    const ctx = await this._prepareContext({});

    if (game.user.isGM) {
      // --- Pending Rolls ---
      const floatingPending = this.element?.querySelector('.cinematic-floating-pending');
      if (floatingPending) {
        floatingPending.classList.toggle('hidden', ctx.gmPendingRolls.length === 0);
        const badge = floatingPending.querySelector('.pending-rolls-badge');
        if (badge) badge.textContent = ctx.gmPendingRolls.length || '';
        const rollsContainer = floatingPending.querySelector('.cinematic-pending-rolls');
        if (rollsContainer) {
          rollsContainer.innerHTML = ctx.gmPendingRolls.map(r => `
            <div class="cinematic-pending-roll-item">
              <img src="${r.actorImg}" alt="${r.actorName}" class="pending-roll-avatar" loading="lazy">
              <div class="pending-roll-info">
                <span class="pending-roll-actor">${r.actorName}</span>
                <span class="pending-roll-skill">${r.skillName}${r.dc ? ` DC ${r.dc}` : ''}</span>
              </div>
              <button type="button" class="pending-roll-cancel" data-action="cancelPendingRoll" data-request-id="${r.id}">
                <i class="fas fa-times"></i>
              </button>
            </div>
          `).join('');
        }
      }

      // --- Active Challenges ---
      const floatingChallenges = this.element?.querySelector('.cinematic-floating-challenges');
      if (floatingChallenges) {
        floatingChallenges.classList.toggle('hidden', ctx.gmActiveChallenges.length === 0);
        const badge = floatingChallenges.querySelector('.active-challenges-badge');
        if (badge) badge.textContent = ctx.gmActiveChallenges.length || '';
        const list = floatingChallenges.querySelector('.cinematic-floating-challenges-list');
        if (list) {
          list.innerHTML = ctx.gmActiveChallenges.map(c => `
            <div class="cinematic-active-challenge-item">
              <span>${c.name}</span>
              <button type="button" class="active-challenge-remove" data-action="removeChallenge" data-challenge-id="${c.id}">
                <i class="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>
          `).join('');
        }
      }
    } else {
      // Update player roll panel — toggle hidden class instead of full re-render
      const rollPanel = this.element?.querySelector('.cinematic-roll-panel');
      if (rollPanel) {
        rollPanel.classList.toggle('hidden', !ctx.hasPendingRolls);

        // Update badge
        const rollBadge = rollPanel.querySelector('.roll-badge');
        if (rollBadge) rollBadge.textContent = ctx.totalPendingRolls || '';

        // Auto-expand if new rolls arrived
        if (ctx.hasPendingRolls && !this.rollPanelExpanded) {
          this.rollPanelExpanded = true;
          rollPanel.classList.add('expanded');
        }

        // Re-render the roll content section
        const content = rollPanel.querySelector('.roll-panel-content');
        if (content) {
          content.innerHTML = this._buildRollPanelHTML(ctx);
        }
      }

      // Update player challenge panel
      const challengePanel = this.element?.querySelector('.cinematic-challenge-panel');
      if (challengePanel) {
        challengePanel.classList.toggle('hidden', !ctx.hasPendingChallenges);

        // Update badge
        const challengeBadge = challengePanel.querySelector('.challenge-badge');
        if (challengeBadge) challengeBadge.textContent = ctx.totalChallenges || '';

        // Auto-expand if new challenges arrived
        if (ctx.hasPendingChallenges && !this.challengePanelExpanded) {
          this.challengePanelExpanded = true;
          challengePanel.classList.add('expanded');
        }

        // Re-render challenge content
        const challengeContent = challengePanel.querySelector('.challenge-panel-content');
        if (challengeContent) {
          challengeContent.innerHTML = this._buildChallengePanelHTML(ctx);
        }
      }
    }
  }

  /** Targeted DOM update for speaker hidden/nameHidden flags — no full re-render */
  _updateSpeakerFlagsInDOM(state) {
    for (const speaker of state.speakers || []) {
      const card = this.element?.querySelector(`.filmstrip-speaker[data-speaker-id="${speaker.id}"]`);
      if (!card) continue;
      card.classList.toggle('speaker-is-hidden', !!speaker.isHidden);
      card.classList.toggle('name-is-hidden', !!speaker.isNameHidden);
      const hideBtn = card.querySelector('[data-action="toggleSpeakerHidden"]');
      if (hideBtn) {
        const icon = hideBtn.querySelector('i');
        if (icon) icon.className = `fas ${speaker.isHidden ? 'fa-eye' : 'fa-eye-slash'}`;
        hideBtn.dataset.tooltip = speaker.isHidden ? game.i18n.localize('STORYFRAME.CinematicScene.ShowSpeaker') : game.i18n.localize('STORYFRAME.CinematicScene.HideSpeaker');
      }
      const nameBtn = card.querySelector('[data-action="toggleSpeakerVisibility"]');
      if (nameBtn) {
        nameBtn.dataset.tooltip = speaker.isNameHidden ? game.i18n.localize('STORYFRAME.CinematicScene.ShowName') : game.i18n.localize('STORYFRAME.CinematicScene.HideName');
      }
    }
  }

  /** Build roll panel inner HTML from context */
  _buildRollPanelHTML(ctx) {
    let html = '';
    for (const group of ctx.actorRollGroups) {
      html += `<div class="cinematic-roll-group ${group.hasAllowOnlyOne ? 'allow-only-one-group' : ''}">`;
      html += `<div class="roll-group-header">`;
      html += `<img src="${group.actorImg}" alt="${group.actorName}" class="roll-actor-avatar" loading="lazy">`;
      html += `<span class="roll-actor-name">${group.actorName}</span>`;
      if (group.hasAllowOnlyOne) {
        html += `<span class="cinematic-allow-one-badge"><i class="fas fa-hand-pointer"></i> ${game.i18n.localize('STORYFRAME.UI.Labels.ChooseOne')}</span>`;
      }
      html += `</div><div class="roll-group-buttons">`;
      for (const roll of group.rolls) {
        html += `<button type="button" class="cinematic-roll-btn" data-action="executeRoll" data-request-id="${roll.id}">`;
        html += `<span class="roll-skill-name">${roll.skillName}</span>`;
        if (roll.dc) html += `<span class="dc-mini">DC ${roll.dc}</span>`;
        html += `</button>`;
      }
      html += `</div></div>`;
    }
    return html;
  }

  /** Build challenge panel inner HTML from context */
  _buildChallengePanelHTML(ctx) {
    let html = '';
    for (const challenge of ctx.activeChallenges) {
      html += `<div class="cinematic-challenge-group" data-challenge-id="${challenge.id}">`;
      html += `<div class="challenge-group-header">`;
      if (challenge.image) html += `<img src="${challenge.image}" alt="${challenge.name}" class="challenge-thumb" loading="lazy">`;
      html += `<span class="challenge-group-name">${challenge.name}</span>`;
      html += `</div>`;
      for (const opt of challenge.options) {
        html += `<div class="challenge-option-compact">`;
        if (opt.name) html += `<span class="option-label">${opt.name}</span>`;
        html += `<div class="challenge-skill-buttons">`;
        for (const so of opt.skillOptionsDisplay) {
          html += `<button type="button" class="cinematic-roll-btn" data-action="selectChallengeOption"`;
          html += ` data-skill="${so.skill}" data-check-type="${so.checkType}" data-dc="${so.dc}"`;
          html += ` data-action-slug="${so.action}" data-action-variant="${so.actionVariant}" data-is-secret="${so.isSecret}">`;
          html += `<span class="roll-skill-name">${so.skillName}</span>`;
          if (so.showDC) html += `<span class="dc-mini">DC ${so.dc}</span>`;
          html += `</button>`;
        }
        html += `</div></div>`;
      }
      html += `</div>`;
    }
    return html;
  }

  _onRender(_context, _options) {
    super._onRender(_context, _options);

    // ESC handler for GM
    if (game.user.isGM && !this._escHandler) {
      this._escHandler = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          CinematicSceneApp._onExitScene.call(this);
        }
      };
      document.addEventListener('keydown', this._escHandler, { capture: true });
    }

    // DC input listener
    const dcInput = this.element?.querySelector('.cinematic-dc-input');
    if (dcInput) {
      dcInput.addEventListener('change', (e) => {
        const val = parseInt(e.target.value);
        this.currentDC = isNaN(val) ? null : val;
      });
    }

    // Playlist reactivity hooks (GM only, register once)
    if (game.user.isGM && this._playlistHookIds.length === 0) {
      this._playlistHookIds.push(
        { hook: 'updatePlaylist', id: Hooks.on('updatePlaylist', () => this._debouncedMusicUpdate()) },
        { hook: 'updatePlaylistSound', id: Hooks.on('updatePlaylistSound', () => this._debouncedMusicUpdate()) },
      );
    }

    // Right-click context menu for skill buttons (PF2e actions/variants)
    if (game.user.isGM) {
      const skillBtns = this.element?.querySelectorAll('.side-panel-skill-btn[data-skill]');
      if (skillBtns?.length) {
        const cinematic = this;
        skillBtns.forEach(btn => {
          btn.addEventListener('contextmenu', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const skillSlug = btn.dataset.skill;
            if (!skillSlug) return;
            const { showSkillActionsMenu } = await import('./gm-sidebar/managers/ui-helpers.mjs');
            showSkillActionsMenu(e, skillSlug, cinematic);
          });
        });
      }
    }

    // Volume slider binding
    const volumeSlider = this.element?.querySelector('.cinematic-music-volume');
    if (volumeSlider) {
      volumeSlider.addEventListener('input', (e) => {
        const np = this._getNowPlaying();
        if (np) {
          const sound = game.playlists.get(np.playlistId)?.sounds.get(np.soundId);
          sound?.update({ volume: parseFloat(e.target.value) });
        }
      });
    }

    // Music search binding + restore focus after render
    const searchInput = this.element?.querySelector('.music-search-input');
    if (searchInput) {
      if (this.musicSearchQuery) {
        searchInput.focus();
        searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
      }
      searchInput.addEventListener('input', (e) => {
        this.musicSearchQuery = e.target.value;
        this._debouncedRender();
      });
    }

    // Journal search binding
    const journalSearch = this.element?.querySelector('.journal-search-input');
    if (journalSearch) {
      if (this.journalSearchQuery) {
        journalSearch.focus();
        journalSearch.setSelectionRange(journalSearch.value.length, journalSearch.value.length);
      }
      journalSearch.addEventListener('input', (e) => {
        this.journalSearchQuery = e.target.value;
        this._debouncedRender();
      });
    }

    // Restore saved section heights and bind resize handles
    if (game.user.isGM) {
      for (const [key, height] of Object.entries(this._sectionHeights)) {
        if (height != null) {
          const section = this.element?.querySelector(`.left-panel-section[data-section="${key}"], .side-panel-resizable[data-section="${key}"]`);
          if (section) section.style.flex = `0 0 ${height}px`;
        }
      }

      this.element?.querySelectorAll('.section-resize-handle').forEach(handle => {
        handle.addEventListener('mousedown', (e) => this._onResizeStart(e, handle));
      });

      // Populate side panel chat log
      const chatContainer = this.element?.querySelector('.side-panel-chat-messages');
      if (chatContainer) {
        this._populateChatLog(chatContainer);
        if (this._chatHookId != null) Hooks.off('createChatMessage', this._chatHookId);
        this._chatHookId = Hooks.on('createChatMessage', (msg) => {
          this._appendChatMessage(chatContainer, msg);
        });
      }

      // Apply saved panel widths
      if (this._panelWidths.left) {
        this.element.style.setProperty('--left-panel-width', `${this._panelWidths.left}px`);
      }
      if (this._panelWidths.right) {
        this.element.style.setProperty('--right-panel-width', `${this._panelWidths.right}px`);
      }

      // Bind panel width resize handles
      this.element?.querySelectorAll('.panel-width-handle').forEach(handle => {
        handle.addEventListener('mousedown', (e) => this._onWidthResizeStart(e, handle));
      });
    }

    // Re-attach player chat hook after re-render if it was already open
    if (!game.user.isGM && this.playerChatExpanded) {
      const container = this.element?.querySelector('.player-chat-messages');
      if (container && !container.dataset.populated) {
        container.dataset.populated = '1';
        this._populateChatLog(container);
        if (this._playerChatHookId != null) Hooks.off('createChatMessage', this._playerChatHookId);
        this._playerChatHookId = Hooks.on('createChatMessage', (msg) => {
          this._appendChatMessage(container, msg);
        });
      }
    }

    // Inject "show in spotlight" buttons on journal images
    const journalImages = this.element?.querySelectorAll('.journal-content-body img');
    journalImages?.forEach(img => {
      if (img.closest('.journal-img-wrapper')) return;
      const wrapper = document.createElement('div');
      wrapper.classList.add('journal-img-wrapper');
      img.parentNode.insertBefore(wrapper, img);
      wrapper.appendChild(img);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.classList.add('journal-img-show-btn');
      btn.innerHTML = '<i class="fas fa-expand"></i>';
      btn.addEventListener('click', () => {
        this.previewImageSrc = img.src;
        this.render();
      });
      wrapper.appendChild(btn);
    });

    // Spotlight: hide until portrait image is loaded to prevent layout-shift animation
    const spotlightImg = this.element?.querySelector('.spotlight-portrait');
    const spotlight = spotlightImg?.closest('.cinematic-spotlight');
    if (spotlight && spotlightImg) {
      spotlight.style.visibility = 'hidden';
      spotlight.style.animationName = 'none';
      const showSpotlight = () => {
        spotlight.style.visibility = '';
        spotlight.style.animationName = '';
        void spotlight.offsetWidth; // force reflow so animation restarts
      };
      if (spotlightImg.complete && spotlightImg.naturalHeight > 0) {
        showSpotlight();
      } else {
        spotlightImg.addEventListener('load', showSpotlight, { once: true });
        spotlightImg.addEventListener('error', showSpotlight, { once: true });
      }
    }

    // Filmstrip scroll indicators
    const filmstrip = this.element?.querySelector('.cinematic-filmstrip');
    if (filmstrip) {
      const updateIndicators = () => {
        const container = filmstrip.closest('.cinematic-filmstrip-container');
        if (!container) return;
        const atLeft = filmstrip.scrollLeft <= 5;
        const atRight = filmstrip.scrollLeft + filmstrip.clientWidth >= filmstrip.scrollWidth - 5;
        container.classList.toggle('scroll-left-visible', !atLeft);
        container.classList.toggle('scroll-right-visible', !atRight);
      };
      filmstrip.addEventListener('scroll', updateIndicators);
      updateIndicators();
    }

    // Make floating GM panels draggable
    if (game.user.isGM) {
      for (const key of ['cinematic-floating-pending', 'cinematic-floating-challenges']) {
        const panel = this.element?.querySelector(`.${key}`);
        if (panel) this._makePanelDraggable(panel, key);
      }
    }

    // Seed state-change baseline so first _onStateChange never false-triggers a full re-render
    const _seedState = game.storyframe.stateManager?.getState();
    if (_seedState) {
      this._prevSpeakerKey = game.user.isGM
        ? (_seedState.speakers || []).map(s => `${s.id}:${s.imagePath}`).join('|')
        : (_seedState.speakers || []).map(s => `${s.id}:${s.isHidden}:${s.imagePath}`).join('|');
      this._prevSpeakerFlagsKey = game.user.isGM
        ? (_seedState.speakers || []).map(s => `${s.id}:${s.isHidden}:${s.isNameHidden}`).join('|')
        : '';
      this._prevActiveKey = _seedState.activeSpeaker || '';
      this._prevParticipantKey = (_seedState.participants || []).map(p => p.id).join(',');
    }
  }

  _onResizeStart(e, handle) {
    e.preventDefault();
    const aboveKey = handle.dataset.resizeAbove;
    const belowKey = handle.dataset.resizeBelow;
    const aboveEl = this.element?.querySelector(`[data-section="${aboveKey}"]`);
    const belowEl = this.element?.querySelector(`[data-section="${belowKey}"]`);
    if (!aboveEl || !belowEl) return;

    const startY = e.clientY;
    const startAboveH = aboveEl.getBoundingClientRect().height;
    const startBelowH = belowEl.getBoundingClientRect().height;
    handle.classList.add('dragging');

    const onMove = (ev) => {
      const delta = ev.clientY - startY;
      const newAbove = Math.max(40, startAboveH + delta);
      const newBelow = Math.max(40, startBelowH - delta);
      aboveEl.style.flex = `0 0 ${newAbove}px`;
      belowEl.style.flex = `0 0 ${newBelow}px`;
    };

    const onUp = () => {
      handle.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      this._sectionHeights[aboveKey] = aboveEl.getBoundingClientRect().height;
      this._sectionHeights[belowKey] = belowEl.getBoundingClientRect().height;
      game.settings.set(MODULE_ID, 'cinematicSectionHeights', { ...this._sectionHeights });
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  _onWidthResizeStart(e, handle) {
    e.preventDefault();
    const isLeft = handle.classList.contains('panel-width-handle-right');
    const panel = handle.closest('.cinematic-left-panel, .cinematic-side-panel');
    if (!panel) return;

    const startX = e.clientX;
    const startW = panel.getBoundingClientRect().width;
    const varName = isLeft ? '--left-panel-width' : '--right-panel-width';
    const key = isLeft ? 'left' : 'right';
    handle.classList.add('dragging');

    const onMove = (ev) => {
      const delta = isLeft ? (ev.clientX - startX) : (startX - ev.clientX);
      const newW = Math.max(200, Math.min(600, startW + delta));
      this.element.style.setProperty(varName, `${newW}px`);
    };

    const onUp = () => {
      handle.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      this._panelWidths[key] = panel.getBoundingClientRect().width;
      game.settings.set(MODULE_ID, 'cinematicPanelWidths', { ...this._panelWidths });
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  _makePanelDraggable(panel, key) {
    // Restore saved position if any
    const saved = this._floatingPanelPositions[key];
    if (saved) {
      panel.style.left = `${saved.x}px`;
      panel.style.top = `${saved.y}px`;
      panel.style.right = 'auto';
    }

    panel.style.cursor = 'grab';

    const onMouseDown = (e) => {
      if (e.button !== 0) return;
      // Don't drag if clicking a button inside
      if (e.target.closest('button')) return;
      e.preventDefault();
      const rect = panel.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      panel.style.cursor = 'grabbing';
      panel.style.right = 'auto';

      const onMove = (ev) => {
        const x = Math.max(0, Math.min(window.innerWidth - rect.width, ev.clientX - offsetX));
        const y = Math.max(0, Math.min(window.innerHeight - rect.height, ev.clientY - offsetY));
        panel.style.left = `${x}px`;
        panel.style.top = `${y}px`;
      };

      const onUp = () => {
        panel.style.cursor = 'grab';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        this._floatingPanelPositions[key] = {
          x: parseFloat(panel.style.left),
          y: parseFloat(panel.style.top),
        };
        game.settings.set(MODULE_ID, 'cinematicFloatingPanelPositions', { ...this._floatingPanelPositions });
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };

    panel.addEventListener('mousedown', onMouseDown);
  }

  _populateChatLog(container) {
    container.innerHTML = '';
    const messages = game.messages.contents.slice(-50);
    for (const msg of messages) {
      if (!msg.visible) continue;
      msg.getHTML().then(html => {
        const el = html?.jquery ? html[0] : html;
        container.appendChild(el);
      });
    }
    requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; });
    this._bindChatContextMenu(container);
  }

  _bindChatContextMenu(container) {
    const raw = ui.chat?._getEntryContextOptions?.();
    if (!raw?.length) return;

    container.addEventListener('contextmenu', (e) => {
      const msgEl = e.target.closest('.message');
      if (!msgEl) return;
      e.preventDefault();
      e.stopPropagation();

      // Remove any existing menu
      document.getElementById('cinematic-context-menu')?.remove();

      // Filter to options whose condition passes
      const jEl = globalThis.jQuery ? globalThis.jQuery(msgEl) : msgEl;
      const visible = raw.filter(opt => {
        if (!opt.condition) return true;
        try { return opt.condition(jEl); } catch { return false; }
      });
      if (!visible.length) return;

      // Build a fixed-position menu on body so it escapes overflow:hidden
      const menu = document.createElement('nav');
      menu.id = 'cinematic-context-menu';
      Object.assign(menu.style, {
        position: 'fixed',
        left: `${e.clientX}px`,
        top: `${e.clientY}px`,
        zIndex: '100002',
        background: 'var(--background-color, #1a1a2e)',
        border: '1px solid var(--border-color, rgba(94,129,172,0.4))',
        borderRadius: '5px',
        minWidth: '150px',
        boxShadow: '0 3px 12px rgba(0,0,0,0.6)',
        padding: '4px 0',
      });

      const ol = document.createElement('ol');
      ol.className = 'context-items';
      ol.style.cssText = 'list-style:none;margin:0;padding:0;';

      for (const opt of visible) {
        const li = document.createElement('li');
        li.className = 'context-item';
        li.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 12px;cursor:pointer;color:var(--text-color,#ccc);font-size:0.85rem;white-space:nowrap;';
        li.innerHTML = `<i class="${opt.icon}" style="width:14px;text-align:center;"></i>${opt.name}`;
        li.addEventListener('mouseover', () => { li.style.background = 'rgba(94,129,172,0.2)'; });
        li.addEventListener('mouseout', () => { li.style.background = ''; });
        li.addEventListener('click', (ev) => {
          ev.stopPropagation();
          try { opt.callback(jEl); } catch(err) { console.error('StoryFrame | context menu callback error', err); }
          menu.remove();
        });
        ol.appendChild(li);
      }

      menu.appendChild(ol);
      document.body.appendChild(menu);

      // Clamp to viewport
      const rect = menu.getBoundingClientRect();
      if (rect.right > window.innerWidth) menu.style.left = `${window.innerWidth - rect.width - 8}px`;
      if (rect.bottom > window.innerHeight) menu.style.top = `${window.innerHeight - rect.height - 8}px`;

      // Close on next click anywhere
      const close = (ev) => {
        if (!menu.contains(ev.target)) {
          menu.remove();
          document.removeEventListener('click', close, true);
        }
      };
      setTimeout(() => document.addEventListener('click', close, true), 0);
    });
  }

  _appendChatMessage(container, msg) {
    if (!container?.isConnected || !msg.visible) return;
    const wasAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 30;
    msg.getHTML().then(html => {
      const el = html?.jquery ? html[0] : html;
      container.appendChild(el);
      if (wasAtBottom) container.scrollTop = container.scrollHeight;
    });
  }

  async _onClose(_options) {
    // Clean up ESC handler
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler, { capture: true });
      this._escHandler = null;
    }

    // Clear reference
    game.storyframe.cinematicScene = null;
    document.getElementById('cinematic-context-menu')?.remove();

    // Remove playlist hooks
    for (const { hook, id } of this._playlistHookIds) {
      Hooks.off(hook, id);
    }
    this._playlistHookIds = [];

    // Remove chat hooks
    if (this._chatHookId != null) {
      Hooks.off('createChatMessage', this._chatHookId);
      this._chatHookId = null;
    }
    if (this._playerChatHookId != null) {
      Hooks.off('createChatMessage', this._playerChatHookId);
      this._playerChatHookId = null;
    }

    // Reset state
    this.sidePanelOpen = false;
    this.rollPanelExpanded = false;
    this._lastPendingCount = 0;
    this.currentDC = null;
    this.secretRollEnabled = false;
    this.batchedChecks = [];
    this.leftPanelOpen = false;
    this.expandedPlaylistIds.clear();
    this.musicSearchQuery = '';
    this.openJournalId = null;
    this.openJournalPageId = null;
    this.journalMinimized = false;
    this.journalSearchQuery = '';
    this.challengePanelExpanded = false;
    this.playerChatExpanded = false;
    this._lastChallengeCount = 0;
    this.previewImageSrc = null;
    this._prevSpeakerKey = '';
    this._prevActiveKey = '';
    this._prevParticipantKey = '';
    this._prevSpeakerFlagsKey = '';

    return super._onClose(_options);
  }

  // --- Speaker Resolution (mirrors PlayerViewerApp) ---

  async _resolveSpeakers(speakers) {
    return Promise.all(speakers.map(s => this._resolveSpeaker(s)));
  }

  async _resolveSpeaker(speaker) {
    let name, img;

    if (speaker.actorUuid) {
      const actor = await fromUuid(speaker.actorUuid);
      if (actor) {
        img = speaker.imagePath || actor.img;
        name = actor.name;
      } else {
        img = 'icons/svg/mystery-man.svg';
        name = speaker.label || game.i18n.localize('STORYFRAME.UI.Labels.Unknown');
      }
    } else {
      img = speaker.imagePath || 'icons/svg/mystery-man.svg';
      name = speaker.label;
    }

    if (speaker.isNameHidden && !game.user.isGM) {
      name = game.i18n.localize('STORYFRAME.UI.Labels.Unknown');
    }

    // Build alt image list to determine hasAltImages / canRemoveCurrentImage
    const allImages = [];
    if (speaker.actorUuid) {
      const actor = await fromUuid(speaker.actorUuid);
      if (actor) {
        allImages.push(actor.img);
        const tokenImg = actor.prototypeToken?.texture?.src;
        if (tokenImg && tokenImg !== actor.img) allImages.push(tokenImg);
      }
    } else if (img) {
      allImages.push(img);
    }
    (speaker.altImages || []).forEach(i => { if (!allImages.includes(i)) allImages.push(i); });

    return {
      id: speaker.id,
      img,
      name,
      isHidden: speaker.isHidden || false,
      isNameHidden: speaker.isNameHidden || false,
      hasAltImages: allImages.length > 1,
      canRemoveCurrentImage: (speaker.altImages || []).includes(img),
    };
  }

  _getSkillIcon(slug) {
    const iconMap = {
      per: 'fa-eye', acr: 'fa-person-running', arc: 'fa-wand-sparkles',
      ath: 'fa-dumbbell', cra: 'fa-hammer', dec: 'fa-mask',
      dip: 'fa-handshake', itm: 'fa-fist-raised', med: 'fa-kit-medical',
      nat: 'fa-leaf', occ: 'fa-book-skull', prf: 'fa-music',
      rel: 'fa-cross', soc: 'fa-users', ste: 'fa-user-secret',
      sur: 'fa-compass', thi: 'fa-hand-holding',
      ani: 'fa-paw', his: 'fa-scroll', ins: 'fa-lightbulb',
      inv: 'fa-search', prc: 'fa-eye', slt: 'fa-hand-sparkles',
    };
    return iconMap[slug] || 'fa-dice-d20';
  }

  // --- Action Handlers ---

  static async _onExitScene() {
    if (!game.user.isGM) return;
    game.storyframe.socketManager.closeSceneMode();
  }

  static _onRelaunchForPlayers() {
    if (!game.user.isGM) return;
    game.storyframe.socketManager.launchSceneMode();
    ui.notifications.info(game.i18n.localize('STORYFRAME.CinematicScene.Relaunched'));
  }

  static async _onSwitchSpeaker(_event, target) {
    if (!game.user.isGM) return;
    const speakerId = target.closest('[data-speaker-id]')?.dataset.speakerId;
    await game.storyframe.socketManager.requestSetActiveSpeaker(speakerId || null);
    this.render();
  }

  static _onToggleSidePanel() {
    this.sidePanelOpen = !this.sidePanelOpen;
    this.element?.querySelector('.cinematic-side-panel')?.classList.toggle('open', this.sidePanelOpen);
  }

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

  static async _onRequestQuickSkill(_event, target) {
    if (!game.user.isGM) return;
    const skillSlug = target.dataset.skill;
    if (!skillSlug) return;

    // Use RollRequestDialog flow — pass this cinematic app as the "sidebar" context
    // so it reads currentDC and secretRollEnabled from our side panel controls
    const { openRollRequesterAndSend } = await import('./gm-sidebar/managers/skill-check-handlers.mjs');
    await openRollRequesterAndSend(this, skillSlug, 'skill');
  }

  static _onToggleSecretRoll() {
    this.secretRollEnabled = !this.secretRollEnabled;
    const btn = this.element?.querySelector('.cinematic-secret-btn');
    btn?.classList.toggle('active', this.secretRollEnabled);
    btn?.setAttribute('aria-pressed', this.secretRollEnabled ? 'true' : 'false');
  }

  static async _onTogglePresetDropdown(event, target) {
    const { onTogglePresetDropdown } = await import('./gm-sidebar/managers/dc-handlers.mjs');
    const { getAllPlayerPCs, getDCOptions, getDifficultyAdjustments } = await import('../system-adapter.mjs');

    // Pre-compute party level (async) before building the synchronous popup
    const pcs = await getAllPlayerPCs();
    let computedPartyLevel = null;
    if (pcs.length > 0) {
      const levels = await Promise.all(
        pcs.map(async pc => {
          const actor = await fromUuid(pc.actorUuid);
          return actor?.system?.details?.level?.value ?? actor?.system?.level ?? null;
        })
      );
      const valid = levels.filter(l => l !== null);
      if (valid.length > 0) computedPartyLevel = Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
    }

    const cinematic = this;
    const proxy = {
      get currentDC() { return cinematic.currentDC; },
      set currentDC(v) { cinematic.currentDC = v; },
      get partyLevel() { return computedPartyLevel; },
      _calculateDCByLevel(level, difficultyId) {
        const dcOptions = getDCOptions();
        const diffAdj = getDifficultyAdjustments();
        const levelOpt = dcOptions.find(opt => opt.value === level);
        const baseDC = levelOpt?.dc || 14;
        const diff = diffAdj?.find(d => d.id === difficultyId);
        return baseDC + (diff?.adjustment || 0);
      },
      async _getPartyLevel() { return computedPartyLevel; },
      get element() {
        return {
          querySelector(sel) {
            if (sel === '#dc-input') return cinematic.element?.querySelector('.cinematic-dc-input');
            return cinematic.element?.querySelector(sel);
          },
        };
      },
    };
    onTogglePresetDropdown(event, target, proxy);
  }

  // --- Left Panel Actions ---

  static _onToggleLeftPanel() {
    this.leftPanelOpen = !this.leftPanelOpen;
    this.element?.querySelector('.cinematic-left-panel')?.classList.toggle('open', this.leftPanelOpen);
  }

  static async _onLoadSpeakerScene(_event, target) {
    if (!game.user.isGM) return;
    const sceneId = target.closest('[data-scene-id]')?.dataset.sceneId;
    if (!sceneId) return;
    const scenes = game.settings.get(MODULE_ID, 'speakerScenes') || [];
    const scene = scenes.find(s => s.id === sceneId);
    if (scene?.speakers) {
      await game.storyframe.socketManager.requestUpdateSpeakers(scene.speakers);
      this.render();
    }
  }

  // --- Music Actions ---

  _getNowPlaying() {
    for (const playlist of game.playlists) {
      for (const sound of playlist.sounds) {
        if (sound.playing) {
          return { trackName: sound.name, playlistName: playlist.name, playlistId: playlist.id, soundId: sound.id };
        }
      }
    }
    return null;
  }

  /** Targeted DOM update for music state — avoids full re-render */
  _updateMusicDisplay() {
    if (!this.element) return;
    const np = this._getNowPlaying();

    // Now-playing section
    const npSection = this.element.querySelector('.music-now-playing');
    if (np && npSection) {
      npSection.querySelector('.now-playing-track').textContent = np.trackName;
      npSection.querySelector('.now-playing-playlist').textContent = np.playlistName;
      npSection.style.display = '';
    } else if (!np && npSection) {
      npSection.style.display = 'none';
    } else if (np && !npSection) {
      // Now-playing appeared — need structural update
      return this.render();
    }

    // Play/pause icon
    const ppIcon = this.element.querySelector('[data-action="musicPlayPause"] i');
    if (ppIcon) ppIcon.className = `fas ${np ? 'fa-pause' : 'fa-play'}`;

    // Shuffle/repeat active states
    const shuffleBtn = this.element.querySelector('[data-action="musicShuffle"]');
    const repeatBtn = this.element.querySelector('[data-action="musicRepeat"]');
    if (np) {
      const pl = game.playlists.get(np.playlistId);
      const sound = pl?.sounds.get(np.soundId);
      shuffleBtn?.classList.toggle('active', pl?.mode === CONST.PLAYLIST_MODES.SHUFFLE);
      repeatBtn?.classList.toggle('active', sound?.repeat === true);
      // Volume
      const vol = this.element.querySelector('.cinematic-music-volume');
      if (vol && sound) vol.value = sound.volume;
    } else {
      shuffleBtn?.classList.remove('active');
      repeatBtn?.classList.remove('active');
    }

    // Playlist playing indicators
    this.element.querySelectorAll('.left-panel-playlist-item').forEach(el => {
      const plId = el.querySelector('[data-playlist-id]')?.dataset.playlistId
        || el.querySelector('.playlist-expand-btn')?.dataset.playlistId;
      if (plId) {
        const pl = game.playlists.get(plId);
        el.classList.toggle('playing', pl?.playing === true);
      }
    });

    // Track playing indicators
    this.element.querySelectorAll('.left-panel-track-item').forEach(el => {
      const soundId = el.dataset.soundId;
      const playlistId = el.dataset.playlistId;
      if (!soundId || !playlistId) return;
      const sound = game.playlists.get(playlistId)?.sounds.get(soundId);
      const icon = el.querySelector('i');
      if (icon) icon.className = `fas ${sound?.playing ? 'fa-pause' : 'fa-play'}`;
      el.classList.toggle('playing', sound?.playing === true);
    });

    // Search result playing indicators
    this.element.querySelectorAll('.music-search-results .left-panel-track-item').forEach(el => {
      const soundId = el.dataset.soundId;
      const playlistId = el.dataset.playlistId;
      if (!soundId || !playlistId) return;
      const sound = game.playlists.get(playlistId)?.sounds.get(soundId);
      const icon = el.querySelector('i');
      if (icon) icon.className = `fas ${sound?.playing ? 'fa-pause' : 'fa-play'}`;
    });
  }

  static _onMusicPlayPause() {
    const np = this._getNowPlaying();
    if (np) {
      const playlist = game.playlists.get(np.playlistId);
      playlist?.stopAll();
    } else {
      // Play the first expanded playlist, or the first playlist
      const expandedId = [...this.expandedPlaylistIds][0];
      const pl = expandedId ? game.playlists.get(expandedId) : game.playlists.contents[0];
      pl?.playAll();
    }
  }

  static _onMusicStop() {
    for (const p of game.playlists) {
      if (p.playing) p.stopAll();
    }
  }

  static async _onMusicNext() {
    const np = this._getNowPlaying();
    if (!np) return;
    const playlist = game.playlists.get(np.playlistId);
    if (!playlist) return;
    await playlist.playNext();
  }

  static async _onMusicPrev() {
    const np = this._getNowPlaying();
    if (!np) return;
    const playlist = game.playlists.get(np.playlistId);
    if (!playlist) return;
    const sounds = playlist.sounds.contents;
    const idx = sounds.findIndex(s => s.id === np.soundId);
    const prev = sounds[(idx - 1 + sounds.length) % sounds.length];
    if (prev) {
      const currentSound = playlist.sounds.get(np.soundId);
      if (currentSound) await currentSound.update({ playing: false });
      await prev.update({ playing: true });
    }
  }

  static async _onMusicPlayTrack(_event, target) {
    const el = target.closest('[data-playlist-id]');
    const playlistId = el?.dataset.playlistId;
    const soundId = el?.dataset.soundId;
    if (!playlistId || !soundId) return;

    // Stop all currently playing
    for (const p of game.playlists) {
      if (p.playing) await p.stopAll();
    }

    const sound = game.playlists.get(playlistId)?.sounds.get(soundId);
    if (sound) await sound.update({ playing: true });
  }

  static async _onMusicShuffle() {
    const np = this._getNowPlaying();
    const playlist = np ? game.playlists.get(np.playlistId) : null;
    if (!playlist) return;
    const newMode = playlist.mode === CONST.PLAYLIST_MODES.SHUFFLE
      ? CONST.PLAYLIST_MODES.SEQUENTIAL
      : CONST.PLAYLIST_MODES.SHUFFLE;
    await playlist.update({ mode: newMode });
  }

  static async _onMusicRepeat() {
    const np = this._getNowPlaying();
    if (!np) return;
    const sound = game.playlists.get(np.playlistId)?.sounds.get(np.soundId);
    if (sound) await sound.update({ repeat: !sound.repeat });
  }

  static _onTogglePlaylistExpand(_event, target) {
    const playlistId = target.closest('[data-playlist-id]')?.dataset.playlistId;
    if (!playlistId) return;
    if (this.expandedPlaylistIds.has(playlistId)) {
      this.expandedPlaylistIds.delete(playlistId);
    } else {
      this.expandedPlaylistIds.add(playlistId);
    }
    const expanded = this.expandedPlaylistIds.has(playlistId);
    // Toggle chevron icon
    const icon = target.querySelector('i');
    if (icon) {
      icon.classList.toggle('fa-chevron-down', expanded);
      icon.classList.toggle('fa-chevron-right', !expanded);
    }
    // Toggle tracks list without full re-render
    const row = target.closest('.left-panel-playlist-item');
    if (!row) return;
    const existing = row.nextElementSibling;
    if (existing?.classList.contains('playlist-tracks-inline')) existing.remove();
    if (expanded) {
      const playlist = game.playlists.get(playlistId);
      if (!playlist) return;
      const tracksDiv = document.createElement('div');
      tracksDiv.className = 'playlist-tracks-inline';
      for (const sound of playlist.sounds) {
        const item = document.createElement('div');
        item.className = `left-panel-track-item${sound.playing ? ' playing' : ''}`;
        item.dataset.action = 'musicPlayTrack';
        item.dataset.playlistId = playlistId;
        item.dataset.soundId = sound.id;
        item.innerHTML = `<i class="fas ${sound.playing ? 'fa-pause' : 'fa-play'}" aria-hidden="true"></i><span>${sound.name}</span>`;
        tracksDiv.appendChild(item);
      }
      row.insertAdjacentElement('afterend', tracksDiv);
    }
  }

  static async _onMusicPlayPlaylist(_event, target) {
    const playlistId = target.closest('[data-playlist-id]')?.dataset.playlistId;
    if (!playlistId) return;
    // Stop all currently playing
    for (const p of game.playlists) {
      if (p.playing) await p.stopAll();
    }
    const playlist = game.playlists.get(playlistId);
    if (playlist) await playlist.playAll();
  }

  static async _onCancelPendingRoll(_event, target) {
    if (!game.user.isGM) return;
    const requestId = target.closest('[data-request-id]')?.dataset.requestId;
    if (requestId) await game.storyframe.socketManager.requestRemovePendingRoll(requestId);
  }

  // --- Speaker Actions (delegated to shared handlers) ---

  static async _onEditSpeaker(event, target) {
    const { onEditSpeaker } = await import('./gm-sidebar/managers/speaker-handlers.mjs');
    return onEditSpeaker(event, target);
  }

  static async _onRemoveSpeaker(event, target) {
    const { onRemoveSpeaker } = await import('./gm-sidebar/managers/speaker-handlers.mjs');
    return onRemoveSpeaker(event, target);
  }

  static async _onToggleSpeakerVisibility(event, target) {
    const { onToggleSpeakerVisibility } = await import('./gm-sidebar/managers/speaker-handlers.mjs');
    return onToggleSpeakerVisibility(event, target);
  }

  static async _onToggleSpeakerHidden(event, target) {
    const { onToggleSpeakerHidden } = await import('./gm-sidebar/managers/speaker-handlers.mjs');
    return onToggleSpeakerHidden(event, target);
  }

  static async _onCycleSpeakerImageNext(event, target) {
    const { onCycleSpeakerImageNext } = await import('./gm-sidebar/managers/speaker-handlers.mjs');
    return onCycleSpeakerImageNext(event, target);
  }

  static async _onCycleSpeakerImagePrev(event, target) {
    const { onCycleSpeakerImagePrev } = await import('./gm-sidebar/managers/speaker-handlers.mjs');
    return onCycleSpeakerImagePrev(event, target);
  }

  static async _onAddSpeakerAltImage(event, target) {
    const { onAddSpeakerAltImage } = await import('./gm-sidebar/managers/speaker-handlers.mjs');
    return onAddSpeakerAltImage(event, target);
  }

  static async _onRemoveSpeakerAltImage(event, target) {
    const { onRemoveSpeakerAltImage } = await import('./gm-sidebar/managers/speaker-handlers.mjs');
    return onRemoveSpeakerAltImage(event, target);
  }

  // --- Journal Actions ---

  static _onJournalOpen(_event, target) {
    const journalId = target.closest('[data-journal-id]')?.dataset.journalId;
    if (!journalId) return;
    this.openJournalId = journalId;
    this.openJournalPageId = null;
    this.journalMinimized = false;
    this.render();
  }

  static _onJournalOpenPage(_event, target) {
    const journalId = target.closest('[data-journal-id]')?.dataset.journalId;
    const pageId = target.dataset.pageId;
    if (!journalId) return;
    this.openJournalId = journalId;
    this.openJournalPageId = pageId || null;
    this.journalMinimized = false;
    this.render();
  }

  static _onCloseImagePreview() {
    this.previewImageSrc = null;
    this.render();
  }

  static _onJournalClose() {
    this.openJournalId = null;
    this.openJournalPageId = null;
    this.journalMinimized = false;
    this.render();
  }

  static _onJournalMinimize() {
    this.journalMinimized = true;
    this.render();
  }

  static _onJournalExpand() {
    this.journalMinimized = false;
    this.render();
  }

  static _onJournalSelectPage(_event, target) {
    this.openJournalPageId = target.dataset.pageId;
    this.render();
  }

  // --- Challenge Actions ---

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
        if (this._playerChatHookId != null) Hooks.off('createChatMessage', this._playerChatHookId);
        this._playerChatHookId = Hooks.on('createChatMessage', (msg) => {
          this._appendChatMessage(container, msg);
        });
      }
    }
  }

  static async _onOpenCharacterSheet(_event, target) {
    const { actorUuid } = target.dataset;
    if (!actorUuid) return;
    const actor = await fromUuid(actorUuid);
    actor?.sheet?.render(true);
  }

  static async _onPresentSavedChallenge(_event, target) {
    if (!game.user.isGM) return;
    const { onPresentSavedChallenge } = await import('./gm-sidebar/managers/challenge-handlers.mjs');
    onPresentSavedChallenge(null, target, null);
  }

  static async _onRemoveChallenge(_event, target) {
    if (!game.user.isGM) return;
    const { onRemoveChallenge } = await import('./gm-sidebar/managers/challenge-handlers.mjs');
    onRemoveChallenge(null, target, null);
  }

  static async _onOpenGMSidebar() {
    if (!game.storyframe.gmSidebar) {
      const system = game.system.id;
      if (system === 'pf2e') {
        const { GMSidebarAppPF2e } = await import('./gm-sidebar/gm-sidebar-pf2e.mjs');
        game.storyframe.gmSidebar = new GMSidebarAppPF2e();
      } else if (system === 'dnd5e') {
        const { GMSidebarAppDND5e } = await import('./gm-sidebar/gm-sidebar-dnd5e.mjs');
        game.storyframe.gmSidebar = new GMSidebarAppDND5e();
      } else if (system === 'daggerheart') {
        const { GMSidebarAppDaggerheart } = await import('./gm-sidebar/gm-sidebar-daggerheart.mjs');
        game.storyframe.gmSidebar = new GMSidebarAppDaggerheart();
      } else {
        const { GMSidebarAppBase } = await import('./gm-sidebar/gm-sidebar-base.mjs');
        game.storyframe.gmSidebar = new GMSidebarAppBase();
      }
    }
    const sidebar = game.storyframe.gmSidebar;
    if (sidebar.rendered) {
      sidebar.bringToTop();
    } else {
      sidebar.parentInterface = null;
      const saved = game.settings.get(MODULE_ID, 'gmSidebarPosition') || {};
      if (saved?.left != null) sidebar.position.left = saved.left;
      if (saved?.top != null) sidebar.position.top = saved.top;
      sidebar.render(true);
    }
  }
}
