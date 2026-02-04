/**
 * StoryFrame Module Constants
 * Centralized constants and configuration values
 */

// Module identification
export const MODULE_ID = 'storyframe';
export const FLAG_KEY = 'data';
export const SCHEMA_VERSION = 4;

// System IDs
export const SYSTEMS = {
  PF2E: 'pf2e',
  DND5E: 'dnd5e',
  OTHER: 'other',
};

// Tab identifiers
export const TABS = {
  NPCS: 'npcs',
  PCS: 'pcs',
  CHALLENGES: 'challenges',
  ROLLS: 'rolls',
};

// Limits and thresholds
export const LIMITS = {
  ROLL_HISTORY_MAX: 50,
  RETRY_COUNT: 3,
  WINDOW_MIN_WIDTH: 200,
  WINDOW_MIN_HEIGHT: 150,
  WINDOW_MIN_TOP: 50,
  WINDOW_MIN_LEFT: 100,
};

// DOM selectors
export const SELECTORS = {
  WINDOW_HEADER: '.window-header',
  CLOSE_BTN: '.close',
  CLOSE_BTN_ALT: '[data-action="close"]',
  JOURNAL_CONTENT: '.journal-page-content',
  JOURNAL_CONTENT_ALT: '.journal-entry-content',
};

// Event names
export const EVENTS = {
  STATE_UPDATED: 'storyframe:stateUpdated',
  SPEAKER_CHANGED: 'storyframe:speakerChanged',
  PARTICIPANT_CHANGED: 'storyframe:participantChanged',
};
