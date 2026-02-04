/**
 * PF2e Skills Configuration
 * Defines all skills with their actions
 */

export const PF2E_SKILLS = {
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

/**
 * Short name abbreviations for PF2e skills
 */
export const PF2E_SKILL_SHORT_NAMES = {
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
};

/**
 * Map short skill slugs to full PF2e skill slugs
 */
export const PF2E_SKILL_SLUG_MAP = {
  per: 'perception', // Special case - uses actor.perception not actor.skills
  acr: 'acrobatics',
  arc: 'arcana',
  ath: 'athletics',
  cra: 'crafting',
  dec: 'deception',
  dip: 'diplomacy',
  itm: 'intimidation',
  med: 'medicine',
  nat: 'nature',
  occ: 'occultism',
  prf: 'performance',
  rel: 'religion',
  soc: 'society',
  ste: 'stealth',
  sur: 'survival',
  thi: 'thievery',
};

/**
 * Map full skill names to skill slugs (for enricher pattern matching)
 */
export const PF2E_SKILL_NAME_MAP = {
  perception: 'per',
  acrobatics: 'acr',
  arcana: 'arc',
  athletics: 'ath',
  crafting: 'cra',
  deception: 'dec',
  diplomacy: 'dip',
  intimidation: 'itm',
  medicine: 'med',
  nature: 'nat',
  occultism: 'occ',
  performance: 'prf',
  religion: 'rel',
  society: 'soc',
  stealth: 'ste',
  survival: 'sur',
  thievery: 'thi',
};
