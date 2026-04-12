import { MODULE_ID } from '../constants.mjs';
import { loadCSS } from '../css-loader.mjs';

/**
 * Dialog for gathering tokens from the current scene as StoryFrame speakers.
 * Displays all actors on the canvas with checkboxes, lets the GM select which
 * to add, and creates a StoryFrame scene from the selection.
 */
export class SceneGathererDialog extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
) {
  /** Currently open instance — only one gatherer dialog at a time */
  static _instance = null;

  static DEFAULT_OPTIONS = {
    id: 'storyframe-scene-gatherer',
    window: {
      title: 'STORYFRAME.WindowTitles.SceneGatherer',
      icon: 'fas fa-users-viewfinder',
      minimizable: false,
      resizable: true,
    },
    position: {
      width: 520,
      height: 600,
    },
    classes: ['storyframe', 'scene-gatherer-dialog-app'],
    actions: {
      submit: SceneGathererDialog._onSubmit,
      cancel: SceneGathererDialog._onCancel,
    },
  };

  static PARTS = {
    form: {
      template: 'modules/storyframe/templates/scene-gatherer-dialog.hbs',
    },
  };

  constructor(sceneTokens, worldActors = [], options = {}) {
    super(options);
    loadCSS('styles/scene-gatherer-dialog.css');
    this.sceneTokens = sceneTokens;
    this.worldActors = worldActors;
    // Combined list for index-based selection (scene tokens first, then world actors)
    this.tokens = [...sceneTokens, ...worldActors];
    this.resolve = null;
    this.promise = new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  /**
   * Open the Scene Gatherer dialog.
   * Gathers tokens from the current FoundryVTT scene and world actors,
   * deduplicates by actor UUID, filters out loot/hazard types.
   * @returns {Promise<{sceneName: string, speakers: Array}|null>}
   */
  static async open() {
    if (SceneGathererDialog._instance) {
      SceneGathererDialog._instance.bringToTop?.();
      return SceneGathererDialog._instance.promise;
    }

    // Deduplicate by base actor ID — unlinked tokens each have a unique synthetic
    // actor UUID, so we use actorId (the world-level source actor) for dedup instead.
    const seen = new Set();
    const sceneTokens = [];
    const tokenDocs = canvas.scene?.tokens;

    if (tokenDocs) {
      for (const tokenDoc of tokenDocs) {
        const actor = tokenDoc.actor;
        if (!actor) continue;
        if (actor.type === 'loot' || actor.type === 'hazard') continue;
        if (actor.hasPlayerOwner) continue;
        const dedupeKey = tokenDoc.actorId || actor.uuid;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        // Prefer the world-level actor for UUID and data so speakers resolve correctly
        const baseActor = game.actors.get(tokenDoc.actorId);
        sceneTokens.push({
          actorUuid: baseActor?.uuid || actor.uuid,
          name: baseActor?.name || actor.name,
          img: baseActor?.img || actor.img || tokenDoc.texture?.src || null,
        });
      }
    }

    // Gather world actors (from the Actors tab) that aren't already on the scene
    const worldActors = [];
    for (const actor of game.actors) {
      if (actor.type === 'loot' || actor.type === 'hazard') continue;
      if (actor.hasPlayerOwner) continue;
      if (seen.has(actor.id)) continue;
      seen.add(actor.id);
      worldActors.push({
        actorUuid: actor.uuid,
        name: actor.name,
        img: actor.img || null,
      });
    }

    if (sceneTokens.length === 0 && worldActors.length === 0) {
      ui.notifications.warn(game.i18n.localize('STORYFRAME.Dialogs.SceneGatherer.NoActorsFound'));
      return null;
    }

    const dialog = new SceneGathererDialog(sceneTokens, worldActors);
    SceneGathererDialog._instance = dialog;
    dialog.render(true);
    return dialog.promise;
  }

  async _prepareContext(_options) {
    const unknownLabel = game.i18n.localize('STORYFRAME.UI.Labels.Unknown');
    const enrich = (t) => {
      const name = t.name || unknownLabel;
      return {
        actorUuid: t.actorUuid,
        name,
        nameLower: name.toLowerCase(),
        img: t.img || 'icons/svg/mystery-man.svg',
      };
    };

    const enrichedSceneTokens = this.sceneTokens.map((t, i) => ({ ...enrich(t), index: i }));
    const worldActorOffset = enrichedSceneTokens.length;
    const enrichedWorldActors = this.worldActors.map((t, i) => ({ ...enrich(t), index: worldActorOffset + i }));

    return {
      sceneTokens: enrichedSceneTokens,
      worldActors: enrichedWorldActors,
      hasSceneTokens: enrichedSceneTokens.length > 0,
      hasWorldActors: enrichedWorldActors.length > 0,
      defaultSceneName: canvas.scene?.name || '',
      i18n: {
        sceneName: game.i18n.localize('STORYFRAME.UI.Labels.SceneName'),
        sceneNamePlaceholder: game.i18n.localize('STORYFRAME.UI.Placeholders.EnterSceneName'),
        selectActors: game.i18n.localize('STORYFRAME.Dialogs.SceneGatherer.SelectActors'),
        selectAll: game.i18n.localize('STORYFRAME.UI.Labels.SelectAll'),
        deselectAll: game.i18n.localize('STORYFRAME.UI.Labels.Deselect'),
        cancel: game.i18n.localize('STORYFRAME.Dialogs.Cancel'),
        gather: game.i18n.localize('STORYFRAME.Dialogs.SceneGatherer.GatherButton'),
        sceneTokenCount: game.i18n.format('STORYFRAME.Dialogs.SceneGatherer.TokenCount', { count: enrichedSceneTokens.length }),
        worldActorCount: game.i18n.format('STORYFRAME.Dialogs.SceneGatherer.WorldActorCount', { count: enrichedWorldActors.length }),
        searchActors: game.i18n.localize('STORYFRAME.UI.Placeholders.SearchActors'),
      },
    };
  }

  async _onRender(_context, _options) {
    super._onRender(_context, _options);

    // Wire up actor checkboxes
    const checkboxes = this.element.querySelectorAll('input[name="actor"]');
    checkboxes.forEach(cb => cb.addEventListener('change', () => this._updateSubmitState()));

    // Wire up per-group select-all toggles
    const selectAllBtns = this.element.querySelectorAll('.select-all-btn');
    for (const btn of selectAllBtns) {
      btn.addEventListener('click', () => this._toggleSelectAll(btn.dataset.group));
    }

    // Wire up scene name input
    const nameInput = this.element.querySelector('input[name="sceneName"]');
    if (nameInput) {
      nameInput.addEventListener('input', () => this._updateSubmitState());
    }

    // Wire up world actor search filter
    const worldSearch = this.element.querySelector('.world-actor-search');
    if (worldSearch) {
      worldSearch.addEventListener('input', () => {
        const q = worldSearch.value.toLowerCase().trim();
        const cards = this.element.querySelectorAll('.world-actors-section .participant-card');
        for (const card of cards) {
          card.style.display = !q || card.dataset.name.includes(q) ? '' : 'none';
        }
      });
    }

    this._updateSubmitState();

    // Auto-size to content
    await new Promise((resolve) => setTimeout(resolve, 0));
    this.setPosition({ height: 'auto' });
  }

  /**
   * Enable/disable submit button based on selection state and scene name.
   */
  _updateSubmitState() {
    const submitBtn = this.element?.querySelector('.submit-btn');
    if (!submitBtn) return;

    const anyChecked = Array.from(
      this.element.querySelectorAll('input[name="actor"]'),
    ).some(cb => cb.checked);

    const nameInput = this.element.querySelector('input[name="sceneName"]');
    const hasName = nameInput?.value.trim().length > 0;

    submitBtn.disabled = !anyChecked || !hasName;

    // Update per-group select-all button text
    for (const btn of this.element.querySelectorAll('.select-all-btn')) {
      const group = btn.dataset.group;
      const grid = this.element.querySelector(`.participants-grid[data-group="${group}"]`);
      if (!grid) continue;
      const groupBoxes = Array.from(grid.querySelectorAll('input[name="actor"]'));
      const allChecked = groupBoxes.length > 0 && groupBoxes.every(cb => cb.checked);
      btn.textContent = allChecked
        ? game.i18n.localize('STORYFRAME.UI.Labels.Deselect')
        : game.i18n.localize('STORYFRAME.UI.Labels.SelectAll');
    }
  }

  /**
   * Toggle all actor checkboxes in a group on/off.
   * @param {string} group - The group identifier ('scene' or 'world')
   */
  _toggleSelectAll(group) {
    const grid = this.element.querySelector(`.participants-grid[data-group="${group}"]`);
    if (!grid) return;
    const checkboxes = Array.from(grid.querySelectorAll('input[name="actor"]'));
    const allChecked = checkboxes.every(cb => cb.checked);
    checkboxes.forEach(cb => (cb.checked = !allChecked));
    this._updateSubmitState();
  }

  static async _onSubmit(event, target) {
    event.preventDefault();
    const form = target.closest('form');

    const sceneName = form.querySelector('input[name="sceneName"]')?.value.trim();
    if (!sceneName) {
      ui.notifications.warn(game.i18n.localize('STORYFRAME.Notifications.Scene.SceneNameRequired'));
      return;
    }

    // Read checked checkboxes directly from the DOM to avoid FormDataExtended issues
    const checkedBoxes = Array.from(form.querySelectorAll('input[name="actor"]:checked'));
    const selectedIndices = checkedBoxes.map(cb => Number(cb.value)).filter(i => !Number.isNaN(i));

    if (selectedIndices.length === 0) return;

    // Build speaker objects directly from the tokens array by index
    const speakers = selectedIndices.map(idx => {
      const token = this.tokens[idx];
      return {
        id: foundry.utils.randomID(),
        actorUuid: token?.actorUuid || null,
        imagePath: token?.img || 'icons/svg/mystery-man.svg',
        label: token?.name || 'Unknown',
      };
    });

    // Save as StoryFrame scene
    const scenes = game.settings.get(MODULE_ID, 'speakerScenes') || [];
    const newScene = {
      id: foundry.utils.randomID(),
      name: sceneName,
      speakers: speakers.map(s => ({
        id: s.id,
        actorUuid: s.actorUuid,
        imagePath: s.imagePath,
        label: s.label,
      })),
      createdAt: Date.now(),
    };
    scenes.push(newScene);
    await game.settings.set(MODULE_ID, 'speakerScenes', scenes);

    // Replace current speakers with the gathered ones
    await game.storyframe.socketManager.requestUpdateSpeakers(speakers);

    ui.notifications.info(
      game.i18n.format('STORYFRAME.Notifications.SceneGatherer.SceneGathered', {
        name: sceneName,
        count: speakers.length,
      }),
    );

    const resolve = this.resolve;
    this.resolve = null;
    resolve({ sceneName, speakers });
    this.close();
  }

  static async _onCancel(_event, _target) {
    const resolve = this.resolve;
    this.resolve = null;
    resolve(null);
    this.close();
  }

  async close(options = {}) {
    SceneGathererDialog._instance = null;
    if (this.resolve) {
      this.resolve(null);
      this.resolve = null;
    }
    return super.close(options);
  }
}
