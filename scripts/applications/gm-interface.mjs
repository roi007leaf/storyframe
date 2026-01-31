 
const MODULE_ID = 'storyframe';

import { CSSScraper } from '../css-scraper.mjs';
import { StoryFrameEditor } from '../storyframe-editor.mjs';

// Inline validatePosition (avoids import issues with ESModule side-effect pattern)
function validatePosition(saved) {
  return {
    top: Math.max(0, Math.min(saved.top || 0, window.innerHeight - 50)),
    left: Math.max(0, Math.min(saved.left || 0, window.innerWidth - 100)),
    width: Math.max(200, Math.min(saved.width || 400, window.innerWidth)),
    height: Math.max(150, Math.min(saved.height || 300, window.innerHeight)),
  };
}

/**
 * GM Interface for StoryFrame
 * Provides journal reading and speaker management controls
 */
export class GMInterfaceApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
) {
  static DEFAULT_OPTIONS = {
    id: 'storyframe-gm-interface',
    classes: ['storyframe', 'gm-interface'],
    window: {
      title: 'StoryFrame',
      icon: 'fas fa-book-open',
      resizable: true,
    },
    position: {
      width: 900,
      height: 600,
    },
    actions: {
      selectPage: GMInterfaceApp._onSelectPage,
      searchPages: GMInterfaceApp._onSearchPages,
      toggleSidebar: GMInterfaceApp._onToggleSidebar,
      editJournal: GMInterfaceApp._onEditJournal,
      toggleFolder: GMInterfaceApp._onToggleFolder,
      selectJournal: GMInterfaceApp._onSelectJournal,
      toggleFavorite: GMInterfaceApp._onToggleFavorite,
      goBack: GMInterfaceApp._onGoBack,
      goForward: GMInterfaceApp._onGoForward,
      previousPage: GMInterfaceApp._onPreviousPage,
      nextPage: GMInterfaceApp._onNextPage,
      toggleEditMode: GMInterfaceApp._onToggleEditMode,
      savePageContent: GMInterfaceApp._onSavePageContent,
      cancelEdit: GMInterfaceApp._onCancelEdit,
    },
  };

  static PARTS = {
    content: {
      template: 'modules/storyframe/templates/gm-interface.hbs',
      scrollable: ['.page-list', '.journal-entry-pages .scrollable'],
    },
  };

  constructor(options = {}) {
    super(options);
    this.currentPageIndex = 0;
    this.pageSearchFilter = '';
    this._stateRestored = false;
    this.cssScraper = new CSSScraper();
    this.styleElement = null;
    this.journalClassCache = new Map(); // Cache journal UUID -> CSS class

    // Navigation history for back/forward buttons
    this.navigationHistory = [];
    this.forwardHistory = [];

    // Load saved position with validation
    const savedPosition = game.settings.get(MODULE_ID, 'gmWindowPosition');
    if (savedPosition && Object.keys(savedPosition).length > 0) {
      this.position = { ...this.position, ...validatePosition(savedPosition) };
    }
  }

  async _prepareContext(_options) {
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
        hasSpeakers: false,
      };
    }

    // Build journals array organized by folders
    const journalFolders = this._organizeJournalsByFolder();

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
        // Check cache first, or use system ID as default
        if (this.journalClassCache.has(journal.uuid)) {
          containerClasses = this.journalClassCache.get(journal.uuid);
          console.log(`GMInterface | Using cached class for ${journal.name}: ${containerClasses}`);
        } else if (journal.sheet?.rendered && journal.sheet?.element) {
          console.log(`GMInterface | Sheet already rendered for ${journal.name}, extracting classes...`);
          // If sheet is already rendered, extract classes immediately - element is jQuery object
          // Find the actual root DIV (has 'app' class), not child elements
          let domElement = null;

          if (journal.sheet.element.length) {
            // Try to find element with 'app' class (the root)
            for (let i = 0; i < journal.sheet.element.length; i++) {
              const el = journal.sheet.element[i];
              if (el.classList?.contains('app') && el.classList?.contains('journal-sheet')) {
                domElement = el;
                break;
              }
            }
            // Fallback to first element if not found
            if (!domElement) domElement = journal.sheet.element[0];
          } else {
            domElement = journal.sheet.element;
          }

          const rootClasses = domElement.className;
          const allClasses = rootClasses.split(' ');

          // Prioritize premium module classes over generic theme classes
          const premiumClass = allClasses.find((cls) =>
            cls.startsWith('pf2e-') ||
            cls.startsWith('dnd5e-') ||
            cls.startsWith('swade-')
          );

          const genericClass = allClasses.find((cls) =>
            (cls.includes('-') &&
              !cls.startsWith('window') &&
              !cls.startsWith('journal') &&
              !cls.startsWith('app') &&
              !cls.startsWith('theme'))
          );

          containerClasses = premiumClass || genericClass || game.system.id;
          this.journalClassCache.set(journal.uuid, containerClasses);
          console.log(`GMInterface | Extracted class from rendered sheet: ${containerClasses}`);
          console.log(`GMInterface | All classes found: ${allClasses.join(', ')}`);
        } else {
          // Use system ID for now, schedule async class extraction
          containerClasses = game.system.id;
          console.log(`GMInterface | Sheet not rendered, using system ID: ${containerClasses}`);
          console.log(`GMInterface | Scheduling async class extraction for ${journal.name}`);
          this._scheduleClassExtraction(journal);
        }
        // Support all page types (text, image, pdf, video)
        // Sort by page.sort property to match native journal order
        let allPages = journal.pages.contents
          .sort((a, b) => (a.sort || 0) - (b.sort || 0))
          .map((p) => ({
            name: p.name,
            type: p.type,
            level: p.title?.level || 1, // Get page level for indentation
            _page: p,
          }));

        // Apply page search filter
        if (this.pageSearchFilter) {
          const filter = this.pageSearchFilter.toLowerCase();
          allPages = allPages.filter((p) => p.name.toLowerCase().includes(filter));
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
              currentPageContent =
                await foundry.applications.ux.TextEditor.implementation.enrichHTML(
                  page.text.content,
                  {
                    async: true,
                    secrets: game.user.isGM,
                    documents: true,
                    rolls: true,
                    relativeTo: page,
                  },
                );
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

            case 'map':
              // Map pages display a scene
              if (page.image?.caption) {
                currentPageContent = `<p class="map-caption">${page.image.caption}</p>`;
              } else {
                currentPageContent = '';
              }

              // Show scene thumbnail and info if scene exists
              if (page.src) {
                const scene = await fromUuid(page.src);
                if (scene) {
                  const thumbUrl = scene.thumb || scene.background?.src || 'icons/svg/village.svg';
                  currentPageContent += `
                    <div class="map-page-content">
                      <img src="${thumbUrl}" alt="${scene.name}" style="max-width: 100%; height: auto; cursor: pointer;" data-scene-id="${scene.id}">
                      <div class="map-info">
                        <h3>${scene.name}</h3>
                        ${scene.background?.src ? `<p><strong>Dimensions:</strong> ${scene.dimensions?.width || '?'} x ${scene.dimensions?.height || '?'}</p>` : ''}
                        ${game.user.isGM ? `<button type="button" class="view-scene-btn" data-scene-id="${scene.id}">View Scene</button>` : ''}
                      </div>
                    </div>
                  `;
                } else {
                  currentPageContent += `<p>Scene not found</p>`;
                }
              }
              break;

            default:
              currentPageContent = `<p>Unsupported page type: ${page.type}</p>`;
          }
        }
      }
    }

    // Get selected journal name for display
    let selectedJournalName = null;
    if (state.activeJournal) {
      const selectedJournal = game.journal.find((j) => j.uuid === state.activeJournal);
      selectedJournalName = selectedJournal?.name || null;
    }

    return {
      containerClasses,
      journalFolders,
      selectedJournal: state.activeJournal,
      selectedJournalName,
      pages,
      currentPageIndex: this.currentPageIndex,
      currentPageContent,
      currentPageName,
      pageType,
      pageLevel,
      canGoBack: this.navigationHistory.length > 0,
      canGoForward: this.forwardHistory.length > 0,
      canGoPreviousPage: this.currentPageIndex > 0,
      canGoNextPage: pages.length > 0 && this.currentPageIndex < pages.length - 1,
      currentPageNumber: this.currentPageIndex + 1,
      totalPages: pages.length,
      editMode: this.editMode,
      editorDirty: this.editorDirty,
      canEdit: pageType === 'text' && !!currentPageContent,
    };
  }

  /**
   * Organize journals by their folders for the dropdown
   * Creates a flattened list with depth info for indentation
   * @returns {Object} Object with items array (folders and journals flattened), rootJournals array, and favorites array
   */
  _organizeJournalsByFolder() {
    const items = [];
    const rootJournals = [];
    const favorites = [];
    const favoriteIds = game.settings.get(MODULE_ID, 'favoriteJournals') || [];

    /**
     * Recursively add folder and its contents to items array
     * @param {Folder} folder - The Foundry folder object
     * @param {number} depth - Current depth level
     * @param {string} parentPath - Parent folder path for unique IDs
     */
    const addFolderContents = (folder, depth, parentPath = '') => {
      const folderId = parentPath ? `${parentPath}/${folder.id}` : folder.id;

      // Get journals directly in this folder
      const journals = game.journal
        .filter((j) => j.folder?.id === folder.id)
        .sort((a, b) => a.sort - b.sort)
        .map((j) => ({ id: j.uuid, name: j.name, isFavorite: favoriteIds.includes(j.uuid) }));

      // Get child folders
      const childFolders = game.folders
        .filter((f) => f.type === 'JournalEntry' && f.folder?.id === folder.id)
        .sort((a, b) => a.sort - b.sort);

      // Only add folder if it has journals or subfolders with journals
      const hasContent = journals.length > 0 || childFolders.length > 0;
      if (!hasContent) return false;

      // Add folder item
      items.push({
        type: 'folder',
        id: folderId,
        name: folder.name,
        depth: depth,
      });

      // Add journals in this folder
      for (const journal of journals) {
        items.push({
          type: 'journal',
          id: journal.id,
          name: journal.name,
          depth: depth,
          folderId: folderId,
          isFavorite: journal.isFavorite,
        });
      }

      // Recursively add child folders
      for (const childFolder of childFolders) {
        addFolderContents(childFolder, depth + 1, folderId);
      }

      return true;
    };

    // Get root-level folders (no parent)
    const rootLevelFolders = game.folders
      .filter((f) => f.type === 'JournalEntry' && !f.folder)
      .sort((a, b) => a.sort - b.sort);

    // Process each root folder
    for (const folder of rootLevelFolders) {
      addFolderContents(folder, 0);
    }

    // Get journals without a folder
    game.journal
      .filter((j) => !j.folder)
      .sort((a, b) => a.sort - b.sort)
      .forEach((j) =>
        rootJournals.push({ id: j.uuid, name: j.name, isFavorite: favoriteIds.includes(j.uuid) }),
      );

    // Build favorites list from all journals
    for (const uuid of favoriteIds) {
      const journal = game.journal.find((j) => j.uuid === uuid);
      if (journal) {
        favorites.push({ id: journal.uuid, name: journal.name });
      }
    }

    return { items, rootJournals, favorites };
  }

  async _onRender(context, _options) {
    super._onRender(context, _options);
    this._attachDropdownHandler();
    this._attachSearchHandler();
    this._attachContentImageDrag();
    this._attachJournalLinkHandler();
    this._attachMapPageHandlers();

    // Add system/module classes to root for journal CSS compatibility
    if (context.containerClasses) {
      console.log(`GMInterface | Applying container classes: ${context.containerClasses}`);

      // Remove any existing system and premium module classes first (including erroneous ones)
      const systemAndPremiumClasses = ['pf2e', 'dnd5e', 'swade', 'header-control',
        'pf2e-km', 'pf2e-bb', 'pf2e-av', 'pf2e-outlaws',
        'pf2e-bloodlords', 'pf2e-gatewalkers', 'pf2e-stolenfate', 'pf2e-skyking',
        'pf2e-seasonofghosts', 'pf2e-wardensofwildwood', 'pf2e-curtaincall',
        'pf2e-triumphofthetusk', 'pf2e-sporewar'];

      systemAndPremiumClasses.forEach((cls) => {
        this.element.classList.remove(cls);
      });

      const allClasses = [
        'journal-sheet',
        'journal-entry',
        'themed',
        'theme-light',
      ];
      const systemClasses = context.containerClasses.split(' ').filter(Boolean);
      allClasses.push(...systemClasses);

      console.log(`GMInterface | Final classes to apply: ${allClasses.join(', ')}`);

      allClasses.forEach((cls) => {
        if (cls && !this.element.classList.contains(cls)) {
          this.element.classList.add(cls);
        }
      });
    }

    // Update journal styles when journal is selected
    const state = game.storyframe.stateManager.getState();
    if (state?.activeJournal) {
      console.log(`GMInterface | Active journal detected, updating styles: ${state.activeJournal}`);
      await this._updateJournalStyles(state.activeJournal);
    } else {
      console.log(`GMInterface | No active journal, clearing styles`);
      this._clearJournalStyles();
    }

    // Restore state on first render only
    if (!this._stateRestored) {
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

    // Initialize Quill editor if in edit mode
    if (this.editMode && context.canEdit) {
      await this._initializeEditor();
    }
  }

  /**
   * Initialize the StoryFrame editor for the current page
   */
  async _initializeEditor() {
    const editorContainer = this.element.querySelector('#quill-editor');
    if (!editorContainer) {
      console.error('StoryFrame | Editor container not found');
      return;
    }

    // Get the current page
    const state = game.storyframe.stateManager.getState();
    if (!state?.activeJournal) return;

    const journal = await fromUuid(state.activeJournal);
    if (!journal) return;

    const pages = journal.pages.contents.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    const page = pages[this.currentPageIndex];
    if (!page || page.type !== 'text') return;

    // Get the raw content (not enriched)
    const rawContent = page.text.content || '';

    try {
      // Create and initialize the editor
      this.editor = new StoryFrameEditor(editorContainer, rawContent, (dirty) => {
        this.editorDirty = dirty;
        this._updateDirtyIndicator();
      });

      await this.editor.initialize();
      this.editorDirty = false;
    } catch (error) {
      console.error('StoryFrame | Failed to initialize editor:', error);
      ui.notifications.error('Failed to initialize editor');
      this.editMode = false;
      this.render();
    }
  }

  /**
   * Schedule async extraction of CSS classes from journal sheet
   * This happens in the background to avoid blocking StoryFrame's render
   */
  async _scheduleClassExtraction(journal) {
    // Don't extract if already in progress for this journal
    if (this._extractingClassFor === journal.uuid) {
      console.log(`GMInterface | Class extraction already in progress for ${journal.name}`);
      return;
    }
    this._extractingClassFor = journal.uuid;

    console.log(`GMInterface | Starting scheduled class extraction for ${journal.name}`);

    // Run after a small delay to let StoryFrame render first
    setTimeout(async () => {
      const wasRendered = journal.sheet?.rendered;
      let sheetOpenedByUs = false;

      console.log(`GMInterface | Sheet was already rendered: ${wasRendered}`);

      try {
        // Temporarily render if not already open
        if (!wasRendered) {
          console.log(`GMInterface | Temporarily rendering sheet to extract classes...`);
          journal.sheet.render(true, { focus: false });
          sheetOpenedByUs = true;
          await new Promise(resolve => setTimeout(resolve, 200)); // Wait for render
        }

        // Extract classes - journal.sheet.element is a jQuery object
        // Find the actual root DIV (has 'app' class), not child elements
        if (journal.sheet?.element) {
          let domElement = null;

          // If element is jQuery, find the root by class
          if (journal.sheet.element.length) {
            // Try to find element with 'app' class (the root)
            for (let i = 0; i < journal.sheet.element.length; i++) {
              const el = journal.sheet.element[i];
              if (el.classList?.contains('app') && el.classList?.contains('journal-sheet')) {
                domElement = el;
                break;
              }
            }
            // Fallback to first element if not found
            if (!domElement) domElement = journal.sheet.element[0];
          } else {
            domElement = journal.sheet.element;
          }

          const rootClasses = domElement.className;
          const allClasses = rootClasses.split(' ');
          // Prioritize premium module classes over generic theme classes
          const premiumClass = allClasses.find((cls) =>
            cls.startsWith('pf2e-') ||
            cls.startsWith('dnd5e-') ||
            cls.startsWith('swade-')
          );

          const genericClass = allClasses.find((cls) =>
            (cls.includes('-') &&
              !cls.startsWith('window') &&
              !cls.startsWith('journal') &&
              !cls.startsWith('app') &&
              !cls.startsWith('theme'))
          );

          const extractedClass = premiumClass || genericClass || game.system.id;

          console.log(`GMInterface | Extracted class: ${extractedClass}`);
          console.log(`GMInterface | All classes from sheet: ${allClasses.join(', ')}`);
          console.log(`GMInterface | Premium class: ${premiumClass || 'none'}, Generic class: ${genericClass || 'none'}`);

          // Cache the class in GMInterface
          this.journalClassCache.set(journal.uuid, extractedClass);

          // Extract and cache CSS using the extracted class
          console.log(`GMInterface | Triggering CSS extraction with class: ${extractedClass}`);
          this.cssScraper.extractJournalCSS(journal, extractedClass);

          // Re-render to apply the correct classes
          console.log(`GMInterface | Re-rendering interface to apply extracted class`);
          this.render();
        } else {
          console.warn(`GMInterface | Could not find sheet element for ${journal.name}`);
        }
      } catch (error) {
        console.error('GMInterface | Failed to extract journal classes:', error);
      } finally {
        // ALWAYS close if we opened it
        if (sheetOpenedByUs && journal.sheet?.rendered) {
          console.log(`GMInterface | Closing temporarily-opened sheet`);
          journal.sheet.close();
        }
        this._extractingClassFor = null;
      }
    }, 100);
  }

  /**
   * Update the dirty indicator in the UI
   */
  _updateDirtyIndicator() {
    const indicator = this.element.querySelector('.dirty-indicator');
    if (indicator) {
      indicator.classList.toggle('visible', this.editorDirty);
    }
  }

  /**
   * Save the editor content to the journal page
   */
  async _saveEditorContent() {
    if (!this.editor) return false;

    const state = game.storyframe.stateManager.getState();
    if (!state?.activeJournal) return false;

    const journal = await fromUuid(state.activeJournal);
    if (!journal) return false;

    const pages = journal.pages.contents.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    const page = pages[this.currentPageIndex];
    if (!page) return false;

    try {
      // Get HTML content from editor
      // This preserves all HTML structure, classes, attributes, and style tags
      const content = this.editor.getContent();

      // Update the page
      await page.update({ 'text.content': content });

      this.editorDirty = false;
      this._updateDirtyIndicator();

      ui.notifications.info('Page saved');
      return true;
    } catch (error) {
      console.error('StoryFrame | Failed to save page:', error);
      ui.notifications.error('Failed to save page');
      return false;
    }
  }

  /**
   * Clean up editor when closing or switching modes
   */
  _destroyEditor() {
    if (this.editor) {
      this.editor.destroy();
      this.editor = null;
    }
    this.editorDirty = false;
  }

  /**
   * Attach drag handlers to images in journal content.
   * Enables drag-to-gallery for adding speakers from journal images.
   * Verified: Working with .journal-page-content img selector
   */
  _attachContentImageDrag() {
    const images = this.element.querySelectorAll('.journal-page-content img');
    images.forEach((img) => {
      img.draggable = true;
      img.style.cursor = 'grab';

      img.addEventListener('dragstart', (e) => {
        img.style.cursor = 'grabbing';
        e.dataTransfer.setData(
          'text/plain',
          JSON.stringify({
            type: 'StoryFrameImage',
            src: img.src,
            alt: img.alt || 'Speaker',
          }),
        );
      });

      img.addEventListener('dragend', () => {
        img.style.cursor = 'grab';
      });
    });
  }

  /**
   * Attach click handlers to journal links in content.
   * Intercepts clicks on JournalEntry/JournalEntryPage links to open them in StoryFrame.
   */
  _attachJournalLinkHandler() {
    const contentLinks = this.element.querySelectorAll('.journal-page-content a.content-link');
    contentLinks.forEach((link) => {
      const uuid = link.dataset.uuid;
      if (!uuid) return;

      // Only intercept JournalEntry and JournalEntryPage links
      if (!uuid.startsWith('JournalEntry.')) return;

      link.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Parse the UUID to get the journal entry UUID
        // Format: JournalEntry.{id} or JournalEntry.{id}.JournalEntryPage.{pageId}
        const parts = uuid.split('.');
        let journalUuid;
        let pageId = null;

        if (parts.length >= 2 && parts[0] === 'JournalEntry') {
          journalUuid = `JournalEntry.${parts[1]}`;

          // If linking to a specific page, extract the page ID
          if (parts.length >= 4 && parts[2] === 'JournalEntryPage') {
            pageId = parts[3];
          }
        }

        if (!journalUuid) {
          return;
        }

        // Check if we're linking to the same journal (just a different page)
        const state = game.storyframe.stateManager.getState();
        const currentJournalUuid = state?.activeJournal;

        // Save current state to navigation history before navigating
        // Clear forward history when navigating to new location (like browser behavior)
        this.forwardHistory = [];
        if (currentJournalUuid) {
          this.navigationHistory.push({
            journalUuid: currentJournalUuid,
            pageIndex: this.currentPageIndex,
          });
        }

        if (currentJournalUuid === journalUuid && pageId) {
          // Same journal, just navigate to the page
          await this._navigateToPage(journalUuid, pageId);
        } else {
          // Different journal, switch to it
          this.currentPageIndex = 0;
          this.pageSearchFilter = '';
          this.cssScraper.clearAllCache();
          await game.storyframe.socketManager.requestSetActiveJournal(journalUuid);

          // If a specific page was requested, navigate to it after journal loads
          if (pageId) {
            // Small delay to let the journal load
            setTimeout(() => this._navigateToPage(journalUuid, pageId), 100);
          }
        }
      });
    });
  }

  /**
   * Navigate to a specific page within the current journal
   * @param {string} journalUuid - The journal UUID
   * @param {string} pageId - The page ID to navigate to
   */
  async _navigateToPage(journalUuid, pageId) {
    const journal = await fromUuid(journalUuid);
    if (!journal) return;

    // Find the page index
    const pages = journal.pages.contents.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    const pageIndex = pages.findIndex((p) => p.id === pageId);

    if (pageIndex !== -1) {
      this.currentPageIndex = pageIndex;
      this.render();
    }
  }

  /**
   * Attach click handlers for map page elements
   */
  _attachMapPageHandlers() {
    // Handle scene image clicks
    const sceneImages = this.element.querySelectorAll('.map-page-content img[data-scene-id]');
    sceneImages.forEach((img) => {
      img.addEventListener('click', async (e) => {
        const sceneId = e.currentTarget.dataset.sceneId;
        const scene = game.scenes.get(sceneId);
        if (scene && game.user.isGM) {
          await scene.view();
        }
      });
    });

    // Handle "View Scene" button clicks
    const viewButtons = this.element.querySelectorAll('.view-scene-btn');
    viewButtons.forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const sceneId = e.currentTarget.dataset.sceneId;
        const scene = game.scenes.get(sceneId);
        if (scene) {
          await scene.view();
        }
      });
    });
  }

  _attachDropdownHandler() {
    const dropdown = this.element.querySelector('.custom-dropdown');
    if (!dropdown) return;

    const trigger = dropdown.querySelector('.dropdown-trigger');
    const menu = dropdown.querySelector('.dropdown-menu');

    // Toggle dropdown on trigger click
    trigger?.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = dropdown.classList.contains('open');
      dropdown.classList.toggle('open');

      // When opening, expand to selected journal and scroll into view
      if (!wasOpen && menu) {
        const selectedItem = menu.querySelector('.dropdown-item.selected');
        if (selectedItem) {
          const wrapper = selectedItem.closest('.dropdown-item-wrapper');
          if (wrapper) {
            const folderId = wrapper.dataset.folderId;
            if (folderId) {
              // Expand all folders in the hierarchy
              this._expandFolderHierarchy(menu, folderId);
            }
            // Scroll selected item into view after a brief delay for DOM updates
            requestAnimationFrame(() => {
              wrapper.scrollIntoView({ block: 'center', behavior: 'instant' });
            });
          }
        }
      }
    });

    // Close dropdown when clicking outside
    this._dropdownCloseHandler = (e) => {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
      }
    };
    document.addEventListener('click', this._dropdownCloseHandler);

    // Initialize: all folders start collapsed
    // Show only: depth-0 folders, root journals, and favorites
    // Hide: all journal items inside folders (wrappers), all nested folders
    if (menu) {
      // Handle folder items
      const folders = menu.querySelectorAll('.dropdown-folder-item');
      folders.forEach((folder) => {
        if (!folder.classList.contains('depth-0')) {
          folder.classList.add('hidden');
        }
      });

      // Handle item wrappers (journal items are now wrapped)
      const wrappers = menu.querySelectorAll('.dropdown-item-wrapper');
      wrappers.forEach((wrapper) => {
        const isRootItem = wrapper.classList.contains('root-item');
        const isFavoriteItem = wrapper.classList.contains('favorite-item');
        const hasFolderId = wrapper.dataset.folderId;

        if (isFavoriteItem || isRootItem) {
          // Always show favorites and root journals
          return;
        }

        if (hasFolderId) {
          // Hide all journal items inside folders (they show when folder expands)
          wrapper.classList.add('hidden');
        }
      });
    }
  }

  _attachSearchHandler() {
    const searchInput = this.element.querySelector('input[name="page-search"]');
    if (searchInput) {
      // Set initial value from state
      searchInput.value = this.pageSearchFilter || '';

      searchInput.addEventListener('input', (e) => {
        this.pageSearchFilter = e.target.value;
        this.currentPageIndex = 0; // Reset to first page when searching
        this.render();
      });
    }
  }

  /**
   * Expand all folders in the hierarchy leading to a specific folder ID
   * @param {HTMLElement} menu - The dropdown menu element
   * @param {string} targetFolderId - The folder ID path (e.g., "folder1/folder2")
   */
  _expandFolderHierarchy(menu, targetFolderId) {
    // Build list of folder IDs to expand (from root to target)
    const parts = targetFolderId.split('/');
    const folderIdsToExpand = [];
    for (let i = 0; i < parts.length; i++) {
      folderIdsToExpand.push(parts.slice(0, i + 1).join('/'));
    }

    // Expand each folder in order
    for (const folderId of folderIdsToExpand) {
      const folder = menu.querySelector(`.dropdown-folder-item[data-folder-id="${folderId}"]`);
      if (folder && !folder.classList.contains('expanded')) {
        folder.classList.add('expanded');

        // Show direct child wrappers (journal items)
        const wrappers = menu.querySelectorAll(
          `.dropdown-item-wrapper[data-folder-id="${folderId}"]`,
        );
        wrappers.forEach((w) => w.classList.remove('hidden'));

        // Show direct child folders
        const childFolders = menu.querySelectorAll('.dropdown-folder-item');
        childFolders.forEach((f) => {
          const childId = f.dataset.folderId;
          if (
            childId &&
            childId.startsWith(folderId + '/') &&
            childId.split('/').length === folderId.split('/').length + 1
          ) {
            f.classList.remove('hidden');
          }
        });
      }
    }
  }

  async _onClose(_options) {
    // Close the sidebar drawer if open
    if (game.storyframe.gmSidebar?.rendered) {
      game.storyframe.gmSidebar.close();
    }

    // Clean up editor
    this._destroyEditor();
    this.editMode = false;

    // Clean up dropdown event listener
    if (this._dropdownCloseHandler) {
      document.removeEventListener('click', this._dropdownCloseHandler);
      this._dropdownCloseHandler = null;
    }

    // Clean up injected journal styles
    if (this.styleElement) {
      this.styleElement.remove();
      this.styleElement = null;
    }

    // Save window position
    await game.settings.set(MODULE_ID, 'gmWindowPosition', {
      top: this.position.top,
      left: this.position.left,
      width: this.position.width,
      height: this.position.height,
    });

    // Save minimized state
    await game.settings.set(MODULE_ID, 'gmWindowMinimized', this.minimized);

    return super._onClose(_options);
  }

  /**
   * Check for unsaved editor changes and prompt user if needed
   * @returns {Promise<boolean>} True if safe to proceed, false if cancelled
   */
  async _checkUnsavedChanges() {
    if (!this.editMode || !this.editorDirty) return true;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: 'Unsaved Changes' },
      content: '<p>You have unsaved changes. Discard them?</p>',
      yes: { label: 'Discard' },
      no: { label: 'Cancel', default: true },
      rejectClose: false,
    });

    if (confirmed) {
      this._destroyEditor();
      this.editMode = false;
    }

    return confirmed;
  }

  // --- Action Handlers ---

  static async _onSelectPage(_event, target) {
    const pageIndex = parseInt(target.dataset.pageIndex);
    if (isNaN(pageIndex) || pageIndex === this.currentPageIndex) return;

    // Check for unsaved changes before switching pages
    if (!(await this._checkUnsavedChanges())) return;

    this.currentPageIndex = pageIndex;
    this.render();
  }

  static async _onSearchPages(_event, target) {
    this.pageSearchFilter = target.value;
    this.currentPageIndex = 0; // Reset to first page when searching
    this.render();
  }

  static async _onEditJournal(_event, _target) {
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

  static async _onToggleFolder(_event, target) {
    const folderId = target.dataset.folderId;
    if (!folderId) return;

    const isExpanded = target.classList.toggle('expanded');
    const dropdown = target.closest('.dropdown-menu');
    if (!dropdown) return;

    // Handle item wrappers (journal items)
    const wrappers = dropdown.querySelectorAll('.dropdown-item-wrapper[data-folder-id]');
    wrappers.forEach((wrapper) => {
      const wrapperFolderId = wrapper.dataset.folderId;
      if (!wrapperFolderId) return;

      const isDirectChild = wrapperFolderId === folderId;
      const isDescendant = wrapperFolderId.startsWith(folderId + '/');

      if (isExpanded) {
        // When expanding, show direct children only
        if (isDirectChild) {
          wrapper.classList.remove('hidden');
        }
      } else {
        // When collapsing, hide all descendants
        if (isDirectChild || isDescendant) {
          wrapper.classList.add('hidden');
        }
      }
    });

    // Handle nested folders
    const folders = dropdown.querySelectorAll('.dropdown-folder-item');
    folders.forEach((folder) => {
      const folderItemId = folder.dataset.folderId;
      if (!folderItemId) return;

      const isChildFolder =
        folderItemId.startsWith(folderId + '/') &&
        folderItemId.split('/').length === folderId.split('/').length + 1;
      const isDescendant = folderItemId.startsWith(folderId + '/');

      if (isExpanded) {
        // When expanding, show direct child folders only
        if (isChildFolder) {
          folder.classList.remove('hidden');
        }
      } else {
        // When collapsing, hide all descendant folders and collapse them
        if (isDescendant) {
          folder.classList.add('hidden');
          folder.classList.remove('expanded');
        }
      }
    });
  }

  static async _onSelectJournal(_event, target) {
    const journalId = target.dataset.value;
    const dropdown = target.closest('.custom-dropdown');

    // Close the dropdown
    dropdown?.classList.remove('open');

    // Check for unsaved changes before switching journals
    if (!(await this._checkUnsavedChanges())) return;

    // Update selection
    this.currentPageIndex = 0;
    this.pageSearchFilter = '';
    // Clear CSS cache when switching journals
    this.cssScraper.clearAllCache();
    await game.storyframe.socketManager.requestSetActiveJournal(journalId || null);
  }

  static async _onToggleSidebar(_event, _target) {
    // Get reference to the main interface (stored as gmApp)
    const mainInterface = game.storyframe.gmApp;

    // Create sidebar if it doesn't exist
    if (!game.storyframe.gmSidebar) {
      // Dynamic import to avoid circular dependency
      const { GMSidebarApp } = await import('./gm-sidebar.mjs');
      game.storyframe.gmSidebar = new GMSidebarApp();
      // Store reference to the main interface
      game.storyframe.gmSidebar.parentInterface = mainInterface;
      game.storyframe.gmSidebar.render(true);
      return;
    }

    const sidebar = game.storyframe.gmSidebar;
    if (sidebar.rendered) {
      sidebar.close();
    } else {
      // Update parent reference in case it changed
      sidebar.parentInterface = mainInterface;
      sidebar._stateRestored = false; // Reset to re-position
      sidebar.render(true);
    }
  }

  async _updateJournalStyles(journalUuid) {
    const journal = await fromUuid(journalUuid);
    if (!journal) return;

    console.log(`GMInterface | _updateJournalStyles called for: ${journal.name}`);

    // Clear any existing styles first
    this._clearJournalStyles();

    // Force clear cache to ensure fresh CSS extraction
    this.cssScraper.clearCache(journalUuid);
    console.log(`GMInterface | Cleared cache for ${journalUuid}`);

    // Get the extracted class for this journal (for filtering stylesheets)
    const extractedClass = this.journalClassCache.get(journal.uuid) || null;
    console.log(`GMInterface | Extracted class parameter for CSS scraper: ${extractedClass || 'none'}`);

    // Extract CSS - pass extracted class for better filtering
    const cssText = this.cssScraper.extractJournalCSS(journal, extractedClass);
    console.log(`GMInterface | Extracted CSS length: ${cssText.length} characters`);

    // Namespace rules to target our journal content area
    // Use a class selector to avoid ID specificity issues that would override premium module styles
    console.log(`GMInterface | Namespacing CSS with: .storyframe.gm-interface`);
    const scopedCSS = this.cssScraper.namespaceCSSRules(cssText, '.storyframe.gm-interface');
    console.log(`GMInterface | Namespaced CSS length: ${scopedCSS.length} characters`);

    // Inject into document
    if (!this.styleElement) {
      this.styleElement = document.createElement('style');
      this.styleElement.id = 'storyframe-journal-styles';
      document.head.appendChild(this.styleElement);
      console.log(`GMInterface | Created new style element in document head`);
    }

    this.styleElement.textContent = scopedCSS;
    console.log(`GMInterface | Injected CSS into style element`);
  }

  _clearJournalStyles() {
    if (this.styleElement) {
      this.styleElement.textContent = '';
    }
  }

  static async _onToggleFavorite(event, target) {
    event.stopPropagation(); // Prevent dropdown item selection
    const journalId = target.dataset.journalId;
    if (!journalId) return;

    const favorites = game.settings.get(MODULE_ID, 'favoriteJournals') || [];
    const index = favorites.indexOf(journalId);

    if (index === -1) {
      favorites.push(journalId);
    } else {
      favorites.splice(index, 1);
    }

    await game.settings.set(MODULE_ID, 'favoriteJournals', favorites);
    this.render();
  }

  static async _onGoBack(_event, _target) {
    if (this.navigationHistory.length === 0) return;

    // Check for unsaved changes before navigating
    if (!(await this._checkUnsavedChanges())) return;

    // Save current state to forward history before going back
    const state = game.storyframe.stateManager.getState();
    const currentJournalUuid = state?.activeJournal;
    if (currentJournalUuid) {
      this.forwardHistory.push({
        journalUuid: currentJournalUuid,
        pageIndex: this.currentPageIndex,
      });
    }

    // Pop the last state from history
    const previousState = this.navigationHistory.pop();

    // Navigate back to the previous journal and page
    if (previousState.journalUuid !== currentJournalUuid) {
      // Different journal, switch to it
      this.pageSearchFilter = '';
      this.cssScraper.clearAllCache();
      await game.storyframe.socketManager.requestSetActiveJournal(previousState.journalUuid);

      // Restore page index after journal loads
      setTimeout(() => {
        this.currentPageIndex = previousState.pageIndex;
        this.render();
      }, 100);
    } else {
      // Same journal, just restore page index
      this.currentPageIndex = previousState.pageIndex;
      this.render();
    }
  }

  static async _onGoForward(_event, _target) {
    if (this.forwardHistory.length === 0) return;

    // Check for unsaved changes before navigating
    if (!(await this._checkUnsavedChanges())) return;

    // Save current state to back history before going forward
    const state = game.storyframe.stateManager.getState();
    const currentJournalUuid = state?.activeJournal;
    if (currentJournalUuid) {
      this.navigationHistory.push({
        journalUuid: currentJournalUuid,
        pageIndex: this.currentPageIndex,
      });
    }

    // Pop the last state from forward history
    const nextState = this.forwardHistory.pop();

    // Navigate forward to the next journal and page
    if (nextState.journalUuid !== currentJournalUuid) {
      // Different journal, switch to it
      this.pageSearchFilter = '';
      this.cssScraper.clearAllCache();
      await game.storyframe.socketManager.requestSetActiveJournal(nextState.journalUuid);

      // Restore page index after journal loads
      setTimeout(() => {
        this.currentPageIndex = nextState.pageIndex;
        this.render();
      }, 100);
    } else {
      // Same journal, just restore page index
      this.currentPageIndex = nextState.pageIndex;
      this.render();
    }
  }

  static async _onPreviousPage(_event, _target) {
    if (this.currentPageIndex <= 0) return;

    // Check for unsaved changes before switching pages
    if (!(await this._checkUnsavedChanges())) return;

    this.currentPageIndex--;
    this.render();
  }

  static async _onNextPage(_event, _target) {
    const state = game.storyframe.stateManager.getState();
    if (!state?.activeJournal) return;

    const journal = await fromUuid(state.activeJournal);
    if (!journal) return;

    const pageCount = journal.pages.contents.length;
    if (this.currentPageIndex >= pageCount - 1) return;

    // Check for unsaved changes before switching pages
    if (!(await this._checkUnsavedChanges())) return;

    this.currentPageIndex++;
    this.render();
  }

  static async _onToggleEditMode(_event, _target) {
    // Check for unsaved changes before leaving edit mode
    if (this.editMode && this.editorDirty) {
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: 'Unsaved Changes' },
        content: '<p>You have unsaved changes. Discard them?</p>',
        yes: { label: 'Discard' },
        no: { label: 'Cancel', default: true },
        rejectClose: false,
      });

      if (!confirmed) return;
    }

    // Toggle edit mode
    this.editMode = !this.editMode;

    // Clean up editor when leaving edit mode
    if (!this.editMode) {
      this._destroyEditor();
    }

    this.render();
  }

  static async _onSavePageContent(_event, _target) {
    const success = await this._saveEditorContent();
    if (success) {
      // Exit edit mode and return to rendered view
      this.editMode = false;
      this._destroyEditor();
      this.render();
    }
  }

  static async _onCancelEdit(_event, _target) {
    // Check for unsaved changes
    if (this.editorDirty) {
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: 'Unsaved Changes' },
        content: '<p>You have unsaved changes. Discard them?</p>',
        yes: { label: 'Discard' },
        no: { label: 'Cancel', default: true },
        rejectClose: false,
      });

      if (!confirmed) return;
    }

    // Exit edit mode
    this.editMode = false;
    this._destroyEditor();
    this.render();
  }
}
