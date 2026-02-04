/**
 * Speaker Management Handler for GM Sidebar
 * Handles all speaker (NPC) related operations including add, remove, set active, and journal integration
 */

/**
 * Add a speaker from an image file picker
 */
export async function onAddSpeakerFromImage(_event, _target, sidebar) {
  new FilePicker({
    type: 'image',
    callback: async (path) => {
      const label = await foundry.applications.api.DialogV2.prompt({
        window: { title: 'NPC Name' },
        content: '<input type="text" name="label" placeholder="Enter NPC name" autofocus>',
        ok: {
          label: 'Add',
          callback: (event, button, _dialog) => button.form.elements.label.value,
        },
        rejectClose: false,
      });

      if (label) {
        await game.storyframe.socketManager.requestAddSpeaker({
          imagePath: path,
          label,
        });
      }
    },
  }).render(true);
}

/**
 * Set a speaker as active
 */
export async function onSetSpeaker(_event, target, sidebar) {
  const speakerId = target.closest('[data-speaker-id]')?.dataset.speakerId;
  if (speakerId) {
    await game.storyframe.socketManager.requestSetActiveSpeaker(speakerId);
  }
}

/**
 * Remove a speaker
 */
export async function onRemoveSpeaker(event, target, sidebar) {
  event.stopPropagation();
  const speakerId = target.closest('[data-speaker-id]')?.dataset.speakerId;
  if (!speakerId) return;

  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title: 'Remove NPC' },
    content: '<p>Remove this NPC from the list?</p>',
    yes: { label: 'Remove' },
    no: { label: 'Cancel', default: true },
    rejectClose: false,
  });

  if (confirmed) {
    await game.storyframe.socketManager.requestRemoveSpeaker(speakerId);
  }
}

/**
 * Clear the active speaker
 */
export async function onClearSpeaker(_event, _target, sidebar) {
  await game.storyframe.socketManager.requestSetActiveSpeaker(null);
}

/**
 * Clear all speakers
 */
export async function onClearAllSpeakers(_event, _target, sidebar) {
  const state = game.storyframe.stateManager.getState();
  if (!state?.speakers?.length) return;

  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title: 'Clear All NPCs' },
    content: '<p>Remove all NPCs from the list?</p>',
    yes: { label: 'Clear All' },
    no: { label: 'Cancel', default: true },
    rejectClose: false,
  });

  if (confirmed) {
    await game.storyframe.socketManager.requestUpdateSpeakers([]);
  }
}

/**
 * Set an image from journal as speaker
 */
export async function onSetImageAsSpeaker(_event, target, sidebar) {
  const imageSrc = target.dataset.imageSrc;
  if (!imageSrc) return;

  const label = await foundry.applications.api.DialogV2.prompt({
    window: { title: 'NPC Name' },
    content: '<input type="text" name="label" placeholder="Enter NPC name" autofocus>',
    ok: {
      label: 'Add',
      callback: (event, button, _dialog) => button.form.elements.label.value,
    },
    rejectClose: false,
  });

  if (label) {
    await game.storyframe.socketManager.requestAddSpeaker({
      imagePath: imageSrc,
      label,
    });
    ui.notifications.info(`Added ${label} as NPC`);
  }
}

/**
 * Set an actor from journal as speaker
 */
export async function onSetActorAsSpeaker(_event, target, sidebar) {
  const actorId = target.dataset.actorId;
  if (!actorId) return;

  const actor = game.actors.get(actorId);
  if (!actor) {
    ui.notifications.error('Actor not found');
    return;
  }

  await game.storyframe.socketManager.requestAddSpeaker({
    actorUuid: actor.uuid,
    imagePath: actor.img,
    label: actor.name,
  });
  ui.notifications.info(`Added ${actor.name} as NPC`);
}

/**
 * Extract images from parent journal content
 */
export function extractJournalImages(sidebar) {
  if (!sidebar.parentInterface?.element) return [];

  // ApplicationV2 uses element directly (HTMLElement), not jQuery/array
  const element = sidebar.parentInterface.element?.closest ?
    sidebar.parentInterface.element :
    sidebar.parentInterface.element?.[0] || sidebar.parentInterface.element;

  // Get ALL page content elements (supports multi-page view)
  const contentElements = element.querySelectorAll('.journal-page-content');
  if (contentElements.length === 0) return [];

  // Get current speakers to filter out (normalize paths for comparison)
  const state = game.storyframe.stateManager.getState();
  const speakerImages = new Set();
  if (state?.speakers) {
    state.speakers.forEach((speaker) => {
      if (speaker.imagePath) speakerImages.add(normalizeImagePath(speaker.imagePath));
    });
  }

  const images = [];

  // Query images from ALL page content elements
  contentElements.forEach((content) => {
    const imgElements = content.querySelectorAll('img');
    imgElements.forEach((img) => {
      const normalizedSrc = normalizeImagePath(img.src);
      if (img.src && !img.src.includes('icons/svg/mystery-man') && !speakerImages.has(normalizedSrc)) {
        images.push({
          src: img.src,
          alt: img.alt || 'Image',
          id: foundry.utils.randomID(),
        });
      }
    });
  });

  // Remove duplicates by src
  const unique = [];
  const seen = new Set();
  images.forEach((img) => {
    if (!seen.has(img.src)) {
      seen.add(img.src);
      unique.push(img);
    }
  });

  return unique;
}

/**
 * Extract actors from parent journal content
 */
export function extractJournalActors(sidebar) {
  if (!sidebar.parentInterface?.element) return [];

  // ApplicationV2 uses element directly (HTMLElement), not jQuery/array
  const element = sidebar.parentInterface.element?.closest ?
    sidebar.parentInterface.element :
    sidebar.parentInterface.element?.[0] || sidebar.parentInterface.element;

  // Get ALL page content elements (supports multi-page view)
  const contentElements = element.querySelectorAll('.journal-page-content');
  if (contentElements.length === 0) return [];

  // Get current speakers to filter out (extract actor IDs for comparison)
  // This handles UUID format mismatches (e.g., "Actor.id" vs "Compendium.xxx.Actor.id")
  const state = game.storyframe.stateManager.getState();
  const speakerActorIds = new Set();
  if (state?.speakers) {
    state.speakers.forEach((speaker) => {
      if (speaker.actorUuid) {
        const actorId = extractActorIdFromUuid(speaker.actorUuid);
        if (actorId) speakerActorIds.add(actorId);
      }
    });
  }

  const actors = [];

  // Query actor links from ALL page content elements
  contentElements.forEach((content) => {
    // Find all content links that reference actors
    // Handles both @Actor[id] and @UUID[Actor.id] formats
    const actorLinks = content.querySelectorAll('a.content-link[data-uuid^="Actor."], a.content-link[data-uuid*="Actor."]');

    actorLinks.forEach((link) => {
      const uuid = link.dataset.uuid;

      // Extract actor ID from UUID (handles both "Actor.id" and full UUIDs)
      const actorId = extractActorIdFromUuid(uuid);

      if (!actorId) return;

      const actorName = link.textContent || 'Unknown';

      // Compare by actor ID to handle UUID format mismatches
      if (!speakerActorIds.has(actorId)) {
        const actor = game.actors.get(actorId);
        if (actor && actor.type !== 'loot' && actor.type !== 'hazard') {
          actors.push({
            id: actorId,
            name: actorName,
            img: actor.img,
          });
        }
      }
    });
  });

  // Remove duplicates by id
  const unique = [];
  const seen = new Set();
  actors.forEach((actor) => {
    if (!seen.has(actor.id)) {
      seen.add(actor.id);
      unique.push(actor);
    }
  });

  return actors;
}

/**
 * Show enlarged image in a popup
 */
export function showEnlargedImage(src, name) {
  // Remove existing popup if any
  document.querySelector('.storyframe-image-popup')?.remove();

  const popup = document.createElement('div');
  popup.className = 'storyframe-image-popup';
  popup.innerHTML = `
    <div class="popup-backdrop"></div>
    <div class="popup-content">
      <img src="${src}" alt="${name}">
      <div class="popup-name">${name}</div>
    </div>
  `;

  // Close on click anywhere
  popup.addEventListener('click', () => popup.remove());

  // Close on escape key
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      popup.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  document.body.appendChild(popup);
}

/**
 * Attach right-click context menu for image enlargement
 */
export function attachImageContextMenu(sidebar) {
  // NPC speaker thumbnails
  const images = sidebar.element.querySelectorAll('.speaker-thumbnail img');
  images.forEach((img) => {
    img.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const name =
        img.alt ||
        img.closest('.speaker-thumbnail')?.querySelector('.speaker-name')?.textContent ||
        'NPC';
      showEnlargedImage(img.src, name);
    });
  });

  // Journal images
  const journalImages = sidebar.element.querySelectorAll('.journal-image-item-thumb img');
  journalImages.forEach((img) => {
    img.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const name = img.alt || 'Image';
      showEnlargedImage(img.src, name);
    });
  });

  // Journal actors
  const journalActors = sidebar.element.querySelectorAll('.journal-actor-item-thumb img');
  journalActors.forEach((img) => {
    img.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const name = img.alt || 'Actor';
      showEnlargedImage(img.src, name);
    });
  });
}

/**
 * Attach right-click handler to open player windows button (to close)
 */
export function attachPlayerWindowsContextMenu(sidebar) {
  const btn = sidebar.element.querySelector('[data-action="openPlayerWindows"]');
  if (btn) {
    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClosePlayerWindows(e, btn, sidebar);
    });
  }
}

/**
 * Open player windows
 */
export async function onOpenPlayerWindows(_event, _target, sidebar) {
  game.storyframe.socketManager.openAllPlayerViewers();
  ui.notifications.info('Opening StoryFrame on all player clients');
}

/**
 * Close player windows
 */
export async function onClosePlayerWindows(_event, _target, sidebar) {
  game.storyframe.socketManager.closeAllPlayerViewers();
  ui.notifications.info('Closing StoryFrame on all player clients');
}

// --- Helper Functions ---

/**
 * Normalize an image path for comparison by extracting just the path portion.
 * Handles both relative paths (modules/foo/bar.webp) and absolute URLs (http://localhost/modules/foo/bar.webp).
 * @param {string} path - The image path or URL
 * @returns {string} - Normalized path for comparison
 */
function normalizeImagePath(path) {
  if (!path) return '';
  try {
    // If it's a full URL, extract pathname
    const url = new URL(path, window.location.origin);
    // Remove leading slash for consistent comparison
    return url.pathname.replace(/^\//, '');
  } catch {
    // If URL parsing fails, just clean up the path
    return path.replace(/^\//, '');
  }
}

/**
 * Extract actor ID from a UUID string.
 * Handles both "Actor.id" and "Compendium.module.pack.Actor.id" formats.
 * @param {string} uuid - The UUID string
 * @returns {string|null} - The actor ID or null if not found
 */
function extractActorIdFromUuid(uuid) {
  if (!uuid || !uuid.includes('Actor.')) return null;
  return uuid.split('Actor.')[1]?.split('.')[0] || null;
}
