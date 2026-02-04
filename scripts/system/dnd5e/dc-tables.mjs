/**
 * D&D 5e DC Tables
 * D&D 5e uses fixed DC by difficulty, not level-based DCs
 */

/**
 * D&D 5e DC by difficulty
 */
export const DND5E_DC_BY_DIFFICULTY = {
  'very-easy': { label: 'Very Easy', dc: 5 },
  easy: { label: 'Easy', dc: 10 },
  medium: { label: 'Medium', dc: 15 },
  hard: { label: 'Hard', dc: 20 },
  'very-hard': { label: 'Very Hard', dc: 25 },
  'nearly-impossible': { label: 'Nearly Impossible', dc: 30 },
};

/**
 * Get D&D 5e DC options for UI dropdowns
 * @returns {Array} Array of DC options with value, label, and dc
 */
export function getDND5eDCOptions() {
  return Object.entries(DND5E_DC_BY_DIFFICULTY).map(([key, data]) => ({
    value: key,
    label: `${data.label} (DC ${data.dc})`,
    dc: data.dc,
  }));
}
