import { GMSidebarAppBase } from './gm-sidebar-base.mjs';
import * as SkillCheckHandlers from './managers/skill-check-handlers.mjs';
import * as SkillReorderHandlers from './managers/skill-reorder-handlers.mjs';
import * as SystemAdapter from '../../system-adapter.mjs';
import { DAGGERHEART_TRAIT_FULL_NAMES, DAGGERHEART_TRAIT_NAME_MAP } from '../../system/daggerheart/skills.mjs';

/**
 * Daggerheart-specific GM Sidebar implementation.
 * Daggerheart uses 6 core Traits instead of skills/saves.
 */
export class GMSidebarAppDaggerheart extends GMSidebarAppBase {
  /**
   * Parse Daggerheart checks from journal content.
   * Relies on the text enricher (check-enricher.mjs) which converts
   * "Agility DC 12" style text into .sf-check[data-check] elements.
   */
  _parseChecksFromContent(content) {
    const checks = [];

    // Parse StoryFrame text-enriched check spans (from "Strength DC 14" text)
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

    // Parse Daggerheart native duality roll buttons
    content.querySelectorAll('button.duality-roll-button[data-trait][data-difficulty]').forEach((el) => {
      const traitFullName = el.dataset.trait?.toLowerCase();
      const dc = parseInt(el.dataset.difficulty);
      if (!traitFullName || isNaN(dc)) return;

      const slug = DAGGERHEART_TRAIT_NAME_MAP[traitFullName] || traitFullName;
      const displayName = traitFullName.charAt(0).toUpperCase() + traitFullName.slice(1);
      checks.push({
        label: el.dataset.label || el.dataset.title || displayName,
        skillName: slug,
        dc: dc,
        isSecret: false,
        checkType: 'skill',
        id: foundry.utils.randomID(),
      });
    });

    return checks;
  }

  /**
   * No lore skills in Daggerheart
   */
  static async _getLoreSkills(_state) {
    return [];
  }

  /**
   * All Daggerheart characters have all 6 traits — return them unconditionally.
   */
  static async _getAvailableSkills(_state, _selectedParticipants) {
    return new Set(['agi', 'str', 'fin', 'ins', 'pre', 'kno']);
  }

  /**
   * No level-based DCs in Daggerheart
   */
  async _getPartyLevel() {
    return null;
  }

  /**
   * No level-based DC calculation in Daggerheart
   */
  _calculateDCByLevel(_level, _difficultyId) {
    return null;
  }

  /**
   * Override skill categorization for Daggerheart.
   * Physical: Agility, Strength, Finesse
   * Mental: Instinct, Presence, Knowledge
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

    const daggerheartTraitCategories = {
      physical: ['agi', 'str', 'fin'],  // Agility, Strength, Finesse
      mental: ['ins', 'pre', 'kno'],    // Instinct, Presence, Knowledge
    };

    const categorizedSkills = {
      physicalSkills: await SkillCheckHandlers.mapSkillsWithProficiency(daggerheartTraitCategories.physical, allSkills, null),
      magicalSkills: await SkillCheckHandlers.mapSkillsWithProficiency(daggerheartTraitCategories.mental, allSkills, null),
      socialSkills: [],
      utilitySkills: [],
    };

    categorizedSkills.physicalSkills = SkillReorderHandlers.applySavedSkillOrder(categorizedSkills.physicalSkills, 'physical');
    categorizedSkills.magicalSkills = SkillReorderHandlers.applySavedSkillOrder(categorizedSkills.magicalSkills, 'magical');
    SkillReorderHandlers.applySavedCategoryOrder(categorizedSkills);

    return {
      ...baseContext,
      ...categorizedSkills,
      saves: [], // No saves in Daggerheart
    };
  }

  /**
   * No system-specific context needed for Daggerheart
   */
  async _prepareContextSystemSpecific() {
    return {};
  }

  /**
   * No system-specific DC select handler needed for Daggerheart.
   * Difficulty options are provided via the preset popup (dc-handlers.mjs).
   */
  _attachSystemDCHandlers() {
    // no-op — Daggerheart uses the shared difficulty popup, not a select element
  }

  /**
   * Check if an actor has a specific trait (Daggerheart specific).
   * All characters have all 6 traits, but we verify the data path exists.
   */
  async _actorHasSkill(actor, skillSlug) {
    if (!actor?.system?.traits) return true; // Assume present if no traits data
    const fullName = DAGGERHEART_TRAIT_FULL_NAMES[skillSlug];
    if (!fullName) return false;
    return fullName in actor.system.traits;
  }

  /**
   * Daggerheart has no saving throws
   */
  async _actorHasSave(_actor, _saveSlug) {
    return false;
  }

  /**
   * Daggerheart has no proficiency system
   */
  static async _isActorProficientInSkill(_actor, _skillSlug) {
    return false;
  }

  /**
   * Daggerheart has no proficiency ranks — always 0
   */
  static async _getActorProficiencyRank(_actor, _skillSlug) {
    return 0;
  }
}
