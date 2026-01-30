---
phase: 06-pc-participants-pf2e-checks
plan: 02
subsystem: ui
tags: [handlebars, foundry-v13, pf2e, participants, skill-checks, dc-visibility]

# Dependency graph
requires:
  - phase: 06-01
    provides: State foundation with participants, pendingRolls, rollHistory, and socket handlers
provides:
  - GM interface participants panel with add/remove and selection
  - Skill check request UI with quick buttons and DC controls
  - DC visibility toggle (hidden vs visible to players)
  - Drag-drop PC actors to participants
  - "Add All PCs" bulk action
affects: [06-03, 06-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Collapsible panel pattern for secondary UI sections
    - Multi-select list pattern with visual selection state
    - DC preset buttons with custom input fallback
    - Radio button styling for binary choices

key-files:
  created: []
  modified:
    - templates/gm-interface.hbs
    - scripts/applications/gm-interface.mjs
    - styles/gm-interface.css

key-decisions:
  - "DC visibility control allows GM to choose per-request if DC is hidden or visible to players"
  - "Skill quick buttons show social skills (Dec, Dip, Itm, Prf) plus Perception by default"
  - "Participants panel placed at bottom of speakers sidebar for single-column layout"
  - "PC-only validation on participant drop prevents non-character actors from being added"

patterns-established:
  - "Participant selection uses Set for efficient toggle operations"
  - "DC visibility stored as 'gm' or 'all' string values matching state schema"
  - "Skill slugs mapped to display names via _getSkillName helper"
  - "Request workflow: create pending roll → trigger player prompt via socket"

# Metrics
duration: 4min
completed: 2026-01-30
---

# Phase 06 Plan 02: Participants Panel & Skill Request UI Summary

**GM interface with collapsible participants panel, PC selection, skill quick buttons, DC presets, and DC visibility control**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-30T12:39:45Z
- **Completed:** 2026-01-30T12:43:27Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- GM can manage conversation participants via drag-drop or "Add All PCs" button
- GM can select participant(s) and request skill checks with visual selection feedback
- DC can be set via preset buttons (10/15/20/25/30) or custom input
- DC visibility can be toggled per-request (Hidden/Visible to players)
- Skill quick buttons show social skills plus Perception for fast access

## Task Commits

Each task was committed atomically:

1. **Task 1: Add participants panel to GM interface template** - `b8749f7` (feat)
2. **Task 2: Add participant management logic to GMInterfaceApp** - `4445443` (feat)
3. **Task 3: Style participants panel and skill request UI** - `ec446b0` (feat)

## Files Created/Modified
- `templates/gm-interface.hbs` - Added participants panel HTML with skill buttons, DC input, and DC visibility control
- `scripts/applications/gm-interface.mjs` - Implemented participant management, skill request logic, drag-drop handlers, and DC visibility state
- `styles/gm-interface.css` - Styled participants panel, skill buttons, DC presets, visibility radio buttons, and selection states

## Decisions Made

**DC Visibility Control:**
Chose to add DC visibility toggle at request time (not per-skill or global setting). GM can choose per-check whether DC is hidden or visible to players. This provides maximum flexibility for GMs who want to hide DCs for tension but reveal them for teaching moments.

**Skill Quick Buttons:**
Selected social skills (Deception, Diplomacy, Intimidation, Performance) plus Perception as defaults. These are the most common conversation-related checks in PF2e. "More skills" button opens full list for edge cases.

**Participants Panel Location:**
Placed at bottom of speakers sidebar rather than separate column. Single-column layout keeps GM interface manageable on smaller screens. Panel is collapsible to save space when not actively requesting checks.

**PC-Only Validation:**
Added type='character' validation on participant drop. Prevents NPCs from being added to participants. Only PCs owned by non-GM players can be added.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- GM interface complete for requesting skill checks from participants
- Ready for Phase 06-03: Player roll prompt UI
- Socket infrastructure in place for triggering player-side prompts
- State management ready for tracking pending rolls with DC visibility

No blockers. Next phase can implement player-side roll prompt UI that receives requests from this GM interface.

---
*Phase: 06-pc-participants-pf2e-checks*
*Completed: 2026-01-30*
