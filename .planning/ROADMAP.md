# Roadmap: StoryFrame

## Overview

StoryFrame delivers a unified journal reading and speaker broadcasting interface for FoundryVTT v13 GMs. Four phases: Foundation establishes secure data layer and socket communication, GM Interface builds the control window with journal picker and speaker management, Player Viewer creates synchronized read-only display, and Polish adds refinements based on core loop validation.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Module scaffold, data layer, socket security
- [x] **Phase 2: GM Interface** - Control window, journal picker, speaker management
- [x] **Phase 3: Player Viewer** - Gallery view with all speakers, layout options, real-time updates
- [ ] **Phase 4: Polish** - UX refinements, conversation persistence, hotkeys

## Phase Details

### Phase 1: Foundation
**Goal**: Secure data layer and socket infrastructure ready for UI layers
**Depends on**: Nothing (first phase)
**Requirements**: FOUN-01, FOUN-02, FOUN-03, DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07
**Success Criteria** (what must be TRUE):
  1. Module loads in Foundry without manifest errors
  2. Module initializes in correct hook sequence (init->setup->ready)
  3. StateManager persists speaker data to document flags and restores on reload
  4. SocketManager handles GM->player broadcasts with permission validation
  5. Flag schema includes version number for future migrations
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Module scaffold (manifest, hooks, entry point)
- [x] 01-02-PLAN.md — Data layer (StateManager, SocketManager)

### Phase 2: GM Interface
**Goal**: GM can select journal, manage speakers, and broadcast active speaker
**Depends on**: Phase 1
**Requirements**: FOUN-04, FOUN-05, GMUI-01, GMUI-02, GMUI-03, GMUI-04, GMUI-05, GMUI-06, GMUI-07, GMUI-08, GMUI-09, GMUI-10, GMUI-11, GMUI-12, GALL-01, GALL-02, GALL-03, GALL-04, GALL-05, GALL-06, GALL-07, GALL-08, JOUR-01, JOUR-02, JOUR-03, JOUR-04
**Success Criteria** (what must be TRUE):
  1. GM can open control window from FoundryVTT UI
  2. GM can select journal from dropdown and see text content
  3. GM can add speaker from actor UUID (with portrait)
  4. GM can add speaker from image path (file picker)
  5. GM can click thumbnail to set active speaker
  6. GM can clear active speaker (narration mode)
  7. Active speaker highlights in gallery immediately
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md — Template and CSS for GM window
- [x] 02-02-PLAN.md — GMInterfaceApp class and UI trigger

### Phase 3: Player Viewer
**Goal**: Players see speaker gallery with all conversation participants, highlighted active speaker, and layout options
**Depends on**: Phase 2
**Requirements**: PLAY-01, PLAY-02, PLAY-03, PLAY-04, PLAY-05, PLAY-06, PLAY-07
**Success Criteria** (what must be TRUE):
  1. Player can open viewer window
  2. Viewer shows ALL speakers in gallery (not just active)
  3. Active speaker highlighted in gallery
  4. Viewer updates automatically when GM changes speaker
  5. Gallery stays visible during narration (no active highlight)
  6. Player can toggle layout (grid/list/horizontal)
  7. Layout preference persists per player
  8. Viewer is read-only (no edit controls visible)
  9. Viewer works with deleted actors (graceful fallback to placeholder)
**Plans**: 1 plan

Plans:
- [x] 03-01-PLAN.md — PlayerViewerApp with gallery display, layout toggle, and hook integration

### Phase 4: Polish
**Goal**: Refined UX with persistence and power-user features
**Depends on**: Phase 3
**Requirements**: JOUR-05, CONV-01, CONV-02, CONV-03, CONV-04
**Success Criteria** (what must be TRUE):
  1. Speaker list persists across Foundry restarts
  2. Active speaker state restores when GM reconnects
  3. Journal selection saves with speaker data
  4. Control window remembers position and size between sessions
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md — Window state persistence (position validation, minimized state, auto-reopen)
- [x] 04-02-PLAN.md — Keyboard shortcuts (configurable keybindings)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 2/2 | Complete | 2026-01-29 |
| 2. GM Interface | 2/2 | Complete | 2026-01-29 |
| 3. Player Viewer | 1/1 | Complete | 2026-01-29 |
| 4. Polish | 2/2 | Complete | 2026-01-29 |
