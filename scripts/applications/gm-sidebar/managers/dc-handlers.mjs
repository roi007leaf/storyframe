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
  const dropdown = document.createElement('div');
  dropdown.className = 'preset-dropdown';
  dropdown.style.display = 'none';

  // Get presets from settings
  const allPresets = game.settings.get(MODULE_ID, 'dcPresets') || [];
  const currentSystem = SystemAdapter.detectSystem();
  const dcPresets = allPresets.filter(p => !p.system || p.system === currentSystem);

  // Get difficulty adjustments
  const difficultyAdjustments = SystemAdapter.getDifficultyAdjustments();

  // Build tabs
  const tabs = [];

  // Tab 1: Custom Presets (always show)
  const presetsContent = dcPresets.length > 0
    ? dcPresets.map(preset => `
        <div class="preset-option-wrapper">
          <button type="button"
                  class="preset-option"
                  data-action="applyPreset"
                  data-preset-id="${preset.id}"
                  data-dc="${preset.dc}"
                  data-tooltip="${preset.name}">
            ${preset.dc}
          </button>
          <button type="button"
                  class="preset-remove-btn"
                  data-action="deletePresetQuick"
                  data-preset-id="${preset.id}"
                  data-tooltip="Remove ${preset.name}">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `).join('')
    : '<div class="no-presets">No custom presets yet</div>';

  const addPresetForm = `
    <div class="add-preset-form">
      <input type="text" class="preset-name-input" placeholder="Name" maxlength="20">
      <input type="number" class="preset-dc-input-new" placeholder="DC" min="1" max="99">
      <button type="button" class="preset-add-btn" data-action="addPresetQuick">
        <i class="fas fa-plus"></i>
      </button>
    </div>
  `;

  tabs.push({
    id: 'presets',
    label: 'Presets',
    content: presetsContent + addPresetForm,
  });

  // Tab 2: Party Level (if available and PF2e)
  const partyLevel = sidebar.partyLevel;
  if (partyLevel !== null && difficultyAdjustments && difficultyAdjustments.length > 0) {
    tabs.push({
      id: 'party-level',
      label: `Party Lvl ${partyLevel}`,
      content: difficultyAdjustments.map(difficulty => {
        const calculatedDC = sidebar._calculateDCByLevel(partyLevel, difficulty.id);
        const label = game.i18n.localize(difficulty.labelKey);
        return `
          <button type="button"
                  class="preset-option"
                  data-action="applyPresetDC"
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

  // Recreate dropdown
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

  // Recreate dropdown
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
