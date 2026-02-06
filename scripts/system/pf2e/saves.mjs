/**
 * PF2e Saving Throw Definitions
 * Provides metadata for the three PF2e saves: Fortitude, Reflex, Will
 */

/**
 * Core save definitions with display names, icons, and abbreviations
 */
export const PF2E_SAVES = {
  fortitude: {
    name: 'Fortitude',
    icon: 'fa-heart-pulse',
    abbreviation: 'Fort',
  },
  reflex: {
    name: 'Reflex',
    icon: 'fa-wind',
    abbreviation: 'Ref',
  },
  will: {
    name: 'Will',
    icon: 'fa-brain',
    abbreviation: 'Will',
  },
};

/**
 * Short display names for saves
 * Used in compact UI displays
 */
export const PF2E_SAVE_SHORT_NAMES = {
  fortitude: 'Fort',
  reflex: 'Ref',
  will: 'Will',
};

/**
 * Save name to slug mapping
 * Maps various save name formats to canonical slugs
 */
export const PF2E_SAVE_NAME_MAP = {
  fortitude: 'fortitude',
  reflex: 'reflex',
  will: 'will',
  // Lowercase variations
  fort: 'fortitude',
  ref: 'reflex',
  wil: 'will',
};
