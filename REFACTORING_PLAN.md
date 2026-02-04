# StoryFrame Comprehensive Refactoring Plan

## Executive Summary

This plan details a complete refactoring of the StoryFrame FoundryVTT module to:
- Eliminate ~500+ lines of duplicated code
- Split the 5,000-line GM sidebar into 7 focused modules
- Extract state management into domain-specific managers
- Centralize all constants and magic values
- Improve maintainability, testability, and extensibility

**Estimated Time**: 35-48 hours total
**Risk Level**: Medium (many files affected, but systematic approach minimizes breakage)
**Testing Strategy**: Manual testing after each phase + rollback points via git commits

---

## Project Structure (Target)

```
storyframe/
├── storyframe.mjs                    # Main entry (simplified hooks)
├── scripts/
│   ├── constants.mjs                 # NEW: All constants and magic values
│   ├── utils/                        # NEW: Shared utilities
│   │   ├── element-utils.mjs
│   │   ├── validation-utils.mjs
│   │   └── dom-utils.mjs
│   ├── state/                        # REFACTORED: State management
│   │   ├── state-manager.mjs         # Orchestrator only
│   │   ├── speaker-manager.mjs       # Speaker domain
│   │   ├── participant-manager.mjs   # Participant domain
│   │   ├── roll-tracker.mjs          # Roll tracking domain
│   │   ├── challenge-manager.mjs     # Challenge domain
│   │   └── persistence.mjs           # State persistence & migration
│   ├── system/                       # REFACTORED: System-specific code
│   │   ├── system-adapter.mjs        # Base adapter (moved from scripts/)
│   │   ├── pf2e/
│   │   │   ├── skills.mjs
│   │   │   ├── actions.mjs
│   │   │   └── dc-tables.mjs
│   │   └── dnd5e/
│   │       ├── skills.mjs
│   │       └── dc-tables.mjs
│   ├── applications/
│   │   ├── gm-sidebar/               # REFACTORED: Modular sidebar
│   │   │   ├── gm-sidebar-base.mjs   # Core application shell
│   │   │   ├── gm-sidebar-pf2e.mjs   # System override (moved)
│   │   │   ├── gm-sidebar-dnd5e.mjs  # System override (moved)
│   │   │   ├── managers/
│   │   │   │   ├── speaker-manager.mjs
│   │   │   │   ├── participant-manager.mjs
│   │   │   │   ├── skill-check-manager.mjs
│   │   │   │   ├── challenge-manager.mjs
│   │   │   │   ├── journal-integration.mjs
│   │   │   │   ├── dc-manager.mjs
│   │   │   │   └── ui-manager.mjs
│   │   │   └── utils/
│   │   │       └── data-preparation.mjs
│   │   ├── player-sidebar.mjs
│   │   ├── player-viewer.mjs
│   │   ├── challenge-builder.mjs
│   │   ├── challenge-library.mjs
│   │   ├── dc-preset-manager.mjs
│   │   └── roll-request-dialog.mjs
│   ├── hooks/                        # NEW: Consolidated hooks
│   │   ├── journal-hooks.mjs
│   │   └── player-viewer-hooks.mjs
│   ├── socket-manager.mjs
│   └── check-enricher.mjs
```

---

## Implementation Phases

### **Phase 1: Foundation Setup** (4-6 hours)

Create shared infrastructure that all other phases depend on.

#### 1.1 Create Constants Module (1 hour)
**File**: `scripts/constants.mjs`

```javascript
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
```

**Migration**: Update all 9 files that define `MODULE_ID` locally to import from constants.

#### 1.2 Create Utility Modules (2-3 hours)

**File**: `scripts/utils/element-utils.mjs`
```javascript
/**
 * Extract HTMLElement from various formats (jQuery, array, raw element)
 */
export function extractElement(html, fallback = null) {
  if (Array.isArray(html)) return html[0];
  if (html instanceof HTMLElement) return html;
  if (html?.jquery) return html[0];
  if (fallback?.element) {
    const elem = fallback.element;
    return elem?.jquery ? elem[0] : elem;
  }
  return null;
}

/**
 * Extract parent element from sheet/application
 */
export function extractParentElement(parentInterface) {
  const element = parentInterface.element;
  return element instanceof HTMLElement ? element : (element[0] || element);
}
```

**File**: `scripts/utils/validation-utils.mjs`
```javascript
import { LIMITS } from '../constants.mjs';

/**
 * Validate and clamp window position to visible screen bounds
 */
export function validatePosition(saved) {
  return {
    top: Math.max(0, Math.min(saved.top || 0, window.innerHeight - LIMITS.WINDOW_MIN_TOP)),
    left: Math.max(0, Math.min(saved.left || 0, window.innerWidth - LIMITS.WINDOW_MIN_LEFT)),
    width: Math.max(LIMITS.WINDOW_MIN_WIDTH, Math.min(saved.width || 400, window.innerWidth)),
    height: Math.max(LIMITS.WINDOW_MIN_HEIGHT, Math.min(saved.height || 300, window.innerHeight)),
  };
}
```

**File**: `scripts/utils/dom-utils.mjs`
```javascript
import { SELECTORS } from '../constants.mjs';

/**
 * Find journal content element with multiple fallback selectors
 */
export function findJournalContent(element) {
  return element.querySelector(SELECTORS.JOURNAL_CONTENT) ||
         element.querySelector(SELECTORS.JOURNAL_CONTENT_ALT);
}

/**
 * Find close button with multiple fallback selectors
 */
export function findCloseButton(header) {
  return header.querySelector(SELECTORS.CLOSE_BTN) ||
         header.querySelector(SELECTORS.CLOSE_BTN_ALT) ||
         header.querySelector('.header-control[aria-label*="Close"]');
}
```

**Migration**: Update all files that duplicate element extraction or position validation.

#### 1.3 Git Checkpoint
```bash
git add scripts/constants.mjs scripts/utils/
git commit -m "refactor: add constants and utility modules

- Centralize MODULE_ID and magic values in constants.mjs
- Extract element utils for DOM manipulation
- Extract validation utils for window positioning
- Update all files to import from constants

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### **Phase 2: Hook Consolidation** (2-3 hours)

Eliminate the massive duplication in journal hooks.

#### 2.1 Create Consolidated Journal Hook Handler (1 hour)

**File**: `scripts/hooks/journal-hooks.mjs`

```javascript
import { MODULE_ID } from '../constants.mjs';
import { extractElement } from '../utils/element-utils.mjs';
import { findJournalContent } from '../utils/dom-utils.mjs';

/**
 * Unified handler for all journal sheet render hooks
 * Supports: JournalSheet, JournalEntrySheet5e, MetaMorphicJournalEntrySheet
 */
export async function handleJournalRender(sheet, html) {
  if (!game.user.isGM) return;

  const element = extractElement(html, sheet);
  if (!element) {
    console.warn('StoryFrame: Could not extract element from journal sheet', html);
    return;
  }

  // Inject sidebar toggle button
  _injectSidebarToggleButton(sheet, element);

  // Enrich checks in journal content
  const { enrichChecks } = await import('../check-enricher.mjs');
  const contentArea = findJournalContent(element);
  if (contentArea) {
    enrichChecks(contentArea);
  }

  // Auto-open sidebar if setting enabled
  const sidebar = game.storyframe.gmSidebar;
  const autoOpen = game.settings.get(MODULE_ID, 'autoOpenSidebar');

  if (autoOpen && !sidebar?.rendered) {
    await _attachSidebarToSheet(sheet);
  }

  // If sidebar is already open and attached to this sheet, refresh
  if (sidebar?.rendered && sidebar.parentInterface === sheet) {
    sidebar.render();
  }

  _updateToggleButtonState(sheet, element);
}

/**
 * Unified handler for all journal sheet close hooks
 */
export async function handleJournalClose(sheet) {
  if (!game.user.isGM) return;

  const sidebar = game.storyframe.gmSidebar;
  if (!sidebar || sidebar.parentInterface !== sheet) return;

  // Find other open journals (all supported types)
  const openJournals = Object.values(ui.windows).filter(
    (app) =>
      (app instanceof foundry.applications.sheets.journal.JournalEntrySheet ||
        app.constructor.name === 'JournalEntrySheet5e' ||
        app.constructor.name === 'MetaMorphicJournalEntrySheet') &&
      app !== sheet &&
      app.rendered,
  );

  if (openJournals.length > 0) {
    // Reattach to most recent
    const newParent = openJournals[openJournals.length - 1];
    sidebar.parentInterface = newParent;
    sidebar._stopTrackingParent();
    sidebar._startTrackingParent();
    sidebar._positionAsDrawer(3);
    _updateAllJournalToggleButtons();
  } else {
    // No journals left, close sidebar
    sidebar.close();
  }
}

// Helper functions (extracted from storyframe.mjs)
function _injectSidebarToggleButton(sheet, html) { /* ... */ }
function _updateToggleButtonState(sheet, html) { /* ... */ }
async function _toggleSidebarForSheet(sheet) { /* ... */ }
async function _attachSidebarToSheet(sheet) { /* ... */ }
function _updateAllJournalToggleButtons() { /* ... */ }
```

#### 2.2 Update Main File to Use Consolidated Hooks (30 min)

**File**: `storyframe.mjs`

```javascript
import { handleJournalRender, handleJournalClose } from './scripts/hooks/journal-hooks.mjs';

// Replace three duplicate renderJournalSheet hooks with:
Hooks.on('renderJournalSheet', handleJournalRender);
Hooks.on('renderJournalEntrySheet5e', handleJournalRender);
Hooks.on('renderMetaMorphicJournalEntrySheet', handleJournalRender);

// Replace two duplicate closeJournalSheet hooks with:
Hooks.on('closeJournalSheet', handleJournalClose);
Hooks.on('closeJournalEntrySheet5e', handleJournalClose);
```

**Result**: Eliminate ~145 lines of duplication, down to ~8 lines.

#### 2.3 Create Player Viewer Hooks (30 min)

**File**: `scripts/hooks/player-viewer-hooks.mjs`

```javascript
/**
 * Handle player viewer lifecycle with player sidebar
 */
export function handlePlayerViewerRender(viewer) {
  if (!game.user.isGM && game.storyframe?.playerSidebar) {
    const sidebar = game.storyframe.playerSidebar;
    sidebar.parentViewer = viewer;

    if (!sidebar.rendered) {
      sidebar.render(true);
    } else {
      sidebar._positionAsDrawer(3);
    }
  }
}

export function handlePlayerViewerClose() {
  if (!game.user.isGM && game.storyframe?.playerSidebar?.rendered) {
    game.storyframe.playerSidebar.close();
  }
}
```

Update `storyframe.mjs`:
```javascript
import { handlePlayerViewerRender, handlePlayerViewerClose } from './scripts/hooks/player-viewer-hooks.mjs';

Hooks.on('renderPlayerViewerApp', handlePlayerViewerRender);
Hooks.on('closePlayerViewerApp', handlePlayerViewerClose);
```

#### 2.4 Git Checkpoint
```bash
git add scripts/hooks/ storyframe.mjs
git commit -m "refactor: consolidate duplicate journal and viewer hooks

- Extract journal render/close handlers to journal-hooks.mjs
- Extract player viewer handlers to player-viewer-hooks.mjs
- Eliminate 145+ lines of duplicated hook code
- Support all journal sheet types (base, 5e, MetaMorphic)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### **Phase 3: State Management Refactoring** (6-8 hours)

Split state-manager.mjs into domain-specific managers.

#### 3.1 Create Domain Managers (4-5 hours)

**File**: `scripts/state/speaker-manager.mjs`

```javascript
import { MODULE_ID } from '../constants.mjs';

export class SpeakerManager {
  constructor(socketManager) {
    this.socketManager = socketManager;
    this.speakers = [];
    this.activeSpeakerIndex = null;
  }

  async addSpeaker(speakerData) { /* ... */ }
  async removeSpeaker(index) { /* ... */ }
  async setActiveSpeaker(index) { /* ... */ }
  async clearActiveSpeaker() { /* ... */ }
  async clearAllSpeakers() { /* ... */ }

  getSpeakers() { return this.speakers; }
  getActiveSpeaker() { /* ... */ }
  resolveSpeakerName(speaker) { /* ... */ }

  // Private helpers
  _broadcastUpdate() { /* ... */ }
}
```

**File**: `scripts/state/participant-manager.mjs`

```javascript
export class ParticipantManager {
  constructor(socketManager) {
    this.socketManager = socketManager;
    this.participants = [];
  }

  async addParticipant(participantData) { /* ... */ }
  async removeParticipant(actorId) { /* ... */ }
  async clearAllParticipants() { /* ... */ }

  getParticipants() { return this.participants; }
  resolveParticipantName(participant) { /* ... */ }

  _broadcastUpdate() { /* ... */ }
}
```

**File**: `scripts/state/roll-tracker.mjs`

```javascript
import { LIMITS } from '../constants.mjs';

export class RollTracker {
  constructor(socketManager) {
    this.socketManager = socketManager;
    this.pendingRolls = [];
    this.rollHistory = [];
  }

  async addPendingRoll(rollData) { /* ... */ }
  async clearPendingRolls() { /* ... */ }
  async recordRollResult(rollData) { /* ... */ }

  getPendingRolls() { return this.pendingRolls; }
  getRollHistory() { return this.rollHistory; }

  // Trim history to max length
  _trimHistory() {
    if (this.rollHistory.length > LIMITS.ROLL_HISTORY_MAX) {
      this.rollHistory = this.rollHistory.slice(-LIMITS.ROLL_HISTORY_MAX);
    }
  }

  _broadcastUpdate() { /* ... */ }
}
```

**File**: `scripts/state/challenge-manager.mjs`

```javascript
export class ChallengeManager {
  constructor(socketManager) {
    this.socketManager = socketManager;
    this.activeChallenges = [];
  }

  async addChallenge(challengeData) { /* ... */ }
  async removeChallenge(challengeId) { /* ... */ }
  async clearAllChallenges() { /* ... */ }

  getActiveChallenges() { return this.activeChallenges; }
  getChallengeById(id) { /* ... */ }

  _broadcastUpdate() { /* ... */ }
}
```

**File**: `scripts/state/persistence.mjs`

```javascript
import { MODULE_ID, FLAG_KEY, SCHEMA_VERSION } from '../constants.mjs';

export class StatePersistence {
  static async load() {
    const scene = game.scenes.current;
    if (!scene) return null;

    const flags = scene.getFlag(MODULE_ID, FLAG_KEY) || {};

    // Perform migrations if needed
    if (flags.version < SCHEMA_VERSION) {
      return await this.migrate(flags);
    }

    return flags;
  }

  static async save(state) {
    const scene = game.scenes.current;
    if (!scene) return;

    await scene.setFlag(MODULE_ID, FLAG_KEY, {
      ...state,
      version: SCHEMA_VERSION,
    });
  }

  static async migrate(oldData) {
    // Migration logic extracted from state-manager.mjs
    // v1 -> v2, v2 -> v3, v3 -> v4
    /* ... */
  }
}
```

#### 3.2 Refactor StateManager to Orchestrator (1-2 hours)

**File**: `scripts/state/state-manager.mjs`

```javascript
import { SpeakerManager } from './speaker-manager.mjs';
import { ParticipantManager } from './participant-manager.mjs';
import { RollTracker } from './roll-tracker.mjs';
import { ChallengeManager } from './challenge-manager.mjs';
import { StatePersistence } from './persistence.mjs';

export class StateManager {
  constructor() {
    // Domain managers (injected with socket manager later)
    this.speakerManager = null;
    this.participantManager = null;
    this.rollTracker = null;
    this.challengeManager = null;
  }

  initialize(socketManager) {
    this.speakerManager = new SpeakerManager(socketManager);
    this.participantManager = new ParticipantManager(socketManager);
    this.rollTracker = new RollTracker(socketManager);
    this.challengeManager = new ChallengeManager(socketManager);
  }

  async load() {
    const data = await StatePersistence.load();
    if (!data) return;

    // Distribute to domain managers
    this.speakerManager.speakers = data.speakers || [];
    this.speakerManager.activeSpeakerIndex = data.activeSpeakerIndex ?? null;
    this.participantManager.participants = data.participants || [];
    this.rollTracker.pendingRolls = data.pendingRolls || [];
    this.rollTracker.rollHistory = data.rollHistory || [];
    this.challengeManager.activeChallenges = data.activeChallenges || [];
  }

  async save() {
    const state = {
      speakers: this.speakerManager.speakers,
      activeSpeakerIndex: this.speakerManager.activeSpeakerIndex,
      participants: this.participantManager.participants,
      pendingRolls: this.rollTracker.pendingRolls,
      rollHistory: this.rollTracker.rollHistory,
      activeChallenges: this.challengeManager.activeChallenges,
    };

    await StatePersistence.save(state);
  }

  getState() {
    return {
      speakers: this.speakerManager.getSpeakers(),
      activeSpeaker: this.speakerManager.getActiveSpeaker(),
      participants: this.participantManager.getParticipants(),
      pendingRolls: this.rollTracker.getPendingRolls(),
      rollHistory: this.rollTracker.getRollHistory(),
      activeChallenges: this.challengeManager.getActiveChallenges(),
    };
  }

  // Delegate methods to domain managers
  async addSpeaker(data) { return this.speakerManager.addSpeaker(data); }
  async removeSpeaker(index) { return this.speakerManager.removeSpeaker(index); }
  // ... (delegate all public methods)
}
```

#### 3.3 Update Dependencies (1 hour)

Update all files that reference `stateManager` methods:
- `storyframe.mjs`
- `gm-sidebar.mjs`
- `player-viewer.mjs`
- `socket-manager.mjs`

Ensure delegation works correctly.

#### 3.4 Git Checkpoint
```bash
git add scripts/state/
git commit -m "refactor: split state management into domain managers

- Extract SpeakerManager, ParticipantManager, RollTracker, ChallengeManager
- Extract StatePersistence with migration logic
- Convert StateManager to orchestrator/coordinator
- Improve separation of concerns and testability

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### **Phase 4: GM Sidebar Modularization** (16-20 hours)

This is the largest refactoring - split 5,000-line file into focused modules.

#### 4.1 Create Manager Modules (8-10 hours)

**File**: `scripts/applications/gm-sidebar/managers/speaker-manager.mjs`

Extract 15 speaker-related methods from gm-sidebar.mjs:
- `_onAddSpeakerFromImage`
- `_onSetSpeaker`
- `_onRemoveSpeaker`
- `_onClearSpeaker`
- `_onClearAllSpeakers`
- `_onSetImageAsSpeaker`
- `_onSetActorAsSpeaker`
- `_extractJournalImages`
- `_extractJournalActors`
- `_normalizeImagePath`
- `_extractActorIdFromUuid`
- `_showEnlargedImage`
- Plus helpers

```javascript
export class GMSidebarSpeakerManager {
  constructor(sidebar) {
    this.sidebar = sidebar; // Reference to main sidebar
  }

  async handleAddSpeakerFromImage(event) { /* ... */ }
  async handleSetSpeaker(event) { /* ... */ }
  // ...

  extractJournalImages() { /* ... */ }
  extractJournalActors() { /* ... */ }
}
```

**Similar files** (each 200-400 lines):
- `scripts/applications/gm-sidebar/managers/participant-manager.mjs`
- `scripts/applications/gm-sidebar/managers/skill-check-manager.mjs`
- `scripts/applications/gm-sidebar/managers/challenge-manager.mjs`
- `scripts/applications/gm-sidebar/managers/journal-integration.mjs`
- `scripts/applications/gm-sidebar/managers/dc-manager.mjs`
- `scripts/applications/gm-sidebar/managers/ui-manager.mjs`

#### 4.2 Create Data Preparation Utility (2 hours)

**File**: `scripts/applications/gm-sidebar/utils/data-preparation.mjs`

Extract template data preparation logic:
```javascript
export function prepareSpeakersContext(speakers, activeSpeakerIndex) { /* ... */ }
export function prepareParticipantsContext(participants, skillManager) { /* ... */ }
export function prepareChallengesContext(challenges) { /* ... */ }
export function prepareRollsContext(pendingRolls) { /* ... */ }
```

#### 4.3 Refactor Main Sidebar (3-4 hours)

**File**: `scripts/applications/gm-sidebar/gm-sidebar-base.mjs`

```javascript
import { GMSidebarSpeakerManager } from './managers/speaker-manager.mjs';
import { GMSidebarParticipantManager } from './managers/participant-manager.mjs';
// ... import all managers

export class GMSidebarAppBase extends foundry.applications.api.ApplicationV2 {
  constructor(options = {}) {
    super(options);

    // Initialize managers (dependency injection)
    this.speakerManager = new GMSidebarSpeakerManager(this);
    this.participantManager = new GMSidebarParticipantManager(this);
    this.skillCheckManager = new GMSidebarSkillCheckManager(this);
    this.challengeManager = new GMSidebarChallengeManager(this);
    this.journalIntegration = new GMSidebarJournalIntegration(this);
    this.dcManager = new GMSidebarDCManager(this);
    this.uiManager = new GMSidebarUIManager(this);

    // State
    this.parentInterface = null;
    this.activeTab = 'npcs';
    this.secretRoll = false;
    // ...
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const state = game.storyframe.stateManager.getState();

    // Delegate to data preparation utilities
    context.speakers = prepareSpeakersContext(state.speakers, state.activeSpeakerIndex);
    context.participants = prepareParticipantsContext(state.participants, this.skillCheckManager);
    context.challenges = prepareChallengesContext(state.activeChallenges);
    context.rolls = prepareRollsContext(state.pendingRolls);

    // Journal integration
    context.journalChecks = this.journalIntegration.extractJournalChecks();
    context.journalImages = this.speakerManager.extractJournalImages();
    context.journalActors = this.speakerManager.extractJournalActors();

    // System-specific context
    Object.assign(context, this._prepareContextSystemSpecific());

    return context;
  }

  // Event handlers delegate to managers
  _onAddSpeakerFromImage(event) {
    return this.speakerManager.handleAddSpeakerFromImage(event);
  }

  _onRequestSkill(event) {
    return this.skillCheckManager.handleRequestSkill(event);
  }

  // ... (mostly delegation)

  // Abstract methods for system overrides
  _parseChecksFromContent(content) { return []; }
  _getAvailableSkills() { return new Set(); }
  _prepareContextSystemSpecific() { return {}; }
  // ...
}
```

**File**: `scripts/applications/gm-sidebar/gm-sidebar-pf2e.mjs` (moved from scripts/applications/)

No changes to logic, just update imports:
```javascript
import { GMSidebarAppBase } from './gm-sidebar-base.mjs';

export class GMSidebarAppPF2e extends GMSidebarAppBase {
  // System overrides (unchanged)
}
```

#### 4.4 Update Main File Import (30 min)

**File**: `storyframe.mjs`

```javascript
// Old: import from ./scripts/applications/gm-sidebar.mjs
// New:
import { GMSidebarAppBase } from './scripts/applications/gm-sidebar/gm-sidebar-base.mjs';
import { GMSidebarAppPF2e } from './scripts/applications/gm-sidebar/gm-sidebar-pf2e.mjs';
import { GMSidebarAppDND5e } from './scripts/applications/gm-sidebar/gm-sidebar-dnd5e.mjs';
```

#### 4.5 Git Checkpoint
```bash
git add scripts/applications/gm-sidebar/
git commit -m "refactor: modularize GM sidebar into focused managers

- Extract 7 manager modules (speaker, participant, skill, challenge, journal, dc, ui)
- Extract data preparation utilities
- Convert GMSidebarAppBase to orchestrator with dependency injection
- Move system overrides to gm-sidebar/ directory
- Reduce main sidebar file from 5000 to ~800 lines

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### **Phase 5: System-Specific Code Consolidation** (4-5 hours)

Reorganize system-specific data into focused modules.

#### 5.1 Create System Data Modules (3 hours)

**File**: `scripts/system/pf2e/skills.mjs`

```javascript
export const PF2E_SKILLS = {
  per: {
    name: 'Perception',
    actions: [
      { slug: 'seek', name: 'Seek' },
      { slug: 'sense-direction', name: 'Sense Direction' },
      { slug: 'sense-motive', name: 'Sense Motive' },
    ],
  },
  // ... (extracted from system-adapter.mjs)
};
```

**File**: `scripts/system/pf2e/actions.mjs`

```javascript
export const PF2E_ACTION_DISPLAY_NAMES = {
  'seek': 'Seek',
  'sense-direction': 'Sense Direction',
  // ... (extracted from player-viewer.mjs)
};
```

**File**: `scripts/system/pf2e/dc-tables.mjs`

```javascript
export const PF2E_DC_BY_LEVEL = {
  0: 14,
  1: 15,
  // ... (extracted from system-adapter.mjs)
};

export const PF2E_DIFFICULTY_ADJUSTMENTS = [
  { id: 'trivial', label: 'Trivial', adjustment: -10 },
  // ...
];
```

Similar structure for `scripts/system/dnd5e/`.

#### 5.2 Update System Adapter (1 hour)

**File**: `scripts/system/system-adapter.mjs` (moved to scripts/system/)

```javascript
import { PF2E_SKILLS } from './pf2e/skills.mjs';
import { PF2E_DC_BY_LEVEL, PF2E_DIFFICULTY_ADJUSTMENTS } from './pf2e/dc-tables.mjs';
import { DND5E_SKILLS } from './dnd5e/skills.mjs';
import { DND5E_DC_BY_DIFFICULTY } from './dnd5e/dc-tables.mjs';
import { SYSTEMS } from '../constants.mjs';

export function detectSystem() {
  const systemId = game.system.id;
  if (systemId === SYSTEMS.PF2E) return SYSTEMS.PF2E;
  if (systemId === SYSTEMS.DND5E) return SYSTEMS.DND5E;
  return SYSTEMS.OTHER;
}

export function getSkills() {
  const system = detectSystem();
  switch (system) {
    case SYSTEMS.PF2E: return PF2E_SKILLS;
    case SYSTEMS.DND5E: return DND5E_SKILLS;
    default: return {};
  }
}

// ... (simplified, uses imported constants)
```

#### 5.3 Update Check Enricher (30 min)

**File**: `scripts/check-enricher.mjs`

Consolidate SKILL_NAME_MAP with system adapter data to avoid duplication.

#### 5.4 Git Checkpoint
```bash
git add scripts/system/
git commit -m "refactor: consolidate system-specific data into modules

- Extract PF2e and D&D5e data into dedicated directories
- Split skills, actions, and DC tables into separate files
- Move system-adapter.mjs to scripts/system/
- Eliminate fragmentation of system data across files

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### **Phase 6: Final Cleanup & Testing** (3-4 hours)

#### 6.1 Update All Imports (1-2 hours)

Systematic update of all import statements across:
- `player-sidebar.mjs`
- `player-viewer.mjs`
- `challenge-builder.mjs`
- `challenge-library.mjs`
- `dc-preset-manager.mjs`
- `roll-request-dialog.mjs`
- `socket-manager.mjs`

Ensure all files import from new locations:
- `MODULE_ID` from `constants.mjs`
- System adapter from `system/system-adapter.mjs`
- Utilities from `utils/`

#### 6.2 Manual Testing (1-2 hours)

Test all core workflows:

**GM Workflows:**
1. Open journal → sidebar appears
2. Add speaker from image → renders correctly
3. Add participants → selection works
4. Request skill check → player receives request
5. View pending rolls → displays correctly
6. Create challenge → saves to library
7. Present challenge → displays for players
8. Switch tabs → all tabs render
9. Close journal → sidebar reattaches or closes

**Player Workflows:**
1. Receive skill request → dialog appears
2. Roll skill → result recorded
3. View player viewer → speakers display
4. Challenge presented → options display
5. Select challenge option → roll submitted

**Edge Cases:**
1. Multiple open journals
2. Scene change
3. System-specific features (PF2e difficulty, D&D5e DCs)
4. Migration from old version (if applicable)

#### 6.3 Documentation Update (30 min)

Update README or add ARCHITECTURE.md explaining new structure:

```markdown
# StoryFrame Architecture

## Directory Structure

- `/scripts/constants.mjs` - Centralized constants
- `/scripts/utils/` - Shared utilities
- `/scripts/state/` - State management (domain managers)
- `/scripts/system/` - System-specific data (PF2e, D&D5e)
- `/scripts/hooks/` - Consolidated Foundry hooks
- `/scripts/applications/gm-sidebar/` - Modular GM sidebar
  - `/managers/` - Domain-specific UI managers
  - `/utils/` - Sidebar-specific utilities

## Key Patterns

### Dependency Injection
Managers receive sidebar reference in constructor for access to shared state.

### Domain Separation
Each manager handles one responsibility (speakers, participants, skills, etc.).

### System Abstraction
System-specific code isolated in `/system/` with adapter pattern.
```

#### 6.4 Final Git Checkpoint
```bash
git add .
git commit -m "refactor: finalize refactoring and update documentation

- Update all imports to new module locations
- Add ARCHITECTURE.md documenting new structure
- Manual testing confirms all workflows functional
- Complete comprehensive refactoring initiative

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Risk Mitigation

### Rollback Strategy
Each phase has a git checkpoint. If issues arise:
```bash
git revert <commit-hash>  # Revert specific phase
git reset --hard <commit-hash>  # Full rollback to checkpoint
```

### Testing Between Phases
After each phase commit:
1. Reload Foundry
2. Check browser console for errors
3. Test basic functionality
4. Proceed to next phase only if stable

### Gradual Migration
Phases are ordered by dependency:
1. Foundation (constants, utils) - safe, leaf dependencies
2. Hooks - isolated, easy to test
3. State - moderate risk, well-contained
4. Sidebar - highest risk, but builds on stable foundation
5. System data - cosmetic, low risk
6. Cleanup - polish only

---

## Success Metrics

### Quantitative
- **Lines of code reduced**: ~500+ lines eliminated
- **File count**: +25 files (better organization)
- **Largest file size**: 5000 → ~800 lines (83% reduction)
- **Code duplication**: ~0% (vs ~15% before)

### Qualitative
- **Maintainability**: Each file has single responsibility
- **Testability**: Managers can be unit tested
- **Extensibility**: Easy to add new systems or features
- **Readability**: Clear module boundaries, easier onboarding

---

## Timeline Summary

| Phase | Estimated Time | Risk Level |
|-------|---------------|------------|
| Phase 1: Foundation | 4-6 hours | Low |
| Phase 2: Hook Consolidation | 2-3 hours | Low |
| Phase 3: State Management | 6-8 hours | Medium |
| Phase 4: Sidebar Modularization | 16-20 hours | Medium-High |
| Phase 5: System Data | 4-5 hours | Low |
| Phase 6: Cleanup & Testing | 3-4 hours | Low |
| **Total** | **35-48 hours** | **Medium** |

---

## Implementation Notes

- Work in order: Phases 1-6 sequentially
- Commit after each phase
- Test thoroughly after Phases 3, 4, 6
- If stuck, rollback to previous checkpoint
- Consider pair programming for Phase 4 (largest refactor)
