# Phase 4: Polish - Context

**Gathered:** 2026-01-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Add quality-of-life refinements after core loop validated: persist speaker/journal data across restarts, restore window state, and provide keyboard shortcuts. Does not add new conversation capabilities.

</domain>

<decisions>
## Implementation Decisions

### State persistence strategy
- Claude's discretion on per-scene vs global scope (consider existing scene flag usage)
- Claude's discretion on active speaker persistence across restarts
- Claude's discretion on storage location (scene flags vs world flags vs mix)
- Claude's discretion on migration handling (versioned migrations vs fail gracefully)

### Restore behavior
- Claude's discretion on GM control window auto-open behavior
- Claude's discretion on player viewer auto-open (active speaker trigger vs manual control vs remember last state)
- Claude's discretion on mid-session GM reconnect broadcast behavior
- Claude's discretion on late joiner sync (immediate vs waits for next change)

### Window memory
- Per user (client settings) - each GM/player has own window positions
- Both GM control window and player viewer remember position/size
- Claude's discretion on off-screen position validation
- Claude's discretion on minimized/maximized state persistence

### Hotkeys/shortcuts
- Toggle GM control window + toggle player viewer
- Claude's discretion on configurable vs hardcoded (consider Foundry v13 keybinding system)
- Claude's discretion on global vs scoped hotkey activation
- Claude's discretion on default key assignments (avoid Foundry core conflicts)

### Claude's Discretion
- Persistence scope (per-scene vs global)
- Active speaker state on restart
- Storage strategy across different data types
- Migration vs fresh-start approach
- Window auto-open behavior for both GM and players
- Reconnect sync timing
- Off-screen window handling
- Window state (minimized/maximized) persistence
- Keybinding system choice (Foundry native vs custom)
- Hotkey scope and default assignments

</decisions>

<specifics>
## Specific Ideas

No specific requirements - open to standard Foundry patterns for ApplicationV2 windows, client settings, and keybindings.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope

</deferred>

---

*Phase: 04-polish*
*Context gathered: 2026-01-29*
