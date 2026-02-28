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
      journalMinimize: CinematicGMApp._onJournalMinimize,
      journalExpand: CinematicGMApp._onJournalExpand,
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
      musicPlayPlaylist: CinematicGMApp._onMusicPlayPlaylist,
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
      openScene: CinematicGMApp._onOpenScene,
      incrementCounter: CinematicGMApp._onIncrementCounter,
      decrementCounter: CinematicGMApp._onDecrementCounter,
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
    this.leftPanelOpen = true;
    this.expandedPlaylistIds = new Set();
    this._savedTrackVolumes = new Map(); // playlistId:soundId → original volume
    this.musicSearchQuery = '';
    this.openJournalId = null;
    this.openJournalPageId = null;
    this.journalMinimized = false;
    this.journalSearchQuery = '';
    this.journalFontSize = game.settings.get(MODULE_ID, 'cinematicJournalFontSize') ?? 0.75;
    this._speakerCounters = {};
    this._escHandler = null;
    this._playlistHookIds = [];
    this._chatHookId = null;
    this._chatDeleteHookId = null;
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

    if (!state) {
      return {
        ...base,
        sidePanelOpen: this.sidePanelOpen,
        leftPanelOpen: this.leftPanelOpen,
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
        musicSearchResults: [],
        gmPendingRolls: [],
        savedChallenges: [],
        gmActiveChallenges: [],
        journalEntries: [],
        openJournal: null,
        journalMinimized: false,
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
    const speakerScenes = game.settings.get(MODULE_ID, 'speakerScenes') || [];
    const playlists = game.playlists.contents.map(p => ({
      id: p.id, name: p.name, playing: p.playing, mode: p.mode,
      expanded: this.expandedPlaylistIds.has(p.id),
      trackCount: p.sounds.size,
      tracks: this.expandedPlaylistIds.has(p.id)
        ? p.sounds.contents.map(s => ({ id: s.id, name: s.name, playing: s.playing, volume: s.volume }))
        : [],
    }));
    // Auto-expand playlists with currently-playing sounds
    for (const p of game.playlists) {
      if (p.sounds.some(s => s.playing) && !this.expandedPlaylistIds.has(p.id)) {
        this.expandedPlaylistIds.add(p.id);
        const idx = playlists.findIndex(pl => pl.id === p.id);
        if (idx >= 0) {
          playlists[idx].expanded = true;
          playlists[idx].tracks = p.sounds.contents.map(s => ({
            id: s.id, name: s.name, playing: s.playing, volume: s.volume,
          }));
        }
      }
    }
    const nowPlaying = this._getNowPlaying();
    let currentVolume = 0.5;
    let shuffleActive = false;
    let repeatActive = false;
    if (nowPlaying) {
      const pl = game.playlists.get(nowPlaying.playlistId);
      const sound = pl?.sounds.get(nowPlaying.soundId);
      if (sound) currentVolume = sound.volume;
      if (pl) shuffleActive = pl.mode === CONST.PLAYLIST_MODES.SHUFFLE;
      if (sound) repeatActive = sound.repeat;
    }
    // Collect currently-playing tracks grouped by playlist
    const playingByPlaylist = [];
    for (const p of game.playlists) {
      const tracks = p.sounds.contents.filter(s => s.playing).map(s => ({ id: s.id, name: s.name, volume: s.volume, repeat: s.repeat }));
      if (tracks.length) playingByPlaylist.push({ id: p.id, name: p.name, tracks });
    }
    let musicSearchResults = [];
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

    // Journal checks/saves/lore from the currently open journal + PC lore skills
    let journalSkillGroups = [];
    let journalLoreGroups = [];
    let journalSaveGroups = [];
    let loreSkills = [];
    if (hasParticipants) {
      try {
        const sys = SystemAdapter.detectSystem();
        let SidebarClass;
        if (sys === 'pf2e') {
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
      nowPlaying,
      currentVolume,
      playingByPlaylist,
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

    // Playlist reactivity hooks (register once)
    if (this._playlistHookIds.length === 0) {
      this._playlistHookIds.push(
        { hook: 'updatePlaylist', id: Hooks.on('updatePlaylist', () => this._debouncedMusicUpdate()) },
        { hook: 'updatePlaylistSound', id: Hooks.on('updatePlaylistSound', () => this._debouncedMusicUpdate()) },
      );
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

    // Global volume slider — controls all playing tracks, saves originals on first use
    const volumeSlider = this.element?.querySelector('.cinematic-music-volume');
    if (volumeSlider) {
      let globalVolTimer = null;
      volumeSlider.addEventListener('input', (e) => {
        const vol = parseFloat(e.target.value);
        // Save original volumes before first global adjustment
        for (const p of game.playlists) {
          for (const s of p.sounds) {
            if (s.playing) {
              const key = `${p.id}:${s.id}`;
              if (!this._savedTrackVolumes.has(key)) this._savedTrackVolumes.set(key, s.volume);
            }
          }
        }
        // Show reset button
        this.element?.querySelector('.music-volume-reset')?.classList.remove('hidden');
        clearTimeout(globalVolTimer);
        globalVolTimer = setTimeout(() => {
          for (const p of game.playlists) {
            const updates = p.sounds.contents
              .filter(s => s.playing)
              .map(s => ({ _id: s.id, volume: vol }));
            if (updates.length) p.updateEmbeddedDocuments('PlaylistSound', updates);
          }
        }, 150);
        // Sync per-track sliders locally for immediate feedback
        this.element?.querySelectorAll('.track-volume-slider').forEach(s => { s.value = vol; });
      });
    }

    // Show reset button if saved volumes exist
    if (this._savedTrackVolumes.size) {
      this.element?.querySelector('.music-volume-reset')?.classList.remove('hidden');
    }

    // Per-track volume sliders (in now-playing section)
    this.element?.querySelectorAll('.track-volume-slider').forEach(s => this._bindTrackVolumeSlider(s));

    // Music search
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

    // Journal search
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

    // Apply saved journal font size to content body
    const journalBody = this.element?.querySelector('.journal-content-body');
    if (journalBody) journalBody.style.fontSize = `${this.journalFontSize}rem`;

    // Journal font size slider
    const fontSlider = this.element?.querySelector('.journal-font-size-slider');
    if (fontSlider) {
      fontSlider.addEventListener('input', (e) => {
        const size = parseFloat(e.target.value);
        this.journalFontSize = size;
        this.element?.querySelector('.journal-content-body')?.style.setProperty('font-size', `${size}rem`);
        game.settings.set(MODULE_ID, 'cinematicJournalFontSize', size);
      });
    }

    // Scroll active journal page tab into view
    const activeTab = this.element?.querySelector('.journal-page-tab.active');
    activeTab?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });

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
      if (this._chatHookId != null) Hooks.off('createChatMessage', this._chatHookId);
      this._chatHookId = Hooks.on('createChatMessage', (msg) => {
        this._appendChatMessage(chatContainer, msg);
      });
      if (this._chatDeleteHookId != null) Hooks.off('deleteChatMessage', this._chatDeleteHookId);
      this._chatDeleteHookId = Hooks.on('deleteChatMessage', (msg) => {
        chatContainer.querySelector(`.message[data-message-id="${msg.id}"]`)?.remove();
      });
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

    // Journal image "show in spotlight" buttons
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
        game.storyframe.socketManager.broadcastImagePreview(img.src);
      });
      wrapper.appendChild(btn);
    });

    // Floating panels draggable
    for (const key of ['cinematic-floating-pending', 'cinematic-floating-challenges']) {
      const panel = this.element?.querySelector(`.${key}`);
      if (panel) this._makePanelDraggable(panel, key);
    }

    // Camera row (A/V feed mirroring)
    this._initCameraRow();
  }

  async _onClose(_options) {
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
    this.sidePanelOpen = false;
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
    this._lastChallengeCount = 0;
    return super._onClose(_options);
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

  static _onRelaunchForPlayers() {
    game.storyframe.socketManager.launchSceneMode();
    ui.notifications.info(game.i18n.localize('STORYFRAME.CinematicScene.Relaunched'));
  }

  static async _onSwitchSpeaker(_event, target) {
    const speakerId = target.closest('[data-speaker-id]')?.dataset.speakerId;
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
      this.render();
    }
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
      if (system === 'pf2e') {
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
    if (!this._savedTrackVolumes.size) return;
    // Group updates by playlist for batch efficiency
    const byPlaylist = new Map();
    for (const [key, vol] of this._savedTrackVolumes) {
      const [playlistId, soundId] = key.split(':');
      if (!byPlaylist.has(playlistId)) byPlaylist.set(playlistId, []);
      byPlaylist.get(playlistId).push({ _id: soundId, volume: vol });
    }
    for (const [playlistId, updates] of byPlaylist) {
      const playlist = game.playlists.get(playlistId);
      if (playlist) await playlist.updateEmbeddedDocuments('PlaylistSound', updates);
    }
    this._savedTrackVolumes.clear();
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
}
