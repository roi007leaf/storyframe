/**
 * DC Management Handler for GM Sidebar
 * Handles DC input, difficulty selection, presets, and system-specific DC calculations
 */

import { MODULE_ID } from '../../../constants.mjs';
import * as SystemAdapter from '../../../system-adapter.mjs';
import { _aboveSidebarZIndex, getPopupParent } from './ui-helpers.mjs';

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
 * Toggle preset dropdown visibility (body-level fixed popup)
 */
export function onTogglePresetDropdown(_event, target, sidebar) {
  // Toggle off if already open
  const existing = document.querySelector('.storyframe-dc-preset-popup');
  if (existing) {
    existing.remove();
    return;
  }

  const popup = _buildPresetPopup(sidebar);
  getPopupParent(target).appendChild(popup);

  // Position fixed relative to trigger button
  const rect = target.getBoundingClientRect();
  popup.style.left = `${rect.left}px`;
  popup.style.top = `${rect.bottom + 4}px`;

  // Adjust if off-screen after paint
  requestAnimationFrame(() => {
    const pr = popup.getBoundingClientRect();
    if (pr.right > window.innerWidth - 10) {
      popup.style.left = `${rect.right - pr.width}px`;
    }
    if (pr.bottom > window.innerHeight - 10) {
      popup.style.top = `${rect.top - pr.height - 4}px`;
    }
  });

  // Tab switching
  popup.querySelectorAll('.dc-tab-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const tabId = btn.dataset.tab;
      popup.querySelectorAll('.dc-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      popup.querySelectorAll('.dc-tab-content').forEach(c => c.classList.remove('active'));
      popup.querySelector(`[data-tab-content="${tabId}"]`).classList.add('active');
    });
  });

  // Apply preset
  popup.querySelectorAll('.preset-option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const presetId = btn.dataset.presetId;
      const presets = game.settings.get(MODULE_ID, 'dcPresets');
      const preset = presets.find(p => p.id === presetId);
      if (!preset) return;
      sidebar.currentDC = preset.dc;
      const dcInput = sidebar.element.querySelector('#dc-input');
      if (dcInput) dcInput.value = preset.dc;
      popup.remove();
    });
  });

  // Apply difficulty DC
  popup.querySelectorAll('.difficulty-option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const dc = parseInt(btn.dataset.dc);
      if (isNaN(dc)) return;
      sidebar.currentDC = dc;
      const dcInput = sidebar.element.querySelector('#dc-input');
      if (dcInput) dcInput.value = dc;
      popup.remove();
    });
  });

  // Remove preset
  popup.querySelectorAll('.preset-remove-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const presetId = btn.dataset.presetId;
      const allPresets = game.settings.get(MODULE_ID, 'dcPresets') || [];
      const idx = allPresets.findIndex(p => (p.id || String(p.dc)) === presetId);
      if (idx !== -1) {
        allPresets.splice(idx, 1);
        await game.settings.set(MODULE_ID, 'dcPresets', allPresets);
      }
      popup.remove();
      onTogglePresetDropdown(_event, target, sidebar);
    });
  });

  // Add preset
  popup.querySelector('.preset-add-btn').addEventListener('click', async () => {
    const dcInput = popup.querySelector('.preset-dc-input-new');
    const dc = parseInt(dcInput.value);
    if (!dc || dc < 1) { dcInput.focus(); return; }
    const allPresets = game.settings.get(MODULE_ID, 'dcPresets') || [];
    allPresets.push({ id: foundry.utils.randomID(), name: `DC ${dc}`, dc, system: SystemAdapter.detectSystem() });
    await game.settings.set(MODULE_ID, 'dcPresets', allPresets);
    popup.remove();
    onTogglePresetDropdown(_event, target, sidebar);
  });

  // Close on click outside
  const closeHandler = e => {
    if (!popup.contains(e.target) && !target.contains(e.target)) {
      popup.remove();
      document.removeEventListener('click', closeHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 0);
}

/**
 * Build the preset popup element (private helper)
 */
function _buildPresetPopup(sidebar) {
  const popup = document.createElement('div');
  popup.className = 'storyframe-dc-preset-popup preset-dropdown';
  popup.style.position = 'fixed';
  popup.style.zIndex = _aboveSidebarZIndex(sidebar);

  const allPresets = game.settings.get(MODULE_ID, 'dcPresets') || [];
  const currentSystem = SystemAdapter.detectSystem();
  const dcPresets = allPresets.filter(p => !p.system || p.system === currentSystem);
  const difficultyAdjustments = SystemAdapter.getDifficultyAdjustments();
  const partyLevel = sidebar.partyLevel;

  const dcOptions = SystemAdapter.getDCOptions();
  const tabs = [{ id: 'presets', label: 'Presets' }];
  if (partyLevel !== null && difficultyAdjustments?.length > 0) {
    tabs.push({ id: 'party-level', label: `Party Lvl ${partyLevel}` });
  }
  if ((currentSystem === 'dnd5e' || currentSystem === 'daggerheart' || currentSystem === 'projectfu') && dcOptions.length > 0) {
    tabs.push({ id: 'difficulty', label: 'Difficulty' });
  }

  const tabButtons = tabs.map((tab, idx) =>
    `<button type="button" class="dc-tab-btn ${idx === 0 ? 'active' : ''}" data-tab="${tab.id}">${tab.label}</button>`
  ).join('');

  const presetsHtml = dcPresets.length > 0
    ? dcPresets.map(preset => `
        <div class="preset-option-wrapper">
          <button type="button" class="preset-option preset-option-btn" data-preset-id="${preset.id}" data-dc="${preset.dc}" data-tooltip="${preset.name}">
            ${preset.dc}
          </button>
          <button type="button" class="preset-remove-btn" data-preset-id="${preset.id || preset.dc}" data-tooltip="Remove ${preset.name}">
            <i class="fas fa-times"></i>
          </button>
        </div>`).join('')
    : '<div class="no-presets">No custom presets yet</div>';

  const addForm = `
    <div class="add-preset-form">
      <input type="number" class="preset-dc-input-new" placeholder="DC" min="1" max="99">
      <button type="button" class="preset-add-btn"><i class="fas fa-plus"></i></button>
    </div>`;

  const difficultyHtml = (partyLevel !== null && difficultyAdjustments?.length > 0)
    ? difficultyAdjustments.map(d => {
        const dc = sidebar._calculateDCByLevel(partyLevel, d.id);
        const label = game.i18n.localize(d.labelKey);
        return `<button type="button" class="preset-option difficulty-option-btn" data-dc="${dc}" data-tooltip="${label} (DC ${dc})">
          <span class="preset-dc">${dc}</span>
          <span class="preset-label">${label}</span>
        </button>`;
      }).join('')
    : '';

  const dnd5eDifficultyHtml = ((currentSystem === 'dnd5e' || currentSystem === 'daggerheart' || currentSystem === 'projectfu') && dcOptions.length > 0)
    ? dcOptions.map(opt => {
        const name = opt.label.replace(/ \((?:DC|DL) \d+\)$/, '');
        return `<button type="button" class="preset-option difficulty-option-btn" data-dc="${opt.dc}" data-tooltip="${opt.label}">
          <span class="preset-dc">${opt.dc}</span>
          <span class="preset-label">${name}</span>
        </button>`;
      }).join('')
    : '';

  const tabContents = [
    `<div class="dc-tab-content active" data-tab-content="presets">${presetsHtml}${addForm}</div>`,
    partyLevel !== null && difficultyAdjustments?.length > 0
      ? `<div class="dc-tab-content" data-tab-content="party-level">${difficultyHtml}</div>`
      : '',
    (currentSystem === 'dnd5e' || currentSystem === 'daggerheart' || currentSystem === 'projectfu') && dcOptions.length > 0
      ? `<div class="dc-tab-content" data-tab-content="difficulty">${dnd5eDifficultyHtml}</div>`
      : '',
  ].join('');

  popup.innerHTML = `<div class="dc-tabs-header">${tabButtons}</div><div class="dc-tabs-body">${tabContents}</div>`;
  return popup;
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
 * Attach system-specific DC handlers (override in subclass)
 */
export function attachSystemDCHandlers(_sidebar) {
  // Base implementation does nothing
  // Subclasses can override to add system-specific handlers
}

/**
 * Calculate DC by level (system-specific - override in subclass)
 * @param {number} level - Party level
 * @param {string} difficultyId - Difficulty ID
 * @returns {number|null}
 */
export function calculateDCByLevel(_level, _difficultyId) {
  // Base implementation returns null
  // Subclasses should override with system-specific logic
  return null;
}

/**
 * Get party level for DC calculation (system-specific - override in subclass)
 * @returns {Promise<number|null>}
 */
export async function getPartyLevel(_sidebar) {
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
export async function prepareContextSystemSpecific(_sidebar) {
  // Base implementation returns empty object
  // Subclasses should override with system-specific logic
  return {};
}
