const MODULE_ID = 'storyframe';

import { CSSScraper } from '../css-scraper.mjs';

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

    // Navigation history for back/forward buttons
    this.navigationHistory = [];
    this.forwardHistory = [];

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
        // Extract system-specific classes from journal sheet root element
        // (pf2e-bb, dnd5e, etc. are on the root .app element, not inner container)
        if (journal.sheet?.element?.[0]) {
          const rootClasses = journal.sheet.element.attr('class');
          console.log('StoryFrame | Root element classes:', rootClasses);
          // Extract only system/module classes (pf2e-bb, etc.)
          // Filter out Foundry framework classes
          const allClasses = rootClasses.split(' ');
          console.log('StoryFrame | All classes array:', allClasses);
          const systemClass = allClasses.find(
            (cls) =>
              cls.startsWith('pf2e') ||
              cls.startsWith('dnd5e') ||
              cls.startsWith('swade') ||
              cls.includes('outlaws') ||
              cls.includes('bloodlords') ||
              cls.includes('gatewalkers') ||
              cls.includes('stolenfate') ||
              cls.includes('skyking') ||
              cls.includes('seasonofghosts') ||
              cls.includes('wardensofwildwood') ||
              cls.includes('curtaincall') ||
              cls.includes('triumphofthetusk') ||
              cls.includes('sporewar') ||
              cls.includes('shadesofblood') ||
              cls.includes('mythspeaker') ||
              cls.includes('revengeoftherunelords') ||
              (cls.includes('-') &&
                !cls.startsWith('window') &&
                !cls.startsWith('journal') &&
                !cls.startsWith('app')),
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
            containerClasses = 'pf2e-bb';
          } else if (game.modules.get('pf2e-abomination-vaults')?.active) {
            containerClasses = 'pf2e-av';
          } else if (game.modules.get('pf2e-kingmaker')?.active) {
            containerClasses = 'pf2e-km';
          }

          console.log('StoryFrame | Built container classes:', containerClasses);
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
              console.log('StoryFrame | Page object:', page);
              console.log('StoryFrame | Raw content:', page.text.content);
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

    console.log('StoryFrame | Final containerClasses for template:', containerClasses);

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

  async _onRender(context, options) {
    super._onRender(context, options);
    this._attachDropdownHandler();
    this._attachSearchHandler();
    this._attachContentImageDrag();
    this._attachJournalLinkHandler();

    // Add system/module classes to root for journal CSS compatibility
    if (context.containerClasses) {
      const allClasses = [
        'sheet',
        'window-app',
        'journal-sheet',
        'journal-entry',
        'themed',
        'theme-light',
      ];
      const systemClasses = context.containerClasses.split(' ').filter(Boolean);
      allClasses.push(...systemClasses);

      allClasses.forEach((cls) => {
        if (cls && !this.element.classList.contains(cls)) {
          this.element.classList.add(cls);
        }
      });
    }

    // Update journal styles when journal is selected
    const state = game.storyframe.stateManager.getState();
    if (state?.activeJournal) {
      await this._updateJournalStyles(state.activeJournal);
    } else {
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
          console.warn(`${MODULE_ID} | Could not parse journal UUID from: ${uuid}`);
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

  async _onClose(options) {
    // Close the sidebar drawer if open
    if (game.storyframe.gmSidebar?.rendered) {
      game.storyframe.gmSidebar.close();
    }

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

  static async _onEditJournal(event, target) {
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

  static async _onToggleFolder(event, target) {
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

  static async _onSelectJournal(event, target) {
    const journalId = target.dataset.value;
    const dropdown = target.closest('.custom-dropdown');

    // Close the dropdown
    dropdown?.classList.remove('open');

    // Update selection
    this.currentPageIndex = 0;
    this.pageSearchFilter = '';
    // Clear CSS cache when switching journals
    this.cssScraper.clearAllCache();
    await game.storyframe.socketManager.requestSetActiveJournal(journalId || null);
  }

  static async _onToggleSidebar(event, target) {
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

    // Extract CSS
    const cssText = this.cssScraper.extractJournalCSS(journal);

    // Namespace rules to target our journal content area
    // Use a class selector to avoid ID specificity issues that would override premium module styles
    const scopedCSS = this.cssScraper.namespaceCSSRules(cssText, '.storyframe.gm-interface');

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

  static async _onGoBack(event, target) {
    if (this.navigationHistory.length === 0) return;

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

  static async _onGoForward(event, target) {
    if (this.forwardHistory.length === 0) return;

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

  static async _onPreviousPage(event, target) {
    if (this.currentPageIndex > 0) {
      this.currentPageIndex--;
      this.render();
    }
  }

  static async _onNextPage(event, target) {
    const state = game.storyframe.stateManager.getState();
    if (!state?.activeJournal) return;

    const journal = await fromUuid(state.activeJournal);
    if (!journal) return;

    const pageCount = journal.pages.contents.length;
    if (this.currentPageIndex < pageCount - 1) {
      this.currentPageIndex++;
      this.render();
    }
  }
}
