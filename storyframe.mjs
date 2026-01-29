import { StateManager } from './scripts/state-manager.mjs';
import { SocketManager } from './scripts/socket-manager.mjs';
import { GMInterfaceApp } from './scripts/applications/gm-interface.mjs';

// Module constants
const MODULE_ID = 'storyframe';

// Hook: init (register settings, CONFIG)
Hooks.once('init', () => {
  console.log(`${MODULE_ID} | Initializing`);

  // Create namespace for module
  game.storyframe = {
    stateManager: null,
    socketManager: null,
    gmApp: null
  };

  // Register settings (must be in init hook)
  game.settings.register(MODULE_ID, 'debug', {
    name: game.i18n.localize('STORYFRAME.Settings.Debug'),
    hint: game.i18n.localize('STORYFRAME.Settings.DebugHint'),
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
  game.storyframe.socketManager = new SocketManager();
});

// Hook: getSceneControlButtons (register GM button)
Hooks.on('getSceneControlButtons', (controls) => {
  if (!game.user.isGM) return;

  const storyframeControl = {
    name: 'storyframe',
    title: 'StoryFrame',
    icon: 'fas fa-book-open',
    visible: game.user.isGM,
    onClick: () => {
      if (!game.storyframe.gmApp) {
        game.storyframe.gmApp = new GMInterfaceApp();
      }
      game.storyframe.gmApp.render(true);
    },
    button: true
  };

  const tokens = controls.find(c => c.name === 'token');
  if (tokens) {
    tokens.tools.push(storyframeControl);
  }
});

// Hook: ready (UI operations, everything loaded)
Hooks.once('ready', async () => {
  console.log(`${MODULE_ID} | Ready`);
  await game.storyframe.stateManager.load();
});
