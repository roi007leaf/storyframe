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
- [x] **Phase 4: Polish** - UX refinements, conversation persistence, hotkeys
- [ ] **Phase 5: Journal Integration & UI Polish** - CSS scraper, edit button, drag-drop fix, design improvements
- [ ] **Phase 6: PC Participants & PF2e Check Rolls** - GM defines PC participants, request check rolls from PCs
- [ ] **Phase 7: Premium Journal CSS Scraper** - Fix CSS filtering and namespacing for premium modules
- [ ] **Phase 8: Skill UI & Batch Roll Requests** - UI improvements, batch rolls, per-skill proficiency, challenge management

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

### Phase 5: Journal Integration & UI Polish
**Goal**: Professional journal rendering with GM editing workflow and restored drag-drop
**Depends on**: Phase 4
**Success Criteria** (what must be TRUE):
  1. Journal custom styles render correctly in StoryFrame content
  2. Styles update when GM edits journal while StoryFrame open
  3. GM can click edit button to open journal's native editor
  4. Images from journal content can be dragged to add speakers
  5. UI feels polished with proper typography, spacing, transitions
  6. Active speaker highlight is visually prominent
**Plans**: 3 plans

Plans:
- [ ] 05-01-PLAN.md — CSS scraper and journal style integration
- [ ] 05-02-PLAN.md — Edit button, drag-drop verification, design tokens
- [ ] 05-03-PLAN.md — Comprehensive UI polish (visual checkpoint)

### Phase 6: PC Participants & PF2e Check Rolls
**Goal**: GM can define which PC characters are participating in the conversation and request PF2e system check rolls from them
**Depends on**: Phase 5
**Success Criteria** (what must be TRUE):
  1. GM can add/remove PC actors as conversation participants
  2. GM can request check rolls from individual participants or all participants
  3. Check roll requests integrate with PF2e system roll mechanics
  4. Players receive check roll prompts when their PC is a participant
  5. Check roll results are visible to GM and relevant players
  6. Participant list persists with conversation state
**Plans**: 4 plans

Plans:
- [ ] 06-01-PLAN.md — State schema extension for participants and roll tracking
- [ ] 06-02-PLAN.md — GM participant panel and skill request UI
- [ ] 06-03-PLAN.md — Player roll prompts and PF2e roll execution
- [ ] 06-04-PLAN.md — Roll history panel and quick button settings

### Phase 7: Premium Journal CSS Scraper
**Goal**: CSS scraper correctly identifies premium module classes and applies proper styling to StoryFrame journals
**Depends on**: Phase 6
**Success Criteria** (what must be TRUE):
  1. StoryFrame correctly extracts CSS classes from journal sheets (pf2e-km, pf2e-pfs07, etc.)
  2. Premium module CSS classes apply to StoryFrame window without breaking functionality
  3. CSS scraper filters stylesheets by journal source to prevent cross-module bleeding
  4. Kingmaker journals display with Kingmaker styling
  5. PFS journals display with PFS styling (including distinctive sidebar colors)
  6. Switching between premium module journals updates CSS correctly
  7. World journals (imported from packs) maintain their original premium module styling
**Plans**: 2 plans

Plans:
- [ ] 07-01-PLAN.md — CSS filtering refactor with hybrid URL + keyword approach and selective namespacing
- [ ] 07-02-PLAN.md — Cache persistence, extraction reliability, and visual verification

### Phase 8: Skill UI & Batch Roll Requests

**Goal**: Polished skill interface with intelligent grouping, batch roll requests, per-skill proficiency filtering, and robust challenge management
**Depends on**: Phase 7
**Success Criteria** (what must be TRUE):
  1. Empty skill category headers are hidden (no layout space occupied)
  2. Skills grouped correctly: Stealth/Thievery in Physical, Mental renamed to Magical, Perception in Utility
  3. Display order preserved: Journal Checks → Lore Skills → Quick Skill Buttons
  4. Multi-PC selection aggregates all skills; each player prompted only with skills they possess
  5. GM can select multiple skills for batch roll request (one atomic request, not persistent challenge)
  6. Each skill supports optional per-skill proficiency filter (not global filter)
  7. Only one active challenge per unique name (duplicates blocked or refreshed)
  8. Multiple different named challenges can be active simultaneously
  9. Challenge headers are collapsible/expandable independently
  10. Grid density targets 4 skills per row (except Social category)
**Plans**: 6 plans

Plans:
- [ ] 08-01-PLAN.md — Grid layout and skill category groupings
- [ ] 08-02-PLAN.md — Multi-skill selection and lore aggregation
- [ ] 08-03-PLAN.md — Challenge uniqueness and collapsible headers
- [ ] 08-04-PLAN.md — Per-skill proficiency filter system
- [ ] 08-05-PLAN.md — Batch roll request handler
- [ ] 08-06-PLAN.md — Visual verification checkpoint

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 2/2 | Complete | 2026-01-29 |
| 2. GM Interface | 2/2 | Complete | 2026-01-29 |
| 3. Player Viewer | 1/1 | Complete | 2026-01-29 |
| 4. Polish | 2/2 | Complete | 2026-01-29 |
| 5. Journal Integration & UI Polish | 0/3 | Ready | - |
| 6. PC Participants & PF2e Check Rolls | 0/4 | Ready | - |
| 7. Premium Journal CSS Scraper | 0/2 | Ready | - |
| 8. Skill UI & Batch Roll Requests | 0/6 | Ready | - |
