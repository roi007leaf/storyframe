/**
 * PF2e Action Display Names
 * Maps action slugs to their display names
 */

export const PF2E_ACTION_DISPLAY_NAMES = {
  'follow-the-expert': 'Follow the Expert',
  seek: 'Seek',
  'sense-direction': 'Sense Direction',
  'sense-motive': 'Sense Motive',
  balance: 'Balance',
  'tumble-through': 'Tumble Through',
  'maneuver-in-flight': 'Maneuver in Flight',
  squeeze: 'Squeeze',
  'recall-knowledge': 'Recall Knowledge',
  'decipher-writing': 'Decipher Writing',
  'identify-magic': 'Identify Magic',
  'learn-spell': 'Learn a Spell',
  'borrow-an-arcane-spell': 'Borrow an Arcane Spell',
  climb: 'Climb',
  'force-open': 'Force Open',
  grapple: 'Grapple',
  'high-jump': 'High Jump',
  'long-jump': 'Long Jump',
  shove: 'Shove',
  swim: 'Swim',
  trip: 'Trip',
  disarm: 'Disarm',
  reposition: 'Reposition',
  repair: 'Repair',
  craft: 'Craft',
  'identify-alchemy': 'Identify Alchemy',
  'create-a-diversion': 'Create a Diversion',
  impersonate: 'Impersonate',
  lie: 'Lie',
  feint: 'Feint',
  'gather-information': 'Gather Information',
  'make-an-impression': 'Make an Impression',
  request: 'Request',
  coerce: 'Coerce',
  demoralize: 'Demoralize',
  'administer-first-aid': 'Administer First Aid',
  'treat-disease': 'Treat Disease',
  'treat-poison': 'Treat Poison',
  'treat-wounds': 'Treat Wounds',
  'command-an-animal': 'Command an Animal',
  perform: 'Perform',
  'create-forgery': 'Create Forgery',
  subsist: 'Subsist',
  'conceal-an-object': 'Conceal an Object',
  'avoid-notice': 'Avoid Notice',
  hide: 'Hide',
  sneak: 'Sneak',
  track: 'Track',
  'cover-tracks': 'Cover Tracks',
  'palm-an-object': 'Palm an Object',
  steal: 'Steal',
  'pick-a-lock': 'Pick a Lock',
  'disable-device': 'Disable Device',
};

/**
 * PF2e Action Variants
 * Maps action slugs to their available variants with display names
 */
export const PF2E_ACTION_VARIANTS = {
  'create-a-diversion': [
    { slug: 'distracting-words', name: 'Distracting Words' },
    { slug: 'gesture', name: 'Gesture' },
    { slug: 'trick', name: 'Trick' },
  ],
  perform: [
    { slug: 'acting', name: 'Acting' },
    { slug: 'comedy', name: 'Comedy' },
    { slug: 'dance', name: 'Dance' },
    { slug: 'keyboards', name: 'Keyboards' },
    { slug: 'oratory', name: 'Oratory' },
    { slug: 'percussion', name: 'Percussion' },
    { slug: 'singing', name: 'Singing' },
    { slug: 'strings', name: 'Strings' },
    { slug: 'winds', name: 'Winds' },
  ],
  'administer-first-aid': [
    { slug: 'stabilize', name: 'Stabilize' },
    { slug: 'stop-bleeding', name: 'Stop Bleeding' },
  ],
};
