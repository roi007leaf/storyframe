/**
 * Raise My Hand Integration
 * Adds hand-raise indicators and control buttons to cinematic mode.
 * Uses the raise-my-hand module's public API and stateChanged hook.
 */

import { loadCSS, unloadCSS } from '../css-loader.mjs';

const RMH_MODULE_ID = 'raise-my-hand';
const CSS_PATH = 'styles/integrations/raise-my-hand.css';

/**
 * Check if the raise-my-hand module is active and has an API.
 * @returns {object|null} The API object or null
 */
function getAPI() {
  const mod = game.modules.get(RMH_MODULE_ID);
  return (mod?.active && mod.api) ? mod.api : null;
}

// --- Cinematic Control Buttons ---

/**
 * Inject raise-hand and urgent-speak buttons into the cinematic UI.
 * @param {HTMLElement} container - The .cinematic-scene-container element
 * @returns {void}
 */
function injectCinematicControls(container) {
  const api = getAPI();
  if (!api) return;

  // Don't inject twice
  if (container.querySelector('.rmh-cinematic-controls')) return;

  const isToggle = api.isToggleMode();
  const isQueueMode = api.isQueueEnabled();

  // Create control container
  const controls = Object.assign(document.createElement('div'), {
    className: 'rmh-cinematic-controls'
  });

  // Raise hand button (always shown)
  const raiseBtn = Object.assign(document.createElement('button'), {
    type: 'button',
    className: 'player-utility-btn rmh-cinematic-raise'
  });
  raiseBtn.dataset.tooltip = game.i18n.localize('raise-my-hand.controls.raise-hand.name');
  raiseBtn.innerHTML = '<i class="fas fa-hand-paper" aria-hidden="true"></i>';

  if (api.isHandRaised(game.userId)) {
    raiseBtn.classList.add('active');
  }

  raiseBtn.addEventListener('click', () => {
    if (isToggle) {
      const isRaised = api.isHandRaised(game.userId);
      api.toggle(!isRaised);
    } else {
      api.raise();
    }
  });

  controls.appendChild(raiseBtn);

  // Urgent speak button (only in queue mode)
  if (isQueueMode) {
    const urgentBtn = Object.assign(document.createElement('button'), {
      type: 'button',
      className: 'player-utility-btn rmh-cinematic-urgent'
    });
    urgentBtn.dataset.tooltip = game.i18n.localize('raise-my-hand.controls.urgent-speak.name');
    urgentBtn.innerHTML = '<i class="fas fa-hand-paper" aria-hidden="true"></i>';

    urgentBtn.addEventListener('click', () => {
      api.urgentSpeak();
    });

    controls.appendChild(urgentBtn);
  }

  // Insert into the bottom row (left side of the camera/player bar)
  const bottomRow = container.querySelector('.cinematic-bottom-row');
  if (bottomRow) {
    bottomRow.prepend(controls);
  } else {
    container.appendChild(controls);
  }
}

/**
 * Update the visual state of injected cinematic control buttons.
 * @returns {void}
 */
function updateControlStates() {
  const api = getAPI();
  if (!api) return;

  const raiseBtn = document.querySelector('.rmh-cinematic-raise');
  if (!raiseBtn) return;

  raiseBtn.classList.toggle('active', api.isHandRaised(game.userId));

  const urgentBtn = document.querySelector('.rmh-cinematic-urgent');
  if (urgentBtn) {
    urgentBtn.classList.toggle('active', api.getUrgentUsers().has(game.userId));
  }
}

// --- Cinematic Indicators (PC portraits + camera views) ---

/**
 * Update or create raise-my-hand badges on cinematic PC portraits and camera views.
 * @returns {void}
 */
function updateCinematicIndicators() {
  const api = getAPI();
  if (!api) return;

  const useQueue = api.isQueueEnabled();
  const raisedHands = api.getRaisedHands();
  const urgentUsers = api.getUrgentUsers();

  // Update PC portrait badges
  document.querySelectorAll('.cinematic-pc-item[data-user-id]').forEach(pcItem => {
    const userId = pcItem.dataset.userId;
    if (!userId) return;

    let badge = pcItem.querySelector('.rmh-cinematic-badge');
    const isRaised = raisedHands.has(userId);
    const position = api.getQueuePosition(userId);
    const showBadge = isRaised || position > 0;

    if (showBadge) {
      const isSpeaking = useQueue && position === 1;
      const iconClass = isSpeaking ? 'fa-bullhorn' : 'fa-hand-paper';

      if (!badge) {
        badge = Object.assign(document.createElement('div'), {
          className: 'rmh-cinematic-badge'
        });
        badge.innerHTML = `<i class="fas ${iconClass}"></i><span class="rmh-queue-position"></span>`;
        pcItem.appendChild(badge);
      } else {
        badge.querySelector('i').className = `fas ${iconClass}`;
      }
      badge.querySelector('.rmh-queue-position').textContent = (useQueue && position > 1) ? position - 1 : '';
      badge.classList.toggle('speaking', isSpeaking);
      badge.classList.toggle('urgent', urgentUsers.has(userId));
    } else if (badge) {
      badge.remove();
    }
  });

  // Update camera feed badges (storyframe clones A/V feeds into .camera-feed-item elements)
  document.querySelectorAll('.cinematic-bottom-row .camera-feed-item[data-user-id]').forEach(cameraView => {
    const userId = cameraView.dataset.userId;
    if (!userId) return;

    let badge = cameraView.querySelector('.rmh-cinematic-badge');
    const position = api.getQueuePosition(userId);
    const isRaised = raisedHands.has(userId);
    const showBadge = isRaised || position > 0;

    if (showBadge) {
      const isSpeaking = useQueue && position === 1;
      const iconClass = isSpeaking ? 'fa-bullhorn' : 'fa-hand-paper';

      if (!badge) {
        badge = Object.assign(document.createElement('div'), {
          className: 'rmh-cinematic-badge'
        });
        badge.innerHTML = `<i class="fas ${iconClass}"></i><span class="rmh-queue-position"></span>`;
        cameraView.appendChild(badge);
      } else {
        badge.querySelector('i').className = `fas ${iconClass}`;
      }
      badge.querySelector('.rmh-queue-position').textContent = (useQueue && position > 1) ? position - 1 : '';
      badge.classList.toggle('speaking', isSpeaking);
      badge.classList.toggle('urgent', urgentUsers.has(userId));
    } else if (badge) {
      badge.remove();
    }
  });

  updateControlStates();
}

/**
 * Remove all cinematic badges from the DOM.
 * @returns {void}
 */
function clearCinematicIndicators() {
  document.querySelectorAll('.rmh-cinematic-badge').forEach(badge => badge.remove());
}

// --- Lifecycle ---

/** @type {boolean} Whether the integration is currently active */
let _active = false;

/** @type {MutationObserver|null} Watches for camera feed items added after initial render */
let _bottomRowObserver = null;

/**
 * Called by CinematicSceneBase._onRender after each render.
 * Injects controls and updates indicators.
 * @param {HTMLElement} container - The .cinematic-scene-container element
 * @returns {void}
 */
export function onCinematicRender(container) {
  if (!getAPI()) return;

  if (!_active) {
    _active = true;
    loadCSS(CSS_PATH);
    Hooks.on('raise-my-hand.stateChanged', updateCinematicIndicators);
  }

  injectCinematicControls(container);
  updateCinematicIndicators();

  // Camera feeds are synced asynchronously after render (_initCameraRow → _syncCameraFeeds).
  // Observe the bottom row so we can apply badges once .camera-feed-item elements appear.
  _teardownBottomRowObserver();
  const bottomRow = container.querySelector('.cinematic-bottom-row');
  if (bottomRow) {
    _bottomRowObserver = new MutationObserver(() => updateCinematicIndicators());
    _bottomRowObserver.observe(bottomRow, { childList: true });
  }
}

/**
 * Called when the cinematic is closing.
 * Cleans up hooks and CSS.
 * @returns {void}
 */
export function onCinematicClose() {
  if (!_active) return;
  _active = false;
  _teardownBottomRowObserver();
  clearCinematicIndicators();
  Hooks.off('raise-my-hand.stateChanged', updateCinematicIndicators);
  unloadCSS(CSS_PATH);
}

/**
 * Disconnect the bottom row MutationObserver if active.
 * @returns {void}
 */
function _teardownBottomRowObserver() {
  if (_bottomRowObserver) {
    _bottomRowObserver.disconnect();
    _bottomRowObserver = null;
  }
}
