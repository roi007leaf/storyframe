import { MODULE_ID, FLAG_KEY } from './constants.mjs';
import { SpeakerManager } from './state/speaker-manager.mjs';
import { ParticipantManager } from './state/participant-manager.mjs';
import { RollTracker } from './state/roll-tracker.mjs';
import { ChallengeManager } from './state/challenge-manager.mjs';
import { Persistence } from './state/persistence.mjs';

/**
 * Orchestrates state management by delegating to domain-specific managers.
 * Acts as a facade providing backward-compatible API while delegating operations
 * to specialized managers (SpeakerManager, ParticipantManager, RollTracker, ChallengeManager).
 *
 * State structure (managed by domain managers):
 * {
 *   version: 4,
 *   activeJournal: string|null,
 *   activeSpeaker: string|null,
 *   speakers: Array,
 *   participants: Array,
 *   pendingRolls: Array,
 *   rollHistory: Array,
 *   activeChallenges: Array
 * }
 */
export class StateManager {
  constructor() {
    this.state = null;
    // Managers initialized in initialize() after socketManager is available
    this.speakerManager = null;
    this.participantManager = null;
    this.rollTracker = null;
    this.challengeManager = null;
  }

  /**
   * Initialize managers with socketManager and state.
   * Must be called after construction with a valid socketManager.
   * @param {Object} socketManager - Socket manager instance for broadcasting
   */
  initialize(socketManager) {
    this.speakerManager = new SpeakerManager(socketManager, this.state);
    this.participantManager = new ParticipantManager(socketManager, this.state);
    this.rollTracker = new RollTracker(socketManager, this.state);
    this.challengeManager = new ChallengeManager(socketManager, this.state);
  }

  /**
   * Load state from current scene's flags.
   * Creates default state if none exists.
   * Delegates to Persistence for loading and migration.
   */
  async load() {
    this.state = await Persistence.load();

    // Update manager state references
    if (this.speakerManager) this.speakerManager.state = this.state;
    if (this.participantManager) this.participantManager.state = this.state;
    if (this.rollTracker) this.rollTracker.state = this.state;
    if (this.challengeManager) this.challengeManager.state = this.state;
  }

  /**
   * Replace the current state and update all domain managers to reference the new object.
   * Must be used instead of direct `stateManager.state = x` assignment so that
   * challengeManager, speakerManager, etc. stay in sync.
   * @param {Object} newState
   */
  syncState(newState) {
    this.state = newState;
    if (this.speakerManager) this.speakerManager.state = this.state;
    if (this.participantManager) this.participantManager.state = this.state;
    if (this.rollTracker) this.rollTracker.state = this.state;
    if (this.challengeManager) this.challengeManager.state = this.state;
  }

  /**
   * Get current state (synchronous).
   * Returns the shared state object that all managers reference.
   */
  getState() {
    return this.state;
  }

  // --- Speaker Management (delegated to SpeakerManager) ---

  /**
   * Set active journal and persist.
   * @param {string|null} journalUuid - JournalEntry UUID or null
   */
  async setActiveJournal(journalUuid) {
    if (!this.state) return;

    const scene = game.scenes.current;
    if (!scene) return;

    this.state.activeJournal = journalUuid;
    await scene.setFlag(MODULE_ID, FLAG_KEY, this.state);
    this._broadcast();
  }

  /**
   * Update speakers list and persist.
   * @param {Array} speakers - New speakers array
   */
  async updateSpeakers(speakers) {
    if (!this.speakerManager) return;
    return await this.speakerManager.updateSpeakers(speakers);
  }

  /**
   * Set active speaker and persist.
   * @param {string|null} speakerId - Speaker ID or null for narration
   */
  async setActiveSpeaker(speakerId) {
    if (!this.speakerManager) return;
    return await this.speakerManager.setActiveSpeaker(speakerId);
  }

  /**
   * Add a speaker to the list.
   * @param {Object} speaker - Speaker data (actorUuid or imagePath, label, isNameHidden)
   * @returns {Object} Created speaker with ID, or existing speaker if duplicate
   */
  async addSpeaker({ actorUuid = null, imagePath = null, label, isNameHidden = false }) {
    if (!this.speakerManager) return;
    return await this.speakerManager.addSpeaker({ actorUuid, imagePath, label, isNameHidden });
  }

  /**
   * Remove a speaker from the list.
   * @param {string} speakerId - Speaker ID to remove
   */
  async removeSpeaker(speakerId) {
    if (!this.speakerManager) return;
    return await this.speakerManager.removeSpeaker(speakerId);
  }

  /**
   * Toggle speaker name visibility for players.
   * @param {string} speakerId - Speaker ID to toggle
   */
  async toggleSpeakerNameVisibility(speakerId) {
    if (!this.speakerManager) return;
    return await this.speakerManager.toggleSpeakerNameVisibility(speakerId);
  }

  /**
   * Resolve speaker to displayable data.
   * Handles deleted actors gracefully.
   * @param {Object} speaker - Speaker object
   * @returns {Object} { img, name }
   */
  async resolveSpeaker(speaker) {
    if (!this.speakerManager) return { img: null, name: 'Unknown' };
    return await this.speakerManager.resolveSpeaker(speaker);
  }

  // --- Participant Management (delegated to ParticipantManager) ---

  /**
   * Add a participant to the list.
   * @param {Object} data - { actorUuid, userId }
   * @returns {Object} Created participant with ID, or existing participant if duplicate
   */
  async addParticipant({ actorUuid, userId }) {
    if (!this.participantManager) return;
    return await this.participantManager.addParticipant({ actorUuid, userId });
  }

  /**
   * Remove a participant from the list.
   * @param {string} participantId
   */
  async removeParticipant(participantId) {
    if (!this.participantManager) return;
    return await this.participantManager.removeParticipant(participantId);
  }

  /**
   * Clear all participants.
   */
  async clearAllParticipants() {
    if (!this.participantManager) return;
    return await this.participantManager.clearAllParticipants();
  }

  // --- Roll Tracking (delegated to RollTracker) ---

  /**
   * Add a pending roll request.
   * @param {Object} rollRequest - { id, participantId, skillSlug, dc, timestamp }
   */
  async addPendingRoll(rollRequest) {
    if (!this.rollTracker) return;
    return await this.rollTracker.addPendingRoll(rollRequest);
  }

  /**
   * Remove a pending roll by request ID.
   * @param {string} requestId
   */
  async removePendingRoll(requestId) {
    if (!this.rollTracker) return;
    return await this.rollTracker.removePendingRoll(requestId);
  }

  /**
   * Clear all pending rolls for a specific participant.
   * @param {string} participantId
   */
  async clearPendingRollsForParticipant(participantId) {
    if (!this.rollTracker) return;
    return await this.rollTracker.clearPendingRollsForParticipant(participantId);
  }

  /**
   * Clear all pending rolls (for scene change).
   */
  async clearPendingRolls() {
    if (!this.rollTracker) return;
    return await this.rollTracker.clearPendingRolls();
  }

  /**
   * Add a roll result to history.
   * Enforces limit (FIFO).
   * @param {Object} result - { requestId, participantId, skillSlug, total, degreeOfSuccess, timestamp, chatMessageId }
   */
  async addRollResult(result) {
    if (!this.rollTracker) return;
    return await this.rollTracker.addRollResult(result);
  }

  /**
   * Clear roll history (for scene change).
   */
  async clearRollHistory() {
    if (!this.rollTracker) return;
    return await this.rollTracker.clearRollHistory();
  }

  // --- Challenge Management (delegated to ChallengeManager) ---

  /**
   * Add an active challenge (supports multiple concurrent challenges).
   * @param {Object} challengeData - Challenge data with options
   * @returns {boolean} True if added, false if name already exists
   */
  async addActiveChallenge(challengeData) {
    if (!this.challengeManager) return false;
    return await this.challengeManager.addActiveChallenge(challengeData);
  }

  /**
   * Remove an active challenge by ID.
   * @param {string} challengeId - ID of challenge to remove
   */
  async removeActiveChallenge(challengeId) {
    if (!this.challengeManager) return;
    return await this.challengeManager.removeActiveChallenge(challengeId);
  }

  /**
   * Get a specific active challenge by ID (synchronous).
   * @param {string} challengeId - Challenge ID
   * @returns {Object|null} Challenge data or null
   */
  getActiveChallenge(challengeId) {
    if (!this.challengeManager) return null;
    return this.challengeManager.getActiveChallenge(challengeId);
  }

  /**
   * Clear all active challenges.
   */
  async clearAllChallenges() {
    if (!this.challengeManager) return;
    return await this.challengeManager.clearAllChallenges();
  }

  /**
   * Set active challenge and persist.
   * @deprecated Use addActiveChallenge instead. This method clears all existing challenges.
   * @param {Object} challengeData - Challenge data with options
   */
  async setActiveChallenge(challengeData) {
    if (!this.challengeManager) return;
    return await this.challengeManager.setActiveChallenge(challengeData);
  }

  /**
   * Clear active challenge and persist.
   * @deprecated Use removeActiveChallenge or clearAllChallenges instead.
   */
  async clearActiveChallenge() {
    if (!this.challengeManager) return;
    return await this.challengeManager.clearActiveChallenge();
  }


  /**
   * Notify UI components of state change.
   * Used by setActiveJournal which doesn't delegate to a manager.
   */
  _broadcast() {
    // ApplicationV2 instances render() when state changes
    game.storyframe.gmApp?.render();
    game.storyframe.playerViewer?.render();

    // Also broadcast via socket for other clients
    if (game.storyframe.socketManager) {
      game.storyframe.socketManager.broadcastStateUpdate();
    }
  }
}
