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
      selectPage: GMInterfaceApp._onSelectPage,
      searchPages: GMInterfaceApp._onSearchPages,
      addSpeakerFromImage: GMInterfaceApp._onAddSpeakerFromImage,
      setSpeaker: GMInterfaceApp._onSetSpeaker,
      removeSpeaker: GMInterfaceApp._onRemoveSpeaker,
      clearSpeaker: GMInterfaceApp._onClearSpeaker
    }
  };

  static PARTS = {
    content: {
      template: 'modules/storyframe/templates/gm-interface.hbs',
      scrollable: ['.page-list', '.content-area', '.speaker-gallery']
    }
  };

  constructor(options = {}) {
    super(options);
    this.currentPageIndex = 0;
    this.pageSearchFilter = '';

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
        journals: [],
        selectedJournal: null,
        pages: [],
        currentPageIndex: 0,
        currentPageContent: null,
        currentPageName: null,
        speakers: [],
        activeSpeaker: null,
        hasSpeakers: false
      };
    }

    // Build journals array
    const journals = game.journal.map(journal => ({
      id: journal.uuid,
      name: journal.name
    }));

    let pages = [];
    let currentPageContent = null;
    let currentPageName = null;

    // Load pages from active journal
    if (state.activeJournal) {
      const journal = await fromUuid(state.activeJournal);
      if (journal) {
        // Support all page types (text, image, pdf, video)
        let allPages = journal.pages.map(p => ({
          name: p.name,
          type: p.type,
          _page: p
        }));

        // Apply page search filter
        if (this.pageSearchFilter) {
          const filter = this.pageSearchFilter.toLowerCase();
          allPages = allPages.filter(p => p.name.toLowerCase().includes(filter));
        }

        pages = allPages;

        // Get current page content
        if (pages.length > 0) {
          // Clamp page index
          this.currentPageIndex = Math.max(0, Math.min(this.currentPageIndex, pages.length - 1));

          const page = pages[this.currentPageIndex]._page;
          currentPageName = page.name;

          // Render content based on page type
          switch (page.type) {
            case 'text':
              currentPageContent = await TextEditor.enrichHTML(page.text.content, {
                async: true,
                secrets: game.user.isGM,
                documents: true,
                rolls: true
              });
              break;

            case 'image':
              if (page.src) {
                currentPageContent = `<img src="${page.src}" alt="${page.name}" style="max-width: 100%; height: auto;">`;
                if (page.image?.caption) {
                  currentPageContent += `<p class="caption">${page.image.caption}</p>`;
                }
              }
              break;

            case 'pdf':
              if (page.src) {
                currentPageContent = `<iframe src="${page.src}" style="width: 100%; height: 100%; min-height: 600px; border: none;"></iframe>`;
              }
              break;

            case 'video':
              if (page.src) {
                currentPageContent = `<video controls style="max-width: 100%; height: auto;"><source src="${page.src}"></video>`;
              }
              break;

            default:
              currentPageContent = `<p>Unsupported page type: ${page.type}</p>`;
          }
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
      pages,
      currentPageIndex: this.currentPageIndex,
      currentPageContent,
      currentPageName,
      speakers,
      activeSpeaker: state.activeSpeaker,
      hasSpeakers: speakers.length > 0
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this._attachJournalSelectorHandler();
    this._attachDragDropHandlers();
  }

  _attachJournalSelectorHandler() {
    const select = this.element.querySelector('#journal-selector');
    if (select) {
      select.addEventListener('change', async (e) => {
        const journalId = e.target.value;
        this.currentPageIndex = 0;
        this.pageSearchFilter = '';
        await game.storyframe.socketManager.requestSetActiveJournal(journalId || null);
      });
    }
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

  static async _onSelectPage(event, target) {
    const pageIndex = parseInt(target.dataset.pageIndex);
    if (!isNaN(pageIndex)) {
      this.currentPageIndex = pageIndex;
      this.render();
    }
  }

  static async _onSearchPages(event, target) {
    this.pageSearchFilter = target.value;
    this.currentPageIndex = 0; // Reset to first page when searching
    this.render();
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
}
