import { MODULE_ID } from '../../constants.mjs';
import * as SystemAdapter from '../../system-adapter.mjs';
import { PlayerViewerApp } from '../player-viewer.mjs';
import { CinematicSceneBase } from './cinematic-base-app.mjs';

/**
 * GM-side Cinematic Scene app.
 * Handles left panel (scenes/music/journal), right panel (speakers/chat/DC),
 * floating pending rolls & challenges panels, and all GM actions.
 */
export class CinematicGMApp extends CinematicSceneBase {
  static DEFAULT_OPTIONS = {
    actions: {
      exitScene: CinematicGMApp._onExitScene,
      relaunchForPlayers: CinematicGMApp._onRelaunchForPlayers,
      switchSpeaker: CinematicGMApp._onSwitchSpeaker,
      toggleSidePanel: CinematicGMApp._onToggleSidePanel,
      toggleLeftPanel: CinematicGMApp._onToggleLeftPanel,
      loadSpeakerScene: CinematicGMApp._onLoadSpeakerScene,
      requestQuickSkill: CinematicGMApp._onRequestQuickSkill,
      requestQuickSave: CinematicGMApp._onRequestQuickSave,
      requestJournalCheck: CinematicGMApp._onRequestJournalCheck,
      toggleSecretRoll: CinematicGMApp._onToggleSecretRoll,
      togglePresetDropdown: CinematicGMApp._onTogglePresetDropdown,
      openGMSidebar: CinematicGMApp._onOpenGMSidebar,
      cancelPendingRoll: CinematicGMApp._onCancelPendingRoll,
      journalOpen: CinematicGMApp._onJournalOpen,
      journalClose: CinematicGMApp._onJournalClose,
      toggleJournalSwitcher: CinematicGMApp._onToggleJournalSwitcher,
      toggleAutoScroll: CinematicGMApp._onToggleAutoScroll,
      autoScrollFaster: CinematicGMApp._onAutoScrollFaster,
      autoScrollSlower: CinematicGMApp._onAutoScrollSlower,
      journalMinimize: CinematicGMApp._onJournalMinimize,
      journalRestoreMinimized: CinematicGMApp._onJournalRestoreMinimized,
      journalCloseMinimized: CinematicGMApp._onJournalCloseMinimized,
      journalSelectPage: CinematicGMApp._onJournalSelectPage,
      journalOpenPage: CinematicGMApp._onJournalOpenPage,
      presentSavedChallenge: CinematicGMApp._onPresentSavedChallenge,
      removeChallenge: CinematicGMApp._onRemoveChallenge,
      musicPlayPause: CinematicGMApp._onMusicPlayPause,
      musicStop: CinematicGMApp._onMusicStop,
      musicVolumeReset: CinematicGMApp._onMusicVolumeReset,
      musicNext: CinematicGMApp._onMusicNext,
      musicPrev: CinematicGMApp._onMusicPrev,
      musicPlayTrack: CinematicGMApp._onMusicPlayTrack,
      musicShuffle: CinematicGMApp._onMusicShuffle,
      musicRepeat: CinematicGMApp._onMusicRepeat,
      trackRepeat: CinematicGMApp._onTrackRepeat,
      toggleNowPlayingPlaylist: CinematicGMApp._onToggleNowPlayingPlaylist,
      togglePlaylistExpand: CinematicGMApp._onTogglePlaylistExpand,
      toggleFolderExpand: CinematicGMApp._onToggleFolderExpand,
      musicPlayPlaylist: CinematicGMApp._onMusicPlayPlaylist,
      sendDialogue: CinematicGMApp._onSendDialogue,
      toggleDialogueTTS: CinematicGMApp._onToggleDialogueTTS,
      toggleDialogueBar: CinematicGMApp._onToggleDialogueBar,
      editSpeaker: CinematicGMApp._onEditSpeaker,
      removeSpeaker: CinematicGMApp._onRemoveSpeaker,
      toggleSpeakerVisibility: CinematicGMApp._onToggleSpeakerVisibility,
      toggleSpeakerHidden: CinematicGMApp._onToggleSpeakerHidden,
      cycleSpeakerImageNext: CinematicGMApp._onCycleSpeakerImageNext,
      cycleSpeakerImagePrev: CinematicGMApp._onCycleSpeakerImagePrev,
      addSpeakerAltImage: CinematicGMApp._onAddSpeakerAltImage,
      removeSpeakerAltImage: CinematicGMApp._onRemoveSpeakerAltImage,
      setBackground: CinematicGMApp._onSetBackground,
      clearBackground: CinematicGMApp._onClearBackground,
      saveSceneState: CinematicGMApp._onSaveSceneState,
      saveCurrentScene: CinematicGMApp._onSaveCurrentScene,
      deleteSpeakerScene: CinematicGMApp._onDeleteSpeakerScene,
      openScene: CinematicGMApp._onOpenScene,
      incrementCounter: CinematicGMApp._onIncrementCounter,
      decrementCounter: CinematicGMApp._onDecrementCounter,
      showToPlayer: CinematicGMApp._onShowToPlayer,
      togglePlayerSpeakers: CinematicGMApp._onTogglePlayerSpeakers,
      approveSpeakerRequest: CinematicGMApp._onApproveSpeakerRequest,
      dismissSpeakerRequest: CinematicGMApp._onDismissSpeakerRequest,
      clearSecondarySpeaker: CinematicGMApp._onClearSecondarySpeaker,
    },
  };

  static PARTS = {
    content: {
      template: 'modules/storyframe/templates/cinematic/gm.hbs',
      scrollable: ['.side-panel-speakers', '.left-panel-scenes', '.left-panel-playlists', '.journal-content-scroll', '.journal-entry-list'],
    },
  };

  constructor(options = {}) {
    super(options);
    this.sidePanelOpen = false;
    this.currentDC = null;
    this.secretRollEnabled = false;
    this.batchedChecks = [];
    // Only auto-open left panel if launched from sidebar (journal context exists)
    this.leftPanelOpen = !!game.storyframe.gmSidebar?.parentInterface?.document;
    this.expandedPlaylistIds = new Set();
    this.expandedFolderIds = new Set();
    this._savedGlobalVolume = null; // original globalPlaylistVolume before cinematic adjustment
    this.musicSearchQuery = '';
    this.openJournalId = null;
    this.openJournalPageId = null;
    const savedMinimized = game.storyframe.stateManager?.getState()?.minimizedJournals;
    this.minimizedJournals = Array.isArray(savedMinimized) ? [...savedMinimized] : [];
    this.journalSearchQuery = '';
    this.journalFontSize = game.settings.get(MODULE_ID, 'cinematicJournalFontSize') ?? 0.75;
    this._speakerCounters = {};
    this._escHandler = null;
    this._playlistHookIds = [];
    this._chatHookId = null;
    this._chatDeleteHookId = null;
    this._scenesHookId = null;
    const savedHeights = game.settings.get(MODULE_ID, 'cinematicSectionHeights') || {};
    this._sectionHeights = {
      scenes: savedHeights.scenes ?? null,
      journal: savedHeights.journal ?? null,
      music: savedHeights.music ?? null,
      controls: savedHeights.controls ?? null,
      chat: savedHeights.chat ?? null,
    };
    const savedWidths = game.settings.get(MODULE_ID, 'cinematicPanelWidths') || {};
    this._panelWidths = { left: savedWidths.left ?? null, right: savedWidths.right ?? null };
    this._floatingPanelPositions = game.settings.get(MODULE_ID, 'cinematicFloatingPanelPositions') || {};
    this._debouncedMusicUpdate = foundry.utils.debounce(() => this._updateMusicDisplay(), 150);

    // Auto-open currently viewed journal
    const sidebar = game.storyframe.gmSidebar;
    if (sidebar?.parentInterface?.document) {
      this.openJournalId = sidebar.parentInterface.document.id;
      const pi = sidebar.parentInterface;
      const piEl = pi.element?.jquery ? pi.element[0] : pi.element;
      const activePage = piEl?.querySelector?.('.journal-entry-page.active');
      const pageId = activePage?.dataset?.pageId
        || pi.document.pages.contents.find(p => p.type === 'text')?.id;
      if (pageId) this.openJournalPageId = pageId;
    }
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

  async _prepareContext(_options) {
    const base = await super._prepareContext(_options);
    const state = game.storyframe.stateManager?.getState();

    const sm = game.storyframe.socketManager;
    const playersSeeCinematic = sm?.allPlayersSeeScene ?? false;
    const isPrepMode = game.settings.get(MODULE_ID, 'cinematicPrepMode') ?? false;
    const hasBroadcasted = sm?._gmBroadcastState?.hasBroadcasted ?? false;
    const showPrepBanner = isPrepMode && !hasBroadcasted;

    if (!state) {
      return {
        ...base,
        sidePanelOpen: this.sidePanelOpen,
        leftPanelOpen: this.leftPanelOpen,
        playersSeeCinematic,
        showPrepBanner,
        quickSkills: [],
        hasParticipants: false,
        currentDC: this.currentDC,
        secretRollEnabled: this.secretRollEnabled,
        speakerScenes: [],
        playlists: [],
        nowPlaying: null,
        currentVolume: 0.5,
        playingByPlaylist: [],
        shuffleActive: false,
        repeatActive: false,
        musicSearchQuery: this.musicSearchQuery,
        musicSearchPlaylists: [],
        musicSearchResults: [],
        gmPendingRolls: [],
        savedChallenges: [],
        gmActiveChallenges: [],
        journalEntries: [],
        openJournal: null,
        minimizedJournals: [],
        journalSearchQuery: '',
        journalFontSize: this.journalFontSize,
      };
    }

    // Quick skills + saves
    let quickSkills = [];
    let quickSaves = [];
    const hasParticipants = base.pcRow.length > 0;
    if (hasParticipants) {
      const skills = SystemAdapter.getSkills();
      quickSkills = Object.entries(skills).map(([slug, skill]) => ({
        slug,
        name: skill.name,
        icon: this._getSkillIcon(slug),
      }));
      const saves = SystemAdapter.getSaves();
      quickSaves = Object.entries(saves).map(([slug, save]) => ({
        slug,
        name: save.name,
        icon: this._getSkillIcon(slug),
      }));
    }

    // Speaker scenes + music
    const speakerScenes = (game.settings.get(MODULE_ID, 'speakerScenes') || []).map(s => ({
      ...s,
      hasState: !!(s.playlistId || s.sceneBackground),
    }));
    // Build playlist data with auto-expand for playing playlists
    const playlistData = game.playlists.contents.map(p => {
      const autoExpand = p.sounds.some(s => s.playing) && !this.expandedPlaylistIds.has(p.id);
      if (autoExpand) this.expandedPlaylistIds.add(p.id);
      const expanded = this.expandedPlaylistIds.has(p.id);
      return {
        id: p.id, name: p.name, playing: p.playing, mode: p.mode,
        folderId: p.folder?.id || null,
        expanded,
        trackCount: p.sounds.size,
        tracks: expanded
          ? p.sounds.contents.map(s => ({ id: s.id, name: s.name, playing: s.playing, volume: s.volume }))
          : [],
      };
    });

    // Build folder tree for playlists
    const playlistFolders = game.folders.filter(f => f.type === 'Playlist')
      .sort((a, b) => a.sort - b.sort);
    const folderTree = [];
    const folderMap = new Map();

    // Create folder nodes
    for (const f of playlistFolders) {
      const node = {
        id: f.id, name: f.name, type: 'folder',
        parentId: f.folder?.id || null,
        expanded: this.expandedFolderIds.has(f.id),
        children: [], playlists: [],
      };
      folderMap.set(f.id, node);
    }

    // Nest folders into parents
    for (const node of folderMap.values()) {
      if (node.parentId && folderMap.has(node.parentId)) {
        folderMap.get(node.parentId).children.push(node);
      } else {
        folderTree.push(node);
      }
    }

    // Assign playlists to their folders
    const rootPlaylists = [];
    for (const p of playlistData) {
      if (p.folderId && folderMap.has(p.folderId)) {
        folderMap.get(p.folderId).playlists.push(p);
      } else {
        rootPlaylists.push(p);
      }
    }

    // Keep flat list for backwards compat (search, etc.)
    const playlists = playlistData;
    const nowPlaying = this._getNowPlaying();
    let currentVolume = game.settings.get('core', 'globalPlaylistVolume') ?? 0.5;
    let shuffleActive = false;
    let repeatActive = false;
    if (nowPlaying) {
      const pl = game.playlists.get(nowPlaying.playlistId);
      const sound = pl?.sounds.get(nowPlaying.soundId);
      if (pl) shuffleActive = pl.mode === CONST.PLAYLIST_MODES.SHUFFLE;
      if (sound) repeatActive = sound.repeat;
    }
    // Collect currently-playing tracks grouped by playlist
    const playingByPlaylist = [];
    for (const p of game.playlists) {
      const tracks = p.sounds.contents.filter(s => s.playing).map(s => ({ id: s.id, name: s.name, volume: s.volume, repeat: s.repeat }));
      if (tracks.length) playingByPlaylist.push({ id: p.id, name: p.name, tracks });
    }
    let musicSearchPlaylists = [];
    let musicSearchResults = [];
    if (this.musicSearchQuery) {
      const q = this.musicSearchQuery.toLowerCase();
      for (const p of game.playlists) {
        // Match playlist names
        if (p.name.toLowerCase().includes(q)) {
          musicSearchPlaylists.push({ id: p.id, name: p.name, trackCount: p.sounds.size, playing: p.playing });
        }
        // Match track names
        for (const s of p.sounds) {
          if (s.name.toLowerCase().includes(q)) {
            musicSearchResults.push({ id: s.id, name: s.name, playlistId: p.id, playlistName: p.name, playing: s.playing });
          }
        }
      }
    }

    // GM pending rolls
    let gmPendingRolls = [];
    if (state.pendingRolls?.length > 0) {
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

    // Challenge controls
    const savedChallenges = (game.settings.get(MODULE_ID, 'challengeLibrary') || []).map(c => ({ id: c.id, name: c.name }));
    const gmActiveChallenges = (state.activeChallenges || []).map(c => ({ id: c.id, name: c.name }));

    // Journal
    let journalEntries = [];
    let openJournal = null;
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
          enrichedContent = await foundry.applications.ux.TextEditor.implementation.enrichHTML(activePage.text.content, { async: true });
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

    // Journal checks/saves/lore from the currently open journal + PC lore skills
    let journalSkillGroups = [];
    let journalLoreGroups = [];
    let journalSaveGroups = [];
    let loreSkills = [];
    if (hasParticipants) {
      try {
        const sys = SystemAdapter.detectSystem();
        let SidebarClass;
        if (sys === 'pf2e' || sys === 'sf2e') {
          ({ GMSidebarAppPF2e: SidebarClass } = await import('../gm-sidebar/gm-sidebar-pf2e.mjs'));
        } else if (sys === 'dnd5e') {
          ({ GMSidebarAppDND5e: SidebarClass } = await import('../gm-sidebar/gm-sidebar-dnd5e.mjs'));
        } else if (sys === 'daggerheart') {
          ({ GMSidebarAppDaggerheart: SidebarClass } = await import('../gm-sidebar/gm-sidebar-daggerheart.mjs'));
        } else {
          ({ GMSidebarAppBase: SidebarClass } = await import('../gm-sidebar/gm-sidebar-base.mjs'));
        }

        // PC lore skills
        loreSkills = await SidebarClass._getLoreSkills(null, null);

        // Journal checks
        if (openJournal?.enrichedContent) {
          const tempEl = document.createElement('div');
          tempEl.innerHTML = openJournal.enrichedContent;
          const rawChecks = SidebarClass.prototype._parseChecksFromContent.call({}, tempEl);
          const { groupChecksBySkill } = await import('../gm-sidebar/managers/journal-handlers.mjs');
          const grouped = groupChecksBySkill(rawChecks);
          for (const group of grouped) {
            const isLore = group.skillSlug?.includes('-lore');
            const skillChecks = group.checks.filter(c => c.checkType === 'skill' || !c.checkType);
            const saveChecks = group.checks.filter(c => c.checkType === 'save');
            if (skillChecks.length) {
              const entry = { ...group, icon: this._getSkillIcon(group.skillSlug), checks: skillChecks };
              if (isLore) {
                entry.displayName = group.skillName.replace(/[- ]?lore$/i, '');
                journalLoreGroups.push(entry);
              } else {
                journalSkillGroups.push(entry);
              }
            }
            if (saveChecks.length) journalSaveGroups.push({ ...group, icon: this._getSkillIcon(group.skillSlug), checks: saveChecks });
          }
        }
      } catch (err) {
        console.warn('StoryFrame | Failed to parse journal checks for cinematic panel', err);
      }
    }

    return {
      ...base,
      sidePanelOpen: this.sidePanelOpen,
      leftPanelOpen: this.leftPanelOpen,
      playersSeeCinematic,
      showPrepBanner,
      quickSkills,
      quickSaves,
      journalSkillGroups,
      journalLoreGroups,
      journalSaveGroups,
      loreSkills,
      hasJournalChecks: journalSkillGroups.length > 0,
      hasJournalLore: journalLoreGroups.length > 0,
      hasJournalSaves: journalSaveGroups.length > 0,
      hasLoreSkills: loreSkills.length > 0,
      hasParticipants,
      activeSpeakerCounter: base.activeSpeakerId != null ? (this._speakerCounters[base.activeSpeakerId] ?? 0) : null,
      currentDC: this.currentDC,
      secretRollEnabled: this.secretRollEnabled,
      speakerScenes,
      playlists,
      folderTree,
      rootPlaylists,
      nowPlaying,
      currentVolume,
      playingByPlaylist,
      shuffleActive,
      repeatActive,
      musicSearchQuery: this.musicSearchQuery,
      musicSearchPlaylists,
      musicSearchResults,
      gmPendingRolls,
      savedChallenges,
      gmActiveChallenges,
      journalEntries,
      openJournal,
      minimizedJournals: this.minimizedJournals.map(m => {
        const entry = game.journal.get(m.id);
        const pageName = m.pageId ? entry?.pages.get(m.pageId)?.name : null;
        return { id: m.id, name: entry?.name || '???', pageId: m.pageId, pageName };
      }),
      journalSearchQuery: this.journalSearchQuery,
      journalFontSize: this.journalFontSize,
    };
  }

  // --- GM-specific _onStateChange hook ---

  _onFlagsChanged(state, flagsChanged) {
    if (flagsChanged) this._updateSpeakerFlagsInDOM(state);
  }

  /** Targeted DOM update for GM floating panels */
  async _refreshRollPanel() {
    const ctx = await this._prepareContext({});

    // Pending rolls panel
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

    // Active challenges panel
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
  }

  /** Targeted DOM update for speaker hidden/nameHidden flags */
  _updateSpeakerFlagsInDOM(state) {
    for (const speaker of state.speakers || []) {
      // Update filmstrip card
      const card = this.element?.querySelector(`.filmstrip-speaker[data-speaker-id="${speaker.id}"]`);
      if (card) {
        card.classList.toggle('speaker-is-hidden', !!speaker.isHidden);
        card.classList.toggle('name-is-hidden', !!speaker.isNameHidden);
        const hideBtn = card.querySelector('[data-action="toggleSpeakerHidden"]');
        if (hideBtn) {
          const icon = hideBtn.querySelector('i');
          if (icon) icon.className = `fas ${speaker.isHidden ? 'fa-eye' : 'fa-eye-slash'}`;
          hideBtn.dataset.tooltip = speaker.isHidden
            ? game.i18n.localize('STORYFRAME.CinematicScene.ShowSpeaker')
            : game.i18n.localize('STORYFRAME.CinematicScene.HideSpeaker');
        }
        const nameBtn = card.querySelector('[data-action="toggleSpeakerVisibility"]');
        if (nameBtn) {
          nameBtn.dataset.tooltip = speaker.isNameHidden
            ? game.i18n.localize('STORYFRAME.CinematicScene.ShowName')
            : game.i18n.localize('STORYFRAME.CinematicScene.HideName');
        }
      }

      // Update spotlight nameplate if this is the active speaker
      const spotlight = this.element?.querySelector(`.cinematic-spotlight[data-speaker-id="${speaker.id}"]`);
      if (spotlight) {
        const nameplate = spotlight.querySelector('.spotlight-nameplate');
        if (nameplate) nameplate.classList.toggle('name-is-hidden', !!speaker.isNameHidden);
        const visBtn = spotlight.querySelector('.spotlight-visibility-btn');
        if (visBtn) {
          visBtn.dataset.tooltip = speaker.isNameHidden
            ? game.i18n.localize('STORYFRAME.CinematicScene.ShowName')
            : game.i18n.localize('STORYFRAME.CinematicScene.HideName');
          const icon = visBtn.querySelector('i');
          if (icon) icon.className = `fas ${speaker.isNameHidden ? 'fa-eye' : 'fa-eye-slash'}`;
        }
      }
    }
  }

  _onRender(_context, _options) {
    super._onRender(_context, _options);

    // Relocate prep banner from inside app to document.body (ancestor transforms break position:fixed)
    const prepBanner = this.element?.querySelector('.cinematic-prep-banner');
    if (prepBanner) {
      // Remove ALL existing prep banners (querySelectorAll avoids matching the new one
      // inside this.element and leaving the old body-level one behind)
      for (const old of document.body.querySelectorAll('.cinematic-prep-banner')) {
        if (old !== prepBanner) old.remove();
      }
      document.body.appendChild(prepBanner);
    }

    // Broadcast player popup on Show to Players button
    this._setupBroadcastPopup();

    // ESC to exit
    if (!this._escHandler) {
      this._escHandler = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          CinematicGMApp._onExitScene.call(this);
        }
      };
      document.addEventListener('keydown', this._escHandler, { capture: true });
    }

    // DC input
    const dcInput = this.element?.querySelector('.cinematic-dc-input');
    if (dcInput) {
      dcInput.addEventListener('change', (e) => {
        const val = parseInt(e.target.value);
        this.currentDC = isNaN(val) ? null : val;
      });
    }

    // Dialogue input: Enter to send + populate language dropdown
    const dialogueInput = this.element?.querySelector('.dialogue-input');
    if (dialogueInput) {
      dialogueInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          CinematicGMApp._onSendDialogue.call(this, e);
        }
      });
    }
    this._populateLanguageDropdown();

    // Playlist reactivity hooks (register once)
    if (this._playlistHookIds.length === 0) {
      this._playlistHookIds.push(
        { hook: 'updatePlaylist', id: Hooks.on('updatePlaylist', () => this._debouncedMusicUpdate()) },
        { hook: 'updatePlaylistSound', id: Hooks.on('updatePlaylistSound', () => this._debouncedMusicUpdate()) },
      );
    }

    // Re-render when speaker scenes setting changes (e.g. after scene editor save)
    if (this._scenesHookId == null) {
      this._scenesHookId = Hooks.on('updateSetting', (setting) => {
        if (setting.key === `${MODULE_ID}.speakerScenes`) this.render();
      });
    }

    // Skill button context menus (PF2e actions/variants)
    const skillBtns = this.element?.querySelectorAll('.side-panel-skill-btn[data-skill]');
    if (skillBtns?.length) {
      const cinematic = this;
      skillBtns.forEach(btn => {
        btn.addEventListener('contextmenu', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const skillSlug = btn.dataset.skill;
          if (!skillSlug) return;
          const { showSkillActionsMenu } = await import('../gm-sidebar/managers/ui-helpers.mjs');
          showSkillActionsMenu(e, skillSlug, cinematic);
        });
      });
    }

    // Global volume slider — controls Foundry's master globalPlaylistVolume
    const volumeSlider = this.element?.querySelector('.cinematic-music-volume');
    if (volumeSlider) {
      let globalVolTimer = null;
      volumeSlider.addEventListener('input', (e) => {
        const vol = parseFloat(e.target.value);
        // Save original global volume on first touch
        if (this._savedGlobalVolume === null) {
          this._savedGlobalVolume = game.settings.get('core', 'globalPlaylistVolume') ?? 0.5;
        }
        // Show reset button
        this.element?.querySelector('.music-volume-reset')?.classList.remove('hidden');
        clearTimeout(globalVolTimer);
        globalVolTimer = setTimeout(() => {
          game.settings.set('core', 'globalPlaylistVolume', vol);
        }, 150);
      });
    }

    // Show reset button if global volume was changed
    if (this._savedGlobalVolume !== null) {
      this.element?.querySelector('.music-volume-reset')?.classList.remove('hidden');
    }

    // Per-track volume sliders (in now-playing section)
    this.element?.querySelectorAll('.track-volume-slider').forEach(s => this._bindTrackVolumeSlider(s));

    // Build playlist folder tree (template renders empty container)
    const playlistListEl = this.element?.querySelector('.left-panel-playlists');
    if (playlistListEl && !this.musicSearchQuery) {
      this._buildPlaylistTreeDOM(playlistListEl);
    }

    // Music search
    const searchInput = this.element?.querySelector('.music-search-input');
    if (searchInput) {
      if (this.musicSearchQuery) {
        searchInput.focus();
        searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
        // Populate search results (template renders empty container)
        this._updateMusicSearchDOM();
      }
      searchInput.addEventListener('input', (e) => {
        this.musicSearchQuery = e.target.value;
        this._updateMusicSearchDOM();
      });
    }

    // Journal search, font size slider, active tab scroll
    this._bindJournalListeners();

    // Restore section heights + bind resize handles
    const growSections = new Set(['music', 'chat']);
    for (const [key, height] of Object.entries(this._sectionHeights)) {
      if (height != null) {
        const section = this.element?.querySelector(`.left-panel-section[data-section="${key}"], .side-panel-resizable[data-section="${key}"]`);
        if (!section) continue;
        // Last section in each panel should grow to fill remaining space
        section.style.flex = growSections.has(key) ? `1 0 ${height}px` : `0 0 ${height}px`;
      }
    }
    this.element?.querySelectorAll('.section-resize-handle').forEach(handle => {
      handle.addEventListener('mousedown', (e) => this._onResizeStart(e, handle));
    });

    // Side panel chat log — only populate once per DOM element
    const chatContainer = this.element?.querySelector('.side-panel-chat-messages');
    if (chatContainer && !chatContainer.dataset.populated) {
      chatContainer.dataset.populated = '1';
      this._populateChatLog(chatContainer);
      // Register hooks once; look up the *current* container each time so
      // re-renders don't leave hooks pointing at a stale DOM element.
      if (this._chatHookId == null) {
        this._chatHookId = Hooks.on('createChatMessage', (msg) => {
          const el = this.element?.querySelector('.side-panel-chat-messages');
          if (el) this._appendChatMessage(el, msg);
        });
      }
      if (this._chatDeleteHookId == null) {
        this._chatDeleteHookId = Hooks.on('deleteChatMessage', (msg) => {
          const el = this.element?.querySelector('.side-panel-chat-messages');
          el?.querySelector(`.message[data-message-id="${msg.id}"], .chat-message[data-message-id="${msg.id}"]`)?.remove();
        });
      }
    }

    // Apply saved panel widths
    if (this._panelWidths.left) {
      this.element.style.setProperty('--left-panel-width', `${this._panelWidths.left}px`);
    }
    if (this._panelWidths.right) {
      this.element.style.setProperty('--right-panel-width', `${this._panelWidths.right}px`);
    }

    // Panel width resize handles
    this.element?.querySelectorAll('.panel-width-handle').forEach(handle => {
      handle.addEventListener('mousedown', (e) => this._onWidthResizeStart(e, handle));
    });

    // Floating panels draggable
    for (const key of ['cinematic-floating-pending', 'cinematic-floating-challenges']) {
      const panel = this.element?.querySelector(`.${key}`);
      if (panel) this._makePanelDraggable(panel, key);
    }

    // Camera row (A/V feed mirroring)
    this._initCameraRow();
  }

  async fadeOutAndClose() {
    if (this._fadingOut) return;

    // Remove prep banner immediately — it lives at document.body level and is not
    // inside this.element, so the CSS fade-out applied to the app element won't
    // affect it. Removing it here ensures it disappears as soon as the Frame closes.
    document.body.querySelector('.cinematic-prep-banner')?.remove();

    // Fade all playing sounds to zero using Foundry's Sound.fade() API
    const duration = CinematicSceneBase.FADE_OUT_DURATION;
    for (const p of game.playlists) {
      for (const s of p.sounds.contents) {
        if (s.playing && s.sound) {
          s.sound.fade(0, { duration, type: 'linear' });
        }
      }
    }

    // Delegate to base for CSS fade + close
    await super.fadeOutAndClose();
  }

  async _onClose(_options) {
    // Stop auto-scroll + TTS
    this._stopAutoScroll();
    game.storyframe.tts?.stop();

    // Stop all playing playlists (volume is already at 0 from fade)
    for (const p of game.playlists) {
      if (p.playing) p.stopAll();
    }

    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler, { capture: true });
      this._escHandler = null;
    }
    for (const { hook, id } of this._playlistHookIds) Hooks.off(hook, id);
    this._playlistHookIds = [];
    if (this._chatHookId != null) {
      Hooks.off('createChatMessage', this._chatHookId);
      this._chatHookId = null;
    }
    if (this._chatDeleteHookId != null) {
      Hooks.off('deleteChatMessage', this._chatDeleteHookId);
      this._chatDeleteHookId = null;
    }
    if (this._scenesHookId != null) {
      Hooks.off('updateSetting', this._scenesHookId);
      this._scenesHookId = null;
    }
    this.sidePanelOpen = false;
    this.currentDC = null;
    this.secretRollEnabled = false;
    this.batchedChecks = [];
    this.leftPanelOpen = false;
    this.expandedPlaylistIds.clear();
    // Restore master volume if we changed it during cinematic
    if (this._savedGlobalVolume !== null) {
      game.settings.set('core', 'globalPlaylistVolume', this._savedGlobalVolume);
      this._savedGlobalVolume = null;
    }
    this.musicSearchQuery = '';
    this.openJournalId = null;
    this.openJournalPageId = null;
    this.minimizedJournals = [];
    // Remove body-level prep banner
    document.body.querySelector('.cinematic-prep-banner')?.remove();
    this._persistMinimizedJournals();
    this.journalSearchQuery = '';
    this.challengePanelExpanded = false;
    this._lastChallengeCount = 0;
    return super._onClose(_options);
  }

  // --- Targeted music search DOM update ---

  _updateMusicSearchDOM = foundry.utils.debounce(() => {
    const musicSection = this.element?.querySelector('.left-panel-music');
    if (!musicSection) return;

    const q = this.musicSearchQuery?.toLowerCase() || '';

    // Remove existing results / playlist list
    musicSection.querySelector('.music-search-results')?.remove();
    musicSection.querySelector('.left-panel-playlists')?.remove();

    if (q) {
      // Build search results
      const frag = document.createDocumentFragment();
      const wrapper = document.createElement('div');
      wrapper.className = 'music-search-results';

      for (const p of game.playlists) {
        const nameMatch = p.name.toLowerCase().includes(q);
        const trackMatches = [...p.sounds].filter(s => s.name.toLowerCase().includes(q));
        if (!nameMatch && trackMatches.length === 0) continue;

        // Always show the playlist row when it or any of its tracks match
        const isExpanded = this.expandedPlaylistIds.has(p.id);
        const el = document.createElement('div');
        el.className = `left-panel-playlist-item${p.playing ? ' playing' : ''}`;
        el.innerHTML = `<button type="button" class="playlist-expand-btn" data-action="togglePlaylistExpand" data-playlist-id="${p.id}">`
          + `<i class="fas fa-chevron-right" aria-hidden="true" style="${isExpanded ? 'transform:rotate(90deg)' : ''}"></i></button>`
          + `<span class="playlist-name" data-action="musicPlayPlaylist" data-playlist-id="${p.id}">${foundry.utils.escapeHTML(p.name)}</span>`
          + `<span class="playlist-track-count">${p.sounds.size}</span>`;
        wrapper.appendChild(el);

        // Show inline tracks if expanded, or show matching tracks directly
        if (isExpanded || trackMatches.length > 0) {
          const tracksContainer = document.createElement('div');
          tracksContainer.className = 'playlist-tracks-inline';
          if (!isExpanded && trackMatches.length > 0) {
            // Not expanded but has track matches — show only matching tracks
            for (const s of trackMatches) {
              const tEl = document.createElement('div');
              tEl.className = `left-panel-track-item${s.playing ? ' playing' : ''}`;
              tEl.dataset.action = 'musicPlayTrack';
              tEl.dataset.playlistId = p.id;
              tEl.dataset.soundId = s.id;
              tEl.innerHTML = `<i class="fas ${s.playing ? 'fa-pause' : 'fa-play'}" aria-hidden="true"></i>`
                + `<span>${foundry.utils.escapeHTML(s.name)}</span>`;
              tracksContainer.appendChild(tEl);
            }
          } else {
            // Expanded — show all tracks
            for (const s of p.sounds) {
              const tEl = document.createElement('div');
              tEl.className = `left-panel-track-item${s.playing ? ' playing' : ''}`;
              tEl.dataset.action = 'musicPlayTrack';
              tEl.dataset.playlistId = p.id;
              tEl.dataset.soundId = s.id;
              tEl.innerHTML = `<i class="fas ${s.playing ? 'fa-pause' : 'fa-play'}" aria-hidden="true"></i>`
                + `<span>${foundry.utils.escapeHTML(s.name)}</span>`;
              tracksContainer.appendChild(tEl);
            }
          }
          wrapper.appendChild(tracksContainer);
        }
      }
      frag.appendChild(wrapper);
      musicSection.appendChild(frag);
    } else {
      // Rebuild playlist list with folder tree
      const listEl = document.createElement('div');
      listEl.className = 'left-panel-playlists';
      this._buildPlaylistTreeDOM(listEl);
      musicSection.appendChild(listEl);
    }
  }, 150);

  /**
   * Build the playlist folder tree into a container element.
   * Renders folders as collapsible groups, playlists as expandable items with tracks.
   */
  _buildPlaylistTreeDOM(container) {
    // Build folder structure
    const playlistFolders = game.folders.filter(f => f.type === 'Playlist');
    const folderMap = new Map();
    for (const f of playlistFolders) {
      folderMap.set(f.id, { folder: f, children: [], playlists: [] });
    }
    // Nest children
    const rootFolders = [];
    for (const node of folderMap.values()) {
      const parentId = node.folder.folder?.id;
      if (parentId && folderMap.has(parentId)) {
        folderMap.get(parentId).children.push(node);
      } else {
        rootFolders.push(node);
      }
    }
    // Sort folders by sort order
    rootFolders.sort((a, b) => a.folder.sort - b.folder.sort);
    for (const node of folderMap.values()) {
      node.children.sort((a, b) => a.folder.sort - b.folder.sort);
    }

    // Assign playlists to folders
    const rootPlaylists = [];
    for (const p of game.playlists.contents) {
      const fId = p.folder?.id;
      if (fId && folderMap.has(fId)) {
        folderMap.get(fId).playlists.push(p);
      } else {
        rootPlaylists.push(p);
      }
    }

    // Recursive render
    const renderFolder = (node, parent, indent) => {
      const expanded = this.expandedFolderIds.has(node.folder.id);
      const folderEl = document.createElement('div');
      folderEl.className = 'left-panel-folder-item';
      if (indent > 0) folderEl.style.paddingLeft = `${indent * 12}px`;
      folderEl.innerHTML = `<button type="button" class="playlist-expand-btn" data-action="toggleFolderExpand" data-folder-id="${node.folder.id}">`
        + `<i class="fas ${expanded ? 'fa-chevron-down' : 'fa-chevron-right'}" aria-hidden="true"></i></button>`
        + `<i class="fas fa-folder${expanded ? '-open' : ''} folder-icon" aria-hidden="true"></i>`
        + `<span class="folder-name" data-action="toggleFolderExpand" data-folder-id="${node.folder.id}">${foundry.utils.escapeHTML(node.folder.name)}</span>`;
      parent.appendChild(folderEl);

      if (expanded) {
        const contents = document.createElement('div');
        contents.className = 'folder-contents';
        // Sub-folders first
        for (const child of node.children) {
          renderFolder(child, contents, indent + 1);
        }
        // Then playlists
        for (const p of node.playlists) {
          renderPlaylist(p, contents, indent + 1);
        }
        parent.appendChild(contents);
      }
    };

    const renderPlaylist = (p, parent, indent) => {
      const expanded = this.expandedPlaylistIds.has(p.id);
      const item = document.createElement('div');
      item.className = `left-panel-playlist-item${p.playing ? ' playing' : ''}`;
      if (indent > 0) item.style.paddingLeft = `${indent * 12}px`;
      item.innerHTML = `<button type="button" class="playlist-expand-btn" data-action="togglePlaylistExpand" data-playlist-id="${p.id}">`
        + `<i class="fas ${expanded ? 'fa-chevron-down' : 'fa-chevron-right'}" aria-hidden="true"></i></button>`
        + `<span class="playlist-name" data-action="musicPlayPlaylist" data-playlist-id="${p.id}">${foundry.utils.escapeHTML(p.name)}</span>`
        + `<span class="playlist-track-count">${p.sounds.size}</span>`;
      parent.appendChild(item);
      if (expanded) {
        const tracksEl = document.createElement('div');
        tracksEl.className = 'playlist-tracks-inline';
        if (indent > 0) tracksEl.style.paddingLeft = `${indent * 12}px`;
        for (const s of p.sounds.contents) {
          const t = document.createElement('div');
          t.className = `left-panel-track-item${s.playing ? ' playing' : ''}`;
          t.dataset.action = 'musicPlayTrack';
          t.dataset.playlistId = p.id;
          t.dataset.soundId = s.id;
          t.innerHTML = `<i class="fas ${s.playing ? 'fa-pause' : 'fa-play'}" aria-hidden="true"></i>`
            + `<span>${foundry.utils.escapeHTML(s.name)}</span>`;
          tracksEl.appendChild(t);
        }
        parent.appendChild(tracksEl);
      }
    };

    // Render root folders
    for (const node of rootFolders) {
      renderFolder(node, container, 0);
    }
    // Render root-level playlists (no folder)
    for (const p of rootPlaylists) {
      renderPlaylist(p, container, 0);
    }
  }

  // --- Targeted journal search DOM update ---

  _updateJournalSearchDOM = foundry.utils.debounce(() => {
    const listEl = this.element?.querySelector('.journal-entry-list');
    if (!listEl) return;

    const q = this.journalSearchQuery?.toLowerCase() || '';
    const allJournals = game.journal.contents
      .filter(j => j.testUserPermission(game.user, 'OBSERVER'))
      .sort((a, b) => a.name.localeCompare(b.name));

    let entries;
    if (q) {
      entries = [];
      for (const j of allJournals) {
        const nameMatch = j.name.toLowerCase().includes(q);
        const matchingPages = j.pages.contents
          .filter(p => p.type === 'text' && p.name.toLowerCase().includes(q))
          .map(p => ({ id: p.id, name: p.name }));
        if (nameMatch || matchingPages.length > 0) {
          entries.push({ id: j.id, name: j.name, pageCount: j.pages.size, matchingPages: nameMatch ? [] : matchingPages });
        }
      }
    } else {
      entries = allJournals.map(j => ({ id: j.id, name: j.name, pageCount: j.pages.size, matchingPages: [] }));
    }

    if (entries.length === 0) {
      listEl.innerHTML = `<div class="left-panel-empty">${game.i18n.localize('STORYFRAME.CinematicScene.NoJournalsFound')}</div>`;
      return;
    }

    const frag = document.createDocumentFragment();
    for (const entry of entries) {
      const item = document.createElement('div');
      item.className = 'journal-entry-item';
      item.dataset.action = 'journalOpen';
      item.dataset.journalId = entry.id;
      item.innerHTML = `<i class="fas fa-book" aria-hidden="true"></i>`
        + `<span>${foundry.utils.escapeHTML(entry.name)}</span>`
        + (entry.pageCount ? `<span class="journal-page-count">${entry.pageCount}</span>` : '');
      frag.appendChild(item);
      for (const page of entry.matchingPages) {
        const pageItem = document.createElement('div');
        pageItem.className = 'journal-entry-item journal-page-match';
        pageItem.dataset.action = 'journalOpenPage';
        pageItem.dataset.journalId = entry.id;
        pageItem.dataset.pageId = page.id;
        pageItem.innerHTML = `<i class="fas fa-file-alt" aria-hidden="true"></i><span>${foundry.utils.escapeHTML(page.name)}</span>`;
        frag.appendChild(pageItem);
      }
    }
    listEl.innerHTML = '';
    listEl.appendChild(frag);
  }, 150);

  // --- Targeted journal section DOM update (avoids full re-render / filmstrip rebuild) ---

  async _updateJournalSection() {
    const sectionEl = this.element?.querySelector('.left-panel-journal');
    if (!sectionEl) return;

    // Build journal data
    const allJournals = game.journal.contents
      .filter(j => j.testUserPermission(game.user, 'OBSERVER'))
      .sort((a, b) => a.name.localeCompare(b.name));
    const q = this.journalSearchQuery?.toLowerCase() || '';
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

    let openJournal = null;
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
          enrichedContent = await foundry.applications.ux.TextEditor.implementation.enrichHTML(activePage.text.content, { async: true });
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

    const minimizedJournals = this.minimizedJournals.map(m => {
      const entry = game.journal.get(m.id);
      const pageName = m.pageId ? entry?.pages.get(m.pageId)?.name : null;
      return { id: m.id, name: entry?.name || '???', pageId: m.pageId, pageName };
    });

    // Build HTML
    const esc = foundry.utils.escapeHTML;
    let html = '';

    // Minimized pills
    for (const m of minimizedJournals) {
      const label = m.pageName ? `${esc(m.name)} (${esc(m.pageName)})` : esc(m.name);
      html += `<div class="journal-minimized-pill" data-action="journalRestoreMinimized" data-journal-id="${m.id}">`
        + `<i class="fas fa-book-open" aria-hidden="true"></i>`
        + `<span class="journal-pill-text"><span>${label}</span></span>`
        + `<button type="button" class="journal-pill-close" data-action="journalCloseMinimized" data-journal-id="${m.id}">`
        + `<i class="fas fa-times" aria-hidden="true"></i></button></div>`;
    }

    if (openJournal) {
      // Viewer header
      html += `<div class="journal-viewer-header">`
        + `<i class="fas fa-book-open" aria-hidden="true"></i>`
        + `<button type="button" class="journal-viewer-title" data-action="toggleJournalSwitcher">`
        + `${esc(openJournal.name)}`
        + `<i class="fas fa-caret-down journal-switcher-caret" aria-hidden="true"></i></button>`
        + `<i class="fas fa-font journal-font-icon-sm" aria-hidden="true"></i>`
        + `<input type="range" class="journal-font-size-slider" min="0.5" max="1.5" step="0.05" value="${this.journalFontSize}" data-tooltip="${game.i18n.localize('STORYFRAME.CinematicScene.JournalFontSize')}">`
        + `<i class="fas fa-font journal-font-icon-lg" aria-hidden="true"></i>`
        + `<div class="journal-autoscroll-controls">`
        + `<button type="button" class="journal-header-btn autoscroll-slower" data-action="autoScrollSlower" data-tooltip="Slower"><i class="fas fa-backward" aria-hidden="true"></i></button>`
        + `<button type="button" class="journal-header-btn autoscroll-toggle${this._autoScrollActive ? ' active' : ''}" data-action="toggleAutoScroll" data-tooltip="Auto-Scroll"><i class="fas fa-scroll" aria-hidden="true"></i></button>`
        + `<button type="button" class="journal-header-btn autoscroll-faster" data-action="autoScrollFaster" data-tooltip="Faster"><i class="fas fa-forward" aria-hidden="true"></i></button>`
        + `<span class="autoscroll-speed-label" style="display:none"></span>`
        + `</div>`
        + `<button type="button" class="journal-header-btn" data-action="journalMinimize" data-tooltip="${game.i18n.localize('STORYFRAME.CinematicScene.Minimize')}">`
        + `<i class="fas fa-minus" aria-hidden="true"></i></button>`
        + `<button type="button" class="journal-header-btn" data-action="journalClose" data-tooltip="${game.i18n.localize('STORYFRAME.UI.Labels.Close')}">`
        + `<i class="fas fa-times" aria-hidden="true"></i></button></div>`;

      // Switcher dropdown
      html += `<div class="journal-switcher-dropdown hidden">`
        + `<input type="text" class="journal-switcher-search" placeholder="${game.i18n.localize('STORYFRAME.CinematicScene.SearchJournals')}">`
        + `<div class="journal-switcher-list">`;
      for (const j of journalEntries) {
        html += `<div class="journal-switcher-item${j.id === openJournal.id ? ' active' : ''}" data-action="journalOpen" data-journal-id="${j.id}">`
          + `<i class="fas fa-book" aria-hidden="true"></i><span>${esc(j.name)}</span></div>`;
      }
      html += `</div></div>`;

      // Page tabs
      if (openJournal.pages.length > 1) {
        html += `<div class="journal-page-tabs">`;
        for (const page of openJournal.pages) {
          html += `<button type="button" class="journal-page-tab ${page.id === openJournal.activePageId ? 'active' : ''}" data-action="journalSelectPage" data-page-id="${page.id}">${esc(page.name)}</button>`;
        }
        html += `</div>`;
      }

      // Content
      html += `<div class="journal-content-scroll"><div class="journal-content-body">${openJournal.enrichedContent}</div></div>`;
    } else {
      // Journal list view
      html += `<h4><i class="fas fa-book" aria-hidden="true"></i> ${game.i18n.localize('STORYFRAME.CinematicScene.Journal')}</h4>`
        + `<div class="journal-search-row">`
        + `<input type="text" class="journal-search-input" placeholder="${game.i18n.localize('STORYFRAME.CinematicScene.SearchJournals')}" value="${esc(this.journalSearchQuery || '')}">`
        + `</div><div class="journal-entry-list">`;
      if (journalEntries.length === 0) {
        html += `<div class="left-panel-empty">${game.i18n.localize('STORYFRAME.CinematicScene.NoJournalsFound')}</div>`;
      } else {
        for (const entry of journalEntries) {
          html += `<div class="journal-entry-item" data-action="journalOpen" data-journal-id="${entry.id}">`
            + `<i class="fas fa-book" aria-hidden="true"></i><span>${esc(entry.name)}</span>`
            + (entry.pageCount ? `<span class="journal-page-count">${entry.pageCount}</span>` : '')
            + `</div>`;
          for (const page of entry.matchingPages) {
            html += `<div class="journal-entry-item journal-page-match" data-action="journalOpenPage" data-journal-id="${entry.id}" data-page-id="${page.id}">`
              + `<i class="fas fa-file-alt" aria-hidden="true"></i><span>${esc(page.name)}</span></div>`;
          }
        }
      }
      html += `</div>`;
    }

    sectionEl.innerHTML = html;
    this._bindJournalListeners();
    Hooks.callAll('storyframe.journalContentChanged');
  }

  /** Bind journal-specific event listeners (search input, font size slider, etc.) */
  _bindJournalListeners() {
    const journalSearch = this.element?.querySelector('.journal-search-input');
    if (journalSearch) {
      if (this.journalSearchQuery) {
        journalSearch.focus();
        journalSearch.setSelectionRange(journalSearch.value.length, journalSearch.value.length);
      }
      journalSearch.addEventListener('input', (e) => {
        this.journalSearchQuery = e.target.value;
        this._updateJournalSearchDOM();
      });
    }

    const journalBody = this.element?.querySelector('.journal-content-body');
    if (journalBody) journalBody.style.fontSize = `${this.journalFontSize}rem`;

    const fontSlider = this.element?.querySelector('.journal-font-size-slider');
    if (fontSlider) {
      fontSlider.addEventListener('input', (e) => {
        const size = parseFloat(e.target.value);
        this.journalFontSize = size;
        this.element?.querySelector('.journal-content-body')?.style.setProperty('font-size', `${size}rem`);
        game.settings.set(MODULE_ID, 'cinematicJournalFontSize', size);
      });
    }

    const activeTab = this.element?.querySelector('.journal-page-tab.active');
    activeTab?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });

    // Set scroll distance for overflowing minimized pill text
    this.element?.querySelectorAll('.journal-pill-text').forEach(outer => {
      const inner = outer.querySelector('span');
      if (!inner) return;
      const overflow = inner.scrollWidth - outer.clientWidth;
      inner.style.setProperty('--sf-scroll-distance', overflow > 0 ? `-${overflow}px` : '0px');
    });

    // Pause auto-scroll on manual wheel scroll
    const scrollContainer = this.element?.querySelector('.journal-content-scroll');
    if (scrollContainer) {
      scrollContainer.addEventListener('wheel', () => {
        if (this._autoScrollActive) this._stopAutoScroll();
      }, { passive: true });
    }

    // Journal image "show to players" buttons
    this.element?.querySelectorAll('.journal-content-body img').forEach(img => {
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
        this.showImagePreview(img.src);
        game.storyframe.socketManager.broadcastImagePreview(img.src);
      });
      wrapper.appendChild(btn);
    });
  }

  _persistMinimizedJournals() {
    game.storyframe.stateManager?.setMinimizedJournals(this.minimizedJournals);
  }

  // --- Action handlers ---

  static async _onExitScene() {
    game.storyframe.socketManager.closeSceneMode();
  }

  static _onSetBackground() {
    const current = game.storyframe.stateManager?.getState()?.sceneBackground;
    new FilePicker({
      type: 'imagevideo',
      current,
      callback: async (path) => {
        await game.storyframe.stateManager.setSceneBackground(path);
      },
    }).browse(current ?? '');
  }

  static async _onClearBackground() {
    await game.storyframe.stateManager.setSceneBackground(null);
  }

  static async _onOpenScene() {
    const { ScenePickerDialog } = await import('./scene-picker-dialog.mjs');
    const scene = await ScenePickerDialog.open();
    if (!scene) return;

    // Close cinematic scene for all clients
    game.storyframe.socketManager.closeSceneMode();

    // Brief delay for the socket broadcast to propagate before activating the new scene
    await new Promise((r) => setTimeout(r, 300));

    // Activate the scene for all players
    await scene.activate();
  }

  static _onIncrementCounter() {
    const id = game.storyframe.stateManager?.getState()?.activeSpeaker;
    if (!id) return;
    this._speakerCounters[id] = (this._speakerCounters[id] ?? 0) + 1;
    this.element?.querySelector('.counter-value')?.replaceWith(
      Object.assign(document.createElement('span'), { className: 'counter-value', textContent: this._speakerCounters[id] })
    );
  }

  static _onDecrementCounter() {
    const id = game.storyframe.stateManager?.getState()?.activeSpeaker;
    if (!id) return;
    this._speakerCounters[id] = (this._speakerCounters[id] ?? 0) - 1;
    this.element?.querySelector('.counter-value')?.replaceWith(
      Object.assign(document.createElement('span'), { className: 'counter-value', textContent: this._speakerCounters[id] })
    );
  }

  _updateCounterDisplay(speakerId) {
    const val = this._speakerCounters[speakerId] ?? 0;
    const el = this.element?.querySelector('.counter-value');
    if (el) el.textContent = val;
  }

  /**
   * Build and attach the broadcast player popup to the Show to Players button.
   */
  _setupBroadcastPopup() {
    const btn = this.element?.querySelector('.broadcast-status-btn');
    if (!btn) return;

    // Remove existing wrapper if re-rendering
    const existingWrapper = this.element?.querySelector('.broadcast-btn-wrapper');
    if (existingWrapper) {
      existingWrapper.replaceWith(existingWrapper.querySelector('[data-action="relaunchForPlayers"]'));
    }

    const sm = game.storyframe.socketManager;
    const status = sm?._gmBroadcastState?.playerCinematicStatus;
    const activePlayers = game.users.filter(u => !u.isGM && u.active);
    if (activePlayers.length === 0) return;

    // Wrap the button in a container div so popup is a sibling, not inside the <button>
    const wrapper = document.createElement('div');
    wrapper.className = 'broadcast-btn-wrapper';
    btn.parentNode.insertBefore(wrapper, btn);
    wrapper.appendChild(btn);

    // Create popup as sibling of button inside wrapper
    const popup = document.createElement('div');
    popup.className = 'broadcast-player-popup';

    for (const user of activePlayers) {
      const seeing = status?.get(user.id) === true;
      const row = document.createElement('div');
      row.className = 'broadcast-player-row';
      row.dataset.userId = user.id;
      row.innerHTML = `
        <span class="broadcast-player-status ${seeing ? 'active' : ''}"><i class="fas ${seeing ? 'fa-eye' : 'fa-eye-slash'}"></i></span>
        <span class="broadcast-player-name" style="color: ${user.color}">${user.name}</span>
        <button type="button" class="broadcast-player-send ${seeing ? 'hidden' : ''}" data-action="showToPlayer" data-user-id="${user.id}" data-tooltip="${game.i18n.localize('STORYFRAME.CinematicScene.ShowToPlayers')}">
          <i class="fas fa-play"></i>
        </button>
      `;
      popup.appendChild(row);
    }

    // "Show All" button at bottom
    const allSee = sm?.allPlayersSeeScene;
    if (!allSee) {
      const showAllRow = document.createElement('div');
      showAllRow.className = 'broadcast-show-all-row';
      showAllRow.innerHTML = `<button type="button" class="broadcast-show-all-btn" data-action="relaunchForPlayers"><i class="fas fa-users"></i> ${game.i18n.localize('STORYFRAME.CinematicScene.ShowToAll')}</button>`;
      popup.appendChild(showAllRow);
    }

    wrapper.appendChild(popup);

    // Hover on wrapper controls popup visibility
    let hideTimeout = null;
    wrapper.addEventListener('mouseenter', () => {
      clearTimeout(hideTimeout);
      popup.classList.add('visible');
      game.storyframe.socketManager?.pollPlayerCinematicStatus();
    });
    wrapper.addEventListener('mouseleave', () => {
      hideTimeout = setTimeout(() => popup.classList.remove('visible'), 200);
    });
  }

  static _onRelaunchForPlayers() {
    game.storyframe.socketManager.showSceneToPlayers();
    ui.notifications.info(game.i18n.localize('STORYFRAME.CinematicScene.Relaunched'));
  }

  static _onShowToPlayer(_event, target) {
    const userId = target.closest('[data-user-id]')?.dataset.userId;
    if (!userId) return;
    game.storyframe.socketManager.showSceneToPlayer(userId);
    const user = game.users.get(userId);
    if (user) {
      ui.notifications.info(game.i18n.format('STORYFRAME.CinematicScene.ShownToPlayer', { name: user.name }));
    }
  }

  static async _onSwitchSpeaker(_event, target) {
    const speakerId = target.closest('[data-speaker-id]')?.dataset.speakerId;

    // Player-owned speakers go to the secondary (responding) slot, not primary
    if (speakerId) {
      const state = game.storyframe.stateManager?.getState();
      const speaker = (state?.speakers || []).find(s => s.id === speakerId);
      if (speaker?.userId) {
        // Toggle: if already secondary, clear it; otherwise set it
        const newSecondary = state.secondarySpeaker === speakerId ? null : speakerId;
        await game.storyframe.socketManager.requestSetSecondarySpeaker(newSecondary);
        // Clear any pending request for this speaker
        if (newSecondary) {
          await game.storyframe.socketManager.requestClearSpeakerRequest(speakerId);
        }
        const updatedState = game.storyframe.stateManager?.getState();
        if (updatedState) {
          this._prevSecondaryKey = updatedState.secondarySpeaker ?? '';
          await this._swapActiveSpeaker(updatedState);
        }
        return;
      }
    }

    await game.storyframe.socketManager.requestSetActiveSpeaker(speakerId || null);
    const state = game.storyframe.stateManager?.getState();
    if (state) {
      this._prevActiveKey = state.activeSpeaker || '';
      await this._swapActiveSpeaker(state);
    }
  }

  static _onToggleSidePanel() {
    this.sidePanelOpen = !this.sidePanelOpen;
    this.element?.querySelector('.cinematic-side-panel')?.classList.toggle('open', this.sidePanelOpen);
  }

  static _onToggleLeftPanel() {
    this.leftPanelOpen = !this.leftPanelOpen;
    this.element?.querySelector('.cinematic-left-panel')?.classList.toggle('open', this.leftPanelOpen);
  }

  static async _onLoadSpeakerScene(_event, target) {
    const sceneId = target.closest('[data-scene-id]')?.dataset.sceneId;
    if (!sceneId) return;
    const scenes = game.settings.get(MODULE_ID, 'speakerScenes') || [];
    const scene = scenes.find(s => s.id === sceneId);
    if (scene?.speakers) {
      await game.storyframe.socketManager.requestUpdateSpeakers(scene.speakers);

      // Stop all playing playlists, then start saved one (if any)
      for (const p of game.playlists) {
        if (p.playing) await p.stopAll();
      }
      if (scene.playlistId) {
        const playlist = game.playlists.get(scene.playlistId);
        if (playlist) {
          const updates = playlist.sounds.contents.map(s => ({ _id: s.id, playing: true }));
          await playlist.updateEmbeddedDocuments('PlaylistSound', updates);
        }
      }

      // Set or clear background
      await game.storyframe.stateManager.setSceneBackground(scene.sceneBackground || null);

      // Restore minimized journals (if any)
      this.minimizedJournals = Array.isArray(scene.minimizedJournals) ? [...scene.minimizedJournals] : [];
      this._persistMinimizedJournals();

      this.render();
    }
  }

  static async _onSaveSceneState(_event, target) {
    const sceneId = target.closest('[data-scene-id]')?.dataset.sceneId;
    if (!sceneId) return;
    const scenes = game.settings.get(MODULE_ID, 'speakerScenes') || [];
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;

    const playingPlaylist = game.playlists.find(p => p.playing);
    const state = game.storyframe.stateManager.getState();

    const updatedScenes = scenes.map(s =>
      s.id === sceneId
        ? { ...s, playlistId: playingPlaylist?.id || null, sceneBackground: state?.sceneBackground || null, minimizedJournals: this.minimizedJournals, updatedAt: Date.now() }
        : s
    );
    await game.settings.set(MODULE_ID, 'speakerScenes', updatedScenes);
    ui.notifications.info(game.i18n.format('STORYFRAME.Notifications.Scene.SceneStateUpdated', { name: scene.name }));
    this.render();
  }

  static async _onSaveCurrentScene() {
    const state = game.storyframe.stateManager.getState();
    const speakers = state?.speakers || [];

    if (speakers.length === 0) {
      ui.notifications.warn(game.i18n.localize('STORYFRAME.Notifications.Speaker.NoSpeakersToSave'));
      return;
    }

    const { showSceneEditor } = await import('../../scene-editor.mjs');
    await showSceneEditor({
      speakers: [...speakers],
    });
  }

  static async _onDeleteSpeakerScene(_event, target) {
    const sceneId = target.closest('[data-scene-id]')?.dataset.sceneId;
    if (!sceneId) return;
    const scenes = game.settings.get(MODULE_ID, 'speakerScenes') || [];
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('STORYFRAME.Dialogs.DeleteScene.Title') },
      content: `<p>${game.i18n.format('STORYFRAME.Dialogs.DeleteScene.Content', { name: scene.name })}</p>`,
      yes: { label: game.i18n.localize('STORYFRAME.Dialogs.DeleteScene.Button') },
    });
    if (!confirmed) return;

    const updatedScenes = scenes.filter(s => s.id !== sceneId);
    await game.settings.set(MODULE_ID, 'speakerScenes', updatedScenes);
    this.render();
  }

  static async _onRequestQuickSkill(_event, target) {
    const skillSlug = target.dataset.skill;
    if (!skillSlug) return;
    const { openRollRequesterAndSend } = await import('../gm-sidebar/managers/skill-check-handlers.mjs');
    await openRollRequesterAndSend(this, skillSlug, 'skill');
  }

  static async _onRequestQuickSave(_event, target) {
    const saveSlug = target.dataset.skill;
    if (!saveSlug) return;
    const { openRollRequesterAndSend } = await import('../gm-sidebar/managers/skill-check-handlers.mjs');
    await openRollRequesterAndSend(this, saveSlug, 'save');
  }

  static async _onRequestJournalCheck(_event, target) {
    const skillSlug = target.dataset.skill;
    const checkType = target.dataset.checkType || 'skill';
    if (!skillSlug) return;
    const dc = parseInt(target.dataset.dc);
    if (!isNaN(dc)) this.currentDC = dc;
    const { openRollRequesterAndSend } = await import('../gm-sidebar/managers/skill-check-handlers.mjs');
    await openRollRequesterAndSend(this, skillSlug, checkType);
  }

  static _onToggleSecretRoll() {
    this.secretRollEnabled = !this.secretRollEnabled;
    const btn = this.element?.querySelector('.cinematic-secret-btn');
    btn?.classList.toggle('active', this.secretRollEnabled);
    btn?.setAttribute('aria-pressed', this.secretRollEnabled ? 'true' : 'false');
  }

  static async _onTogglePresetDropdown(event, target) {
    const { onTogglePresetDropdown } = await import('../gm-sidebar/managers/dc-handlers.mjs');
    const { getAllPlayerPCs, getDCOptions, getDifficultyAdjustments } = await import('../../system-adapter.mjs');

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

  static async _onOpenGMSidebar() {
    if (!game.storyframe.gmSidebar) {
      const system = game.system.id;
      if (system === 'pf2e' || system === 'sf2e') {
        const { GMSidebarAppPF2e } = await import('../gm-sidebar/gm-sidebar-pf2e.mjs');
        game.storyframe.gmSidebar = new GMSidebarAppPF2e();
      } else if (system === 'dnd5e') {
        const { GMSidebarAppDND5e } = await import('../gm-sidebar/gm-sidebar-dnd5e.mjs');
        game.storyframe.gmSidebar = new GMSidebarAppDND5e();
      } else if (system === 'daggerheart') {
        const { GMSidebarAppDaggerheart } = await import('../gm-sidebar/gm-sidebar-daggerheart.mjs');
        game.storyframe.gmSidebar = new GMSidebarAppDaggerheart();
      } else if (system === 'projectfu') {
        const { GMSidebarAppProjectFU } = await import('../gm-sidebar/gm-sidebar-projectfu.mjs');
        game.storyframe.gmSidebar = new GMSidebarAppProjectFU();
      } else {
        const { GMSidebarAppBase } = await import('../gm-sidebar/gm-sidebar-base.mjs');
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

  static async _onCancelPendingRoll(_event, target) {
    const requestId = target.closest('[data-request-id]')?.dataset.requestId;
    if (requestId) await game.storyframe.socketManager.requestRemovePendingRoll(requestId);
  }

  // --- Dialogue bar ---

  /**
   * Populate the language dropdown from Polyglot (if installed) or the game system.
   */
  _populateLanguageDropdown() {
    const select = this.element?.querySelector('.dialogue-language-select');
    if (!select) return;

    // Preserve current selection
    const current = select.value;

    // Clear and rebuild
    select.innerHTML = '<option value="">Common</option>';

    const polyglot = game.polyglot;
    if (polyglot?.languageProvider) {
      // Polyglot is available — use its languages
      const langs = polyglot.languageProvider?.languages ?? polyglot.languages ?? {};
      for (const [key, data] of Object.entries(langs)) {
        const label = data?.label ?? game.i18n.localize(key) ?? key;
        select.innerHTML += `<option value="${key}">${label}</option>`;
      }
    } else {
      // Fallback: get languages from the game system config
      const systemLangs = this._getSystemLanguages();
      for (const [key, label] of systemLangs) {
        select.innerHTML += `<option value="${key}">${label}</option>`;
      }
    }

    // Restore selection if still valid
    if (current && select.querySelector(`option[value="${current}"]`)) {
      select.value = current;
    }
  }

  /**
   * Extract languages from the game system config with localized labels.
   * @returns {Array<[string, string]>} Array of [key, localizedLabel] pairs
   */
  _getSystemLanguages() {
    const results = [];

    // Try to get languages from actor schema or CONFIG
    const extract = (obj) => {
      for (const [key, val] of Object.entries(obj)) {
        if (typeof val === 'string') {
          // Localize if it looks like an i18n key, otherwise use as-is
          let label = game.i18n.localize(val);
          // If localize returned the key unchanged and it has dots, use the last segment
          if (label === val && val.includes('.')) {
            label = val.split('.').pop().replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          }
          results.push([key, label]);
        } else if (val?.label) {
          const label = game.i18n.localize(val.label);
          results.push([key, label]);
          if (val.children) extract(val.children);
        } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
          extract(val);
        }
      }
    };

    // PF2E / SF2E
    if (CONFIG.PF2E?.languages) {
      extract(CONFIG.PF2E.languages);
    }
    // D&D 5e
    else if (CONFIG.DND5E?.languages) {
      extract(CONFIG.DND5E.languages);
    }

    // Sort alphabetically by label
    results.sort((a, b) => a[1].localeCompare(b[1]));
    return results;
  }

  static _onToggleDialogueBar() {
    const bar = this.element?.querySelector('.cinematic-dialogue-input-bar');
    if (!bar) return;
    const visible = bar.style.display !== 'none';
    bar.style.display = visible ? 'none' : '';
    if (!visible) {
      bar.querySelector('.dialogue-input')?.focus();
    }
  }

  static _onToggleDialogueTTS() {
    const tts = game.storyframe.tts;
    if (!tts?.isSupported) {
      ui.notifications.warn('Speech recognition is not supported in this browser.');
      return;
    }

    const btn = this.element?.querySelector('.dialogue-speak-btn');
    const input = this.element?.querySelector('.dialogue-input');

    if (tts.isListening) {
      tts.stopListening();
      btn?.classList.remove('active');
      // Send any accumulated text
      if (input?.value?.trim()) {
        CinematicGMApp._onSendDialogue.call(this, new KeyboardEvent('keydown', { key: 'Enter' }));
      }
    } else {
      btn?.classList.add('active');
      let autoSendTimer = null;

      tts.startListening({
        onResult: (finalText, interimText) => {
          if (!input) return;

          if (finalText) {
            input.value = (input.value ? input.value + ' ' : '') + finalText;
            input.placeholder = 'Listening...';

            // Auto-send after 2s of silence following finalized text
            clearTimeout(autoSendTimer);
            autoSendTimer = setTimeout(() => {
              if (input.value?.trim()) {
                CinematicGMApp._onSendDialogue.call(this, new KeyboardEvent('keydown', { key: 'Enter' }));
              }
            }, 2000);
          } else if (interimText) {
            input.placeholder = interimText;
            // Reset the auto-send timer while still speaking
            clearTimeout(autoSendTimer);
          }
        },
        onEnd: () => {
          clearTimeout(autoSendTimer);
          btn?.classList.remove('active');
          if (input) input.placeholder = 'Type dialogue for the active speaker...';
          // Send any remaining text
          if (input?.value?.trim()) {
            CinematicGMApp._onSendDialogue.call(this, new KeyboardEvent('keydown', { key: 'Enter' }));
          }
        },
      });
      if (input) input.placeholder = 'Listening...';
    }
  }

  static async _onSendDialogue(event) {
    // Handle Enter key on input or click on send button
    if (event.type === 'click' || (event.type === 'keydown' && event.key === 'Enter')) {
      const input = this.element?.querySelector('.dialogue-input');
      const text = input?.value?.trim();
      if (!text) return;

      const langSelect = this.element?.querySelector('.dialogue-language-select');
      const lang = langSelect?.value || '';

      // Build scrambled version for players who don't know the language
      let scrambledText = text;
      let fontFamily = null;
      if (lang && game.polyglot) {
        try {
          const salt = lang + Date.now();
          scrambledText = game.polyglot.scrambleString?.(text, salt, lang) ?? text;
          const langData = game.polyglot.languageProvider?.languages?.[lang]
            ?? game.polyglot.languages?.[lang];
          fontFamily = langData?.font ?? null;
        } catch {
          scrambledText = text;
        }
      }

      // GM always sees the original text
      const container = this.element?.querySelector('.cinematic-scene-container');
      if (container && game.storyframe.dialogue) {
        game.storyframe.dialogue.typeDialogue(container, text, {
          speed: 'normal',
          onComplete: () => {
            setTimeout(() => {
              game.storyframe.dialogue?.destroyDialogue(container);
            }, 6000);
          },
        });
      }

      // Broadcast to players — send both versions + language key so players
      // can check if their character knows the language
      game.storyframe.socketManager?.broadcastDialogue({
        originalText: text,
        scrambledText,
        fontFamily,
        lang,
      });

      // TTS is triggered directly from the keydown/click event handler
      // (browsers require speechSynthesis.speak() in the direct user event chain)

      // Clear input
      input.value = '';
    }
  }

  // --- Speaker actions ---

  static async _onEditSpeaker(event, target) {
    const { onEditSpeaker } = await import('../gm-sidebar/managers/speaker-handlers.mjs');
    return onEditSpeaker(event, target);
  }

  static async _onRemoveSpeaker(event, target) {
    const { onRemoveSpeaker } = await import('../gm-sidebar/managers/speaker-handlers.mjs');
    return onRemoveSpeaker(event, target);
  }

  static async _onToggleSpeakerVisibility(event, target) {
    const { onToggleSpeakerVisibility } = await import('../gm-sidebar/managers/speaker-handlers.mjs');
    return onToggleSpeakerVisibility(event, target);
  }

  static async _onToggleSpeakerHidden(event, target) {
    const { onToggleSpeakerHidden } = await import('../gm-sidebar/managers/speaker-handlers.mjs');
    return onToggleSpeakerHidden(event, target);
  }

  static async _onCycleSpeakerImageNext(event, target) {
    const { onCycleSpeakerImageNext } = await import('../gm-sidebar/managers/speaker-handlers.mjs');
    return onCycleSpeakerImageNext(event, target);
  }

  static async _onCycleSpeakerImagePrev(event, target) {
    const { onCycleSpeakerImagePrev } = await import('../gm-sidebar/managers/speaker-handlers.mjs');
    return onCycleSpeakerImagePrev(event, target);
  }

  static async _onAddSpeakerAltImage(event, target) {
    const { onAddSpeakerAltImage } = await import('../gm-sidebar/managers/speaker-handlers.mjs');
    return onAddSpeakerAltImage(event, target);
  }

  static async _onRemoveSpeakerAltImage(event, target) {
    const { onRemoveSpeakerAltImage } = await import('../gm-sidebar/managers/speaker-handlers.mjs');
    return onRemoveSpeakerAltImage(event, target);
  }

  // --- Journal actions ---

  static _onJournalOpen(_event, target) {
    const journalId = target.closest('[data-journal-id]')?.dataset.journalId;
    if (!journalId) return;
    this._stopAutoScroll();
    // Remove from minimized list if restoring a minimized journal
    this.minimizedJournals = this.minimizedJournals.filter(m => m.id !== journalId);
    this.openJournalId = journalId;
    this.openJournalPageId = null;
    this._persistMinimizedJournals();
    this._updateJournalSection();
  }

  static _onJournalOpenPage(_event, target) {
    const journalId = target.closest('[data-journal-id]')?.dataset.journalId;
    const pageId = target.dataset.pageId;
    if (!journalId) return;
    this._stopAutoScroll();
    this.minimizedJournals = this.minimizedJournals.filter(m => m.id !== journalId);
    this.openJournalId = journalId;
    this.openJournalPageId = pageId || null;
    this._persistMinimizedJournals();
    this._updateJournalSection();
  }

  static _onJournalClose() {
    this._stopAutoScroll();
    this.openJournalId = null;
    this.openJournalPageId = null;
    this._updateJournalSection();
  }

  // --- Auto-Scroll ---

  /** Pixels per second — speed presets */
  static AUTO_SCROLL_SPEEDS = [15, 25, 40, 60, 90];
  static AUTO_SCROLL_DEFAULT_INDEX = 2; // 40 px/s

  static _onToggleAutoScroll() {
    if (this._autoScrollActive) {
      this._stopAutoScroll();
    } else {
      this._startAutoScroll();
    }
  }

  static _onAutoScrollFaster() {
    if (this._autoScrollSpeedIndex == null) this._autoScrollSpeedIndex = CinematicGMApp.AUTO_SCROLL_DEFAULT_INDEX;
    this._autoScrollSpeedIndex = Math.min(this._autoScrollSpeedIndex + 1, CinematicGMApp.AUTO_SCROLL_SPEEDS.length - 1);
    this._updateAutoScrollSpeedDisplay();
  }

  static _onAutoScrollSlower() {
    if (this._autoScrollSpeedIndex == null) this._autoScrollSpeedIndex = CinematicGMApp.AUTO_SCROLL_DEFAULT_INDEX;
    this._autoScrollSpeedIndex = Math.max(this._autoScrollSpeedIndex - 1, 0);
    this._updateAutoScrollSpeedDisplay();
  }

  _startAutoScroll() {
    const scrollEl = this.element?.querySelector('.journal-content-scroll');
    if (!scrollEl) return;

    if (this._autoScrollSpeedIndex == null) this._autoScrollSpeedIndex = CinematicGMApp.AUTO_SCROLL_DEFAULT_INDEX;
    this._autoScrollActive = true;
    this._autoScrollAccum = 0; // Sub-pixel accumulator

    // Use a fixed-interval approach instead of RAF for consistent, smooth scrolling
    this._autoScrollInterval = setInterval(() => {
      if (!this._autoScrollActive) return;

      const speed = CinematicGMApp.AUTO_SCROLL_SPEEDS[this._autoScrollSpeedIndex ?? CinematicGMApp.AUTO_SCROLL_DEFAULT_INDEX];
      // 50ms interval = 20 ticks/sec → accumulate fractional pixels
      this._autoScrollAccum += speed / 20;

      if (this._autoScrollAccum >= 1) {
        const px = Math.floor(this._autoScrollAccum);
        this._autoScrollAccum -= px;
        scrollEl.scrollTop += px;
      }

      // Stop at bottom
      if (scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 1) {
        this._stopAutoScroll();
      }
    }, 50);

    // Update toggle button state
    const btn = this.element?.querySelector('.autoscroll-toggle');
    btn?.classList.add('active');
    this._updateAutoScrollSpeedDisplay();
  }

  _stopAutoScroll() {
    this._autoScrollActive = false;
    if (this._autoScrollInterval) {
      clearInterval(this._autoScrollInterval);
      this._autoScrollInterval = null;
    }
    const btn = this.element?.querySelector('.autoscroll-toggle');
    btn?.classList.remove('active');
    this._hideAutoScrollSpeed();
  }

  _updateAutoScrollSpeedDisplay() {
    const speedLabel = this.element?.querySelector('.autoscroll-speed-label');
    if (!speedLabel) return;
    const speed = CinematicGMApp.AUTO_SCROLL_SPEEDS[this._autoScrollSpeedIndex ?? CinematicGMApp.AUTO_SCROLL_DEFAULT_INDEX];
    speedLabel.textContent = `${speed}`;
    speedLabel.style.display = '';
  }

  _hideAutoScrollSpeed() {
    const speedLabel = this.element?.querySelector('.autoscroll-speed-label');
    if (speedLabel) speedLabel.style.display = 'none';
  }

  static _onJournalMinimize() {
    this._stopAutoScroll();
    if (this.openJournalId) {
      if (!this.minimizedJournals.some(m => m.id === this.openJournalId)) {
        this.minimizedJournals.push({ id: this.openJournalId, pageId: this.openJournalPageId });
      }
      this.openJournalId = null;
      this.openJournalPageId = null;
    }
    this._persistMinimizedJournals();
    this._updateJournalSection();
  }

  static _onJournalRestoreMinimized(_event, target) {
    const journalId = target.closest('[data-journal-id]')?.dataset.journalId;
    if (!journalId) return;
    const entry = this.minimizedJournals.find(m => m.id === journalId);
    // Auto-minimize the currently open journal
    if (this.openJournalId && this.openJournalId !== journalId) {
      if (!this.minimizedJournals.some(m => m.id === this.openJournalId)) {
        this.minimizedJournals.push({ id: this.openJournalId, pageId: this.openJournalPageId });
      }
    }
    this.minimizedJournals = this.minimizedJournals.filter(m => m.id !== journalId);
    this.openJournalId = journalId;
    this.openJournalPageId = entry?.pageId || null;
    this._persistMinimizedJournals();
    this._updateJournalSection();
  }

  static _onJournalCloseMinimized(_event, target) {
    const journalId = target.closest('[data-journal-id]')?.dataset.journalId;
    if (!journalId) return;
    this.minimizedJournals = this.minimizedJournals.filter(m => m.id !== journalId);
    this._persistMinimizedJournals();
    this._updateJournalSection();
  }

  static _onToggleJournalSwitcher() {
    const dropdown = this.element?.querySelector('.journal-switcher-dropdown');
    if (!dropdown) return;
    const isHidden = dropdown.classList.contains('hidden');
    if (isHidden) {
      dropdown.classList.remove('hidden');
      const searchInput = dropdown.querySelector('.journal-switcher-search');
      searchInput?.focus();
      // Filter items on search input
      searchInput?.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        dropdown.querySelectorAll('.journal-switcher-item').forEach(item => {
          const name = item.querySelector('span')?.textContent?.toLowerCase() || '';
          item.style.display = name.includes(q) ? '' : 'none';
        });
      });
      // Close on click outside
      const closeHandler = (e) => {
        if (!dropdown.contains(e.target) && !e.target.closest('[data-action="toggleJournalSwitcher"]')) {
          dropdown.classList.add('hidden');
          document.removeEventListener('pointerdown', closeHandler);
        }
      };
      setTimeout(() => document.addEventListener('pointerdown', closeHandler), 0);
      // Close on Escape
      const escHandler = (e) => {
        if (e.key === 'Escape') {
          dropdown.classList.add('hidden');
          document.removeEventListener('keydown', escHandler);
        }
      };
      document.addEventListener('keydown', escHandler);
    } else {
      dropdown.classList.add('hidden');
    }
  }

  static _onJournalSelectPage(_event, target) {
    this.openJournalPageId = target.dataset.pageId;
    this._updateJournalSection();
  }

  // --- Challenge actions ---

  static async _onPresentSavedChallenge(_event, target) {
    const { onPresentSavedChallenge } = await import('../gm-sidebar/managers/challenge-handlers.mjs');
    onPresentSavedChallenge(null, target, null);
  }

  static async _onRemoveChallenge(_event, target) {
    const { onRemoveChallenge } = await import('../gm-sidebar/managers/challenge-handlers.mjs');
    onRemoveChallenge(null, target, null);
  }

  // --- Music helpers ---

  /** Bind per-track volume slider, preventing parent action propagation */
  _bindTrackVolumeSlider(slider) {
    if (!slider) return;
    slider.addEventListener('click', (e) => e.stopPropagation());
    slider.addEventListener('mousedown', (e) => e.stopPropagation());
    let volumeTimer = null;
    slider.addEventListener('input', (e) => {
      e.stopPropagation();
      const playlistId = e.target.dataset.playlistId;
      const soundId = e.target.dataset.soundId;
      if (!playlistId || !soundId) return;
      const vol = parseFloat(e.target.value);
      const sound = game.playlists.get(playlistId)?.sounds.get(soundId);
      // Debounce document update to avoid flooding the server during drag
      clearTimeout(volumeTimer);
      volumeTimer = setTimeout(() => sound?.update({ volume: vol }), 150);
    });
  }

  // --- Music actions ---

  static async _onMusicVolumeReset() {
    if (this._savedGlobalVolume === null) return;
    await game.settings.set('core', 'globalPlaylistVolume', this._savedGlobalVolume);
    const slider = this.element?.querySelector('.cinematic-music-volume');
    if (slider) slider.value = this._savedGlobalVolume;
    this._savedGlobalVolume = null;
    this.element?.querySelector('.music-volume-reset')?.classList.add('hidden');
  }

  static _onToggleNowPlayingPlaylist(_event, target) {
    const header = target.closest('.now-playing-playlist-header');
    const group = header?.closest('.now-playing-playlist-group');
    if (!group) return;
    const tracks = group.querySelector('.now-playing-tracks');
    const icon = header.querySelector('i');
    if (!tracks) return;
    const collapsed = tracks.style.display === 'none';
    tracks.style.display = collapsed ? '' : 'none';
    icon?.classList.toggle('fa-chevron-down', collapsed);
    icon?.classList.toggle('fa-chevron-right', !collapsed);
  }

  static _onMusicPlayPause() {
    const np = this._getNowPlaying();
    if (np) {
      const playlist = game.playlists.get(np.playlistId);
      playlist?.stopAll();
    } else {
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

  static async _onTrackRepeat(_event, target) {
    const btn = target.closest('[data-playlist-id]');
    const playlistId = btn?.dataset.playlistId;
    const soundId = btn?.dataset.soundId;
    if (!playlistId || !soundId) return;
    const sound = game.playlists.get(playlistId)?.sounds.get(soundId);
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
    const icon = target.querySelector('i');
    if (icon) {
      icon.classList.toggle('fa-chevron-down', expanded);
      icon.classList.toggle('fa-chevron-right', !expanded);
    }
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

  static _onToggleFolderExpand(_event, target) {
    const folderId = target.closest('[data-folder-id]')?.dataset.folderId;
    if (!folderId) return;
    if (this.expandedFolderIds.has(folderId)) {
      this.expandedFolderIds.delete(folderId);
    } else {
      this.expandedFolderIds.add(folderId);
    }
    // Rebuild the playlist tree in place
    const listEl = this.element?.querySelector('.left-panel-playlists');
    if (listEl) {
      listEl.innerHTML = '';
      this._buildPlaylistTreeDOM(listEl);
    }
  }

  static async _onMusicPlayPlaylist(_event, target) {
    const playlistId = target.closest('[data-playlist-id]')?.dataset.playlistId;
    if (!playlistId) return;
    for (const p of game.playlists) {
      if (p.playing) await p.stopAll();
    }
    const playlist = game.playlists.get(playlistId);
    if (!playlist) return;
    // Play all tracks simultaneously regardless of playlist mode
    const updates = playlist.sounds.contents.map(s => ({ _id: s.id, playing: true }));
    await playlist.updateEmbeddedDocuments('PlaylistSound', updates);
  }

  // --- Player Speaker Actions ---

  static async _onTogglePlayerSpeakers() {
    const current = game.settings.get(MODULE_ID, 'allowPlayerSpeakers');
    await game.settings.set(MODULE_ID, 'allowPlayerSpeakers', !current);
    // Broadcast state so all player clients re-render with the new setting
    game.storyframe.socketManager?.broadcastStateUpdate();
  }

  static async _onApproveSpeakerRequest(_event, target) {
    const speakerId = target.closest('[data-speaker-id]')?.dataset.speakerId;
    if (!speakerId) return;
    await game.storyframe.socketManager.requestSetSecondarySpeaker(speakerId);
    await game.storyframe.socketManager.requestClearSpeakerRequest(speakerId);
  }

  static async _onDismissSpeakerRequest(_event, target) {
    const speakerId = target.closest('[data-speaker-id]')?.dataset.speakerId;
    if (!speakerId) return;
    await game.storyframe.socketManager.requestClearSpeakerRequest(speakerId);
  }

  static async _onClearSecondarySpeaker() {
    await game.storyframe.socketManager.requestSetSecondarySpeaker(null);
  }

  _updateRequestIndicators(state) {
    const container = this.element?.querySelector('.cinematic-scene-container');
    if (!container) return;
    const requests = state.speakerRequests || [];
    const requestIds = new Set(requests.map(r => r.speakerId));

    // Update request queue badge
    const badge = container.querySelector('.speaker-request-badge');
    if (badge) {
      badge.textContent = requests.length;
      badge.classList.toggle('hidden', requests.length === 0);
    }

    // Update filmstrip glow indicators
    for (const card of container.querySelectorAll('.filmstrip-speaker')) {
      card.classList.toggle('has-request', requestIds.has(card.dataset.speakerId));
    }

    // Update request queue panel
    const panel = container.querySelector('.speaker-request-queue');
    if (panel) {
      panel.classList.toggle('hidden', requests.length === 0);
    }
  }
}
