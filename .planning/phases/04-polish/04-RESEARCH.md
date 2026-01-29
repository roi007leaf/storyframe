# Phase 4: Polish - Research

**Researched:** 2026-01-29
**Domain:** Foundry VTT ApplicationV2 persistence, keybindings, and window state management
**Confidence:** HIGH

## Summary

Phase 4 adds quality-of-life refinements: persist speaker/journal data, restore window state, and provide keyboard shortcuts. Current implementation already uses scene flags for speaker data and client settings for window positions. Research focused on validating existing patterns and identifying gaps.

**Key findings:**
- Scene flags + client settings pattern is correct and already implemented
- Foundry v9+ native keybinding API replaces third-party libraries
- ApplicationV2 lifecycle hooks (_onClose) already in use for position saving
- Off-screen position validation not provided by framework - needs manual implementation
- Minimized/maximized state not persisted by default - requires custom handling

**Primary recommendation:** Extend existing patterns, add keybindings via game.keybindings.register(), implement off-screen validation, and add minimized state persistence via client settings.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ApplicationV2 | Foundry v13 | Window framework | Official v13 application class with lifecycle hooks |
| game.settings | Foundry core | Client/world persistence | Native settings API for all configuration |
| scene.setFlag() | Foundry core | Document-level data | Standard pattern for scene-scoped module data |
| game.keybindings | Foundry v9+ | Keyboard shortcuts | Native keybinding system, user-configurable |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| socketlib | Latest | Socket communication | Already in use, broadcasts state updates |
| foundry.utils | Foundry core | Validation utilities | Position boundary checking, data merging |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| scene flags | world flags | Scene flags better - already per-scene, no migration needed |
| client settings | localStorage | Client settings integrate with Foundry backup/export |
| native keybindings | lib-df-hotkeys | Native system preferred, lib deprecated for v9+ |

**Installation:**
```bash
# No additional packages - all native Foundry APIs
```

## Architecture Patterns

### Recommended Data Scope Strategy
```
Speaker/journal data (already implemented):
└── Scene flags (scene.setFlag('storyframe', 'data'))
    ├── Per-scene isolation
    ├── Persists across restarts
    └── Syncs via scene.update hook

Window positions (already implemented):
└── Client settings (scope: 'client')
    ├── Per-user, per-device
    ├── Saved on _onClose
    └── Restored in constructor

NEW - Window state (minimized/maximized):
└── Client settings (scope: 'client')
    ├── Key: 'gmWindowState', 'playerViewerState'
    └── { minimized: boolean }

NEW - Keybindings:
└── game.keybindings.register() in 'init' hook
    ├── Configurable by users
    └── Avoid conflicts with core keys
```

### Pattern 1: Window Position Persistence (Already Implemented)
**What:** Save/restore window position in ApplicationV2 lifecycle
**When to use:** Every ApplicationV2 window users can move/resize
**Example:**
```javascript
// Source: Current gm-interface.mjs implementation
constructor(options = {}) {
  super(options);
  const savedPosition = game.settings.get(MODULE_ID, 'gmWindowPosition');
  if (savedPosition && Object.keys(savedPosition).length > 0) {
    this.position = { ...this.position, ...savedPosition };
  }
}

async _onClose(options) {
  await game.settings.set(MODULE_ID, 'gmWindowPosition', {
    top: this.position.top,
    left: this.position.left,
    width: this.position.width,
    height: this.position.height
  });
  return super._onClose(options);
}
```

### Pattern 2: Keybinding Registration
**What:** Register user-configurable hotkeys
**When to use:** Toggle windows, common actions
**Example:**
```javascript
// Source: https://github.com/foundryvtt/foundryvtt/issues/2801
Hooks.once('init', () => {
  game.keybindings.register(MODULE_ID, 'toggleGMInterface', {
    name: 'Toggle GM Interface',
    hint: 'Show/hide the StoryFrame GM control window',
    editable: [
      { key: 'KeyS', modifiers: ['Control', 'Shift'] }
    ],
    onDown: () => {
      if (!game.storyframe?.gmApp) {
        game.storyframe.gmApp = new GMInterfaceApp();
      }
      if (game.storyframe.gmApp.rendered) {
        game.storyframe.gmApp.close();
      } else {
        game.storyframe.gmApp.render(true);
      }
    },
    restricted: true, // GM only
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });
});
```

### Pattern 3: Off-Screen Position Validation
**What:** Clamp saved positions to visible screen bounds
**When to use:** Before restoring saved position (monitor changes)
**Example:**
```javascript
// No official Foundry helper - manual implementation needed
function validatePosition(savedPosition) {
  const maxX = window.innerWidth - 100; // Min 100px visible
  const maxY = window.innerHeight - 50; // Min 50px visible

  return {
    top: Math.max(0, Math.min(savedPosition.top || 0, maxY)),
    left: Math.max(0, Math.min(savedPosition.left || 0, maxX)),
    width: Math.min(savedPosition.width, window.innerWidth),
    height: Math.min(savedPosition.height, window.innerHeight)
  };
}

constructor(options = {}) {
  super(options);
  const saved = game.settings.get(MODULE_ID, 'windowPosition');
  if (saved && Object.keys(saved).length > 0) {
    this.position = { ...this.position, ...validatePosition(saved) };
  }
}
```

### Pattern 4: Minimized State Persistence
**What:** Remember if window was minimized when closed
**When to use:** User expects window state to persist
**Example:**
```javascript
// ApplicationV2 has minimize() method but no auto-persistence
async _onClose(options) {
  await game.settings.set(MODULE_ID, 'windowState', {
    minimized: this.minimized // ApplicationV2 getter
  });
  // Save position separately
  await game.settings.set(MODULE_ID, 'windowPosition', { ...this.position });
  return super._onClose(options);
}

async _onRender(context, options) {
  super._onRender(context, options);

  // Restore minimized state on first render
  if (!this._stateRestored) {
    const state = game.settings.get(MODULE_ID, 'windowState');
    if (state?.minimized) {
      await this.minimize();
    }
    this._stateRestored = true;
  }
}
```

### Anti-Patterns to Avoid
- **Direct flag mutation:** Never `scene.flags.storyframe.data.speakers.push()` - always use `setFlag()`
- **World settings for UI state:** Window positions must be client-scoped, not world
- **Uneditable keybindings:** Always allow user customization via `editable` array
- **No position validation:** Saved positions can be off-screen after monitor changes
- **Ignoring minimized state:** Users expect minimized windows to stay minimized

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Keyboard shortcuts | Custom event listeners | game.keybindings.register() | User-configurable, conflict detection, integrates with Foundry UI |
| Settings storage | localStorage directly | game.settings.register() | Backup/export integration, type validation, scoping |
| Socket communication | Raw socket.io | socketlib (already in use) | executeAsGM pattern, automatic fallbacks |
| Position validation | Custom screen bounds | window.innerWidth/Height + clamp logic | No framework helper exists, but pattern is simple |
| State versioning | Custom migration code | Schema version + _migrate() method | Already implemented in state-manager.mjs |

**Key insight:** Foundry provides extensive APIs for persistence and UI integration. Custom solutions lose Foundry's built-in backup, export, and user configuration features.

## Common Pitfalls

### Pitfall 1: Off-Screen Windows After Monitor Changes
**What goes wrong:** User unplugs monitor, saved position is now off-screen, window unreachable
**Why it happens:** ApplicationV2 doesn't validate positions against current screen size
**How to avoid:** Clamp saved position to visible bounds in constructor before applying
**Warning signs:** User reports "window disappeared" or "can't find window"

### Pitfall 2: Scene Flag Mutation Without setFlag()
**What goes wrong:** Direct mutation (scene.flags.storyframe.data = ...) doesn't persist or sync
**Why it happens:** Foundry requires explicit setFlag() to trigger DB write and broadcasts
**How to avoid:** Always await scene.setFlag('storyframe', 'data', newData)
**Warning signs:** State doesn't persist after refresh, other clients don't see updates

### Pitfall 3: Keybinding Conflicts With Core
**What goes wrong:** Custom hotkey overrides core Foundry function, users confused
**Why it happens:** Didn't check core keybindings before choosing defaults
**How to avoid:** Use Ctrl+Shift or Alt combos, avoid single-key or common shortcuts (W/A/S/D, F1-F12)
**Warning signs:** User reports "key stopped working" or conflict warnings in Configure Controls

### Pitfall 4: World-Scoped Window Settings
**What goes wrong:** All users share same window position, fighting for control
**Why it happens:** Used scope: 'world' instead of scope: 'client'
**How to avoid:** Window positions/states always scope: 'client' - never 'world'
**Warning signs:** Window jumps around when multiple users open it

### Pitfall 5: Missing Late Joiner Sync
**What goes wrong:** Player joins mid-session, doesn't see current speaker/journal state
**Why it happens:** Assumed socket broadcasts reach all clients, but late joiners missed them
**How to avoid:** State stored in scene flags automatically syncs on join via updateScene hook
**Warning signs:** Late joiners see empty/stale state until next GM action

### Pitfall 6: Not Checking getFlag() Errors
**What goes wrong:** getFlag() throws error if module not installed/active
**Why it happens:** getFlag() validates module exists before reading flags
**How to avoid:** Module's own flags safe to getFlag() without try/catch - only issue for cross-module reads
**Warning signs:** Console errors on module load/unload

## Code Examples

### Window Position with Off-Screen Validation
```javascript
// Source: Derived from current implementation + validation pattern
const MODULE_ID = 'storyframe';

class SafePositionApp extends foundry.applications.api.ApplicationV2 {
  constructor(options = {}) {
    super(options);

    const saved = game.settings.get(MODULE_ID, 'appPosition');
    if (saved && Object.keys(saved).length > 0) {
      this.position = { ...this.position, ...this._validatePosition(saved) };
    }
  }

  _validatePosition(pos) {
    const minVisible = 50; // Minimum visible pixels
    const maxX = window.innerWidth - minVisible;
    const maxY = window.innerHeight - minVisible;

    return {
      top: Math.max(0, Math.min(pos.top || 0, maxY)),
      left: Math.max(0, Math.min(pos.left || 0, maxX)),
      width: Math.min(pos.width, window.innerWidth),
      height: Math.min(pos.height, window.innerHeight)
    };
  }

  async _onClose(options) {
    await game.settings.set(MODULE_ID, 'appPosition', {
      top: this.position.top,
      left: this.position.left,
      width: this.position.width,
      height: this.position.height
    });
    return super._onClose(options);
  }
}
```

### Keybinding Registration with GM/Player Split
```javascript
// Source: https://foundryvtt.com/api/v9/ClientKeybindings.html pattern
Hooks.once('init', () => {
  // GM toggle
  game.keybindings.register(MODULE_ID, 'toggleGMInterface', {
    name: 'STORYFRAME.Keybinds.ToggleGMInterface',
    hint: 'STORYFRAME.Keybinds.ToggleGMInterfaceHint',
    editable: [
      { key: 'KeyG', modifiers: ['Control', 'Shift'] }
    ],
    onDown: () => {
      if (!game.user.isGM) return;

      if (!game.storyframe?.gmApp) {
        game.storyframe.gmApp = new GMInterfaceApp();
      }

      if (game.storyframe.gmApp.rendered) {
        game.storyframe.gmApp.close();
      } else {
        game.storyframe.gmApp.render(true);
      }
    },
    restricted: true,
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });

  // Player toggle
  game.keybindings.register(MODULE_ID, 'togglePlayerViewer', {
    name: 'STORYFRAME.Keybinds.TogglePlayerViewer',
    hint: 'STORYFRAME.Keybinds.TogglePlayerViewerHint',
    editable: [
      { key: 'KeyP', modifiers: ['Control', 'Shift'] }
    ],
    onDown: () => {
      if (game.user.isGM) return;

      if (!game.storyframe?.playerViewer) {
        game.storyframe.playerViewer = new PlayerViewerApp();
      }

      if (game.storyframe.playerViewer.rendered) {
        game.storyframe.playerViewer.close();
      } else {
        game.storyframe.playerViewer.render(true);
      }
    },
    restricted: false,
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });
});
```

### Minimized State Persistence
```javascript
// Source: ApplicationV2 minimize() API + client settings pattern
constructor(options = {}) {
  super(options);
  this._stateRestored = false;

  // Restore position
  const savedPosition = game.settings.get(MODULE_ID, 'windowPosition');
  if (savedPosition && Object.keys(savedPosition).length > 0) {
    this.position = { ...this.position, ...savedPosition };
  }
}

async _onRender(context, options) {
  super._onRender(context, options);

  // Restore minimized state once on first render
  if (!this._stateRestored) {
    const savedState = game.settings.get(MODULE_ID, 'windowState');
    if (savedState?.minimized) {
      await this.minimize();
    }
    this._stateRestored = true;
  }
}

async _onClose(options) {
  // Save both position and minimized state
  await game.settings.set(MODULE_ID, 'windowState', {
    minimized: this.minimized
  });

  await game.settings.set(MODULE_ID, 'windowPosition', {
    top: this.position.top,
    left: this.position.left,
    width: this.position.width,
    height: this.position.height
  });

  return super._onClose(options);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| lib-df-hotkeys | game.keybindings native API | v9 (2021) | Third-party library deprecated, use native |
| Application (v1) | ApplicationV2 | v12 (2023) | New lifecycle hooks, better positioning |
| Manual localStorage | game.settings with scope | Always standard | Integration with Foundry backup/export |
| Global hotkeys only | User-configurable via UI | v9+ | Users customize in Configure Controls |

**Deprecated/outdated:**
- **lib-df-hotkeys:** Deprecated for v9+, use native game.keybindings
- **Application (v1):** Still supported but v16 will remove it, use ApplicationV2
- **Direct localStorage access:** Use game.settings for Foundry integration

## Open Questions

1. **Auto-open behavior for player viewer**
   - What we know: Currently auto-opens when speakers exist (line 146-149 storyframe.mjs)
   - What's unclear: Should it remember user's close choice vs auto-open preference?
   - Recommendation: Add client setting 'autoOpenPlayerViewer' (default true), respect user choice

2. **Maximized state persistence**
   - What we know: ApplicationV2 has maximize() method, no official persistence example found
   - What's unclear: Does maximized state need separate handling from position restoration?
   - Recommendation: Test if position.width/height === screen size is sufficient, or need explicit flag

3. **GM reconnect mid-session**
   - What we know: Scene flags + updateScene hook syncs state automatically
   - What's unclear: Does GM window need explicit re-render on reconnect?
   - Recommendation: Likely automatic via Foundry hooks, verify in testing

4. **Keybinding defaults with module conflicts**
   - What we know: Core Foundry uses many combos, conflict warnings shown in UI
   - What's unclear: Best practice for choosing safe defaults that rarely conflict
   - Recommendation: Use Ctrl+Shift+[Letter], avoid F-keys and WASD, check common module repos

## Sources

### Primary (HIGH confidence)
- [ApplicationV2 API Documentation (v13)](https://foundryvtt.com/api/classes/foundry.applications.api.ApplicationV2.html) - Lifecycle hooks, position management
- [Keybinds Official Article](https://foundryvtt.com/article/keybinds/) - User configuration, developer API
- [Handling Data: Flags, Settings, and Files (Wiki)](https://foundryvtt.wiki/en/development/guides/handling-data) - Persistence best practices
- [ClientKeybindings API (v9)](https://foundryvtt.com/api/v9/ClientKeybindings.html) - Registration examples
- Current storyframe.mjs implementation - Working patterns already deployed

### Secondary (MEDIUM confidence)
- [Foundry GitHub Issue #2801](https://github.com/foundryvtt/foundryvtt/issues/2801) - Keybinding API discussion
- [Foundry GitHub Issue #12937](https://github.com/foundryvtt/foundryvtt/issues/12937) - Minimize/maximize behavior
- [Foundry Release 12.317](https://foundryvtt.com/releases/12.317) - ApplicationV2 minimized re-render behavior
- [ApplicationV2 Wiki](https://foundryvtt.wiki/en/development/api/applicationv2) - Community patterns

### Tertiary (LOW confidence - requires validation)
- WebSearch results about general window position persistence (not Foundry-specific)
- Community forum discussions about multiple monitors (anecdotal)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All native Foundry APIs, current code already uses them
- Architecture: HIGH - Patterns validated in existing code, official docs confirm
- Pitfalls: MEDIUM-HIGH - Scene flag pitfall HIGH (documented), off-screen issue MEDIUM (inferred from general patterns)
- Keybindings: HIGH - Official API docs and examples found
- Window state: MEDIUM - Minimized state needs testing, maximized state unclear

**Research date:** 2026-01-29
**Valid until:** 2026-03-01 (30 days - stable APIs, unlikely to change in v13)
