import { MODULE_ID } from './constants.mjs';

/**
 * Manages socket communication using socketlib.
 * All state mutations route through GM via executeAsGM.
 */
export class SocketManager {
  constructor() {
    this.socket = socketlib.registerModule(MODULE_ID);

    // Track what the GM has broadcast to players (GM client only, in-memory)
    this._gmBroadcastState = {
      /** @type {Map<string, boolean>} userId → whether they have cinematic open */
      playerCinematicStatus: new Map(),
      /** Whether the GM has ever broadcast cinematic this session (prep banner dismissed permanently) */
      hasBroadcasted: false,
      playerViewersOpen: false,
      playerSidebarsOpen: false,
    };

    // Register handlers (runs on all clients)
    this.socket.register('updateSpeakers', this._handleUpdateSpeakers);
    this.socket.register('setActiveSpeaker', this._handleSetActiveSpeaker);
    this.socket.register('setActiveJournal', this._handleSetActiveJournal);
    this.socket.register('addSpeaker', this._handleAddSpeaker);
    this.socket.register('removeSpeaker', this._handleRemoveSpeaker);
    this.socket.register('toggleSpeakerVisibility', this._handleToggleSpeakerVisibility);
    this.socket.register('toggleSpeakerHidden', this._handleToggleSpeakerHidden);
    this.socket.register('setSpeakerImage', this._handleSetSpeakerImage);
    this.socket.register('addSpeakerAltImage', this._handleAddSpeakerAltImage);
    this.socket.register('removeSpeakerAltImage', this._handleRemoveSpeakerAltImage);
    this.socket.register('stateUpdate', this._handleStateUpdate);

    // Register participant and roll handlers
    this.socket.register('addParticipant', this._handleAddParticipant);
    this.socket.register('removeParticipant', this._handleRemoveParticipant);
    this.socket.register('clearAllParticipants', this._handleClearAllParticipants);
    this.socket.register('addPendingRoll', this._handleAddPendingRoll);
    this.socket.register('removePendingRoll', this._handleRemovePendingRoll);
    this.socket.register('submitRollResult', this._handleSubmitRollResult);
    this.socket.register('promptSkillCheck', this._handlePromptSkillCheck);
    this.socket.register('rollHistoryUpdate', this._handleRollHistoryUpdate);
    this.socket.register('openPlayerViewer', this._handleOpenPlayerViewer);
    this.socket.register('closePlayerViewer', this._handleClosePlayerViewer);
    this.socket.register('openPlayerSidebar', this._handleOpenPlayerSidebar);
    this.socket.register('closePlayerSidebar', this._handleClosePlayerSidebar);

    // Register challenge handlers
    this.socket.register('setActiveChallenge', this._handleSetActiveChallenge);
    this.socket.register('clearActiveChallenge', this._handleClearActiveChallenge);
    this.socket.register('addActiveChallenge', this._handleAddActiveChallenge);
    this.socket.register('removeActiveChallenge', this._handleRemoveActiveChallenge);
    this.socket.register('clearAllChallenges', this._handleClearAllChallenges);

    // Register blind roll notification handler
    this.socket.register('notifyBlindRoll', this._handleNotifyBlindRoll);

    // Register player speaker handlers
    this.socket.register('setSecondarySpeaker', this._handleSetSecondarySpeaker);
    this.socket.register('addPlayerSpeaker', this._handleAddPlayerSpeaker);
    this.socket.register('removePlayerSpeaker', this._handleRemovePlayerSpeaker);
    this.socket.register('requestSpeakerFloor', this._handleRequestSpeakerFloor);
    this.socket.register('clearSpeakerFloor', this._handleClearSpeakerFloor);
    this.socket.register('clearSpeakerRequest', this._handleClearSpeakerRequest);

    // Register cinematic scene mode handlers
    this.socket.register('launchSceneMode', this._handleLaunchSceneMode);
    this.socket.register('launchSceneModeForPlayer', this._handleLaunchSceneMode);
    this.socket.register('closeSceneMode', this._handleCloseSceneMode);
    this.socket.register('showImagePreview', this._handleShowImagePreview);
    this.socket.register('showDialogue', this._handleShowDialogue);
    this.socket.register('reportCinematicStatus', this._handleReportCinematicStatus.bind(this));
    this.socket.register('queryCinematicStatus', this._handleQueryCinematicStatus.bind(this));

    // Detect player reconnects (refresh) — they lose the cinematic view
    if (game.user?.isGM) {
      Hooks.on('userConnected', (user, connected) => {
        if (user.isGM || !connected) return;
        if (!game.storyframe.cinematicScene?.rendered) return;
        const status = this._gmBroadcastState.playerCinematicStatus;
        if (status.get(user.id)) {
          status.set(user.id, false);
          this._updateBroadcastUI();
          ui.notifications.warn(game.i18n.format('STORYFRAME.CinematicScene.PlayerLostCinematic', { name: user.name }));
        }
      });
    }
  }

  // --- Broadcast State Helpers (GM only) ---

  /**
   * Whether ALL active non-GM players have the cinematic open.
   */
  get allPlayersSeeScene() {
    const status = this._gmBroadcastState.playerCinematicStatus;
    const activePlayers = game.users.filter(u => !u.isGM && u.active);
    if (activePlayers.length === 0) return false;
    return activePlayers.every(u => status.get(u.id) === true);
  }

  /**
   * Initialize the player status map with all active non-GM players set to false.
   */
  _initPlayerStatus() {
    const status = this._gmBroadcastState.playerCinematicStatus;
    status.clear();
    for (const u of game.users.filter(u => !u.isGM && u.active)) {
      status.set(u.id, false);
    }
  }

  /**
   * Mark all active non-GM players as seeing the cinematic.
   */
  _markAllPlayersSee() {
    const status = this._gmBroadcastState.playerCinematicStatus;
    for (const u of game.users.filter(u => !u.isGM && u.active)) {
      status.set(u.id, true);
    }
  }

  /**
   * Update the prep banner, show-to-players button, and player popup in the GM DOM
   * without a full re-render.
   */
  _updateBroadcastUI() {
    if (!game.user?.isGM) return;
    const allSee = this.allPlayersSeeScene;

    // Update show-to-players button active state
    const el = game.storyframe.cinematicScene?.element;
    if (el) {
      const btn = el.querySelector('.broadcast-status-btn');
      if (btn) btn.classList.toggle('active', allSee);
    }

    // Show/remove prep banner — only before the first broadcast, never again after
    const isPrepMode = game.settings.get(MODULE_ID, 'cinematicPrepMode') ?? false;
    const showBanner = isPrepMode && !this._gmBroadcastState.hasBroadcasted;
    const existingBanner = document.body.querySelector('.cinematic-prep-banner');
    if (showBanner && !existingBanner) {
      const banner = document.createElement('div');
      banner.className = 'cinematic-prep-banner';
      banner.innerHTML = `<i class="fas fa-eye-slash" aria-hidden="true"></i><span>${game.i18n.localize('STORYFRAME.CinematicScene.PrepModeBanner')}</span>`;
      document.body.appendChild(banner);
    } else if (!showBanner && existingBanner) {
      existingBanner.remove();
    }

    // Update player popup if open
    this._updatePlayerPopupDOM();
  }

  /**
   * Update just the player popup content (icons/buttons) without recreating it.
   */
  _updatePlayerPopupDOM() {
    const popup = game.storyframe.cinematicScene?.element?.querySelector('.broadcast-player-popup');
    if (!popup) return;
    const status = this._gmBroadcastState.playerCinematicStatus;
    for (const row of popup.querySelectorAll('.broadcast-player-row')) {
      const userId = row.dataset.userId;
      const seeing = status.get(userId) === true;
      const icon = row.querySelector('.broadcast-player-status i');
      if (icon) {
        icon.className = seeing ? 'fas fa-eye' : 'fas fa-eye-slash';
        icon.closest('.broadcast-player-status')?.classList.toggle('active', seeing);
      }
      const btn = row.querySelector('.broadcast-player-send');
      if (btn) btn.classList.toggle('hidden', seeing);
    }
  }

  // --- Public API (call from any client) ---

  /**
   * Request GM to update speakers list.
   * @param {Array} speakers
   */
  async requestUpdateSpeakers(speakers) {
    return await this.socket.executeAsGM('updateSpeakers', speakers);
  }

  /**
   * Request GM to set active speaker.
   * @param {string|null} speakerId
   */
  async requestSetActiveSpeaker(speakerId) {
    return await this.socket.executeAsGM('setActiveSpeaker', speakerId);
  }

  /**
   * Request GM to set active journal.
   * @param {string|null} journalUuid
   */
  async requestSetActiveJournal(journalUuid) {
    return await this.socket.executeAsGM('setActiveJournal', journalUuid);
  }

  /**
   * Request GM to add a speaker.
   * @param {Object} speakerData - { actorUuid?, imagePath?, label }
   */
  async requestAddSpeaker(speakerData) {
    return await this.socket.executeAsGM('addSpeaker', speakerData);
  }

  /**
   * Request GM to remove a speaker.
   * @param {string} speakerId
   */
  async requestRemoveSpeaker(speakerId) {
    return await this.socket.executeAsGM('removeSpeaker', speakerId);
  }

  /**
   * Request GM to toggle speaker name visibility.
   * @param {string} speakerId
   */
  async requestToggleSpeakerVisibility(speakerId) {
    return await this.socket.executeAsGM('toggleSpeakerVisibility', speakerId);
  }

  /**
   * Request GM to toggle speaker hidden from player view.
   * @param {string} speakerId
   */
  async requestToggleSpeakerHidden(speakerId) {
    return await this.socket.executeAsGM('toggleSpeakerHidden', speakerId);
  }

  /**
   * Request GM to set active image for a speaker.
   * @param {string} speakerId
   * @param {string} imagePath
   */
  async requestSetSpeakerImage(speakerId, imagePath) {
    return await this.socket.executeAsGM('setSpeakerImage', { speakerId, imagePath });
  }

  /**
   * Request GM to add an alternate image to a speaker.
   * @param {string} speakerId
   * @param {string} img
   */
  async requestAddSpeakerAltImage(speakerId, img) {
    return await this.socket.executeAsGM('addSpeakerAltImage', { speakerId, img });
  }

  async requestRemoveSpeakerAltImage(speakerId, img) {
    return await this.socket.executeAsGM('removeSpeakerAltImage', { speakerId, img });
  }

  // --- Player Speaker API ---

  /**
   * Request GM to set secondary (responding) speaker.
   * @param {string|null} speakerId
   */
  async requestSetSecondarySpeaker(speakerId) {
    return await this.socket.executeAsGM('setSecondarySpeaker', speakerId);
  }

  /**
   * Request GM to add a player-owned speaker.
   * @param {Object} data - { actorUuid, imagePath, label, userId }
   */
  async requestAddPlayerSpeaker(data) {
    return await this.socket.executeAsGM('addPlayerSpeaker', data);
  }

  /**
   * Request GM to remove a player-owned speaker.
   * @param {string} speakerId
   * @param {string} userId
   */
  async requestRemovePlayerSpeaker(speakerId, userId) {
    return await this.socket.executeAsGM('removePlayerSpeaker', { speakerId, userId });
  }

  /**
   * Request the speaker floor (add to request queue or auto-activate).
   * @param {string} speakerId
   * @param {string} userId
   */
  async requestSpeakerFloor(speakerId, userId) {
    return await this.socket.executeAsGM('requestSpeakerFloor', { speakerId, userId });
  }

  /**
   * Player voluntarily steps down from secondary speaker.
   * @param {string} speakerId
   * @param {string} userId
   */
  async requestClearSpeakerFloor(speakerId, userId) {
    return await this.socket.executeAsGM('clearSpeakerFloor', { speakerId, userId });
  }

  /**
   * GM dismisses a speaker request from the queue.
   * @param {string} speakerId
   */
  async requestClearSpeakerRequest(speakerId) {
    return await this.socket.executeAsGM('clearSpeakerRequest', speakerId);
  }

  /**
   * Broadcast state update to all clients.
   * Called by StateManager after local changes.
   */
  broadcastStateUpdate() {
    const state = game.storyframe.stateManager?.getState();
    if (state) {
      this.socket.executeForEveryone('stateUpdate', state);
    }
  }

  /**
   * Broadcast state to other clients only (skip local re-render).
   */
  broadcastStateToOthers() {
    const state = game.storyframe.stateManager?.getState();
    if (state) {
      this.socket.executeForOthers('stateUpdate', state);
    }
  }

  // --- Participant API ---

  /**
   * Request GM to add a participant.
   * @param {Object} participantData - { actorUuid, userId }
   */
  async requestAddParticipant(participantData) {
    return await this.socket.executeAsGM('addParticipant', participantData);
  }

  /**
   * Request GM to remove a participant.
   * @param {string} participantId
   */
  async requestRemoveParticipant(participantId) {
    return await this.socket.executeAsGM('removeParticipant', participantId);
  }

  /**
   * Request GM to clear all participants.
   */
  async requestClearAllParticipants() {
    return await this.socket.executeAsGM('clearAllParticipants');
  }

  // --- Roll Tracking API ---

  /**
   * Request GM to add a pending roll.
   * @param {Object} rollRequest - { id, participantId, skillSlug, dc, timestamp }
   */
  async requestAddPendingRoll(rollRequest) {
    return await this.socket.executeAsGM('addPendingRoll', rollRequest);
  }

  /**
   * Request GM to remove a pending roll.
   * @param {string} requestId
   */
  async requestRemovePendingRoll(requestId) {
    return await this.socket.executeAsGM('removePendingRoll', requestId);
  }

  /**
   * Request GM to submit a roll result.
   * @param {Object} result - { requestId, participantId, skillSlug, total, degreeOfSuccess, timestamp, chatMessageId }
   */
  async requestSubmitRollResult(result) {
    return await this.socket.executeAsGM('submitRollResult', result);
  }

  /**
   * Notify GM that a blind roll was just executed.
   * @param {Object} data - { requestId, actorId, timestamp }
   */
  async notifyBlindRollExecuted(data) {
    return await this.socket.executeAsGM('notifyBlindRoll', data);
  }

  /**
   * Trigger skill check prompt on a specific player's client.
   * @param {string} userId - Target user ID
   * @param {Object} requestData - Roll request data
   */
  async triggerSkillCheckOnPlayer(userId, requestData) {
    return await this.socket.executeAsUser('promptSkillCheck', userId, requestData);
  }

  /**
   * Broadcast roll history update to all clients.
   * @param {Object} historyData - Roll history data
   */
  broadcastRollHistoryUpdate(historyData) {
    this.socket.executeForEveryone('rollHistoryUpdate', historyData);
  }

  /**
   * Open player viewer on all player clients.
   * Called by GM to ensure all players have the viewer open.
   */
  openAllPlayerViewers() {
    this._gmBroadcastState.playerViewersOpen = true;
    this.socket.executeForEveryone('openPlayerViewer');
  }

  /**
   * Close player viewer on all player clients.
   */
  closeAllPlayerViewers() {
    this._gmBroadcastState.playerViewersOpen = false;
    this.socket.executeForEveryone('closePlayerViewer');
  }

  /**
   * Open player sidebar on all player clients.
   * Called by GM to open sidebars for rolls/challenges.
   */
  openAllPlayerSidebars() {
    this._gmBroadcastState.playerSidebarsOpen = true;
    this.socket.executeForEveryone('openPlayerSidebar');
  }

  /**
   * Close player sidebar on all player clients.
   */
  closeAllPlayerSidebars() {
    this._gmBroadcastState.playerSidebarsOpen = false;
    this.socket.executeForEveryone('closePlayerSidebar');
  }

  // --- Cinematic Scene Mode API ---

  /**
   * Broadcast a journal image preview to all player clients.
   * @param {string} src - Image src URL
   */
  broadcastImagePreview(src) {
    this.socket.executeForOthers('showImagePreview', src);
  }

  /**
   * Launch cinematic scene mode.
   * If cinematicPrepMode is enabled, only opens for the GM.
   * Otherwise broadcasts to all clients.
   */
  launchSceneMode() {
    this._initPlayerStatus();
    const prepMode = game.settings.get(MODULE_ID, 'cinematicPrepMode');
    if (prepMode) {
      this._gmBroadcastState.hasBroadcasted = false;
      this._handleLaunchSceneMode();
    } else {
      this._gmBroadcastState.hasBroadcasted = true;
      this._markAllPlayersSee();
      this.socket.executeForEveryone('launchSceneMode');
    }
  }

  /**
   * Show cinematic scene to all players (broadcast from GM).
   */
  showSceneToPlayers() {
    this._gmBroadcastState.hasBroadcasted = true;
    this._markAllPlayersSee();
    this.socket.executeForEveryone('launchSceneMode');
    this._updateBroadcastUI();
  }

  /**
   * Show cinematic scene to a single player.
   * @param {string} userId
   */
  showSceneToPlayer(userId) {
    this._gmBroadcastState.hasBroadcasted = true;
    this._gmBroadcastState.playerCinematicStatus.set(userId, true);
    this.socket.executeAsUser('launchSceneModeForPlayer', userId);
    this._updateBroadcastUI();
  }

  /**
   * Close cinematic scene mode on all clients.
   */
  closeSceneMode() {
    this._gmBroadcastState.playerCinematicStatus.clear();
    this.socket.executeForEveryone('closeSceneMode');
  }

  // --- Challenge API ---

  /**
   * Request GM to set active challenge.
   * @deprecated Use requestAddChallenge for multi-challenge support
   * @param {Object} challengeData - Challenge data
   */
  async requestSetActiveChallenge(challengeData) {
    return await this.socket.executeAsGM('setActiveChallenge', challengeData);
  }

  /**
   * Request GM to add an active challenge (supports multiple concurrent).
   * @param {Object} challengeData - Challenge data
   * @returns {boolean} True if added, false if duplicate name exists
   */
  async requestAddChallenge(challengeData) {
    return await this.socket.executeAsGM('addActiveChallenge', challengeData);
  }

  /**
   * Request GM to remove a specific active challenge.
   * @param {string} challengeId - Challenge ID to remove
   */
  async requestRemoveChallenge(challengeId) {
    return await this.socket.executeAsGM('removeActiveChallenge', challengeId);
  }

  /**
   * Request GM to clear active challenge (backward compat).
   * @deprecated Use requestRemoveChallenge or requestClearAllChallenges
   */
  async requestClearActiveChallenge() {
    return await this.socket.executeAsGM('clearActiveChallenge');
  }

  /**
   * Request GM to clear all active challenges.
   */
  async requestClearAllChallenges() {
    return await this.socket.executeAsGM('clearAllChallenges');
  }

  // --- Handlers (execute on GM client) ---

  /**
   * Handler: Update speakers list.
   * Runs on GM client only (socketlib enforces this).
   */
  async _handleUpdateSpeakers(speakers) {
    await game.storyframe.stateManager?.updateSpeakers(speakers);
  }

  /**
   * Handler: Set active speaker.
   */
  async _handleSetActiveSpeaker(speakerId) {
    await game.storyframe.stateManager?.setActiveSpeaker(speakerId);
  }

  /**
   * Handler: Set active journal.
   */
  async _handleSetActiveJournal(journalUuid) {
    await game.storyframe.stateManager?.setActiveJournal(journalUuid);
  }

  /**
   * Handler: Add speaker.
   */
  async _handleAddSpeaker(speakerData) {
    return await game.storyframe.stateManager?.addSpeaker(speakerData);
  }

  /**
   * Handler: Remove speaker.
   */
  async _handleRemoveSpeaker(speakerId) {
    await game.storyframe.stateManager?.removeSpeaker(speakerId);
  }

  /**
   * Handler: Toggle speaker name visibility.
   */
  async _handleToggleSpeakerVisibility(speakerId) {
    await game.storyframe.stateManager?.toggleSpeakerNameVisibility(speakerId);
  }

  /**
   * Handler: Toggle speaker hidden from player view.
   */
  async _handleToggleSpeakerHidden(speakerId) {
    await game.storyframe.stateManager?.toggleSpeakerHidden(speakerId);
  }

  /**
   * Handler: Set active image for a speaker.
   */
  async _handleSetSpeakerImage({ speakerId, imagePath }) {
    await game.storyframe.stateManager?.setSpeakerImage(speakerId, imagePath);
  }

  /**
   * Handler: Add alternate image to a speaker.
   */
  async _handleAddSpeakerAltImage({ speakerId, img }) {
    await game.storyframe.stateManager?.addSpeakerAltImage(speakerId, img);
  }

  async _handleRemoveSpeakerAltImage({ speakerId, img }) {
    await game.storyframe.stateManager?.removeSpeakerAltImage(speakerId, img);
  }

  /**
   * Handler: State update broadcast.
   * Runs on all clients to sync state.
   */
  _handleStateUpdate(state) {
    if (game.storyframe.stateManager) {
      game.storyframe.stateManager.syncState(state);
      // Trigger UI re-render
      game.storyframe.gmSidebar?.render();
      if (game.storyframe.playerViewer?.rendered) game.storyframe.playerViewer.render();
      if (game.storyframe.playerSidebar?.rendered) game.storyframe.playerSidebar.render();
      game.storyframe.cinematicScene?._onStateChange();
    }
  }

  // --- Participant Handlers ---

  /**
   * Handler: Add participant.
   * Runs on GM client.
   */
  async _handleAddParticipant(data) {
    return await game.storyframe.stateManager?.addParticipant(data);
  }

  /**
   * Handler: Remove participant.
   * Runs on GM client.
   */
  async _handleRemoveParticipant(participantId) {
    await game.storyframe.stateManager?.removeParticipant(participantId);
  }

  /**
   * Handler: Clear all participants.
   * Runs on GM client.
   */
  async _handleClearAllParticipants() {
    await game.storyframe.stateManager?.clearAllParticipants();
  }

  // --- Roll Tracking Handlers ---

  /**
   * Handler: Add pending roll.
   * Runs on GM client.
   */
  async _handleAddPendingRoll(request) {
    await game.storyframe.stateManager?.addPendingRoll(request);
  }

  /**
   * Handler: Remove pending roll.
   * Runs on GM client.
   */
  async _handleRemovePendingRoll(requestId) {
    await game.storyframe.stateManager?.removePendingRoll(requestId);
  }

  /**
   * Handler: Submit roll result.
   * Runs on GM client.
   */
  async _handleSubmitRollResult(result) {
    await game.storyframe.stateManager?.addRollResult(result);
    await game.storyframe.stateManager?.removePendingRoll(result.requestId);
  }

  /**
   * Handler: Prompt skill check on player client.
   * CRITICAL: This runs on the PLAYER's client.
   * Must call playerApp.showRollPrompt() to display UI.
   */
  _handlePromptSkillCheck(_requestData) {
    // Ensure this roll exists in local state before rendering.
    // The stateUpdate broadcast may arrive after this targeted prompt,
    // causing the sidebar to render with stale state (missing the roll).
    if (_requestData?.id && game.storyframe.stateManager) {
      const state = game.storyframe.stateManager.getState();
      if (state && !state.pendingRolls.some(r => r.id === _requestData.id)) {
        state.pendingRolls.push(_requestData);
      }
    }

    if (game.storyframe.cinematicScene?.rendered) {
      game.storyframe.cinematicScene._onStateChange();
    } else if (game.storyframe.playerSidebar) {
      game.storyframe.playerSidebar.render(true);
    } else if (game.storyframe.playerApp) {
      game.storyframe.playerApp.showRollPrompt(_requestData);
    }
  }

  /**
   * Handler: Roll history update.
   * Runs on all clients to sync roll history display.
   */
  _handleRollHistoryUpdate(_historyData) {
    game.storyframe.gmSidebar?.render();
    if (game.storyframe.playerViewer?.rendered) game.storyframe.playerViewer.render();
    if (game.storyframe.playerSidebar?.rendered) game.storyframe.playerSidebar.render();
    game.storyframe.cinematicScene?._onStateChange();
  }

  /**
   * Handler: Open player viewer.
   * Runs on all clients - opens the player viewer for non-GM users.
   */
  _handleOpenPlayerViewer() {

    // Only open for non-GM users
    if (game.user?.isGM) return;

    // Mark viewer as unlocked by GM (for prep mode gating)
    game.storyframe._playerViewerUnlocked = true;

    const sidebar = game.storyframe.playerSidebar;
    const sidebarWasRendered = sidebar?.rendered;

    // Import and create viewer if needed
    if (!game.storyframe.playerViewer) {
      import('./applications/player-viewer.mjs').then(({ PlayerViewerApp }) => {
        game.storyframe.playerViewer = new PlayerViewerApp();
        game.storyframe.playerViewer.render(true);
        // Reposition sidebar if it was already open
        if (sidebarWasRendered && sidebar) {
          sidebar.parentViewer = game.storyframe.playerViewer;
          setTimeout(() => sidebar._positionAsDrawer(3), 100);
        }
      });
    } else if (!game.storyframe.playerViewer.rendered) {
      game.storyframe.playerViewer.render(true);
      // Reposition sidebar if it was already open
      if (sidebarWasRendered && sidebar) {
        sidebar.parentViewer = game.storyframe.playerViewer;
        setTimeout(() => sidebar._positionAsDrawer(3), 100);
      }
    }
  }

  /**
   * Handler: Close player viewer.
   * Runs on all clients - closes the player viewer for non-GM users.
   */
  _handleClosePlayerViewer() {
    // Only close for non-GM users
    if (game.user?.isGM) return;

    // Re-lock viewer (GM closed it, prep mode gate re-engages)
    game.storyframe._playerViewerUnlocked = false;

    // Close viewer if it exists and is rendered
    if (game.storyframe.playerViewer?.rendered) {
      game.storyframe.playerViewer.close();
    }
  }

  /**
   * Handler: Open player sidebar.
   * Runs on all clients - opens the player sidebar for non-GM users.
   */
  _handleOpenPlayerSidebar() {
    // Only open for non-GM users
    if (game.user?.isGM) return;

    // Open sidebar if it exists and not already rendered
    if (game.storyframe.playerSidebar && !game.storyframe.playerSidebar.rendered) {
      game.storyframe.playerSidebar.render(true);
    }
  }

  /**
   * Handler: Close player sidebar.
   * Runs on all clients - closes the player sidebar for non-GM users.
   */
  _handleClosePlayerSidebar() {
    // Only close for non-GM users
    if (game.user?.isGM) return;

    // Close sidebar if it exists and is rendered
    if (game.storyframe.playerSidebar?.rendered) {
      game.storyframe.playerSidebar.close();
    }
  }

  // --- Cinematic Scene Mode Handlers ---

  _handleShowImagePreview(src) {
    const scene = game.storyframe.cinematicScene;
    if (!scene?.rendered) return;
    scene.showImagePreview(src);
  }

  /**
   * Broadcast dialogue text to all clients for typewriter display.
   * @param {Object} data - { text, fontFamily }
   */
  broadcastDialogue(data) {
    this.socket.executeForOthers('showDialogue', data);
  }

  _handleShowDialogue(data) {
    const scene = game.storyframe.cinematicScene;
    if (!scene?.rendered) return;
    const container = scene.element?.querySelector('.cinematic-scene-container');
    if (!container || !game.storyframe.dialogue) return;

    // Determine which text to show based on whether the player knows the language
    let displayText = data.originalText;
    let useFont = false;

    if (data.lang) {
      let knows = false;

      // Check all actors the player owns (not just the assigned character)
      const ownedActors = game.actors?.filter(a => a.isOwner && a.type === 'character') ?? [];
      // Also include the assigned character in case it's not in the world actors
      if (game.user?.character) ownedActors.push(game.user.character);
      for (const actor of ownedActors) {
        const knownLangs = actor.knownLanguages
          ?? actor.system?.details?.languages?.value
          ?? actor.system?.traits?.languages?.value
          ?? [];
        const langSet = knownLangs instanceof Set ? knownLangs : new Set(knownLangs);
        if (langSet.has(data.lang)) {
          knows = true;
          break;
        }
      }

      if (!knows) {
        displayText = data.scrambledText;
        useFont = true;
      }
    }

    game.storyframe.dialogue.typeDialogue(container, displayText, {
      speed: 'normal',
      onComplete: () => {
        setTimeout(() => {
          game.storyframe.dialogue?.destroyDialogue(container);
        }, 6000);
      },
    });

    // Apply fantasy font only if the player doesn't know the language
    if (useFont && data.fontFamily) {
      const box = container.querySelector('.cinematic-dialogue-box');
      if (box) box.style.fontFamily = `"${data.fontFamily}", serif`;
    }
  }

  async _handleLaunchSceneMode() {
    const isGM = game.user?.isGM;
    const AppClass = isGM
      ? (await import('./applications/cinematic/cinematic-gm-app.mjs')).CinematicGMApp
      : (await import('./applications/cinematic/cinematic-player-app.mjs')).CinematicPlayerApp;

    // Close player viewer/sidebar for non-GM (cinematic replaces them)
    if (!isGM) {
      game.storyframe.playerViewer?.close();
      game.storyframe.playerSidebar?.close();
    }

    if (!game.storyframe.cinematicScene) {
      game.storyframe.cinematicScene = new AppClass();
    }
    if (!game.storyframe.cinematicScene.rendered) {
      game.storyframe.cinematicScene.render(true);
    }
  }

  _handleCloseSceneMode() {
    const cinematic = game.storyframe.cinematicScene;
    if (cinematic?.rendered) {
      cinematic.fadeOutAndClose();
    }
  }

  /**
   * Handler: A player reports their cinematic status to the GM.
   * @param {string} userId
   * @param {boolean} hasOpen
   */
  _handleReportCinematicStatus(userId, hasOpen) {
    if (!game.user?.isGM) return;
    if (!game.storyframe.cinematicScene?.rendered) return;
    console.log(`StoryFrame | Player status report: ${game.users.get(userId)?.name} = ${hasOpen}`);
    const status = this._gmBroadcastState.playerCinematicStatus;
    status.set(userId, hasOpen);
    this._updateBroadcastUI();
  }

  /**
   * Handler: Runs on player clients when GM queries cinematic status.
   * Responds by reporting whether this player has the cinematic open.
   */
  _handleQueryCinematicStatus() {
    if (game.user?.isGM) return;
    const hasOpen = !!game.storyframe.cinematicScene?.rendered;
    console.log(`StoryFrame | Cinematic query response: ${game.user.name} = ${hasOpen}`);
    this.socket.executeAsGM('reportCinematicStatus', game.user.id, hasOpen);
  }

  /**
   * Poll all players for their cinematic status.
   * Call from GM client — each player will respond via reportCinematicStatus.
   */
  pollPlayerCinematicStatus() {
    if (!game.user?.isGM) return;
    // Don't reset status — just query. Responses will update individual entries.
    // Ensure any new active players get a slot (defaults to current value or false).
    for (const u of game.users.filter(u => !u.isGM && u.active)) {
      if (!this._gmBroadcastState.playerCinematicStatus.has(u.id)) {
        this._gmBroadcastState.playerCinematicStatus.set(u.id, false);
      }
    }
    this.socket.executeForOthers('queryCinematicStatus');
  }

  // --- Player Speaker Handlers ---

  async _handleSetSecondarySpeaker(speakerId) {
    await game.storyframe.stateManager?.setSecondarySpeaker(speakerId);
  }

  async _handleAddPlayerSpeaker(data) {
    // Validate setting is enabled
    if (!game.settings.get(MODULE_ID, 'allowPlayerSpeakers')) return null;
    return await game.storyframe.stateManager?.addPlayerSpeaker(data);
  }

  async _handleRemovePlayerSpeaker({ speakerId, userId }) {
    await game.storyframe.stateManager?.removePlayerSpeaker(speakerId, userId);
  }

  async _handleRequestSpeakerFloor({ speakerId, userId }) {
    const stateManager = game.storyframe.stateManager;
    if (!stateManager) return;

    // Validate setting is enabled
    if (!game.settings.get(MODULE_ID, 'allowPlayerSpeakers')) return;

    // If already secondary, no-op
    if (stateManager.getState()?.secondarySpeaker === speakerId) return;

    // Auto-activate mode: set directly as secondary
    if (game.settings.get(MODULE_ID, 'playerSpeakerAutoActivate')) {
      await stateManager.setSecondarySpeaker(speakerId);
      // Clear any pending request for this speaker
      await stateManager.clearSpeakerRequest(speakerId);
    } else {
      // Queue mode: add to request queue for GM approval
      await stateManager.addSpeakerRequest({ speakerId, userId, timestamp: Date.now() });
    }
  }

  async _handleClearSpeakerFloor({ speakerId, userId }) {
    const stateManager = game.storyframe.stateManager;
    if (!stateManager) return;
    const state = stateManager.getState();
    if (!state) return;

    // Validate ownership: only clear if this user's speaker is the secondary
    const speaker = (state.speakers || []).find(s => s.id === speakerId);
    if (!speaker || speaker.userId !== userId) return;

    if (state.secondarySpeaker === speakerId) {
      await stateManager.setSecondarySpeaker(null);
    }
  }

  async _handleClearSpeakerRequest(speakerId) {
    await game.storyframe.stateManager?.clearSpeakerRequest(speakerId);
  }

  // --- Challenge Handlers ---

  /**
   * Handler: Set active challenge (backward compat).
   * @deprecated
   * Runs on GM client.
   */
  async _handleSetActiveChallenge(challengeData) {
    await game.storyframe.stateManager?.setActiveChallenge(challengeData);
  }

  /**
   * Handler: Add active challenge.
   * Runs on GM client.
   * @returns {boolean} Success status
   */
  async _handleAddActiveChallenge(challengeData) {
    return await game.storyframe.stateManager?.addActiveChallenge(challengeData);
  }

  /**
   * Handler: Remove active challenge.
   * Runs on GM client.
   */
  async _handleRemoveActiveChallenge(challengeId) {
    await game.storyframe.stateManager?.removeActiveChallenge(challengeId);
  }

  /**
   * Handler: Clear active challenge (backward compat).
   * @deprecated
   * Runs on GM client.
   */
  async _handleClearActiveChallenge() {
    await game.storyframe.stateManager?.clearActiveChallenge();
  }

  /**
   * Handler: Clear all challenges.
   * Runs on GM client.
   */
  async _handleClearAllChallenges() {
    await game.storyframe.stateManager?.clearAllChallenges();
  }

  /**
   * Handler: Notify GM that a blind roll was executed.
   * Runs on GM client.
   * Directly removes the pending roll.
   */
  async _handleNotifyBlindRoll(data) {
    await game.storyframe.stateManager?.removePendingRoll(data.requestId);
  }
}
