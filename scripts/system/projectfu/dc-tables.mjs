/**
 * Fabula Ultima (ProjectFU) Difficulty Level Tables
 * Fabula Ultima uses fixed Difficulty Levels (DL), not level-based DCs.
 * Standard DL is 10 (two average d8 dice = 9).
 */

/**
 * Fabula Ultima difficulty by category
 */
export const PROJECTFU_DL_BY_DIFFICULTY = {
  easy: { label: 'STORYFRAME.Difficulty.ProjectFU.Easy', dc: 7 },
  standard: { label: 'STORYFRAME.Difficulty.ProjectFU.Standard', dc: 10 },
  hard: { label: 'STORYFRAME.Difficulty.ProjectFU.Hard', dc: 13 },
  'very-hard': { label: 'STORYFRAME.Difficulty.ProjectFU.VeryHard', dc: 16 },
};

/**
 * Get Fabula Ultima DL options for UI dropdowns
 * @returns {Array} Array of DL options with value, label, and dc
 */
export function getProjectFUDCOptions() {
  return Object.entries(PROJECTFU_DL_BY_DIFFICULTY).map(([key, data]) => ({
    value: key,
    label: `${game.i18n.localize(data.label)} (DL ${data.dc})`,
    dc: data.dc,
  }));
}
