import { MODULE_ID } from '../../constants.mjs';
import { getAllPlayerPCs } from '../../system-adapter.mjs';

/**
 * Base class for Cinematic Scene apps.
 * Contains shared logic used by both CinematicGMApp and CinematicPlayerApp.
 */
export class CinematicSceneBase extends foundry.applications.api.HandlebarsApplicationMixin(
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
      openCharacterSheet: CinematicSceneBase._onOpenCharacterSheet,
      closeImagePreview: CinematicSceneBase._onCloseImagePreview,
      openPartySheet: CinematicSceneBase._onOpenPartySheet,
    },
  };

  constructor(options = {}) {
    super(options);
    this.rollPanelExpanded = false;
    this._lastPendingCount = 0;
    this.challengePanelExpanded = false;
    this.playerChatExpanded = false;
    this._lastChallengeCount = 0;
    this.previewImageSrc = null;
    this._prevSpeakerIdsKey = '';
    this._prevSpeakerPropsKey = '';
    this._prevActiveKey = '';
    this._prevParticipantKey = '';
    this._prevSpeakerFlagsKey = '';
    this._prevBackgroundKey = '';
    this._debouncedRender = foundry.utils.debounce(() => this.render(), 150);
    // Camera row (A/V feed mirroring)
    this._cameraObserver = null;
    this._cameraHookIds = [];
    this._trackedVideoStreams = new Map();
  }

  // --- Shared context (speakers + pcRow) ---

  async _prepareContext(_options) {
    const state = game.storyframe.stateManager?.getState();
    const isGM = game.user.isGM;

    if (!state) {
      return {
        isGM,
        activeSpeaker: null,
        activeSpeakerId: null,
        inactiveSpeakers: [],
        allSpeakers: [],
        pcRow: [],
        previewImageSrc: this.previewImageSrc,
        speakerControlsMode: 'hover',
      };
    }

    const visibleSpeakers = isGM
      ? state.speakers || []
      : (state.speakers || []).filter(s => !s.isHidden);
    const allSpeakers = await this._resolveSpeakers(visibleSpeakers);
    const activeSpeakerId = state.activeSpeaker;

    let activeSpeaker = null;
    let inactiveSpeakers = allSpeakers;
    if (activeSpeakerId) {
      activeSpeaker = allSpeakers.find(s => s.id === activeSpeakerId) || null;
      inactiveSpeakers = allSpeakers.filter(s => s.id !== activeSpeakerId);
    }

    const partyPCs = await getAllPlayerPCs();
    const pcRow = partyPCs.map(p => ({ actorUuid: p.actorUuid, name: p.name, img: p.img, userId: p.userId }));

    // PF2e party sheet availability
    const partyActor = game.system.id === 'pf2e'
      ? game.actors.find(a => a.type === 'party')
      : null;

    return {
      isGM,
      activeSpeaker,
      activeSpeakerId,
      inactiveSpeakers,
      allSpeakers,
      pcRow,
      hasPartySheet: !!partyActor,
      previewImageSrc: this.previewImageSrc,
      speakerControlsMode: game.settings.get(MODULE_ID, 'speakerControlsMode') ?? 'hover',
      sceneBackground: state.sceneBackground || null,
    };
  }

  // --- State change detection (shared) ---

  async _onStateChange() {
    if (!this.rendered) return;
    const state = game.storyframe.stateManager?.getState();
    if (!state) return;

    // Structural change = speakers added/removed, participants changed, or
    // background changed.  Only compare speaker IDs (not mutable properties
    // like label/imagePath) because those can differ between scene-flag reads
    // and socket broadcasts, causing false-positive full re-renders.
    const speakerIdsKey = (state.speakers || []).map(s => s.id).join('|');
    const speakerFlagsKey = game.user.isGM
      ? (state.speakers || []).map(s => `${s.id}:${!!s.isHidden}:${!!s.isNameHidden}`).join('|')
      : '';
    // Detect speaker property changes (label, image) separately — these need
    // a re-render but should only fire when the values genuinely change.
    const speakerPropsKey = (state.speakers || []).map(s => `${s.id}:${s.label ?? ''}:${s.imagePath ?? ''}`).join('|');
    const activeKey = state.activeSpeaker || '';
    const participantKey = (state.participants || []).map(p => p.id).join(',');
    const backgroundKey = state.sceneBackground ?? '';

    const speakerListChanged = speakerIdsKey !== this._prevSpeakerIdsKey;
    const speakerPropsChanged = speakerPropsKey !== this._prevSpeakerPropsKey;
    const activeChanged = activeKey !== this._prevActiveKey;
    const participantsChanged = participantKey !== this._prevParticipantKey;
    const backgroundChanged = backgroundKey !== this._prevBackgroundKey;
    const flagsChanged = game.user.isGM && speakerFlagsKey !== this._prevSpeakerFlagsKey;

    // Heavy structural change — full re-render
    const structuralChange = speakerListChanged || participantsChanged || backgroundChanged;

    this._prevSpeakerIdsKey = speakerIdsKey;
    this._prevSpeakerPropsKey = speakerPropsKey;
    this._prevSpeakerFlagsKey = speakerFlagsKey;
    this._prevActiveKey = activeKey;
    this._prevParticipantKey = participantKey;
    this._prevBackgroundKey = backgroundKey;

    if (structuralChange) {
      this.render();
    } else if (activeChanged) {
      // Active speaker switch — targeted DOM update (no full re-render)
      await this._swapActiveSpeaker(state);
      this._onFlagsChanged?.(state, flagsChanged);
      this._refreshRollPanel();
    } else {
      // Speaker property changes (name/image edits) — patch DOM in place
      if (speakerPropsChanged) this._patchSpeakerProps(state);
      this._onFlagsChanged?.(state, flagsChanged);
      this._refreshRollPanel();
    }
  }

  /**
   * Targeted DOM update for active speaker switch (avoids full re-render).
   */
  async _swapActiveSpeaker(state) {
    const container = this.element?.querySelector('.cinematic-scene-container');
    if (!container) return;

    const isGM = game.user.isGM;
    const visibleSpeakers = isGM
      ? state.speakers || []
      : (state.speakers || []).filter(s => !s.isHidden);
    const allResolved = await this._resolveSpeakers(visibleSpeakers);
    const newActiveId = state.activeSpeaker || '';
    const newActive = newActiveId ? allResolved.find(s => s.id === newActiveId) : null;
    const inactives = newActiveId ? allResolved.filter(s => s.id !== newActiveId) : allResolved;

    // --- Update spotlight ---
    const oldSpotlight = container.querySelector('.cinematic-spotlight');
    const _oldNoActive = container.querySelector('.cinematic-no-active');

    if (newActive) {
      if (oldSpotlight) {
        // Update existing spotlight in place
        oldSpotlight.dataset.speakerId = newActive.id;
        const portrait = oldSpotlight.querySelector('.spotlight-portrait');
        if (portrait) { portrait.src = newActive.img; portrait.alt = newActive.name; }
        const nameText = oldSpotlight.querySelector('.nameplate-text');
        if (nameText) nameText.textContent = newActive.name;
        // Update visibility button
        const nameplate = oldSpotlight.querySelector('.spotlight-nameplate');
        if (nameplate) nameplate.classList.toggle('name-is-hidden', !!newActive.isNameHidden);
        const visBtn = oldSpotlight.querySelector('.spotlight-visibility-btn');
        if (visBtn) {
          visBtn.dataset.speakerId = newActive.id;
          visBtn.dataset.tooltip = newActive.isNameHidden
            ? game.i18n.localize('STORYFRAME.CinematicScene.ShowName')
            : game.i18n.localize('STORYFRAME.CinematicScene.HideName');
          const icon = visBtn.querySelector('i');
          if (icon) icon.className = `fas ${newActive.isNameHidden ? 'fa-eye' : 'fa-eye-slash'}`;
        }
        // Update counter
        this._updateCounterDisplay?.(newActive.id);
      } else {
        // Was "no active" or image preview — need full re-render
        return this.render();
      }
    } else {
      // Deselected — swap spotlight for no-active placeholder (avoids full re-render
      // which would tear down camera row and cause video feed flicker)
      if (oldSpotlight) {
        const noActive = document.createElement('div');
        noActive.className = 'cinematic-no-active';
        noActive.innerHTML = '<i class="fas fa-masks-theater" aria-hidden="true"></i>';
        oldSpotlight.replaceWith(noActive);
      }
      // Hide the "Deselect Speaker" button in GM side panel
      const deactivateBtn = container.querySelector('.side-panel-deactivate-btn');
      if (deactivateBtn) deactivateBtn.closest('.side-panel-section')?.remove();
    }

    // --- Update filmstrip ---
    const filmstrip = container.querySelector('.cinematic-filmstrip');
    const filmstripContainer = container.querySelector('.cinematic-filmstrip-container');

    if (filmstrip && inactives.length > 0) {
      // Check if all inactive speakers have filmstrip cards — if any are missing
      // (e.g. the previously-active speaker that was in the spotlight, not in filmstrip),
      // fall back to a full re-render so the card gets created.
      const filmstripIds = new Set(
        [...filmstrip.querySelectorAll('.filmstrip-speaker')].map(c => c.dataset.speakerId),
      );
      if (!inactives.every(s => filmstripIds.has(s.id))) {
        return this.render();
      }

      // All cards present — just toggle visibility
      for (const card of filmstrip.querySelectorAll('.filmstrip-speaker')) {
        const id = card.dataset.speakerId;
        card.style.display = (id === newActiveId) ? 'none' : '';
      }
    }

    if (inactives.length > 0 && !filmstripContainer) {
      return this.render();
    }
    if (inactives.length === 0 && filmstripContainer) {
      filmstripContainer.style.display = 'none';
    } else if (filmstripContainer) {
      filmstripContainer.style.display = '';
    }
  }

  /**
   * Targeted DOM patch for speaker property changes (name/image edits).
   * Updates spotlight + filmstrip elements in place — avoids full re-render.
   */
  async _patchSpeakerProps(state) {
    const container = this.element?.querySelector('.cinematic-scene-container');
    if (!container) return;

    const isGM = game.user.isGM;
    const visibleSpeakers = isGM
      ? state.speakers || []
      : (state.speakers || []).filter(s => !s.isHidden);
    const resolved = await this._resolveSpeakers(visibleSpeakers);
    const byId = new Map(resolved.map(s => [s.id, s]));

    // Patch spotlight (active speaker)
    const spotlight = container.querySelector('.cinematic-spotlight');
    if (spotlight) {
      const s = byId.get(spotlight.dataset.speakerId);
      if (s) {
        const portrait = spotlight.querySelector('.spotlight-portrait');
        if (portrait && portrait.src !== s.img) { portrait.src = s.img; portrait.alt = s.name; }
        const nameText = spotlight.querySelector('.nameplate-text');
        if (nameText && nameText.textContent !== s.name) nameText.textContent = s.name;
      }
    }

    // Patch filmstrip cards (inactive speakers)
    for (const card of container.querySelectorAll('.filmstrip-speaker')) {
      const s = byId.get(card.dataset.speakerId);
      if (!s) continue;
      const img = card.querySelector('img');
      if (img && img.src !== s.img) { img.src = s.img; img.alt = s.name; }
      const nameEl = card.querySelector('.filmstrip-name');
      if (nameEl && nameEl.textContent !== s.name) nameEl.textContent = s.name;
      if (card.dataset.tooltip !== s.name) card.dataset.tooltip = s.name;
    }
  }

  /** Override in subclasses for non-structural panel updates. */
  async _refreshRollPanel() { }

  // --- Shared render setup ---

  async _preRender(_context, _options) {
    await super._preRender(_context, _options);
    // Save a reference to the current chat container so _populateChatLog can
    // swap it back in after ApplicationV2 replaces the DOM.  Do NOT remove()
    // the node here — that would flash an empty space if the template render
    // (between _preRender and _replaceHTML) yields to the paint loop.
    const chat = this.element?.querySelector('.side-panel-chat-messages')
      ?? this.element?.querySelector('.player-chat-messages');
    if (chat?.dataset.populated) {
      this._savedChatNode = chat;
      this._savedChatScroll = chat.scrollTop;
    }
  }

  _onRender(_context, _options) {
    super._onRender(_context, _options);

    // Skip intro animations on re-renders (not the first open)
    if (this._introComplete) {
      this.element?.classList.add('skip-intro');
    } else {
      // Collapse Foundry's sidebar on first render so it doesn't peek through
      if (ui.sidebar && !ui.sidebar._collapsed) {
        this._sidebarWasOpen = true;
        ui.sidebar.collapse();
      }
      // Close StoryFrame's own sidebar (GM or player) while cinematic is open
      const sfSidebar = game.user.isGM ? game.storyframe.gmSidebar : game.storyframe.playerSidebar;
      if (sfSidebar?.rendered) {
        this._sfSidebarWasOpen = true;
        sfSidebar.close();
      }
      // Mark intro as complete after the first render's animation finishes
      const onIntroEnd = () => { this._introComplete = true; };
      setTimeout(onIntroEnd, 1200);
    }

    // Spotlight: hide until portrait image loaded (prevents layout-shift animation)
    const spotlightImg = this.element?.querySelector('.spotlight-portrait');
    const spotlight = spotlightImg?.closest('.cinematic-spotlight');
    if (spotlight && spotlightImg) {
      if (this._introComplete) {
        // On re-render, just wait for the image — no animation dance
        if (!spotlightImg.complete || spotlightImg.naturalHeight === 0) {
          spotlight.style.visibility = 'hidden';
          const show = () => { spotlight.style.visibility = ''; };
          spotlightImg.addEventListener('load', show, { once: true });
          spotlightImg.addEventListener('error', show, { once: true });
        }
      } else {
        spotlight.style.visibility = 'hidden';
        spotlight.style.animationName = 'none';
        const showSpotlight = () => {
          spotlight.style.visibility = '';
          spotlight.style.animationName = '';
          void spotlight.offsetWidth;
        };
        if (spotlightImg.complete && spotlightImg.naturalHeight > 0) {
          showSpotlight();
        } else {
          spotlightImg.addEventListener('load', showSpotlight, { once: true });
          spotlightImg.addEventListener('error', showSpotlight, { once: true });
        }
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

    // Seed state-change baseline
    const _seedState = game.storyframe.stateManager?.getState();
    if (_seedState) {
      this._prevSpeakerIdsKey = (_seedState.speakers || []).map(s => s.id).join('|');
      this._prevSpeakerPropsKey = (_seedState.speakers || []).map(s => `${s.id}:${s.label ?? ''}:${s.imagePath ?? ''}`).join('|');
      this._prevSpeakerFlagsKey = game.user.isGM
        ? (_seedState.speakers || []).map(s => `${s.id}:${s.isHidden}:${s.isNameHidden}`).join('|')
        : '';
      this._prevActiveKey = _seedState.activeSpeaker || '';
      this._prevParticipantKey = (_seedState.participants || []).map(p => p.id).join(',');
      this._prevBackgroundKey = _seedState.sceneBackground || '';
    }
  }

  // --- Shared cleanup ---

  async _onClose(_options) {
    this._introComplete = false;
    this._teardownCameraRow();
    game.storyframe.cinematicScene = null;
    document.getElementById('cinematic-context-menu')?.remove();
    this.rollPanelExpanded = false;
    this._lastPendingCount = 0;
    this.previewImageSrc = null;
    this._prevSpeakerIdsKey = '';
    this._prevSpeakerPropsKey = '';
    this._prevActiveKey = '';
    this._prevParticipantKey = '';
    this._prevSpeakerFlagsKey = '';
    this._prevBackgroundKey = '';
    // Restore Foundry's sidebar if we collapsed it on open
    if (this._sidebarWasOpen && ui.sidebar?._collapsed) {
      ui.sidebar.expand();
      this._sidebarWasOpen = false;
    }
    // Restore StoryFrame's own sidebar if we closed it on open
    if (this._sfSidebarWasOpen) {
      const sfSidebar = game.user.isGM ? game.storyframe.gmSidebar : game.storyframe.playerSidebar;
      sfSidebar?.render(true);
      this._sfSidebarWasOpen = false;
    }
    return super._onClose(_options);
  }

  // --- Speaker resolution ---

  async _resolveSpeakers(speakers) {
    return Promise.all(speakers.map(s => this._resolveSpeaker(s)));
  }

  async _resolveSpeaker(speaker) {
    let name, img;

    if (speaker.actorUuid) {
      const actor = await fromUuid(speaker.actorUuid);
      if (actor) {
        img = speaker.imagePath || actor.img;
        name = speaker.label || actor.name;
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

  // --- Utilities ---

  _getSkillIcon(slug) {
    const iconMap = {
      // PF2e skills
      per: 'fa-eye', acr: 'fa-person-running', arc: 'fa-wand-sparkles',
      ath: 'fa-dumbbell', cra: 'fa-hammer', dec: 'fa-mask',
      dip: 'fa-handshake', itm: 'fa-fist-raised', med: 'fa-kit-medical',
      nat: 'fa-leaf', occ: 'fa-book-skull', prf: 'fa-music',
      rel: 'fa-cross', soc: 'fa-users', ste: 'fa-user-secret',
      sur: 'fa-compass', thi: 'fa-hand-holding',
      // D&D 5e skills
      ani: 'fa-paw', his: 'fa-scroll', ins: 'fa-lightbulb',
      inv: 'fa-search', prc: 'fa-eye', slt: 'fa-hand-sparkles',
      // PF2e saves
      fort: 'fa-shield-halved', ref: 'fa-bolt', will: 'fa-brain',
      // D&D 5e ability saves
      str: 'fa-dumbbell', dex: 'fa-person-running', con: 'fa-heart',
      int: 'fa-book', wis: 'fa-eye', cha: 'fa-star',
    };
    return iconMap[slug] || 'fa-dice-d20';
  }

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

  /** Targeted DOM update for music state */
  _updateMusicDisplay() {
    if (!this.element) return;
    const np = this._getNowPlaying();

    // Check if the set of playing tracks changed — if so, full re-render
    const npSection = this.element.querySelector('.music-now-playing');
    const currentRows = npSection ? [...npSection.querySelectorAll('.now-playing-track-row')] : [];
    const currentIds = new Set(currentRows.map(r => `${r.dataset.playlistId}:${r.dataset.soundId}`));
    const actualIds = new Set();
    for (const p of game.playlists) {
      for (const s of p.sounds) {
        if (s.playing) actualIds.add(`${p.id}:${s.id}`);
      }
    }
    const setsEqual = currentIds.size === actualIds.size && [...currentIds].every(id => actualIds.has(id));
    if (!setsEqual) return this.render();

    // Sync volume sliders and repeat buttons in now-playing section
    currentRows.forEach(row => {
      const sound = game.playlists.get(row.dataset.playlistId)?.sounds.get(row.dataset.soundId);
      const volSlider = row.querySelector('.track-volume-slider');
      if (volSlider && sound) volSlider.value = sound.volume;
      const repeatBtn = row.querySelector('.track-repeat-btn');
      if (repeatBtn && sound) repeatBtn.classList.toggle('active', sound.repeat === true);
    });

    const ppIcon = this.element.querySelector('[data-action="musicPlayPause"] i');
    if (ppIcon) ppIcon.className = `fas ${np ? 'fa-pause' : 'fa-play'}`;

    const shuffleBtn = this.element.querySelector('[data-action="musicShuffle"]');
    const repeatBtn = this.element.querySelector('[data-action="musicRepeat"]');
    if (np) {
      const pl = game.playlists.get(np.playlistId);
      const sound = pl?.sounds.get(np.soundId);
      shuffleBtn?.classList.toggle('active', pl?.mode === CONST.PLAYLIST_MODES.SHUFFLE);
      repeatBtn?.classList.toggle('active', sound?.repeat === true);
      const vol = this.element.querySelector('.cinematic-music-volume');
      if (vol && sound) vol.value = sound.volume;
    } else {
      shuffleBtn?.classList.remove('active');
      repeatBtn?.classList.remove('active');
    }

    this.element.querySelectorAll('.left-panel-playlist-item').forEach(el => {
      const plId = el.querySelector('[data-playlist-id]')?.dataset.playlistId
        || el.querySelector('.playlist-expand-btn')?.dataset.playlistId;
      if (plId) {
        const pl = game.playlists.get(plId);
        el.classList.toggle('playing', pl?.playing === true);
      }
    });

    this.element.querySelectorAll('.left-panel-track-item').forEach(el => {
      const soundId = el.dataset.soundId;
      const playlistId = el.dataset.playlistId;
      if (!soundId || !playlistId) return;
      const sound = game.playlists.get(playlistId)?.sounds.get(soundId);
      const icon = el.querySelector('i');
      if (icon) icon.className = `fas ${sound?.playing ? 'fa-pause' : 'fa-play'}`;
      el.classList.toggle('playing', sound?.playing === true);
    });

    this.element.querySelectorAll('.music-search-results .left-panel-track-item').forEach(el => {
      const soundId = el.dataset.soundId;
      const playlistId = el.dataset.playlistId;
      if (!soundId || !playlistId) return;
      const sound = game.playlists.get(playlistId)?.sounds.get(soundId);
      const icon = el.querySelector('i');
      if (icon) icon.className = `fas ${sound?.playing ? 'fa-pause' : 'fa-play'}`;
    });
  }

  // --- Section / panel resize drag ---

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
      aboveEl.style.flex = `0 0 ${Math.max(40, startAboveH + delta)}px`;
      belowEl.style.flex = `1 0 ${Math.max(40, startBelowH - delta)}px`;
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
    const saved = this._floatingPanelPositions[key];
    if (saved) {
      panel.style.left = `${saved.x}px`;
      panel.style.top = `${saved.y}px`;
      panel.style.right = 'auto';
    }

    panel.style.cursor = 'grab';

    const onMouseDown = (e) => {
      if (e.button !== 0) return;
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

  // --- Camera row (A/V feed mirroring) ---

  _initCameraRow() {
    const bottomRow = this.element?.querySelector('.cinematic-bottom-row');
    if (!bottomRow) return;

    this._teardownCameraRow();

    // Apply saved feed size — set on container so :has() reserve calc can read it
    const container = this.element?.querySelector('.cinematic-scene-container');
    const savedSize = game.settings.get(MODULE_ID, 'cinematicCameraFeedSize') || 140;
    container?.style.setProperty('--camera-feed-width', `${savedSize}px`);

    // Add resize handle for camera feeds
    const handle = document.createElement('div');
    handle.className = 'camera-row-resize-handle';
    bottomRow.appendChild(handle);
    handle.addEventListener('mousedown', (e) => this._onCameraRowResizeStart(e, bottomRow));

    this._syncCameraFeeds();

    this._debouncedCameraSync = foundry.utils.debounce(() => this._syncCameraFeeds(), 300);

    this._cameraHookIds = [
      { hook: 'rtcSettingsChanged', id: Hooks.on('rtcSettingsChanged', () => this._debouncedCameraSync()) },
      { hook: 'renderCameraViews', id: Hooks.on('renderCameraViews', () => this._debouncedCameraSync()) },
    ];

    const cameraViews = document.getElementById('camera-views');
    if (cameraViews) {
      this._cameraObserver = new MutationObserver(() => this._debouncedCameraSync());
      this._cameraObserver.observe(cameraViews, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style'],
      });
      // Remote WebRTC streams set video.srcObject (a JS property, not a DOM
      // attribute) so MutationObserver misses them.  Listen for video play
      // events which fire when a remote stream starts delivering frames.
      this._cameraPlayHandler = () => this._debouncedCameraSync();
      cameraViews.addEventListener('play', this._cameraPlayHandler, true);
      cameraViews.addEventListener('loadedmetadata', this._cameraPlayHandler, true);
    }
  }

  _onCameraRowResizeStart(e, cameraRow) {
    if (e.button !== 0) return;
    e.preventDefault();
    const container = cameraRow.closest('.cinematic-scene-container');
    const startY = e.clientY;
    const currentWidth = parseFloat(
      getComputedStyle(container || cameraRow).getPropertyValue('--camera-feed-width'),
    ) || 140;

    const onMove = (ev) => {
      // Dragging up = bigger, dragging down = smaller
      const delta = startY - ev.clientY;
      const newWidth = Math.max(80, Math.min(300, currentWidth + delta));
      container?.style.setProperty('--camera-feed-width', `${newWidth}px`);
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      const finalWidth = parseFloat(
        getComputedStyle(container || cameraRow).getPropertyValue('--camera-feed-width'),
      ) || 140;
      game.settings.set(MODULE_ID, 'cinematicCameraFeedSize', finalWidth);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  _syncCameraFeeds() {
    const bottomRow = this.element?.querySelector('.cinematic-bottom-row');
    if (!bottomRow) return;

    const cameraViews = document.getElementById('camera-views');

    const activeCameras = [];
    if (cameraViews) {
      cameraViews.querySelectorAll('.camera-view').forEach(view => {
        const userId = view.dataset.user;
        if (!userId) return;
        const video = view.querySelector('video');
        if (!video?.srcObject) return;
        const videoTracks = video.srcObject.getVideoTracks();
        if (!videoTracks.length || !videoTracks.some(t => t.enabled)) return;
        const user = game.users.get(userId);
        if (!user) return;
        activeCameras.push({ userId, userName: user.name, stream: video.srcObject });
      });
    }

    const currentIds = new Set(activeCameras.map(c => c.userId));
    const trackedIds = new Set(this._trackedVideoStreams.keys());

    // Remove feeds no longer active
    for (const userId of trackedIds) {
      if (!currentIds.has(userId)) {
        const entry = this._trackedVideoStreams.get(userId);
        entry?.wrapper?.remove();
        this._trackedVideoStreams.delete(userId);
      }
    }

    // Add or update feeds
    for (const cam of activeCameras) {
      const existing = this._trackedVideoStreams.get(cam.userId);
      if (existing && existing.stream === cam.stream) continue;
      if (existing) {
        existing.video.srcObject = cam.stream;
        existing.stream = cam.stream;
        continue;
      }

      const wrapper = document.createElement('div');
      wrapper.className = 'camera-feed-item';
      wrapper.dataset.userId = cam.userId;
      wrapper.dataset.tooltip = cam.userName;

      const video = document.createElement('video');
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.srcObject = cam.stream;

      // Character sheet button (if user has a character)
      const user = game.users.get(cam.userId);
      const character = user?.character;

      const nameTag = document.createElement('span');
      nameTag.className = 'camera-feed-name';
      nameTag.textContent = character ? `${cam.userName}\\${character.name.split(' ')[0]}` : cam.userName;

      wrapper.appendChild(video);
      wrapper.appendChild(nameTag);
      if (character) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'camera-feed-sheet-btn';
        btn.dataset.action = 'openCharacterSheet';
        btn.dataset.actorUuid = character.uuid;
        btn.dataset.tooltip = character.name;
        const img = document.createElement('img');
        img.src = character.img;
        img.alt = character.name;
        btn.appendChild(img);
        wrapper.appendChild(btn);
      }

      bottomRow.appendChild(wrapper);
      this._trackedVideoStreams.set(cam.userId, { video, stream: cam.stream, wrapper });
    }

    // Hide PC items for users who have active camera feeds
    const activeUserIds = new Set(this._trackedVideoStreams.keys());
    for (const item of bottomRow.querySelectorAll('.cinematic-pc-item')) {
      const userId = item.dataset.userId;
      item.style.display = (userId && activeUserIds.has(userId)) ? 'none' : '';
    }

    // Hide entire row when empty (no feeds and no visible PC items)
    const hasFeeds = this._trackedVideoStreams.size > 0;
    const hasVisiblePCs = bottomRow.querySelector('.cinematic-pc-item:not([style*="display: none"])');
    bottomRow.classList.toggle('hidden', !hasFeeds && !hasVisiblePCs);
  }

  _teardownCameraRow() {
    if (this._cameraObserver) {
      this._cameraObserver.disconnect();
      this._cameraObserver = null;
    }
    if (this._cameraPlayHandler) {
      const cameraViews = document.getElementById('camera-views');
      cameraViews?.removeEventListener('play', this._cameraPlayHandler, true);
      cameraViews?.removeEventListener('loadedmetadata', this._cameraPlayHandler, true);
      this._cameraPlayHandler = null;
    }
    for (const { hook, id } of (this._cameraHookIds || [])) {
      Hooks.off(hook, id);
    }
    this._cameraHookIds = [];
    this._trackedVideoStreams?.clear();
  }

  // --- Chat management ---

  _populateChatLog(container) {
    // Re-attach the preserved DOM node from _preRender — zero-flash because
    // we swap the exact same elements back in, no async work needed.
    if (this._savedChatNode) {
      const scrollPos = this._savedChatScroll ?? 0;
      container.replaceWith(this._savedChatNode);
      // Browsers reset scrollTop when a node is re-inserted — restore it.
      this._savedChatNode.scrollTop = scrollPos;
      this._savedChatNode = null;
      this._savedChatScroll = null;
      return;
    }

    // First-time population — fetch messages asynchronously.
    container.innerHTML = '';
    const limit = game.settings.get(MODULE_ID, 'cinematicChatMessageLimit') || 10;
    const messages = game.messages.contents.filter(msg => msg.visible).slice(-limit);
    const renderMsg = msg => (msg.renderHTML ? msg.renderHTML() : msg.getHTML());
    Promise.all(messages.map(renderMsg)).then(htmlElements => {
      if (!container.isConnected) return;
      const fragment = document.createDocumentFragment();
      for (const html of htmlElements) {
        const el = html?.jquery ? html[0] : html;
        if (el) fragment.appendChild(el);
      }
      container.prepend(fragment);
      requestAnimationFrame(() => {
        if (container.isConnected) container.scrollTop = container.scrollHeight;
      });
    });
    this._bindChatContextMenu(container);
  }

  _bindChatContextMenu(container) {
    container.addEventListener('contextmenu', (e) => {
      const msgEl = e.target.closest('.message, .chat-message');
      if (!msgEl) return;
      e.preventDefault();
      e.stopPropagation();

      // Fetch lazily so we always get current options regardless of init order.
      // Try both v12 and v13 API paths.
      const raw = ui.chat?._getEntryContextOptions?.()
        ?? ui.chat?.constructor?._entryContextOptions?.()
        ?? [];
      if (!raw.length) return;

      document.getElementById('cinematic-context-menu')?.remove();

      const visible = raw.filter(opt => {
        if (!opt.condition) return true;
        try { return opt.condition(msgEl); } catch { return false; }
      });
      if (!visible.length) return;

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
        const iconHtml = opt.icon?.startsWith('<') ? opt.icon : `<i class="${opt.icon}" style="width:14px;text-align:center;"></i>`;
        li.innerHTML = `${iconHtml}${game.i18n.localize(opt.name)}`;
        li.addEventListener('mouseover', () => { li.style.background = 'rgba(94,129,172,0.2)'; });
        li.addEventListener('mouseout', () => { li.style.background = ''; });
        li.addEventListener('click', (ev) => {
          ev.stopPropagation();
          try { opt.callback(msgEl); } catch (err) { console.error('StoryFrame | context menu callback error', err); }
          menu.remove();
        });
        ol.appendChild(li);
      }

      menu.appendChild(ol);
      document.body.appendChild(menu);

      const rect = menu.getBoundingClientRect();
      if (rect.right > window.innerWidth) menu.style.left = `${window.innerWidth - rect.width - 8}px`;
      if (rect.bottom > window.innerHeight) menu.style.top = `${window.innerHeight - rect.height - 8}px`;

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

    const resolveContainer = () => {
      if (container.isConnected) return container;
      // Original container was replaced by a re-render — find the current one
      return this.element?.querySelector('.side-panel-chat-messages')
        ?? this.element?.querySelector('.player-chat-messages')
        ?? null;
    };

    const doAppend = () => {
      const target = resolveContainer();
      if (!target) return;
      (msg.renderHTML ? msg.renderHTML() : msg.getHTML()).then(html => {
        const cur = resolveContainer();
        if (!cur) return;
        const el = html?.jquery ? html[0] : html;
        if (!el) return;
        const existing = cur.querySelector(`.message[data-message-id="${msg.id}"], .chat-message[data-message-id="${msg.id}"]`);
        if (existing) existing.replaceWith(el);
        else cur.appendChild(el);
        // Trim oldest messages beyond the configured limit
        const limit = game.settings.get(MODULE_ID, 'cinematicChatMessageLimit') || 10;
        const allMessages = cur.querySelectorAll('.message, .chat-message');
        let excess = allMessages.length - limit;
        for (let i = 0; excess > 0 && i < allMessages.length; i++, excess--) {
          allMessages[i].remove();
        }
        if (wasAtBottom || cur.scrollHeight - cur.scrollTop - cur.clientHeight < 30) {
          cur.scrollTop = cur.scrollHeight;
        }
      }).catch(err => console.error('StoryFrame | cinematic chat append error', err));
    };

    // DSN hooks renderChatMessage to hide roll elements during animation, so
    // calling getHTML() now would give us a card with hidden results.  Defer
    // the render until after the animation completes to avoid a flash.
    if (game.dice3d && msg.isRoll) {
      const dsnHookId = Hooks.on('diceSoNiceRollComplete', (messageId) => {
        if (messageId !== msg.id) return;
        Hooks.off('diceSoNiceRollComplete', dsnHookId);
        doAppend();
      });
    } else {
      doAppend();
    }
  }


  // --- HTML builders for roll/challenge panels ---

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
          const locked = so.canRoll === false;
          html += `<button type="button" class="cinematic-roll-btn${locked ? ' proficiency-locked' : ''}" data-action="selectChallengeOption"`;
          html += ` data-skill="${so.skill}" data-check-type="${so.checkType}" data-dc="${so.dc}"`;
          html += ` data-action-slug="${so.action}" data-action-variant="${so.actionVariant}" data-is-secret="${so.isSecret}"`;
          if (locked) html += ` disabled`;
          html += `>`;
          if (locked) html += `<i class="fas fa-lock proficiency-lock-icon" aria-hidden="true"></i>`;
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

  // --- Shared static actions ---

  static async _onOpenCharacterSheet(_event, target) {
    const { actorUuid } = target.dataset;
    if (!actorUuid) return;
    const actor = await fromUuid(actorUuid);
    actor?.sheet?.render(true);
  }

  static _onCloseImagePreview() {
    this.previewImageSrc = null;
    this.render();
  }

  static _onOpenPartySheet() {
    const party = game.actors.find(a => a.type === 'party');
    party?.sheet?.render(true);
  }
}
