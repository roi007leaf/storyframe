const MODULE_ID = 'storyframe';

/**
 * GM Interface for StoryFrame
 * Provides journal reading and speaker management controls
 */
export class GMInterfaceApp extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: 'storyframe-gm-interface',
    classes: ['storyframe', 'gm-interface'],
    window: {
      title: 'StoryFrame',
      icon: 'fas fa-book-open',
      resizable: true
    },
    position: {
      width: 900,
      height: 600
    },
    actions: {
      selectJournal: GMInterfaceApp._onSelectJournal,
      addSpeakerFromImage: GMInterfaceApp._onAddSpeakerFromImage,
      setSpeaker: GMInterfaceApp._onSetSpeaker,
      removeSpeaker: GMInterfaceApp._onRemoveSpeaker,
      clearSpeaker: GMInterfaceApp._onClearSpeaker,
      prevPage: GMInterfaceApp._onPrevPage,
      nextPage: GMInterfaceApp._onNextPage
    }
  };

  static PARTS = {
    content: {
      template: 'modules/storyframe/templates/gm-interface.hbs',
      scrollable: ['.journal-content', '.speaker-gallery']
    }
  };

  constructor(options = {}) {
    super(options);
    this.currentPageIndex = 0;

    // Load saved position
    const savedPosition = game.settings.get(MODULE_ID, 'gmWindowPosition');
    if (savedPosition && Object.keys(savedPosition).length > 0) {
      this.position = { ...this.position, ...savedPosition };
    }
  }

  async _prepareContext(options) {
    const state = game.storyframe.stateManager.getState();
    if (!state) {
      return {
        journals: {},
        selectedJournal: null,
        journalContent: null,
        speakers: [],
        activeSpeaker: null,
        hasSpeakers: false,
        hasMultiplePages: false,
        currentPage: 0,
        totalPages: 0,
        hasPrevPage: false,
        hasNextPage: false
      };
    }

    // Build journals object
    const journals = {};
    game.journal.forEach(journal => {
      journals[journal.uuid] = journal.name;
    });

    let journalContent = null;
    let pages = [];
    let hasMultiplePages = false;
    let currentPage = 0;
    let totalPages = 0;
    let hasPrevPage = false;
    let hasNextPage = false;

    // Load active journal content
    if (state.activeJournal) {
      const journal = await fromUuid(state.activeJournal);
      if (journal) {
        pages = journal.pages.filter(p => p.type === 'text');
        totalPages = pages.length;

        if (totalPages > 0) {
          // Clamp page index
          this.currentPageIndex = Math.max(0, Math.min(this.currentPageIndex, totalPages - 1));

          const page = pages[this.currentPageIndex];
          journalContent = await TextEditor.enrichHTML(page.text.content, {
            async: true,
            secrets: game.user.isGM,
            documents: true,
            rolls: true
          });

          hasMultiplePages = totalPages > 1;
          currentPage = this.currentPageIndex + 1;
          hasPrevPage = this.currentPageIndex > 0;
          hasNextPage = this.currentPageIndex < totalPages - 1;
        }
      }
    }

    // Resolve speakers
    const speakers = await Promise.all(
      state.speakers.map(async speaker => {
        const resolved = await game.storyframe.stateManager.resolveSpeaker(speaker);
        const result = {
          id: speaker.id,
          img: resolved.img,
          name: resolved.name
        };

        // Check if actor was deleted
        if (speaker.actorUuid) {
          const actor = await fromUuid(speaker.actorUuid);
          if (!actor) {
            result.actorDeleted = true;
          }
        }

        return result;
      })
    );

    return {
      journals,
      selectedJournal: state.activeJournal,
      journalContent,
      speakers,
      activeSpeaker: state.activeSpeaker,
      hasSpeakers: speakers.length > 0,
      hasMultiplePages,
      currentPage,
      totalPages,
      hasPrevPage,
      hasNextPage
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this._attachResizeHandler();
    this._attachDragDropHandlers();
  }

  _attachResizeHandler() {
    const resizer = this.element.querySelector('.resize-handle');
    const journalPane = this.element.querySelector('.journal-pane');
    const container = this.element.querySelector('.split-container');

    if (!resizer || !journalPane || !container) return;

    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
      isResizing = true;
      document.body.style.cursor = 'col-resize';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;

      const containerRect = container.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;
      const minWidth = 250;
      const maxWidth = containerRect.width - 250;

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        journalPane.style.width = `${newWidth}px`;
      }
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = 'default';
      }
    });
  }

  _attachDragDropHandlers() {
    const gallery = this.element.querySelector('.speaker-gallery');
    if (!gallery) return;

    gallery.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      gallery.classList.add('drag-over');
    });

    gallery.addEventListener('dragleave', (e) => {
      if (e.target === gallery) {
        gallery.classList.remove('drag-over');
      }
    });

    gallery.addEventListener('drop', async (e) => {
      e.preventDefault();
      gallery.classList.remove('drag-over');

      const data = TextEditor.getDragEventData(e);

      if (data.type === 'Actor') {
        const actor = await fromUuid(data.uuid);
        if (actor) {
          await game.storyframe.socketManager.requestAddSpeaker({
            actorUuid: data.uuid,
            label: actor.name
          });
        }
      }
    });
  }

  async _onClose(options) {
    // Save window position
    await game.settings.set(MODULE_ID, 'gmWindowPosition', {
      top: this.position.top,
      left: this.position.left,
      width: this.position.width,
      height: this.position.height
    });

    return super._onClose(options);
  }

  // --- Action Handlers ---

  static async _onSelectJournal(event, target) {
    const value = target.value;
    this.currentPageIndex = 0;
    await game.storyframe.socketManager.requestSetActiveJournal(value || null);
  }

  static async _onAddSpeakerFromImage(event, target) {
    new FilePicker({
      type: 'image',
      callback: async (path) => {
        const label = await Dialog.prompt({
          title: 'Speaker Name',
          content: '<input type="text" name="label" placeholder="Enter speaker name" autofocus>',
          callback: (html) => html.querySelector('[name="label"]').value,
          rejectClose: false
        });

        if (label) {
          await game.storyframe.socketManager.requestAddSpeaker({
            imagePath: path,
            label
          });
        }
      }
    }).render(true);
  }

  static async _onSetSpeaker(event, target) {
    const speakerId = target.closest('[data-speaker-id]')?.dataset.speakerId;
    if (speakerId) {
      await game.storyframe.socketManager.requestSetActiveSpeaker(speakerId);
    }
  }

  static async _onRemoveSpeaker(event, target) {
    event.stopPropagation();

    const speakerId = target.closest('[data-speaker-id]')?.dataset.speakerId;
    if (!speakerId) return;

    const confirmed = await Dialog.confirm({
      title: 'Remove Speaker',
      content: '<p>Remove this speaker from the gallery?</p>',
      defaultYes: false
    });

    if (confirmed) {
      await game.storyframe.socketManager.requestRemoveSpeaker(speakerId);
    }
  }

  static async _onClearSpeaker(event, target) {
    await game.storyframe.socketManager.requestSetActiveSpeaker(null);
  }

  static async _onPrevPage(event, target) {
    if (this.currentPageIndex > 0) {
      this.currentPageIndex--;
      this.render();
    }
  }

  static async _onNextPage(event, target) {
    const state = game.storyframe.stateManager.getState();
    if (state?.activeJournal) {
      const journal = await fromUuid(state.activeJournal);
      if (journal) {
        const pages = journal.pages.filter(p => p.type === 'text');
        if (this.currentPageIndex < pages.length - 1) {
          this.currentPageIndex++;
          this.render();
        }
      }
    }
  }
}
