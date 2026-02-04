/**
 * Validation Utilities
 * Helper functions for validating and normalizing values
 */

import { LIMITS } from '../constants.mjs';

/**
 * Validate and clamp window position to visible screen bounds
 * Ensures windows remain accessible on screen
 * @param {Object} saved - Saved position object with top, left, width, height
 * @returns {Object} Validated position object
 */
export function validatePosition(saved) {
  return {
    top: Math.max(0, Math.min(saved.top || 0, window.innerHeight - LIMITS.WINDOW_MIN_TOP)),
    left: Math.max(0, Math.min(saved.left || 0, window.innerWidth - LIMITS.WINDOW_MIN_LEFT)),
    width: Math.max(LIMITS.WINDOW_MIN_WIDTH, Math.min(saved.width || 400, window.innerWidth)),
    height: Math.max(LIMITS.WINDOW_MIN_HEIGHT, Math.min(saved.height || 300, window.innerHeight)),
  };
}
