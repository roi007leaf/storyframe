const MODULE_ID = 'storyframe';

/**
 * Player Viewer for StoryFrame
 * Read-only window showing current speaker portrait and name
 */
export class PlayerViewerApp extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: 'storyframe-player-viewer',
    classes: ['storyframe', 'player-viewer'],
    window: {
      title: 'StoryFrame - Current Speaker',
      resizable: true,
      minimizable: true,
      icon: 'fas fa-user'
    },
    position: {
      width: 300,
      height: 400
    }
  };

  static PARTS = {
    content: {
      template: 'modules/storyframe/templates/player-viewer.hbs'
    }
  };

  async _prepareContext(options) {
    const state = game.storyframe.stateManager.getState();

    // No active speaker - show empty state
    if (!state?.activeSpeaker) {
      return { noSpeaker: true };
    }

    // Find speaker in list
    const speaker = state.speakers.find(s => s.id === state.activeSpeaker);
    if (!speaker) {
      console.warn(`${MODULE_ID} | Active speaker ID not found in speaker list`);
      return { noSpeaker: true };
    }

    // Resolve actor with deleted handling
    const speakerData = await this._resolveSpeaker(speaker);

    return {
      speaker: speakerData,
      noSpeaker: false
    };
  }

  async _resolveSpeaker(speaker) {
    if (speaker.actorUuid) {
      const actor = await fromUuid(speaker.actorUuid);
      if (actor) {
        return {
          img: actor.img,
          name: actor.name
        };
      } else {
        // Actor deleted - use fallback
        return {
          img: speaker.imagePath || 'icons/svg/mystery-man.svg',
          name: speaker.label || 'Unknown'
        };
      }
    } else {
      // Custom image path
      return {
        img: speaker.imagePath || 'icons/svg/mystery-man.svg',
        name: speaker.label
      };
    }
  }
}
