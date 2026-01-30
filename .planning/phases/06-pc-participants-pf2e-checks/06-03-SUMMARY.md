---
phase: 06-pc-participants-pf2e-checks
plan: 03
subsystem: ui
tags: [foundry, pf2e, roll-prompts, player-ui, socket-integration]

# Dependency graph
requires:
  - phase: 06-01
    provides: Socket handlers and state schema for pendingRolls
  - phase: 06-02
    provides: Participants panel and skill request UI for GM
provides:
  - Player-facing roll prompt UI in StoryFrame viewer
  - PF2e native roll execution with modifier dialog
  - Roll result submission back to GM via sockets
  - Real-time roll prompt display triggered by socket handler
affects: [06-04-roll-history, future-phases-using-skill-checks]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Static action handlers in ApplicationV2 (executeRoll pattern)"
    - "Socket-triggered UI updates via showRollPrompt method"
    - "PF2e skill roll API: actor.skills[slug].roll() and actor.perception.roll()"

key-files:
  created: []
  modified:
    - templates/player-viewer.hbs
    - scripts/applications/player-viewer.mjs
    - styles/player-viewer.css

key-decisions:
  - "Roll prompts placed above speaker gallery for visibility without blocking content"
  - "Static methods for action handlers (_onExecuteRoll, _getSkillDisplayName) per ApplicationV2 pattern"
  - "Pulse animation on roll prompts to draw attention without being obtrusive"
  - "Filter pendingRolls by user's participant to show only relevant prompts"

patterns-established:
  - "ApplicationV2 static action handler pattern for UI interactions"
  - "Socket handler calls app.showRollPrompt() to trigger re-render"
  - "PF2e roll extraction: total, degreeOfSuccess, chatMessageId"

# Metrics
duration: 2min
completed: 2026-01-30
---

# Phase 06 Plan 03: Player Roll Prompts & Execution Summary

**Players see roll prompts in StoryFrame viewer, click to trigger native PF2e rolls with modifier dialog, and results sync back to GM**

## Performance

- **Duration:** 2 minutes
- **Started:** 2026-01-30T06:59:20Z
- **Completed:** 2026-01-30T07:01:34Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Roll prompts display in player viewer when GM requests skill checks
- Native PF2e roll dialog with modifier options
- Roll results automatically sync to StoryFrame state via sockets
- Clean UI with pulsing animation to draw attention

## Task Commits

Each task was committed atomically:

1. **Task 1: Add roll prompt template section to player viewer** - `2d2581e` (feat)
2. **Task 2: Add roll prompt logic and PF2e roll execution to PlayerViewerApp** - `90a8dc1` (feat)
3. **Task 3: Style roll prompts in player viewer** - `931e7ab` (feat)

## Files Created/Modified
- `templates/player-viewer.hbs` - Roll prompt HTML structure with skill name and Roll button
- `scripts/applications/player-viewer.mjs` - Roll prompt filtering, PF2e roll execution, socket integration
- `styles/player-viewer.css` - Roll prompt styling with pulse animation and flexbox layout

## Decisions Made

**1. Roll prompt placement above speaker gallery**
- Ensures visibility when prompts arrive
- Doesn't block speaker gallery content
- Gallery remains independently scrollable

**2. Static action handler pattern**
- ApplicationV2 requires static methods for action handlers
- `_onExecuteRoll` and `_getSkillDisplayName` implemented as static
- Accessed via `PlayerViewerApp._methodName()` syntax

**3. Pulse animation for attention**
- 2-second cycle with subtle shadow expansion
- Warning-colored background (yellow/amber)
- Not obtrusive but noticeable

**4. Filter prompts by user's participant**
- `_prepareContext` finds user's participant via `game.user.id`
- Only shows `pendingRolls` matching participant ID
- Maps `skillSlug` to display name for template

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation proceeded smoothly with existing socket infrastructure and PF2e API.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Roll prompt display and execution complete
- Roll results submitted to GM via `requestSubmitRollResult` socket
- Ready for 06-04: Display roll history in GM participants panel
- State now tracks completed rolls in `rollHistory` array (from 06-01)

## Technical Notes

**PF2e Roll API:**
- Perception: `actor.perception.roll({ dc: { value: X }, skipDialog: false })`
- Skills: `actor.skills[slug].roll({ dc: { value: X }, skipDialog: false })`
- Result structure: `{ total, degreeOfSuccess: { value }, message: { id } }`

**Socket Flow:**
1. GM requests check → `addPendingRoll` to state
2. Socket broadcasts to player → `_handlePromptSkillCheck` called on player client
3. Handler calls `playerApp.showRollPrompt()` → triggers re-render
4. Player clicks Roll → `_onExecuteRoll` executes PF2e roll
5. Result submitted → `requestSubmitRollResult` socket to GM
6. GM adds to `rollHistory`, removes from `pendingRolls`

---
*Phase: 06-pc-participants-pf2e-checks*
*Completed: 2026-01-30*
