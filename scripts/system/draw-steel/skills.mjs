/**
 * Draw Steel Characteristics Configuration
 * Draw Steel uses 5 core characteristics as the primary roll mechanic.
 * All characters have all 5 characteristics.
 */

/**
 * Maps characteristic slugs to full actor data property names.
 * Actor data path: actor.system.characteristics.might (full name, not slug)
 */
export const DRAWSTEEL_CHARACTERISTIC_FULL_NAMES = {
  mig: 'might',
  agi: 'agility',
  rea: 'reason',
  int: 'intuition',
  pre: 'presence',
};

export const DRAWSTEEL_CHARACTERISTICS = {
  mig: { name: 'Might', actions: null, icon: 'fa-hand-fist' },
  agi: { name: 'Agility', actions: null, icon: 'fa-person-running' },
  rea: { name: 'Reason', actions: null, icon: 'fa-scroll' },
  int: { name: 'Intuition', actions: null, icon: 'fa-magnifying-glass' },
  pre: { name: 'Presence', actions: null, icon: 'fa-comments' },
};

/**
 * Short name abbreviations for Draw Steel characteristics
 */
export const DRAWSTEEL_CHARACTERISTIC_SHORT_NAMES = {
  mig: 'Mig',
  agi: 'Agi',
  rea: 'Rea',
  int: 'Int',
  pre: 'Pre',
};

/**
 * Map full characteristic names to slugs (for enricher pattern matching)
 */
export const DRAWSTEEL_CHARACTERISTIC_NAME_MAP = {
  might: 'mig',
  agility: 'agi',
  reason: 'rea',
  intuition: 'int',
  presence: 'pre',
};
