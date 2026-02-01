const MODULE_ID = 'storyframe';

/**
 * DC Preset Manager Dialog
 * Allows GMs to create, edit, and delete DC presets
 */
export class DCPresetManager extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
) {
  static DEFAULT_OPTIONS = {
    id: 'storyframe-dc-preset-manager',
    classes: ['storyframe', 'dc-preset-manager'],
    window: {
      title: 'DC Presets',
      icon: 'fas fa-bookmark',
      resizable: true,
    },
    position: {
      width: 600,
      height: 500,
    },
    actions: {
      createPreset: DCPresetManager._onCreatePreset,
      editPreset: DCPresetManager._onEditPreset,
      deletePreset: DCPresetManager._onDeletePreset,
    },
  };

  static PARTS = {
    form: {
      template: 'modules/storyframe/templates/dc-preset-manager.hbs',
    },
  };

  async _prepareContext() {
    const allPresets = game.settings.get(MODULE_ID, 'dcPresets') || [];
    const currentSystem = game.system.id;

    // Filter presets for current system
    const presets = allPresets.filter((p) => !p.system || p.system === currentSystem);

    return {
      presets,
    };
  }

  static async _onCreatePreset(_event, _target) {
    const name = await foundry.applications.api.DialogV2.prompt({
      window: { title: 'Create DC Preset' },
      content: '<input type="text" name="name" placeholder="Preset name (e.g., Hard Lock)" autofocus>',
      ok: {
        label: 'Next',
        callback: (event, button, _dialog) => button.form.elements.name.value,
      },
      rejectClose: false,
    });

    if (!name) return;

    const dcValue = await foundry.applications.api.DialogV2.prompt({
      window: { title: 'Set DC Value' },
      content: '<input type="number" name="dc" min="1" max="60" value="15" autofocus>',
      ok: {
        label: 'Create',
        callback: (event, button, _dialog) => parseInt(button.form.elements.dc.value),
      },
      rejectClose: false,
    });

    if (!dcValue) return;

    const preset = {
      id: foundry.utils.randomID(),
      name,
      dc: dcValue,
      system: game.system.id,
      createdAt: Date.now(),
    };

    const presets = game.settings.get(MODULE_ID, 'dcPresets');
    presets.push(preset);
    await game.settings.set(MODULE_ID, 'dcPresets', presets);

    this.render();
    ui.notifications.info(`Created preset: ${name} (DC ${dcValue})`);
  }

  static async _onEditPreset(_event, target) {
    const presetId = target.dataset.presetId;
    const presets = game.settings.get(MODULE_ID, 'dcPresets');
    const preset = presets.find((p) => p.id === presetId);

    if (!preset) return;

    const name = await foundry.applications.api.DialogV2.prompt({
      window: { title: 'Edit Preset Name' },
      content: `<input type="text" name="name" value="${preset.name}" autofocus>`,
      ok: {
        label: 'Next',
        callback: (event, button, _dialog) => button.form.elements.name.value,
      },
      rejectClose: false,
    });

    if (!name) return;

    const dcValue = await foundry.applications.api.DialogV2.prompt({
      window: { title: 'Edit DC Value' },
      content: `<input type="number" name="dc" min="1" max="60" value="${preset.dc}" autofocus>`,
      ok: {
        label: 'Save',
        callback: (event, button, _dialog) => parseInt(button.form.elements.dc.value),
      },
      rejectClose: false,
    });

    if (!dcValue) return;

    preset.name = name;
    preset.dc = dcValue;

    await game.settings.set(MODULE_ID, 'dcPresets', presets);

    this.render();
    ui.notifications.info(`Updated preset: ${name} (DC ${dcValue})`);
  }

  static async _onDeletePreset(_event, target) {
    const presetId = target.dataset.presetId;
    const presets = game.settings.get(MODULE_ID, 'dcPresets');
    const preset = presets.find((p) => p.id === presetId);

    if (!preset) return;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: 'Delete Preset' },
      content: `<p>Delete preset "${preset.name}" (DC ${preset.dc})?</p>`,
      rejectClose: false,
    });

    if (!confirmed) return;

    const filtered = presets.filter((p) => p.id !== presetId);
    await game.settings.set(MODULE_ID, 'dcPresets', filtered);

    this.render();
    ui.notifications.info(`Deleted preset: ${preset.name}`);
  }
}
