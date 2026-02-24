/**
 * System Adapter for StoryFrame
 * Provides system-specific configurations for skills and DCs
 * Acts as a facade that delegates to system-specific modules
 */

// PF2e imports
import { getPF2ePartyPCs } from './system/pf2e/party.mjs';
import {
  PF2E_SKILLS,
  PF2E_SKILL_SHORT_NAMES,
  PF2E_SKILL_NAME_MAP,
  SF2E_SKILLS,
} from './system/pf2e/skills.mjs';
import {
  PF2E_SAVES,
  PF2E_SAVE_SHORT_NAMES,
  PF2E_SAVE_NAME_MAP,
} from './system/pf2e/saves.mjs';
import { PF2E_DIFFICULTY_ADJUSTMENTS, getPF2eDCOptions } from './system/pf2e/dc-tables.mjs';

// D&D 5e imports
import {
  DND5E_SKILLS,
  DND5E_SKILL_SHORT_NAMES,
  DND5E_SKILL_NAME_MAP,
} from './system/dnd5e/skills.mjs';
import {
  DND5E_SAVES,
  DND5E_SAVE_SHORT_NAMES,
  DND5E_SAVE_NAME_MAP,
} from './system/dnd5e/saves.mjs';
import { getDND5eDCOptions } from './system/dnd5e/dc-tables.mjs';

// Daggerheart imports
import {
  DAGGERHEART_TRAITS,
  DAGGERHEART_TRAIT_SHORT_NAMES,
  DAGGERHEART_TRAIT_NAME_MAP,
} from './system/daggerheart/skills.mjs';
import {
  DAGGERHEART_SAVES,
  DAGGERHEART_SAVE_SHORT_NAMES,
  DAGGERHEART_SAVE_NAME_MAP,
} from './system/daggerheart/saves.mjs';
import { getDaggerheartDCOptions } from './system/daggerheart/dc-tables.mjs';

/**
 * Detect the current game system
 * @returns {'pf2e'|'dnd5e'|'other'}
 */
export function detectSystem() {
  const systemId = game.system.id;

  if (systemId === 'pf2e') return 'pf2e';
  if (systemId === 'dnd5e') return 'dnd5e';
  if (systemId === 'daggerheart') return 'daggerheart';

  return 'other';
}

/**
 * Get skill definitions for the current system
 * @returns {Object} Skill definitions with abbreviations and actions
 */
export function getSkills() {
  const system = detectSystem();

  switch (system) {
    case 'pf2e': {
      if (game.modules.get('sf2e-anachronism')?.active) {
        return { ...PF2E_SKILLS, ...SF2E_SKILLS };
      }
      return PF2E_SKILLS;
    }
    case 'dnd5e':
      return DND5E_SKILLS;
    case 'daggerheart':
      return DAGGERHEART_TRAITS;
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
    case 'daggerheart':
      return getDaggerheartDCOptions();
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
    case 'daggerheart':
      return null; // Daggerheart doesn't use adjustments, DCs are absolute
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
    pf2e: PF2E_SKILL_SHORT_NAMES,
    dnd5e: DND5E_SKILL_SHORT_NAMES,
    daggerheart: DAGGERHEART_TRAIT_SHORT_NAMES,
  };

  return shortNames[system]?.[slug] || slug.substring(0, 3).toUpperCase();
}

/**
 * Get skill name to slug mapping for the current system
 * Used by check enricher to parse skill names from text
 * @returns {Object} Map of lowercase skill names to slugs
 */
export function getSkillNameMap() {
  const system = detectSystem();

  switch (system) {
    case 'pf2e':
      return PF2E_SKILL_NAME_MAP;
    case 'dnd5e':
      return DND5E_SKILL_NAME_MAP;
    case 'daggerheart':
      return DAGGERHEART_TRAIT_NAME_MAP;
    default:
      return {};
  }
}

/**
 * Get save definitions for the current system
 * @returns {Object} Save definitions with abbreviations and icons
 */
export function getSaves() {
  const system = detectSystem();

  switch (system) {
    case 'pf2e':
      return PF2E_SAVES;
    case 'dnd5e':
      return DND5E_SAVES;
    case 'daggerheart':
      return DAGGERHEART_SAVES;
    default:
      return {}; // No saves for unsupported systems
  }
}

/**
 * Get save slug from save name (system-aware)
 * @param {string} saveName - Full save name (e.g., "Fortitude", "Strength Save")
 * @returns {string|null} Save slug or null if not found
 */
export function getSaveSlugFromName(saveName) {
  const saves = getSaves();
  const normalized = saveName.toLowerCase();

  for (const [slug, save] of Object.entries(saves)) {
    if (save.name.toLowerCase() === normalized) {
      return slug;
    }
  }

  return null;
}

/**
 * Get short name for save slug (system-aware)
 * @param {string} slug - Save slug (e.g., "fortitude", "str")
 * @returns {string} Short display name
 */
export function getSaveShortName(slug) {
  const system = detectSystem();

  // System-specific short names
  const shortNames = {
    pf2e: PF2E_SAVE_SHORT_NAMES,
    dnd5e: DND5E_SAVE_SHORT_NAMES,
    daggerheart: DAGGERHEART_SAVE_SHORT_NAMES,
  };

  return shortNames[system]?.[slug] || slug.substring(0, 3).toUpperCase();
}

/**
 * Get save name to slug mapping for the current system
 * Used by check enricher to parse save names from text
 * @returns {Object} Map of lowercase save names to slugs
 */
export function getSaveNameMap() {
  const system = detectSystem();

  switch (system) {
    case 'pf2e':
      return PF2E_SAVE_NAME_MAP;
    case 'dnd5e':
      return DND5E_SAVE_NAME_MAP;
    case 'daggerheart':
      return DAGGERHEART_SAVE_NAME_MAP;
    default:
      return {};
  }
}

/**
 * Get player PCs for roll requester.
 * PF2e: returns party actor members. Other systems: all player-owned characters.
 * @returns {Array<{id: string, name: string, img: string, actorUuid: string, userId: string|undefined}>}
 */
export async function getAllPlayerPCs() {
  if (!game.actors) return [];

  const toEntry = (a) => {
    const owner = game.users.find(u => !u.isGM && a.testUserPermission(u, 'OWNER'));
    return { id: a.uuid, name: a.name, img: a.img, actorUuid: a.uuid, userId: owner?.id };
  };

  if (game.system.id === 'pf2e') {
    const partyPCs = await getPF2ePartyPCs(toEntry);
    if (partyPCs) return partyPCs;
    // Fallback: all player-owned characters if no party found
  }

  return game.actors
    .filter(a => a.type === 'character' && a.hasPlayerOwner)
    .map(toEntry);
}

export default {
  detectSystem,
  getSkills,
  getSaves,
  getDCOptions,
  getDifficultyAdjustments,
  getSkillSlugFromName,
  getSaveSlugFromName,
  getSkillShortName,
  getSaveShortName,
  getSkillNameMap,
  getSaveNameMap,
  getAllPlayerPCs,
};
