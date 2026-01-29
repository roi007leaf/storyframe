---
phase: 03
plan: 01
type: execute
status: complete
subsystem: player-ui
tags: [foundry-v13, applicationv2, handlebars, real-time, hooks]

dependencies:
  requires: [02-02]
  provides: [player-viewer-app, real-time-updates, player-button]
  affects: [04-01]

tech-stack:
  added: []
  patterns: [updateScene-hook-pattern, auto-open-close-viewer, deleted-actor-fallback]

key-files:
  created:
    - scripts/applications/player-viewer.mjs
    - templates/player-viewer.hbs
    - styles/player-viewer.css
  modified:
    - storyframe.mjs
    - module.json

decisions:
  - id: DEC-03-01-A
    what: Auto-open viewer when speaker set
    why: Better UX - players don't need to manually open
    alternatives: [require-manual-open, always-visible]
    chosen: auto-open
    impact: Viewer opens automatically on first speaker activation

  - id: DEC-03-01-B
    what: Auto-close viewer when speaker cleared
    why: Clean signal that narration mode active, no DOM clutter
    alternatives: [minimize-instead, hide-with-css]
    chosen: auto-close
    impact: Viewer closes completely when activeSpeaker is null

metrics:
  duration: 68min
  tasks: 2/2
  commits: 2
  completed: 2026-01-29
---

# Phase 03 Plan 01: Player Viewer Summary

**One-liner:** Player viewer window with auto-open/close based on activeSpeaker, real-time updates via updateScene hook, mystery-man fallback for deleted actors

## What Was Built

Created PlayerViewerApp - a lightweight read-only window for players showing current speaker portrait and name. Viewer automatically opens when GM sets active speaker, updates in real-time when speaker changes, and closes when GM clears speaker (narration mode).

**Core components:**
- PlayerViewerApp class extending HandlebarsApplicationMixin(ApplicationV2)
- Simple template with conditional speaker/no-speaker display
- CSS with flex layout for portrait and name
- updateScene hook integration for real-time broadcast
- Player button in token controls for manual open

**Key behaviors:**
- Auto-opens when activeSpeaker set (first time or manual button click)
- Auto-closes when activeSpeaker cleared (null = narration)
- Updates display immediately when speaker changes
- Handles deleted actors with mystery-man.svg fallback
- Filters updateScene to current scene only (prevents cross-scene updates)

## Technical Implementation

**PlayerViewerApp structure:**
- DEFAULT_OPTIONS: 300x400 window, resizable, minimizable, 'fas fa-user' icon
- PARTS: Single content template at player-viewer.hbs
- _prepareContext: Gets state from StateManager, returns noSpeaker:true if no activeSpeaker/speaker not found
- _resolveSpeaker: Resolves actorUuid with fromUuid, falls back to imagePath or mystery-man if actor deleted

**Hook integration:**
- ready hook: Initialize PlayerViewerApp for non-GM users, auto-open if activeSpeaker already set
- updateScene hook: Listen for flags.storyframe changes, filter to current scene, reload state, conditionally open/close/update viewer
- getSceneControlButtons: Add player button (non-GM only) to token controls

**Settings:**
- playerViewerPosition: Client-scoped setting for window position persistence (registered in init hook)

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

1. **Auto-open on speaker set**: Viewer opens automatically when GM sets activeSpeaker (better UX than requiring manual open)
2. **Auto-close on speaker cleared**: Viewer closes completely when activeSpeaker is null (cleaner than minimize, signals narration mode)
3. **Scene filtering**: updateScene filtered to current scene only (prevents wrong-scene updates)
4. **Manual open fallback**: Player button in token controls allows manual open even when closed

## Files Modified

**Created:**
- `scripts/applications/player-viewer.mjs` - PlayerViewerApp class with _prepareContext and _resolveSpeaker
- `templates/player-viewer.hbs` - Template with noSpeaker conditional, portrait div, speaker-info div
- `styles/player-viewer.css` - Flex layout with portrait (flex:1), name (margin-top 1rem), no-speaker state

**Modified:**
- `storyframe.mjs` - Import PlayerViewerApp, register playerViewerPosition setting, initialize in ready hook, add updateScene hook, add player button to token controls
- `module.json` - Add styles/player-viewer.css to styles array

## Testing Notes

**Manual verification required:**
1. As GM: Open GM interface, set active speaker → Player viewer should auto-open
2. As GM: Change speaker → Player viewer should update immediately
3. As GM: Clear speaker → Player viewer should auto-close
4. As Player: Click StoryFrame button in token controls → Viewer opens manually
5. As GM: Delete actor used as speaker → Player viewer should show mystery-man.svg fallback
6. Verify no edit controls visible in player viewer (read-only)
7. Change scene with active speaker → Viewer should not update (scene filter working)

## Next Phase Readiness

**Ready for Phase 4 (Polish):**
- Player viewer functional with real-time updates
- Auto-open/close behavior established
- Deleted actor handling consistent with GM interface

**Potential Phase 4 features:**
- Window position persistence (setting registered, needs _onPosition implementation)
- Conversation state persistence (activeJournal + speakers + activeSpeaker)
- Hotkeys for GM speaker control
- Visual refinements (animations, transitions)

**No blockers identified.**

## Performance Notes

- updateScene hook fires on all clients automatically (no custom socket needed)
- Hook filtered to current scene only (prevents unnecessary renders)
- Conditional open/close prevents render() calls on closed windows
- _resolveSpeaker async but fast (fromUuid single document lookup)

## Commits

| Commit | Description |
|--------|-------------|
| aef00c5 | feat(03-01): create PlayerViewerApp with template and CSS |
| 7046b95 | feat(03-01): wire hooks for real-time updates and player button |

**Total commits:** 2
**Duration:** 68 minutes
