import { PlayerSidebarApp } from './scripts/applications/player-sidebar.mjs';
import { PlayerViewerApp } from './scripts/applications/player-viewer.mjs';
import { MODULE_ID } from './scripts/constants.mjs';
import { handleJournalClose, handleJournalRender, handleDaggerheartPageRender } from './scripts/hooks/journal-hooks.mjs';
import { handlePlayerViewerClose, handlePlayerViewerRender } from './scripts/hooks/player-viewer-hooks.mjs';
import { SocketManager } from './scripts/socket-manager.mjs';
import { StateManager } from './scripts/state-manager.mjs';

/**
 * Setup global listener for PF2e inline check repost buttons
 * Integrates with StoryFrame's roll tracking system
 */
function setupPF2eRepostIntegration() {
  document.addEventListener('click', async (event) => {
    // Only intercept when Ctrl/Cmd is held; otherwise let PF2e post to chat normally
    if (!event.ctrlKey && !event.metaKey) return;

    const repostBtn = event.target.closest('[data-pf2-repost]');
    if (!repostBtn) return;

    const checkElement = repostBtn.closest('.inline-check');
    if (!checkElement) return;

    // Prevent PF2e's chat post before its handler runs
    event.preventDefault();
    event.stopImmediatePropagation();

    // Extract check data
    const dc = parseInt(checkElement.dataset.pf2Dc);
    const checkSlug = checkElement.dataset.pf2Check;
    const traits = checkElement.dataset.pf2Traits || '';

    if (!checkSlug || isNaN(dc)) return;

    // Secret only if 'secret' trait is explicitly present
    const parsedTraits = traits.toLowerCase().split(',').map(t => t.trim());
    const isSecret = parsedTraits.includes('secret');

    // Extract action slug from traits (e.g., "action:sense-motive")
    const actionTrait = parsedTraits.find(t => t.startsWith('action:'));
    const actionSlug = actionTrait ? actionTrait.slice('action:'.length) : null;

    // Extract custom display label (from name:xxx parameter → data-pf2-label attribute)
    const label = checkElement.dataset.pf2Label || null;


    // Determine check type (save vs skill)
    const saveTypes = new Set(['fortitude', 'reflex', 'will']);
    const checkType = saveTypes.has(checkSlug.toLowerCase()) ? 'save' : 'skill';

    // Map full skill/save names to slugs
    const { PF2E_SKILL_NAME_MAP } = await import('./scripts/system/pf2e/skills.mjs');
    const skillSlug = PF2E_SKILL_NAME_MAP[checkSlug] || checkSlug;

    // Build check object (store slug so we can send it after dialog closes)
    const checks = [{
      skillName: checkSlug,
      skillSlug,
      dc,
      isSecret,
      checkType,
      actionSlug,
      label,
    }];

    // Subscribe to (or open) the singleton roll request dialog
    const { RollRequestDialog } = await import('./scripts/applications/roll-request-dialog.mjs');
    const { getAllPlayerPCs } = await import('./scripts/system-adapter.mjs');
    const pcs = await getAllPlayerPCs();
    if (!RollRequestDialog._instance && pcs.length === 0) {
      ui.notifications.warn('No player-owned characters found in the world.');
      return;
    }

    const result = await RollRequestDialog.subscribe(checks, pcs);

    const selectedIds = result?.selectedIds || result || [];
    const allowOnlyOne = result?.allowOnlyOne || false;
    const batchGroupId = result?.batchGroupId ?? null;
    if (!selectedIds || selectedIds.length === 0) return;

    // Need a sidebar instance for requestSkillCheck (used for DC/secret state)
    if (!game.storyframe.gmSidebar) {
      const system = game.system.id;
      if (system === 'pf2e') {
        const { GMSidebarAppPF2e } = await import('./scripts/applications/gm-sidebar/gm-sidebar-pf2e.mjs');
        game.storyframe.gmSidebar = new GMSidebarAppPF2e();
      } else if (system === 'dnd5e') {
        const { GMSidebarAppDND5e } = await import('./scripts/applications/gm-sidebar/gm-sidebar-dnd5e.mjs');
        game.storyframe.gmSidebar = new GMSidebarAppDND5e();
      } else if (system === 'daggerheart') {
        const { GMSidebarAppDaggerheart } = await import('./scripts/applications/gm-sidebar/gm-sidebar-daggerheart.mjs');
        game.storyframe.gmSidebar = new GMSidebarAppDaggerheart();
      } else {
        const { GMSidebarAppBase } = await import('./scripts/applications/gm-sidebar/gm-sidebar-base.mjs');
        game.storyframe.gmSidebar = new GMSidebarAppBase();
      }
    }
    const sidebar = game.storyframe.gmSidebar;

    const { requestSkillCheck } = await import('./scripts/applications/gm-sidebar/managers/skill-check-handlers.mjs');
    // Each subscriber sends only its own check
    sidebar.currentDC = dc;
    sidebar.secretRollEnabled = isSecret;
    await requestSkillCheck(sidebar, skillSlug, selectedIds, actionSlug, false, checkType, batchGroupId, allowOnlyOne, null, isSecret);
  }, { capture: true });
}

/**
 * Setup global listener for D&D 5e inline check "Request Roll" buttons
 * Intercepts the native enricher button and routes through StoryFrame's roll tracking
 */
function setupDND5eRequestRollIntegration() {
  document.addEventListener('click', async (event) => {
    if (!game.user.isGM) return;

    // Only intercept D&D 5e "Request Roll" buttons
    const requestBtn = event.target.closest('a.enricher-action[data-action="request"]');
    if (!requestBtn) return;

    const groupElement = requestBtn.closest('span.roll-link-group');
    if (!groupElement) return;

    // Prevent D&D 5e's native request behavior
    event.preventDefault();
    event.stopImmediatePropagation();

    const isSave = groupElement.dataset.type === 'save';
    const checkType = isSave ? 'save' : 'skill';
    // For saves use data-ability; for skills prefer data-skill, fall back to data-ability
    const rawSlug = isSave
      ? groupElement.dataset.ability
      : (groupElement.dataset.skill || groupElement.dataset.ability);
    const dc = parseInt(groupElement.dataset.dc);

    if (!rawSlug) return;

    // Handle pipe-separated skills (e.g., "acr|ath")
    const slugs = rawSlug.split('|').map(s => s.trim().toLowerCase());

    const checks = slugs.map(slug => ({
      skillName: slug,
      skillSlug: slug,
      dc: isNaN(dc) ? null : dc,
      isSecret: false,
      checkType,
    }));

    // Subscribe to (or open) the singleton roll request dialog
    const { RollRequestDialog } = await import('./scripts/applications/roll-request-dialog.mjs');
    const { getAllPlayerPCs } = await import('./scripts/system-adapter.mjs');
    const pcs = await getAllPlayerPCs();
    if (!RollRequestDialog._instance && pcs.length === 0) {
      ui.notifications.warn('No player-owned characters found in the world.');
      return;
    }

    const result = await RollRequestDialog.subscribe(checks, pcs);

    const selectedIds = result?.selectedIds || result || [];
    const allowOnlyOne = result?.allowOnlyOne || false;
    const batchGroupId = result?.batchGroupId ?? null;
    if (!selectedIds || selectedIds.length === 0) return;

    // Need a sidebar instance for requestSkillCheck (used for DC/secret state)
    if (!game.storyframe.gmSidebar) {
      const { GMSidebarAppDND5e } = await import('./scripts/applications/gm-sidebar/gm-sidebar-dnd5e.mjs');
      game.storyframe.gmSidebar = new GMSidebarAppDND5e();
    }
    const sidebar = game.storyframe.gmSidebar;

    const { requestSkillCheck } = await import('./scripts/applications/gm-sidebar/managers/skill-check-handlers.mjs');

    if (!isNaN(dc)) {
      sidebar.currentDC = dc;
      const dcInput = sidebar.element?.querySelector('#dc-input');
      if (dcInput) dcInput.value = dc;
    }

    for (const check of checks) {
      await requestSkillCheck(sidebar, check.skillSlug, selectedIds, null, false, check.checkType, batchGroupId, allowOnlyOne, null, false);
    }
  }, { capture: true });
}

/**
 * Setup global Ctrl+click listener for inline damage roll links.
 * Opens the Target Selector dialog so the GM can pick targets before rolling.
 */
function setupDamageRollTargetInterception() {
  document.addEventListener('click', async (event) => {
    // Only intercept when Ctrl/Cmd is held
    if (!event.ctrlKey && !event.metaKey) return;
    if (!game.user.isGM) return;

    const rollLink = event.target.closest('a.inline-roll[data-damage-roll]');
    if (!rollLink) return;

    // Prevent the default roll from firing
    event.preventDefault();
    event.stopImmediatePropagation();

    const formula = rollLink.dataset.formula;
    const flavor = rollLink.dataset.flavor || rollLink.dataset.tooltipText || '';
    if (!formula) return;

    const { TargetSelectorDialog } = await import('./scripts/applications/target-selector-dialog.mjs');
    const result = await TargetSelectorDialog.open({ formula, flavor });
    if (!result) return;

    // Apply FoundryVTT targeting
    game.user.targets.forEach((t) => t.setTarget(false, { releaseOthers: false }));
    for (const id of result.tokenIds) {
      canvas.tokens?.get(id)?.setTarget(true, { releaseOthers: false });
    }

    // Re-dispatch a plain click (no Ctrl) so the system rolls normally
    rollLink.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }, { capture: true });
}

// Hook: init (register settings, CONFIG)
Hooks.once('init', () => {

  // Create namespace if it doesn't exist (socketlib.ready may fire first)
  if (!game.storyframe) {
    game.storyframe = {
      stateManager: null,
      socketManager: null,
      gmSidebar: null,
      playerSidebar: null,
    };
  }

  // Register settings (must be in init hook)
  game.settings.register(MODULE_ID, 'debug', {
    name: 'Debug Mode',
    hint: 'Enable debug logging to console',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, 'gmWindowPosition', {
    name: 'GM Window Position',
    scope: 'client',
    config: false,
    type: Object,
    default: {},
  });

  game.settings.register(MODULE_ID, 'playerViewerPosition', {
    scope: 'client',
    config: false,
    type: Object,
    default: {},
  });

  game.settings.register(MODULE_ID, 'playerViewerLayout', {
    scope: 'client',
    config: false,
    type: String,
    default: 'grid',
    choices: {
      grid: 'Grid',
      list: 'List',
      horizontal: 'Horizontal',
    },
  });

  game.settings.register(MODULE_ID, 'gmWindowMinimized', {
    scope: 'client',
    config: false,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, 'favoriteJournals', {
    scope: 'client',
    config: false,
    type: Array,
    default: [],
  });

  game.settings.register(MODULE_ID, 'gmSidebarPosition', {
    scope: 'client',
    config: false,
    type: Object,
    default: {},
  });

  game.settings.register(MODULE_ID, 'gmSidebarMinimized', {
    scope: 'client',
    config: false,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, 'gmSidebarVisible', {
    scope: 'client',
    config: false,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, 'autoOpenSidebar', {
    name: 'Auto-Open Sidebar',
    hint: 'Automatically open the sidebar when opening a journal',
    scope: 'client',
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, 'playerViewerMinimized', {
    scope: 'client',
    config: false,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, 'dcPresets', {
    scope: 'world',
    config: false,
    type: Array,
    default: [],
  });

  game.settings.register(MODULE_ID, 'challengeLibrary', {
    scope: 'world',
    config: false,
    type: Array,
    default: [],
  });

  game.settings.register(MODULE_ID, 'speakerScenes', {
    scope: 'world',
    config: false,
    type: Array,
    default: [],
  });

  game.settings.register(MODULE_ID, 'moduleVersion', {
    scope: 'client',
    config: false,
    type: String,
    default: '',
  });

  game.settings.register(MODULE_ID, 'gmWindowWasOpen', {
    scope: 'client',
    config: false,
    type: Boolean,
    default: false,
  });

  // System-specific default skills
  const defaultSkills = game.system.id === 'dnd5e'
    ? 'prc,ins,ste,per,inv,ath'     // D&D 5e: Perception, Insight, Stealth, Persuasion, Investigation, Athletics
    : game.system.id === 'daggerheart'
      ? 'agi,str,fin,ins,pre,kno'   // Daggerheart: all 6 traits
      : 'per,dec,dip,itm,ste,prf';  // PF2e: Perception, Deception, Diplomacy, Intimidation, Stealth, Performance

  game.settings.register(MODULE_ID, 'quickButtonSkills', {
    name: 'Quick Button Skills',
    hint: 'Configure via the gear icon in the GM Sidebar skill buttons area',
    scope: 'world',
    config: false, // Configured via UI in GM Sidebar
    type: String,
    default: defaultSkills,
    onChange: () => {
      // Re-render GM sidebar if open
      game.storyframe.gmSidebar?.render();
    },
  });

  game.settings.register(MODULE_ID, 'skillOrderByCategory', {
    name: 'Skill Order By Category',
    hint: 'Custom order of skills within each category (drag to reorder in GM Sidebar)',
    scope: 'world',
    config: false,
    type: Object,
    default: {},
  });

  game.settings.register(MODULE_ID, 'skillCategoryOrder', {
    name: 'Skill Category Order',
    hint: 'Custom order of skill categories (drag category labels to reorder in GM Sidebar)',
    scope: 'world',
    config: false,
    type: Array,
    default: [],
  });

  // Register keybindings
  game.keybindings.register(MODULE_ID, 'requestRollFromSelection', {
    name: 'Request Roll from Journal Selection',
    hint: 'Select text in a journal containing skill checks and press this key to open the roll request dialog',
    editable: [],
    onDown: async () => {
      if (!game.user.isGM) return false;

      const sidebar = game.storyframe?.gmSidebar;
      if (!sidebar) {
        ui.notifications.warn('Open GM Sidebar first (click book icon in token controls)');
        return false;
      }

      // Get selected range from active window
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        ui.notifications.warn('No text selected');
        return false;
      }

      const range = selection.getRangeAt(0);
      if (range.collapsed) {
        ui.notifications.warn('No text selected');
        return false;
      }

      // Create a temporary container with the selected HTML
      const fragment = range.cloneContents();
      const tempContainer = document.createElement('div');
      tempContainer.appendChild(fragment);

      // Enrich checks in the selected content
      const { enrichChecks } = await import('./scripts/check-enricher.mjs');
      enrichChecks(tempContainer);

      // Parse checks from the enriched content
      const checks = sidebar._parseChecksFromContent(tempContainer);

      // Clean up temp container
      tempContainer.remove();

      if (checks.length === 0) {
        ui.notifications.warn('No skill checks found in selected text');
        return false;
      }

      // Get all player PCs for the dialog
      const { getAllPlayerPCs } = await import('./scripts/system-adapter.mjs');
      const pcs = await getAllPlayerPCs();
      if (pcs.length === 0) {
        ui.notifications.warn('No player-owned characters found in the world.');
        return false;
      }

      // Subscribe to (or open) the singleton roll request dialog
      const { RollRequestDialog } = await import('./scripts/applications/roll-request-dialog.mjs');
      const result = await RollRequestDialog.subscribe(checks, pcs);

      const selectedIds = result?.selectedIds || result || [];
      const allowOnlyOne = result?.allowOnlyOne || false;
      const batchGroupId = result?.batchGroupId ?? null;

      if (!selectedIds || selectedIds.length === 0) {
        return true;
      }

      // Import requestSkillCheck function
      const { requestSkillCheck } = await import('./scripts/applications/gm-sidebar/managers/skill-check-handlers.mjs');
      const SystemAdapter = await import('./scripts/system-adapter.mjs');

      // Send roll requests for each surviving check (respects per-row removals in the dialog)
      for (const check of (result.checks || [])) {
        // Map skill name to slug using SystemAdapter
        const skillSlug = SystemAdapter.getSkillSlugFromName(check.skillName) || check.skillName.toLowerCase();

        // Set DC
        sidebar.currentDC = check.dc;
        const dcInput = sidebar.element.querySelector('#dc-input');
        if (dcInput) dcInput.value = check.dc;

        // Set secret roll toggle
        sidebar.secretRollEnabled = check.isSecret;

        // Determine check type
        const checkType = check.checkType || 'skill';

        // Send request with check type and allow-only-one support
        await requestSkillCheck(sidebar, skillSlug, selectedIds, null, false, checkType, batchGroupId, allowOnlyOne);
      }

      return true;
    },
  });

  game.keybindings.register(MODULE_ID, 'createChallengeFromSelection', {
    name: 'Create Challenge from Journal Selection',
    hint: 'Select text in a journal containing skill checks and press this key to create a new challenge',
    editable: [],
    onDown: async () => {
      if (!game.user.isGM) return false;

      const sidebar = game.storyframe?.gmSidebar;
      if (!sidebar) {
        ui.notifications.warn('Open GM Sidebar first (click users icon in token controls)');
        return false;
      }

      // Get selected range from active window
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        ui.notifications.warn('No text selected');
        return false;
      }

      const range = selection.getRangeAt(0);
      if (range.collapsed) {
        ui.notifications.warn('No text selected');
        return false;
      }

      // Create a temporary container with the selected HTML
      const fragment = range.cloneContents();
      const tempContainer = document.createElement('div');
      tempContainer.appendChild(fragment);

      // Enrich checks in the selected content
      const { enrichChecks } = await import('./scripts/check-enricher.mjs');
      enrichChecks(tempContainer);

      // Parse checks from the enriched content
      const checks = sidebar._parseChecksFromContent(tempContainer);

      // Clean up temp container
      tempContainer.remove();

      if (checks.length === 0) {
        ui.notifications.warn('No skill checks found in selected text');
        return false;
      }

      // Prompt for challenge name
      const challengeName = await foundry.applications.api.DialogV2.prompt({
        window: { title: 'Create Challenge' },
        content: '<p>Enter a name for this challenge:</p><input type="text" name="challengeName" autofocus>',
        ok: {
          label: 'Create',
          callback: (_event, button, _dialog) => button.form.elements.challengeName.value,
        },
        rejectClose: false,
      });

      if (!challengeName) return true;

      // Import SystemAdapter
      const SystemAdapter = await import('./scripts/system-adapter.mjs');

      // Create options from checks - each check becomes an option
      const options = checks.map((check) => {
        // Map skill name to short slug for the challenge system
        const skillSlug = SystemAdapter.getSkillSlugFromName(check.skillName) || check.skillName;

        return {
          id: foundry.utils.randomID(),
          skillOptions: [{
            skill: skillSlug || check.skillName,
            dc: check.dc,
            action: null,
            isSecret: check.isSecret || false,
          }],
        };
      });

      // Create challenge template
      const template = {
        id: foundry.utils.randomID(),
        name: challengeName,
        image: null,
        options,
        createdAt: Date.now(),
      };

      // Save to library
      const savedChallenges = game.settings.get(MODULE_ID, 'challengeLibrary') || [];
      savedChallenges.push(template);
      await game.settings.set(MODULE_ID, 'challengeLibrary', savedChallenges);

      ui.notifications.info(`Challenge "${challengeName}" created with ${checks.length} check(s)`);

      return true;
    },
  });

  game.keybindings.register(MODULE_ID, 'speakerWheel', {
    name: 'Speaker Selection Wheel',
    hint: 'Hold to show radial speaker selection wheel',
    editable: [],
    onDown: async () => {
      if (!game.user.isGM) return false;
      const { showSpeakerWheel } = await import('./scripts/speaker-wheel.mjs');
      await showSpeakerWheel();
      return true;
    },
    onUp: async () => {
      if (!game.user.isGM) return false;
      const { hideSpeakerWheel } = await import('./scripts/speaker-wheel.mjs');
      hideSpeakerWheel();
      return true;
    },
  });
});

// Hook: setup (Documents available, settings readable)
Hooks.once('setup', () => {
  game.storyframe.stateManager = new StateManager();

  // If socketlib already loaded, initialize now
  if (game.storyframe.socketManager) {
    game.storyframe.stateManager.initialize(game.storyframe.socketManager);
    game.storyframe.initialized = true;
  }
});

// Hook: socketlib.ready (register socket functions)
Hooks.once('socketlib.ready', () => {

  // Defensive: socketlib.ready can fire before init in v13
  if (!game.storyframe) {
    game.storyframe = {
      stateManager: null,
      socketManager: null,
      gmSidebar: null,
    };
  }

  game.storyframe.socketManager = new SocketManager();

  // Initialize StateManager with SocketManager
  if (game.storyframe.stateManager) {
    game.storyframe.stateManager.initialize(game.storyframe.socketManager);
    game.storyframe.initialized = true;
  } else {
    console.warn(`${MODULE_ID} | StateManager not available in socketlib.ready`);
  }
});

// Hook: getSceneControlButtons (register buttons)
Hooks.on('getSceneControlButtons', (controls) => {

  if (!controls.tokens) {
    console.warn(`${MODULE_ID} | tokens controls not found`);
    return;
  }

  // v13: tools is an object, not array - use property assignment
  if (!controls.tokens.tools) controls.tokens.tools = {};

  // Player button (non-GM only)
  if (!game.user?.isGM) {
    controls.tokens.tools.storyframe = {
      name: 'storyframe',
      title: 'StoryFrame Viewer',
      icon: 'fas fa-book-open',
      visible: true,
      button: true,
      onChange: (isActive) => {
        // Immediately deactivate to allow repeated clicks
        if (isActive) {
          setTimeout(() => {
            const controls = ui.controls.controls;
            const control = controls?.get?.('tokens') ?? controls?.find?.(c => c.name === 'tokens');
            if (control) control.activeTool = null;
          }, 50);
        }
        const state = game.storyframe.stateManager?.getState();
        const hasSpeakers = state?.speakers?.length > 0;
        const hasContent = PlayerViewerApp.hasPlayerRelevantContent(state, game.user.id);

        // Open viewer if there are speakers
        if (hasSpeakers) {
          if (!game.storyframe?.playerViewer) {
            game.storyframe.playerViewer = new PlayerViewerApp();
          }
          const viewer = game.storyframe.playerViewer;
          const sidebar = game.storyframe.playerSidebar;
          const sidebarWasRendered = sidebar?.rendered;

          // Always render viewer when speakers exist, even if sidebar is open
          if (!viewer.rendered) {
            viewer.render(true);
            // If sidebar is already open, reposition it next to viewer
            if (sidebarWasRendered && sidebar) {
              setTimeout(() => sidebar._positionAsDrawer(3), 100);
            }
          } else {
            viewer.bringToTop();
          }
          return;
        }

        // Open sidebar if there's content but no speakers
        if (hasContent && game.storyframe?.playerSidebar) {
          if (!game.storyframe.playerSidebar.rendered) {
            game.storyframe.playerSidebar.render(true);
          }
          return;
        }

        // No content at all
        ui.notifications.info(game.i18n.localize('STORYFRAME.Notifications.NoContent'));
      },
    };
  }

  // GM button (GM only)
  if (game.user?.isGM) {
    controls.tokens.tools.storyframe_gm = {
      name: 'storyframe_gm',
      title: 'StoryFrame GM Sidebar',
      icon: 'fas fa-book-open',
      visible: true,
      button: true,
      onChange: async (isActive) => {
        // Only act on activation
        if (!isActive) return;

        // Create sidebar if it doesn't exist
        if (!game.storyframe.gmSidebar) {
          const system = game.system.id;

          if (system === 'pf2e') {
            const { GMSidebarAppPF2e } = await import('./scripts/applications/gm-sidebar/gm-sidebar-pf2e.mjs');
            game.storyframe.gmSidebar = new GMSidebarAppPF2e();
          } else if (system === 'dnd5e') {
            const { GMSidebarAppDND5e } = await import('./scripts/applications/gm-sidebar/gm-sidebar-dnd5e.mjs');
            game.storyframe.gmSidebar = new GMSidebarAppDND5e();
          } else if (system === 'daggerheart') {
            const { GMSidebarAppDaggerheart } = await import('./scripts/applications/gm-sidebar/gm-sidebar-daggerheart.mjs');
            game.storyframe.gmSidebar = new GMSidebarAppDaggerheart();
          } else {
            const { GMSidebarAppBase } = await import('./scripts/applications/gm-sidebar/gm-sidebar-base.mjs');
            game.storyframe.gmSidebar = new GMSidebarAppBase();
          }
        }

        const sidebar = game.storyframe.gmSidebar;

        // Toggle sidebar visibility
        if (sidebar.rendered) {
          sidebar.close();
        } else {
          // Clear parent interface to open standalone
          sidebar.parentInterface = null;
          sidebar.render(true);
          game.settings.set(MODULE_ID, 'gmSidebarVisible', true);
        }
      },
    };
  }
});

// Hook: ready (UI operations, everything loaded)
Hooks.once('ready', async () => {
  if (!game.storyframe?.stateManager) {
    console.error(`${MODULE_ID} | StateManager not initialized`);
    return;
  }

  // Wait for socketlib initialization if needed
  if (!game.storyframe.initialized) {
    console.warn(`${MODULE_ID} | Waiting for socketlib initialization...`);
    const maxWait = 5000; // 5 second timeout
    const startTime = Date.now();
    await new Promise((resolve) => {
      const checkInit = setInterval(() => {
        if (game.storyframe.initialized) {
          clearInterval(checkInit);
          console.log(`${MODULE_ID} | Initialization complete`);
          resolve();
        } else if (Date.now() - startTime > maxWait) {
          clearInterval(checkInit);
          console.error(`${MODULE_ID} | Initialization timeout - proceeding anyway`);
          resolve(); // Continue anyway
        }
      }, 100);
    });
  }

  await game.storyframe.stateManager.load();

  // Initialize mouse tracking for speaker wheel positioning
  const { initMouseTracking } = await import('./scripts/speaker-wheel.mjs');
  initMouseTracking();

  // Setup inline check integrations (GM only)
  if (game.user.isGM) {
    if (game.system.id === 'pf2e') {
      setupPF2eRepostIntegration();
    } else if (game.system.id === 'dnd5e') {
      setupDND5eRequestRollIntegration();
    }
    // Daggerheart: no native "Request Roll" button integration needed
  }

  // Setup damage roll target interception (GM only, all systems)
  if (game.user.isGM) {
    setupDamageRollTargetInterception();
  }

  // Migration: Detect and perform migration from 1.x to 2.x
  const oldVersion = game.settings.get(MODULE_ID, 'moduleVersion');
  const currentVersion = game.modules.get(MODULE_ID).version;

  if (!oldVersion || oldVersion.startsWith('1.')) {
    // Clean up deprecated settings
    try {
      await game.settings.set(MODULE_ID, 'gmWindowPosition', {});
      await game.settings.set(MODULE_ID, 'gmWindowMinimized', false);
      await game.settings.set(MODULE_ID, 'favoriteJournals', []);
      await game.settings.set(MODULE_ID, 'gmWindowWasOpen', false);
    } catch (e) {
      console.warn(`${MODULE_ID} | Migration cleanup warning:`, e);
    }

    await game.settings.set(MODULE_ID, 'moduleVersion', currentVersion);
  }

  // Migration: Add stealth to quick skills if missing (added in later update)
  if (game.user.isGM) {
    const quickSkills = game.settings.get(MODULE_ID, 'quickButtonSkills');
    if (quickSkills && !quickSkills.includes('ste')) {
      const skills = quickSkills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      // Insert stealth after intimidation if present, otherwise at end
      const itmIndex = skills.indexOf('itm');
      if (itmIndex !== -1) {
        skills.splice(itmIndex + 1, 0, 'ste');
      } else {
        skills.push('ste');
      }
      await game.settings.set(MODULE_ID, 'quickButtonSkills', skills.join(','));
    }
  }

  // Initialize player viewer and sidebar for non-GM users
  if (!game.user.isGM) {
    game.storyframe.playerViewer = new PlayerViewerApp();
    game.storyframe.playerSidebar = new PlayerSidebarApp();
    game.storyframe.playerSidebar.parentViewer = game.storyframe.playerViewer;

    // Check if sidebar should open based on content
    const state = game.storyframe.stateManager?.getState();
    const hasContent = state && PlayerViewerApp.hasPlayerRelevantContent(state, game.user.id);
    if (hasContent) {
      game.storyframe.playerSidebar.render(true);
    }
  }
});

// Hook: canvasReady (scene change - clear pending rolls)
Hooks.on('canvasReady', () => {
  // Clear pending rolls on scene change
  if (game.user.isGM && game.storyframe.stateManager?.rollTracker) {
    game.storyframe.stateManager.clearPendingRolls();
  }
});

// Hook: updateScene (listen for flag changes on all clients)
Hooks.on('updateScene', async (scene, changed, _options, _userId) => {
  // Only current scene
  if (scene.id !== game.scenes.current?.id) return;

  // Only storyframe flags
  if (!changed.flags?.storyframe) return;


  // Reload state
  await game.storyframe.stateManager.load();
  const state = game.storyframe.stateManager.getState();

  // Update GM sidebar if open
  if (game.user.isGM) {
    if (game.storyframe.gmSidebar?.rendered) {
      game.storyframe.gmSidebar.render();
    }
  }

  // Update player viewer
  if (!game.user.isGM && game.storyframe.playerViewer) {
    const viewer = game.storyframe.playerViewer;
    const hasSpeakers = state?.speakers?.length > 0;

    if (hasSpeakers && !viewer.rendered) {
      viewer.render(true); // Auto-open when speakers added
    } else if (!hasSpeakers && viewer.rendered) {
      viewer.close(); // Close if no speakers
    } else if (viewer.rendered) {
      viewer.render(); // Update display
    }
  }

  // Update player sidebar independently
  if (!game.user.isGM && game.storyframe.playerSidebar) {
    const sidebar = game.storyframe.playerSidebar;
    const hasContent = PlayerViewerApp.hasPlayerRelevantContent(state, game.user.id);

    if (hasContent && !sidebar.rendered) {
      sidebar.render(true); // Auto-open when player has rolls/challenges
    } else if (!hasContent && sidebar.rendered) {
      sidebar.close(); // Close if no content
    } else if (sidebar.rendered) {
      sidebar.render(); // Update display
    }
  }
});

// Hook: renderJournalSheet (handle all journal types)
Hooks.on('renderJournalSheet', handleJournalRender);
Hooks.on('renderJournalEntrySheet', handleJournalRender);
Hooks.on('renderJournalEntrySheet5e', handleJournalRender);
Hooks.on('renderMetaMorphicJournalEntrySheet', handleJournalRender);
// Hook: renderJournalEntryPageProseMirrorSheet (Daggerheart - fires per page render)
Hooks.on('renderJournalEntryPageProseMirrorSheet', handleDaggerheartPageRender);

// Hook: closeJournalSheet (handle sidebar reattachment)
Hooks.on('closeJournalSheet', handleJournalClose);
Hooks.on('closeJournalEntrySheet5e', handleJournalClose);

// Hook: Manage player sidebar lifecycle with player viewer
Hooks.on('renderPlayerViewerApp', handlePlayerViewerRender);
Hooks.on('closePlayerViewerApp', handlePlayerViewerClose);

// Hook: updateSetting - rerender GM sidebar when challenge library changes
Hooks.on('updateSetting', (setting, _value, _options, _userId) => {
  if (setting.key === 'storyframe.challengeLibrary' && game.user.isGM) {
    if (game.storyframe?.gmSidebar?.rendered) {
      game.storyframe.gmSidebar.render();
    }
  }
});

// Hook: closeCheckModifiersDialog - detect if roll was made or cancelled
Hooks.on('closeCheckModifiersDialog', async (_dialog, _html) => {
  // Only on player side
  if (game.user.isGM) return;
  if (!window._storyframeCurrentBlindRoll) return;

  // Wait for chat message to be created
  setTimeout(async () => {
    if (!window._storyframeCurrentBlindRoll) return;

    const { requestId, actorId } = window._storyframeCurrentBlindRoll;

    // Check if a blind chat message was created in the last second from this actor
    const recentMessage = game.messages.contents.reverse().find((msg) => {
      const timeDiff = Date.now() - msg.timestamp;
      return timeDiff < 1000 &&
        msg.speaker?.actor === actorId &&
        (msg.whisper?.length > 0 || msg.blind);
    });

    if (recentMessage) {
      await game.storyframe.socketManager.notifyBlindRollExecuted({
        requestId,
        actorId,
        timestamp: Date.now(),
      });
    }

    window._storyframeCurrentBlindRoll = null;
  }, 100);
});
