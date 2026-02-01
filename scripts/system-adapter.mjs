/**
 * System Adapter for StoryFrame
 * Provides system-specific configurations for skills and DCs
 */

/**
 * Detect the current game system
 * @returns {'pf2e'|'dnd5e'|'other'}
 */
export function detectSystem() {
  const systemId = game.system.id;

  if (systemId === 'pf2e') return 'pf2e';
  if (systemId === 'dnd5e') return 'dnd5e';

  return 'other';
}

/**
 * Get skill definitions for the current system
 * @returns {Object} Skill definitions with abbreviations and actions
 */
export function getSkills() {
  const system = detectSystem();

  switch (system) {
    case 'pf2e':
      return PF2E_SKILLS;
    case 'dnd5e':
      return DND5E_SKILLS;
    default:
      return {}; // No skills for unsupported systems
  }
}

/**
 * Get DC options for the current system
 * @returns {Array} Array of DC options
 */
export function getDCOptions() {
  const system = detectSystem();

  switch (system) {
    case 'pf2e':
      return getPF2eDCOptions();
    case 'dnd5e':
      return getDND5eDCOptions();
    default:
      return [];
  }
}

/**
 * Get difficulty adjustments for the current system
 * @returns {Array} Array of difficulty adjustment options
 */
export function getDifficultyAdjustments() {
  const system = detectSystem();

  switch (system) {
    case 'pf2e':
      return PF2E_DIFFICULTY_ADJUSTMENTS;
    case 'dnd5e':
      return null; // D&D 5e doesn't use adjustments, DCs are absolute
    default:
      return null;
  }
}

/**
 * Get skill slug from skill name (system-aware)
 * @param {string} skillName - Full skill name (e.g., "Athletics", "Perception")
 * @returns {string|null} Skill slug or null if not found
 */
export function getSkillSlugFromName(skillName) {
  const skills = getSkills();
  const normalized = skillName.toLowerCase();

  for (const [slug, skill] of Object.entries(skills)) {
    if (skill.name.toLowerCase() === normalized) {
      return slug;
    }
  }

  return null;
}

/**
 * Get short name for skill slug (system-aware)
 * @param {string} slug - Skill slug (e.g., "ath", "prc")
 * @returns {string} Short display name
 */
export function getSkillShortName(slug) {
  const system = detectSystem();

  // System-specific short names
  const shortNames = {
    pf2e: {
      per: 'Per',
      acr: 'Acr',
      arc: 'Arc',
      ath: 'Ath',
      cra: 'Cra',
      dec: 'Dec',
      dip: 'Dip',
      itm: 'Itm',
      med: 'Med',
      nat: 'Nat',
      occ: 'Occ',
      prf: 'Prf',
      rel: 'Rel',
      soc: 'Soc',
      ste: 'Ste',
      sur: 'Sur',
      thi: 'Thi',
    },
    dnd5e: {
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
    },
  };

  return shortNames[system]?.[slug] || slug.substring(0, 3).toUpperCase();
}

// ============================================================================
// PF2e System Data
// ============================================================================

const PF2E_SKILLS = {
  per: {
    name: 'Perception',
    actions: [
      { slug: 'seek', name: 'Seek' },
      { slug: 'sense-direction', name: 'Sense Direction' },
      { slug: 'sense-motive', name: 'Sense Motive' },
    ],
  },
  acr: {
    name: 'Acrobatics',
    actions: [
      { slug: 'balance', name: 'Balance' },
      { slug: 'tumble-through', name: 'Tumble Through' },
      { slug: 'maneuver-in-flight', name: 'Maneuver in Flight' },
      { slug: 'squeeze', name: 'Squeeze' },
    ],
  },
  arc: {
    name: 'Arcana',
    actions: [
      { slug: 'recall-knowledge', name: 'Recall Knowledge' },
      { slug: 'decipher-writing', name: 'Decipher Writing' },
      { slug: 'identify-magic', name: 'Identify Magic' },
      { slug: 'learn-spell', name: 'Learn a Spell' },
    ],
  },
  ath: {
    name: 'Athletics',
    actions: [
      { slug: 'climb', name: 'Climb' },
      { slug: 'force-open', name: 'Force Open' },
      { slug: 'grapple', name: 'Grapple' },
      { slug: 'high-jump', name: 'High Jump' },
      { slug: 'long-jump', name: 'Long Jump' },
      { slug: 'shove', name: 'Shove' },
      { slug: 'swim', name: 'Swim' },
      { slug: 'trip', name: 'Trip' },
      { slug: 'disarm', name: 'Disarm' },
    ],
  },
  cra: {
    name: 'Crafting',
    actions: [
      { slug: 'recall-knowledge', name: 'Recall Knowledge' },
      { slug: 'repair', name: 'Repair' },
      { slug: 'craft', name: 'Craft' },
      { slug: 'identify-alchemy', name: 'Identify Alchemy' },
    ],
  },
  dec: {
    name: 'Deception',
    actions: [
      { slug: 'create-a-diversion', name: 'Create a Diversion' },
      { slug: 'impersonate', name: 'Impersonate' },
      { slug: 'lie', name: 'Lie' },
      { slug: 'feint', name: 'Feint' },
    ],
  },
  dip: {
    name: 'Diplomacy',
    actions: [
      { slug: 'gather-information', name: 'Gather Information' },
      { slug: 'make-an-impression', name: 'Make an Impression' },
      { slug: 'request', name: 'Request' },
    ],
  },
  itm: {
    name: 'Intimidation',
    actions: [
      { slug: 'coerce', name: 'Coerce' },
      { slug: 'demoralize', name: 'Demoralize' },
    ],
  },
  med: {
    name: 'Medicine',
    actions: [
      { slug: 'administer-first-aid', name: 'Administer First Aid' },
      { slug: 'recall-knowledge', name: 'Recall Knowledge' },
      { slug: 'treat-disease', name: 'Treat Disease' },
      { slug: 'treat-poison', name: 'Treat Poison' },
      { slug: 'treat-wounds', name: 'Treat Wounds' },
    ],
  },
  nat: {
    name: 'Nature',
    actions: [
      { slug: 'command-an-animal', name: 'Command an Animal' },
      { slug: 'recall-knowledge', name: 'Recall Knowledge' },
      { slug: 'identify-magic', name: 'Identify Magic' },
      { slug: 'learn-spell', name: 'Learn a Spell' },
    ],
  },
  occ: {
    name: 'Occultism',
    actions: [
      { slug: 'recall-knowledge', name: 'Recall Knowledge' },
      { slug: 'decipher-writing', name: 'Decipher Writing' },
      { slug: 'identify-magic', name: 'Identify Magic' },
      { slug: 'learn-spell', name: 'Learn a Spell' },
    ],
  },
  prf: {
    name: 'Performance',
    actions: [{ slug: 'perform', name: 'Perform' }],
  },
  rel: {
    name: 'Religion',
    actions: [
      { slug: 'recall-knowledge', name: 'Recall Knowledge' },
      { slug: 'decipher-writing', name: 'Decipher Writing' },
      { slug: 'identify-magic', name: 'Identify Magic' },
      { slug: 'learn-spell', name: 'Learn a Spell' },
    ],
  },
  soc: {
    name: 'Society',
    actions: [
      { slug: 'recall-knowledge', name: 'Recall Knowledge' },
      { slug: 'create-forgery', name: 'Create Forgery' },
      { slug: 'decipher-writing', name: 'Decipher Writing' },
      { slug: 'subsist', name: 'Subsist' },
    ],
  },
  ste: {
    name: 'Stealth',
    actions: [
      { slug: 'conceal-an-object', name: 'Conceal an Object' },
      { slug: 'hide', name: 'Hide' },
      { slug: 'sneak', name: 'Sneak' },
    ],
  },
  sur: {
    name: 'Survival',
    actions: [
      { slug: 'sense-direction', name: 'Sense Direction' },
      { slug: 'subsist', name: 'Subsist' },
      { slug: 'track', name: 'Track' },
      { slug: 'cover-tracks', name: 'Cover Tracks' },
    ],
  },
  thi: {
    name: 'Thievery',
    actions: [
      { slug: 'palm-an-object', name: 'Palm an Object' },
      { slug: 'steal', name: 'Steal' },
      { slug: 'pick-a-lock', name: 'Pick a Lock' },
      { slug: 'disable-device', name: 'Disable Device' },
    ],
  },
};

const PF2E_DC_BY_LEVEL = {
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

const PF2E_DIFFICULTY_ADJUSTMENTS = [
  { id: 'trivial', label: 'Trivial', adjustment: -10 },
  { id: 'low', label: 'Low', adjustment: -5 },
  { id: 'low-med', label: 'Low-Med', adjustment: -2 },
  { id: 'standard', label: 'Standard', adjustment: 0 },
  { id: 'med-high', label: 'Med-High', adjustment: 2 },
  { id: 'high', label: 'High', adjustment: 5 },
  { id: 'extreme', label: 'Extreme', adjustment: 10 },
];

function getPF2eDCOptions() {
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

// ============================================================================
// D&D 5e System Data
// ============================================================================

const DND5E_SKILLS = {
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

const DND5E_DC_BY_DIFFICULTY = {
  'very-easy': { label: 'Very Easy', dc: 5 },
  easy: { label: 'Easy', dc: 10 },
  medium: { label: 'Medium', dc: 15 },
  hard: { label: 'Hard', dc: 20 },
  'very-hard': { label: 'Very Hard', dc: 25 },
  'nearly-impossible': { label: 'Nearly Impossible', dc: 30 },
};

function getDND5eDCOptions() {
  return Object.entries(DND5E_DC_BY_DIFFICULTY).map(([key, data]) => ({
    value: key,
    label: `${data.label} (DC ${data.dc})`,
    dc: data.dc,
  }));
}

// ============================================================================
// Exports
// ============================================================================

export default {
  detectSystem,
  getSkills,
  getDCOptions,
  getDifficultyAdjustments,
};
