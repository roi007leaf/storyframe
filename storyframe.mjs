import { MODULE_ID } from './scripts/constants.mjs';
import { PlayerSidebarApp } from './scripts/applications/player-sidebar.mjs';
import { PlayerViewerApp } from './scripts/applications/player-viewer.mjs';
import { SocketManager } from './scripts/socket-manager.mjs';
import { StateManager } from './scripts/state-manager.mjs';
import { validatePosition } from './scripts/utils/validation-utils.mjs';
import { handleJournalRender, handleJournalClose } from './scripts/hooks/journal-hooks.mjs';
import { handlePlayerViewerRender, handlePlayerViewerClose } from './scripts/hooks/player-viewer-hooks.mjs';

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
    ? 'prc,ins,ste,per,inv,ath' // D&D 5e: Perception, Insight, Stealth, Persuasion, Investigation, Athletics
    : 'per,dec,dip,itm,ste,prf'; // PF2e: Perception, Deception, Diplomacy, Intimidation, Stealth, Performance

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
});

// Hook: setup (Documents available, settings readable)
Hooks.once('setup', () => {
  console.log(`${MODULE_ID} | setup hook fired`);
  game.storyframe.stateManager = new StateManager();

  // If socketlib already loaded, initialize now
  if (game.storyframe.socketManager) {
    console.log(`${MODULE_ID} | socketlib already ready, initializing managers now`);
    game.storyframe.stateManager.initialize(game.storyframe.socketManager);
    game.storyframe.initialized = true;
  }
});

// Hook: socketlib.ready (register socket functions)
Hooks.once('socketlib.ready', () => {
  console.log(`${MODULE_ID} | socketlib.ready hook fired`);

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
    console.log(`${MODULE_ID} | Managers initialized via socketlib.ready`);
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
      onClick: () => {
        if (!game.storyframe?.playerViewer) {
          game.storyframe.playerViewer = new PlayerViewerApp();
        }
        game.storyframe.playerViewer.render(true);
      },
      button: true,
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
  } else {
    console.log(`${MODULE_ID} | Already initialized`);
  }

  console.log(`${MODULE_ID} | Loading state...`);
  await game.storyframe.stateManager.load();
  console.log(`${MODULE_ID} | State loaded:`, game.storyframe.stateManager.getState());

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

  // Initialize player viewer and sidebar for non-GM users (but don't auto-open)
  if (!game.user.isGM) {
    game.storyframe.playerViewer = new PlayerViewerApp();
    game.storyframe.playerSidebar = new PlayerSidebarApp();
    game.storyframe.playerSidebar.parentViewer = game.storyframe.playerViewer;
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
      viewer.render(true); // Auto-open when first speaker added
    } else if (!hasSpeakers && viewer.rendered) {
      viewer.close(); // Close only if NO speakers (not just no active speaker)
    } else if (viewer.rendered) {
      viewer.render(); // Update display
    }
  }
});

// Hook: renderJournalSheet (handle all journal types)
Hooks.on('renderJournalSheet', handleJournalRender);
Hooks.on('renderJournalEntrySheet5e', handleJournalRender);
Hooks.on('renderMetaMorphicJournalEntrySheet', handleJournalRender);

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
