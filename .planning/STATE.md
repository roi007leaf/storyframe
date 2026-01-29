# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-29)

**Core value:** GM can read journal dialogue without interruption while players see who's speaking
**Current focus:** Phase 4 - Polish

## Current Position

Phase: 4 of 4 (Polish)
Plan: 2 of 3 in current phase
Status: In progress
Last activity: 2026-01-29 — Completed 04-02-PLAN.md (keyboard shortcuts)

Progress: [████████░░] 78%

## Performance Metrics

**Velocity:**
- Total plans completed: 7
- Average duration: 11min
- Total execution time: 1.4 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Foundation | 2/2 | 3min | 1.5min |
| 2. GM Interface | 2/2 | 57min | 28.5min |
| 3. Player Viewer | 1/1 | 3min | 3min |
| 4. Polish | 2/3 | 4min | 2min |

**Recent Trend:**
- Last 5 plans: 02-02 (56min), 03-01 (68min initial), 03-01 (3min re-impl), 04-01 (3min), 04-02 (1min)
- Trend: Polish tasks executing very quickly

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Gallery view vs list: User selected gallery with highlighted current speaker (Pending)
- Click to change vs keyboard: User prefers clicking thumbnails directly (Pending)
- Real-time vs manual broadcast: User expects automatic updates when speaker changes (Pending)
- Both actors and images: Flexibility needed for prepared and improvised speakers (Pending)

From 01-01:
- socketlib in relationships.requires (not deprecated dependencies field)
- Settings registered in init hook (not setup/ready)
- ESModule format with side-effect entry (no exports)

From 01-02:
- State persists to Scene flags (scene-specific speaker lists)
- Socket handlers use executeAsGM for GM permission validation
- Speakers support both actorUuid and imagePath for flexibility
- Deleted actor handling with fallback to mystery-man icon

From 02-01:
- Gallery uses auto-fill grid with 100px min thumbnail size
- Page navigation conditionally rendered with hasMultiplePages
- Active speaker uses border + shadow highlight
- Remove button appears on thumbnail hover

From 02-02:
- v13 hook timing: socketlib.ready fires before init → defensive namespace creation
- v13 controls API: changed to object, use controls.tokens (plural)
- v13 tools API: changed to object, use property assignment not push
- Journal content: match Foundry's exact HTML structure for compatibility
- Layout: 3-column Foundry-style (page TOC + content + speakers) preferred
- Dialog API: use DialogV2 for v13 (avoids jQuery issues)
- Flexbox overflow: requires min-height: 0 on all flex containers
- TextEditor: use foundry.applications.ux.TextEditor.implementation.enrichHTML
- Drag-drop: support images from content + actors from sidebar

From 03-01 (gallery re-implementation):
- Gallery visibility tied to speakers.length, not activeSpeaker
- Gallery stays open during narration (activeSpeaker null)
- Only closes when speakers array empty
- updateScene hook auto-broadcasts flag changes to all clients
- Filter updateScene to current scene only (scene.id check)
- Layout toggle via header action button (HEADER_ACTIONS pattern)
- 3 layout modes: grid/list/horizontal with client setting persistence
- Same icon (fas fa-book-open) for GM and player buttons

From 04-02:
- Single keybinding for both user types (toggleStoryFrame)
- Ctrl+Shift+S default, configurable via Foundry Controls settings
- onDown handler toggles window visibility based on isGM check

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-01-29T17:17:23Z
Stopped at: Completed 04-02-PLAN.md (keyboard shortcuts)
Resume file: None
