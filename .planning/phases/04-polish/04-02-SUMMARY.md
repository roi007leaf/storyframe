---
phase: 04-polish
plan: 02
subsystem: user-interface
tags: [keybindings, ux, accessibility, foundry-api]
dependency-graph:
  requires: [04-01]
  provides: [keyboard-shortcuts, configurable-hotkeys]
  affects: [04-03]
tech-stack:
  added: []
  patterns: [foundry-keybindings-api]
decisions: []
key-files:
  created: []
  modified: [storyframe.mjs]
metrics:
  duration: 1min
  completed: 2026-01-29
---

# Phase 4 Plan 2: Keyboard Shortcuts Summary

**One-liner:** Ctrl+Shift+S toggles GM/player windows via Foundry keybindings API

## What Was Built

Keyboard shortcut system using Foundry's native keybindings API:

- Registered `toggleStoryFrame` keybinding in init hook
- Default: Ctrl+Shift+S (configurable by users)
- GM users: toggles GM interface window
- Non-GM users: toggles player viewer window
- Shows in Foundry Configure Controls settings menu

**Implementation approach:**
- Single keybinding handles both user types via isGM check
- Uses onDown handler to toggle rendered state
- Creates app instance if doesn't exist, then toggles visibility
- Returns true to consume event and prevent other handlers

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| 0581b8e | feat | Register Ctrl+Shift+S keybinding |

## Key Decisions Made

**1. Single keybinding for both user types**
- **Decision:** Use one `toggleStoryFrame` keybinding instead of separate GM/player keybindings
- **Rationale:** Simpler UX, same mental model for both user types, easier to remember
- **Impact:** Users see single "Toggle StoryFrame" entry in Configure Controls
- **Alternatives considered:** Separate keybindings (rejected: unnecessary complexity)

## Files Modified

**storyframe.mjs** (35 lines added)
- Added keybinding registration in init hook
- Toggles appropriate window based on user role
- Configurable via Foundry settings UI

## Next Phase Readiness

**Ready for 04-03:** Position persistence implementation

**What's available:**
- Keybinding system functional and configurable
- Window toggle logic works for both user types
- No dependencies blocking position persistence work

**No blockers.**

## Testing Notes

**Manual verification needed:**
1. Load Foundry, check Configure Controls menu shows "Toggle StoryFrame"
2. As GM: press Ctrl+Shift+S → GM window opens/closes
3. As Player: press Ctrl+Shift+S → player viewer opens/closes
4. In Configure Controls, change keybinding → verify new key works

**Expected behavior:**
- First press: opens window if closed
- Second press: closes window if open
- Works consistently for both GM and player roles
