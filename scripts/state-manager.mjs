const MODULE_ID = 'storyframe';
const FLAG_KEY = 'data';
const SCHEMA_VERSION = 2;

/**
 * Manages speaker state persistence in Scene flags.
 * State structure:
 * {
 *   version: 2,
 *   activeJournal: string|null,  // JournalEntry UUID
 *   activeSpeaker: string|null,  // Speaker ID
 *   speakers: [{
 *     id: string,          // Unique ID (foundry.utils.randomID)
 *     actorUuid: string|null,   // Actor UUID for actor-based speakers
 *     imagePath: string|null,   // Direct image path for custom speakers
 *     label: string        // Display name
 *   }],
 *   participants: [{      // PC conversation participants
 *     id: string,          // Unique ID (foundry.utils.randomID)
 *     actorUuid: string,   // Actor UUID
 *     userId: string       // User ID
 *   }],
 *   pendingRolls: [{      // Requested rolls awaiting completion
 *     id: string,          // Request ID
 *     participantId: string,
 *     skillSlug: string,   // PF2e skill slug (e.g., 'diplomacy')
 *     dc: {
 *       value: number,
 *       visibility: string // 'all', 'owner', 'gm'
 *     },
 *     timestamp: number
 *   }],
 *   rollHistory: [{       // Completed roll results
 *     requestId: string,
 *     participantId: string,
 *     skillSlug: string,
 *     total: number,
 *     degreeOfSuccess: string, // 'criticalSuccess', 'success', 'failure', 'criticalFailure'
 *     timestamp: number,
 *     chatMessageId: string|null
 *   }]
 * }
 */
export class StateManager {
  constructor() {
    this.state = null;
  }

  /**
   * Load state from current scene's flags.
   * Creates default state if none exists.
   */
  async load() {
    const scene = game.scenes.current;
    if (!scene) {
      console.warn(`${MODULE_ID} | No current scene, cannot load state`);
      return;
    }

    let data = scene.getFlag(MODULE_ID, FLAG_KEY);

    if (!data) {
      // Initialize default structure
      data = this._createDefaultState();
      await scene.setFlag(MODULE_ID, FLAG_KEY, data);
    }

    // Check version and migrate if needed
    if (data.version !== SCHEMA_VERSION) {
      data = await this._migrate(data);
    }

    this.state = data;
  }

  /**
   * Get current state (synchronous).
   */
  getState() {
    return this.state;
  }

  /**
   * Update speakers list and persist.
   * @param {Array} speakers - New speakers array
   */
  async updateSpeakers(speakers) {
    if (!this.state) return;

    const scene = game.scenes.current;
    if (!scene) return;

    this.state.speakers = speakers;
    await scene.setFlag(MODULE_ID, FLAG_KEY, this.state);
    this._broadcast();
  }

  /**
   * Set active speaker and persist.
   * @param {string|null} speakerId - Speaker ID or null for narration
   */
  async setActiveSpeaker(speakerId) {
    if (!this.state) return;

    const scene = game.scenes.current;
    if (!scene) return;

    this.state.activeSpeaker = speakerId;
    await scene.setFlag(MODULE_ID, FLAG_KEY, this.state);
    this._broadcast();
  }

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
   * Add a speaker to the list.
   * @param {Object} speaker - Speaker data (actorUuid or imagePath, label)
   * @returns {Object} Created speaker with ID, or existing speaker if duplicate
   */
  async addSpeaker({ actorUuid = null, imagePath = null, label }) {
    if (!this.state) return null;

    // Check for duplicate by actorUuid or imagePath
    if (actorUuid) {
      const existing = this.state.speakers.find((s) => s.actorUuid === actorUuid);
      if (existing) {
        ui.notifications.info(`${label || 'NPC'} is already in the list`);
        return existing;
      }
    } else if (imagePath) {
      const existing = this.state.speakers.find((s) => s.imagePath === imagePath);
      if (existing) {
        ui.notifications.info(`${label || 'NPC'} is already in the list`);
        return existing;
      }
    }

    const speaker = {
      id: foundry.utils.randomID(),
      actorUuid,
      imagePath,
      label,
    };

    this.state.speakers.push(speaker);
    await this.updateSpeakers(this.state.speakers);
    return speaker;
  }

  /**
   * Remove a speaker from the list.
   * @param {string} speakerId - Speaker ID to remove
   */
  async removeSpeaker(speakerId) {
    if (!this.state) return;

    this.state.speakers = this.state.speakers.filter((s) => s.id !== speakerId);

    // Clear active speaker if removed
    if (this.state.activeSpeaker === speakerId) {
      this.state.activeSpeaker = null;
    }

    await this.updateSpeakers(this.state.speakers);
  }

  /**
   * Resolve speaker to displayable data.
   * Handles deleted actors gracefully.
   * @param {Object} speaker - Speaker object
   * @returns {Object} { img, name }
   */
  async resolveSpeaker(speaker) {
    let img, name;

    if (speaker.actorUuid) {
      const actor = await fromUuid(speaker.actorUuid);
      if (actor) {
        img = actor.img;
        name = actor.name;
      } else {
        // Actor deleted - use fallback
        img = speaker.imagePath || 'icons/svg/mystery-man.svg';
        name = speaker.label || 'Unknown';
      }
    } else {
      // Custom image path
      img = speaker.imagePath || 'icons/svg/mystery-man.svg';
      name = speaker.label;
    }

    return { img, name };
  }

  // --- Participant Management ---

  /**
   * Add a participant to the list.
   * @param {Object} data - { actorUuid, userId }
   * @returns {Object} Created participant with ID, or existing participant if duplicate
   */
  async addParticipant({ actorUuid, userId }) {
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

  // --- Roll Tracking ---

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
   * Add a roll result to history.
   * Enforces 50-item limit (FIFO).
   * @param {Object} result - { requestId, participantId, skillSlug, total, degreeOfSuccess, timestamp, chatMessageId }
   */
  async addRollResult(result) {
    if (!this.state) return;

    this.state.rollHistory.push(result);

    // Enforce 50-item limit (FIFO)
    if (this.state.rollHistory.length > 50) {
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
   * Clear all pending rolls (for scene change).
   */
  async clearPendingRolls() {
    if (!this.state) return;

    this.state.pendingRolls = [];
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
   * Create default empty state.
   */
  _createDefaultState() {
    return {
      version: SCHEMA_VERSION,
      activeJournal: null,
      activeSpeaker: null,
      speakers: [],
      participants: [],
      pendingRolls: [],
      rollHistory: [],
    };
  }

  /**
   * Migrate old state to current version.
   * @param {Object} oldData - Old state data
   * @returns {Object} Migrated state
   */
  async _migrate(oldData) {
    console.log(`${MODULE_ID} | Migrating state from v${oldData.version} to v${SCHEMA_VERSION}`);

    // Migration: v1 -> v2 (add participants, pendingRolls, rollHistory)
    if (oldData.version === 1) {
      oldData.participants = [];
      oldData.pendingRolls = [];
      oldData.rollHistory = [];
    }

    oldData.version = SCHEMA_VERSION;

    const scene = game.scenes.current;
    if (scene) {
      await scene.setFlag(MODULE_ID, FLAG_KEY, oldData);
    }

    return oldData;
  }

  /**
   * Notify UI components of state change.
   */
  _broadcast() {
    // ApplicationV2 instances render() when state changes
    game.storyframe.gmApp?.render();
    game.storyframe.playerApp?.render();

    // Also broadcast via socket for other clients
    if (game.storyframe.socketManager) {
      game.storyframe.socketManager.broadcastStateUpdate();
    }
  }
}
