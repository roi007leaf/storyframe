/**
 * Speaker Selection Wheel
 * Radial menu for quick NPC speaker selection via keybind
 * Supports speaker scenes (saved groups)
 */

import { MODULE_ID } from './constants.mjs';
import { showSceneEditor } from './scene-editor.mjs';

// Remember last selected scene for the session
let lastSelectedSceneId = null;

// Track mouse position for wheel placement
let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;

// Remember initial wheel position to prevent jumping on scene transitions
let initialWheelX = null;
let initialWheelY = null;

/**
 * Initialize mouse tracking for speaker wheel positioning
 * Called once on module ready to ensure accurate positioning
 */
export function initMouseTracking() {
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });
}

/**
 * Show radial speaker selection wheel
 * Level 1: Shows scenes if any exist, otherwise shows speakers
 * If a scene was previously selected, show it directly
 */
export async function showSpeakerWheel() {
  // Save initial position for this wheel session
  initialWheelX = mouseX;
  initialWheelY = mouseY;

  // Check for saved scenes
  const scenes = game.settings.get(MODULE_ID, 'speakerScenes') || [];


  if (scenes.length > 0) {
    // If we have a last selected scene, show it directly
    if (lastSelectedSceneId) {
      const scene = scenes.find(s => s.id === lastSelectedSceneId);
      if (scene) {
        await showSceneSpeakers(lastSelectedSceneId);
        return;
      } else {
        // Scene was deleted, clear the memory
        lastSelectedSceneId = null;
      }
    }

    // Show scene selection wheel
    await showSceneWheel(scenes);
  } else {
    // No scenes, show speakers directly
    await showSpeakersWheel();
  }
}

/**
 * Show scene selection wheel (Level 1)
 */
async function showSceneWheel(scenes) {
  // Remove existing wheel
  document.querySelector('.storyframe-speaker-wheel')?.remove();

  // Create wheel container
  const wheel = document.createElement('div');
  wheel.className = 'storyframe-speaker-wheel';

  // Calculate radial positions
  const radius = calculateRadius(scenes.length);
  const angleStep = (2 * Math.PI) / scenes.length;

  // Generate scene items
  const items = scenes.map((scene, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    const item = document.createElement('div');
    item.className = 'speaker-wheel-item scene';
    item.dataset.sceneId = scene.id;
    item.style.transform = `translate(${x}px, ${y}px)`;

    item.innerHTML = `
      <div class="scene-icon-wrapper">
        <i class="fas fa-users scene-icon"></i>
      </div>
      <span class="speaker-label">${scene.name}</span>
    `;

    return item;
  });

  // Center cancel button
  const centerBtn = document.createElement('div');
  centerBtn.className = 'speaker-wheel-center';
  centerBtn.innerHTML = `
    <i class="fas fa-times"></i>
    <span class="center-label">${game.i18n.localize('STORYFRAME.Dialogs.Cancel')}</span>
  `;

  // Append elements
  wheel.appendChild(centerBtn);
  items.forEach(item => wheel.appendChild(item));

  // Position at initial cursor location
  wheel.style.left = `${initialWheelX || mouseX}px`;
  wheel.style.top = `${initialWheelY || mouseY}px`;

  // Event handlers
  wheel.querySelectorAll('.speaker-wheel-item.scene').forEach(item => {
    // Left click: show scene speakers (or edit with Shift)
    item.addEventListener('click', async (e) => {
      e.stopPropagation();
      const sceneId = item.dataset.sceneId;
      const scene = scenes.find(s => s.id === sceneId);

      // Shift+click: Edit scene in dedicated editor
      if (e.shiftKey) {
        hideSpeakerWheel();
        const journalElement = document.querySelector('.journal-entry-pages');
        await showSceneEditor({
          sceneId: scene.id,
          sceneName: scene.name,
          speakers: scene.speakers || [],
          journalElement,
        });
        return;
      }

      // Normal click: show scene speakers
      lastSelectedSceneId = sceneId;
      await showSceneSpeakers(sceneId);
    });

    // Right click: load scene speakers (replace all current speakers)
    item.addEventListener('contextmenu', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const sceneId = item.dataset.sceneId;
      const scene = scenes.find(s => s.id === sceneId);

      // Load the scene's speakers
      await game.storyframe.socketManager.requestUpdateSpeakers(scene.speakers || []);

      // Hide the wheel
      hideSpeakerWheel();
    });
  });

  centerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    hideSpeakerWheel();
  });

  // Escape key handler
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      hideSpeakerWheel();
    }
  };
  wheel._escHandler = escHandler;
  document.addEventListener('keydown', escHandler);

  document.body.appendChild(wheel);
}

/**
 * Show speakers from a scene (Level 2)
 */
async function showSceneSpeakers(sceneId) {
  const scenes = game.settings.get(MODULE_ID, 'speakerScenes') || [];
  const scene = scenes.find(s => s.id === sceneId);

  if (!scene || !scene.speakers || scene.speakers.length === 0) {
    ui.notifications.warn(game.i18n.localize('STORYFRAME.Notifications.Speaker.SceneHasNoSpeakers'));
    hideSpeakerWheel();
    return;
  }

  // Remove existing wheel
  document.querySelector('.storyframe-speaker-wheel')?.remove();

  // Get current state to check active speaker
  const state = game.storyframe.stateManager.getState();

  // Resolve speaker data and match with current state
  const resolvedSpeakers = await Promise.all(
    scene.speakers.map(async (s) => {
      // Always resolve speakers consistently (uses label as source of truth)
      const resolved = await game.storyframe.stateManager.resolveSpeaker(s);

      // For actor-based speakers, try to match with current state
      if (s.actorUuid) {
        const currentSpeaker = state?.speakers?.find(cs => cs.actorUuid === s.actorUuid);
        const finalId = currentSpeaker?.id || s.id;

        return {
          id: finalId,
          img: resolved.img,
          name: resolved.name,
        };
      } else {
        // For image speakers, use resolved values
        return {
          id: s.id,
          img: resolved.img,
          name: resolved.name,
        };
      }
    }),
  );

  // Create wheel
  const wheel = document.createElement('div');
  wheel.className = 'storyframe-speaker-wheel';

  const radius = calculateRadius(scene.speakers.length);
  const angleStep = (2 * Math.PI) / scene.speakers.length;

  // Generate speaker items
  const items = resolvedSpeakers.map((speaker, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    const isActive = state.activeSpeaker === speaker.id;

    const item = document.createElement('div');
    item.className = `speaker-wheel-item ${isActive ? 'active' : ''}`;
    item.dataset.speakerId = speaker.id;
    item.dataset.sceneId = sceneId;
    item.style.transform = `translate(${x}px, ${y}px)`;

    item.innerHTML = `
      <img src="${speaker.img}" alt="${speaker.name}" />
      <span class="speaker-label">${speaker.name}</span>
    `;

    return item;
  });

  // Center back button
  const centerBtn = document.createElement('div');
  centerBtn.className = 'speaker-wheel-center back-button';
  centerBtn.innerHTML = `
    <i class="fas fa-arrow-left"></i>
    <span class="center-label">${game.i18n.localize('STORYFRAME.SpeakerWheel.Back')}</span>
  `;

  // Append elements
  wheel.appendChild(centerBtn);
  items.forEach(item => wheel.appendChild(item));

  // Position at initial cursor location
  wheel.style.left = `${initialWheelX || mouseX}px`;
  wheel.style.top = `${initialWheelY || mouseY}px`;

  // Event handlers
  wheel.querySelectorAll('.speaker-wheel-item').forEach(item => {
    // Left click: set active speaker or deselect if already active
    item.addEventListener('click', async (e) => {
      e.stopPropagation();
      const speakerId = item.dataset.speakerId;
      const currentState = game.storyframe.stateManager.getState();
      const isAlreadyActive = currentState?.activeSpeaker === speakerId;

      if (isAlreadyActive) {
        // Deselect the active speaker
        await game.storyframe.socketManager.requestSetActiveSpeaker(null);
        // Update UI: remove active class from all items
        wheel.querySelectorAll('.speaker-wheel-item').forEach(i => i.classList.remove('active'));
      } else {
        // Select new speaker
        await game.storyframe.socketManager.requestSetActiveSpeaker(speakerId);
        // Update UI: remove active from all, add to this one
        wheel.querySelectorAll('.speaker-wheel-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
      }
    });

    // Right click: clear active speaker if this is the active one
    item.addEventListener('contextmenu', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const speakerId = item.dataset.speakerId;
      const currentState = game.storyframe.stateManager.getState();
      if (currentState?.activeSpeaker === speakerId) {
        await game.storyframe.socketManager.requestSetActiveSpeaker(null);
        // Update UI: remove active class from all items
        wheel.querySelectorAll('.speaker-wheel-item').forEach(i => i.classList.remove('active'));
      }
    });
  });

  // Back button handler
  centerBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    // Go back to scene selection (don't use showSpeakerWheel as it would use memory)
    const scenes = game.settings.get(MODULE_ID, 'speakerScenes') || [];
    await showSceneWheel(scenes);
  });

  // Escape key handler
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      hideSpeakerWheel();
    }
  };
  wheel._escHandler = escHandler;
  document.addEventListener('keydown', escHandler);

  document.body.appendChild(wheel);
}

/**
 * Show speakers wheel directly (when no scenes exist)
 */
async function showSpeakersWheel() {
  const state = game.storyframe.stateManager.getState();
  const speakers = state?.speakers || [];

  if (speakers.length === 0) {
    ui.notifications.info(game.i18n.localize('STORYFRAME.Notifications.Speaker.NoNPCsAvailable'));
    return;
  }

  // Remove existing wheel
  document.querySelector('.storyframe-speaker-wheel')?.remove();

  // Resolve speaker data
  const resolvedSpeakers = await Promise.all(
    speakers.map(async (s) => {
      const resolved = await game.storyframe.stateManager.resolveSpeaker(s);
      return {
        id: s.id,
        img: resolved.img,
        name: resolved.name,
      };
    }),
  );

  // Create wheel
  const wheel = document.createElement('div');
  wheel.className = 'storyframe-speaker-wheel';

  const radius = calculateRadius(speakers.length);
  const angleStep = (2 * Math.PI) / speakers.length;

  // Generate speaker items
  const items = resolvedSpeakers.map((speaker, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    const isActive = state.activeSpeaker === speaker.id;

    const item = document.createElement('div');
    item.className = `speaker-wheel-item ${isActive ? 'active' : ''}`;
    item.dataset.speakerId = speaker.id;
    item.style.transform = `translate(${x}px, ${y}px)`;

    item.innerHTML = `
      <img src="${speaker.img}" alt="${speaker.name}" />
      <span class="speaker-label">${speaker.name}</span>
    `;

    return item;
  });

  // Center clear button
  const centerBtn = document.createElement('div');
  centerBtn.className = 'speaker-wheel-center';
  centerBtn.innerHTML = `
    <i class="fas fa-times"></i>
    <span class="center-label">${game.i18n.localize('STORYFRAME.UI.Labels.ClearAll')}</span>
  `;

  // Append elements
  wheel.appendChild(centerBtn);
  items.forEach(item => wheel.appendChild(item));

  // Position at initial cursor location
  wheel.style.left = `${initialWheelX || mouseX}px`;
  wheel.style.top = `${initialWheelY || mouseY}px`;

  // Event handlers
  wheel.querySelectorAll('.speaker-wheel-item').forEach(item => {
    // Left click: set active speaker or deselect if already active
    item.addEventListener('click', async (e) => {
      e.stopPropagation();
      const speakerId = item.dataset.speakerId;
      const currentState = game.storyframe.stateManager.getState();
      const isAlreadyActive = currentState?.activeSpeaker === speakerId;

      if (isAlreadyActive) {
        // Deselect the active speaker
        await game.storyframe.socketManager.requestSetActiveSpeaker(null);
        // Update UI: remove active class from all items
        wheel.querySelectorAll('.speaker-wheel-item').forEach(i => i.classList.remove('active'));
      } else {
        // Select new speaker
        await game.storyframe.socketManager.requestSetActiveSpeaker(speakerId);
        // Update UI: remove active from all, add to this one
        wheel.querySelectorAll('.speaker-wheel-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
      }
    });

    // Right click: clear active speaker if this is the active one
    item.addEventListener('contextmenu', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const speakerId = item.dataset.speakerId;
      const currentState = game.storyframe.stateManager.getState();
      if (currentState?.activeSpeaker === speakerId) {
        await game.storyframe.socketManager.requestSetActiveSpeaker(null);
        // Update UI: remove active class from all items
        wheel.querySelectorAll('.speaker-wheel-item').forEach(i => i.classList.remove('active'));
      }
    });
  });

  // Center clear button
  centerBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await game.storyframe.socketManager.requestSetActiveSpeaker(null);
    hideSpeakerWheel();
  });

  // Escape key handler
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      hideSpeakerWheel();
    }
  };
  wheel._escHandler = escHandler;
  document.addEventListener('keydown', escHandler);

  document.body.appendChild(wheel);
}

/**
 * Hide speaker wheel
 */
export function hideSpeakerWheel() {
  const wheel = document.querySelector('.storyframe-speaker-wheel');
  if (!wheel) return;

  // Cleanup escape handler
  if (wheel._escHandler) {
    document.removeEventListener('keydown', wheel._escHandler);
  }

  wheel.remove();
}

/**
 * Calculate appropriate radius based on item count
 */
function calculateRadius(count) {
  const baseRadius = 140;
  const itemSize = 100; // Updated to match new item width
  const minSpacing = 25;

  const neededCircumference = count * (itemSize + minSpacing);
  const calculatedRadius = neededCircumference / (2 * Math.PI);

  return Math.max(baseRadius, calculatedRadius);
}
