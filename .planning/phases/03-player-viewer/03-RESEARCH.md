# Phase 3: Player Viewer - Research

**Researched:** 2026-01-29
**Domain:** FoundryVTT v13 ApplicationV2 - read-only player window with real-time updates
**Confidence:** HIGH

## Summary

Phase 3 requires a player-facing ApplicationV2 window that displays the current speaker (portrait + name) and updates in real-time when the GM changes state. The window must be read-only, show/hide based on active speaker state, and handle deleted actors gracefully.

The standard approach uses:
- ApplicationV2 with HandlebarsApplicationMixin for simple display window
- Minimal window configuration (no unnecessary controls)
- `updateScene` hook to listen for flag changes and trigger re-render
- Conditional close/open based on activeSpeaker state (null = narration mode)
- Same deleted actor fallback pattern as GM interface (mystery-man.svg)
- Optional client-scoped settings for window position persistence

**Primary recommendation:** Use lightweight ApplicationV2 with single template part, listen to `updateScene` hook for flag changes, conditionally close when activeSpeaker is null, render when activeSpeaker is set.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ApplicationV2 | v13+ | Window framework | Native FoundryVTT application base class |
| HandlebarsApplicationMixin | v13+ | Template rendering | Official template integration for ApplicationV2 |
| updateScene hook | v13+ | Flag change detection | Core hook fires on all clients when Scene flags change |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| game.settings (client scope) | v13+ | Window position persistence | Optional per-user window position memory |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| updateScene hook | Socket broadcast | updateScene already broadcasts to all clients, socket adds complexity |
| Conditional close | Hidden CSS display:none | close() is cleaner, prevents unnecessary renders, no DOM clutter |
| Client settings | World settings | Window position is per-user preference, client scope appropriate |

**Installation:**
No additional dependencies - all tools are built into FoundryVTT v13.

## Architecture Patterns

### Recommended Project Structure
```
storyframe/
├── templates/
│   └── player-viewer.hbs    # Player viewer template
├── scripts/
│   ├── applications/
│   │   ├── gm-interface.mjs        # From Phase 2
│   │   └── player-viewer.mjs       # NEW: PlayerViewerApp class
│   ├── state-manager.mjs           # From Phase 1
│   └── socket-manager.mjs          # From Phase 1
└── styles/
    ├── gm-interface.css            # From Phase 2
    └── player-viewer.css           # NEW: Viewer styling
```

### Pattern 1: Read-Only Player Window
**What:** Minimal ApplicationV2 with no edit controls, display-only
**When to use:** Player-facing viewers that show GM-controlled state
**Example:**
```javascript
// Source: https://foundryvtt.com/api/classes/foundry.applications.api.ApplicationV2.html
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class PlayerViewerApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'storyframe-player-viewer',
    classes: ['storyframe', 'player-viewer'],
    tag: 'div',
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

    if (!state.activeSpeaker) {
      return { noSpeaker: true };
    }

    const speaker = state.speakers.find(s => s.id === state.activeSpeaker);
    if (!speaker) {
      return { noSpeaker: true };
    }

    // Resolve actor data with deleted actor handling
    let img, name;
    if (speaker.actorUuid) {
      const actor = await fromUuid(speaker.actorUuid);
      img = actor?.img || speaker.imagePath || 'icons/svg/mystery-man.svg';
      name = actor?.name || speaker.label || 'Unknown';
    } else {
      img = speaker.imagePath || 'icons/svg/mystery-man.svg';
      name = speaker.label;
    }

    return {
      speaker: { img, name },
      noSpeaker: false
    };
  }
}
```

### Pattern 2: Hook-Based Real-Time Updates
**What:** Listen to updateScene hook for flag changes, trigger re-render
**When to use:** Player windows reacting to GM state changes
**Example:**
```javascript
// Source: https://foundryvtt.com/api/functions/hookEvents.updateDocument.html
// In storyframe.mjs main initialization

let playerViewer = null;

Hooks.once('ready', () => {
  if (!game.user.isGM) {
    // Initialize player viewer for non-GM users
    playerViewer = new PlayerViewerApp();
    game.storyframe.playerViewer = playerViewer;

    // Open if there's already an active speaker
    const state = game.storyframe.stateManager.getState();
    if (state?.activeSpeaker) {
      playerViewer.render(true);
    }
  }
});

// Listen for Scene flag updates
Hooks.on('updateScene', (scene, changed, options, userId) => {
  // Only react to current scene changes
  if (scene.id !== game.scenes.current?.id) return;

  // Check if storyframe flags were modified
  if (!changed.flags?.storyframe) return;

  // Update local state
  game.storyframe.stateManager.loadFromFlags();

  // Update viewer (GM and player)
  if (game.user.isGM) {
    game.storyframe.gmInterface?.render();
  } else {
    game.storyframe.playerViewer?.render();
  }
});
```

### Pattern 3: Conditional Window Visibility
**What:** Auto-close when activeSpeaker is null, auto-open when set
**When to use:** Windows that should only show when relevant state exists
**Example:**
```javascript
// Source: https://foundryvtt.com/api/classes/foundry.applications.api.ApplicationV2.html
class PlayerViewerApp extends HandlebarsApplicationMixin(ApplicationV2) {
  async _prepareContext(options) {
    const state = game.storyframe.stateManager.getState();

    // Auto-close if no active speaker (narration mode)
    if (!state.activeSpeaker) {
      // Close in next tick to avoid lifecycle conflicts
      setTimeout(() => this.close(), 0);
      return { noSpeaker: true };
    }

    // Find and prepare speaker data...
  }
}

// Alternative: Use _canRender to prevent render entirely
class PlayerViewerApp extends HandlebarsApplicationMixin(ApplicationV2) {
  _canRender(options) {
    const state = game.storyframe.stateManager.getState();

    // Don't render if no active speaker
    if (!state.activeSpeaker) {
      return false;
    }

    return super._canRender(options);
  }
}

// In updateScene hook, open window if needed
Hooks.on('updateScene', (scene, changed, options, userId) => {
  if (!changed.flags?.storyframe) return;

  const state = game.storyframe.stateManager.getState();
  const viewer = game.storyframe.playerViewer;

  if (state.activeSpeaker && !viewer.rendered) {
    // Auto-open when speaker becomes active
    viewer.render(true);
  } else if (!state.activeSpeaker && viewer.rendered) {
    // Auto-close when speaker cleared
    viewer.close();
  } else if (viewer.rendered) {
    // Re-render to update displayed speaker
    viewer.render();
  }
});
```

### Pattern 4: Deleted Actor Handling (Reused from Phase 2)
**What:** Check fromUuid result, fallback to imagePath or mystery-man.svg
**When to use:** All speaker display logic (GM and player)
**Example:**
```javascript
// Source: https://foundryvtt.wiki/en/development/api/document
async function resolveSpeakerDisplay(speaker) {
  if (speaker.actorUuid) {
    const actor = await fromUuid(speaker.actorUuid);
    if (actor) {
      return {
        img: actor.img,
        name: actor.name,
        actorDeleted: false
      };
    } else {
      // Actor deleted - use fallback
      return {
        img: speaker.imagePath || 'icons/svg/mystery-man.svg',
        name: speaker.label || 'Unknown',
        actorDeleted: true
      };
    }
  } else {
    // Custom image path
    return {
      img: speaker.imagePath || 'icons/svg/mystery-man.svg',
      name: speaker.label,
      actorDeleted: false
    };
  }
}
```

### Pattern 5: Optional Window Position Persistence
**What:** Save/restore window position via client-scoped settings
**When to use:** Player windows where position is user preference
**Example:**
```javascript
// Register setting in init hook
Hooks.once('init', () => {
  game.settings.register('storyframe', 'viewerPosition', {
    scope: 'client',  // Per-user
    config: false,    // Not shown in settings UI
    type: Object,
    default: { width: 300, height: 400 }
  });
});

class PlayerViewerApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    // ...other options
    position: game.settings.get('storyframe', 'viewerPosition')
  };

  async _onPosition(position) {
    await super._onPosition(position);

    // Save position when changed
    await game.settings.set('storyframe', 'viewerPosition', {
      width: position.width,
      height: position.height,
      top: position.top,
      left: position.left
    });
  }
}
```

### Pattern 6: Simple Player Template
**What:** Minimal Handlebars template with portrait and name
**When to use:** Player viewer display
**Example:**
```handlebars
{{!-- modules/storyframe/templates/player-viewer.hbs --}}
{{!-- Source: Established Handlebars pattern --}}
<div class="speaker-display">
  {{#if noSpeaker}}
    <div class="no-speaker">
      <p>No speaker active</p>
      <p class="hint">Waiting for GM to set speaker...</p>
    </div>
  {{else}}
    <div class="speaker-portrait">
      <img src="{{speaker.img}}" alt="{{speaker.name}}">
    </div>
    <div class="speaker-info">
      <h2>{{speaker.name}}</h2>
    </div>
  {{/if}}
</div>
```

**CSS:**
```css
/* modules/storyframe/styles/player-viewer.css */
.storyframe.player-viewer .speaker-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  height: 100%;
}

.storyframe.player-viewer .speaker-portrait {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.storyframe.player-viewer .speaker-portrait img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.storyframe.player-viewer .speaker-info {
  text-align: center;
  margin-top: 1rem;
}

.storyframe.player-viewer .speaker-info h2 {
  margin: 0;
  font-size: 1.5rem;
}

.storyframe.player-viewer .no-speaker {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-light-secondary);
}

.storyframe.player-viewer .no-speaker .hint {
  font-size: 0.875rem;
  margin-top: 0.5rem;
}
```

### Anti-Patterns to Avoid
- **Opening viewer for GMs:** Player viewer is player-only, GM uses GM interface
- **Not checking scene.current:** updateScene fires for ALL scenes, must filter to current scene
- **Polling state instead of using hooks:** updateScene hook fires automatically, no polling needed
- **Rendering closed windows:** Check `viewer.rendered` before calling render(), don't render closed windows
- **Trying to edit state in player window:** All state changes go through SocketManager → GM, player viewer is read-only
- **Not handling missing speaker:** activeSpeaker ID may reference deleted speaker, check speakers.find() result

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Detect flag changes | Custom polling/timer | updateScene hook | Hook fires automatically on all clients when Scene flags update |
| Broadcast to players | Custom socket messages | Built-in Document flag updates | setFlag broadcasts to all clients via core infrastructure |
| Window position persistence | localStorage or custom flags | game.settings (client scope) | Settings system handles serialization, validation, per-user storage |
| Read-only window enforcement | CSS pointer-events:none | No edit controls in template | Semantic HTML, no hidden form inputs to confuse accessibility tools |

**Key insight:** FoundryVTT's Document flag system already broadcasts updates to all clients via updateScene hook. No custom socket communication needed for player viewer updates. Player viewer is purely reactive, consuming state that GM controls.

## Common Pitfalls

### Pitfall 1: Listening to Wrong Hook
**What goes wrong:** Player viewer doesn't update when GM changes speaker
**Why it happens:** Using generic `update` hook instead of `updateScene`, or not checking scene.current
**How to avoid:** Use `updateScene` hook specifically, filter to `game.scenes.current.id`
**Warning signs:** Viewer updates for wrong scenes, or doesn't update at all

### Pitfall 2: Render Lifecycle Conflicts
**What goes wrong:** Errors like "Cannot render during close" or "Already rendering"
**Why it happens:** Calling render() or close() during another lifecycle method
**How to avoid:** Use `setTimeout(() => this.close(), 0)` to defer close to next tick
**Warning signs:** Console errors about render state, race conditions

### Pitfall 3: Not Filtering to Current Scene
**What goes wrong:** Viewer updates when non-active scenes are modified
**Why it happens:** updateScene fires for ALL scene modifications
**How to avoid:** Check `if (scene.id !== game.scenes.current?.id) return;`
**Warning signs:** Viewer flickers or updates at wrong times

### Pitfall 4: Opening Viewer for GMs
**What goes wrong:** GM sees both GM interface and player viewer
**Why it happens:** No isGM check before initializing player viewer
**How to avoid:** Only create PlayerViewerApp if `!game.user.isGM`
**Warning signs:** GM has duplicate windows, confusing UX

### Pitfall 5: Not Handling Closed Window Renders
**What goes wrong:** Errors when trying to render closed window
**Why it happens:** Calling render() without checking if window is open
**How to avoid:** Check `viewer.rendered` before calling render() for updates
**Warning signs:** Console errors "Application is not rendered"

### Pitfall 6: State Access Race Conditions
**What goes wrong:** Player viewer shows stale data immediately after flag update
**Why it happens:** Calling render() before StateManager.loadFromFlags() completes
**How to avoid:** Await StateManager.loadFromFlags(), then render()
**Warning signs:** Brief flash of old data before updating

### Pitfall 7: Missing Speaker ID Handling
**What goes wrong:** Viewer crashes when activeSpeaker references deleted speaker
**Why it happens:** Speaker removed from list but activeSpeaker ID not cleared
**How to avoid:** Check `speakers.find(s => s.id === state.activeSpeaker)` result
**Warning signs:** Null reference errors when speaker list changes

### Pitfall 8: Incorrect mystery-man Path
**What goes wrong:** Fallback icon shows 404 error
**Why it happens:** Using absolute path `/icons/svg/mystery-man.svg` instead of relative
**How to avoid:** Use relative path `icons/svg/mystery-man.svg` (Foundry resolves correctly)
**Warning signs:** Console errors about missing icon files
**Note:** FoundryVTT changed from PNG to SVG in v0.7.3

## Code Examples

Verified patterns from official sources:

### Complete PlayerViewerApp Class
```javascript
// Source: https://foundryvtt.com/api/classes/foundry.applications.api.ApplicationV2.html
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class PlayerViewerApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'storyframe-player-viewer',
    classes: ['storyframe', 'player-viewer'],
    tag: 'div',
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
      console.warn('StoryFrame | Active speaker ID not found in speaker list');
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
          name: actor.name,
          actorDeleted: false
        };
      } else {
        // Actor deleted - use fallback
        return {
          img: speaker.imagePath || 'icons/svg/mystery-man.svg',
          name: speaker.label || 'Unknown',
          actorDeleted: true
        };
      }
    } else {
      // Custom image path
      return {
        img: speaker.imagePath || 'icons/svg/mystery-man.svg',
        name: speaker.label,
        actorDeleted: false
      };
    }
  }
}
```

### Hook Integration in Main Module
```javascript
// storyframe.mjs
// Source: https://foundryvtt.com/api/functions/hookEvents.updateDocument.html

Hooks.once('ready', () => {
  console.log('StoryFrame | Ready');

  if (game.user.isGM) {
    // GM initialization (from Phase 2)
    game.storyframe.gmInterface = new GMInterfaceApp();

    // Add scene controls button
    // ...
  } else {
    // Player initialization
    game.storyframe.playerViewer = new PlayerViewerApp();

    // Auto-open if there's already an active speaker
    const state = game.storyframe.stateManager.getState();
    if (state?.activeSpeaker) {
      game.storyframe.playerViewer.render(true);
    }
  }
});

// Listen for Scene flag updates (fires on all clients)
Hooks.on('updateScene', async (scene, changed, options, userId) => {
  // Only react to current scene
  if (scene.id !== game.scenes.current?.id) return;

  // Only react to storyframe flag changes
  if (!changed.flags?.storyframe) return;

  console.log('StoryFrame | Scene flags updated');

  // Reload state from flags
  await game.storyframe.stateManager.loadFromFlags();
  const state = game.storyframe.stateManager.getState();

  // Update GM interface
  if (game.user.isGM && game.storyframe.gmInterface?.rendered) {
    game.storyframe.gmInterface.render();
  }

  // Update player viewer
  if (!game.user.isGM) {
    const viewer = game.storyframe.playerViewer;

    if (state.activeSpeaker && !viewer.rendered) {
      // Speaker activated - open viewer
      viewer.render(true);
    } else if (!state.activeSpeaker && viewer.rendered) {
      // Speaker cleared - close viewer
      viewer.close();
    } else if (viewer.rendered) {
      // Speaker changed - update display
      viewer.render();
    }
  }
});
```

### StateManager loadFromFlags Method
```javascript
// state-manager.mjs
class StateManager {
  constructor() {
    this.state = null;
  }

  async loadFromFlags() {
    const scene = game.scenes.current;
    if (!scene) {
      this.state = null;
      return;
    }

    let data = scene.getFlag('storyframe', 'speakers');

    if (!data) {
      // Initialize default structure
      data = {
        version: 1,
        speakers: [],
        activeJournal: null,
        activeSpeaker: null
      };

      // Only GM can initialize flags
      if (game.user.isGM) {
        await scene.setFlag('storyframe', 'speakers', data);
      }
    }

    // Check version and migrate if needed
    if (data.version !== 1) {
      data = await this.migrate(data);
    }

    this.state = data;
  }

  getState() {
    return this.state;
  }

  // GM-only state updates (called via SocketManager)
  async updateSpeakers(speakers) {
    if (!game.user.isGM) {
      console.error('StoryFrame | Only GM can update speakers');
      return;
    }

    const scene = game.scenes.current;
    this.state.speakers = speakers;
    await scene.setFlag('storyframe', 'speakers', this.state);

    // updateScene hook will fire automatically, triggering renders
  }

  async setActiveSpeaker(speakerId) {
    if (!game.user.isGM) {
      console.error('StoryFrame | Only GM can set active speaker');
      return;
    }

    const scene = game.scenes.current;
    this.state.activeSpeaker = speakerId;
    await scene.setFlag('storyframe', 'speakers', this.state);

    // updateScene hook will fire automatically, triggering renders
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom socket broadcasts | Document flag updates | Core feature (v8+) | Flags auto-broadcast, no custom sockets needed for player updates |
| Manual client sync | updateScene hook | Core feature (v8+) | Hook fires on all clients automatically |
| Application class | ApplicationV2 class | v12-v13 transition | New render lifecycle, better state management |
| Polling for state changes | Hook-based reactivity | Core pattern (always) | Hooks are event-driven, more efficient than polling |
| PNG fallback icons | SVG fallback icons | v0.7.3 | mystery-man.png removed, use mystery-man.svg |

**Deprecated/outdated:**
- **Custom socket messages for state sync**: Use Document flags with updateScene hook
- **Polling intervals**: Use hooks for reactive updates
- **Application class**: Use ApplicationV2 for new windows
- **PNG mystery-man icon**: Use SVG version (icons/svg/mystery-man.svg)

## Open Questions

Things that couldn't be fully resolved:

1. **Player viewer auto-open vs manual open**
   - What we know: Can auto-open when activeSpeaker is set, auto-close when null
   - What's unclear: Better UX to auto-open or require player to click control button?
   - Recommendation: Auto-open on first speaker activation, then player controls open/close (window persists their choice). Reset on scene change.

2. **Window position persistence scope**
   - What we know: Can save to client settings or not at all
   - What's unclear: Should position persist across sessions?
   - Recommendation: Save to client settings for consistency, players appreciate position memory

3. **Minimized state during narration**
   - What we know: Can close window or minimize it
   - What's unclear: Close completely or just minimize when activeSpeaker is null?
   - Recommendation: Close completely - cleaner, signals "nothing to see", no DOM clutter

4. **Multiple viewer instances**
   - What we know: ApplicationV2 can have multiple instances
   - What's unclear: Should players be able to open multiple viewers (e.g., for multi-monitor)?
   - Recommendation: Single instance for v1, check rendered state before creating new. Multi-instance is v2 feature if requested.

5. **Viewer button placement for players**
   - What we know: Can add to scene controls or sidebar
   - What's unclear: Where is most discoverable/convenient for players?
   - Recommendation: Add to scene controls (top toolbar) for consistency with GM pattern. Use same icon as GM interface.

## Sources

### Primary (HIGH confidence)
- [ApplicationV2 API Documentation](https://foundryvtt.com/api/classes/foundry.applications.api.ApplicationV2.html) - Window lifecycle, render methods, close/open patterns
- [updateScene Hook](https://foundryvtt.com/api/functions/hookEvents.updateDocument.html) - Hook signature, parameters, flag change detection
- [HandlebarsApplicationMixin](https://foundryvtt.com/api/functions/foundry.applications.api.HandlebarsApplicationMixin.html) - Template integration
- [Flags API](https://foundryvtt.wiki/en/development/api/flags) - Flag updates trigger hooks, broadcast to all clients
- [Hooks Listening & Calling](https://foundryvtt.wiki/en/development/guides/Hooks_Listening_Calling) - Hook patterns, updateDocument specifics
- [Document API](https://foundryvtt.wiki/en/development/api/document) - fromUuid, deleted actor handling

### Secondary (MEDIUM confidence)
- [ApplicationV2 Community Wiki](https://foundryvtt.wiki/en/development/api/applicationv2) - Best practices, conversion guide
- [Release 0.7.3](https://foundryvtt.com/releases/0.7.3) - mystery-man.png deprecated, SVG version standard
- [Window Controls Module](https://foundryvtt.com/packages/window-controls) - Pin/anchor patterns for reference (not implementing, but informs design)
- [Sheet Only Module](https://foundryvtt.com/packages/sheet-only) - Player-focused window pattern example
- [Hide Player UI Module](https://foundryvtt.com/packages/hide-player-ui) - Player UI control patterns

### Tertiary (LOW confidence)
- WebSearch results about ApplicationV2 window configuration - general patterns, cross-verified with official docs
- WebSearch results about read-only player displays - module patterns for reference

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - ApplicationV2, updateScene hook, HandlebarsApplicationMixin verified with official docs
- Architecture patterns: HIGH - Hook-based updates, conditional visibility, deleted actor handling verified with official API docs
- Real-time updates: HIGH - updateScene hook is core mechanism, documented in official sources
- Window configuration: MEDIUM - DEFAULT_OPTIONS structure inferred from Phase 2 patterns and API docs, not fully documented
- UX patterns: MEDIUM - Auto-open/close patterns are design decisions based on established practices, not official guidelines

**Research date:** 2026-01-29
**Valid until:** 60 days (FoundryVTT v13 stable, core hooks/flags are mature APIs)
