---
phase: 04-polish
plan: 01
subsystem: ui
tags: [foundry-vtt, window-management, state-persistence, validation]

# Dependency graph
requires:
  - phase: 03-player-viewer
    provides: Player viewer and GM interface windows
  - phase: 02-gm-interface
    provides: StateManager with Scene flags for persistence
provides:
  - Window position validation preventing off-screen windows
  - Minimized state persistence across sessions
  - GM window auto-opens on reconnect
  - Journal/speaker selection restores from StateManager flags
affects: [future window features, UX improvements]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "validatePosition helper for screen bounds clamping"
    - "Client settings for UI state (minimized, was-open)"
    - "_stateRestored flag pattern for one-time initialization"

key-files:
  created: []
  modified:
    - storyframe.mjs
    - scripts/applications/gm-interface.mjs
    - scripts/applications/player-viewer.mjs

key-decisions:
  - "Inline validatePosition in each app (avoids ESModule import issues)"
  - "gmWindowWasOpen setting tracks auto-open intent separate from position"
  - "Minimized state saved on close, restored on first render only"

patterns-established:
  - "_stateRestored flag prevents duplicate initialization across re-renders"
  - "Position validation clamps to screen bounds on restore"
  - "Client settings separate UI state from position data"

# Metrics
duration: 2min
completed: 2026-01-29
---

# Phase 04 Plan 01: Window State Persistence Summary

**Window position validation, minimized state memory, and journal/speaker restoration from StateManager flags**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-29T17:16:22Z
- **Completed:** 2026-01-29T17:18:09Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Windows validate positions to prevent off-screen restores after monitor changes
- Minimized state persists across sessions for both GM and player windows
- GM window auto-opens on reconnect if was open before disconnect
- Journal selection restores from StateManager flags automatically
- Active speaker highlight restores from StateManager flags (already implemented)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add position validation helper and minimized state settings** - `0510326` (feat)
2. **Task 2: Integrate position validation, minimized state, and data restoration in GM interface** - `5e79426` (feat)
3. **Task 3: Integrate position validation and minimized state in player viewer** - `ab4412a` (feat)

## Files Created/Modified
- `storyframe.mjs` - validatePosition helper, gmWindowMinimized/playerViewerMinimized/gmWindowWasOpen settings, GM auto-open logic in ready hook
- `scripts/applications/gm-interface.mjs` - Position validation on restore, minimized state save/restore, journal selection restoration from flags, gmWindowWasOpen tracking
- `scripts/applications/player-viewer.mjs` - Position validation on restore, minimized state save/restore

## Decisions Made

**Inline validatePosition in each app**
- Avoids ESModule import complexity with side-effect entry pattern
- Each app has independent copy for simplicity

**gmWindowWasOpen separate setting**
- Tracks auto-open intent independently from position data
- Allows user to close window without losing position preference

**_stateRestored flag pattern**
- Prevents duplicate initialization when window re-renders
- Ensures minimize() and state restoration only happen once

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - straightforward implementation following existing patterns.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Window state persistence complete. Ready for additional polish features or production deployment.

No blockers. All must-have truths verified:
- Position validation prevents off-screen windows
- Minimized state restores correctly
- GM window auto-opens on reconnect when appropriate
- Journal dropdown shows previously selected journal
- Active speaker highlight restores from flags
- Speaker list persists across page reloads

---
*Phase: 04-polish*
*Completed: 2026-01-29*
