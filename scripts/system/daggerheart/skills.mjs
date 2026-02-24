/**
 * Daggerheart Traits Configuration
 * Daggerheart uses 6 core traits instead of skills.
 * Traits are the primary roll mechanic — all characters have all 6.
 */

/**
 * Maps trait slugs to full actor data property names.
 * Actor data path: actor.system.traits.agility (full name, not slug)
 */
export const DAGGERHEART_TRAIT_FULL_NAMES = {
  agi: 'agility',
  str: 'strength',
  fin: 'finesse',
  ins: 'instinct',
  pre: 'presence',
  kno: 'knowledge',
};

export const DAGGERHEART_TRAITS = {
  agi: { name: 'Agility', actions: null, icon: 'fa-person-running' },
  str: { name: 'Strength', actions: null, icon: 'fa-dumbbell' },
  fin: { name: 'Finesse', actions: null, icon: 'fa-hand-sparkles' },
  ins: { name: 'Instinct', actions: null, icon: 'fa-eye' },
  pre: { name: 'Presence', actions: null, icon: 'fa-comments' },
  kno: { name: 'Knowledge', actions: null, icon: 'fa-book' },
};

/**
 * Short name abbreviations for Daggerheart traits
 */
export const DAGGERHEART_TRAIT_SHORT_NAMES = {
  agi: 'Agi',
  str: 'Str',
  fin: 'Fin',
  ins: 'Ins',
  pre: 'Pre',
  kno: 'Kno',
};

/**
 * Map full trait names to trait slugs (for enricher pattern matching)
 */
export const DAGGERHEART_TRAIT_NAME_MAP = {
  agility: 'agi',
  strength: 'str',
  finesse: 'fin',
  instinct: 'ins',
  presence: 'pre',
  knowledge: 'kno',
};
