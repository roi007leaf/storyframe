import { GMSidebarAppBase } from './gm-sidebar-base.mjs';
import * as SystemAdapter from '../../system-adapter.mjs';

/**
 * PF2e-specific GM Sidebar implementation
 */
export class GMSidebarAppPF2e extends GMSidebarAppBase {
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    actions: {
      addPartyPCs: GMSidebarAppPF2e._onAddPartyPCs,
    },
  }, { inplace: false });

  /**
   * Parse PF2e inline checks from journal content
   */
  _parseChecksFromContent(content) {
    const checks = [];

    // Save types for detection
    const saveTypes = new Set(['fortitude', 'reflex', 'will']);

    // Find PF2e inline-check elements
    const checkElements = content.querySelectorAll('a.inline-check[data-pf2-check][data-pf2-dc]');

    checkElements.forEach((checkEl) => {
      const dc = checkEl.dataset.pf2Dc;
      const type = checkEl.dataset.pf2Check;
      const traits = checkEl.dataset.pf2Traits || '';
      const labelSpan = checkEl.querySelector('.label');
      const label = labelSpan ? labelSpan.textContent.trim() : checkEl.textContent.trim();

      if (dc && type) {
        // Determine if this is a save or skill check
        const checkType = saveTypes.has(type.toLowerCase()) ? 'save' : 'skill';

        checks.push({
          label,
          skillName: type,
          dc: parseInt(dc),
          isSecret: traits.toLowerCase().includes('secret'),
          checkType, // Add check type
          id: foundry.utils.randomID(),
        });
      }
    });

    return checks;
  }

  /**
   * Get lore skills from participants (PF2e specific)
   * Returns lore skills from all selected participants
   */
  static async _getLoreSkills(state, selectedParticipants) {
    if (!selectedParticipants?.size) return [];
    if (!state?.participants?.length) return [];

    const lores = new Map(); // Use Map to store key->label pairs

    // Collect lore skills from all selected participants
    for (const participantId of selectedParticipants) {
      const participant = state.participants.find((p) => p.id === participantId);
      if (!participant) continue;

      const actor = await fromUuid(participant.actorUuid);
      if (!actor?.skills) continue;

      // PF2e stores lore skills with keys containing "-lore"
      for (const [key, skill] of Object.entries(actor.skills)) {
        if (key.includes('-lore') && skill.label) {
          lores.set(key, skill.label); // Store actual key from PF2e
        }
      }
    }

    return Array.from(lores.entries())
      .sort((a, b) => a[1].localeCompare(b[1])) // Sort by label
      .map(([key, label]) => ({
        slug: key, // Use the actual PF2e skill key (e.g., "academia-lore")
        name: label, // Use the display label (e.g., "Academia Lore")
        isLore: true,
      }));
  }

  /**
   * Get available skills from selected participants (PF2e specific)
   * Returns a Set of skill slugs (lowercase) that at least one selected PC has
   */
  static async _getAvailableSkills(state, selectedParticipants) {
    if (!selectedParticipants?.size) return new Set();
    if (!state?.participants?.length) return new Set();

    const availableSkills = new Set();

    // Get all standard PF2e skills
    const systemSkills = SystemAdapter.getSkills();

    for (const participantId of selectedParticipants) {
      const participant = state.participants.find((p) => p.id === participantId);
      if (!participant) continue;

      const actor = await fromUuid(participant.actorUuid);
      if (!actor?.skills) continue;

      // Add all skills this actor has
      for (const [key] of Object.entries(actor.skills)) {
        // Standard skills - check if they exist in the system skills
        if (systemSkills[key]) {
          availableSkills.add(key.toLowerCase());
        }
        // Lore skills - use the key as-is (already in "politics-lore" format)
        if (key.includes('-lore')) {
          availableSkills.add(key.toLowerCase());
        }
      }
    }

    return availableSkills;
  }

  /**
   * Check PF2e actor proficiency (rank > 0 means trained or better).
   */
  static async _isActorProficientInSkill(actor, skillSlug) {
    if (!actor?.skills) return false;

    // Handle perception separately
    if (skillSlug === 'per') {
      return actor.perception?.rank > 0;
    }

    // Map short slugs to full PF2e skill names
    const skillMap = {
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

    const fullSlug = skillMap[skillSlug] || skillSlug;

    // Standard skills
    const skill = actor.skills[fullSlug];
    if (skill?.rank > 0) return true;

    // Lore skills (if slug contains '-lore')
    if (skillSlug.includes('-lore')) {
      const loreSkill = actor.skills[skillSlug];
      return loreSkill?.rank > 0;
    }

    return false;
  }

  /**
   * Get PF2e actor proficiency rank (0-4).
   * 0 = Untrained, 1 = Trained, 2 = Expert, 3 = Master, 4 = Legendary
   */
  static async _getActorProficiencyRank(actor, skillSlug) {
    if (!actor?.skills) return 0;

    // Handle perception separately
    if (skillSlug === 'per') {
      return actor.perception?.rank ?? 0;
    }

    // Map short slugs to full PF2e skill names
    const skillMap = {
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

    const fullSlug = skillMap[skillSlug] || skillSlug;

    // Standard skills
    const skill = actor.skills[fullSlug];
    if (skill) return skill.rank ?? 0;

    // Lore skills (if slug contains '-lore')
    if (skillSlug.includes('-lore')) {
      const loreSkill = actor.skills[skillSlug];
      return loreSkill?.rank ?? 0;
    }

    return 0;
  }

  /**
   * Get party level (average of participants)
   */
  async _getPartyLevel() {
    const state = game.storyframe.stateManager.getState();
    if (!state?.participants?.length) return null;

    const levels = await Promise.all(
      state.participants.map(async (p) => {
        const actor = await fromUuid(p.actorUuid);
        return actor?.system?.details?.level?.value ?? actor?.system?.level ?? null;
      }),
    );

    const validLevels = levels.filter((l) => l !== null);
    if (validLevels.length === 0) return null;

    return Math.round(validLevels.reduce((a, b) => a + b, 0) / validLevels.length);
  }

  /**
   * Calculate DC from level and difficulty
   */
  _calculateDCByLevel(level, difficultyId) {
    const dcOptions = SystemAdapter.getDCOptions();
    const difficultyAdjustments = SystemAdapter.getDifficultyAdjustments();

    const levelOption = dcOptions.find((opt) => opt.value === level);
    const baseDC = levelOption?.dc || 14;

    const difficulty = difficultyAdjustments?.find((d) => d.id === difficultyId);
    const adjustment = difficulty?.adjustment || 0;

    return baseDC + adjustment;
  }

  /**
   * Prepare PF2e-specific context
   */
  async _prepareContext(_options) {
    const baseContext = await super._prepareContext(_options);

    // Get all PF2e saves from system adapter
    const allSystemSaves = SystemAdapter.getSaves();
    const saves = Object.keys(allSystemSaves).map(slug => ({
      slug,
      name: allSystemSaves[slug].name,
      icon: allSystemSaves[slug].icon,
    }));

    return {
      ...baseContext,
      saves,
    };
  }

  async _prepareContextSystemSpecific() {
    const partyLevel = await this._getPartyLevel();
    const calculatedDC =
      partyLevel !== null ? this._calculateDCByLevel(partyLevel, this.currentDifficulty) : null;

    // Update currentDC if using level-based DC
    if (this.currentDC === null && calculatedDC !== null) {
      this.currentDC = calculatedDC;
    }

    // Build difficulty options with localized labels
    const difficultyAdjustments = SystemAdapter.getDifficultyAdjustments();
    const difficultyOptions = difficultyAdjustments
      ? difficultyAdjustments.map((d) => ({
          ...d,
          label: game.i18n.localize(d.labelKey),
          selected: d.id === this.currentDifficulty,
        }))
      : null;

    return { partyLevel, calculatedDC, difficultyOptions };
  }

  /**
   * Attach PF2e difficulty selector handler
   */
  _attachSystemDCHandlers() {
    const difficultySelect = this.element.querySelector('#difficulty-select');
    if (!difficultySelect) return;

    // Prevent click propagation
    difficultySelect.addEventListener('mousedown', (e) => e.stopPropagation());
    difficultySelect.addEventListener('click', (e) => e.stopPropagation());

    difficultySelect.addEventListener('change', async (e) => {
      this.currentDifficulty = e.target.value;

      const partyLevel = await this._getPartyLevel();
      if (partyLevel !== null) {
        this.currentDC = this._calculateDCByLevel(partyLevel, this.currentDifficulty);

        const dcInput = this.element.querySelector('#dc-input');
        if (dcInput) {
          dcInput.value = this.currentDC;
        }
      }
    });
  }

  /**
   * Add party members (PF2e party actor)
   */
  static async _onAddPartyPCs(_event, _target) {
    const party = game.actors.find((a) => a.type === 'party');

    if (!party) {
      ui.notifications.warn(game.i18n.localize('STORYFRAME.Notifications.Participant.NoPartyFound'));
      return;
    }

    const memberRefs = party.system.details.members || [];

    if (memberRefs.length === 0) {
      ui.notifications.warn(game.i18n.localize('STORYFRAME.Notifications.Participant.NoMembersInParty'));
      return;
    }

    // Resolve member references to actual actors
    const partyMembers = [];
    for (const memberRef of memberRefs) {
      const actor = await fromUuid(memberRef.uuid);
      if (actor) {
        partyMembers.push(actor);
      }
    }

    if (partyMembers.length === 0) {
      ui.notifications.warn(game.i18n.localize('STORYFRAME.Notifications.Participant.NoValidMembersInParty'));
      return;
    }

    for (const actor of partyMembers) {
      const owningUser = game.users.find(
        (user) => !user.isGM && actor.testUserPermission(user, 'OWNER'),
      );

      if (owningUser) {
        await game.storyframe.socketManager.requestAddParticipant({
          actorUuid: actor.uuid,
          userId: owningUser.id,
        });
      }
    }

    ui.notifications.info(game.i18n.format('STORYFRAME.Notifications.Participant.PartyMembersAdded', { count: partyMembers.length }));
  }

  /**
   * Check if an actor has a specific skill (PF2e specific)
   * @param {Actor} actor - The actor to check
   * @param {string} skillSlug - The skill slug to check for (short form like 'soc')
   * @returns {Promise<boolean>} True if the actor has the skill
   */
  async _actorHasSkill(actor, skillSlug) {
    if (!actor?.skills) return false;

    // Map short skill slugs to full PF2e skill slugs
    const PF2E_SKILL_SLUG_MAP = {
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

    // Map short slug to full slug
    const fullSlug = PF2E_SKILL_SLUG_MAP[skillSlug] || skillSlug;

    // Check if it's perception (special case)
    if (fullSlug === 'perception' && actor.perception) {
      return true;
    }

    // Check standard skills using full slug
    if (actor.skills[fullSlug]) {
      return true;
    }

    // Check lore skills (skillSlug might already be "politics-lore" format)
    if (skillSlug.includes('-lore') && actor.skills[skillSlug]) {
      return true;
    }

    return false;
  }

  /**
   * Check if an actor has a specific save (PF2e specific)
   * @param {Actor} actor - The actor to check
   * @param {string} saveSlug - The save slug to check for (fortitude, reflex, will)
   * @returns {Promise<boolean>} True if the actor has the save
   */
  async _actorHasSave(actor, saveSlug) {
    if (!actor?.saves) return false;
    // PF2e actors have saves.fortitude, saves.reflex, saves.will
    return !!actor.saves[saveSlug];
  }
}
