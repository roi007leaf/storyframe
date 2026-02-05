import { GMSidebarAppBase } from './gm-sidebar-base.mjs';
import * as SkillCheckHandlers from './managers/skill-check-handlers.mjs';
import * as ParticipantHandlers from './managers/participant-handlers.mjs';
import * as SystemAdapter from '../../system-adapter.mjs';

/**
 * D&D 5e-specific GM Sidebar implementation
 */
export class GMSidebarAppDND5e extends GMSidebarAppBase {
  /**
   * Parse D&D 5e inline checks from journal content
   * Handles [[/check skill dc=15]] and [[/save ability dc=12]] syntax
   */
  _parseChecksFromContent(content) {
    const checks = [];

    // D&D 5e uses two structures and two data-type values:
    // 1. Single check: <a class="roll-action" data-type="check|skill" data-skill="acr" data-dc="20">
    // 2. Multiple checks: <span class="roll-link-group" data-type="check|skill" data-skill="acr|ath" data-dc="15">
    const singleChecks = content.querySelectorAll('a.roll-action[data-type="check"], a.roll-action[data-type="skill"]');
    const multiChecks = content.querySelectorAll('span.roll-link-group[data-type="check"], span.roll-link-group[data-type="skill"]');
    const singleSaves = content.querySelectorAll('a.roll-action[data-type="save"]');
    const multiSaves = content.querySelectorAll('span.roll-link-group[data-type="save"]');

    // Combine all check elements
    const checkGroups = [...singleChecks, ...multiChecks];
    const saveGroups = [...singleSaves, ...multiSaves];

    // Debug: Show actual HTML content
    console.log('StoryFrame | DND5e Parser Debug:', {
      singleChecks: singleChecks.length,
      multiChecks: multiChecks.length,
      totalChecks: checkGroups.length,
      singleSaves: singleSaves.length,
      multiSaves: multiSaves.length,
      totalSaves: saveGroups.length,
      htmlPreview: content.innerHTML.substring(0, 500),
      hasRollAction: content.querySelectorAll('a.roll-action').length,
      hasRollLinkGroup: content.querySelectorAll('span.roll-link-group').length,
      allDataTypes: Array.from(content.querySelectorAll('[data-type]')).map(el => ({
        tag: el.tagName,
        classes: el.className,
        dataType: el.dataset.type,
      })),
    });

    // Parse skill checks
    checkGroups.forEach((group) => {
      // Prefer skill over ability when both are present (e.g., data-ability="cha" data-skill="dec")
      const abilityOrSkill = group.dataset.skill || group.dataset.ability;
      const dc = group.dataset.dc;
      const label = group.querySelector('a.roll-link')?.textContent.trim();

      if (abilityOrSkill && dc) {
        // Handle pipe-separated skills (e.g., "acr|ath" means "Acrobatics or Athletics")
        const skills = abilityOrSkill.split('|').map(s => s.trim());

        skills.forEach((skill) => {
          checks.push({
            label: label || skill,
            skillName: skill.toLowerCase(),
            dc: parseInt(dc),
            isSecret: false, // D&D 5e doesn't have inline secret trait support
            id: foundry.utils.randomID(),
          });
        });
      }
    });

    // Parse saving throws
    saveGroups.forEach((group) => {
      const abilities = group.dataset.ability;
      const dc = group.dataset.dc;
      const label = group.querySelector('a.roll-link')?.textContent.trim();

      if (abilities && dc) {
        // Handle pipe-separated abilities (e.g., "str|dex" means "Strength or Dexterity")
        const abilityList = abilities.split('|').map(a => a.trim());

        abilityList.forEach((ability) => {
          checks.push({
            label: label || game.i18n.format('STORYFRAME.Difficulty.DND5e.SaveLabel', { ability: ability.toUpperCase() }),
            skillName: ability.toLowerCase(),
            dc: parseInt(dc),
            isSecret: false, // D&D 5e doesn't have inline secret trait support
            id: foundry.utils.randomID(),
          });
        });
      }
    });

    return checks;
  }

  /**
   * No lore skills in D&D 5e
   */
  static async _getLoreSkills(_state) {
    return [];
  }

  /**
   * Get available skills from selected participants (D&D 5e specific)
   * Returns a Set of skill slugs (lowercase) that at least one selected PC has
   */
  static async _getAvailableSkills(state, selectedParticipants) {
    if (!selectedParticipants?.size) return new Set();
    if (!state?.participants?.length) return new Set();

    const availableSkills = new Set();

    for (const participantId of selectedParticipants) {
      const participant = state.participants.find((p) => p.id === participantId);
      if (!participant) continue;

      const actor = await fromUuid(participant.actorUuid);
      if (!actor?.system?.skills) continue;

      // Add all skills this actor has
      for (const [key] of Object.entries(actor.system.skills)) {
        availableSkills.add(key.toLowerCase());
      }

      // D&D 5e also has abilities (for saving throws)
      if (actor.system?.abilities) {
        for (const [key] of Object.entries(actor.system.abilities)) {
          availableSkills.add(key.toLowerCase());
        }
      }
    }

    return availableSkills;
  }

  /**
   * No level-based DCs in D&D 5e
   */
  async _getPartyLevel() {
    return null;
  }

  /**
   * No level-based DC calculation in D&D 5e
   */
  _calculateDCByLevel(_level, _difficultyId) {
    return null;
  }

  /**
   * Override skill categorization for D&D 5e
   */
  async _prepareContext(_options) {
    const baseContext = await super._prepareContext(_options);

    // Override with D&D 5e skill categories
    const state = game.storyframe.stateManager.getState();
    if (!state) return baseContext;

    const { participants } = await ParticipantHandlers.prepareParticipantsContext(this, state);

    // Get all D&D 5e skills from system adapter
    const allSystemSkills = SystemAdapter.getSkills();
    const allSkills = Object.keys(allSystemSkills).map(slug => ({
      slug,
      name: SkillCheckHandlers.getSkillName(slug),
      shortName: SkillCheckHandlers.getSkillShortName(slug),
      icon: SkillCheckHandlers.getSkillIcon(slug),
    }));

    const dnd5eSkillCategories = {
      physical: ['ath', 'acr', 'slt', 'ste'],         // Athletics, Acrobatics, Sleight of Hand, Stealth
      mental: ['arc', 'his', 'inv', 'nat', 'rel'],    // Arcana, History, Investigation, Nature, Religion
      social: ['dec', 'ins', 'itm', 'per', 'prf'],    // Deception, Insight, Intimidation, Persuasion, Performance
      utility: ['ani', 'med', 'prc', 'sur'],          // Animal Handling, Medicine, Perception, Survival
    };

    const categorizedSkills = {
      physicalSkills: await SkillCheckHandlers.mapSkillsWithProficiency(dnd5eSkillCategories.physical, allSkills, participants),
      magicalSkills: await SkillCheckHandlers.mapSkillsWithProficiency(dnd5eSkillCategories.mental, allSkills, participants),
      socialSkills: await SkillCheckHandlers.mapSkillsWithProficiency(dnd5eSkillCategories.social, allSkills, participants),
      utilitySkills: await SkillCheckHandlers.mapSkillsWithProficiency(dnd5eSkillCategories.utility, allSkills, participants),
    };

    return {
      ...baseContext,
      ...categorizedSkills,
    };
  }

  /**
   * No system-specific context needed for D&D 5e
   */
  async _prepareContextSystemSpecific() {
    return {};
  }

  /**
   * Attach D&D 5e DC dropdown handler
   */
  _attachSystemDCHandlers() {
    const dnd5eDCSelect = this.element.querySelector('#dc-select-dnd5e');
    if (!dnd5eDCSelect) return;

    // Prevent click propagation
    dnd5eDCSelect.addEventListener('mousedown', (e) => e.stopPropagation());
    dnd5eDCSelect.addEventListener('click', (e) => e.stopPropagation());

    dnd5eDCSelect.addEventListener('change', (e) => {
      const dc = parseInt(e.target.value);
      if (!isNaN(dc)) {
        this.currentDC = dc;

        const dcInput = this.element.querySelector('#dc-input');
        if (dcInput) {
          dcInput.value = this.currentDC;
        }
      }
    });
  }

  /**
   * D&D 5e doesn't have party actors - fall back to adding all PCs
   */
  static async _onAddPartyPCs(event, target) {
    return GMSidebarAppDND5e._onAddAllPCs.call(this, event, target);
  }

  /**
   * Check if an actor has a specific skill (D&D 5e specific)
   * @param {Actor} actor - The actor to check
   * @param {string} skillSlug - The skill slug to check for
   * @returns {Promise<boolean>} True if the actor has the skill
   */
  async _actorHasSkill(actor, skillSlug) {
    if (!actor?.system) return false;

    // Check skills
    if (actor.system.skills?.[skillSlug]) {
      return true;
    }

    // Check abilities (for saving throws)
    if (actor.system.abilities?.[skillSlug]) {
      return true;
    }

    return false;
  }

  /**
   * Check D&D 5e actor proficiency.
   */
  static async _isActorProficientInSkill(actor, skillSlug) {
    if (!actor?.system?.skills) return false;

    const skill = actor.system.skills[skillSlug];
    // In 5e, proficiency is indicated by value > 0 (where value is the proficiency multiplier: 0, 0.5, 1, 2)
    return skill?.value > 0;
  }

  /**
   * Get D&D 5e actor proficiency rank (0-2).
   * 0 = Not Proficient, 1 = Proficient, 2 = Expertise
   * Note: Half proficiency (0.5) is treated as rank 1
   */
  static async _getActorProficiencyRank(actor, skillSlug) {
    if (!actor?.system?.skills) return 0;

    const skill = actor.system.skills[skillSlug];
    if (!skill) return 0;

    const value = skill.value ?? 0;

    // Map proficiency value to rank
    if (value >= 2) return 2; // Expertise
    if (value > 0) return 1;  // Proficient (includes half proficiency)
    return 0; // Not proficient
  }
}
