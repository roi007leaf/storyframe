/**
 * Shared DC Preset Dropdown Component
 * Creates a tabbed dropdown for DC selection with presets and party level difficulties
 */

import { MODULE_ID } from '../constants.mjs';
import * as SystemAdapter from '../system-adapter.mjs';

/**
 * Create a tabbed DC preset dropdown
 * @param {Object} options - Configuration options
 * @param {HTMLElement} options.inputGroup - Parent element to attach dropdown to
 * @param {number|null} options.partyLevel - Current party level for difficulty calculations
 * @param {Function} options.calculateDCByLevel - Function to calculate DC by level and difficulty
 * @param {Object} options.actions - Action names for event handlers
 * @param {string} options.actions.applyPreset - Action name for applying presets
 * @param {string} options.actions.applyDifficulty - Action name for applying difficulty DCs
 * @param {string} options.actions.addPreset - Action name for adding presets
 * @param {string} options.actions.removePreset - Action name for removing presets
 * @returns {HTMLElement} The dropdown element
 */
export function createDCPresetDropdown({ inputGroup, partyLevel, calculateDCByLevel, actions }) {
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
                  data-action="${actions.applyPreset}"
                  data-preset-id="${preset.id}"
                  data-dc="${preset.dc}"
                  data-tooltip="${preset.name}">
            ${preset.dc}
          </button>
          <button type="button"
                  class="preset-remove-btn"
                  data-action="${actions.removePreset}"
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
      <input type="number" class="preset-dc-input-new" placeholder="DC" min="1" max="99">
      <button type="button" class="preset-add-btn" data-action="${actions.addPreset}">
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
        const calculatedDC = calculateDCByLevel(partyLevel, difficulty.id);
        const label = game.i18n.localize(difficulty.labelKey);
        return `
          <button type="button"
                  class="preset-option"
                  data-action="${actions.applyDifficulty}"
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
