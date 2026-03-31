/**
 * Spotlight Animator
 * Spring-based animations for cinematic speaker spotlights using Motion library.
 * Falls back gracefully to CSS animations if Motion fails to load.
 */

import { getMotion } from './vendor-loader.mjs';

let _motion = null;
let _loadFailed = false;

async function ensureMotion() {
  if (_motion) return _motion;
  if (_loadFailed) return null;
  try {
    _motion = await getMotion();
    return _motion;
  } catch {
    _loadFailed = true;
    return null;
  }
}

/**
 * Animate a new speaker spotlight entrance with spring physics.
 * @param {HTMLElement} spotlightEl - The .cinematic-spotlight element
 */
export async function animateSpeakerEntrance(spotlightEl) {
  const motion = await ensureMotion();
  if (!motion?.animate) return;

  // Disable CSS animation — we're taking over
  spotlightEl.style.animation = 'none';

  motion.animate(spotlightEl,
    { opacity: [0, 1], scale: [0.88, 1], y: [24, 0] },
    { duration: 0.5, easing: motion.spring?.({ stiffness: 200, damping: 20 }) ?? 'ease-out' }
  );
}

/**
 * Animate a speaker swap — fade out old, spring in new.
 * @param {HTMLElement} outgoing - Element leaving
 * @param {HTMLElement} incoming - Element entering
 */
export async function animateSpeakerSwap(outgoing, incoming) {
  const motion = await ensureMotion();
  if (!motion?.animate) return;

  incoming.style.animation = 'none';

  const exit = motion.animate(outgoing,
    { opacity: [1, 0], scale: [1, 0.92] },
    { duration: 0.25 }
  );

  await exit.finished ?? exit;

  motion.animate(incoming,
    { opacity: [0, 1], scale: [0.9, 1] },
    { duration: 0.4, easing: motion.spring?.({ stiffness: 180, damping: 18 }) ?? 'ease-out' }
  );
}

/**
 * Animate dual spotlight stage — second speaker slides in from the side.
 * @param {HTMLElement} secondaryEl - The .cinematic-spotlight.secondary element
 */
export async function animateSecondaryEntrance(secondaryEl) {
  const motion = await ensureMotion();
  if (!motion?.animate) return;

  secondaryEl.style.animation = 'none';

  motion.animate(secondaryEl,
    { opacity: [0, 1], x: [60, 0], scale: [0.9, 1] },
    { duration: 0.5, easing: motion.spring?.({ stiffness: 200, damping: 22 }) ?? 'ease-out' }
  );
}

/**
 * Pulse the spotlight glow (e.g. during active skill check).
 * @param {HTMLElement} glowEl - The .spotlight-glow-cinematic element
 * @returns {Object|null} Animation controls (with .stop()) or null
 */
export async function pulseSpotlightGlow(glowEl) {
  const motion = await ensureMotion();
  if (!motion?.animate) return null;

  return motion.animate(glowEl,
    { opacity: [0.5, 0.85, 0.5] },
    { duration: 1.8, repeat: Infinity }
  );
}

/**
 * Staggered entrance for speaker wheel items.
 * @param {HTMLElement} wheel - The .storyframe-speaker-wheel container
 */
export async function animateWheelEntrance(wheel) {
  const motion = await ensureMotion();
  if (!motion?.animate || !motion?.stagger) return;

  const items = wheel.querySelectorAll('.speaker-wheel-item');
  if (!items.length) return;

  motion.animate(items,
    { opacity: [0, 1], scale: [0.3, 1] },
    { delay: motion.stagger(0.04), easing: motion.spring?.({ stiffness: 300, damping: 24 }) ?? 'ease-out' }
  );
}
