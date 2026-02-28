/**
 * Fabula Ultima (ProjectFU) Attributes Configuration
 * Fabula Ultima uses 4 core attributes instead of skills.
 * Checks roll two attribute dice (primary + secondary) vs a Difficulty Level.
 * StoryFrame models the primary attribute as the "skill" for check requests.
 */

/**
 * Maps attribute slugs to full actor data property names.
 * Actor data path: actor.system.attributes.dex (full name key)
 */
export const PROJECTFU_ATTRIBUTE_FULL_NAMES = {
  dex: 'dex',
  ins: 'ins',
  mig: 'mig',
  wlp: 'wlp',
};

export const PROJECTFU_ATTRIBUTES = {
  dex: { name: 'Dexterity', actions: null, icon: 'fa-crosshairs' },
  ins: { name: 'Insight', actions: null, icon: 'fa-eye' },
  mig: { name: 'Might', actions: null, icon: 'fa-fist-raised' },
  wlp: { name: 'Willpower', actions: null, icon: 'fa-brain' },
};

/**
 * Short name abbreviations for Fabula Ultima attributes
 */
export const PROJECTFU_ATTRIBUTE_SHORT_NAMES = {
  dex: 'DEX',
  ins: 'INS',
  mig: 'MIG',
  wlp: 'WLP',
};

/**
 * Map full attribute names to attribute slugs (for enricher pattern matching)
 */
export const PROJECTFU_ATTRIBUTE_NAME_MAP = {
  dexterity: 'dex',
  insight: 'ins',
  might: 'mig',
  willpower: 'wlp',
};
