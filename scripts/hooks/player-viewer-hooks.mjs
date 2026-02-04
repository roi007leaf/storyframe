/**
 * Player Viewer Hooks
 * Handlers for player viewer lifecycle and sidebar management
 */

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
      sidebar.render(true);
    } else {
      sidebar._positionAsDrawer(3);
    }
  }
}

/**
 * Handle player viewer close
 * Closes the player sidebar when viewer closes
 */
export function handlePlayerViewerClose() {
  if (!game.user.isGM && game.storyframe?.playerSidebar?.rendered) {
    game.storyframe.playerSidebar.close();
  }
}
