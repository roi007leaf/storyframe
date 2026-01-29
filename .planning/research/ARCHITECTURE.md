# Architecture Research

**Domain:** FoundryVTT v13 Module (GM Tool + Player Viewer)
**Researched:** 2026-01-29
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐         ┌─────────────────┐            │
│  │   GM Control    │         │  Player Viewer  │            │
│  │  ApplicationV2  │         │  ApplicationV2  │            │
│  └────────┬────────┘         └────────┬────────┘            │
│           │                           │                      │
├───────────┴───────────────────────────┴──────────────────────┤
│                  Communication Layer                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Socket Manager                          │    │
│  │  (Broadcast: GM → All Players)                      │    │
│  │  (Queries: GM execution proxy)                      │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│                    Data Layer                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Document     │  │ Module       │  │ Actor UUID   │       │
│  │ Flags        │  │ Settings     │  │ Resolution   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| GM Control App | Story selection, speaker management, controls | ApplicationV2 extending HandlebarsApplicationMixin |
| Player Viewer | Read-only display synced with GM state | Separate ApplicationV2 with minimal controls |
| Socket Manager | Real-time broadcast of state changes | game.socket.emit() or socketlib wrapper |
| Document Flags | Persistent state storage (current story, speakers) | JournalEntry.setFlag() or Scene.setFlag() |
| Module Settings | User preferences, configuration | game.settings.register() |
| Actor UUID Resolver | Convert stored UUIDs to Actor references | fromUuid() async resolution |

## Recommended Project Structure

```
storyframe/
├── module.json              # Manifest with socket: true
├── scripts/
│   ├── storyframe.js        # Entry point (Hooks.once init/ready)
│   ├── apps/
│   │   ├── GMControlApp.js  # GM ApplicationV2 (story picker, controls)
│   │   └── PlayerViewer.js  # Player ApplicationV2 (display only)
│   ├── socket/
│   │   └── SocketManager.js # Centralized socket communication
│   ├── data/
│   │   ├── StateManager.js  # Document flags read/write
│   │   └── ActorResolver.js # UUID → Actor resolution
│   └── utils/
│       └── permissions.js   # GM check, player filtering
├── templates/
│   ├── gm-control.hbs       # GM interface template
│   └── player-viewer.hbs    # Player display template
├── styles/
│   ├── gm-control.css       # GM app styling
│   └── player-viewer.css    # Player viewer styling
└── lang/
    └── en.json              # Localization strings
```

### Structure Rationale

- **scripts/apps/:** Two separate ApplicationV2 classes for role separation (GM vs Player)
- **scripts/socket/:** Centralized socket logic prevents scattered emit/on calls
- **scripts/data/:** Abstraction layer over flags/settings separates persistence from UI
- **templates/:** One template per ApplicationV2 for PARTS property
- **No build step required:** ES modules directly, no bundler needed for v13

## Architectural Patterns

### Pattern 1: Dual ApplicationV2 with Role-Based Rendering

**What:** Two ApplicationV2 instances (GM and Player) with same data source, different permissions

**When to use:** GM tool requires controls, players need read-only synchronized view

**Trade-offs:**
- PRO: Clean separation of concerns, independent styling/behavior
- PRO: Players can open/close viewer independently of GM
- CON: Two templates to maintain, must keep data models in sync

**Example:**
```typescript
// GMControlApp.js
export class GMControlApp extends foundry.applications.api.HandlebarsApplication {
  static DEFAULT_OPTIONS = {
    id: "storyframe-gm",
    position: { width: 600, height: 800 },
    window: { title: "StoryFrame Control" }
  };

  static PARTS = {
    form: { template: "modules/storyframe/templates/gm-control.hbs" }
  };

  async _prepareContext(options) {
    const state = await StateManager.getState();
    return {
      ...state,
      isGM: game.user.isGM,
      journals: game.journal.filter(j => j.canUserModify(game.user, "update"))
    };
  }

  _onClickAction(event, target) {
    if (target.dataset.action === "broadcast") {
      SocketManager.broadcastState(this.currentState);
    }
  }
}

// PlayerViewer.js
export class PlayerViewer extends foundry.applications.api.HandlebarsApplication {
  static DEFAULT_OPTIONS = {
    id: "storyframe-player",
    position: { width: 800, height: 600 },
    window: { title: "StoryFrame" }
  };

  static PARTS = {
    content: { template: "modules/storyframe/templates/player-viewer.hbs" }
  };

  async _prepareContext(options) {
    const state = await StateManager.getState();
    return {
      ...state,
      isGM: false, // Force read-only rendering
      canEdit: false
    };
  }
}
```

### Pattern 2: Centralized Socket Manager

**What:** Single class handles all socket emit/on registration, namespace enforcement

**When to use:** Multiple components need socket communication, prevent event name collisions

**Trade-offs:**
- PRO: Single source of truth for socket events, easier debugging
- PRO: Enforces module.storyframe namespace automatically
- CON: All components depend on SocketManager, can't use sockets directly

**Example:**
```typescript
// SocketManager.js
export class SocketManager {
  static EVENTS = {
    STATE_UPDATE: "module.storyframe.stateUpdate",
    REQUEST_SYNC: "module.storyframe.requestSync"
  };

  static initialize() {
    game.socket.on(this.EVENTS.STATE_UPDATE, this._onStateUpdate.bind(this));
    game.socket.on(this.EVENTS.REQUEST_SYNC, this._onRequestSync.bind(this));
  }

  static async broadcastState(state) {
    if (!game.user.isGM) return; // Only GM can broadcast

    // Persist first, then broadcast
    await StateManager.setState(state);
    game.socket.emit(this.EVENTS.STATE_UPDATE, state);
  }

  static _onStateUpdate(state) {
    // Re-render all open viewer windows
    Object.values(ui.windows).forEach(app => {
      if (app instanceof PlayerViewer) {
        app.render();
      }
    });
  }

  static async requestSync() {
    game.socket.emit(this.EVENTS.REQUEST_SYNC, { userId: game.user.id });
  }

  static async _onRequestSync(data) {
    if (!game.user.isGM) return; // Only GM responds

    const state = await StateManager.getState();
    game.socket.emit(this.EVENTS.STATE_UPDATE, state);
  }
}
```

### Pattern 3: Document Flags for State Persistence

**What:** Store module state in Document flags (Scene or JournalEntry), not module settings

**When to use:** State must be world-specific and synchronized across all clients

**Trade-offs:**
- PRO: Automatically saved to database, survives server restart
- PRO: GM-editable, respects permissions
- CON: Requires document to exist (usually active Scene)
- CON: setFlag() triggers database writes (don't spam)

**Example:**
```typescript
// StateManager.js
export class StateManager {
  static FLAG_SCOPE = "storyframe";

  static async getState() {
    const scene = game.scenes.current;
    if (!scene) return this._getDefaultState();

    return scene.getFlag(this.FLAG_SCOPE, "viewerState") || this._getDefaultState();
  }

  static async setState(state) {
    const scene = game.scenes.current;
    if (!scene) {
      console.warn("StoryFrame: No active scene, state not persisted");
      return;
    }

    await scene.setFlag(this.FLAG_SCOPE, "viewerState", state);
  }

  static _getDefaultState() {
    return {
      currentJournalUuid: null,
      currentPageId: null,
      speakerUuids: [], // Array of Actor UUIDs
      layout: "gallery" // "gallery" | "row" | "single"
    };
  }
}
```

### Pattern 4: Actor UUID Resolution with Error Handling

**What:** Store Actor UUIDs as strings, resolve to Actor documents on demand

**When to use:** Referencing Actors across scenes/compendia, must survive Actor deletion

**Trade-offs:**
- PRO: Works cross-scene, cross-compendium
- PRO: Handles Actor deletion gracefully (null check)
- CON: Async resolution required (can't access synchronously)
- CON: Stale references if Actor deleted

**Example:**
```typescript
// ActorResolver.js
export class ActorResolver {
  static async resolveMany(uuids) {
    const resolved = await Promise.all(
      uuids.map(uuid => fromUuid(uuid))
    );

    // Filter out null (deleted Actors), return only valid
    return resolved.filter(actor => actor && actor.documentName === "Actor");
  }

  static async resolveSingle(uuid) {
    if (!uuid) return null;

    const actor = await fromUuid(uuid);
    return (actor && actor.documentName === "Actor") ? actor : null;
  }

  static async getDisplayData(uuid) {
    const actor = await this.resolveSingle(uuid);
    if (!actor) {
      return { name: "(Deleted)", img: "icons/svg/mystery-man.svg" };
    }

    return {
      name: actor.name,
      img: actor.img,
      uuid: actor.uuid
    };
  }
}
```

## Data Flow

### GM Broadcast Flow

```
[GM User Action]
    ↓
[GMControlApp._onClickAction]
    ↓
[StateManager.setState] → [Scene.setFlag] → [Database Write]
    ↓
[SocketManager.broadcastState] → [game.socket.emit]
    ↓
[All Clients Receive] → [PlayerViewer._onStateUpdate]
    ↓
[PlayerViewer.render] → [Display Updates]
```

### Player Join Flow

```
[Player Connects]
    ↓
[Hooks.once ready]
    ↓
[SocketManager.requestSync]
    ↓
[GM Receives] → [SocketManager._onRequestSync]
    ↓
[StateManager.getState] → [Scene.getFlag] → [Cached State]
    ↓
[SocketManager.broadcastState] → [Player Receives]
    ↓
[PlayerViewer Renders]
```

### Key Data Flows

1. **State Persistence:** GMControlApp → StateManager → Document Flags → Database
2. **Real-time Broadcast:** SocketManager.emit() → All Clients → PlayerViewer.render()
3. **Actor Resolution:** Stored UUIDs → ActorResolver.resolveMany() → Display Data

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-10 players | Base architecture sufficient, direct socket broadcast |
| 10-50 players | Throttle socket emits (debounce rapid changes), lazy-load Actor images |
| 50+ players | Consider socketlib for GM proxy execution, paginate speaker gallery |

### Scaling Priorities

1. **First bottleneck:** Socket spam from rapid GM updates
   - **Fix:** Debounce state broadcasts (max 1/second), batch updates

2. **Second bottleneck:** Actor image loading (many speakers)
   - **Fix:** Lazy-load images on scroll, use foundry.utils.debounce for resolution

## Anti-Patterns

### Anti-Pattern 1: Using Module Settings for World State

**What people do:** Store current story/speakers in game.settings (scope: world)

**Why it's wrong:** Settings are for configuration, not runtime state. No built-in socket sync, must manually broadcast changes, clutters settings menu

**Do this instead:** Use Document flags on Scene or persistent JournalEntry. Flags auto-save, respect permissions, and integrate with Foundry's data model

### Anti-Pattern 2: Direct Socket Usage Without Namespace

**What people do:** `game.socket.emit("updateViewer", data)`

**Why it's wrong:** Missing module namespace causes collisions with other modules, violates Foundry best practices, debugging nightmares

**Do this instead:** Always use `module.{moduleName}` prefix: `game.socket.emit("module.storyframe.updateViewer", data)`. Better yet, centralize in SocketManager class

### Anti-Pattern 3: jQuery in ApplicationV2

**What people do:** Use `$(this.element).find(".selector")` in ApplicationV2 apps

**Why it's wrong:** ApplicationV2 removed jQuery dependency, jQuery not guaranteed in v13+, adds unnecessary dependency weight

**Do this instead:** Use vanilla DOM: `this.element.querySelector(".selector")`, leverage ApplicationV2's built-in event handling via `_onClickAction`

### Anti-Pattern 4: Synchronous Actor Access

**What people do:** `game.actors.get(actorId)` assuming Actor is in world

**Why it's wrong:** Fails for Actors in compendia, fails for cross-scene references, breaks if Actor deleted

**Do this instead:** Store full UUID, use `await fromUuid(uuid)`, handle null case gracefully with fallback display data

### Anti-Pattern 5: Single ApplicationV2 with Conditional Rendering

**What people do:** One app with `{{#if isGM}}` blocks in template

**Why it's wrong:** Mixes concerns, players load GM-only code/templates, harder to test role-specific behavior, UI feels inconsistent

**Do this instead:** Two separate ApplicationV2 classes, shared StateManager/SocketManager, independent templates. Clean separation, better testability

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| FilePicker | `new FilePicker()` in GM app | For custom journal image upload |
| JournalSheet | Hook `renderJournalSheet`, add "Broadcast" button | Optional: quick-broadcast from journal |
| Actor UUIDs | `fromUuid()` async resolution | System-agnostic, works all game systems |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| GMControlApp ↔ StateManager | Direct method calls | Synchronous for read, async for write |
| StateManager ↔ SocketManager | SocketManager calls StateManager.setState() | State persists before broadcast |
| PlayerViewer ↔ SocketManager | Socket event triggers render() | One-way: socket → viewer |
| StateManager ↔ Document Flags | scene.getFlag/setFlag | Async, requires active scene |

## Build Order Recommendations

### Phase 1: Core Data Layer
**Why first:** Everything else depends on state management

1. StateManager (Document flags read/write)
2. Module registration (Hooks.once init)
3. Basic state structure (currentJournal, speakers)

**Dependencies:** None
**Validation:** Can set/get flags on active scene

### Phase 2: Socket Communication
**Why second:** Required for GM → Player sync

1. SocketManager initialization
2. Broadcast pattern (emit on state change)
3. Request-sync pattern (player join)

**Dependencies:** StateManager
**Validation:** Two browser instances sync state

### Phase 3: GM Control App
**Why third:** Provides state modification interface

1. GMControlApp ApplicationV2 skeleton
2. Journal picker UI
3. Speaker management UI
4. Wire broadcast on change

**Dependencies:** StateManager, SocketManager
**Validation:** GM can select journal, add speakers, changes persist

### Phase 4: Player Viewer App
**Why fourth:** Consumes synced state

1. PlayerViewer ApplicationV2 skeleton
2. Read-only display template
3. Socket listener for auto-refresh
4. Actor resolution for speaker display

**Dependencies:** StateManager, SocketManager, ActorResolver
**Validation:** Player viewer updates when GM changes state

### Phase 5: Actor UUID Resolution
**Why fifth:** Enhances speaker display but not blocking

1. ActorResolver utility
2. Speaker gallery layout
3. Image lazy-loading
4. Fallback for deleted Actors

**Dependencies:** Core data structures
**Validation:** Speakers display with images, handle deletions gracefully

## Sources

- [FoundryVTT v13 API Documentation](https://foundryvtt.com/api/v13/modules.html)
- [Package Development Best Practices](https://foundryvtt.wiki/en/development/guides/package-best-practices)
- [ApplicationV2 Community Wiki](https://foundryvtt.wiki/en/development/api/applicationv2)
- [ApplicationV2 Official API](https://foundryvtt.com/api/classes/foundry.applications.api.ApplicationV2.html)
- [Sockets Community Wiki](https://foundryvtt.wiki/en/development/api/sockets)
- [Socketlib Library](https://foundryvtt.com/packages/socketlib)
- [Handling Data: Flags, Settings, and Files](https://foundryvtt.wiki/en/development/guides/handling-data)
- [Introduction to Module Development](https://foundryvtt.com/article/module-development/)
- [Content Packaging Guide](https://foundryvtt.com/article/packaging-guide/)

---
*Architecture research for: StoryFrame FoundryVTT Module*
*Researched: 2026-01-29*
