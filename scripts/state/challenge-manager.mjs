import { MODULE_ID, FLAG_KEY } from '../constants.mjs';

/**
 * Manages challenge state and operations.
 * Handles active challenges with support for multiple concurrent challenges.
 */
export class ChallengeManager {
  constructor(socketManager, state) {
    this.socketManager = socketManager;
    this.state = state;
  }

  /**
   * Add an active challenge (supports multiple concurrent challenges).
   * @param {Object} challengeData - Challenge data with options
   * @returns {boolean} True if added, false if name already exists
   */
  async addActiveChallenge(challengeData) {
    if (!this.state) return false;

    const scene = game.scenes.current;
    if (!scene) return false;

    // Validate name uniqueness (case-insensitive)
    const existingNames = this.state.activeChallenges.map(c => c.name.toLowerCase());
    if (existingNames.includes(challengeData.name.toLowerCase())) {
      return false;  // Caller should show error notification
    }

    // Add timestamp for chronological ordering
    const challengeWithTimestamp = {
      ...challengeData,
      createdAt: Date.now()
    };

    this.state.activeChallenges.push(challengeWithTimestamp);
    await scene.setFlag(MODULE_ID, FLAG_KEY, this.state);
    this._broadcast();
    return true;
  }

  /**
   * Remove an active challenge by ID.
   * @param {string} challengeId - ID of challenge to remove
   */
  async removeActiveChallenge(challengeId) {
    if (!this.state) return;

    const scene = game.scenes.current;
    if (!scene) return;

    this.state.activeChallenges = this.state.activeChallenges.filter(
      c => c.id !== challengeId
    );

    await scene.setFlag(MODULE_ID, FLAG_KEY, this.state);
    this._broadcast();
  }

  /**
   * Get a specific active challenge by ID.
   * @param {string} challengeId - Challenge ID
   * @returns {Object|null} Challenge data or null
   */
  getActiveChallenge(challengeId) {
    if (!this.state?.activeChallenges) return null;
    return this.state.activeChallenges.find(c => c.id === challengeId) || null;
  }

  /**
   * Clear all active challenges.
   */
  async clearAllChallenges() {
    if (!this.state) return;

    const scene = game.scenes.current;
    if (!scene) return;

    this.state.activeChallenges = [];
    await scene.setFlag(MODULE_ID, FLAG_KEY, this.state);
    this._broadcast();
  }

  /**
   * Set active challenge and persist.
   * @deprecated Use addActiveChallenge instead. This method clears all existing challenges.
   * @param {Object} challengeData - Challenge data with options
   */
  async setActiveChallenge(challengeData) {
    if (!this.state) return;

    const scene = game.scenes.current;
    if (!scene) return;

    // Clear existing and add the new one (backward compatible behavior)
    this.state.activeChallenges = [{
      ...challengeData,
      createdAt: Date.now()
    }];

    await scene.setFlag(MODULE_ID, FLAG_KEY, this.state);
    this._broadcast();
  }

  /**
   * Clear active challenge and persist.
   * @deprecated Use removeActiveChallenge or clearAllChallenges instead.
   */
  async clearActiveChallenge() {
    if (!this.state) return;

    const scene = game.scenes.current;
    if (!scene) return;

    this.state.activeChallenges = [];
    await scene.setFlag(MODULE_ID, FLAG_KEY, this.state);
    this._broadcast();
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
