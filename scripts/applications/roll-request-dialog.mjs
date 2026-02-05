import { MODULE_ID } from '../constants.mjs';
import * as SystemAdapter from '../system-adapter.mjs';

/**
 * Dialog for requesting rolls from selected journal text
 */
export class RollRequestDialog extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
) {
  static DEFAULT_OPTIONS = {
    id: 'storyframe-roll-request-{id}',
    window: {
      title: 'STORYFRAME.WindowTitles.RequestRolls',
      icon: 'fas fa-dice-d20',
      minimizable: false,
      resizable: false,
    },
    position: {
      width: 480,
    },
    classes: ['storyframe', 'roll-request-dialog-app'],
    actions: {
      submit: RollRequestDialog._onSubmit,
      cancel: RollRequestDialog._onCancel,
    },
  };

  static PARTS = {
    form: {
      template: 'modules/storyframe/templates/roll-request-dialog.hbs',
    },
  };

  constructor(checks, participants, options = {}) {
    super(options);
    this.checks = checks;
    this.participants = participants;
    this.resolve = null;
    this.promise = new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  async _prepareContext(_options) {
    const systemSkills = SystemAdapter.getSkills();

    // Enrich checks with skill icons and display names
    const enrichedChecks = this.checks.map(check => {
      // Try to find skill data by various methods
      let skillData = null;

      // First try using the skill name as-is (might be short slug like "thi")
      skillData = systemSkills[check.skillName];

      // If not found, try lowercase
      if (!skillData) {
        skillData = systemSkills[check.skillName.toLowerCase()];
      }

      // If still not found, search through all skills for a match
      if (!skillData) {
        const searchName = check.skillName.toLowerCase();
        for (const [key, skill] of Object.entries(systemSkills)) {
          if (skill.name?.toLowerCase() === searchName || key === searchName) {
            skillData = skill;
            break;
          }
        }
      }

      return {
        ...check,
        skillIcon: skillData?.icon || 'fa-dice-d20',
        skillName: skillData?.name || check.skillName,
      };
    });

    // Ensure participants have required properties with fallbacks
    const unknownLabel = game.i18n.localize('STORYFRAME.UI.Labels.Unknown');
    const enrichedParticipants = this.participants.map(p => ({
      id: p.id,
      name: p.name || unknownLabel,
      img: p.img || 'icons/svg/mystery-man.svg',
    }));

    return {
      checks: enrichedChecks,
      participants: enrichedParticipants,
      i18n: {
        foundChecks: game.i18n.format('STORYFRAME.Dialogs.RollRequest.FoundChecks', { count: enrichedChecks.length }),
        selectPCs: game.i18n.localize('STORYFRAME.Dialogs.RollRequest.SelectPCs'),
        cancel: game.i18n.localize('STORYFRAME.Dialogs.Cancel'),
        sendRollRequests: game.i18n.localize('STORYFRAME.Dialogs.RollRequest.SendRollRequests'),
        secret: game.i18n.localize('STORYFRAME.Dialogs.RollRequest.Secret'),
      },
    };
  }

  /**
   * Wait for the dialog to be resolved
   * @returns {Promise<string[]|null>} Selected participant IDs or null if cancelled
   */
  async wait() {
    return this.promise;
  }

  static async _onSubmit(event, target) {
    event.preventDefault();
    const form = target.closest('form');
    const formData = new FormDataExtended(form);
    const data = formData.object;

    // Get selected participant IDs
    const selectedIds = data.participant
      ? (Array.isArray(data.participant) ? data.participant : [data.participant])
      : [];

    this.resolve(selectedIds);
    this.close();
  }

  static async _onCancel(_event, _target) {
    this.resolve(null);
    this.close();
  }

  async close(options = {}) {
    // Ensure promise resolves even if closed via X button
    if (this.resolve) {
      this.resolve(null);
    }
    return super.close(options);
  }
}
