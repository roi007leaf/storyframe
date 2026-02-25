import { MODULE_ID, FLAG_KEY } from '../constants.mjs';

/**
 * Manages speaker state and operations.
 * Handles speaker CRUD operations, validation, and resolution.
 */
export class SpeakerManager {
  constructor(socketManager, state) {
    this.socketManager = socketManager;
    this.state = state;
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

    // Persist + broadcast to other clients only, skip local re-render
    // (caller handles DOM update directly)
    game.storyframe.stateManager._suppressNextRender = true;
    await scene.setFlag(MODULE_ID, FLAG_KEY, this.state);
    if (this.socketManager) this.socketManager.broadcastStateToOthers();
  }

  /**
   * Add a speaker to the list.
   * @param {Object} speaker - Speaker data (actorUuid or imagePath, label, isNameHidden)
   * @returns {Object} Created speaker with ID, or existing speaker if duplicate
   */
  async addSpeaker({ actorUuid = null, imagePath = null, label, isNameHidden = false, altImages = [] }) {
    if (!this.state) return null;

    // Check for duplicate by actorUuid or imagePath
    if (actorUuid) {
      const existing = this.state.speakers.find((s) => s.actorUuid === actorUuid);
      if (existing) {
        const msg = game.i18n.format('STORYFRAME.Notifications.Speaker.AlreadyInList', { label: label || 'NPC' });
        ui.notifications.info(msg);
        return existing;
      }
    } else if (imagePath) {
      const existing = this.state.speakers.find((s) => s.imagePath === imagePath);
      if (existing) {
        const msg = game.i18n.format('STORYFRAME.Notifications.Speaker.AlreadyInList', { label: label || 'NPC' });
        ui.notifications.info(msg);
        return existing;
      }
    }

    const speaker = {
      id: foundry.utils.randomID(),
      actorUuid,
      imagePath,
      label,
      isNameHidden,
      isHidden: false,
      altImages: Array.isArray(altImages) ? altImages : [],
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
   * Toggle speaker name visibility for players.
   * @param {string} speakerId - Speaker ID to toggle
   */
  async toggleSpeakerNameVisibility(speakerId) {
    if (!this.state) return;

    const speaker = this.state.speakers.find((s) => s.id === speakerId);
    if (!speaker) return;

    speaker.isNameHidden = !speaker.isNameHidden;

    await this.updateSpeakers(this.state.speakers);
  }

  /**
   * Toggle speaker hidden from player view entirely.
   * @param {string} speakerId - Speaker ID to toggle
   */
  async toggleSpeakerHidden(speakerId) {
    if (!this.state) return;

    const speaker = this.state.speakers.find((s) => s.id === speakerId);
    if (!speaker) return;

    speaker.isHidden = !speaker.isHidden;
    await this.updateSpeakers(this.state.speakers);
  }

  /**
   * Set the active image for a speaker (cycling through altImages).
   * @param {string} speakerId - Speaker ID
   * @param {string} imagePath - New active image path
   */
  async setSpeakerImage(speakerId, imagePath) {
    if (!this.state) return;

    const speaker = this.state.speakers.find((s) => s.id === speakerId);
    if (!speaker) return;

    // Just set the active image — actor portrait and token image are derived dynamically,
    // so we never need to rotate them in/out of altImages (which holds only custom images)
    speaker.imagePath = imagePath;

    // Persist + broadcast to other clients only, skip local re-render
    // (callers handle DOM update directly to avoid resetting window size)
    game.storyframe.stateManager._suppressNextRender = true;
    const scene = game.scenes.current;
    if (scene) {
      await scene.setFlag(MODULE_ID, FLAG_KEY, this.state);
      if (this.socketManager) this.socketManager.broadcastStateToOthers();
    }
  }

  /**
   * Add an alternate image to a speaker's collection.
   * @param {string} speakerId - Speaker ID
   * @param {string} img - Image path to add
   */
  async addSpeakerAltImage(speakerId, img) {
    if (!this.state) return;

    const speaker = this.state.speakers.find((s) => s.id === speakerId);
    if (!speaker) return;

    if (!speaker.altImages) speaker.altImages = [];
    if (!speaker.altImages.includes(img) && speaker.imagePath !== img) {
      speaker.altImages.push(img);
      await this.updateSpeakers(this.state.speakers);
    }
  }

  async removeSpeakerAltImage(speakerId, img) {
    if (!this.state) return;

    const speaker = this.state.speakers.find((s) => s.id === speakerId);
    if (!speaker) return;

    speaker.altImages = (speaker.altImages || []).filter((i) => i !== img);
    // If the removed image was active, fall back to actor portrait
    if (speaker.imagePath === img) speaker.imagePath = null;

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
        // Use imagePath override if set, otherwise fall back to actor portrait
        img = speaker.imagePath || actor.img;
        name = actor.name;
      } else {
        // Actor deleted - use fallback
        img = speaker.imagePath || 'icons/svg/mystery-man.svg';
        name = speaker.label || game.i18n.localize('STORYFRAME.UI.Labels.Unknown');
      }
    } else {
      // Custom image path
      img = speaker.imagePath || 'icons/svg/mystery-man.svg';
      name = speaker.label;
    }

    // Hide name from players if flag is set
    if (speaker.isNameHidden && !game.user.isGM) {
      name = game.i18n.localize('STORYFRAME.UI.Labels.Unknown');
    }

    return { img, name };
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
