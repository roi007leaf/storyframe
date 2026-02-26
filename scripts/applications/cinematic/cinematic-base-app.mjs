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
    this._prevSpeakerKey = '';
    this._prevActiveKey = '';
    this._prevParticipantKey = '';
    this._prevSpeakerFlagsKey = '';
    this._prevBackgroundKey = '';
    this._debouncedRender = foundry.utils.debounce(() => this.render(), 150);
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
    const pcRow = partyPCs.map(p => ({ actorUuid: p.actorUuid, name: p.name, img: p.img }));

    return {
      isGM,
      activeSpeaker,
      activeSpeakerId,
      inactiveSpeakers,
      allSpeakers,
      pcRow,
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

    const speakerKey = game.user.isGM
      ? (state.speakers || []).map(s => `${s.id}:${s.imagePath}`).join('|')
      : (state.speakers || []).map(s => `${s.id}:${s.isHidden}:${s.imagePath}`).join('|');
    const speakerFlagsKey = game.user.isGM
      ? (state.speakers || []).map(s => `${s.id}:${s.isHidden}:${s.isNameHidden}`).join('|')
      : '';
    const activeKey = state.activeSpeaker || '';
    const participantKey = (state.participants || []).map(p => p.id).join(',');
    const backgroundKey = state.sceneBackground || '';

    const structuralChange = speakerKey !== this._prevSpeakerKey
      || activeKey !== this._prevActiveKey
      || participantKey !== this._prevParticipantKey
      || backgroundKey !== this._prevBackgroundKey;
    const flagsChanged = game.user.isGM && speakerFlagsKey !== this._prevSpeakerFlagsKey;

    this._prevSpeakerKey = speakerKey;
    this._prevSpeakerFlagsKey = speakerFlagsKey;
    this._prevActiveKey = activeKey;
    this._prevParticipantKey = participantKey;
    this._prevBackgroundKey = backgroundKey;

    if (structuralChange) {
      this.render();
    } else {
      this._onFlagsChanged?.(state, flagsChanged);
      this._refreshRollPanel();
    }
  }

  /** Override in subclasses for non-structural panel updates. */
  async _refreshRollPanel() { }

  // --- Shared render setup ---

  _onRender(_context, _options) {
    super._onRender(_context, _options);

    // Spotlight: hide until portrait image loaded (prevents layout-shift animation)
    const spotlightImg = this.element?.querySelector('.spotlight-portrait');
    const spotlight = spotlightImg?.closest('.cinematic-spotlight');
    if (spotlight && spotlightImg) {
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
      this._prevSpeakerKey = game.user.isGM
        ? (_seedState.speakers || []).map(s => `${s.id}:${s.imagePath}`).join('|')
        : (_seedState.speakers || []).map(s => `${s.id}:${s.isHidden}:${s.imagePath}`).join('|');
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
    game.storyframe.cinematicScene = null;
    document.getElementById('cinematic-context-menu')?.remove();
    this.rollPanelExpanded = false;
    this._lastPendingCount = 0;
    this.previewImageSrc = null;
    this._prevSpeakerKey = '';
    this._prevActiveKey = '';
    this._prevParticipantKey = '';
    this._prevSpeakerFlagsKey = '';
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

    const npSection = this.element.querySelector('.music-now-playing');
    if (np && npSection) {
      npSection.querySelector('.now-playing-track').textContent = np.trackName;
      npSection.querySelector('.now-playing-playlist').textContent = np.playlistName;
      npSection.style.display = '';
    } else if (!np && npSection) {
      npSection.style.display = 'none';
    } else if (np && !npSection) {
      return this.render();
    }

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
      belowEl.style.flex = `0 0 ${Math.max(40, startBelowH - delta)}px`;
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

  // --- Chat management ---

  _populateChatLog(container) {
    container.innerHTML = '';
    const messages = game.messages.contents.slice(-10).filter(msg => msg.visible);
    Promise.all(messages.map(msg => msg.getHTML())).then(htmlElements => {
      if (!container.isConnected) return;
      container.innerHTML = '';
      for (const html of htmlElements) {
        const el = html?.jquery ? html[0] : html;
        if (el) container.appendChild(el);
      }
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

    const doAppend = () => {
      if (!container.isConnected) return;
      msg.getHTML().then(html => {
        const el = html?.jquery ? html[0] : html;
        const existing = container.querySelector(`.message[data-message-id="${msg.id}"]`);
        if (existing) existing.replaceWith(el);
        else container.appendChild(el);
        if (wasAtBottom || container.scrollHeight - container.scrollTop - container.clientHeight < 30) {
          container.scrollTop = container.scrollHeight;
        }
      });
    };

    doAppend();

    // DSN hooks renderChatMessage to hide roll elements during animation and only
    // un-hides the copy in #chat-log. Re-render our copy after animation completes.
    if (game.dice3d && msg.isRoll) {
      const dsnHookId = Hooks.on('diceSoNiceRollComplete', (messageId) => {
        if (messageId !== msg.id) return;
        Hooks.off('diceSoNiceRollComplete', dsnHookId);
        doAppend();
      });
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
}
