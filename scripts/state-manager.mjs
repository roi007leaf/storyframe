const MODULE_ID = 'storyframe';
const FLAG_KEY = 'data';
const SCHEMA_VERSION = 1;

/**
 * Manages speaker state persistence in Scene flags.
 * State structure:
 * {
 *   version: 1,
 *   activeJournal: string|null,  // JournalEntry UUID
 *   activeSpeaker: string|null,  // Speaker ID
 *   speakers: [{
 *     id: string,          // Unique ID (foundry.utils.randomID)
 *     actorUuid: string|null,   // Actor UUID for actor-based speakers
 *     imagePath: string|null,   // Direct image path for custom speakers
 *     label: string        // Display name
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
    console.log(`${MODULE_ID} | State loaded`, this.state);
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
   * @returns {Object} Created speaker with ID
   */
  async addSpeaker({ actorUuid = null, imagePath = null, label }) {
    if (!this.state) return null;

    const speaker = {
      id: foundry.utils.randomID(),
      actorUuid,
      imagePath,
      label
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

    this.state.speakers = this.state.speakers.filter(s => s.id !== speakerId);

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

  /**
   * Create default empty state.
   */
  _createDefaultState() {
    return {
      version: SCHEMA_VERSION,
      activeJournal: null,
      activeSpeaker: null,
      speakers: []
    };
  }

  /**
   * Migrate old state to current version.
   * @param {Object} oldData - Old state data
   * @returns {Object} Migrated state
   */
  async _migrate(oldData) {
    console.log(`${MODULE_ID} | Migrating state from v${oldData.version} to v${SCHEMA_VERSION}`);

    // Add migration logic here when schema changes
    // For now, just update version
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
