/**
 * Dialog for picking a FoundryVTT game scene to navigate to.
 * Displays all scenes organized by folder hierarchy with thumbnails
 * and a search filter. Returns the selected Scene document.
 */
export class ScenePickerDialog extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
) {
  /** Currently open instance — only one picker dialog at a time */
  static _instance = null;

  static DEFAULT_OPTIONS = {
    id: 'storyframe-scene-picker',
    window: {
      title: 'STORYFRAME.CinematicScene.OpenScene',
      icon: 'fas fa-map',
      minimizable: false,
      resizable: true,
    },
    position: {
      width: 520,
      height: 500,
    },
    classes: ['storyframe', 'scene-picker-dialog-app'],
    actions: {
      selectScene: ScenePickerDialog._onSelectScene,
      toggleFolder: ScenePickerDialog._onToggleFolder,
      previewScene: ScenePickerDialog._onPreviewScene,
      closePreview: ScenePickerDialog._onClosePreview,
      cancel: ScenePickerDialog._onCancel,
    },
  };

  static PARTS = {
    form: {
      template: 'modules/storyframe/templates/scene-picker-dialog.hbs',
    },
  };

  constructor(options = {}) {
    super(options);
    this.resolve = null;
    this.promise = new Promise((resolve) => {
      this.resolve = resolve;
    });
    this.searchQuery = '';
    this._collapsedFolders = new Set();
  }

  /**
   * Open the Scene Picker dialog.
   * @returns {Promise<Scene|null>} The selected Scene document, or null if cancelled
   */
  static async open() {
    if (ScenePickerDialog._instance) {
      ScenePickerDialog._instance.bringToTop?.();
      return ScenePickerDialog._instance.promise;
    }

    const dialog = new ScenePickerDialog();
    ScenePickerDialog._instance = dialog;
    dialog.render(true);
    return dialog.promise;
  }

  async _prepareContext(_options) {
    const allScenes = game.scenes.contents;
    const q = this.searchQuery?.toLowerCase() || '';

    // Build full folder tree first (before filtering)
    const sceneFolders = game.folders.filter((f) => f.type === 'Scene');
    const folderMap = new Map();

    for (const folder of sceneFolders) {
      folderMap.set(folder.id, {
        id: folder.id,
        name: folder.name,
        color: folder.color || null,
        depth: folder.depth,
        parentId: folder.folder?.id || null,
        scenes: [],
        children: [],
        nameMatches: q ? folder.name.toLowerCase().includes(q) : false,
        hasVisibleContent: false,
      });
    }

    // Build parent-child relationships
    for (const [, folder] of folderMap) {
      if (folder.parentId && folderMap.has(folder.parentId)) {
        folderMap.get(folder.parentId).children.push(folder);
      }
    }

    // Propagate folder name matches down: if a parent matches, all descendants match too
    if (q) {
      const propagateMatch = (folder) => {
        for (const child of folder.children) {
          if (folder.nameMatches) child.nameMatches = true;
          propagateMatch(child);
        }
      };
      for (const folder of folderMap.values()) {
        if (!folder.parentId || !folderMap.has(folder.parentId)) {
          propagateMatch(folder);
        }
      }
    }

    // Assign ALL scenes to their folders, filtering by query OR folder name match
    const rootScenes = [];
    for (const scene of allScenes) {
      const sceneMatches = !q || scene.name.toLowerCase().includes(q);
      const folderId = scene.folder?.id;
      const folderEntry = folderId ? folderMap.get(folderId) : null;
      const folderMatches = folderEntry?.nameMatches || false;

      if (!sceneMatches && !folderMatches) continue;

      const entry = {
        id: scene.id,
        name: scene.name,
        thumbnail: scene.thumbnail || 'icons/svg/mystery-man.svg',
        backgroundSrc: scene.background?.src || scene.thumbnail || null,
        isActive: scene.active,
      };
      if (folderEntry) {
        folderEntry.scenes.push(entry);
      } else {
        rootScenes.push(entry);
      }
    }

    // Mark folders that have visible content (bottom-up)
    const markVisible = (folder) => {
      for (const child of folder.children) {
        markVisible(child);
      }
      folder.hasVisibleContent =
        folder.scenes.length > 0 || folder.children.some((c) => c.hasVisibleContent);
    };
    for (const folder of folderMap.values()) {
      if (!folder.parentId || !folderMap.has(folder.parentId)) {
        markVisible(folder);
      }
    }

    // Collect root-level folders
    const rootFolders = [...folderMap.values()]
      .filter((f) => !f.parentId || !folderMap.has(f.parentId))
      .filter((f) => f.hasVisibleContent)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    // Flatten tree into entries array for simple template rendering
    const INDENT_PX = 20;
    const entries = [];
    const isSearching = q.length > 0;

    const flatten = (folders, depth) => {
      for (const folder of folders) {
        const isCollapsed = !isSearching && this._collapsedFolders.has(folder.id);
        entries.push({
          type: 'folder',
          folderId: folder.id,
          name: folder.name,
          color: folder.color,
          indent: depth * INDENT_PX,
          isCollapsed,
        });
        // Skip children if collapsed (but always show when searching)
        if (isCollapsed) continue;
        // Recurse children
        const sortedChildren = folder.children
          .filter((c) => c.hasVisibleContent)
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        flatten(sortedChildren, depth + 1);
        // Scenes inside this folder
        for (const scene of folder.scenes.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))) {
          entries.push({ ...scene, type: 'scene', indent: (depth + 1) * INDENT_PX });
        }
      }
    };

    flatten(rootFolders, 0);

    // Root scenes (no folder) at the end
    for (const scene of rootScenes.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))) {
      entries.push({ ...scene, type: 'scene', indent: 0 });
    }

    return {
      entries,
      searchQuery: this.searchQuery,
      hasScenes: entries.some((e) => e.type === 'scene'),
      i18n: {
        searchPlaceholder: game.i18n.localize('STORYFRAME.CinematicScene.SearchScenes'),
        noScenesFound: game.i18n.localize('STORYFRAME.CinematicScene.NoScenesFound'),
        cancel: game.i18n.localize('STORYFRAME.Dialogs.Cancel'),
        activeLabel: game.i18n.localize('STORYFRAME.CinematicScene.ActiveScene'),
        previewTooltip: game.i18n.localize('STORYFRAME.CinematicScene.PreviewScene'),
        clickToClose: game.i18n.localize('STORYFRAME.CinematicScene.ClickToClose'),
      },
    };
  }

  async _onRender(_context, _options) {
    super._onRender(_context, _options);

    const searchInput = this.element.querySelector('.scene-picker-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this._debouncedRender();
      });
      // Maintain focus after re-render
      searchInput.focus();
      searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
    }

    // Escape key closes preview overlay if open
    const overlay = this.element.querySelector('.scene-preview-overlay');
    if (overlay) {
      this.element.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('active')) {
          e.stopPropagation();
          overlay.classList.remove('active');
        }
      });
    }
  }

  _debouncedRender = foundry.utils.debounce(() => this.render(), 150);

  static _onPreviewScene(event, target) {
    event.stopPropagation(); // Don't trigger selectScene on the parent row
    const sceneId = target.closest('[data-scene-id]')?.dataset.sceneId;
    if (!sceneId) return;
    const scene = game.scenes.get(sceneId);
    if (!scene) return;

    const src = scene.background?.src || scene.thumbnail;
    if (!src) return;

    const overlay = this.element.querySelector('.scene-preview-overlay');
    if (!overlay) return;

    overlay.querySelector('.scene-preview-image').src = src;
    overlay.querySelector('.scene-preview-name').textContent = scene.name;
    overlay.classList.add('active');
  }

  static _onClosePreview(event) {
    event.stopPropagation();
    const overlay = this.element.querySelector('.scene-preview-overlay');
    overlay?.classList.remove('active');
  }

  static _onToggleFolder(_event, target) {
    const folderId = target.closest('[data-folder-id]')?.dataset.folderId;
    if (!folderId) return;
    if (this._collapsedFolders.has(folderId)) {
      this._collapsedFolders.delete(folderId);
    } else {
      this._collapsedFolders.add(folderId);
    }
    this.render();
  }

  static async _onSelectScene(_event, target) {
    const sceneId = target.closest('[data-scene-id]')?.dataset.sceneId;
    if (!sceneId) return;
    const scene = game.scenes.get(sceneId);
    if (!scene) return;

    const resolve = this.resolve;
    this.resolve = null;
    resolve(scene);
    this.close();
  }

  static async _onCancel() {
    const resolve = this.resolve;
    this.resolve = null;
    resolve(null);
    this.close();
  }

  async close(options = {}) {
    ScenePickerDialog._instance = null;
    if (this.resolve) {
      this.resolve(null);
      this.resolve = null;
    }
    return super.close(options);
  }
}
