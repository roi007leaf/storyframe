import { StateManager } from './scripts/state-manager.mjs';
import { SocketManager } from './scripts/socket-manager.mjs';
import { GMInterfaceApp } from './scripts/applications/gm-interface.mjs';
import { GMSidebarApp } from './scripts/applications/gm-sidebar.mjs';
import { PlayerViewerApp } from './scripts/applications/player-viewer.mjs';

// Module constants
const MODULE_ID = 'storyframe';

/**
 * Validate window position to ensure it's visible on screen
 * Clamps to visible screen bounds
 */
export function validatePosition(saved) {
  return {
    top: Math.max(0, Math.min(saved.top || 0, window.innerHeight - 50)),
    left: Math.max(0, Math.min(saved.left || 0, window.innerWidth - 100)),
    width: Math.max(200, Math.min(saved.width || 400, window.innerWidth)),
    height: Math.max(150, Math.min(saved.height || 300, window.innerHeight)),
  };
}

// Hook: init (register settings, CONFIG)
Hooks.once('init', () => {
  console.log(`${MODULE_ID} | Initializing`);

  // Create namespace if it doesn't exist (socketlib.ready may fire first)
  if (!game.storyframe) {
    game.storyframe = {
      stateManager: null,
      socketManager: null,
      gmApp: null,
      gmSidebar: null,
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

  game.settings.register(MODULE_ID, 'playerViewerMinimized', {
    scope: 'client',
    config: false,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, 'gmWindowWasOpen', {
    scope: 'client',
    config: false,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, 'quickButtonSkills', {
    name: 'Quick Button Skills',
    hint: 'Configure via the gear icon in the GM Sidebar skill buttons area',
    scope: 'world',
    config: false, // Configured via UI in GM Sidebar
    type: String,
    default: 'per,dec,dip,itm,ste,prf',
    onChange: () => {
      // Re-render GM sidebar if open
      game.storyframe.gmSidebar?.render();
    },
  });

  // Register keybindings
  game.keybindings.register(MODULE_ID, 'toggleStoryFrame', {
    name: 'Toggle StoryFrame',
    hint: 'Show or hide the StoryFrame window',
    editable: [{ key: 'KeyS', modifiers: ['Control', 'Shift'] }],
    onDown: () => {
      if (game.user.isGM) {
        // Toggle GM interface and sidebar together
        if (!game.storyframe?.gmApp) {
          game.storyframe.gmApp = new GMInterfaceApp();
        }
        if (!game.storyframe?.gmSidebar) {
          game.storyframe.gmSidebar = new GMSidebarApp();
        }
        if (game.storyframe.gmApp.rendered) {
          game.storyframe.gmApp.close();
          game.storyframe.gmSidebar.close();
        } else {
          game.storyframe.gmApp.render(true);
          game.storyframe.gmSidebar.render(true);
        }
      } else {
        // Toggle player viewer
        if (!game.storyframe?.playerViewer) {
          game.storyframe.playerViewer = new PlayerViewerApp();
        }
        if (game.storyframe.playerViewer.rendered) {
          game.storyframe.playerViewer.close();
        } else {
          game.storyframe.playerViewer.render(true);
        }
      }
      return true; // Consume the event
    },
    restricted: false, // Available to all users
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL,
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
      gmApp: null,
      gmSidebar: null,
    };
  }

  game.storyframe.socketManager = new SocketManager();
});

// Hook: getSceneControlButtons (register buttons)
Hooks.on('getSceneControlButtons', (controls) => {
  console.log(`${MODULE_ID} | getSceneControlButtons fired, isGM:`, game.user?.isGM);
  console.log(`${MODULE_ID} | Available controls:`, Object.keys(controls));

  if (!controls.tokens) {
    console.warn(`${MODULE_ID} | tokens controls not found`);
    return;
  }

  // v13: tools is an object, not array - use property assignment
  if (!controls.tokens.tools) controls.tokens.tools = {};

  // GM button (GM only)
  if (game.user?.isGM) {
    controls.tokens.tools.storyframe = {
      name: 'storyframe',
      title: 'StoryFrame',
      icon: 'fas fa-book-open',
      visible: true,
      onClick: () => {
        if (!game.storyframe?.gmApp) {
          game.storyframe.gmApp = new GMInterfaceApp();
        }
        if (!game.storyframe?.gmSidebar) {
          game.storyframe.gmSidebar = new GMSidebarApp();
        }
        game.storyframe.gmApp.render(true);
        game.storyframe.gmSidebar.render(true);
      },
      button: true,
    };
    console.log(`${MODULE_ID} | Added GM button`);
  }

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
    console.log(`${MODULE_ID} | Added Player button`);
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
      console.log(`${MODULE_ID} | Added stealth to quick skills`);
    }
  }

  // GM window only opens when button is pressed (no auto-open)

  // Initialize player viewer for non-GM users
  if (!game.user.isGM) {
    game.storyframe.playerViewer = new PlayerViewerApp();

    // Auto-open if there are speakers (gallery shows all, not just active)
    const state = game.storyframe.stateManager.getState();
    if (state?.speakers?.length > 0) {
      game.storyframe.playerViewer.render(true);
    }
  }
});

// Hook: canvasReady (scene change - clear pending rolls)
Hooks.on('canvasReady', () => {
  // Clear pending rolls on scene change
  if (game.user.isGM && game.storyframe.stateManager) {
    game.storyframe.stateManager.clearPendingRolls();
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

  // Update GM interface and sidebar if open
  if (game.user.isGM) {
    if (game.storyframe.gmApp?.rendered) {
      game.storyframe.gmApp.render();
    }
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

// Hook: updateJournalEntry (watch for journal content changes)
Hooks.on('updateJournalEntry', async (journal, changed, options, userId) => {
  const state = game.storyframe.stateManager.getState();
  if (journal.uuid !== state?.activeJournal) return;

  // Clear cache for updated journal
  if (game.storyframe.gmApp?.cssScraper) {
    game.storyframe.gmApp.cssScraper.clearCache(journal.uuid);
  }

  // Re-scrape and inject
  if (game.user.isGM && game.storyframe.gmApp?.rendered) {
    await game.storyframe.gmApp._updateJournalStyles(journal.uuid);
  }
});

// Hook: closeJournalSheet (watch for editor closing after edits)
Hooks.on('closeJournalSheet', async (sheet, html) => {
  const state = game.storyframe.stateManager.getState();
  if (sheet.document.uuid !== state?.activeJournal) return;

  // Clear cache - styles may have changed
  if (game.storyframe.gmApp?.cssScraper) {
    game.storyframe.gmApp.cssScraper.clearCache(sheet.document.uuid);
  }

  // Re-scrape with delay to ensure stylesheets detached/updated
  setTimeout(async () => {
    if (game.user.isGM && game.storyframe.gmApp?.rendered) {
      await game.storyframe.gmApp._updateJournalStyles(sheet.document.uuid);
    }
  }, 200);
});
