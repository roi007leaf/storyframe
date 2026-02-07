import { MODULE_ID } from '../constants.mjs';

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
      title: 'STORYFRAME.WindowTitles.DCPresets',
      icon: 'fas fa-bookmark',
      resizable: true,
    },
    position: {
      width: 600,
      height: 500,
    },
    actions: {
      createPreset: DCPresetManager._onCreatePreset,
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
    const dcValue = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize('STORYFRAME.Dialogs.AddDCPreset.Title') },
      content: `<input type="number" name="dc" min="1" placeholder="${game.i18n.localize('STORYFRAME.UI.Placeholders.EnterDC')}" autofocus>`,
      ok: {
        label: game.i18n.localize('STORYFRAME.Dialogs.AddDCPreset.Button'),
        callback: (event, button, _dialog) => parseInt(button.form.elements.dc.value),
      },
      rejectClose: false,
    });

    if (!dcValue || isNaN(dcValue)) return;

    const preset = {
      id: foundry.utils.randomID(),
      dc: dcValue,
      system: game.system.id,
      createdAt: Date.now(),
    };

    const presets = game.settings.get(MODULE_ID, 'dcPresets');
    presets.push(preset);
    await game.settings.set(MODULE_ID, 'dcPresets', presets);

    this.render();

    // Refresh sidebar to show new preset in dropdown
    if (game.storyframe.gmSidebar?.rendered) {
      game.storyframe.gmSidebar.render();
    }
  }

  static async _onDeletePreset(_event, target) {
    const presetId = target.dataset.presetId;
    const presets = game.settings.get(MODULE_ID, 'dcPresets');
    const preset = presets.find((p) => p.id === presetId);

    if (!preset) return;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('STORYFRAME.Dialogs.DeletePreset.Title') },
      content: `<p>${game.i18n.format('STORYFRAME.Dialogs.DeletePreset.Content', { dc: preset.dc })}</p>`,
      rejectClose: false,
    });

    if (!confirmed) return;

    const filtered = presets.filter((p) => p.id !== presetId);
    await game.settings.set(MODULE_ID, 'dcPresets', filtered);

    this.render();

    // Refresh sidebar to update preset dropdown
    if (game.storyframe.gmSidebar?.rendered) {
      game.storyframe.gmSidebar.render();
    }
  }
}
