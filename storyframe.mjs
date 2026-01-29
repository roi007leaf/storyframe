import { StateManager } from './scripts/state-manager.mjs';
import { SocketManager } from './scripts/socket-manager.mjs';

// Module constants
const MODULE_ID = 'storyframe';

// Hook: init (register settings, CONFIG)
Hooks.once('init', () => {
  console.log(`${MODULE_ID} | Initializing`);

  // Create namespace for module
  game.storyframe = {
    stateManager: null,
    socketManager: null
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

// Hook: ready (UI operations, everything loaded)
Hooks.once('ready', async () => {
  console.log(`${MODULE_ID} | Ready`);
  await game.storyframe.stateManager.load();
  // GM control button added in Phase 2
});
