import { MODULE_ID, FLAG_KEY, LIMITS } from '../constants.mjs';

/**
 * Manages roll tracking state and operations.
 * Handles pending roll requests and completed roll history.
 */
export class RollTracker {
  constructor(socketManager, state) {
    this.socketManager = socketManager;
    this.state = state;
  }

  /**
   * Add a pending roll request.
   * @param {Object} rollRequest - { id, participantId, skillSlug, dc, timestamp }
   */
  async addPendingRoll(rollRequest) {
    if (!this.state) return;

    this.state.pendingRolls.push(rollRequest);
    await this._persistState();
    this._broadcast();
  }

  /**
   * Remove a pending roll by request ID.
   * @param {string} requestId
   */
  async removePendingRoll(requestId) {
    if (!this.state) return;

    this.state.pendingRolls = this.state.pendingRolls.filter((r) => r.id !== requestId);
    await this._persistState();
    this._broadcast();
  }

  /**
   * Clear all pending rolls for a specific participant.
   * @param {string} participantId
   */
  async clearPendingRollsForParticipant(participantId) {
    if (!this.state) return;

    this.state.pendingRolls = this.state.pendingRolls.filter(
      (r) => r.participantId !== participantId,
    );
    await this._persistState();
    this._broadcast();
  }

  /**
   * Clear all pending rolls (for scene change).
   */
  async clearPendingRolls() {
    if (!this.state) return;

    this.state.pendingRolls = [];
    await this._persistState();
    this._broadcast();
  }

  /**
   * Add a roll result to history.
   * Enforces ROLL_HISTORY_MAX limit (FIFO).
   * @param {Object} result - { requestId, participantId, skillSlug, total, degreeOfSuccess, timestamp, chatMessageId }
   */
  async addRollResult(result) {
    if (!this.state) return;

    this.state.rollHistory.push(result);

    // Enforce limit from constants (FIFO)
    if (this.state.rollHistory.length > LIMITS.ROLL_HISTORY_MAX) {
      this.state.rollHistory.shift();
    }

    await this._persistState();
    this._broadcast();
  }

  /**
   * Clear roll history (for scene change).
   */
  async clearRollHistory() {
    if (!this.state) return;

    this.state.rollHistory = [];
    await this._persistState();
    this._broadcast();
  }

  /**
   * Persist state to scene flags.
   */
  async _persistState() {
    const scene = game.scenes.current;
    if (scene) {
      await scene.setFlag(MODULE_ID, FLAG_KEY, this.state);
    }
  }

  /**
   * Notify UI components of state change.
   */
  _broadcast() {
    // ApplicationV2 instances render() when state changes
    game.storyframe.gmApp?.render();
    game.storyframe.playerViewer?.render();

    // Also broadcast via socket for other clients
    if (this.socketManager) {
      this.socketManager.broadcastStateUpdate();
    }
  }
}
