---
phase: 06-pc-participants-pf2e-checks
plan: 01
subsystem: state-management
tags: [socketlib, state-persistence, scene-flags, participants, roll-tracking]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: StateManager and SocketManager foundation
  - phase: 02-gm-interface
    provides: Socket patterns for state mutations
provides:
  - Extended state schema with participants, pendingRolls, rollHistory arrays
  - Socket handlers for participant and roll operations (executeAsGM, executeAsUser)
  - Scene change cleanup for pending rolls
affects: [06-02-gm-participant-ui, 06-03-pf2e-skill-checks, 06-04-player-roll-prompts]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "State schema versioning with migration (v1 -> v2)"
    - "FIFO limit on rollHistory (50 items)"
    - "executeAsUser for player-specific socket calls"

key-files:
  created: []
  modified:
    - scripts/state-manager.mjs
    - scripts/socket-manager.mjs
    - storyframe.mjs

key-decisions:
  - "SCHEMA_VERSION 2 with migration for backward compatibility"
  - "50-item FIFO limit on rollHistory to prevent unbounded growth"
  - "Scene change clears pendingRolls but preserves rollHistory"
  - "executeAsUser pattern for triggering player-specific UI updates"

patterns-established:
  - "Participant structure: {id, actorUuid, userId}"
  - "Roll request structure: {id, participantId, skillSlug, dc: {value, visibility}, timestamp}"
  - "Roll result structure: {requestId, participantId, skillSlug, total, degreeOfSuccess, timestamp, chatMessageId}"
  - "_persistState() helper for consistent state persistence"

# Metrics
duration: 2min
completed: 2026-01-30
---

# Phase 06 Plan 01: State Foundation for Participants Summary

**State schema extended to v2 with participants, pending rolls, and roll history tracking via scene flags and socket handlers**

## Performance

- **Duration:** 2 min 26 sec
- **Started:** 2026-01-30T11:54:07Z
- **Completed:** 2026-01-30T11:56:33Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- StateManager schema upgraded to v2 with participants, pendingRolls, rollHistory arrays
- Complete CRUD API for participants with socket handlers
- Roll tracking methods (add/remove pending, submit results, history management)
- executeAsUser socket pattern for player-targeted prompts
- Scene change hook clears stale pending rolls

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend StateManager schema with participants and roll tracking** - `55295d3` (feat)
2. **Task 2: Extend SocketManager with participant and roll handlers** - `32b9399` (feat)
3. **Task 3: Add scene change hook to clear pending rolls** - `c0a4b05` (feat)

## Files Created/Modified
- `scripts/state-manager.mjs` - Extended to v2 schema with participants/pendingRolls/rollHistory, added CRUD methods, migration from v1
- `scripts/socket-manager.mjs` - Added 8 new socket handlers and public API methods for participants and rolls
- `storyframe.mjs` - Added canvasReady hook for scene change cleanup

## Decisions Made
- **Schema version 2 with migration:** Added v1->v2 migration in _migrate() to add participants, pendingRolls, rollHistory arrays
- **50-item FIFO limit:** rollHistory enforces 50-item cap to prevent unbounded growth in scene flags
- **Scene change behavior:** pendingRolls cleared on scene change (prevents stale prompts), rollHistory preserved within scene
- **executeAsUser pattern:** _handlePromptSkillCheck uses executeAsUser to target specific player clients
- **playerApp.showRollPrompt() wiring:** Handler on player client calls playerApp.showRollPrompt() to trigger UI update

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- State foundation complete for participant and roll tracking
- Socket handlers ready for UI integration in 06-02-PLAN.md
- _handlePromptSkillCheck wired to call playerApp.showRollPrompt() (UI method to be implemented in 06-04)
- Scene change cleanup prevents stale prompts across scene transitions
- Ready for GM participant management UI and PF2e skill check integration

---
*Phase: 06-pc-participants-pf2e-checks*
*Completed: 2026-01-30*
