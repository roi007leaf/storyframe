/**
 * DC Management Handler for GM Sidebar
 * Handles DC input, difficulty selection, presets, and system-specific DC calculations
 */

import { MODULE_ID } from '../../../constants.mjs';
import * as SystemAdapter from '../../../system-adapter.mjs';
import { createDCPresetDropdown } from '../../../utils/dc-preset-dropdown.mjs';

/**
 * Set DC from select dropdown
 * Note: This is handled by system-specific classes (_attachSystemDCHandlers)
 * This function is kept for API compatibility but is not actively used
 */
export async function onSetDCSelect(_event, target, sidebar) {
  const value = target.value;
  if (value === '') {
    sidebar.currentDC = null;
  } else {
    const dc = parseInt(value);
    if (!isNaN(dc)) {
      sidebar.currentDC = dc;
    }
  }

  // Update DC input directly without re-rendering
  const dcInput = sidebar.element.querySelector('#dc-input');
  if (dcInput) {
    dcInput.value = sidebar.currentDC || '';
  }
}

/**
 * Set difficulty level (triggers DC recalculation)
 * Note: This is handled by system-specific classes (_attachSystemDCHandlers)
 * This function is kept for API compatibility but is not actively used
 */
export async function onSetDifficulty(_event, target, sidebar) {
  const difficulty = target.value;
  sidebar.currentDifficulty = difficulty;

  // Recalculate DC based on party level and new difficulty
  const partyLevel = await sidebar._getPartyLevel();
  if (partyLevel !== null) {
    sidebar.currentDC = sidebar._calculateDCByLevel(partyLevel, difficulty);
  }

  // Update DC input directly without re-rendering
  const dcInput = sidebar.element.querySelector('#dc-input');
  if (dcInput && sidebar.currentDC !== null) {
    dcInput.value = sidebar.currentDC;
  }
}

/**
 * Toggle preset dropdown visibility
 */
export function onTogglePresetDropdown(_event, target, sidebar) {
  // Close all other open dropdowns first
  sidebar.element.querySelectorAll('.preset-dropdown').forEach(d => {
    if (!target.closest('.dc-input-group')?.contains(d)) {
      d.style.display = 'none';
    }
  });

  // Toggle this dropdown
  const inputGroup = target.closest('.dc-input-group');
  let dropdown = inputGroup.querySelector('.preset-dropdown');

  if (!dropdown) {
    // Create dropdown if it doesn't exist
    dropdown = _createPresetDropdown(inputGroup, sidebar);
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

/**
 * Create the tabbed preset dropdown (private helper)
 */
function _createPresetDropdown(inputGroup, sidebar) {
  return createDCPresetDropdown({
    inputGroup,
    partyLevel: sidebar.partyLevel,
    calculateDCByLevel: (level, difficultyId) => {
      return sidebar._calculateDCByLevel(level, difficultyId);
    },
    actions: {
      applyPreset: 'applyPreset',
      applyDifficulty: 'applyPresetDC',
      addPreset: 'addPresetQuick',
      removePreset: 'deletePresetQuick',
    },
  });
}

/**
 * Apply a DC preset
 */
export async function onApplyPreset(_event, target, sidebar) {
  const presetId = target.dataset.presetId;
  const presets = game.settings.get(MODULE_ID, 'dcPresets');
  const preset = presets.find((p) => p.id === presetId);

  if (!preset) return;

  sidebar.currentDC = preset.dc;
  const dcInput = sidebar.element.querySelector('#dc-input');
  if (dcInput) dcInput.value = preset.dc;

  const dropdown = target.closest('.preset-dropdown');
  if (dropdown) dropdown.style.display = 'none';

  ui.notifications.info(game.i18n.format('STORYFRAME.Notifications.DC.PresetApplied', { name: preset.name, dc: preset.dc }));
}

/**
 * Apply a calculated DC from party level difficulty
 */
export async function onApplyPresetDC(_event, target, sidebar) {
  const dc = parseInt(target.dataset.dc);

  if (isNaN(dc)) return;

  sidebar.currentDC = dc;
  const dcInput = sidebar.element.querySelector('#dc-input');
  if (dcInput) dcInput.value = dc;

  const dropdown = target.closest('.preset-dropdown');
  if (dropdown) dropdown.style.display = 'none';
}

/**
 * Add a quick DC preset
 */
export async function onAddPresetQuick(_event, target, sidebar) {
  const dropdown = target.closest('.preset-dropdown');
  const nameInput = dropdown.querySelector('.preset-name-input');
  const dcInput = dropdown.querySelector('.preset-dc-input-new');

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

  // Recreate dropdown using shared component
  const inputGroup = dropdown.closest('.dc-input-group');
  dropdown.remove();
  const newDropdown = _createPresetDropdown(inputGroup, sidebar);
  newDropdown.style.display = 'block';
}

/**
 * Delete a quick DC preset
 */
export async function onDeletePresetQuick(_event, target, sidebar) {
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

  // Recreate dropdown using shared component
  const dropdown = target.closest('.preset-dropdown');
  const inputGroup = dropdown.closest('.dc-input-group');
  dropdown.remove();
  const newDropdown = _createPresetDropdown(inputGroup, sidebar);
  newDropdown.style.display = 'block';
}

/**
 * Attach system-specific DC handlers (override in subclass)
 */
export function attachSystemDCHandlers(sidebar) {
  // Base implementation does nothing
  // Subclasses can override to add system-specific handlers
}

/**
 * Calculate DC by level (system-specific - override in subclass)
 * @param {number} level - Party level
 * @param {string} difficultyId - Difficulty ID
 * @returns {number|null}
 */
export function calculateDCByLevel(level, difficultyId) {
  // Base implementation returns null
  // Subclasses should override with system-specific logic
  return null;
}

/**
 * Get party level for DC calculation (system-specific - override in subclass)
 * @returns {Promise<number|null>}
 */
export async function getPartyLevel(sidebar) {
  // Base implementation returns null
  // Subclasses should override with system-specific logic
  return null;
}

/**
 * Attach common DC handlers
 */
export function attachDCHandlers(sidebar) {
  // Common DC input field
  const dcInput = sidebar.element.querySelector('#dc-input');
  if (dcInput) {
    dcInput.addEventListener('change', (e) => {
      const value = e.target.value;
      if (value === '') {
        sidebar.currentDC = null;
      } else {
        const dc = parseInt(value);
        if (!isNaN(dc)) {
          sidebar.currentDC = dc;
        }
      }
    });
  }

  // System-specific DC handlers (override in subclass)
  attachSystemDCHandlers(sidebar);
}

/**
 * Prepare DC context data for template
 */
export async function prepareDCContext(sidebar) {
  const currentSystem = SystemAdapter.detectSystem();

  // Get system-specific DC options
  const dcOptions = SystemAdapter.getDCOptions();

  // Get system-specific context (override in subclass)
  const systemContext = await prepareContextSystemSpecific(sidebar);
  const { partyLevel = null, calculatedDC = null, difficultyOptions = null } = systemContext;

  // Load DC presets
  const allPresets = game.settings.get(MODULE_ID, 'dcPresets') || [];
  const dcPresets = allPresets.filter((p) => !p.system || p.system === currentSystem);

  return {
    currentDC: sidebar.currentDC,
    partyLevel,
    calculatedDC,
    currentDifficulty: sidebar.currentDifficulty,
    difficultyOptions,
    dcOptions,
    dcPresets,
  };
}

/**
 * Prepare system-specific context for template (override in subclass)
 * @returns {Promise<Object>} { partyLevel?, calculatedDC?, difficultyOptions? }
 */
export async function prepareContextSystemSpecific(sidebar) {
  // Base implementation returns empty object
  // Subclasses should override with system-specific logic
  return {};
}
