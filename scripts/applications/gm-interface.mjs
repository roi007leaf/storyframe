const MODULE_ID = 'storyframe';

import { CSSScraper } from '../css-scraper.mjs';

// Inline validatePosition (avoids import issues with ESModule side-effect pattern)
function validatePosition(saved) {
  return {
    top: Math.max(0, Math.min(saved.top || 0, window.innerHeight - 50)),
    left: Math.max(0, Math.min(saved.left || 0, window.innerWidth - 100)),
    width: Math.max(200, Math.min(saved.width || 400, window.innerWidth)),
    height: Math.max(150, Math.min(saved.height || 300, window.innerHeight))
  };
}

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

  static HEADER_ACTIONS = {
    editJournal: {
      icon: 'fas fa-edit',
      label: 'Edit Journal',
      onclick: function() {
        this._onEditJournal();
      }
    }
  };

  static PARTS = {
    content: {
      template: 'modules/storyframe/templates/gm-interface.hbs',
      scrollable: ['.page-list', '.journal-entry-pages .scrollable', '.speaker-gallery']
    }
  };

  constructor(options = {}) {
    super(options);
    this.currentPageIndex = 0;
    this.pageSearchFilter = '';
    this._stateRestored = false;
    this.cssScraper = new CSSScraper();
    this.styleElement = null;

    // Load saved position with validation
    const savedPosition = game.settings.get(MODULE_ID, 'gmWindowPosition');
    if (savedPosition && Object.keys(savedPosition).length > 0) {
      this.position = { ...this.position, ...validatePosition(savedPosition) };
    }
  }

  async _prepareContext(options) {
    const state = game.storyframe.stateManager.getState();
    if (!state) {
      return {
        containerClasses: '',
        journals: [],
        selectedJournal: null,
        pages: [],
        currentPageIndex: 0,
        currentPageContent: null,
        currentPageName: null,
        pageType: 'text',
        pageLevel: null,
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
    let pageType = 'text'; // Default to text
    let pageLevel = null;
    let containerClasses = ''; // System/module-specific classes only

    // Load pages from active journal
    if (state.activeJournal) {
      const journal = await fromUuid(state.activeJournal);
      if (journal) {
        // Extract system-specific classes from journal sheet root element
        // (pf2e-bb, dnd5e, etc. are on the root .app element, not inner container)
        if (journal.sheet?.element?.[0]) {
          const rootClasses = journal.sheet.element.attr('class');
          console.log('StoryFrame | Root element classes:', rootClasses);
          // Extract only system/module classes (pf2e-bb, etc.)
          // Filter out Foundry framework classes
          const allClasses = rootClasses.split(' ');
          console.log('StoryFrame | All classes array:', allClasses);
          const systemClass = allClasses.find(cls =>
            cls.startsWith('pf2e') || cls.startsWith('dnd5e') || cls.startsWith('swade') ||
            (cls.includes('-') && !cls.startsWith('window') && !cls.startsWith('journal') && !cls.startsWith('app'))
          );
          console.log('StoryFrame | Found system class:', systemClass);
          if (systemClass) {
            containerClasses = systemClass;
            console.log('StoryFrame | Extracted container classes from sheet:', containerClasses);
          }
        }

        // Fallback: build classes manually if not extracted from sheet
        if (!containerClasses) {
          // Start with system ID
          containerClasses = game.system.id;

          // Add module-specific suffixes
          if (game.modules.get('pf2e-beginner-box')?.active) {
            containerClasses += '-bb';
          }

          console.log('StoryFrame | Built container classes:', containerClasses);
        }
        // Support all page types (text, image, pdf, video)
        // Sort by page.sort property to match native journal order
        let allPages = journal.pages.contents
          .sort((a, b) => (a.sort || 0) - (b.sort || 0))
          .map(p => ({
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
          pageType = page.type || 'text';

          // Get page level from title data (used by some systems)
          if (page.title?.level) {
            pageLevel = page.title.level;
          }

          // Render content based on page type
          switch (page.type) {
            case 'text':
              console.log('StoryFrame | Page object:', page);
              console.log('StoryFrame | Raw content:', page.text.content);
              currentPageContent = await foundry.applications.ux.TextEditor.implementation.enrichHTML(page.text.content, {
                async: true,
                secrets: game.user.isGM,
                documents: true,
                rolls: true,
                relativeTo: page
              });
              console.log('StoryFrame | Enriched HTML:', currentPageContent);
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

    console.log('StoryFrame | Final containerClasses for template:', containerClasses);

    return {
      containerClasses,
      journals,
      selectedJournal: state.activeJournal,
      pages,
      currentPageIndex: this.currentPageIndex,
      currentPageContent,
      currentPageName,
      pageType,
      pageLevel,
      speakers,
      activeSpeaker: state.activeSpeaker,
      hasSpeakers: speakers.length > 0
    };
  }

  async _onRender(context, options) {
    super._onRender(context, options);
    this._attachJournalSelectorHandler();
    this._attachContentImageDrag();
    this._attachDragDropHandlers();

    // Apply system classes to root ApplicationV2 element (not template)
    // PF2e CSS expects .pf2e-bb.sheet.window-app.journal-sheet on root
    if (context.containerClasses) {
      const rootClasses = ['sheet', 'window-app', 'journal-sheet', 'journal-entry', 'themed', 'theme-light'];
      const systemClasses = context.containerClasses.split(' ');
      rootClasses.push(...systemClasses);

      // Add classes to root application element
      rootClasses.forEach(cls => {
        if (cls && !this.element.classList.contains(cls)) {
          this.element.classList.add(cls);
        }
      });
      console.log('StoryFrame | Applied classes to root:', this.element.className);
    }

    // Inject system/module CSS if needed
    this._injectSystemCSS(context.containerClasses);

    // Restore state on first render only
    if (!this._stateRestored) {
      // Mark window as open (for reconnect auto-open)
      await game.settings.set(MODULE_ID, 'gmWindowWasOpen', true);

      // Restore minimized state
      const wasMinimized = game.settings.get(MODULE_ID, 'gmWindowMinimized');
      if (wasMinimized) {
        this.minimize();
      }

      // Restore journal selection from StateManager flags
      const state = game.storyframe.stateManager.getState();
      if (state?.activeJournal) {
        const select = this.element.querySelector('#journal-selector');
        if (select) {
          select.value = state.activeJournal;
        }
      }

      this._stateRestored = true;
    }

    // Debug: log rendered structure
    const rootContainer = this.element.querySelector('.storyframe-container');
    if (rootContainer) {
      console.log('StoryFrame | Root container classes:', rootContainer.className);
    }

    const contentArea = this.element.querySelector('.journal-page-content');
    if (contentArea) {
      console.log('StoryFrame | Content area classes:', contentArea.className);
      console.log('StoryFrame | Content area HTML:', contentArea.innerHTML.substring(0, 500));
      console.log('StoryFrame | Article classes:', contentArea.closest('article')?.className);
    }
  }

  /**
   * Attach drag handlers to images in journal content.
   * Enables drag-to-gallery for adding speakers from journal images.
   * Verified: Working with .journal-page-content img selector
   */
  _attachContentImageDrag() {
    const images = this.element.querySelectorAll('.journal-page-content img');
    images.forEach(img => {
      img.draggable = true;
      img.style.cursor = 'grab';

      img.addEventListener('dragstart', (e) => {
        img.style.cursor = 'grabbing';
        e.dataTransfer.setData('text/plain', JSON.stringify({
          type: 'StoryFrameImage',
          src: img.src,
          alt: img.alt || 'Speaker'
        }));
      });

      img.addEventListener('dragend', () => {
        img.style.cursor = 'grab';
      });
    });
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

      // Try to get StoryFrameImage data first (images from content)
      const plainData = e.dataTransfer.getData('text/plain');
      if (plainData) {
        try {
          const imageData = JSON.parse(plainData);
          if (imageData.type === 'StoryFrameImage') {
            const label = await foundry.applications.api.DialogV2.prompt({
              window: { title: 'Speaker Name' },
              content: '<input type="text" name="label" placeholder="Enter speaker name" autofocus>',
              ok: {
                label: 'Add',
                callback: (event, button, dialog) => button.form.elements.label.value
              },
              rejectClose: false
            });

            if (label) {
              await game.storyframe.socketManager.requestAddSpeaker({
                imagePath: imageData.src,
                label
              });
            }
            return;
          }
        } catch (err) {
          // Not JSON or not our data, continue to Actor handling
        }
      }

      // Handle Actor drops from sidebar
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
    // Clean up injected styles
    if (this.styleElement) {
      this.styleElement.remove();
      this.styleElement = null;
    }

    // Clean up injected system CSS
    const injectedCSS = document.getElementById('storyframe-pf2e-bb-styles');
    if (injectedCSS) {
      injectedCSS.remove();
    }

    // Save window position
    await game.settings.set(MODULE_ID, 'gmWindowPosition', {
      top: this.position.top,
      left: this.position.left,
      width: this.position.width,
      height: this.position.height
    });

    // Save minimized state
    await game.settings.set(MODULE_ID, 'gmWindowMinimized', this.minimized);

    // Mark window as closed (no auto-open on reconnect)
    await game.settings.set(MODULE_ID, 'gmWindowWasOpen', false);

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
        const label = await foundry.applications.api.DialogV2.prompt({
          window: { title: 'Speaker Name' },
          content: '<input type="text" name="label" placeholder="Enter speaker name" autofocus>',
          ok: {
            label: 'Add',
            callback: (event, button, dialog) => button.form.elements.label.value
          },
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

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: 'Remove Speaker' },
      content: '<p>Remove this speaker from the gallery?</p>',
      yes: { label: 'Remove' },
      no: { label: 'Cancel', default: true },
      rejectClose: false
    });

    if (confirmed) {
      await game.storyframe.socketManager.requestRemoveSpeaker(speakerId);
    }
  }

  static async _onClearSpeaker(event, target) {
    await game.storyframe.socketManager.requestSetActiveSpeaker(null);
  }

  async _onEditJournal() {
    const state = game.storyframe.stateManager.getState();
    if (!state?.activeJournal) {
      ui.notifications.warn('No journal selected');
      return;
    }

    const journal = await fromUuid(state.activeJournal);
    if (!journal) {
      ui.notifications.error('Journal not found');
      return;
    }

    // Open native journal editor
    journal.sheet.render(true);
  }

  async _updateJournalStyles(journalUuid) {
    const journal = await fromUuid(journalUuid);
    if (!journal) return;

    // Extract CSS
    const cssText = this.cssScraper.extractJournalCSS(journal);

    // Namespace rules
    const scopedCSS = this.cssScraper.namespaceCSSRules(cssText);

    // Inject into document
    if (!this.styleElement) {
      this.styleElement = document.createElement('style');
      this.styleElement.id = 'storyframe-journal-styles';
      document.head.appendChild(this.styleElement);
    }

    this.styleElement.textContent = scopedCSS;
  }

  _clearJournalStyles() {
    if (this.styleElement) {
      this.styleElement.textContent = '';
    }
  }

  /**
   * Inject system/module CSS files when needed
   * (e.g., pf2e-beginner-box CSS for pf2e-bb class)
   */
  _injectSystemCSS(containerClasses) {
    // Check if we need to inject PF2e Beginner Box CSS
    if (containerClasses?.includes('pf2e-bb')) {
      const cssId = 'storyframe-pf2e-bb-styles';

      // Only inject if not already present
      if (!document.getElementById(cssId)) {
        const link = document.createElement('link');
        link.id = cssId;
        link.rel = 'stylesheet';
        link.href = 'modules/pf2e-beginner-box/styles/pf2e-bb.css';
        document.head.appendChild(link);
        console.log('StoryFrame | Injected PF2e Beginner Box CSS');
      }
    }
  }
}
