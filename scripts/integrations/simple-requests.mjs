/**
 * Simple Requests Integration
 * Adds request indicators and control buttons to cinematic mode.
 * Uses the simple-requests module's global API (window.SimplePrompts)
 * and polls the queue since the module doesn't expose state-change hooks.
 */

import { loadCSS, unloadCSS } from '../css-loader.mjs';

const SR_MODULE_ID = 'simple-requests';
const CSS_PATH = 'styles/integrations/simple-requests.css';

/** Request urgency levels */
const LEVEL_COMMON = 0;
const LEVEL_IMPORTANT = 1;
const LEVEL_URGENT = 2;

/**
 * Check if the simple-requests module is active.
 * @returns {boolean}
 */
function isActive() {
  return !!game.modules.get(SR_MODULE_ID)?.active;
}

/**
 * Get the current request queue.
 * @returns {Array<{userId: string, name: string, img: string, level: number, timestamp: number}>}
 */
function getQueue() {
  return CONFIG.ADV_REQUESTS?.queue ?? [];
}

/**
 * Get a user's active request from the queue.
 * @param {string} userId
 * @returns {{userId: string, name: string, img: string, level: number, timestamp: number}|undefined}
 */
function getRequest(userId) {
  return getQueue().find(r => r.userId === userId);
}

// --- Cinematic Control Buttons ---

/**
 * Inject request buttons into the cinematic UI.
 * Players get three buttons (one per urgency level).
 * @param {HTMLElement} container - The .cinematic-scene-container element
 */
function injectCinematicControls(container) {
  if (!isActive()) return;
  if (container.querySelector('.sr-cinematic-controls')) return;

  const controls = Object.assign(document.createElement('div'), {
    className: 'sr-cinematic-controls',
  });

  // GM: "Call Next" button to activate the top request in queue
  if (game.user.isGM) {
    const callNextBtn = Object.assign(document.createElement('button'), {
      type: 'button',
      className: 'player-utility-btn sr-cinematic-call-next',
    });
    callNextBtn.dataset.tooltip = game.i18n.localize('STORYFRAME.Integrations.SimpleRequests.CallNext');
    callNextBtn.innerHTML = '<i class="fas fa-bullhorn" aria-hidden="true"></i>';
    callNextBtn.addEventListener('click', () => {
      if (getQueue().length > 0) {
        window.SimplePrompts?.gm_callout_top_request();
      }
    });
    controls.appendChild(callNextBtn);
  }

  // Common request button
  const commonBtn = _createRequestButton('common', 'fa-comment', LEVEL_COMMON,
    game.i18n.localize('simple-requests.buttons.firstRequestTooltip'));
  controls.appendChild(commonBtn);

  // Important request button
  const importantBtn = _createRequestButton('important', 'fa-exclamation-circle', LEVEL_IMPORTANT,
    game.i18n.localize('simple-requests.buttons.secondRequestTooltip'));
  controls.appendChild(importantBtn);

  // Urgent request button
  const urgentBtn = _createRequestButton('urgent', 'fa-exclamation-triangle', LEVEL_URGENT,
    game.i18n.localize('simple-requests.buttons.thirdRequestTooltip'));
  controls.appendChild(urgentBtn);

  // Insert into the bottom row (left side, after RMH controls if present)
  const bottomRow = container.querySelector('.cinematic-bottom-row');
  if (bottomRow) {
    const rmhControls = bottomRow.querySelector('.rmh-cinematic-controls');
    if (rmhControls) {
      rmhControls.after(controls);
    } else {
      bottomRow.prepend(controls);
    }
  } else {
    container.appendChild(controls);
  }
}

/**
 * Create a request button element.
 * @private
 */
function _createRequestButton(levelClass, iconClass, level, tooltip) {
  const btn = Object.assign(document.createElement('button'), {
    type: 'button',
    className: `player-utility-btn sr-cinematic-request sr-level-${levelClass}`,
  });
  btn.dataset.tooltip = tooltip;
  btn.dataset.level = level;
  btn.innerHTML = `<i class="fas ${iconClass}" aria-hidden="true"></i>`;

  btn.addEventListener('click', () => {
    const existing = getRequest(game.userId);
    if (existing && existing.level === level) {
      // Toggle off: remove own request
      window.SimplePrompts?.removeRequest(game.userId);
    } else {
      // Create/upgrade request
      window.SimplePrompts?.createRequest({
        userId: game.userId,
        name: game.user.name,
        img: game.user.avatar,
        level,
        timestamp: Date.now(),
      });
    }
  });

  return btn;
}

/**
 * Give the floor to a specific user by removing their request and
 * broadcasting the epic prompt (mirrors gm_callout_top_request but for any user).
 * @param {string} userId
 */
function _calloutRequest(userId) {
  const queue = getQueue();
  const req = queue.find(r => r.userId === userId);
  if (!req) return;

  // Show epic prompt on all clients (handler also removes the request and syncs)
  try {
    window.SimplePrompts?.socket?.executeForEveryone('showEpicPrompt', req);
  } catch {
    // Fallback: just remove the request
    window.SimplePrompts?.removeRequest(userId);
  }

  _lastQueueSignature = '';
}

// --- Control State Updates ---

/**
 * Update the visual state of injected cinematic control buttons.
 */
function updateControlStates() {
  const existing = getRequest(game.userId);

  document.querySelectorAll('.sr-cinematic-request').forEach(btn => {
    const btnLevel = parseInt(btn.dataset.level);
    btn.classList.toggle('active', existing?.level === btnLevel);
  });
}

// --- Cinematic Indicators (PC portraits + camera views) ---

/** @type {string} Serialized last-known queue state for change detection */
let _lastQueueSignature = '';

/**
 * Build a signature string from the current queue for change detection.
 * @returns {string}
 */
function _getQueueSignature() {
  return getQueue().map(r => `${r.userId}:${r.level}`).join('|');
}

/**
 * Get the CSS class and icon for a request level.
 * @param {number} level
 * @returns {{levelClass: string, iconClass: string}}
 */
function _getLevelDisplay(level) {
  switch (level) {
    case LEVEL_URGENT: return { levelClass: 'urgent', iconClass: 'fa-exclamation-triangle' };
    case LEVEL_IMPORTANT: return { levelClass: 'important', iconClass: 'fa-exclamation-circle' };
    default: return { levelClass: 'common', iconClass: 'fa-comment' };
  }
}

/**
 * Update or create request badges on cinematic PC portraits and camera views.
 */
function updateCinematicIndicators() {
  if (!isActive()) return;

  const queue = getQueue();
  const requestByUser = new Map(queue.map(r => [r.userId, r]));

  // Update PC portrait badges
  _updateBadgesOnElements(
    document.querySelectorAll('.cinematic-pc-item[data-user-id]'),
    requestByUser,
  );

  // Update camera feed badges
  _updateBadgesOnElements(
    document.querySelectorAll('.cinematic-bottom-row .camera-feed-item[data-user-id]'),
    requestByUser,
  );

  updateControlStates();
}

/**
 * Update badges on a set of elements.
 * GM badges are clickable to activate that player's request.
 * @param {NodeList} elements
 * @param {Map<string, object>} requestByUser
 * @private
 */
function _updateBadgesOnElements(elements, requestByUser) {
  elements.forEach(el => {
    const userId = el.dataset.userId;
    if (!userId) return;

    let badge = el.querySelector('.sr-cinematic-badge');
    const request = requestByUser.get(userId);

    if (request) {
      const { levelClass, iconClass } = _getLevelDisplay(request.level);

      if (!badge) {
        badge = Object.assign(document.createElement('div'), {
          className: 'sr-cinematic-badge',
        });
        badge.innerHTML = `<i class="fas ${iconClass}"></i>`;

        if (game.user.isGM) {
          badge.classList.add('sr-gm-clickable');
          badge.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            badge.remove();
            _calloutRequest(userId);
          });
        }

        el.appendChild(badge);
      } else {
        badge.querySelector('i').className = `fas ${iconClass}`;
      }

      badge.classList.remove('common', 'important', 'urgent');
      badge.classList.add(levelClass);
    } else if (badge) {
      badge.remove();
    }
  });
}

/**
 * Remove all cinematic badges from the DOM.
 */
function clearCinematicIndicators() {
  document.querySelectorAll('.sr-cinematic-badge').forEach(badge => badge.remove());
}

// --- Lifecycle ---

/** @type {boolean} Whether the integration is currently active */
let _active = false;

/** @type {number|null} Polling interval ID for queue state changes */
let _pollInterval = null;

/** @type {MutationObserver|null} Watches for camera feed items added after initial render */
let _bottomRowObserver = null;

/**
 * Called by CinematicSceneBase._onRender after each render.
 * Injects controls and updates indicators.
 * @param {HTMLElement} container - The .cinematic-scene-container element
 */
export function onCinematicRender(container) {
  if (!isActive()) return;

  if (!_active) {
    _active = true;
    loadCSS(CSS_PATH);
    _lastQueueSignature = _getQueueSignature();

    // Poll for queue changes since simple-requests has no state-change hook
    _pollInterval = setInterval(() => {
      const sig = _getQueueSignature();
      if (sig !== _lastQueueSignature) {
        _lastQueueSignature = sig;
        updateCinematicIndicators();
      }
    }, 500);
  }

  injectCinematicControls(container);
  updateCinematicIndicators();

  // Camera feeds are synced asynchronously after render.
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
 * Cleans up polling, observers, and CSS.
 */
export function onCinematicClose() {
  if (!_active) return;
  _active = false;
  _teardownBottomRowObserver();
  clearCinematicIndicators();

  if (_pollInterval) {
    clearInterval(_pollInterval);
    _pollInterval = null;
  }

  _lastQueueSignature = '';
  unloadCSS(CSS_PATH);
}

/**
 * Disconnect the bottom row MutationObserver if active.
 * @private
 */
function _teardownBottomRowObserver() {
  if (_bottomRowObserver) {
    _bottomRowObserver.disconnect();
    _bottomRowObserver = null;
  }
}
