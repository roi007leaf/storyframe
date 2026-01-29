const MODULE_ID = 'storyframe';

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
    this.socket.register('stateUpdate', this._handleStateUpdate);

    console.log(`${MODULE_ID} | SocketManager initialized`);
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
   * Broadcast state update to all clients.
   * Called by StateManager after local changes.
   */
  broadcastStateUpdate() {
    const state = game.storyframe.stateManager?.getState();
    if (state) {
      this.socket.executeForEveryone('stateUpdate', state);
    }
  }

  // --- Handlers (execute on GM client) ---

  /**
   * Handler: Update speakers list.
   * Runs on GM client only (socketlib enforces this).
   */
  async _handleUpdateSpeakers(speakers) {
    console.log(`${MODULE_ID} | Socket: updateSpeakers`);
    await game.storyframe.stateManager?.updateSpeakers(speakers);
  }

  /**
   * Handler: Set active speaker.
   */
  async _handleSetActiveSpeaker(speakerId) {
    console.log(`${MODULE_ID} | Socket: setActiveSpeaker`, speakerId);
    await game.storyframe.stateManager?.setActiveSpeaker(speakerId);
  }

  /**
   * Handler: Set active journal.
   */
  async _handleSetActiveJournal(journalUuid) {
    console.log(`${MODULE_ID} | Socket: setActiveJournal`, journalUuid);
    await game.storyframe.stateManager?.setActiveJournal(journalUuid);
  }

  /**
   * Handler: Add speaker.
   */
  async _handleAddSpeaker(speakerData) {
    console.log(`${MODULE_ID} | Socket: addSpeaker`, speakerData);
    return await game.storyframe.stateManager?.addSpeaker(speakerData);
  }

  /**
   * Handler: Remove speaker.
   */
  async _handleRemoveSpeaker(speakerId) {
    console.log(`${MODULE_ID} | Socket: removeSpeaker`, speakerId);
    await game.storyframe.stateManager?.removeSpeaker(speakerId);
  }

  /**
   * Handler: State update broadcast.
   * Runs on all clients to sync state.
   */
  _handleStateUpdate(state) {
    console.log(`${MODULE_ID} | Socket: stateUpdate received`);
    if (game.storyframe.stateManager) {
      game.storyframe.stateManager.state = state;
      // Trigger UI re-render
      game.storyframe.gmApp?.render();
      game.storyframe.playerApp?.render();
    }
  }
}
