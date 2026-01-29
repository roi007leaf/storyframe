import { StateManager } from './scripts/state-manager.mjs';
import { SocketManager } from './scripts/socket-manager.mjs';
import { GMInterfaceApp } from './scripts/applications/gm-interface.mjs';
import { PlayerViewerApp } from './scripts/applications/player-viewer.mjs';

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

  game.settings.register(MODULE_ID, 'playerViewerPosition', {
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

  // Player button (non-GM only)
  if (!game.user?.isGM && controls.tokens) {
    if (!controls.tokens.tools) controls.tokens.tools = {};
    controls.tokens.tools.storyframePlayer = {
      name: 'storyframe-player',
      title: 'StoryFrame Viewer',
      icon: 'fas fa-user',
      visible: true,
      onClick: () => {
        if (!game.storyframe?.playerViewer) {
          game.storyframe.playerViewer = new PlayerViewerApp();
        }
        game.storyframe.playerViewer.render(true);
      },
      button: true
    };
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

  // Initialize player viewer for non-GM users
  if (!game.user.isGM) {
    game.storyframe.playerViewer = new PlayerViewerApp();

    // Auto-open if activeSpeaker already set
    const state = game.storyframe.stateManager.getState();
    if (state?.activeSpeaker) {
      game.storyframe.playerViewer.render(true);
    }
  }
});

// Hook: updateScene (listen for flag changes on all clients)
Hooks.on('updateScene', async (scene, changed, options, userId) => {
  // Only current scene
  if (scene.id !== game.scenes.current?.id) return;

  // Only storyframe flags
  if (!changed.flags?.storyframe) return;

  console.log(`${MODULE_ID} | Scene flags updated`);

  // Reload state
  await game.storyframe.stateManager.load();
  const state = game.storyframe.stateManager.getState();

  // Update GM interface if open
  if (game.user.isGM && game.storyframe.gmApp?.rendered) {
    game.storyframe.gmApp.render();
  }

  // Update player viewer
  if (!game.user.isGM) {
    const viewer = game.storyframe.playerViewer;
    if (state?.activeSpeaker && !viewer.rendered) {
      viewer.render(true);  // Auto-open
    } else if (!state?.activeSpeaker && viewer.rendered) {
      viewer.close();  // Auto-close
    } else if (viewer.rendered) {
      viewer.render();  // Update display
    }
  }
});
