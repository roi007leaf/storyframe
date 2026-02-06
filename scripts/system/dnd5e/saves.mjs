/**
 * D&D 5e Saving Throw Definitions
 * Provides metadata for the six D&D 5e ability saves: STR, DEX, CON, INT, WIS, CHA
 */

/**
 * Core save definitions with display names, icons, and abbreviations
 */
export const DND5E_SAVES = {
  str: {
    name: 'Strength Save',
    icon: 'fa-dumbbell',
    abbreviation: 'STR',
  },
  dex: {
    name: 'Dexterity Save',
    icon: 'fa-person-running',
    abbreviation: 'DEX',
  },
  con: {
    name: 'Constitution Save',
    icon: 'fa-heart-pulse',
    abbreviation: 'CON',
  },
  int: {
    name: 'Intelligence Save',
    icon: 'fa-brain',
    abbreviation: 'INT',
  },
  wis: {
    name: 'Wisdom Save',
    icon: 'fa-eye',
    abbreviation: 'WIS',
  },
  cha: {
    name: 'Charisma Save',
    icon: 'fa-comment',
    abbreviation: 'CHA',
  },
};

/**
 * Short display names for saves
 * Used in compact UI displays
 */
export const DND5E_SAVE_SHORT_NAMES = {
  str: 'STR',
  dex: 'DEX',
  con: 'CON',
  int: 'INT',
  wis: 'WIS',
  cha: 'CHA',
};

/**
 * Save name to slug mapping
 * Maps various save name formats to canonical slugs
 */
export const DND5E_SAVE_NAME_MAP = {
  // Full names
  'strength': 'str',
  'dexterity': 'dex',
  'constitution': 'con',
  'intelligence': 'int',
  'wisdom': 'wis',
  'charisma': 'cha',
  // Abbreviated forms
  'str': 'str',
  'dex': 'dex',
  'con': 'con',
  'int': 'int',
  'wis': 'wis',
  'cha': 'cha',
};
