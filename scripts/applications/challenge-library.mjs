import { MODULE_ID } from '../constants.mjs';

/**
 * Challenge Library Manager Dialog
 * Browse and present saved challenges
 */
export class ChallengeLibraryDialog extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
) {
  static DEFAULT_OPTIONS = {
    id: 'storyframe-challenge-library',
    classes: ['storyframe', 'challenge-library'],
    window: {
      title: 'STORYFRAME.WindowTitles.ChallengeLibrary',
      resizable: false,
    },
    position: {
      width: 500,
      height: 'auto',
    },
    actions: {
      presentChallenge: ChallengeLibraryDialog._onPresentChallenge,
      editChallenge: ChallengeLibraryDialog._onEditChallenge,
      deleteChallenge: ChallengeLibraryDialog._onDeleteChallenge,
    },
  };

  static PARTS = {
    content: {
      template: 'modules/storyframe/templates/challenge-library.hbs',
    },
  };

  constructor(_selectedParticipants, gmSidebar, options = {}) {
    super(options);
    this.gmSidebar = gmSidebar;
  }

  async _prepareContext(_options) {
    const savedChallenges = game.settings.get(MODULE_ID, 'challengeLibrary') || [];

    // Import SystemAdapter for save names
    const SystemAdapter = await import('../system-adapter.mjs');
    const systemSaves = SystemAdapter.getSaves();

    // Enrich challenges with formatted options
    const challenges = savedChallenges.map(c => {
      const optionsPreview = c.options.map((opt, idx) => {
        const skillOptions = opt.skillOptions.map(so => {
          const checkType = so.checkType || 'skill';

          // Get name based on check type (saves don't capitalize, skills do)
          let checkName;
          if (checkType === 'save') {
            // For saves, get proper name without uppercasing
            checkName = systemSaves[so.skill]?.name || so.skill;
          } else {
            // For skills, use existing method (which uppercases)
            checkName = this.gmSidebar._getSkillName(so.skill);
          }

          const actionName = so.action ? this.gmSidebar._getActionName(so.skill, so.action) : null;
          return {
            skillName: checkName,
            actionName,
            dc: so.dc,
            isSecret: so.isSecret || false,
            checkType,
            displayText: actionName ? `${checkName} (${actionName})` : checkName,
          };
        });

        return {
          index: idx + 1,
          description: opt.description,
          skillOptions,
        };
      });

      return {
        id: c.id,
        name: c.name,
        image: c.image,
        options: optionsPreview,
      };
    });

    return {
      challenges,
      hasChallenges: challenges.length > 0,
    };
  }

  static async _onPresentChallenge(_event, target) {
    const challengeId = target.dataset.challengeId;
    const savedChallenges = game.settings.get(MODULE_ID, 'challengeLibrary') || [];
    const template = savedChallenges.find(c => c.id === challengeId);

    if (!template) {
      ui.notifications.error(game.i18n.localize('STORYFRAME.Notifications.Challenge.ChallengeNotFound'));
      return;
    }

    // Create challenge data from template
    const challengeData = {
      id: foundry.utils.randomID(),
      name: template.name,
      image: template.image,
      // Challenge is broadcast to all players
      options: template.options,
    };

    await game.storyframe.socketManager.requestSetActiveChallenge(challengeData);
    ui.notifications.info(game.i18n.format('STORYFRAME.Notifications.Challenge.ChallengePresentedAll', { name: challengeData.name }));

    this.close();
  }

  static async _onEditChallenge(_event, target) {
    const challengeId = target.dataset.challengeId;
    const savedChallenges = game.settings.get(MODULE_ID, 'challengeLibrary') || [];
    const template = savedChallenges.find(c => c.id === challengeId);

    if (!template) {
      ui.notifications.error(game.i18n.localize('STORYFRAME.Notifications.Challenge.ChallengeNotFound'));
      return;
    }

    // Import ChallengeBuilderDialog
    const { ChallengeBuilderDialog } = await import('./challenge-builder.mjs');

    // Open builder in edit mode
    const builder = new ChallengeBuilderDialog(new Set(), {
      editMode: true,
      templateId: challengeId,
      templateData: template,
    });
    builder.render(true);

    // Close library dialog
    this.close();
  }

  static async _onDeleteChallenge(_event, target) {
    const challengeId = target.dataset.challengeId;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('STORYFRAME.Dialogs.DeleteChallenge.Title') },
      content: `<p>${game.i18n.localize('STORYFRAME.Dialogs.DeleteChallenge.Content')}</p>`,
      yes: { label: game.i18n.localize('STORYFRAME.Dialogs.DeleteChallenge.Button') },
      no: { label: game.i18n.localize('STORYFRAME.Dialogs.Cancel') },
      rejectClose: false,
    });

    if (!confirmed) return;

    const savedChallenges = game.settings.get(MODULE_ID, 'challengeLibrary') || [];
    const filtered = savedChallenges.filter(c => c.id !== challengeId);
    await game.settings.set(MODULE_ID, 'challengeLibrary', filtered);

    ui.notifications.info(game.i18n.localize('STORYFRAME.Notifications.Challenge.ChallengeDeleted'));

    // Refresh or close
    if (filtered.length === 0) {
      this.close();
    } else {
      this.render();
    }
  }
}
