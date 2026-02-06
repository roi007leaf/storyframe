/**
 * Scene Editor Dialog
 * Dedicated interface for creating and editing speaker scenes
 */

import { MODULE_ID } from './constants.mjs';

/**
 * Show scene editor dialog
 * @param {Object} options - Editor options
 * @param {string} options.sceneId - ID of scene to edit (null for new)
 * @param {string} options.sceneName - Initial scene name
 * @param {Array} options.speakers - Initial speakers array
 * @param {HTMLElement} options.journalElement - Journal element for images/actors
 */
export async function showSceneEditor({ sceneId = null, sceneName = '', speakers = [], journalElement = null } = {}) {
  // Remove existing editor if any
  document.querySelector('.storyframe-scene-editor')?.remove();

  const isEditing = !!sceneId;

  // Resolve speakers to get current name/img values
  const editorSpeakers = await Promise.all(
    speakers.map(async (s) => {
      // If speaker has actorUuid, resolve from actor
      if (s.actorUuid) {
        const resolved = await game.storyframe.stateManager.resolveSpeaker(s);
        return {
          id: s.id,
          name: resolved.name,
          img: resolved.img,
          actorUuid: s.actorUuid,
        };
      } else {
        // For image speakers, use stored values directly (label/imagePath from state)
        return {
          id: s.id,
          name: s.label || s.name,
          img: s.imagePath || s.img,
        };
      }
    })
  );

  // Create editor dialog
  const editor = document.createElement('div');
  editor.className = 'storyframe-scene-editor';

  // Extract journal content
  let journalImages = [];
  let journalActors = [];

  async function extractJournalContent() {
    // Find current journal content element
    const selectors = [
      '.journal-entry-page.active .editor-content',
      '.journal-entry-page.active',
      '.journal-entry-pages',
      '.prosemirror',
    ];

    let contentElement = null;
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.isConnected) {
        contentElement = element;
        break;
      }
    }

    if (!contentElement) return;

    // Extract images and deduplicate by src
    const imgs = contentElement.querySelectorAll('img[src]');
    const imageMap = new Map();
    Array.from(imgs).forEach(img => {
      if (!imageMap.has(img.src)) {
        imageMap.set(img.src, {
          src: img.src,
          alt: img.alt || 'Image',
        });
      }
    });
    journalImages = Array.from(imageMap.values());

    // Extract actors from @Actor links
    const actorLinks = contentElement.querySelectorAll('a.content-link[data-type="Actor"]');
    const actorPromises = Array.from(actorLinks).map(async (link) => {
      const uuid = link.dataset.uuid;
      if (!uuid) return null;
      try {
        const actor = await fromUuid(uuid);
        if (!actor || actor.type === 'loot' || actor.type === 'hazard') return null;
        return {
          uuid,
          name: actor.name,
          img: actor.img,
        };
      } catch {
        return null;
      }
    });

    // Deduplicate by uuid after resolution
    const actorResults = (await Promise.all(actorPromises)).filter(a => a);
    const actorMap = new Map();
    actorResults.forEach(actor => {
      if (!actorMap.has(actor.uuid)) {
        actorMap.set(actor.uuid, actor);
      }
    });
    journalActors = Array.from(actorMap.values());
  }

  await extractJournalContent();

  const i18nTitle = isEditing
    ? game.i18n.localize('STORYFRAME.SceneEditor.TitleEdit')
    : game.i18n.localize('STORYFRAME.SceneEditor.TitleCreate');
  const i18nSceneName = game.i18n.localize('STORYFRAME.UI.Labels.SceneName');
  const i18nEnterSceneName = game.i18n.localize('STORYFRAME.UI.Placeholders.EnterSceneName');
  const i18nSpeakersCount = game.i18n.format('STORYFRAME.SceneEditor.SpeakersCount', { count: editorSpeakers.length });
  const i18nAddCurrentSpeakers = game.i18n.localize('STORYFRAME.UI.Tooltips.AddCurrentSpeakers');
  const i18nCurrent = game.i18n.localize('STORYFRAME.SceneEditor.Current');
  const i18nNoSpeakers = game.i18n.localize('STORYFRAME.SceneEditor.NoSpeakersMessage');
  const i18nJournalImages = game.i18n.format('STORYFRAME.SceneEditor.JournalImagesCount', { count: journalImages.length });
  const i18nJournalActors = game.i18n.format('STORYFRAME.SceneEditor.JournalActorsCount', { count: journalActors.length });
  const i18nCancel = game.i18n.localize('STORYFRAME.Dialogs.Cancel');
  const i18nSaveBtn = isEditing
    ? game.i18n.localize('STORYFRAME.SceneEditor.SaveChanges')
    : game.i18n.localize('STORYFRAME.SceneEditor.CreateScene');
  const i18nClose = game.i18n.localize('STORYFRAME.Dialogs.Close');

  editor.innerHTML = `
    <div class="editor-header">
      <h2>${i18nTitle}</h2>
      <button type="button" class="editor-close" aria-label="${i18nClose}">
        <i class="fas fa-times"></i>
      </button>
    </div>

    <div class="editor-body">
      <div class="editor-section">
        <label for="scene-name-input">${i18nSceneName}</label>
        <input type="text" id="scene-name-input" value="${sceneName}" placeholder="${i18nEnterSceneName}" autofocus>
      </div>

      <div class="editor-section">
        <div class="section-header">
          <h3>${i18nSpeakersCount}</h3>
          <div class="section-actions">
            <button type="button" class="btn-add-current" data-tooltip="${i18nAddCurrentSpeakers}">
              <i class="fas fa-users"></i> ${i18nCurrent}
            </button>
          </div>
        </div>
        <div class="speakers-list" data-drop-zone="true">
          ${editorSpeakers.length === 0 ? `<p class="empty-message">${i18nNoSpeakers}</p>` : ''}
        </div>
      </div>

      <div class="editor-section images-section" style="display: ${journalImages.length > 0 ? 'flex' : 'none'}">
        <h3>${i18nJournalImages}</h3>
        <div class="source-grid images-grid"></div>
      </div>

      <div class="editor-section actors-section" style="display: ${journalActors.length > 0 ? 'flex' : 'none'}">
        <h3>${i18nJournalActors}</h3>
        <div class="source-grid actors-grid"></div>
      </div>
    </div>

    <div class="editor-footer">
      <button type="button" class="btn-cancel">${i18nCancel}</button>
      <button type="button" class="btn-save">${i18nSaveBtn}</button>
    </div>
  `;

  document.body.appendChild(editor);

  // Get elements
  const nameInput = editor.querySelector('#scene-name-input');
  const speakersList = editor.querySelector('.speakers-list');
  const imagesGrid = editor.querySelector('.images-grid');
  const actorsGrid = editor.querySelector('.actors-grid');
  const btnAddCurrent = editor.querySelector('.btn-add-current');
  const btnSave = editor.querySelector('.btn-save');
  const btnCancel = editor.querySelector('.btn-cancel');
  const btnClose = editor.querySelector('.editor-close');

  // Render functions
  function renderSpeakers() {
    const header = speakersList.previousElementSibling.querySelector('h3');
    header.textContent = game.i18n.format('STORYFRAME.SceneEditor.SpeakersCount', { count: editorSpeakers.length });

    if (editorSpeakers.length === 0) {
      speakersList.innerHTML = `<p class="empty-message">${game.i18n.localize('STORYFRAME.SceneEditor.NoSpeakersMessage')}</p>`;
      return;
    }

    const removeTooltip = game.i18n.localize('STORYFRAME.UI.Labels.Remove');
    speakersList.innerHTML = editorSpeakers.map((speaker, idx) => `
      <div class="speaker-item" data-index="${idx}">
        <img src="${speaker.img}" alt="${speaker.name}">
        <span class="speaker-name">${speaker.name}</span>
        <button type="button" class="btn-remove" data-index="${idx}" data-tooltip="${removeTooltip}">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `).join('');

    // Attach remove handlers
    speakersList.querySelectorAll('.btn-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        editorSpeakers.splice(idx, 1);
        renderSpeakers();
        renderImages();
        renderActors();
      });
    });
  }

  function renderImages() {
    const section = editor.querySelector('.editor-section.images-section');

    // Filter out images already in speakers
    const availableImages = journalImages.filter(img =>
      !editorSpeakers.some(s => s.img === img.src)
    );

    // Show/hide section based on content
    if (journalImages.length === 0) {
      if (section) section.style.display = 'none';
      return;
    }

    if (!section) return;
    section.style.display = 'flex';

    // Update count in header
    const header = section.querySelector('h3');
    if (header) {
      header.textContent = game.i18n.format('STORYFRAME.SceneEditor.JournalImagesCount', { count: journalImages.length });
    }

    if (!imagesGrid) return;
    const addToSceneTooltip = game.i18n.localize('STORYFRAME.UI.Tooltips.AddToScene');
    imagesGrid.innerHTML = availableImages.map((img, idx) => `
      <div class="source-item" data-type="image" data-index="${idx}">
        <img src="${img.src}" alt="${img.alt}">
        <button type="button" class="btn-add" data-tooltip="${addToSceneTooltip}">
          <i class="fas fa-plus"></i>
        </button>
      </div>
    `).join('');

    imagesGrid.querySelectorAll('.btn-add').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.closest('.source-item').dataset.index);
        const img = availableImages[idx];

        if (!img) {
          console.error('StoryFrame | Image not found at index:', idx);
          return;
        }

        // Prompt for name
        let name;
        try {
          name = await foundry.applications.api.DialogV2.prompt({
            window: { title: game.i18n.localize('STORYFRAME.Dialogs.AddSpeaker.Title') },
            content: `<p>${game.i18n.localize('STORYFRAME.Dialogs.AddSpeaker.Content')}</p><input type="text" name="speakerName" value="${img.alt}" autofocus>`,
            ok: {
              label: game.i18n.localize('STORYFRAME.Dialogs.AddSpeaker.Button'),
              callback: (_event, button) => button.form.elements.speakerName.value,
            },
            rejectClose: false,
            modal: true,
          });
        } catch (err) {
          console.error('StoryFrame | Dialog error:', err);
          return;
        }

        if (!name) return;

        editorSpeakers.push({
          id: foundry.utils.randomID(),
          name,
          img: img.src,
        });
        renderSpeakers();
        renderImages();
        renderActors();
      });
    });
  }

  function renderActors() {
    const section = editor.querySelector('.editor-section.actors-section');

    // Filter out actors already in speakers
    const availableActors = journalActors.filter(actor =>
      !editorSpeakers.some(s => s.actorUuid === actor.uuid)
    );

    // Show/hide section based on content
    if (journalActors.length === 0) {
      if (section) section.style.display = 'none';
      return;
    }

    if (!section) return;
    section.style.display = 'flex';

    // Update count in header
    const header = section.querySelector('h3');
    if (header) {
      header.textContent = game.i18n.format('STORYFRAME.SceneEditor.JournalActorsCount', { count: journalActors.length });
    }

    if (!actorsGrid) return;
    const addToSceneTooltip = game.i18n.localize('STORYFRAME.UI.Tooltips.AddToScene');
    actorsGrid.innerHTML = availableActors.map((actor, idx) => `
      <div class="source-item" data-type="actor" data-index="${idx}">
        <img src="${actor.img}" alt="${actor.name}">
        <span class="source-name">${actor.name}</span>
        <button type="button" class="btn-add" data-tooltip="${addToSceneTooltip}">
          <i class="fas fa-plus"></i>
        </button>
      </div>
    `).join('');

    actorsGrid.querySelectorAll('.btn-add').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.closest('.source-item').dataset.index);
        const actor = availableActors[idx];

        editorSpeakers.push({
          id: foundry.utils.randomID(),
          name: actor.name,
          img: actor.img,
          actorUuid: actor.uuid,
        });
        renderSpeakers();
        renderImages();
        renderActors();
      });
    });
  }

  // Initial render
  renderSpeakers();
  renderImages();
  renderActors();

  // Add current speakers button
  if (btnAddCurrent) {
    btnAddCurrent.addEventListener('click', async () => {
      const state = game.storyframe.stateManager.getState();
      const currentSpeakers = state?.speakers || [];

      if (currentSpeakers.length === 0) {
        ui.notifications.warn(game.i18n.localize('STORYFRAME.Notifications.Scene.NoSpeakersToAdd'));
        return;
      }

      // Resolve and add speakers that aren't already in the scene
      let addedCount = 0;
      for (const speaker of currentSpeakers) {
        const exists = editorSpeakers.some(s =>
          s.actorUuid && s.actorUuid === speaker.actorUuid
        );
        if (!exists) {
          const resolved = await game.storyframe.stateManager.resolveSpeaker(speaker);
          editorSpeakers.push({
            id: speaker.id,
            name: resolved.name,
            img: resolved.img,
            actorUuid: speaker.actorUuid,
          });
          addedCount++;
        }
      }

      renderSpeakers();
      renderImages();
      renderActors();
      ui.notifications.info(game.i18n.format('STORYFRAME.Notifications.Scene.SpeakersAdded', { count: addedCount }));
    });
  }

  // Drag and drop support
  speakersList.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  speakersList.addEventListener('drop', async (e) => {
    e.preventDefault();

    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));

      if (data.type === 'Actor') {
        const actor = await fromUuid(data.uuid);
        if (!actor) {
          ui.notifications.error(game.i18n.localize('STORYFRAME.Notifications.Scene.ActorNotFound'));
          return;
        }

        if (actor.type === 'loot' || actor.type === 'hazard') {
          ui.notifications.warn(game.i18n.localize('STORYFRAME.Notifications.Scene.CannotAddLootOrHazard'));
          return;
        }

        // Check if already exists
        const exists = editorSpeakers.some(s => s.actorUuid === data.uuid);
        if (exists) {
          ui.notifications.warn(game.i18n.localize('STORYFRAME.Notifications.Scene.SpeakerAlreadyInScene'));
          return;
        }

        editorSpeakers.push({
          id: foundry.utils.randomID(),
          name: actor.name,
          img: actor.img,
          actorUuid: data.uuid,
        });

        renderSpeakers();
        renderImages();
        renderActors();
        ui.notifications.info(game.i18n.format('STORYFRAME.Notifications.Scene.SpeakerAdded', { actor: actor.name }));
      }
    } catch (err) {
      console.warn('StoryFrame | Drop failed:', err);
    }
  });

  // Save handler
  async function handleSave() {
    const name = nameInput.value.trim();

    if (!name) {
      ui.notifications.warn(game.i18n.localize('STORYFRAME.Notifications.Scene.SceneNameRequired'));
      nameInput.focus();
      return;
    }

    if (editorSpeakers.length === 0) {
      ui.notifications.warn(game.i18n.localize('STORYFRAME.Notifications.Scene.AddAtLeastOneSpeaker'));
      return;
    }

    const scenes = game.settings.get(MODULE_ID, 'speakerScenes') || [];

    if (isEditing) {
      // Update existing scene
      const updatedScenes = scenes.map(s =>
        s.id === sceneId
          ? { ...s, name, speakers: editorSpeakers, updatedAt: Date.now() }
          : s
      );
      await game.settings.set(MODULE_ID, 'speakerScenes', updatedScenes);
      ui.notifications.info(game.i18n.format('STORYFRAME.Notifications.Scene.SceneUpdated', { name }));
    } else {
      // Create new scene
      const newScene = {
        id: foundry.utils.randomID(),
        name,
        speakers: editorSpeakers,
        createdAt: Date.now(),
      };
      scenes.push(newScene);
      await game.settings.set(MODULE_ID, 'speakerScenes', scenes);
      ui.notifications.info(game.i18n.format('STORYFRAME.Notifications.Scene.SceneCreated', { name }));
    }

    editor.remove();
  }

  // Event handlers
  btnSave.addEventListener('click', handleSave);
  btnCancel.addEventListener('click', () => editor.remove());
  btnClose.addEventListener('click', () => editor.remove());

  // Make dialog draggable by header
  const header = editor.querySelector('.editor-header');
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  header.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return; // Don't drag when clicking close button
    isDragging = true;
    const rect = editor.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    editor.style.cursor = 'grabbing';
    header.style.cursor = 'grabbing';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.clientX - dragOffsetX;
    const y = e.clientY - dragOffsetY;
    editor.style.left = `${x}px`;
    editor.style.top = `${y}px`;
    editor.style.transform = 'none';
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      editor.style.cursor = '';
      header.style.cursor = 'move';
    }
  });

  // Enter to save
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  });

  // Escape to close
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      editor.remove();
    }
  };
  document.addEventListener('keydown', escHandler);

  // Watch journal for changes
  let journalObserver = null;

  // Find the active journal entry window
  function findJournalContent() {
    // Try multiple selectors for journal content
    const selectors = [
      '.journal-entry-page.active .editor-content',  // Edit mode
      '.journal-entry-page.active',                   // View mode
      '.journal-entry-pages',                         // General container
      '.prosemirror',                                 // ProseMirror editor
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.isConnected) {
        return element;
      }
    }
    return null;
  }

  const observeTarget = findJournalContent();
  if (observeTarget) {
    journalObserver = new MutationObserver(async () => {
      await extractJournalContent();
      renderImages();
      renderActors();
    });
    journalObserver.observe(observeTarget, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'data-uuid'],
    });
  }

  // Cleanup on remove
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.removedNodes) {
        if (node === editor) {
          document.removeEventListener('keydown', escHandler);
          if (journalObserver) journalObserver.disconnect();
          observer.disconnect();
        }
      }
    }
  });
  observer.observe(document.body, { childList: true });
}
