/**
 * Daggerheart DC Tables
 * Daggerheart uses fixed difficulty values, not level-based DCs.
 */

/**
 * Daggerheart difficulty by category
 */
export const DAGGERHEART_DC_BY_DIFFICULTY = {
  'very-easy': { label: 'STORYFRAME.Difficulty.Daggerheart.VeryEasy', dc: 8 },
  easy: { label: 'STORYFRAME.Difficulty.Daggerheart.Easy', dc: 11 },
  standard: { label: 'STORYFRAME.Difficulty.Daggerheart.Standard', dc: 15 },
  hard: { label: 'STORYFRAME.Difficulty.Daggerheart.Hard', dc: 18 },
  'very-hard': { label: 'STORYFRAME.Difficulty.Daggerheart.VeryHard', dc: 22 },
  extreme: { label: 'STORYFRAME.Difficulty.Daggerheart.Extreme', dc: 26 },
};

/**
 * Get Daggerheart DC options for UI dropdowns
 * @returns {Array} Array of DC options with value, label, and dc
 */
export function getDaggerheartDCOptions() {
  return Object.entries(DAGGERHEART_DC_BY_DIFFICULTY).map(([key, data]) => ({
    value: key,
    label: `${game.i18n.localize(data.label)} (DC ${data.dc})`,
    dc: data.dc,
  }));
}
