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
      title: 'Challenge Library',
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

  constructor(selectedParticipants, gmSidebar, options = {}) {
    super(options);
    this.selectedParticipants = selectedParticipants;
    this.gmSidebar = gmSidebar;
  }

  async _prepareContext(_options) {
    const savedChallenges = game.settings.get(MODULE_ID, 'challengeLibrary') || [];

    // Enrich challenges with formatted options
    const challenges = savedChallenges.map(c => {
      const optionsPreview = c.options.map((opt, idx) => {
        const skillOptions = opt.skillOptions.map(so => {
          const skillName = this.gmSidebar._getSkillName(so.skill);
          const actionName = so.action ? this.gmSidebar._getActionName(so.skill, so.action) : null;
          return {
            skillName,
            actionName,
            dc: so.dc,
            isSecret: so.isSecret || false,
            displayText: actionName ? `${skillName} (${actionName})` : skillName,
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
      ui.notifications.error('Challenge not found');
      return;
    }

    // Create challenge data from template
    const challengeData = {
      id: foundry.utils.randomID(),
      name: template.name,
      image: template.image,
      selectedParticipants: [], // Broadcast to all players
      options: template.options,
    };

    await game.storyframe.socketManager.requestSetActiveChallenge(challengeData);
    ui.notifications.info(`Challenge "${challengeData.name}" presented to all players`);

    this.close();
  }

  static async _onEditChallenge(_event, target) {
    const challengeId = target.dataset.challengeId;
    const savedChallenges = game.settings.get(MODULE_ID, 'challengeLibrary') || [];
    const template = savedChallenges.find(c => c.id === challengeId);

    if (!template) {
      ui.notifications.error('Challenge not found');
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
      window: { title: 'Delete Challenge' },
      content: '<p>Delete this challenge from library?</p>',
      yes: { label: 'Delete' },
      no: { label: 'Cancel' },
      rejectClose: false,
    });

    if (!confirmed) return;

    const savedChallenges = game.settings.get(MODULE_ID, 'challengeLibrary') || [];
    const filtered = savedChallenges.filter(c => c.id !== challengeId);
    await game.settings.set(MODULE_ID, 'challengeLibrary', filtered);

    ui.notifications.info('Challenge deleted from library');

    // Refresh or close
    if (filtered.length === 0) {
      this.close();
    } else {
      this.render();
    }
  }
}
