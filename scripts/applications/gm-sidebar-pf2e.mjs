import { GMSidebarAppBase } from './gm-sidebar.mjs';
import * as SystemAdapter from '../system-adapter.mjs';

/**
 * PF2e-specific GM Sidebar implementation
 */
export class GMSidebarAppPF2e extends GMSidebarAppBase {
  /**
   * Parse PF2e inline checks from journal content
   */
  _parseChecksFromContent(content) {
    const checks = [];

    // Find PF2e inline-check elements
    const checkElements = content.querySelectorAll('a.inline-check[data-pf2-check][data-pf2-dc]');

    checkElements.forEach((checkEl) => {
      const dc = checkEl.dataset.pf2Dc;
      const type = checkEl.dataset.pf2Check;
      const labelSpan = checkEl.querySelector('.label');
      const label = labelSpan ? labelSpan.textContent.trim() : checkEl.textContent.trim();

      if (dc && type) {
        checks.push({
          label,
          skillName: type,
          dc: parseInt(dc),
          id: foundry.utils.randomID(),
        });
      }
    });

    return checks;
  }

  /**
   * Get lore skills from participants (PF2e specific)
   * Only returns lore skills when exactly 1 participant is selected
   */
  static async _getLoreSkills(state, selectedParticipants) {
    // Only show lore skills when exactly 1 PC is selected
    if (selectedParticipants?.size !== 1) return [];
    if (!state?.participants?.length) return [];

    const selectedId = Array.from(selectedParticipants)[0];
    const participant = state.participants.find((p) => p.id === selectedId);
    if (!participant) return [];

    const actor = await fromUuid(participant.actorUuid);
    if (!actor?.system?.skills) return [];

    const lores = new Set();

    // PF2e stores lore skills with keys containing "-lore"
    for (const [key, skill] of Object.entries(actor.system.skills)) {
      if (key.includes('-lore') && skill.label) {
        lores.add(skill.label);
      }
    }

    return Array.from(lores)
      .sort()
      .map((loreName) => ({
        slug: loreName.toLowerCase().replace(/\s+/g, '-'),
        name: loreName,
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
      if (!actor?.system?.skills) continue;

      // Add all skills this actor has
      for (const [key] of Object.entries(actor.system.skills)) {
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
  async _prepareContextSystemSpecific() {
    const partyLevel = await this._getPartyLevel();
    const calculatedDC =
      partyLevel !== null ? this._calculateDCByLevel(partyLevel, this.currentDifficulty) : null;

    // Update currentDC if using level-based DC
    if (this.currentDC === null && calculatedDC !== null) {
      this.currentDC = calculatedDC;
    }

    // Build difficulty options
    const difficultyAdjustments = SystemAdapter.getDifficultyAdjustments();
    const difficultyOptions = difficultyAdjustments
      ? difficultyAdjustments.map((d) => ({
          ...d,
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
      ui.notifications.warn('No party found');
      return;
    }

    const partyMembers = party.members || [];

    if (partyMembers.length === 0) {
      ui.notifications.warn('No members in party');
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

    ui.notifications.info(`Added ${partyMembers.length} party member(s)`);
  }

  /**
   * Check if an actor has a specific skill (PF2e specific)
   * @param {Actor} actor - The actor to check
   * @param {string} skillSlug - The skill slug to check for (short form like 'soc')
   * @returns {Promise<boolean>} True if the actor has the skill
   */
  async _actorHasSkill(actor, skillSlug) {
    if (!actor?.system?.skills) return false;

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
    if (actor.system.skills[fullSlug]) {
      return true;
    }

    // Check lore skills (skillSlug might already be "politics-lore" format)
    if (skillSlug.includes('-lore') && actor.system.skills[skillSlug]) {
      return true;
    }

    return false;
  }
}
