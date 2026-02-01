const MODULE_ID = 'storyframe';

import * as SystemAdapter from '../system-adapter.mjs';

/**
 * Challenge Builder Dialog
 * Allows GM to create multi-option challenges with different skills and DCs
 */
export class ChallengeBuilderDialog extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
) {
  static DEFAULT_OPTIONS = {
    id: 'storyframe-challenge-builder',
    classes: ['storyframe', 'challenge-builder'],
    window: {
      title: 'Present Challenge',
      resizable: false,
    },
    position: {
      width: 540,
      height: 'auto',
    },
    actions: {
      submit: ChallengeBuilderDialog._onSubmit,
      pickImage: ChallengeBuilderDialog._onPickImage,
      addSkill: ChallengeBuilderDialog._onAddSkill,
      removeSkill: ChallengeBuilderDialog._onRemoveSkill,
      addOption: ChallengeBuilderDialog._onAddOption,
      removeOption: ChallengeBuilderDialog._onRemoveOption,
    },
  };

  static PARTS = {
    content: {
      template: 'modules/storyframe/templates/challenge-builder.hbs',
    },
  };

  constructor(selectedParticipants, options = {}) {
    super(options);
    this.selectedParticipants = selectedParticipants;
    this.optionCount = 1;
    this.skillCounts = new Map();
    this.skillCounts.set(0, 1);
  }

  async _prepareContext(_options) {
    const systemSkills = SystemAdapter.getSkills();
    const skills = Object.entries(systemSkills).map(([slug, skill]) => ({
      slug,
      name: skill.name,
    }));

    return {
      skills,
      hasInitialOption: true,
    };
  }

  static async _onSubmit(event, target) {
    event.preventDefault();
    event.stopPropagation();

    const form = target.closest('form');
    const formData = new FormDataExtended(form).object;

    // Build challenge data
    const challengeData = {
      id: foundry.utils.randomID(),
      name: formData.challengeName || '',
      image: formData.challengeImage || null,
      selectedParticipants: Array.from(this.selectedParticipants),
      options: [],
    };

    // Parse options from form
    const optionCards = this.element.querySelectorAll('.challenge-option-card');
    optionCards.forEach((card) => {
      const idx = card.dataset.optionIndex;
      const description = formData[`option-${idx}-desc`] || '';

      // Parse skill-DC pairs
      const skillOptions = [];
      const skillRows = card.querySelectorAll('.skill-dc-row');
      skillRows.forEach((row) => {
        const skillIdx = row.dataset.skillIndex;
        const skill = formData[`option-${idx}-skill-${skillIdx}`];
        const dc = formData[`option-${idx}-dc-${skillIdx}`];

        if (skill && dc) {
          skillOptions.push({ skill, dc: parseInt(dc) });
        }
      });

      if (skillOptions.length > 0 && description) {
        challengeData.options.push({
          id: foundry.utils.randomID(),
          skillOptions,
          description,
        });
      }
    });

    if (challengeData.options.length === 0) {
      ui.notifications.warn('Add at least one option with skills');
      return;
    }

    // Save to library if checkbox checked
    if (formData.saveToLibrary) {
      const savedChallenges = game.settings.get(MODULE_ID, 'challengeLibrary') || [];
      const template = {
        id: foundry.utils.randomID(),
        name: challengeData.name,
        image: challengeData.image,
        options: challengeData.options,
        createdAt: Date.now(),
      };
      savedChallenges.push(template);
      await game.settings.set(MODULE_ID, 'challengeLibrary', savedChallenges);
      ui.notifications.info(`Saved "${challengeData.name}" to library`);
    }

    // Present challenge
    await game.storyframe.socketManager.requestSetActiveChallenge(challengeData);
    ui.notifications.info(`Challenge "${challengeData.name}" presented to ${this.selectedParticipants.size} PC(s)`);

    this.close();
  }

  static async _onPickImage(_event, _target) {
    new FilePicker({
      type: 'image',
      callback: (path) => {
        const input = this.element.querySelector('[name="challengeImage"]');
        if (input) input.value = path;
      },
    }).render(true);
  }

  static async _onAddSkill(_event, target) {
    const optionIdx = parseInt(target.dataset.optionIndex);
    const skillsList = this.element.querySelector(`.skills-list[data-option-index="${optionIdx}"]`);
    const skillCount = this.skillCounts.get(optionIdx) || 1;

    const systemSkills = SystemAdapter.getSkills();
    const skillOptions = Object.entries(systemSkills)
      .map(([slug, skill]) => `<option value="${slug}">${skill.name}</option>`)
      .join('');

    const newSkillRow = document.createElement('div');
    newSkillRow.className = 'skill-dc-row';
    newSkillRow.dataset.skillIndex = skillCount;
    newSkillRow.innerHTML = `
      <div class="skill-select">
        <select name="option-${optionIdx}-skill-${skillCount}" required>
          <option value="">Select skill...</option>
          ${skillOptions}
        </select>
      </div>
      <div class="dc-input">
        <input type="number" name="option-${optionIdx}-dc-${skillCount}" min="1" max="60" placeholder="DC" required>
      </div>
      <button type="button" class="skill-dc-row-remove" data-action="removeSkill">
        <i class="fas fa-times"></i>
      </button>
    `;

    skillsList.appendChild(newSkillRow);
    this.skillCounts.set(optionIdx, skillCount + 1);
  }

  static async _onRemoveSkill(_event, target) {
    const skillRow = target.closest('.skill-dc-row');
    const skillsList = skillRow.closest('.skills-list');
    const rows = skillsList.querySelectorAll('.skill-dc-row');

    if (rows.length > 1) {
      skillRow.remove();
    } else {
      ui.notifications.warn('Must have at least one skill');
    }
  }

  static async _onAddOption(_event, _target) {
    const optionsList = this.element.querySelector('.challenge-options-list');
    const systemSkills = SystemAdapter.getSkills();
    const skillOptions = Object.entries(systemSkills)
      .map(([slug, skill]) => `<option value="${slug}">${skill.name}</option>`)
      .join('');

    const newOption = document.createElement('div');
    newOption.className = 'challenge-option-card';
    newOption.dataset.optionIndex = this.optionCount;
    newOption.innerHTML = `
      <div class="challenge-option-header">
        <span class="challenge-option-title">Option ${this.optionCount + 1}</span>
        <button type="button" class="challenge-option-remove" data-action="removeOption">
          <i class="fas fa-times"></i> Remove
        </button>
      </div>
      <div class="challenge-option-fields">
        <div class="challenge-option-field">
          <label>Skills & DCs</label>
          <div class="skills-list" data-option-index="${this.optionCount}">
            <div class="skill-dc-row" data-skill-index="0">
              <div class="skill-select">
                <select name="option-${this.optionCount}-skill-0" required>
                  <option value="">Select skill...</option>
                  ${skillOptions}
                </select>
              </div>
              <div class="dc-input">
                <input type="number" name="option-${this.optionCount}-dc-0" min="1" max="60" placeholder="DC" required>
              </div>
            </div>
          </div>
          <button type="button" class="add-skill-btn" data-action="addSkill" data-option-index="${this.optionCount}">
            <i class="fas fa-plus"></i> Add Skill
          </button>
        </div>
        <div class="challenge-option-field">
          <label>Description</label>
          <textarea name="option-${this.optionCount}-desc" placeholder="e.g., Fortify the camp defenses with barricades" required></textarea>
        </div>
      </div>
    `;

    this.skillCounts.set(this.optionCount, 1);
    optionsList.appendChild(newOption);
    this.optionCount++;
  }

  static async _onRemoveOption(_event, target) {
    const optionCard = target.closest('.challenge-option-card');
    const optionsList = this.element.querySelector('.challenge-options-list');
    const cards = optionsList.querySelectorAll('.challenge-option-card');

    if (cards.length > 1) {
      optionCard.remove();
      // Renumber
      optionsList.querySelectorAll('.challenge-option-card').forEach((card, idx) => {
        card.querySelector('.challenge-option-title').textContent = `Option ${idx + 1}`;
      });
    } else {
      ui.notifications.warn('Must have at least one option');
    }
  }
}
