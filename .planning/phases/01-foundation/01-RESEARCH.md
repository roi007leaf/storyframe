# Phase 1: Foundation - Research

**Researched:** 2026-01-29
**Domain:** FoundryVTT v13 module development - infrastructure layer
**Confidence:** HIGH

## Summary

StoryFrame's foundation requires a FoundryVTT v13 module with proper manifest structure, hook-based initialization, socketlib integration for GM→player communication, and document flag-based data persistence.

The standard approach uses:
- Module manifest with v13 compatibility object (not deprecated minimumCoreVersion)
- ESModules for JS loading (preferred over scripts field)
- Hook sequence: init (CONFIG/settings), setup (read settings), ready (UI operations)
- socketlib for GM execution pattern with built-in permission validation
- Document flags (Scene/JournalEntry) for persisted speaker data
- UUID references for actor storage (string-based, resolve with fromUuid)
- ApplicationV2 integration via manual render() calls when state changes

**Primary recommendation:** Use Scene flags for speaker storage (per-scene context), socketlib.ready hook for socket registration, and manual ApplicationV2 render() calls when StateManager broadcasts changes.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FoundryVTT | v13+ | Platform API | Target platform, ApplicationV2 framework |
| socketlib | latest | Socket security | Industry standard for GM execution pattern, handles permissions |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ESModules | ES6+ | JS loading | Preferred over scripts field (v13 standard) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| socketlib | Raw sockets | Raw sockets have zero permission controls, require manual validation |
| Scene flags | World Settings | Settings not document-scoped, different permission model |
| Scene flags | JournalEntry flags | Functionally identical, Scene flags match per-scene context |

**Installation:**
```json
"relationships": {
  "requires": [
    {
      "id": "socketlib",
      "type": "module"
    }
  ]
}
```

## Architecture Patterns

### Recommended Project Structure
```
storyframe/
├── module.json          # Manifest with v13 compatibility object
├── storyframe.mjs       # Main module entry (ESModule)
├── scripts/
│   ├── state-manager.mjs    # StateManager class
│   └── socket-manager.mjs   # SocketManager class
└── lang/
    └── en.json          # Localization
```

### Pattern 1: Hook Initialization Sequence
**What:** FoundryVTT modules initialize through three sequential hooks
**When to use:** All module initialization
**Example:**
```javascript
// Source: https://foundryvtt.com/api/functions/hookEvents.init.html
Hooks.once('init', () => {
  // Register settings, modify CONFIG, register sheets
  game.settings.register('storyframe', 'someKey', {...});
});

Hooks.once('setup', () => {
  // Read settings, prepare data (Documents initialized)
  const value = game.settings.get('storyframe', 'someKey');
});

Hooks.once('ready', () => {
  // UI operations, canvas interactions (everything loaded)
  // Open windows, register UI buttons, etc.
});
```

### Pattern 2: socketlib Registration
**What:** Register module and functions during socketlib.ready hook
**When to use:** All socket-based communication
**Example:**
```javascript
// Source: https://github.com/farling42/foundryvtt-socketlib/blob/develop/README.md
let socket;
Hooks.once('socketlib.ready', () => {
  socket = socketlib.registerModule('storyframe');
  socket.register('updateSpeakers', updateSpeakersHandler);
  socket.register('setActiveSpeaker', setActiveSpeakerHandler);
});

// Later, execute as GM:
const result = await socket.executeAsGM('updateSpeakers', speakerData);
```

### Pattern 3: Document Flag Storage with Versioning
**What:** Store module data in document flags with schema version
**When to use:** Persisting data associated with a document
**Example:**
```javascript
// Source: https://foundryvtt.wiki/en/development/api/flags
// WRITE (async, persists to database)
await scene.setFlag('storyframe', 'speakers', {
  version: 1,
  speakers: [...],
  activeJournal: null,
  activeSpeaker: null
});

// READ (sync, from loaded document)
const data = scene.getFlag('storyframe', 'speakers');
if (data.version !== 1) {
  // Run migration
}
```

### Pattern 4: Actor UUID References
**What:** Store actor references as UUID strings, resolve with fromUuid
**When to use:** Referencing actors that may be in different collections
**Example:**
```javascript
// Source: https://foundryvtt.wiki/en/development/api/document
// STORE
const speaker = {
  id: foundry.utils.randomID(),
  actorUuid: actor.uuid,  // Store as string
  imagePath: null,
  label: 'Speaker Name'
};

// RETRIEVE
const actor = await fromUuid(speaker.actorUuid);
if (!actor) {
  // Handle deleted actor - use imagePath fallback
}
```

### Pattern 5: StateManager → ApplicationV2 Reactivity
**What:** Manual render() calls when state changes
**When to use:** ApplicationV2 apps consuming external state
**Example:**
```javascript
// Source: https://foundryvtt.com/api/classes/foundry.applications.api.ApplicationV2.html
class StateManager {
  updateState(newState) {
    this.state = newState;
    // Trigger re-render of all listening ApplicationV2 instances
    game.storyframe.gmApp?.render();
    game.storyframe.playerApp?.render();
  }
}

class StoryframeGMApp extends foundry.applications.api.ApplicationV2 {
  async _prepareContext() {
    return game.storyframe.stateManager.getState();
  }
}
```

### Pattern 6: System-Agnostic Development
**What:** Use core Foundry APIs, avoid system-specific data models
**When to use:** Modules meant to work across all game systems
**Example:**
```javascript
// Source: https://foundryvtt.wiki/en/development/guides/package-best-practices
// GOOD - uses core Actor API
const actor = await fromUuid(actorUuid);
const name = actor.name;
const img = actor.img;

// BAD - assumes dnd5e system structure
const hp = actor.system.attributes.hp.value;  // DON'T DO THIS

// GOOD - only use actor properties guaranteed by core
// Avoid system.* fields entirely
```

### Anti-Patterns to Avoid
- **Registering settings in setup/ready:** Settings must register in init hook
- **Reading settings in init:** Settings are not readable until setup hook
- **Using minimumCoreVersion:** Deprecated in v13, use compatibility object
- **Raw socket.emit without validation:** Use socketlib for automatic permission handling
- **Flags without version field:** Include version for future migrations
- **Modifying flag objects directly:** Use setFlag() to persist and broadcast changes

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GM execution pattern | Custom permission checks + socket routing | socketlib executeAsGM | Handles multi-GM scenarios, permission validation, error propagation |
| Actor references | Store actor object copies | Store UUID strings, resolve with fromUuid | Actors can be deleted/modified, UUID resolution handles this |
| Data persistence | Custom database layer | Document flags with setFlag/getFlag | Built-in database persistence, client broadcasting, permission enforcement |
| Module dependencies | Instructions in README | relationships field in manifest | Foundry auto-downloads and validates dependencies |

**Key insight:** FoundryVTT's Document/Flag/Socket infrastructure handles complex edge cases (multi-user sync, permissions, database transactions) that custom solutions miss.

## Common Pitfalls

### Pitfall 1: Wrong Hook for Settings Registration
**What goes wrong:** Module crashes with "cannot read settings" errors
**Why it happens:** Settings registration in setup/ready happens too late; reading settings in init happens too early
**How to avoid:** Register settings in init, read settings in setup or later
**Warning signs:** Console errors about undefined settings

### Pitfall 2: Missing socketlib Dependency
**What goes wrong:** Module loads but socket operations fail silently or error
**Why it happens:** socketlib.ready hook never fires if socketlib not installed
**How to avoid:** Add socketlib to relationships.requires in manifest
**Warning signs:** "socketlib is not defined" console errors

### Pitfall 3: Flag Schema Without Version
**What goes wrong:** Future migrations impossible, data corruption on schema changes
**Why it happens:** Developer forgets to plan for future changes
**How to avoid:** Always include version field in top-level flag data structure
**Warning signs:** No version field in flag data

### Pitfall 4: Raw Socket Communication
**What goes wrong:** Players can execute GM-only operations, security breach
**Why it happens:** Raw sockets have zero permission controls
**How to avoid:** Use socketlib executeAsGM pattern exclusively
**Warning signs:** socket.emit() calls in code instead of socketlib calls

### Pitfall 5: Deleted Actor Handling
**What goes wrong:** Speaker references break when actor deleted, UI shows errors
**Why it happens:** fromUuid returns null for deleted actors
**How to avoid:** Check fromUuid result, provide fallback (imagePath or placeholder)
**Warning signs:** Null reference errors when rendering speaker list

### Pitfall 6: Direct Flag Mutation
**What goes wrong:** Changes not persisted to database, other clients don't see updates
**Why it happens:** Mutating object with = doesn't trigger Foundry's persistence layer
**How to avoid:** Always use setFlag() for modifications
**Warning signs:** Changes work locally but disappear on reload or for other clients

### Pitfall 7: Using Deprecated Manifest Fields
**What goes wrong:** Console warnings in v13, potential incompatibility in future versions
**Why it happens:** Following outdated tutorials or templates
**How to avoid:** Use compatibility object instead of minimumCoreVersion/compatibleCoreVersion
**Warning signs:** Console warnings about deprecated fields

### Pitfall 8: System-Specific APIs
**What goes wrong:** Module breaks with certain game systems
**Why it happens:** Accessing system-specific data model fields
**How to avoid:** Only use core Document properties (name, img, uuid, id), never system.*
**Warning signs:** Module works in dnd5e but fails in PF2e

## Code Examples

Verified patterns from official sources:

### Module Manifest (v13)
```json
{
  "id": "storyframe",
  "title": "StoryFrame",
  "version": "1.0.0",
  "compatibility": {
    "minimum": "13",
    "verified": "13.341"
  },
  "esmodules": ["storyframe.mjs"],
  "relationships": {
    "requires": [{
      "id": "socketlib",
      "type": "module"
    }]
  },
  "socket": true
}
```
Source: [FoundryVTT Module Development](https://foundryvtt.com/article/module-development/)

### Complete Initialization Pattern
```javascript
// storyframe.mjs
Hooks.once('init', () => {
  console.log('StoryFrame | Initializing');

  // Register settings
  game.settings.register('storyframe', 'debug', {
    name: 'Debug Mode',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });
});

Hooks.once('setup', () => {
  console.log('StoryFrame | Setup');

  // Initialize managers (Documents available, settings readable)
  game.storyframe = {
    stateManager: new StateManager(),
    socketManager: null  // Initialized in socketlib.ready
  };
});

Hooks.once('socketlib.ready', () => {
  console.log('StoryFrame | Registering sockets');
  game.storyframe.socketManager = new SocketManager();
});

Hooks.once('ready', () => {
  console.log('StoryFrame | Ready');

  // UI operations (everything loaded)
  if (game.user.isGM) {
    // Add GM control button to UI
  }
});
```
Source: [FoundryVTT Hooks API](https://foundryvtt.com/api/modules/hookEvents.html)

### StateManager with Flag Persistence
```javascript
class StateManager {
  constructor() {
    this.state = null;
  }

  async load() {
    const scene = game.scenes.current;
    if (!scene) return;

    let data = scene.getFlag('storyframe', 'speakers');

    if (!data) {
      // Initialize default structure
      data = {
        version: 1,
        speakers: [],
        activeJournal: null,
        activeSpeaker: null
      };
      await scene.setFlag('storyframe', 'speakers', data);
    }

    // Check version and migrate if needed
    if (data.version !== 1) {
      data = await this.migrate(data);
    }

    this.state = data;
  }

  async updateSpeakers(speakers) {
    const scene = game.scenes.current;
    this.state.speakers = speakers;
    await scene.setFlag('storyframe', 'speakers', this.state);

    // Trigger UI updates
    this.broadcast();
  }

  broadcast() {
    game.storyframe.gmApp?.render();
    game.storyframe.playerApp?.render();
  }

  async migrate(oldData) {
    // Handle future schema changes
    return oldData;
  }
}
```
Source: [FoundryVTT Flags API](https://foundryvtt.wiki/en/development/api/flags)

### SocketManager with GM Execution
```javascript
class SocketManager {
  constructor() {
    this.socket = socketlib.registerModule('storyframe');

    // Register handlers (must be done on all clients)
    this.socket.register('updateSpeakers', this.handleUpdateSpeakers);
    this.socket.register('setActiveSpeaker', this.handleSetActiveSpeaker);
  }

  async broadcastUpdateSpeakers(speakers) {
    // Execute on GM client (automatic permission validation)
    return await this.socket.executeAsGM('updateSpeakers', speakers);
  }

  async broadcastSetActiveSpeaker(speakerId) {
    return await this.socket.executeAsGM('setActiveSpeaker', speakerId);
  }

  // Handler runs on GM client
  async handleUpdateSpeakers(speakers) {
    await game.storyframe.stateManager.updateSpeakers(speakers);
  }

  // Handler runs on GM client
  async handleSetActiveSpeaker(speakerId) {
    const state = game.storyframe.stateManager.state;
    state.activeSpeaker = speakerId;
    await game.scenes.current.setFlag('storyframe', 'speakers', state);
    game.storyframe.stateManager.broadcast();
  }
}
```
Source: [socketlib README](https://github.com/farling42/foundryvtt-socketlib/blob/develop/README.md)

### Deleted Actor Handling
```javascript
async function renderSpeaker(speaker) {
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
```
Source: [FoundryVTT Document API](https://foundryvtt.wiki/en/development/api/document)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| minimumCoreVersion | compatibility.minimum | v10 (deprecated v13) | Manifest must use new format |
| compatibleCoreVersion | compatibility.verified | v10 (deprecated v13) | Manifest must use new format |
| scripts field | esmodules field | v13 (standard) | ESModules preferred, scripts still works |
| Application class | ApplicationV2 class | v12-v13 transition | New render lifecycle, better state management |
| dependencies field | relationships field | v10 (deprecated v13) | New structure for requires/recommends |

**Deprecated/outdated:**
- **minimumCoreVersion/compatibleCoreVersion**: Use compatibility object with minimum/verified/maximum fields
- **dependencies**: Use relationships.requires instead
- **Application class**: Use ApplicationV2 for new development (v1 still works)

## Open Questions

Things that couldn't be fully resolved:

1. **StateManager not a standard pattern**
   - What we know: No "StateManager" class in FoundryVTT core or common library modules
   - What's unclear: Whether custom StateManager is best pattern vs other approaches
   - Recommendation: Create custom StateManager class that wraps flag operations and broadcasts to ApplicationV2 instances. This is a reasonable pattern for managing conversation state.

2. **Scene flags vs JournalEntry flags for storage**
   - What we know: Both have identical persistence mechanisms (both inherit from Document)
   - What's unclear: Semantic best practice for conversation data
   - Recommendation: Use Scene flags - conversations are contextual to scenes, and Scene.current provides easy access. Alternative: Store in active JournalEntry flags if conversations are journal-scoped.

3. **Multi-GM conflict resolution**
   - What we know: socketlib ensures only one GM executes function
   - What's unclear: What happens if two GMs modify state simultaneously
   - Recommendation: Document flag updates are atomic at database level. Last write wins. For v1, acceptable risk. For future: add conflict detection via timestamp field.

4. **ApplicationV2 reactivity pattern**
   - What we know: ApplicationV2 requires manual render() calls, no built-in reactive state
   - What's unclear: Industry best practice for external state → ApplicationV2 reactivity
   - Recommendation: StateManager maintains reference to ApplicationV2 instances, calls render() after state changes. This is explicit and predictable.

## Sources

### Primary (HIGH confidence)
- [FoundryVTT v13 API Documentation](https://foundryvtt.com/api/) - Official API reference
- [Module Development Guide](https://foundryvtt.com/article/module-development/) - Official manifest structure, initialization patterns
- [Hooks API - init](https://foundryvtt.com/api/functions/hookEvents.init.html) - Hook lifecycle documentation
- [Hooks API - setup](https://foundryvtt.com/api/v13/functions/hookEvents.setup.html) - Hook lifecycle documentation
- [Hooks API - ready](https://foundryvtt.com/api/functions/hookEvents.ready.html) - Hook lifecycle documentation
- [ApplicationV2 API](https://foundryvtt.com/api/classes/foundry.applications.api.ApplicationV2.html) - Render lifecycle, state management
- [socketlib GitHub](https://github.com/farling42/foundryvtt-socketlib) - Official socketlib documentation and patterns
- [Package Management](https://foundryvtt.com/article/package-management/) - Compatibility object, relationships field

### Secondary (MEDIUM confidence)
- [FoundryVTT Community Wiki - Flags](https://foundryvtt.wiki/en/development/api/flags) - Flag usage patterns
- [FoundryVTT Community Wiki - Document](https://foundryvtt.wiki/en/development/api/document) - UUID storage best practices
- [FoundryVTT Community Wiki - Sockets](https://foundryvtt.wiki/en/development/api/sockets) - Socket security concerns
- [FoundryVTT Community Wiki - Settings](https://foundryvtt.wiki/en/development/api/settings) - Settings vs flags decision matrix
- [FoundryVTT Community Wiki - Package Best Practices](https://foundryvtt.wiki/en/development/guides/package-best-practices) - System-agnostic patterns
- [FoundryVTT Community Wiki - ApplicationV2](https://foundryvtt.wiki/en/development/api/applicationv2) - ApplicationV2 patterns

### Tertiary (LOW confidence)
- GitHub Issues - various edge cases and deprecated field warnings (informational only)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official docs and socketlib README provide complete patterns
- Architecture: HIGH - All patterns verified with official API docs or socketlib documentation
- Pitfalls: HIGH - Documented in official sources (manifest deprecations, socket security, flag persistence)
- StateManager pattern: MEDIUM - No standard pattern exists, custom implementation required based on established Document/Flag patterns

**Research date:** 2026-01-29
**Valid until:** 60 days (FoundryVTT v13 stable, socketlib mature library)
