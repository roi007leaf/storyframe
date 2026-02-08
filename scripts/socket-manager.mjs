import { MODULE_ID } from './constants.mjs';

/**
 * Manages socket communication using socketlib.
 * All state mutations route through GM via executeAsGM.
 */
export class SocketManager {
  constructor() {
    this.socket = socketlib.registerModule(MODULE_ID);

    // Register handlers (runs on all clients)
    this.socket.register('updateSpeakers', this._handleUpdateSpeakers);
    this.socket.register('setActiveSpeaker', this._handleSetActiveSpeaker);
    this.socket.register('setActiveJournal', this._handleSetActiveJournal);
    this.socket.register('addSpeaker', this._handleAddSpeaker);
    this.socket.register('removeSpeaker', this._handleRemoveSpeaker);
    this.socket.register('toggleSpeakerVisibility', this._handleToggleSpeakerVisibility);
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

    // Register challenge handlers
    this.socket.register('setActiveChallenge', this._handleSetActiveChallenge);
    this.socket.register('clearActiveChallenge', this._handleClearActiveChallenge);
    this.socket.register('addActiveChallenge', this._handleAddActiveChallenge);
    this.socket.register('removeActiveChallenge', this._handleRemoveActiveChallenge);
    this.socket.register('clearAllChallenges', this._handleClearAllChallenges);

    // Register blind roll notification handler
    this.socket.register('notifyBlindRoll', this._handleNotifyBlindRoll);
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
   * Broadcast state update to all clients.
   * Called by StateManager after local changes.
   */
  broadcastStateUpdate() {
    const state = game.storyframe.stateManager?.getState();
    if (state) {
      this.socket.executeForEveryone('stateUpdate', state);
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
    this.socket.executeForEveryone('openPlayerViewer');
  }

  /**
   * Close player viewer on all player clients.
   */
  closeAllPlayerViewers() {
    this.socket.executeForEveryone('closePlayerViewer');
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
   * Handler: State update broadcast.
   * Runs on all clients to sync state.
   */
  _handleStateUpdate(state) {
    if (game.storyframe.stateManager) {
      game.storyframe.stateManager.state = state;
      // Trigger UI re-render
      game.storyframe.gmApp?.render();
      game.storyframe.playerViewer?.render();
      game.storyframe.playerSidebar?.render();
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
    // Trigger UI update on player sidebar (where rolls are displayed)
    if (game.storyframe.playerSidebar) {
      game.storyframe.playerSidebar.render();
    } else if (game.storyframe.playerApp) {
      // Fallback for compatibility
      game.storyframe.playerApp.showRollPrompt(_requestData);
    } else {
      console.warn(`${MODULE_ID} | playerApp/playerSidebar not initialized for roll prompt`);
    }
  }

  /**
   * Handler: Roll history update.
   * Runs on all clients to sync roll history display.
   */
  _handleRollHistoryUpdate(_historyData) {
    // Update local UI displays
    game.storyframe.gmApp?.render();
    game.storyframe.playerViewer?.render();
    game.storyframe.playerSidebar?.render();
  }

  /**
   * Handler: Open player viewer.
   * Runs on all clients - opens the player viewer for non-GM users.
   */
  _handleOpenPlayerViewer() {

    // Only open for non-GM users
    if (game.user.isGM) return;

    // Import and create viewer if needed
    if (!game.storyframe.playerViewer) {
      import('./applications/player-viewer.mjs').then(({ PlayerViewerApp }) => {
        game.storyframe.playerViewer = new PlayerViewerApp();
        game.storyframe.playerViewer.render(true);
      });
    } else if (!game.storyframe.playerViewer.rendered) {
      game.storyframe.playerViewer.render(true);
    }
  }

  /**
   * Handler: Close player viewer.
   * Runs on all clients - closes the player viewer for non-GM users.
   */
  _handleClosePlayerViewer() {
    // Only close for non-GM users
    if (game.user.isGM) return;

    // Close viewer if it exists and is rendered
    if (game.storyframe.playerViewer?.rendered) {
      game.storyframe.playerViewer.close();
    }
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
