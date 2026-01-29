---
phase: 03-player-viewer
plan: 01
subsystem: player-ui
tags: [foundry-v13, applicationv2, handlebars, gallery-view, real-time, updateScene-hook]

# Dependency graph
requires:
  - phase: 02-02
    provides: StateManager with speakers array, Scene flag persistence, updateScene broadcasts

provides:
  - PlayerViewerApp with gallery showing ALL speakers
  - 3 layout modes (grid/list/horizontal) with persistent preference
  - Real-time updates via updateScene hook
  - Auto-open/close based on speakers array
  - Player button in token controls
  - Deleted actor fallback

affects: [04-narrative-mode]

# Tech tracking
tech-stack:
  added: []
  patterns: [gallery-stays-open-during-narration, layout-toggle-pattern, speakers-not-activeSpeaker-controls-visibility]

key-files:
  created: []
  modified:
    - scripts/applications/player-viewer.mjs
    - templates/player-viewer.hbs
    - styles/player-viewer.css
    - storyframe.mjs

key-decisions:
  - "Gallery stays open during narration (activeSpeaker null) - only closes when speakers array empty"
  - "Layout toggle via header action button (not window control)"
  - "Same icon for GM and player buttons (fas fa-book-open) - unified branding"
  - "Auto-open when first speaker added, not when activeSpeaker set"

patterns-established:
  - "Gallery visibility tied to speakers.length, not activeSpeaker"
  - "Layout preference per player via client setting"
  - "Header action button for layout toggle in ApplicationV2"
  - "Mystery-man.svg fallback for deleted actors"

# Metrics
duration: 3min
completed: 2026-01-29
---

# Phase 03 Plan 01: Player Viewer Summary

**Gallery view with ALL speakers, active highlight, 3 layouts (grid/list/horizontal), real-time updates via updateScene hook**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-29T16:52:17Z
- **Completed:** 2026-01-29T16:54:54Z
- **Tasks:** 2/2
- **Files modified:** 4

## Accomplishments
- Player sees ALL speakers in gallery (not just active)
- Active speaker highlighted with border + shadow
- 3 layout modes (grid/list/horizontal) with header toggle button
- Layout preference persists per player
- Gallery stays open during narration (only closes when speakers empty)
- Real-time updates via updateScene hook
- Auto-open when first speaker added

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PlayerViewerApp with gallery template and 3-layout CSS** - `a87427c` (feat)
2. **Task 2: Wire hooks, settings, and player button** - `3485378` (feat)

## Files Created/Modified
- `scripts/applications/player-viewer.mjs` - PlayerViewerApp with gallery display and layout toggle
- `templates/player-viewer.hbs` - Gallery template with #each speakers loop
- `styles/player-viewer.css` - 3 layout modes (grid/list/horizontal)
- `storyframe.mjs` - Settings, updateScene hook, player button

## Decisions Made

**DEC-03-01-A: Gallery visibility tied to speakers array, not activeSpeaker**
- Gallery stays open during narration (activeSpeaker null)
- Only closes when speakers array becomes empty
- Rationale: Players see full conversation cast, not just current speaker

**DEC-03-01-B: Layout toggle via header action button**
- Uses HEADER_ACTIONS pattern in ApplicationV2
- Cycles grid → list → horizontal → grid
- Saves to playerViewerLayout client setting
- Rationale: Native Foundry pattern for window controls

**DEC-03-01-C: Same icon for GM and player buttons**
- Both use fas fa-book-open
- Unified StoryFrame branding
- Rationale: Consistency in UI identity

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Player viewer complete. Ready for Phase 4 (Narrative Mode) which will add:
- Narration display in player viewer
- GM narration input controls
- Narrator persistence in scene state

Gallery foundation solid:
- Speaker resolution with deleted actor handling
- Real-time updates working
- Layout system extensible for narration display

---
*Phase: 03-player-viewer*
*Completed: 2026-01-29*
