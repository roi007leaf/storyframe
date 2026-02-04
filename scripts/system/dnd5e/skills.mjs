/**
 * D&D 5e Skills Configuration
 * D&D 5e doesn't have action-based skill usage like PF2e
 */

export const DND5E_SKILLS = {
  acr: { name: 'Acrobatics', actions: null },
  ani: { name: 'Animal Handling', actions: null },
  arc: { name: 'Arcana', actions: null },
  ath: { name: 'Athletics', actions: null },
  dec: { name: 'Deception', actions: null },
  his: { name: 'History', actions: null },
  ins: { name: 'Insight', actions: null },
  itm: { name: 'Intimidation', actions: null },
  inv: { name: 'Investigation', actions: null },
  med: { name: 'Medicine', actions: null },
  nat: { name: 'Nature', actions: null },
  prc: { name: 'Perception', actions: null },
  prf: { name: 'Performance', actions: null },
  per: { name: 'Persuasion', actions: null },
  rel: { name: 'Religion', actions: null },
  slt: { name: 'Sleight of Hand', actions: null },
  ste: { name: 'Stealth', actions: null },
  sur: { name: 'Survival', actions: null },
};

/**
 * Short name abbreviations for D&D 5e skills
 */
export const DND5E_SKILL_SHORT_NAMES = {
  acr: 'Acr',
  ani: 'Ani',
  arc: 'Arc',
  ath: 'Ath',
  dec: 'Dec',
  his: 'His',
  ins: 'Ins',
  itm: 'Itm',
  inv: 'Inv',
  med: 'Med',
  nat: 'Nat',
  prc: 'Prc',
  prf: 'Prf',
  per: 'Per',
  rel: 'Rel',
  slt: 'Slt',
  ste: 'Ste',
  sur: 'Sur',
};

/**
 * Map short skill slugs to D&D 5e skill slugs
 * For D&D 5e, most slugs map directly to themselves
 */
export const DND5E_SKILL_SLUG_MAP = {
  acr: 'acr', // Acrobatics
  ani: 'ani', // Animal Handling
  arc: 'arc', // Arcana
  ath: 'ath', // Athletics
  dec: 'dec', // Deception
  his: 'his', // History
  ins: 'ins', // Insight
  itm: 'itm', // Intimidation
  inv: 'inv', // Investigation
  med: 'med', // Medicine
  nat: 'nat', // Nature
  prc: 'prc', // Perception
  prf: 'prf', // Performance
  per: 'per', // Persuasion
  rel: 'rel', // Religion
  slt: 'slt', // Sleight of Hand
  ste: 'ste', // Stealth
  sur: 'sur', // Survival
};

/**
 * Map full skill names to skill slugs (for enricher pattern matching)
 */
export const DND5E_SKILL_NAME_MAP = {
  acrobatics: 'acr',
  'animal handling': 'ani',
  arcana: 'arc',
  athletics: 'ath',
  deception: 'dec',
  history: 'his',
  insight: 'ins',
  intimidation: 'itm',
  investigation: 'inv',
  medicine: 'med',
  nature: 'nat',
  perception: 'prc',
  performance: 'prf',
  persuasion: 'per',
  religion: 'rel',
  'sleight of hand': 'slt',
  stealth: 'ste',
  survival: 'sur',
};
