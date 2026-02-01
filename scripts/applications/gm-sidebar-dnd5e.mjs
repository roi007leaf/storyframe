import { GMSidebarAppBase } from './gm-sidebar.mjs';

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

    // D&D 5e uses <span class="roll-link-group" data-type="check|save">
    const checkGroups = content.querySelectorAll('span.roll-link-group[data-type="check"]');
    const saveGroups = content.querySelectorAll('span.roll-link-group[data-type="save"]');

    // Parse skill checks
    checkGroups.forEach((group) => {
      const ability = group.dataset.ability || group.dataset.skill;
      const dc = group.dataset.dc;
      const label = group.querySelector('a.roll-link')?.textContent.trim();

      if (ability && dc) {
        checks.push({
          label: label || ability,
          skillName: ability.toLowerCase(),
          dc: parseInt(dc),
          id: foundry.utils.randomID(),
        });
      }
    });

    // Parse saving throws
    saveGroups.forEach((group) => {
      const ability = group.dataset.ability;
      const dc = group.dataset.dc;
      const label = group.querySelector('a.roll-link')?.textContent.trim();

      if (ability && dc) {
        checks.push({
          label: label || `${ability.toUpperCase()} Save`,
          skillName: ability.toLowerCase(),
          dc: parseInt(dc),
          id: foundry.utils.randomID(),
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
}
