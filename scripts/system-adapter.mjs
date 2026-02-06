/**
 * System Adapter for StoryFrame
 * Provides system-specific configurations for skills and DCs
 * Acts as a facade that delegates to system-specific modules
 */

// PF2e imports
import {
  PF2E_SKILLS,
  PF2E_SKILL_SHORT_NAMES,
  PF2E_SKILL_NAME_MAP,
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
    pf2e: PF2E_SKILL_SHORT_NAMES,
    dnd5e: DND5E_SKILL_SHORT_NAMES,
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
    default:
      return {};
  }
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
};
