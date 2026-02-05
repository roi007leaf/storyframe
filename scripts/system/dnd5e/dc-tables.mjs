/**
 * D&D 5e DC Tables
 * D&D 5e uses fixed DC by difficulty, not level-based DCs
 */

/**
 * D&D 5e DC by difficulty
 */
export const DND5E_DC_BY_DIFFICULTY = {
  'very-easy': { label: 'STORYFRAME.Difficulty.DND5e.VeryEasy', dc: 5 },
  easy: { label: 'STORYFRAME.Difficulty.DND5e.Easy', dc: 10 },
  medium: { label: 'STORYFRAME.Difficulty.DND5e.Medium', dc: 15 },
  hard: { label: 'STORYFRAME.Difficulty.DND5e.Hard', dc: 20 },
  'very-hard': { label: 'STORYFRAME.Difficulty.DND5e.VeryHard', dc: 25 },
  'nearly-impossible': { label: 'STORYFRAME.Difficulty.DND5e.NearlyImpossible', dc: 30 },
};

/**
 * Get D&D 5e DC options for UI dropdowns
 * @returns {Array} Array of DC options with value, label, and dc
 */
export function getDND5eDCOptions() {
  return Object.entries(DND5E_DC_BY_DIFFICULTY).map(([key, data]) => ({
    value: key,
    label: `${game.i18n.localize(data.label)} (DC ${data.dc})`,
    dc: data.dc,
  }));
}
