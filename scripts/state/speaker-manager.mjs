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
        name = speaker.label || game.i18n.localize('STORYFRAME.UI.Labels.Unknown');
      }
    } else {
      // Custom image path
      img = speaker.imagePath || 'icons/svg/mystery-man.svg';
      name = speaker.label;
    }

    return { img, name };
  }

  /**
   * Notify UI components of state change.
   */
  _broadcast() {
    // ApplicationV2 instances render() when state changes
    game.storyframe.gmApp?.render();
    game.storyframe.playerApp?.render();

    // Also broadcast via socket for other clients
    if (this.socketManager) {
      this.socketManager.broadcastStateUpdate();
    }
  }
}
