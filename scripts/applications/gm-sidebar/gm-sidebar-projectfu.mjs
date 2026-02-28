import { GMSidebarAppBase } from './gm-sidebar-base.mjs';
import * as SkillCheckHandlers from './managers/skill-check-handlers.mjs';
import * as SkillReorderHandlers from './managers/skill-reorder-handlers.mjs';
import * as SystemAdapter from '../../system-adapter.mjs';
import { PROJECTFU_ATTRIBUTE_FULL_NAMES } from '../../system/projectfu/skills.mjs';

/**
 * Fabula Ultima (ProjectFU) specific GM Sidebar implementation.
 * Fabula Ultima uses 4 core Attributes instead of skills/saves.
 * Checks roll two attribute dice (primary + secondary) vs a Difficulty Level.
 */
export class GMSidebarAppProjectFU extends GMSidebarAppBase {
  /**
   * Parse Fabula Ultima checks from journal content.
   * Relies on the text enricher (check-enricher.mjs) which converts
   * "Dexterity DL 10" or "Might DC 13" style text into .sf-check[data-check] elements.
   */
  _parseChecksFromContent(content) {
    const checks = [];

    // Parse StoryFrame text-enriched check spans
    content.querySelectorAll('.sf-check[data-check]').forEach((el) => {
      try {
        const data = JSON.parse(el.dataset.check);
        if (data.skillSlug && data.dc) {
          checks.push({
            label: el.textContent.trim(),
            skillName: data.skillSlug,
            dc: data.dc,
            isSecret: false,
            checkType: 'skill',
            id: foundry.utils.randomID(),
          });
        }
      } catch (_e) {
        // Skip malformed check data
      }
    });

    return checks;
  }

  /**
   * No lore skills in Fabula Ultima
   */
  static async _getLoreSkills(_state) {
    return [];
  }

  /**
   * All Fabula Ultima characters have all 4 attributes — return them unconditionally.
   */
  static async _getAvailableSkills(_state, _selectedParticipants) {
    return new Set(['dex', 'ins', 'mig', 'wlp']);
  }

  /**
   * No level-based DCs in Fabula Ultima
   */
  async _getPartyLevel() {
    return null;
  }

  /**
   * No level-based DC calculation in Fabula Ultima
   */
  _calculateDCByLevel(_level, _difficultyId) {
    return null;
  }

  /**
   * Override skill categorization for Fabula Ultima.
   * Physical: Dexterity, Might
   * Mental: Insight, Willpower
   */
  async _prepareContext(_options) {
    const baseContext = await super._prepareContext(_options);

    const state = game.storyframe.stateManager.getState();
    if (!state) return baseContext;

    const allSystemSkills = SystemAdapter.getSkills();
    const allSkills = Object.keys(allSystemSkills).map(slug => ({
      slug,
      name: SkillCheckHandlers.getSkillName(slug),
      shortName: SkillCheckHandlers.getSkillShortName(slug),
      icon: SkillCheckHandlers.getSkillIcon(slug),
    }));

    const projectfuCategories = {
      physical: ['dex', 'mig'],     // Dexterity, Might
      mental: ['ins', 'wlp'],       // Insight, Willpower
    };

    const categorizedSkills = {
      physicalSkills: await SkillCheckHandlers.mapSkillsWithProficiency(projectfuCategories.physical, allSkills, null),
      magicalSkills: await SkillCheckHandlers.mapSkillsWithProficiency(projectfuCategories.mental, allSkills, null),
      socialSkills: [],
      utilitySkills: [],
    };

    categorizedSkills.physicalSkills = SkillReorderHandlers.applySavedSkillOrder(categorizedSkills.physicalSkills, 'physical');
    categorizedSkills.magicalSkills = SkillReorderHandlers.applySavedSkillOrder(categorizedSkills.magicalSkills, 'magical');
    SkillReorderHandlers.applySavedCategoryOrder(categorizedSkills);

    return {
      ...baseContext,
      ...categorizedSkills,
      saves: [], // No saves in Fabula Ultima
    };
  }

  /**
   * No system-specific context needed for Fabula Ultima
   */
  async _prepareContextSystemSpecific() {
    return {};
  }

  /**
   * No system-specific DC select handler needed for Fabula Ultima.
   * Difficulty options are provided via the preset popup (dc-handlers.mjs).
   */
  _attachSystemDCHandlers() {
    // no-op — Fabula Ultima uses the shared difficulty popup, not a select element
  }

  /**
   * Check if an actor has a specific attribute (Fabula Ultima specific).
   * All characters have all 4 attributes, but we verify the data path exists.
   */
  async _actorHasSkill(actor, skillSlug) {
    if (!actor?.system?.attributes) return true; // Assume present if no attributes data
    const fullName = PROJECTFU_ATTRIBUTE_FULL_NAMES[skillSlug];
    if (!fullName) return false;
    return fullName in actor.system.attributes;
  }

  /**
   * Fabula Ultima has no saving throws
   */
  async _actorHasSave(_actor, _saveSlug) {
    return false;
  }

  /**
   * Fabula Ultima has no proficiency system
   */
  static async _isActorProficientInSkill(_actor, _skillSlug) {
    return false;
  }

  /**
   * Fabula Ultima has no proficiency ranks — always 0
   */
  static async _getActorProficiencyRank(_actor, _skillSlug) {
    return 0;
  }
}
