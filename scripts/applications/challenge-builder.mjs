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
      title: 'STORYFRAME.WindowTitles.PresentChallenge',
      resizable: false,
    },
    position: {
      width: 540,
      height: 'auto',
    },
    actions: {
      submit: ChallengeBuilderDialog._onSubmit,
      saveOnly: ChallengeBuilderDialog._onSaveOnly,
      pickImage: ChallengeBuilderDialog._onPickImage,
      addSkill: ChallengeBuilderDialog._onAddSkill,
      removeSkill: ChallengeBuilderDialog._onRemoveSkill,
      addSave: ChallengeBuilderDialog._onAddSave,
      removeSave: ChallengeBuilderDialog._onRemoveSave,
      addOption: ChallengeBuilderDialog._onAddOption,
      removeOption: ChallengeBuilderDialog._onRemoveOption,
      toggleDCPreset: ChallengeBuilderDialog._onToggleDCPreset,
      applyDCPreset: ChallengeBuilderDialog._onApplyDCPreset,
      addDCPreset: ChallengeBuilderDialog._onAddDCPreset,
      removeDCPreset: ChallengeBuilderDialog._onRemoveDCPreset,
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
    this.saveCounts = new Map();
    this.saveCounts.set(0, 0);  // Start at 0 since saves section starts empty
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

    // Attach tooltip update handlers for all selects
    this._attachTooltipHandlers();
  }

  _attachTooltipHandlers() {
    const allSelects = this.element.querySelectorAll('select');
    allSelects.forEach(select => {
      // Set initial tooltip
      this._updateSelectTooltip(select);

      // Update tooltip on change
      select.addEventListener('change', () => {
        this._updateSelectTooltip(select);
      });
    });
  }

  _updateSelectTooltip(select) {
    const selectedOption = select.selectedOptions[0];
    if (selectedOption && selectedOption.value) {
      select.setAttribute('data-tooltip', selectedOption.textContent.trim());
    } else {
      select.removeAttribute('data-tooltip');
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
    // i18n labels
    const i18n = {
      selectSkill: game.i18n.localize('STORYFRAME.UI.Labels.SelectSkill'),
      loreSkills: game.i18n.localize('STORYFRAME.ChallengeBuilder.LoreSkills'),
      noAction: game.i18n.localize('STORYFRAME.ChallengeBuilder.NoAction'),
      dc: game.i18n.localize('STORYFRAME.ChallengeBuilder.DC'),
      minProfTooltip: game.i18n.localize('STORYFRAME.UI.Tooltips.MinProficiency'),
      secretTooltip: game.i18n.localize('STORYFRAME.UI.Tooltips.SecretRoll'),
      any: game.i18n.localize('STORYFRAME.ChallengeBuilder.Proficiency.Any'),
      trained: game.i18n.localize('STORYFRAME.ChallengeBuilder.Proficiency.Trained'),
      expert: game.i18n.localize('STORYFRAME.ChallengeBuilder.Proficiency.Expert'),
      master: game.i18n.localize('STORYFRAME.ChallengeBuilder.Proficiency.Master'),
      legendary: game.i18n.localize('STORYFRAME.ChallengeBuilder.Proficiency.Legendary'),
      proficient: game.i18n.localize('STORYFRAME.ChallengeBuilder.Proficiency.Proficient'),
      expertise: game.i18n.localize('STORYFRAME.ChallengeBuilder.Proficiency.Expertise'),
      optionPlaceholder: game.i18n.localize('STORYFRAME.UI.Labels.OptionName'),
      remove: game.i18n.localize('STORYFRAME.UI.Labels.Remove'),
      skills: game.i18n.localize('STORYFRAME.UI.Labels.Skills'),
      addSkill: game.i18n.localize('STORYFRAME.UI.Labels.AddSkill'),
    };

    const systemSkills = SystemAdapter.getSkills();
    const systemSaves = SystemAdapter.getSaves();

    const skillOptionsHtml = Object.entries(systemSkills)
      .map(([slug, skill]) => {
        const actionsJson = skill.actions ? JSON.stringify(skill.actions) : '[]';
        return `<option value="${slug}" data-actions='${actionsJson}' data-check-type="skill">${skill.name}</option>`;
      })
      .join('');

    const loreOptionsHtml = context.loreSkills
      .map(ls => `<option value="${ls.slug}" data-check-type="skill">${ls.name}</option>`)
      .join('');

    // Build skill options (NO saves - they're in a separate section now)
    let skillOptions = skillOptionsHtml;
    let loreOptions = '';
    if (loreOptionsHtml) {
      const loreLabel = game.i18n.localize('STORYFRAME.ChallengeBuilder.LoreSkills');
      loreOptions = `<optgroup label="${loreLabel}">${loreOptionsHtml}</optgroup>`;
    }

    const optionsList = this.element.querySelector('.challenge-options-list');
    const newOption = document.createElement('div');
    newOption.className = 'challenge-option-card';
    newOption.dataset.optionIndex = this.optionCount;

    // Separate skills from saves
    const skills = optData.skillOptions.filter(so => so.checkType !== 'save');
    const saves = optData.skillOptions.filter(so => so.checkType === 'save');

    // Build skill rows HTML
    const skillRowsHtml = skills.map((so, soIdx) => {
      const actionHtml = context.isPF2e ? `
        <div class="action-select" ${so.action ? '' : 'style="display: none;"'}>
          <select name="option-${this.optionCount}-action-${soIdx}" class="action-dropdown">
            <option value="">${i18n.noAction}</option>
          </select>
        </div>
      ` : '';

      const minProficiency = so.minProficiency || 0;

      return `
        <div class="skill-dc-row" data-skill-index="${soIdx}">
          <div class="skill-select">
            <select name="option-${this.optionCount}-skill-${soIdx}" class="skill-dropdown" data-skill-index="${soIdx}" required>
              <option value="">${i18n.selectSkill}</option>
              ${skillOptions}
              ${loreOptions ? `<optgroup label="${i18n.loreSkills}">${loreOptions}</optgroup>` : ''}
            </select>
          </div>
          ${actionHtml}
          <div class="dc-input-group">
            <input type="number" name="option-${this.optionCount}-dc-${soIdx}" class="dc-number-input" min="1" value="${so.dc}" placeholder="${i18n.dc}">
            <button type="button" class="dc-preset-btn" data-action="toggleDCPreset" data-row-type="skill" data-option-index="${this.optionCount}" data-row-index="${soIdx}">
              <i class="fas fa-bookmark"></i>
            </button>
          </div>
          <div class="proficiency-select">
            <select name="option-${this.optionCount}-proficiency-${soIdx}" class="proficiency-dropdown" data-tooltip="${i18n.minProfTooltip}">
              <option value="0" ${minProficiency === 0 ? 'selected' : ''}>${i18n.any}</option>
              ${context.isPF2e ? `
              <option value="1" ${minProficiency === 1 ? 'selected' : ''}>${i18n.trained}</option>
              <option value="2" ${minProficiency === 2 ? 'selected' : ''}>${i18n.expert}</option>
              <option value="3" ${minProficiency === 3 ? 'selected' : ''}>${i18n.master}</option>
              <option value="4" ${minProficiency === 4 ? 'selected' : ''}>${i18n.legendary}</option>
              ` : `
              <option value="1" ${minProficiency === 1 ? 'selected' : ''}>${i18n.proficient}</option>
              <option value="2" ${minProficiency === 2 ? 'selected' : ''}>${i18n.expertise}</option>
              `}
            </select>
          </div>
          <div class="secret-checkbox">
            <input type="checkbox" name="option-${this.optionCount}-secret-${soIdx}" id="option-${this.optionCount}-secret-${soIdx}" ${so.isSecret ? 'checked' : ''}>
            <label for="option-${this.optionCount}-secret-${soIdx}" data-tooltip="${i18n.secretTooltip}">
              <i class="fas fa-eye-slash"></i>
            </label>
          </div>
          ${soIdx > 0 ? '<button type="button" class="skill-dc-row-remove" data-action="removeSkill"><i class="fas fa-times"></i></button>' : ''}
        </div>
      `;
    }).join('');

    // Build save rows HTML
    const saveRowsHtml = saves.map((so, soIdx) => {
      return `
        <div class="save-dc-row" data-save-index="${soIdx}">
          <div class="save-select">
            <select name="option-${this.optionCount}-save-${soIdx}" class="save-dropdown" data-save-index="${soIdx}" required>
              <option value="">${i18n.selectSkill}</option>
            </select>
          </div>
          <div class="dc-input-group">
            <input type="number" name="option-${this.optionCount}-save-dc-${soIdx}" class="dc-number-input" min="1" value="${so.dc}" placeholder="${i18n.dc}">
            <button type="button" class="dc-preset-btn" data-action="toggleDCPreset" data-row-type="save" data-option-index="${this.optionCount}" data-row-index="${soIdx}">
              <i class="fas fa-bookmark"></i>
            </button>
          </div>
          <div class="secret-checkbox">
            <input type="checkbox" name="option-${this.optionCount}-save-secret-${soIdx}" id="option-${this.optionCount}-save-secret-${soIdx}" ${so.isSecret ? 'checked' : ''}>
            <label for="option-${this.optionCount}-save-secret-${soIdx}" data-tooltip="${i18n.secretTooltip}">
              <i class="fas fa-eye-slash"></i>
            </label>
          </div>
          <button type="button" class="save-dc-row-remove" data-action="removeSave">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `;
    }).join('');

    const optionName = optData.name || game.i18n.format('STORYFRAME.ChallengeBuilder.OptionLabel', { num: this.optionCount + 1 });
    const savesLabel = game.i18n.localize('STORYFRAME.UI.Categories.SavingThrows');
    const addSaveLabel = game.i18n.localize('STORYFRAME.UI.Labels.AddSave');

    newOption.innerHTML = `
      <div class="challenge-option-header">
        <input type="text" name="option-${this.optionCount}-name" class="option-name-input" value="${optionName}" placeholder="${i18n.optionPlaceholder}">
        ${this.optionCount > 0 ? `<button type="button" class="challenge-option-remove" data-action="removeOption"><i class="fas fa-times"></i> ${i18n.remove}</button>` : ''}
      </div>
      <div class="challenge-option-fields">
        <div class="challenge-option-field">
          <label>${i18n.skills}</label>
          <div class="skills-list" data-option-index="${this.optionCount}">
            ${skillRowsHtml}
          </div>
          <button type="button" class="add-skill-btn" data-action="addSkill" data-option-index="${this.optionCount}">
            <i class="fas fa-plus"></i> ${i18n.addSkill}
          </button>
        </div>
        ${context.hasSaves ? `
        <div class="challenge-option-field saves-section">
          <label>${savesLabel}</label>
          <div class="saves-list" data-option-index="${this.optionCount}">
            ${saveRowsHtml}
          </div>
          <button type="button" class="add-save-btn" data-action="addSave" data-option-index="${this.optionCount}">
            <i class="fas fa-plus"></i> ${addSaveLabel}
          </button>
        </div>
        ` : ''}
      </div>
    `;

    optionsList.appendChild(newOption);

    // Set skill and action values
    skills.forEach((so, soIdx) => {
      const skillSelect = newOption.querySelector(`[name="option-${this.optionCount}-skill-${soIdx}"]`);
      if (skillSelect) skillSelect.value = so.skill;

      if (so.action && context.isPF2e) {
        const skillOption = skillSelect.selectedOptions[0];
        if (skillOption?.dataset.actions) {
          const actions = JSON.parse(skillOption.dataset.actions);
          const actionDropdown = newOption.querySelector(`[name="option-${this.optionCount}-action-${soIdx}"]`);
          if (actionDropdown && actions.length > 0) {
            const noActionLabel = game.i18n.localize('STORYFRAME.ChallengeBuilder.NoAction');
            actionDropdown.innerHTML = `<option value="">${noActionLabel}</option>` +
              actions.map(a => `<option value="${a.slug}">${a.name}</option>`).join('');
            actionDropdown.value = so.action;
          }
        }
      }
    });

    // Set save values
    saves.forEach((so, soIdx) => {
      const saveSelect = newOption.querySelector(`[name="option-${this.optionCount}-save-${soIdx}"]`);
      if (saveSelect) {
        // Populate save options
        const saveOptionsHtml = Object.entries(systemSaves)
          .map(([slug, save]) => `<option value="${slug}" data-check-type="save">${save.name}</option>`)
          .join('');
        const selectSaveLabel = game.i18n.localize('STORYFRAME.UI.Labels.SelectSave');
        saveSelect.innerHTML = `<option value="">${selectSaveLabel}</option>${saveOptionsHtml}`;
        saveSelect.value = so.skill;
      }
    });

    this.skillCounts.set(this.optionCount, skills.length);
    this.saveCounts.set(this.optionCount, saves.length);
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
              const noActionLabel = game.i18n.localize('STORYFRAME.ChallengeBuilder.NoAction');
            actionDropdown.innerHTML = `<option value="">${noActionLabel}</option>` +
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
    const systemSaves = SystemAdapter.getSaves();

    let skills = Object.entries(systemSkills).map(([slug, skill]) => ({
      slug,
      name: skill.name,
      actions: skill.actions || [],
    }));

    let saves = Object.entries(systemSaves).map(([slug, save]) => ({
      slug,
      name: save.name,
      icon: save.icon,
    }));

    // Get lore skills from all participants
    const state = game.storyframe.stateManager.getState();
    const loreSkills = await this._getLoreSkills(state);

    // Calculate party level from selected participants
    const partyLevel = await this._calculatePartyLevel(state);

    // Store party level in instance for access by static methods
    this.partyLevel = partyLevel;

    // Load DC presets
    const allPresets = game.settings.get(MODULE_ID, 'dcPresets') || [];
    const dcPresets = allPresets.filter(p => !p.system || p.system === currentSystem);

    // Get DC options (level-based for PF2e, standard for D&D5e)
    const dcOptions = SystemAdapter.getDCOptions();

    // Get difficulty adjustments for PF2e
    const difficultyAdjustments = SystemAdapter.getDifficultyAdjustments();

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
      saves,
      loreSkills,
      hasLoreSkills: loreSkills.length > 0,
      hasSaves: saves.length > 0,
      isPF2e: currentSystem === 'pf2e',
      hasInitialOption: !this.editMode,
      editMode: this.editMode,
      initialData,
      dcPresets,
      dcOptions,
      partyLevel,
      difficultyAdjustments,
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

  async _calculatePartyLevel(state) {
    if (!state?.participants?.length) return null;

    // Filter to selected participants if any
    const relevantParticipants = this.selectedParticipants && this.selectedParticipants.size > 0
      ? state.participants.filter(p => this.selectedParticipants.has(p.id))
      : state.participants;

    if (relevantParticipants.length === 0) return null;

    const levels = await Promise.all(
      relevantParticipants.map(async (p) => {
        const actor = await fromUuid(p.actorUuid);
        return actor?.system?.details?.level?.value ?? actor?.system?.level ?? null;
      }),
    );

    const validLevels = levels.filter((l) => l !== null);
    if (validLevels.length === 0) return null;

    return Math.round(validLevels.reduce((a, b) => a + b, 0) / validLevels.length);
  }

  _calculateDCByLevel(level, difficultyId) {
    const dcOptions = SystemAdapter.getDCOptions();
    const difficultyAdjustments = SystemAdapter.getDifficultyAdjustments();

    const levelOption = dcOptions.find((opt) => opt.value === level);
    const baseDC = levelOption?.dc || 14;

    const difficulty = difficultyAdjustments?.find((d) => d.id === difficultyId);
    const adjustment = difficulty?.adjustment || 0;

    return baseDC + adjustment;
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

        // Get checkType from selected option's data attribute
        const skillSelect = card.querySelector(`[name="option-${idx}-skill-${skillIdx}"]`);
        const selectedOption = skillSelect?.selectedOptions[0];
        const checkType = selectedOption?.dataset.checkType || 'skill';

        // Allow skills/saves without DC (dc is optional)
        if (skill) {
          skillOptions.push({
            skill,
            checkType,  // NEW
            dc: dc ? parseInt(dc) : null,
            action,
            isSecret,
            minProficiency: minProficiency ? parseInt(minProficiency) : 0,
          });
        }
      });

      // Parse save-DC pairs (separate section)
      const saveRows = card.querySelectorAll('.save-dc-row');
      saveRows.forEach((row) => {
        const saveIdx = row.dataset.saveIndex;
        const save = formData[`option-${idx}-save-${saveIdx}`];
        const dc = formData[`option-${idx}-save-dc-${saveIdx}`];
        const isSecret = formData[`option-${idx}-save-secret-${saveIdx}`] || false;

        if (save) {
          skillOptions.push({
            skill: save,
            checkType: 'save',
            dc: dc ? parseInt(dc) : null,
            action: null,  // Saves never have actions
            isSecret,
            minProficiency: 0,  // Saves don't have proficiency requirements
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
      ui.notifications.warn(game.i18n.localize('STORYFRAME.ChallengeBuilder.Validation.AddAtLeastOneOption'));
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
        ui.notifications.info(game.i18n.format('STORYFRAME.ChallengeBuilder.UpdatedInLibrary', { name: challengeData.name }));
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
      ui.notifications.info(game.i18n.format('STORYFRAME.ChallengeBuilder.SavedToLibrary', { name: challengeData.name }));
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
      ui.notifications.error(game.i18n.format('STORYFRAME.Notifications.Challenge.ChallengeDuplicateNamePrompt', { name: challengeData.name }));
      return;  // Keep dialog open for user to fix
    }

    if (this.editMode) {
      ui.notifications.info(game.i18n.format('STORYFRAME.Notifications.Challenge.ChallengeUpdated', { name: challengeData.name, count: this.selectedParticipants.size || 'all' }));
    } else {
      ui.notifications.info(game.i18n.format('STORYFRAME.Notifications.Challenge.ChallengePresentedPCs', { name: challengeData.name, count: this.selectedParticipants.size || 'all' }));
    }

    this.close();
  }

  static async _onSaveOnly(event, target) {
    event.preventDefault();
    event.stopPropagation();

    const form = target.closest('form');
    const formData = new FormDataExtended(form).object;

    // Build challenge data (same logic as submit)
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

      const skillOptions = [];

      // Parse skill rows
      const skillRows = card.querySelectorAll('.skill-dc-row');
      skillRows.forEach((row) => {
        const skillIdx = row.dataset.skillIndex;
        const skill = formData[`option-${idx}-skill-${skillIdx}`];
        const dc = formData[`option-${idx}-dc-${skillIdx}`];
        const action = formData[`option-${idx}-action-${skillIdx}`] || null;
        const isSecret = formData[`option-${idx}-secret-${skillIdx}`] || false;
        const minProficiency = formData[`option-${idx}-proficiency-${skillIdx}`];

        const skillSelect = card.querySelector(`[name="option-${idx}-skill-${skillIdx}"]`);
        const selectedOption = skillSelect?.selectedOptions[0];
        const checkType = selectedOption?.dataset.checkType || 'skill';

        if (skill) {
          skillOptions.push({
            skill,
            checkType,
            dc: dc ? parseInt(dc) : null,
            action,
            isSecret,
            minProficiency: minProficiency ? parseInt(minProficiency) : 0,
          });
        }
      });

      // Parse save rows
      const saveRows = card.querySelectorAll('.save-dc-row');
      saveRows.forEach((row) => {
        const saveIdx = row.dataset.saveIndex;
        const save = formData[`option-${idx}-save-${saveIdx}`];
        const dc = formData[`option-${idx}-save-dc-${saveIdx}`];
        const isSecret = formData[`option-${idx}-save-secret-${saveIdx}`] || false;

        if (save) {
          skillOptions.push({
            skill: save,
            checkType: 'save',
            dc: dc ? parseInt(dc) : null,
            action: null,
            isSecret,
            minProficiency: 0,
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
      ui.notifications.warn(game.i18n.localize('STORYFRAME.ChallengeBuilder.Validation.AddAtLeastOneOption'));
      return;
    }

    // Save to library (always save, don't present)
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
        ui.notifications.info(game.i18n.format('STORYFRAME.ChallengeBuilder.UpdatedInLibrary', { name: challengeData.name }));
      }
    } else {
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
      ui.notifications.info(game.i18n.format('STORYFRAME.ChallengeBuilder.SavedToLibrary', { name: challengeData.name }));
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

    // i18n labels
    const i18n = {
      selectSkill: game.i18n.localize('STORYFRAME.UI.Labels.SelectSkill'),
      loreSkills: game.i18n.localize('STORYFRAME.ChallengeBuilder.LoreSkills'),
      noAction: game.i18n.localize('STORYFRAME.ChallengeBuilder.NoAction'),
      dc: game.i18n.localize('STORYFRAME.ChallengeBuilder.DC'),
      minProfTooltip: game.i18n.localize('STORYFRAME.UI.Tooltips.MinProficiency'),
      secretTooltip: game.i18n.localize('STORYFRAME.UI.Tooltips.SecretRoll'),
      any: game.i18n.localize('STORYFRAME.ChallengeBuilder.Proficiency.Any'),
      trained: game.i18n.localize('STORYFRAME.ChallengeBuilder.Proficiency.Trained'),
      expert: game.i18n.localize('STORYFRAME.ChallengeBuilder.Proficiency.Expert'),
      master: game.i18n.localize('STORYFRAME.ChallengeBuilder.Proficiency.Master'),
      legendary: game.i18n.localize('STORYFRAME.ChallengeBuilder.Proficiency.Legendary'),
      proficient: game.i18n.localize('STORYFRAME.ChallengeBuilder.Proficiency.Proficient'),
      expertise: game.i18n.localize('STORYFRAME.ChallengeBuilder.Proficiency.Expertise'),
    };

    const context = await this._prepareContext();
    const systemSkills = SystemAdapter.getSkills();

    const skillOptionsHtml = Object.entries(systemSkills)
      .map(([slug, skill]) => {
        const actionsJson = skill.actions ? JSON.stringify(skill.actions) : '[]';
        return `<option value="${slug}" data-actions='${actionsJson}' data-check-type="skill">${skill.name}</option>`;
      })
      .join('');

    const loreOptionsHtml = context.loreSkills
      .map(ls => `<option value="${ls.slug}" data-check-type="skill">${ls.name}</option>`)
      .join('');

    // Build skill options (NO saves - they're in a separate section now)
    let skillOptions = skillOptionsHtml;
    let loreOptions = '';
    if (loreOptionsHtml) {
      const loreLabel = game.i18n.localize('STORYFRAME.ChallengeBuilder.LoreSkills');
      loreOptions = `<optgroup label="${loreLabel}">${loreOptionsHtml}</optgroup>`;
    }

    const currentSystem = SystemAdapter.detectSystem();
    const isPF2e = currentSystem === 'pf2e';

    const newSkillRow = document.createElement('div');
    newSkillRow.className = 'skill-dc-row';
    newSkillRow.dataset.skillIndex = skillCount;
    newSkillRow.innerHTML = `
      <div class="skill-select">
        <select name="option-${optionIdx}-skill-${skillCount}" class="skill-dropdown" data-skill-index="${skillCount}" required>
          <option value="">${i18n.selectSkill}</option>
          ${skillOptions}
          ${loreOptions ? `<optgroup label="${i18n.loreSkills}">${loreOptions}</optgroup>` : ''}
        </select>
      </div>
      ${isPF2e ? `
      <div class="action-select" style="display: none;">
        <select name="option-${optionIdx}-action-${skillCount}" class="action-dropdown">
          <option value="">${i18n.noAction}</option>
        </select>
      </div>
      ` : ''}
      <div class="dc-input-group">
        <input type="number" name="option-${optionIdx}-dc-${skillCount}" class="dc-number-input" min="1" placeholder="${i18n.dc}" required>
        <button type="button" class="dc-preset-btn" data-action="toggleDCPreset" data-row-type="skill" data-option-index="${optionIdx}" data-row-index="${skillCount}">
          <i class="fas fa-bookmark"></i>
        </button>
      </div>
      <div class="proficiency-select">
        <select name="option-${optionIdx}-proficiency-${skillCount}" class="proficiency-dropdown" data-tooltip="${i18n.minProfTooltip}">
          <option value="0">${i18n.any}</option>
          ${isPF2e ? `
          <option value="1">${i18n.trained}</option>
          <option value="2">${i18n.expert}</option>
          <option value="3">${i18n.master}</option>
          <option value="4">${i18n.legendary}</option>
          ` : `
          <option value="1">${i18n.proficient}</option>
          <option value="2">${i18n.expertise}</option>
          `}
        </select>
      </div>
      <div class="secret-checkbox">
        <input type="checkbox" name="option-${optionIdx}-secret-${skillCount}" id="option-${optionIdx}-secret-${skillCount}" data-tooltip="${i18n.secretTooltip}">
        <label for="option-${optionIdx}-secret-${skillCount}" data-tooltip="${i18n.secretTooltip}">
          <i class="fas fa-eye-slash"></i>
        </label>
      </div>
      <button type="button" class="skill-dc-row-remove" data-action="removeSkill">
        <i class="fas fa-times"></i>
      </button>
    `;

    skillsList.appendChild(newSkillRow);

    // Update tooltips for the new row
    this._attachTooltipHandlers();

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
          const noActionLabel = game.i18n.localize('STORYFRAME.ChallengeBuilder.NoAction');
          actionDropdown.innerHTML = `<option value="">${noActionLabel}</option>` +
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
      ui.notifications.warn(game.i18n.localize('STORYFRAME.ChallengeBuilder.Validation.AtLeastOneSkill'));
    }
  }

  static async _onAddSave(_event, target) {
    const optionIdx = parseInt(target.dataset.optionIndex);
    const savesList = this.element.querySelector(`.saves-list[data-option-index="${optionIdx}"]`);
    const saveCount = this.saveCounts.get(optionIdx) || 0;

    // i18n labels
    const i18n = {
      selectSave: game.i18n.localize('STORYFRAME.UI.Labels.SelectSave'),
      dc: game.i18n.localize('STORYFRAME.ChallengeBuilder.DC'),
      secretTooltip: game.i18n.localize('STORYFRAME.UI.Tooltips.SecretRoll'),
    };

    const systemSaves = SystemAdapter.getSaves();

    const saveOptionsHtml = Object.entries(systemSaves)
      .map(([slug, save]) => {
        return `<option value="${slug}" data-check-type="save">${save.name}</option>`;
      })
      .join('');

    const newSaveRow = document.createElement('div');
    newSaveRow.className = 'save-dc-row';
    newSaveRow.dataset.saveIndex = saveCount;
    newSaveRow.innerHTML = `
      <div class="save-select">
        <select name="option-${optionIdx}-save-${saveCount}" class="save-dropdown" data-save-index="${saveCount}" required>
          <option value="">${i18n.selectSave}</option>
          ${saveOptionsHtml}
        </select>
      </div>
      <div class="dc-input-group">
        <input type="number" name="option-${optionIdx}-save-dc-${saveCount}" class="dc-number-input" min="1" placeholder="${i18n.dc}" required>
        <button type="button" class="dc-preset-btn" data-action="toggleDCPreset" data-row-type="save" data-option-index="${optionIdx}" data-row-index="${saveCount}">
          <i class="fas fa-bookmark"></i>
        </button>
      </div>
      <div class="secret-checkbox">
        <input type="checkbox" name="option-${optionIdx}-save-secret-${saveCount}" id="option-${optionIdx}-save-secret-${saveCount}" data-tooltip="${i18n.secretTooltip}">
        <label for="option-${optionIdx}-save-secret-${saveCount}" data-tooltip="${i18n.secretTooltip}">
          <i class="fas fa-eye-slash"></i>
        </label>
      </div>
      <button type="button" class="save-dc-row-remove" data-action="removeSave">
        <i class="fas fa-times"></i>
      </button>
    `;

    savesList.appendChild(newSaveRow);
    this.saveCounts.set(optionIdx, saveCount + 1);

    // Update tooltips for the new row
    this._attachTooltipHandlers();
  }

  static async _onRemoveSave(_event, target) {
    const saveRow = target.closest('.save-dc-row');
    saveRow.remove();
  }

  static async _onAddOption(_event, _target) {
    // i18n labels
    const i18n = {
      selectSkill: game.i18n.localize('STORYFRAME.UI.Labels.SelectSkill'),
      loreSkills: game.i18n.localize('STORYFRAME.ChallengeBuilder.LoreSkills'),
      noAction: game.i18n.localize('STORYFRAME.ChallengeBuilder.NoAction'),
      dc: game.i18n.localize('STORYFRAME.ChallengeBuilder.DC'),
      minProfTooltip: game.i18n.localize('STORYFRAME.UI.Tooltips.MinProficiency'),
      secretTooltip: game.i18n.localize('STORYFRAME.UI.Tooltips.SecretRoll'),
      any: game.i18n.localize('STORYFRAME.ChallengeBuilder.Proficiency.Any'),
      trained: game.i18n.localize('STORYFRAME.ChallengeBuilder.Proficiency.Trained'),
      expert: game.i18n.localize('STORYFRAME.ChallengeBuilder.Proficiency.Expert'),
      master: game.i18n.localize('STORYFRAME.ChallengeBuilder.Proficiency.Master'),
      legendary: game.i18n.localize('STORYFRAME.ChallengeBuilder.Proficiency.Legendary'),
      proficient: game.i18n.localize('STORYFRAME.ChallengeBuilder.Proficiency.Proficient'),
      expertise: game.i18n.localize('STORYFRAME.ChallengeBuilder.Proficiency.Expertise'),
      optionPlaceholder: game.i18n.localize('STORYFRAME.UI.Labels.OptionName'),
      remove: game.i18n.localize('STORYFRAME.UI.Labels.Remove'),
      skills: game.i18n.localize('STORYFRAME.UI.Labels.Skills'),
      addSkill: game.i18n.localize('STORYFRAME.UI.Labels.AddSkill'),
    };

    const context = await this._prepareContext();
    const optionsList = this.element.querySelector('.challenge-options-list');
    const systemSkills = SystemAdapter.getSkills();

    const skillOptionsHtml = Object.entries(systemSkills)
      .map(([slug, skill]) => {
        const actionsJson = skill.actions ? JSON.stringify(skill.actions) : '[]';
        return `<option value="${slug}" data-actions='${actionsJson}' data-check-type="skill">${skill.name}</option>`;
      })
      .join('');

    const loreOptionsHtml = context.loreSkills
      .map(ls => `<option value="${ls.slug}" data-check-type="skill">${ls.name}</option>`)
      .join('');

    // Build skill options (NO saves - they're in a separate section now)
    let skillOptions = skillOptionsHtml;
    let loreOptions = '';
    if (loreOptionsHtml) {
      const loreLabel = game.i18n.localize('STORYFRAME.ChallengeBuilder.LoreSkills');
      loreOptions = `<optgroup label="${loreLabel}">${loreOptionsHtml}</optgroup>`;
    }

    const optionLabel = game.i18n.format('STORYFRAME.ChallengeBuilder.OptionLabel', { num: this.optionCount + 1 });
    const savesLabel = game.i18n.localize('STORYFRAME.UI.Categories.SavingThrows');
    const addSaveLabel = game.i18n.localize('STORYFRAME.UI.Labels.AddSave');

    const newOption = document.createElement('div');
    newOption.className = 'challenge-option-card';
    newOption.dataset.optionIndex = this.optionCount;
    newOption.innerHTML = `
      <div class="challenge-option-header">
        <input type="text" name="option-${this.optionCount}-name" class="option-name-input" value="${optionLabel}" placeholder="${i18n.optionPlaceholder}">
        <button type="button" class="challenge-option-remove" data-action="removeOption">
          <i class="fas fa-times"></i> ${i18n.remove}
        </button>
      </div>
      <div class="challenge-option-fields">
        <div class="challenge-option-field">
          <label>${i18n.skills}</label>
          <div class="skills-list" data-option-index="${this.optionCount}">
            <div class="skill-dc-row" data-skill-index="0">
              <div class="skill-select">
                <select name="option-${this.optionCount}-skill-0" class="skill-dropdown" data-skill-index="0" required>
                  <option value="">${i18n.selectSkill}</option>
                  ${skillOptions}
                  ${loreOptions ? `<optgroup label="${i18n.loreSkills}">${loreOptions}</optgroup>` : ''}
                </select>
              </div>
              ${context.isPF2e ? `
              <div class="action-select" style="display: none;">
                <select name="option-${this.optionCount}-action-0" class="action-dropdown">
                  <option value="">${i18n.noAction}</option>
                </select>
              </div>
              ` : ''}
              <div class="dc-input-group">
                <input type="number" name="option-${this.optionCount}-dc-0" class="dc-number-input" min="1" placeholder="${i18n.dc}" required>
                <button type="button" class="dc-preset-btn" data-action="toggleDCPreset" data-row-type="skill" data-option-index="${this.optionCount}" data-row-index="0">
                  <i class="fas fa-bookmark"></i>
                </button>
              </div>
              <div class="proficiency-select">
                <select name="option-${this.optionCount}-proficiency-0" class="proficiency-dropdown" data-tooltip="${i18n.minProfTooltip}">
                  <option value="0">${i18n.any}</option>
                  ${context.isPF2e ? `
                  <option value="1">${i18n.trained}</option>
                  <option value="2">${i18n.expert}</option>
                  <option value="3">${i18n.master}</option>
                  <option value="4">${i18n.legendary}</option>
                  ` : `
                  <option value="1">${i18n.proficient}</option>
                  <option value="2">${i18n.expertise}</option>
                  `}
                </select>
              </div>
              <div class="secret-checkbox">
                <input type="checkbox" name="option-${this.optionCount}-secret-0" id="option-${this.optionCount}-secret-0">
                <label for="option-${this.optionCount}-secret-0" data-tooltip="${i18n.secretTooltip}">
                  <i class="fas fa-eye-slash"></i>
                </label>
              </div>
            </div>
          </div>
          <button type="button" class="add-skill-btn" data-action="addSkill" data-option-index="${this.optionCount}">
            <i class="fas fa-plus"></i> ${i18n.addSkill}
          </button>
        </div>
        ${context.hasSaves ? `
        <div class="challenge-option-field saves-section">
          <label>${savesLabel}</label>
          <div class="saves-list" data-option-index="${this.optionCount}">
            <!-- Saves will be added dynamically via addSave action -->
          </div>
          <button type="button" class="add-save-btn" data-action="addSave" data-option-index="${this.optionCount}">
            <i class="fas fa-plus"></i> ${addSaveLabel}
          </button>
        </div>
        ` : ''}
      </div>
    `;

    this.skillCounts.set(this.optionCount, 1);
    this.saveCounts.set(this.optionCount, 0);  // Start with 0 saves
    optionsList.appendChild(newOption);

    // Update tooltips for the new option
    this._attachTooltipHandlers();

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
        card.querySelector('.option-name-input').value = game.i18n.format('STORYFRAME.ChallengeBuilder.OptionLabel', { num: idx + 1 });
      });
    } else {
      ui.notifications.warn(game.i18n.localize('STORYFRAME.ChallengeBuilder.Validation.AtLeastOneOption'));
    }
  }

  static _onToggleDCPreset(_event, target) {
    // Close all other open dropdowns first
    this.element.querySelectorAll('.dc-preset-dropdown').forEach(d => {
      if (!target.closest('.dc-input-group')?.contains(d)) {
        d.style.display = 'none';
      }
    });

    // Toggle this dropdown
    const inputGroup = target.closest('.dc-input-group');
    let dropdown = inputGroup.querySelector('.dc-preset-dropdown');

    if (!dropdown) {
      // Create dropdown if it doesn't exist
      dropdown = ChallengeBuilderDialog._createDCPresetDropdown(inputGroup, this.partyLevel);
    }

    const isVisible = dropdown.style.display !== 'none';
    dropdown.style.display = isVisible ? 'none' : 'block';

    if (!isVisible) {
      // Click outside to close
      const closeHandler = (e) => {
        if (!dropdown.contains(e.target) && !target.contains(e.target)) {
          dropdown.style.display = 'none';
          document.removeEventListener('click', closeHandler);
        }
      };
      setTimeout(() => document.addEventListener('click', closeHandler), 0);
    }
  }

  static _createDCPresetDropdown(inputGroup, partyLevel) {
    const dropdown = document.createElement('div');
    dropdown.className = 'dc-preset-dropdown';
    dropdown.style.display = 'none';

    // Get presets from context
    const allPresets = game.settings.get(MODULE_ID, 'dcPresets') || [];
    const currentSystem = SystemAdapter.detectSystem();
    const dcPresets = allPresets.filter(p => !p.system || p.system === currentSystem);

    // Get difficulty adjustments for PF2e
    const difficultyAdjustments = SystemAdapter.getDifficultyAdjustments();

    // Build tabs
    const tabs = [];

    // Tab 1: Custom Presets (always show, even if empty)
    const presetsContent = dcPresets.length > 0
      ? dcPresets.map(preset => `
          <div class="preset-option-wrapper">
            <button type="button"
                    class="preset-option"
                    data-action="applyDCPreset"
                    data-dc="${preset.dc}"
                    data-tooltip="${preset.name}">
              ${preset.dc}
            </button>
            <button type="button"
                    class="preset-remove-btn"
                    data-action="removeDCPreset"
                    data-preset-id="${preset.id || preset.dc}"
                    data-tooltip="Remove ${preset.name}">
              <i class="fas fa-times"></i>
            </button>
          </div>
        `).join('')
      : '<div class="no-presets">No custom presets yet</div>';

    const addPresetForm = `
      <div class="add-preset-form">
        <input type="text" class="preset-name-input" placeholder="Name" maxlength="20">
        <input type="number" class="preset-dc-input" placeholder="DC" min="1" max="99">
        <button type="button" class="preset-add-btn" data-action="addDCPreset">
          <i class="fas fa-plus"></i>
        </button>
      </div>
    `;

    tabs.push({
      id: 'presets',
      label: 'Presets',
      content: presetsContent + addPresetForm,
    });

    // Tab 2: Party Level (if available)
    if (partyLevel !== null && difficultyAdjustments && difficultyAdjustments.length > 0) {
      tabs.push({
        id: 'party-level',
        label: `Party Lvl ${partyLevel}`,
        content: difficultyAdjustments.map(difficulty => {
          const calculatedDC = ChallengeBuilderDialog.prototype._calculateDCByLevel(partyLevel, difficulty.id);
          const label = game.i18n.localize(difficulty.labelKey);
          return `
            <button type="button"
                    class="preset-option"
                    data-action="applyDCPreset"
                    data-dc="${calculatedDC}"
                    data-tooltip="${label} (DC ${calculatedDC})">
              <span class="preset-dc">${calculatedDC}</span>
              <span class="preset-label">${label}</span>
            </button>
          `;
        }).join(''),
      });
    }

    if (tabs.length === 0) {
      dropdown.innerHTML = '<div class="no-presets">No DC options available</div>';
    } else {
      // Build tabbed interface
      const tabButtons = tabs.map((tab, idx) => `
        <button type="button"
                class="dc-tab-btn ${idx === 0 ? 'active' : ''}"
                data-tab="${tab.id}">
          ${tab.label}
        </button>
      `).join('');

      const tabContents = tabs.map((tab, idx) => `
        <div class="dc-tab-content ${idx === 0 ? 'active' : ''}" data-tab-content="${tab.id}">
          ${tab.content}
        </div>
      `).join('');

      dropdown.innerHTML = `
        <div class="dc-tabs-header">
          ${tabButtons}
        </div>
        <div class="dc-tabs-body">
          ${tabContents}
        </div>
      `;

      // Attach tab switching handlers
      setTimeout(() => {
        dropdown.querySelectorAll('.dc-tab-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const tabId = btn.dataset.tab;

            // Update active tab button
            dropdown.querySelectorAll('.dc-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update active tab content
            dropdown.querySelectorAll('.dc-tab-content').forEach(c => c.classList.remove('active'));
            dropdown.querySelector(`[data-tab-content="${tabId}"]`).classList.add('active');
          });
        });
      }, 0);
    }

    inputGroup.style.position = 'relative';
    inputGroup.appendChild(dropdown);

    return dropdown;
  }

  static _onApplyDCPreset(_event, target) {
    const dc = parseInt(target.dataset.dc);
    const inputGroup = target.closest('.dc-input-group');
    const dcInput = inputGroup.querySelector('input[type="number"]');

    if (dcInput && !isNaN(dc)) {
      dcInput.value = dc;
    }

    // Close dropdown
    const dropdown = inputGroup.querySelector('.dc-preset-dropdown');
    if (dropdown) {
      dropdown.style.display = 'none';
    }
  }

  static async _onAddDCPreset(_event, target) {
    const dropdown = target.closest('.dc-preset-dropdown');
    const nameInput = dropdown.querySelector('.preset-name-input');
    const dcInput = dropdown.querySelector('.preset-dc-input');

    const name = nameInput.value.trim();
    const dc = parseInt(dcInput.value);

    if (!name) {
      ui.notifications.warn('Please enter a name for the preset');
      nameInput.focus();
      return;
    }

    if (!dc || dc < 1) {
      ui.notifications.warn('Please enter a valid DC value');
      dcInput.focus();
      return;
    }

    // Get current presets
    const allPresets = game.settings.get(MODULE_ID, 'dcPresets') || [];
    const currentSystem = SystemAdapter.detectSystem();

    // Create new preset
    const newPreset = {
      id: foundry.utils.randomID(),
      name,
      dc,
      system: currentSystem,
    };

    // Add to presets
    allPresets.push(newPreset);
    await game.settings.set(MODULE_ID, 'dcPresets', allPresets);

    ui.notifications.info(`Added preset: ${name} (DC ${dc})`);

    // Recreate dropdown
    const inputGroup = dropdown.closest('.dc-input-group');
    dropdown.remove();
    const newDropdown = ChallengeBuilderDialog._createDCPresetDropdown(inputGroup, this.partyLevel);
    newDropdown.style.display = 'block';
  }

  static async _onRemoveDCPreset(_event, target) {
    const presetId = target.dataset.presetId;

    // Get current presets
    const allPresets = game.settings.get(MODULE_ID, 'dcPresets') || [];

    // Find and remove the preset
    const presetIndex = allPresets.findIndex(p => (p.id || p.dc.toString()) === presetId);

    if (presetIndex === -1) {
      ui.notifications.warn('Preset not found');
      return;
    }

    const removedPreset = allPresets[presetIndex];
    allPresets.splice(presetIndex, 1);
    await game.settings.set(MODULE_ID, 'dcPresets', allPresets);

    ui.notifications.info(`Removed preset: ${removedPreset.name}`);

    // Recreate dropdown
    const dropdown = target.closest('.dc-preset-dropdown');
    const inputGroup = dropdown.closest('.dc-input-group');
    dropdown.remove();
    const newDropdown = ChallengeBuilderDialog._createDCPresetDropdown(inputGroup, this.partyLevel);
    newDropdown.style.display = 'block';
  }
}
