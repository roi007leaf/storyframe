/**
 * Draw Steel DC Tables
 * Draw Steel uses power rolls (2d10 + characteristic) with tier-based outcomes.
 * Tier 1: ≤11, Tier 2: 12–16, Tier 3: 17+
 * Difficulty determines how tier results are interpreted:
 *   Easy: Tier 1 = success w/ consequence, Tier 2 = success, Tier 3 = success w/ reward
 *   Medium: Tier 1 = failure, Tier 2 = success w/ consequence, Tier 3 = success
 *   Hard: Tier 1 = failure w/ consequence, Tier 2 = failure, Tier 3 = success
 *
 * StoryFrame stores a numeric DC for display. We use the tier boundary
 * representing the minimum roll to achieve any form of success.
 */

/**
 * Draw Steel difficulty by category
 */
export const DRAWSTEEL_DC_BY_DIFFICULTY = {
  easy: { label: 'STORYFRAME.Difficulty.DrawSteel.Easy', dc: 0 },
  medium: { label: 'STORYFRAME.Difficulty.DrawSteel.Medium', dc: 12 },
  hard: { label: 'STORYFRAME.Difficulty.DrawSteel.Hard', dc: 17 },
};

/**
 * Get Draw Steel DC options for UI dropdowns
 * @returns {Array} Array of DC options with value, label, and dc
 */
export function getDrawSteelDCOptions() {
  return Object.entries(DRAWSTEEL_DC_BY_DIFFICULTY).map(([key, data]) => ({
    value: key,
    label: game.i18n.localize(data.label),
    dc: data.dc,
  }));
}
