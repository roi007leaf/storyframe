import { StateManager } from './scripts/state-manager.mjs';
import { SocketManager } from './scripts/socket-manager.mjs';
import { GMInterfaceApp } from './scripts/applications/gm-interface.mjs';

// Module constants
const MODULE_ID = 'storyframe';

// Hook: init (register settings, CONFIG)
Hooks.once('init', () => {
  console.log(`${MODULE_ID} | Initializing`);

  // Create namespace if it doesn't exist (socketlib.ready may fire first)
  if (!game.storyframe) {
    game.storyframe = {
      stateManager: null,
      socketManager: null,
      gmApp: null
    };
  }

  // Register settings (must be in init hook)
  game.settings.register(MODULE_ID, 'debug', {
    name: 'Debug Mode',
    hint: 'Enable debug logging to console',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, 'gmWindowPosition', {
    name: 'GM Window Position',
    scope: 'client',
    config: false,
    type: Object,
    default: {}
  });
});

// Hook: setup (Documents available, settings readable)
Hooks.once('setup', () => {
  console.log(`${MODULE_ID} | Setup`);
  game.storyframe.stateManager = new StateManager();
});

// Hook: socketlib.ready (register socket functions)
Hooks.once('socketlib.ready', () => {
  console.log(`${MODULE_ID} | Registering sockets`);

  // Defensive: socketlib.ready can fire before init in v13
  if (!game.storyframe) {
    game.storyframe = {
      stateManager: null,
      socketManager: null,
      gmApp: null
    };
  }

  game.storyframe.socketManager = new SocketManager();
});

// Hook: getSceneControlButtons (register GM button)
Hooks.on('getSceneControlButtons', (controls) => {
  console.log(`${MODULE_ID} | getSceneControlButtons fired, isGM:`, game.user?.isGM);
  console.log(`${MODULE_ID} | Available controls:`, Object.keys(controls));

  if (!game.user?.isGM) return;

  const storyframeControl = {
    name: 'storyframe',
    title: 'StoryFrame',
    icon: 'fas fa-book-open',
    visible: game.user.isGM,
    onClick: () => {
      if (!game.storyframe?.gmApp) {
        game.storyframe.gmApp = new GMInterfaceApp();
      }
      game.storyframe.gmApp.render(true);
    },
    button: true
  };

  // v13 uses object structure with "tokens" (plural)
  console.log(`${MODULE_ID} | controls.tokens exists:`, !!controls.tokens);
  console.log(`${MODULE_ID} | controls.tokens value:`, controls.tokens);

  if (controls.tokens) {
    console.log(`${MODULE_ID} | Inside if block, about to add button`);
    // v13: tools is an object, not array - use property assignment
    if (!controls.tokens.tools) controls.tokens.tools = {};
    controls.tokens.tools.storyframe = storyframeControl;
    console.log(`${MODULE_ID} | Added StoryFrame button to tokens.tools.storyframe`);
  } else {
    console.warn(`${MODULE_ID} | tokens controls not found`);
  }
});

// Hook: ready (UI operations, everything loaded)
Hooks.once('ready', async () => {
  console.log(`${MODULE_ID} | Ready`);
  if (!game.storyframe?.stateManager) {
    console.error(`${MODULE_ID} | StateManager not initialized`);
    return;
  }
  await game.storyframe.stateManager.load();
});
