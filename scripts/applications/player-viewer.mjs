const MODULE_ID = 'storyframe';

/**
 * Player Viewer for StoryFrame
 * Gallery view showing ALL speakers with active highlight
 */
export class PlayerViewerApp extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: 'storyframe-player-viewer',
    classes: ['storyframe', 'player-viewer'],
    window: {
      title: 'StoryFrame',
      resizable: true,
      minimizable: true,
      icon: 'fas fa-book-open'
    },
    position: {
      width: 400,
      height: 300
    },
    actions: {}
  };

  static PARTS = {
    content: {
      template: 'modules/storyframe/templates/player-viewer.hbs'
    }
  };

  static HEADER_ACTIONS = {
    toggleLayout: {
      icon: 'fas fa-th',
      label: 'Toggle Layout',
      onclick: function() {
        this._onToggleLayout();
      }
    }
  };

  constructor(options = {}) {
    super(options);

    // Load saved position
    const savedPosition = game.settings.get(MODULE_ID, 'playerViewerPosition');
    if (savedPosition && Object.keys(savedPosition).length > 0) {
      this.position = { ...this.position, ...savedPosition };
    }
  }

  async _prepareContext(options) {
    const state = game.storyframe.stateManager.getState();
    const layout = game.settings.get(MODULE_ID, 'playerViewerLayout') || 'grid';

    // No speakers - show empty state
    if (!state?.speakers || state.speakers.length === 0) {
      return { empty: true, layout };
    }

    // Resolve ALL speakers
    const speakers = await this._resolveSpeakers(state.speakers);

    return {
      speakers,
      activeSpeakerId: state.activeSpeaker,
      layout,
      empty: false
    };
  }

  async _resolveSpeakers(speakers) {
    return Promise.all(speakers.map(s => this._resolveSpeaker(s)));
  }

  async _resolveSpeaker(speaker) {
    if (speaker.actorUuid) {
      const actor = await fromUuid(speaker.actorUuid);
      if (actor) {
        return {
          id: speaker.id,
          img: actor.img,
          name: actor.name
        };
      } else {
        // Actor deleted - use fallback
        return {
          id: speaker.id,
          img: 'icons/svg/mystery-man.svg',
          name: speaker.label || 'Unknown'
        };
      }
    } else {
      // Custom image path
      return {
        id: speaker.id,
        img: speaker.imagePath || 'icons/svg/mystery-man.svg',
        name: speaker.label
      };
    }
  }

  async _onToggleLayout() {
    const current = game.settings.get(MODULE_ID, 'playerViewerLayout') || 'grid';
    const layouts = ['grid', 'list', 'horizontal'];
    const currentIndex = layouts.indexOf(current);
    const nextLayout = layouts[(currentIndex + 1) % layouts.length];

    await game.settings.set(MODULE_ID, 'playerViewerLayout', nextLayout);
    this.render();
  }

  async _onClose(options) {
    // Save window position
    await game.settings.set(MODULE_ID, 'playerViewerPosition', {
      top: this.position.top,
      left: this.position.left,
      width: this.position.width,
      height: this.position.height
    });

    return super._onClose(options);
  }
}
