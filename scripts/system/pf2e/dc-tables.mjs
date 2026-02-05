/**
 * PF2e DC Tables and Difficulty Adjustments
 */

/**
 * PF2e DC by level table
 */
export const PF2E_DC_BY_LEVEL = {
  0: 14,
  1: 15,
  2: 16,
  3: 18,
  4: 19,
  5: 20,
  6: 22,
  7: 23,
  8: 24,
  9: 26,
  10: 27,
  11: 28,
  12: 30,
  13: 31,
  14: 32,
  15: 34,
  16: 35,
  17: 36,
  18: 38,
  19: 39,
  20: 40,
  21: 42,
  22: 44,
  23: 46,
  24: 48,
  25: 50,
};

/**
 * PF2e difficulty adjustment modifiers
 */
export const PF2E_DIFFICULTY_ADJUSTMENTS = [
  { id: 'trivial', labelKey: 'STORYFRAME.Difficulty.PF2e.Trivial', adjustment: -10 },
  { id: 'low', labelKey: 'STORYFRAME.Difficulty.PF2e.Low', adjustment: -5 },
  { id: 'low-med', labelKey: 'STORYFRAME.Difficulty.PF2e.LowMed', adjustment: -2 },
  { id: 'standard', labelKey: 'STORYFRAME.Difficulty.PF2e.Standard', adjustment: 0 },
  { id: 'med-high', labelKey: 'STORYFRAME.Difficulty.PF2e.MedHigh', adjustment: 2 },
  { id: 'high', labelKey: 'STORYFRAME.Difficulty.PF2e.High', adjustment: 5 },
  { id: 'extreme', labelKey: 'STORYFRAME.Difficulty.PF2e.Extreme', adjustment: 10 },
];

/**
 * Get PF2e DC options for UI dropdowns
 * @returns {Array} Array of DC options with value, label, and dc
 */
export function getPF2eDCOptions() {
  const options = [];
  for (let level = 0; level <= 25; level++) {
    options.push({
      value: level,
      label: `Level ${level} (DC ${PF2E_DC_BY_LEVEL[level]})`,
      dc: PF2E_DC_BY_LEVEL[level],
    });
  }
  return options;
}
