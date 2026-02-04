import { MODULE_ID, FLAG_KEY, SCHEMA_VERSION } from '../constants.mjs';

/**
 * Manages state persistence and migration.
 * Handles loading, saving, and schema migrations for state data.
 */
export class Persistence {
  /**
   * Load state from current scene's flags.
   * Creates default state if none exists.
   * @returns {Object|null} State data or null if no scene
   */
  static async load() {
    const scene = game.scenes.current;
    if (!scene) {
      console.warn(`${MODULE_ID} | No current scene, cannot load state`);
      return null;
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

    return data;
  }

  /**
   * Save state to current scene's flags.
   * @param {Object} state - State data to save
   */
  static async save(state) {
    const scene = game.scenes.current;
    if (scene) {
      await scene.setFlag(MODULE_ID, FLAG_KEY, state);
    }
  }

  /**
   * Create default empty state.
   * @returns {Object} Default state structure
   */
  static _createDefaultState() {
    return {
      version: SCHEMA_VERSION,
      activeJournal: null,
      activeSpeaker: null,
      speakers: [],
      participants: [],
      pendingRolls: [],
      rollHistory: [],
      activeChallenges: [],
    };
  }

  /**
   * Migrate old state to current version.
   * @param {Object} oldData - Old state data
   * @returns {Object} Migrated state
   */
  static async _migrate(oldData) {
    let data = { ...oldData };

    // Migration: v1 -> v2 (add participants, pendingRolls, rollHistory)
    if (data.version === 1) {
      data = this._migrateV1ToV2(data);
    }

    // Migration: v2 -> v3 (add activeChallenge)
    if (data.version === 2) {
      data = this._migrateV2ToV3(data);
    }

    // Migration: v3 -> v4 (convert activeChallenge to activeChallenges array)
    if (data.version === 3) {
      data = this._migrateV3ToV4(data);
    }

    data.version = SCHEMA_VERSION;

    const scene = game.scenes.current;
    if (scene) {
      await scene.setFlag(MODULE_ID, FLAG_KEY, data);
    }

    return data;
  }

  /**
   * Migrate from v1 to v2.
   * Adds participants, pendingRolls, and rollHistory.
   * @param {Object} data - State data
   * @returns {Object} Migrated state
   */
  static _migrateV1ToV2(data) {
    return {
      ...data,
      participants: [],
      pendingRolls: [],
      rollHistory: [],
      version: 2
    };
  }

  /**
   * Migrate from v2 to v3.
   * Adds activeChallenge field.
   * @param {Object} data - State data
   * @returns {Object} Migrated state
   */
  static _migrateV2ToV3(data) {
    return {
      ...data,
      activeChallenge: null,
      version: 3
    };
  }

  /**
   * Migrate from v3 to v4.
   * Converts activeChallenge (singular) to activeChallenges (array).
   * @param {Object} data - State data
   * @returns {Object} Migrated state
   */
  static _migrateV3ToV4(data) {
    try {
      const migrated = { ...data };

      if (data.activeChallenge) {
        // Preserve existing challenge with timestamp
        migrated.activeChallenges = [{
          ...data.activeChallenge,
          createdAt: Date.now()
        }];
      } else {
        migrated.activeChallenges = [];
      }

      delete migrated.activeChallenge;
      migrated.version = 4;

      return migrated;
    } catch (error) {
      console.error(`${MODULE_ID} | Migration v3->v4 failed:`, error);
      // Safe fallback
      const fallback = { ...data };
      fallback.activeChallenges = [];
      delete fallback.activeChallenge;
      fallback.version = 4;
      return fallback;
    }
  }
}
