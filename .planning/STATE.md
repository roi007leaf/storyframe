# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-29)

**Core value:** GM can read journal dialogue without interruption while players see who's speaking
**Current focus:** Phase 5 - Journal Integration & UI Polish

## Current Position

Phase: 6 of 6 (PC Participants & PF2e Check Rolls)
Plan: 1 of 4
Status: In progress
Last activity: 2026-01-30 — Completed 06-01-PLAN.md (state foundation for participants)

Progress: [█████████░] 91%

## Performance Metrics

**Velocity:**
- Total plans completed: 10
- Average duration: 7min
- Total execution time: 1.2 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Foundation | 2/2 | 3min | 1.5min |
| 2. GM Interface | 2/2 | 57min | 28.5min |
| 3. Player Viewer | 1/1 | 3min | 3min |
| 4. Polish | 2/2 | 3min | 1.5min |
| 5. Integration/Polish | 1/2 | 2min | 2min |
| 6. Participants/Rolls | 1/4 | 2min | 2min |

**Recent Trend:**
- Last 5 plans: 04-01 (2min), 04-02 (1min), 05-01 (2min), 06-01 (2min)
- Trend: Consistently fast execution, solid foundation enables rapid feature additions

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

From 04-01:
- validatePosition helper clamps window positions to screen bounds
- Inline validatePosition in each app (avoids ESModule import issues)
- gmWindowWasOpen setting tracks auto-open intent separate from position
- _stateRestored flag pattern prevents duplicate initialization
- Minimized state saved on close, restored on first render only
- Journal selection restores from StateManager flags automatically

From 04-02:
- Keybindings registered in init hook (v13 timing-safe)
- Single keybinding toggles appropriate window via isGM check
- App instances cached in game.storyframe namespace for toggle logic
- Precedence NORMAL, unrestricted (available to all users)

From 05-01:
- CSSOM extraction: document.styleSheets for full cascade context
- CSS namespacing: .storyframe-content prefix (Shadow DOM breaks enrichment)
- closeJournalSheet hook: fires once when editor closes, CSS finalized
- 200ms delay after closeJournalSheet ensures stylesheets detached
- Cache invalidation on updateJournalEntry and closeJournalSheet

From 06-01:
- SCHEMA_VERSION 2 with v1->v2 migration for backward compatibility
- 50-item FIFO limit on rollHistory to prevent unbounded growth
- Scene change clears pendingRolls but preserves rollHistory
- executeAsUser pattern for player-specific socket calls
- _handlePromptSkillCheck calls playerApp.showRollPrompt() for UI trigger

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

### Roadmap Evolution

- Phase 5 added: Journal Integration & UI Polish
  - CSS scraper for journal styling
  - Edit button for GM journal access
  - Drag-drop fix for images→speakers
  - Design quality improvements

- Phase 6 added: PC Participants & PF2e Check Rolls
  - GM can define PC conversation participants
  - Request PF2e system check rolls from participants
  - Player check roll prompts and result visibility

## Session Continuity

Last session: 2026-01-30T11:56:33Z
Stopped at: Completed 06-01-PLAN.md (state foundation for participants)
Resume file: None

Config (if exists):
{
  "mode": "yolo",
  "depth": "standard",
  "parallelization": true,
  "commit_docs": true,
  "model_profile": "balanced",
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true
  }
}
