import { GMSidebarAppBase } from './gm-sidebar-base.mjs';
import * as SkillCheckHandlers from './managers/skill-check-handlers.mjs';
import * as SkillReorderHandlers from './managers/skill-reorder-handlers.mjs';
import * as SystemAdapter from '../../system-adapter.mjs';
import { DRAWSTEEL_CHARACTERISTIC_FULL_NAMES, DRAWSTEEL_CHARACTERISTIC_NAME_MAP } from '../../system/draw-steel/skills.mjs';
import { DRAWSTEEL_DC_BY_DIFFICULTY } from '../../system/draw-steel/dc-tables.mjs';

/**
 * Draw Steel specific GM Sidebar implementation.
 * Draw Steel uses 5 core Characteristics instead of skills/saves.
 * Power rolls: 2d10 + characteristic + skill bonus, with tier results.
 */
export class GMSidebarAppDrawSteel extends GMSidebarAppBase {
  /**
   * Parse Draw Steel checks from journal content.
   * Relies on the text enricher (check-enricher.mjs) which converts
   * "Might DC 13" style text into .sf-check[data-check] elements.
   */
  _parseChecksFromContent(content) {
    const checks = [];

    // Parse StoryFrame text-enriched check spans (from "Might DC 13" text)
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

    // Parse Draw Steel native roll enrichers
    // <a class="roll-link" data-type="test" data-characteristic="presence">
    content.querySelectorAll('a.roll-link[data-characteristic]').forEach((el) => {
      const type = el.dataset.type;
      if (type !== 'test' && type !== 'requestTest') return;

      const charFullName = el.dataset.characteristic?.toLowerCase();
      if (!charFullName) return;

      const slug = DRAWSTEEL_CHARACTERISTIC_NAME_MAP[charFullName] || charFullName;
      const displayName = charFullName.charAt(0).toUpperCase() + charFullName.slice(1);
      const difficultyKey = el.dataset.difficulty?.toLowerCase();
      const difficultyEntry = DRAWSTEEL_DC_BY_DIFFICULTY[difficultyKey];
      const dc = difficultyEntry?.dc ?? null;
      const difficultyLabel = difficultyKey ? difficultyKey.charAt(0).toUpperCase() + difficultyKey.slice(1) : '';
      checks.push({
        label: el.textContent.trim() || `${difficultyLabel} ${displayName} test`.trim(),
        skillName: slug,
        dc,
        isSecret: false,
        checkType: 'skill',
        id: foundry.utils.randomID(),
      });
    });

    return checks;
  }

  /**
   * No lore skills in Draw Steel
   */
  static async _getLoreSkills(_state) {
    return [];
  }

  /**
   * All Draw Steel characters have all 5 characteristics — return them unconditionally.
   */
  static async _getAvailableSkills(_state, _selectedParticipants) {
    return new Set(['mig', 'agi', 'rea', 'int', 'pre']);
  }

  /**
   * No level-based DCs in Draw Steel
   */
  async _getPartyLevel() {
    return null;
  }

  /**
   * No level-based DC calculation in Draw Steel
   */
  _calculateDCByLevel(_level, _difficultyId) {
    return null;
  }

  /**
   * Override skill categorization for Draw Steel.
   * Physical: Might, Agility
   * Mental: Reason, Intuition, Presence
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

    const drawSteelCategories = {
      physical: ['mig', 'agi'],           // Might, Agility
      mental: ['rea', 'int', 'pre'],      // Reason, Intuition, Presence
    };

    const categorizedSkills = {
      physicalSkills: await SkillCheckHandlers.mapSkillsWithProficiency(drawSteelCategories.physical, allSkills, null),
      magicalSkills: await SkillCheckHandlers.mapSkillsWithProficiency(drawSteelCategories.mental, allSkills, null),
      socialSkills: [],
      utilitySkills: [],
    };

    categorizedSkills.physicalSkills = SkillReorderHandlers.applySavedSkillOrder(categorizedSkills.physicalSkills, 'physical');
    categorizedSkills.magicalSkills = SkillReorderHandlers.applySavedSkillOrder(categorizedSkills.magicalSkills, 'magical');
    SkillReorderHandlers.applySavedCategoryOrder(categorizedSkills);

    return {
      ...baseContext,
      ...categorizedSkills,
      saves: [], // No saves in Draw Steel
    };
  }

  /**
   * No system-specific context needed for Draw Steel
   */
  async _prepareContextSystemSpecific() {
    return {};
  }

  /**
   * No system-specific DC select handler needed for Draw Steel.
   * Difficulty options are provided via the preset popup (dc-handlers.mjs).
   */
  _attachSystemDCHandlers() {
    // no-op — Draw Steel uses the shared difficulty popup, not a select element
  }

  /**
   * Check if an actor has a specific characteristic (Draw Steel specific).
   * All characters have all 5 characteristics, but we verify the data path exists.
   */
  async _actorHasSkill(actor, skillSlug) {
    if (!actor?.system?.characteristics) return true; // Assume present if no characteristics data
    const fullName = DRAWSTEEL_CHARACTERISTIC_FULL_NAMES[skillSlug];
    if (!fullName) return false;
    return fullName in actor.system.characteristics;
  }

  /**
   * Draw Steel has no saving throws
   */
  async _actorHasSave(_actor, _saveSlug) {
    return false;
  }

  /**
   * Draw Steel has no proficiency system
   */
  static async _isActorProficientInSkill(_actor, _skillSlug) {
    return false;
  }

  /**
   * Draw Steel has no proficiency ranks — always 0
   */
  static async _getActorProficiencyRank(_actor, _skillSlug) {
    return 0;
  }
}
