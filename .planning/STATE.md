# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-29)

**Core value:** GM can read journal dialogue without interruption while players see who's speaking
**Current focus:** Phase 5 - Journal Integration & UI Polish

## Current Position

Phase: 7 of 7 (Premium Journal CSS Scraper)
Plan: 3 of 3
Status: Phase complete
Last activity: 2026-01-31 — Completed 07-03-PLAN.md (CSS extraction timing fix & premium stylesheet detection)

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 13
- Average duration: 15min
- Total execution time: 3.3 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Foundation | 2/2 | 3min | 1.5min |
| 2. GM Interface | 2/2 | 57min | 28.5min |
| 3. Player Viewer | 1/1 | 3min | 3min |
| 4. Polish | 2/2 | 3min | 1.5min |
| 5. Integration/Polish | 1/2 | 2min | 2min |
| 6. Participants/Rolls | 3/4 | 8min | 2.7min |
| 7. CSS Scraper | 3/3 | 128min | 42.7min |

**Recent Trend:**
- Last 5 plans: 06-03 (2min), 07-01 (122min), 07-02 (3min), 07-03 (3min)
- Trend: Phase 7 complete - Premium journal CSS scraping fully functional

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

From 06-02:
- DC visibility control: 'gm' (hidden) or 'all' (visible to players)
- Skill quick buttons: social skills (Dec/Dip/Itm/Prf) plus Perception
- Participants panel collapsible, placed at bottom of speakers sidebar
- PC-only validation on participant drop (type='character' check)
- Participant selection uses Set for efficient toggle operations

From 06-03:
- Static action handler pattern: ApplicationV2 requires static methods for actions
- Roll prompts placed above speaker gallery for visibility without blocking
- Socket-triggered UI updates: showRollPrompt() called by _handlePromptSkillCheck
- PF2e roll API: actor.perception.roll() for perception, actor.skills[slug].roll() for skills
- Roll extraction: { total, degreeOfSuccess, chatMessageId } from PF2e result

From 07-01:
- Hybrid CSS filtering: URL-based (excludes other modules) + keyword-based (includes relevant rules)
- Selective namespacing: Preserve selectors with body, html, :root (DOM-contextual elements)
- @layer preservation: Keep @layer directives intact (complex cascade implications)
- World journal handling: Use extractedClass parameter when journal.pack is null
- CORS handling: Catch SecurityError specifically, skip external stylesheets gracefully

From 07-02:
- Settings-based cache: CSS cache persists via game.settings.set('journalClassCache')
- Sheet lifecycle: try-finally guarantees cleanup with sheetOpenedByUs flag
- Debug logging: Comprehensive logs for cache, extraction, filtering, namespacing, application
- Console diagnostics: User can filter F12 console by "CSSScraper" or "GMInterface"

From 07-03:
- CSS extraction timing: _updateJournalStyles defers until extractedClass is cached
- Async extraction: Split into sync (no sheet) and async (with sheet element) paths
- Link stylesheet waiting: _waitForLinkStylesheets waits up to 2s for load/error events
- Premium detection: Search sheet element for link stylesheets, log when premium modules found
- _cssUpdatePending flag: Prevents multiple simultaneous CSS updates

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

- Phase 7 added: Premium Journal CSS Scraper (2026-01-31)
  - Fix CSS class extraction and caching for premium modules
  - Properly filter stylesheets by journal source
  - Apply correct premium module styling (Kingmaker, PFS, etc.)
  - Handle world journals (imported from packs)

## Session Continuity

Last session: 2026-01-31T15:25:41Z
Stopped at: Completed 07-03-PLAN.md (CSS extraction timing fix & premium stylesheet detection)
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
