import { MODULE_ID } from '../constants.mjs';
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
    this.editMode = options.editMode || false;
    this.templateId = options.templateId || null;
    this.templateData = options.templateData || null;
    this.optionCount = 1;
    this.skillCounts = new Map();
    this.skillCounts.set(0, 1);
  }

  async _onRender(context, _options) {
    super._onRender(context, _options);

    // If edit mode, populate form with template data
    if (this.editMode && this.templateData) {
      await this._populateFormFromTemplate(context);
    }

    // Attach skill change handlers
    if (context.isPF2e) {
      this._attachSkillChangeHandlers();
    }
  }

  async _populateFormFromTemplate(context) {
    // Set name and image
    const nameInput = this.element.querySelector('[name="challengeName"]');
    const imageInput = this.element.querySelector('[name="challengeImage"]');
    if (nameInput) nameInput.value = this.templateData.name || '';
    if (imageInput) imageInput.value = this.templateData.image || '';

    // Clear initial option if exists
    const optionsList = this.element.querySelector('.challenge-options-list');
    optionsList.innerHTML = '';

    // Recreate options from template
    this.optionCount = 0;
    for (const opt of this.templateData.options) {
      await this._createOptionFromData(opt, context);
      this.optionCount++;
    }
  }

  async _createOptionFromData(optData, context) {
    const systemSkills = SystemAdapter.getSkills();
    const skillOptions = Object.entries(systemSkills)
      .map(([slug, skill]) => {
        const actionsJson = skill.actions ? JSON.stringify(skill.actions) : '[]';
        return `<option value="${slug}" data-actions='${actionsJson}'>${skill.name}</option>`;
      })
      .join('');

    const loreOptions = context.loreSkills
      .map(ls => `<option value="${ls.slug}">${ls.name}</option>`)
      .join('');

    const optionsList = this.element.querySelector('.challenge-options-list');
    const newOption = document.createElement('div');
    newOption.className = 'challenge-option-card';
    newOption.dataset.optionIndex = this.optionCount;

    // Build skill rows HTML
    const skillRowsHtml = optData.skillOptions.map((so, soIdx) => {
      const actionHtml = context.isPF2e ? `
        <div class="action-select" ${so.action ? '' : 'style="display: none;"'}>
          <select name="option-${this.optionCount}-action-${soIdx}" class="action-dropdown">
            <option value="">No action</option>
          </select>
        </div>
      ` : '';

      const minProficiency = so.minProficiency || 0;

      return `
        <div class="skill-dc-row" data-skill-index="${soIdx}">
          <div class="skill-select">
            <select name="option-${this.optionCount}-skill-${soIdx}" class="skill-dropdown" data-skill-index="${soIdx}" required>
              <option value="">Select skill...</option>
              ${skillOptions}
              ${loreOptions ? `<optgroup label="Lore Skills">${loreOptions}</optgroup>` : ''}
            </select>
          </div>
          ${actionHtml}
          <div class="dc-input">
            <input type="number" name="option-${this.optionCount}-dc-${soIdx}" min="1" value="${so.dc}" placeholder="DC">
          </div>
          <div class="proficiency-select">
            <select name="option-${this.optionCount}-proficiency-${soIdx}" class="proficiency-dropdown" data-tooltip="Minimum proficiency required">
              <option value="0" ${minProficiency === 0 ? 'selected' : ''}>Any</option>
              ${context.isPF2e ? `
              <option value="1" ${minProficiency === 1 ? 'selected' : ''}>Trained</option>
              <option value="2" ${minProficiency === 2 ? 'selected' : ''}>Expert</option>
              <option value="3" ${minProficiency === 3 ? 'selected' : ''}>Master</option>
              <option value="4" ${minProficiency === 4 ? 'selected' : ''}>Legendary</option>
              ` : `
              <option value="1" ${minProficiency === 1 ? 'selected' : ''}>Proficient</option>
              <option value="2" ${minProficiency === 2 ? 'selected' : ''}>Expertise</option>
              `}
            </select>
          </div>
          <div class="secret-checkbox">
            <input type="checkbox" name="option-${this.optionCount}-secret-${soIdx}" id="option-${this.optionCount}-secret-${soIdx}" ${so.isSecret ? 'checked' : ''}>
            <label for="option-${this.optionCount}-secret-${soIdx}" title="Secret roll (GM only)">
              <i class="fas fa-eye-slash"></i>
            </label>
          </div>
          ${soIdx > 0 ? '<button type="button" class="skill-dc-row-remove" data-action="removeSkill"><i class="fas fa-times"></i></button>' : ''}
        </div>
      `;
    }).join('');

    newOption.innerHTML = `
      <div class="challenge-option-header">
        <input type="text" name="option-${this.optionCount}-name" class="option-name-input" value="${optData.name || `Option ${this.optionCount + 1}`}" placeholder="Option name...">
        ${this.optionCount > 0 ? '<button type="button" class="challenge-option-remove" data-action="removeOption"><i class="fas fa-times"></i> Remove</button>' : ''}
      </div>
      <div class="challenge-option-fields">
        <div class="challenge-option-field">
          <label>Skills</label>
          <div class="skills-list" data-option-index="${this.optionCount}">
            ${skillRowsHtml}
          </div>
          <button type="button" class="add-skill-btn" data-action="addSkill" data-option-index="${this.optionCount}">
            <i class="fas fa-plus"></i> Add Skill
          </button>
        </div>
      </div>
    `;

    optionsList.appendChild(newOption);

    // Set skill and action values
    optData.skillOptions.forEach((so, soIdx) => {
      const skillSelect = newOption.querySelector(`[name="option-${this.optionCount}-skill-${soIdx}"]`);
      if (skillSelect) skillSelect.value = so.skill;

      if (so.action && context.isPF2e) {
        const skillOption = skillSelect.selectedOptions[0];
        if (skillOption?.dataset.actions) {
          const actions = JSON.parse(skillOption.dataset.actions);
          const actionDropdown = newOption.querySelector(`[name="option-${this.optionCount}-action-${soIdx}"]`);
          if (actionDropdown && actions.length > 0) {
            actionDropdown.innerHTML = '<option value="">No action</option>' +
              actions.map(a => `<option value="${a.slug}">${a.name}</option>`).join('');
            actionDropdown.value = so.action;
          }
        }
      }
    });

    this.skillCounts.set(this.optionCount, optData.skillOptions.length);
  }

  _attachSkillChangeHandlers() {
    const skillDropdowns = this.element.querySelectorAll('.skill-dropdown');
    skillDropdowns.forEach(skillSelect => {
      skillSelect.addEventListener('change', () => {
        const row = skillSelect.closest('.skill-dc-row');
        const actionSelect = row?.querySelector('.action-select');
        const actionDropdown = row?.querySelector('.action-dropdown');
        if (!actionSelect || !actionDropdown) return;

        const selectedOption = skillSelect.selectedOptions[0];
        if (!selectedOption) return;

        const actionsData = selectedOption.dataset.actions;
        if (actionsData && actionsData !== '[]' && actionsData !== 'null') {
          try {
            const actions = JSON.parse(actionsData);
            if (actions && actions.length > 0) {
              actionDropdown.innerHTML = '<option value="">No action</option>' +
                actions.map(a => `<option value="${a.slug}">${a.name}</option>`).join('');
              actionSelect.style.display = 'block';
              return;
            }
          } catch (e) {
            console.error('Failed to parse actions:', e);
          }
        }
        actionSelect.style.display = 'none';
        actionDropdown.value = '';
      });
    });
  }

  async _prepareContext(_options) {
    const currentSystem = SystemAdapter.detectSystem();
    const systemSkills = SystemAdapter.getSkills();
    let skills = Object.entries(systemSkills).map(([slug, skill]) => ({
      slug,
      name: skill.name,
      actions: skill.actions || [],
    }));

    // Get lore skills from all participants
    const state = game.storyframe.stateManager.getState();
    const loreSkills = await this._getLoreSkills(state);

    // If in edit mode, load template data
    let initialData = null;
    if (this.editMode && this.templateData) {
      initialData = {
        name: this.templateData.name,
        image: this.templateData.image,
        options: this.templateData.options,
      };
    }

    return {
      skills,
      loreSkills,
      hasLoreSkills: loreSkills.length > 0,
      isPF2e: currentSystem === 'pf2e',
      hasInitialOption: !this.editMode,
      editMode: this.editMode,
      initialData,
    };
  }

  async _getLoreSkills(state) {
    if (!state?.participants || state.participants.length === 0) return [];

    const currentSystem = SystemAdapter.detectSystem();
    if (currentSystem !== 'pf2e') return [];

    const loreSkillsSet = new Set();

    for (const participant of state.participants) {
      const actor = await fromUuid(participant.actorUuid);
      if (!actor?.skills) continue;

      for (const [skillSlug, skillData] of Object.entries(actor.skills)) {
        if (skillData.lore) {
          const loreName = skillData.label || skillData.name || skillSlug;
          loreSkillsSet.add(JSON.stringify({ slug: skillSlug, name: loreName }));
        }
      }
    }

    return Array.from(loreSkillsSet).map(s => JSON.parse(s));
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
      const name = formData[`option-${idx}-name`] || `Option ${parseInt(idx) + 1}`;

      // Parse skill-DC pairs (with optional actions)
      const skillOptions = [];
      const skillRows = card.querySelectorAll('.skill-dc-row');
      skillRows.forEach((row) => {
        const skillIdx = row.dataset.skillIndex;
        const skill = formData[`option-${idx}-skill-${skillIdx}`];
        const dc = formData[`option-${idx}-dc-${skillIdx}`];
        const action = formData[`option-${idx}-action-${skillIdx}`] || null;
        const isSecret = formData[`option-${idx}-secret-${skillIdx}`] || false;
        const minProficiency = formData[`option-${idx}-proficiency-${skillIdx}`];

        // Allow skills without DC (dc is optional)
        if (skill) {
          skillOptions.push({
            skill,
            dc: dc ? parseInt(dc) : null,
            action,
            isSecret,
            minProficiency: minProficiency ? parseInt(minProficiency) : 0,
          });
        }
      });

      if (skillOptions.length > 0) {
        challengeData.options.push({
          id: foundry.utils.randomID(),
          name,
          skillOptions,
        });
      }
    });

    if (challengeData.options.length === 0) {
      ui.notifications.warn('Add at least one option with skills');
      return;
    }

    // Save to library or update existing
    if (this.editMode && this.templateId) {
      // Update existing template
      const savedChallenges = game.settings.get(MODULE_ID, 'challengeLibrary') || [];
      const index = savedChallenges.findIndex(c => c.id === this.templateId);
      if (index !== -1) {
        savedChallenges[index] = {
          id: this.templateId,
          name: challengeData.name,
          image: challengeData.image,
          options: challengeData.options,
          createdAt: savedChallenges[index].createdAt,
          updatedAt: Date.now(),
        };
        await game.settings.set(MODULE_ID, 'challengeLibrary', savedChallenges);
        ui.notifications.info(`Updated "${challengeData.name}" in library`);
      }
    } else if (formData.saveToLibrary) {
      // Save new template
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

    // Present challenge (multi-challenge support)
    // If editing and a challenge with this name exists, remove it first
    if (this.editMode) {
      const state = game.storyframe.stateManager.getState();
      const existingChallenge = state?.activeChallenges?.find(c => c.name.toLowerCase() === challengeData.name.toLowerCase());

      if (existingChallenge) {
        // Remove the old version before adding the updated one
        await game.storyframe.socketManager.requestRemoveChallenge(existingChallenge.id);
      }
    }

    const success = await game.storyframe.socketManager.requestAddChallenge(challengeData);

    if (!success) {
      ui.notifications.error(`A challenge named "${challengeData.name}" is already active. Please use a different name or clear the existing challenge.`);
      return;  // Keep dialog open for user to fix
    }

    if (this.editMode) {
      ui.notifications.info(`Challenge "${challengeData.name}" updated and presented to ${this.selectedParticipants.size || 'all'} PC(s)`);
    } else {
      ui.notifications.info(`Challenge "${challengeData.name}" presented to ${this.selectedParticipants.size || 'all'} PC(s)`);
    }

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

    const context = await this._prepareContext();
    const systemSkills = SystemAdapter.getSkills();
    const skillOptions = Object.entries(systemSkills)
      .map(([slug, skill]) => {
        const actionsJson = skill.actions ? JSON.stringify(skill.actions) : '[]';
        return `<option value="${slug}" data-actions='${actionsJson}'>${skill.name}</option>`;
      })
      .join('');

    const loreOptions = context.loreSkills
      .map(ls => `<option value="${ls.slug}">${ls.name}</option>`)
      .join('');

    const currentSystem = SystemAdapter.detectSystem();
    const isPF2e = currentSystem === 'pf2e';

    const newSkillRow = document.createElement('div');
    newSkillRow.className = 'skill-dc-row';
    newSkillRow.dataset.skillIndex = skillCount;
    newSkillRow.innerHTML = `
      <div class="skill-select">
        <select name="option-${optionIdx}-skill-${skillCount}" class="skill-dropdown" data-skill-index="${skillCount}" required>
          <option value="">Select skill...</option>
          ${skillOptions}
          ${loreOptions ? `<optgroup label="Lore Skills">${loreOptions}</optgroup>` : ''}
        </select>
      </div>
      ${isPF2e ? `
      <div class="action-select" style="display: none;">
        <select name="option-${optionIdx}-action-${skillCount}" class="action-dropdown">
          <option value="">No action</option>
        </select>
      </div>
      ` : ''}
      <div class="dc-input">
        <input type="number" name="option-${optionIdx}-dc-${skillCount}" min="1" placeholder="DC" required>
      </div>
      <div class="proficiency-select">
        <select name="option-${optionIdx}-proficiency-${skillCount}" class="proficiency-dropdown" data-tooltip="Minimum proficiency required">
          <option value="0">Any</option>
          ${isPF2e ? `
          <option value="1">Trained</option>
          <option value="2">Expert</option>
          <option value="3">Master</option>
          <option value="4">Legendary</option>
          ` : `
          <option value="1">Proficient</option>
          <option value="2">Expertise</option>
          `}
        </select>
      </div>
      <div class="secret-checkbox">
        <input type="checkbox" name="option-${optionIdx}-secret-${skillCount}" id="option-${optionIdx}-secret-${skillCount}" data-tooltip="Secret roll (GM only)">
        <label for="option-${optionIdx}-secret-${skillCount}" data-tooltip="Secret roll (GM only)">
          <i class="fas fa-eye-slash"></i>
        </label>
      </div>
      <button type="button" class="skill-dc-row-remove" data-action="removeSkill">
        <i class="fas fa-times"></i>
      </button>
    `;

    skillsList.appendChild(newSkillRow);

    // Attach skill change handler to show/hide action dropdown
    if (isPF2e) {
      const skillSelect = newSkillRow.querySelector('.skill-dropdown');
      const actionSelect = newSkillRow.querySelector('.action-select');
      const actionDropdown = newSkillRow.querySelector('.action-dropdown');

      skillSelect.addEventListener('change', () => {
        const selectedOption = skillSelect.selectedOptions[0];
        if (!selectedOption) return;

        const actionsData = selectedOption.dataset.actions;
        if (actionsData && actionsData !== '[]') {
          const actions = JSON.parse(actionsData);
          actionDropdown.innerHTML = '<option value="">No action</option>' +
            actions.map(a => `<option value="${a.slug}">${a.name}</option>`).join('');
          actionSelect.style.display = 'block';
        } else {
          actionSelect.style.display = 'none';
          actionDropdown.value = '';
        }
      });
    }

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
    const context = await this._prepareContext();
    const optionsList = this.element.querySelector('.challenge-options-list');
    const systemSkills = SystemAdapter.getSkills();
    const skillOptions = Object.entries(systemSkills)
      .map(([slug, skill]) => {
        const actionsJson = skill.actions ? JSON.stringify(skill.actions) : '[]';
        return `<option value="${slug}" data-actions='${actionsJson}'>${skill.name}</option>`;
      })
      .join('');

    const loreOptions = context.loreSkills
      .map(ls => `<option value="${ls.slug}">${ls.name}</option>`)
      .join('');

    const newOption = document.createElement('div');
    newOption.className = 'challenge-option-card';
    newOption.dataset.optionIndex = this.optionCount;
    newOption.innerHTML = `
      <div class="challenge-option-header">
        <input type="text" name="option-${this.optionCount}-name" class="option-name-input" value="Option ${this.optionCount + 1}" placeholder="Option name...">
        <button type="button" class="challenge-option-remove" data-action="removeOption">
          <i class="fas fa-times"></i> Remove
        </button>
      </div>
      <div class="challenge-option-fields">
        <div class="challenge-option-field">
          <label>Skills</label>
          <div class="skills-list" data-option-index="${this.optionCount}">
            <div class="skill-dc-row" data-skill-index="0">
              <div class="skill-select">
                <select name="option-${this.optionCount}-skill-0" class="skill-dropdown" data-skill-index="0" required>
                  <option value="">Select skill...</option>
                  ${skillOptions}
                  ${loreOptions ? `<optgroup label="Lore Skills">${loreOptions}</optgroup>` : ''}
                </select>
              </div>
              ${context.isPF2e ? `
              <div class="action-select" style="display: none;">
                <select name="option-${this.optionCount}-action-0" class="action-dropdown">
                  <option value="">No action</option>
                </select>
              </div>
              ` : ''}
              <div class="dc-input">
                <input type="number" name="option-${this.optionCount}-dc-0" min="1" placeholder="DC" required>
              </div>
              <div class="proficiency-select">
                <select name="option-${this.optionCount}-proficiency-0" class="proficiency-dropdown" data-tooltip="Minimum proficiency required">
                  <option value="0">Any</option>
                  ${context.isPF2e ? `
                  <option value="1">Trained</option>
                  <option value="2">Expert</option>
                  <option value="3">Master</option>
                  <option value="4">Legendary</option>
                  ` : `
                  <option value="1">Proficient</option>
                  <option value="2">Expertise</option>
                  `}
                </select>
              </div>
              <div class="secret-checkbox">
                <input type="checkbox" name="option-${this.optionCount}-secret-0" id="option-${this.optionCount}-secret-0">
                <label for="option-${this.optionCount}-secret-0" data-tooltip="Secret roll (GM only)">
                  <i class="fas fa-eye-slash"></i>
                </label>
              </div>
            </div>
          </div>
          <button type="button" class="add-skill-btn" data-action="addSkill" data-option-index="${this.optionCount}">
            <i class="fas fa-plus"></i> Add Skill
          </button>
        </div>
      </div>
    `;

    this.skillCounts.set(this.optionCount, 1);
    optionsList.appendChild(newOption);

    // Attach skill change handler for new option
    if (context.isPF2e) {
      this._attachSkillChangeHandlers();
    }

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
        card.querySelector('.option-name-input').value = `Option ${idx + 1}`;
      });
    } else {
      ui.notifications.warn('Must have at least one option');
    }
  }
}
