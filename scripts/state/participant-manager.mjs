import { MODULE_ID, FLAG_KEY } from '../constants.mjs';

/**
 * Manages participant state and operations.
 * Handles conversation participants (PCs) and their lifecycle.
 */
export class ParticipantManager {
  constructor(socketManager, state) {
    this.socketManager = socketManager;
    this.state = state;
  }

  /**
   * Add a participant to the list.
   * @param {Object} data - { actorUuid, userId, isNameHidden }
   * @returns {Object} Created participant with ID, or existing participant if duplicate
   */
  async addParticipant({ actorUuid, userId, isNameHidden = false }) {
    if (!this.state) return null;

    // Check for duplicate by actorUuid
    const existing = this.state.participants.find((p) => p.actorUuid === actorUuid);
    if (existing) {
      return existing; // Return existing instead of adding duplicate
    }

    const participant = {
      id: foundry.utils.randomID(),
      actorUuid,
      userId,
      isNameHidden,
    };

    this.state.participants.push(participant);
    await this._persistState();
    this._broadcast();
    return participant;
  }

  /**
   * Remove a participant from the list.
   * @param {string} participantId
   */
  async removeParticipant(participantId) {
    if (!this.state) return;

    this.state.participants = this.state.participants.filter((p) => p.id !== participantId);

    // Clear pending rolls for this participant
    this.state.pendingRolls = this.state.pendingRolls.filter(
      (r) => r.participantId !== participantId,
    );

    await this._persistState();
    this._broadcast();
  }

  /**
   * Clear all participants.
   */
  async clearAllParticipants() {
    if (!this.state) return;

    this.state.participants = [];
    await this._persistState();
    this._broadcast();
  }

  /**
   * Resolve participant to Actor.
   * @param {Object} participant - Participant object
   * @returns {Actor|null} Resolved actor
   */
  async resolveParticipant(participant) {
    if (!participant?.actorUuid) return null;
    return await fromUuid(participant.actorUuid);
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
