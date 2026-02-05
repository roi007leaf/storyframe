/**
 * DC Management Handler for GM Sidebar
 * Handles DC input, difficulty selection, presets, and system-specific DC calculations
 */

import { MODULE_ID } from '../../../constants.mjs';
import * as SystemAdapter from '../../../system-adapter.mjs';

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
  const dropdown = sidebar.element.querySelector('.preset-dropdown');
  if (!dropdown) return;

  const isVisible = dropdown.style.display !== 'none';
  dropdown.style.display = isVisible ? 'none' : 'block';

  if (!isVisible) {
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

  const dropdown = sidebar.element.querySelector('.preset-dropdown');
  if (dropdown) dropdown.style.display = 'none';

  ui.notifications.info(game.i18n.format('STORYFRAME.Notifications.DC.PresetApplied', { name: preset.name, dc: preset.dc }));
}

/**
 * Add a quick DC preset
 */
export async function onAddPresetQuick(_event, _target, sidebar) {
  const input = sidebar.element.querySelector('#new-preset-dc');
  const dcValue = parseInt(input.value);

  if (isNaN(dcValue) || dcValue < 1 || dcValue > 60) {
    ui.notifications.warn(game.i18n.localize('STORYFRAME.Notifications.DC.InvalidDC'));
    return;
  }

  const preset = {
    id: foundry.utils.randomID(),
    name: `DC ${dcValue}`,
    dc: dcValue,
    system: game.system.id,
    createdAt: Date.now(),
  };

  const presets = game.settings.get(MODULE_ID, 'dcPresets');
  presets.push(preset);
  await game.settings.set(MODULE_ID, 'dcPresets', presets);

  input.value = '';

  // Update DOM directly instead of re-rendering to preserve scroll position
  const dropdown = sidebar.element.querySelector('.preset-dropdown');
  let presetList = dropdown?.querySelector('.preset-list');

  // Create preset list if it doesn't exist (first preset)
  if (!presetList) {
    const divider = document.createElement('div');
    divider.className = 'preset-divider';
    dropdown.appendChild(divider);

    presetList = document.createElement('div');
    presetList.className = 'preset-list';
    dropdown.appendChild(presetList);
  }

  // Create and add new preset item
  const presetItem = document.createElement('div');
  presetItem.className = 'preset-item';
  presetItem.innerHTML = `
    <button type="button"
            class="preset-option"
            data-action="applyPreset"
            data-preset-id="${preset.id}"
            data-dc="${preset.dc}"
            data-tooltip="${preset.name}">
      ${preset.dc}
    </button>
    <button type="button"
            class="preset-delete-btn"
            data-action="deletePresetQuick"
            data-preset-id="${preset.id}"
            data-tooltip="Delete">
      <i class="fas fa-times"></i>
    </button>
  `;
  presetList.appendChild(presetItem);

  ui.notifications.info(game.i18n.format('STORYFRAME.Notifications.DC.DCAdded', { value: dcValue }));
}

/**
 * Delete a quick DC preset
 */
export async function onDeletePresetQuick(_event, target, sidebar) {
  const presetId = target.dataset.presetId;
  const presets = game.settings.get(MODULE_ID, 'dcPresets');
  const filtered = presets.filter((p) => p.id !== presetId);

  await game.settings.set(MODULE_ID, 'dcPresets', filtered);

  // Update DOM directly instead of re-rendering to preserve scroll position
  const presetItem = target.closest('.preset-item');
  if (presetItem) {
    presetItem.remove();

    // If this was the last preset, remove the divider and list container
    const presetList = sidebar.element.querySelector('.preset-list');
    if (presetList && presetList.children.length === 0) {
      const divider = sidebar.element.querySelector('.preset-divider');
      if (divider) divider.remove();
      presetList.remove();
    }
  }
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
