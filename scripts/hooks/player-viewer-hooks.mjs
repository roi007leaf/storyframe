/**
 * Player Viewer Hooks
 * Handlers for player viewer lifecycle and sidebar management
 */

import { PlayerViewerApp } from '../applications/player-viewer.mjs';

/**
 * Handle player viewer render
 * Opens and positions the player sidebar when viewer opens
 * @param {Object} viewer - The player viewer instance
 */
export function handlePlayerViewerRender(viewer) {
  if (!game.user.isGM && game.storyframe?.playerSidebar) {
    const sidebar = game.storyframe.playerSidebar;
    sidebar.parentViewer = viewer;

    if (!sidebar.rendered) {
      // Check if there's content before rendering to avoid flash
      const state = game.storyframe.stateManager?.getState();
      const hasContent = PlayerViewerApp.hasPlayerRelevantContent(state, game.user.id);

      if (hasContent) {
        sidebar.render(true);
      }
    } else {
      // Delay to ensure viewer element is ready
      setTimeout(() => sidebar._positionAsDrawer(3), 100);
    }
  }
}

/**
 * Handle player viewer close
 * Closes the player sidebar when viewer closes, unless there's still content
 */
export function handlePlayerViewerClose() {
  if (!game.user.isGM && game.storyframe?.playerSidebar?.rendered) {
    const state = game.storyframe.stateManager?.getState();
    const hasContent = PlayerViewerApp.hasPlayerRelevantContent(state, game.user.id);

    // Only close sidebar if there's no content
    if (!hasContent) {
      game.storyframe.playerSidebar.close();
    }
  }
}
