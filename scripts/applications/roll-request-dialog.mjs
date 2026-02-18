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
      resizable: true,
    },
    position: {
      width: 480,
      height: 'auto',
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
    this.allowOnlyOne = false; // Allow-only-one toggle state
    this._autoSized = false;
    this.resolve = null;
    this.promise = new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  async _onRender(_context, _options) {
    super._onRender(_context, _options);

    // Wire up participant checkboxes to enable/disable submit button
    const submitBtn = this.element.querySelector('.submit-btn');
    const checkboxes = this.element.querySelectorAll('input[name="participant"]');

    const updateSubmit = () => {
      const anyChecked = Array.from(checkboxes).some(cb => cb.checked);
      submitBtn.disabled = !anyChecked;
    };

    checkboxes.forEach(cb => cb.addEventListener('change', updateSubmit));
    updateSubmit();

    if (this._autoSized) return;
    this._autoSized = true;

    await this._autoSizeToContent();
  }

  async _autoSizeToContent() {
    await new Promise((resolve) => setTimeout(resolve, 0));
    this.setPosition({ height: 'auto' });
  }

  async _prepareContext(_options) {
    const systemSkills = SystemAdapter.getSkills();
    const systemSaves = SystemAdapter.getSaves();

    // Enrich checks with skill/save icons and display names
    const enrichedChecks = this.checks.map(check => {
      // Determine if this is a save or skill check
      const checkType = check.checkType || 'skill';
      const lookupTable = checkType === 'save' ? systemSaves : systemSkills;

      // Try to find check data by various methods
      let checkData = null;

      // First try using the check name as-is (might be short slug like "thi" or "fortitude")
      checkData = lookupTable[check.skillName];

      // If not found, try lowercase
      if (!checkData) {
        checkData = lookupTable[check.skillName.toLowerCase()];
      }

      // If still not found, search through all checks for a match
      if (!checkData) {
        const searchName = check.skillName.toLowerCase();
        for (const [key, data] of Object.entries(lookupTable)) {
          if (data.name?.toLowerCase() === searchName || key === searchName) {
            checkData = data;
            break;
          }
        }
      }

      // Compute action display name
      let actionName = null;
      if (check.actionSlug) {
        const skillData = systemSkills[check.skillName];
        const action = skillData?.actions?.find(a => a.slug === check.actionSlug);
        actionName = action?.name || null;
      }

      // Compute variant display name
      const variantName = check.actionVariant
        ? check.actionVariant.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        : null;

      return {
        ...check,
        skillIcon: checkData?.icon || 'fa-dice-d20',
        skillName: checkData?.name || check.skillName,
        checkType,
        actionName,
        variantName,
      };
    });

    // Ensure participants have required properties with fallbacks
    const unknownLabel = game.i18n.localize('STORYFRAME.UI.Labels.Unknown');
    const enrichedParticipants = this.participants.map(p => ({
      id: p.id,
      name: p.name || unknownLabel,
      img: p.img || 'icons/svg/mystery-man.svg',
    }));

    // Detect what types of checks are present (skills, saves, or both)
    const hasSkills = enrichedChecks.some(check => check.checkType !== 'save');
    const hasSaves = enrichedChecks.some(check => check.checkType === 'save');

    let foundChecksText;
    if (hasSkills && hasSaves) {
      // Mixed: both skills and saves
      foundChecksText = game.i18n.format('STORYFRAME.Dialogs.RollRequest.FoundChecksAndSaves', { count: enrichedChecks.length });
    } else if (hasSaves) {
      // Only saves
      foundChecksText = game.i18n.format('STORYFRAME.Dialogs.RollRequest.FoundSaves', { count: enrichedChecks.length });
    } else {
      // Only skills/checks
      foundChecksText = game.i18n.format('STORYFRAME.Dialogs.RollRequest.FoundChecks', { count: enrichedChecks.length });
    }

    return {
      checks: enrichedChecks,
      participants: enrichedParticipants,
      allowOnlyOne: this.allowOnlyOne,
      i18n: {
        foundChecks: foundChecksText,
        selectPCs: game.i18n.localize('STORYFRAME.Dialogs.RollRequest.SelectPCs'),
        cancel: game.i18n.localize('STORYFRAME.Dialogs.Cancel'),
        sendRollRequests: game.i18n.localize('STORYFRAME.Dialogs.RollRequest.SendRollRequests'),
        secret: game.i18n.localize('STORYFRAME.Dialogs.RollRequest.Secret'),
        allowOnlyOneLabel: game.i18n.localize('STORYFRAME.Dialogs.RollRequest.AllowOnlyOne'),
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

    // Get allow-only-one checkbox state
    const allowOnlyOne = data.allowOnlyOne || false;

    // Return object with both selectedIds and allowOnlyOne
    this.resolve({ selectedIds, allowOnlyOne });
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
