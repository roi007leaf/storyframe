# Requirements: StoryFrame

**Defined:** 2026-01-29
**Core Value:** GM can read journal dialogue without interruption while players see who's speaking

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Foundation

- [ ] **FOUN-01**: Module manifest valid (id, title, version, compatibility, JSON syntax)
- [ ] **FOUN-02**: Module initializes in correct hook sequence (init→setup→ready)
- [ ] **FOUN-03**: Module works with any Foundry system (system-agnostic)
- [ ] **FOUN-04**: Only GM can open control interface
- [ ] **FOUN-05**: Only GM can edit speakers/broadcast

### Data Layer

- [ ] **DATA-01**: Speaker data persists in document flags (Scene or JournalEntry)
- [ ] **DATA-02**: Flag schema includes version number for future migrations
- [ ] **DATA-03**: State includes active journal, active speaker, speaker list
- [ ] **DATA-04**: Socket communication uses `module.storyframe` namespace
- [ ] **DATA-05**: Socket handlers validate GM permissions before execution
- [ ] **DATA-06**: Speakers store actor UUID or image path
- [ ] **DATA-07**: Speaker data includes label/name field

### GM Control Interface

- [ ] **GMUI-01**: GM can open control window (ApplicationV2)
- [ ] **GMUI-02**: Control window shows journal picker dropdown
- [ ] **GMUI-03**: Control window shows speaker gallery
- [ ] **GMUI-04**: Control window shows journal text content
- [ ] **GMUI-05**: GM can select journal from world journals
- [ ] **GMUI-06**: GM can navigate between journal pages
- [ ] **GMUI-07**: GM can add speaker from actor (UUID picker)
- [ ] **GMUI-08**: GM can add speaker from image path (file picker)
- [ ] **GMUI-09**: GM can set custom label for speaker
- [ ] **GMUI-10**: GM can remove speaker from gallery
- [ ] **GMUI-11**: GM can clear active speaker (narration mode)
- [ ] **GMUI-12**: Control window persists position/size across sessions

### Speaker Gallery

- [ ] **GALL-01**: Gallery displays all speakers as thumbnails
- [ ] **GALL-02**: Active speaker is highlighted/enlarged
- [ ] **GALL-03**: GM clicks thumbnail to change active speaker
- [ ] **GALL-04**: Gallery works without tokens on scene
- [ ] **GALL-05**: Actor speakers show actor portrait
- [ ] **GALL-06**: Image speakers show provided image
- [ ] **GALL-07**: Speaker thumbnails show label/name
- [ ] **GALL-08**: Gallery updates immediately when speaker added/removed

### Player Viewer

- [ ] **PLAY-01**: Players can open viewer window (ApplicationV2)
- [ ] **PLAY-02**: Viewer shows current speaker portrait
- [ ] **PLAY-03**: Viewer shows current speaker name/label
- [ ] **PLAY-04**: Viewer updates in real-time when GM changes speaker
- [ ] **PLAY-05**: Viewer is read-only (no editing controls)
- [ ] **PLAY-06**: Viewer hides/shows based on active speaker state
- [ ] **PLAY-07**: Viewer works with deleted actors (graceful fallback)

### Journal Integration

- [ ] **JOUR-01**: Journal text displays in GM control window
- [ ] **JOUR-02**: Journal content renders as Foundry would render it
- [ ] **JOUR-03**: Journal text scrollable independently from gallery
- [ ] **JOUR-04**: Page navigation updates displayed content
- [ ] **JOUR-05**: Journal selection persists with speaker data

### Conversation Persistence

- [ ] **CONV-01**: Speaker list saves to document flags automatically
- [ ] **CONV-02**: Speaker list restores when reopening module
- [ ] **CONV-03**: Active speaker state persists across GM reconnect
- [ ] **CONV-04**: Conversation data survives Foundry restart

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Management

- **MGMT-01**: GM can reorder speakers via drag-and-drop
- **MGMT-02**: GM can duplicate speaker with different label
- **MGMT-03**: GM can import speakers from scene tokens
- **MGMT-04**: GM can export conversation as journal entry

### Player Features

- **PFEATS-01**: Players see multiple previous speakers (history)
- **PFEATS-02**: Player viewer dockable to sidebar
- **PFEATS-03**: Players can pop out viewer to second monitor

### Integrations

- **INTG-01**: Support Monk's Enhanced Journal
- **INTG-02**: Support Token Action HUD
- **INTG-03**: Export speaker changes to chat log

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Audio/sound effects | Not part of core reading experience, adds complexity |
| Animated transitions | Polish over function, can add in v2 if demanded |
| Multiple simultaneous conversations | Edge case, unclear demand, significant complexity |
| Automatic speaker detection from text | AI/NLP required, fragile, out of scope |
| Player editing/customization | GM-only tool by design, security risk |
| Chat message integration | Separate from reading flow, unclear value |
| Token synchronization | Gallery works independently of tokens |
| Emote system | Theatre Inserts complexity, maintenance burden |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUN-01 | Phase 1 | Pending |
| FOUN-02 | Phase 1 | Pending |
| FOUN-03 | Phase 1 | Pending |
| FOUN-04 | Phase 2 | Pending |
| FOUN-05 | Phase 2 | Pending |
| DATA-01 | Phase 1 | Pending |
| DATA-02 | Phase 1 | Pending |
| DATA-03 | Phase 1 | Pending |
| DATA-04 | Phase 1 | Pending |
| DATA-05 | Phase 1 | Pending |
| DATA-06 | Phase 1 | Pending |
| DATA-07 | Phase 1 | Pending |
| GMUI-01 | Phase 2 | Pending |
| GMUI-02 | Phase 2 | Pending |
| GMUI-03 | Phase 2 | Pending |
| GMUI-04 | Phase 2 | Pending |
| GMUI-05 | Phase 2 | Pending |
| GMUI-06 | Phase 2 | Pending |
| GMUI-07 | Phase 2 | Pending |
| GMUI-08 | Phase 2 | Pending |
| GMUI-09 | Phase 2 | Pending |
| GMUI-10 | Phase 2 | Pending |
| GMUI-11 | Phase 2 | Pending |
| GMUI-12 | Phase 2 | Pending |
| GALL-01 | Phase 2 | Pending |
| GALL-02 | Phase 2 | Pending |
| GALL-03 | Phase 2 | Pending |
| GALL-04 | Phase 2 | Pending |
| GALL-05 | Phase 2 | Pending |
| GALL-06 | Phase 2 | Pending |
| GALL-07 | Phase 2 | Pending |
| GALL-08 | Phase 2 | Pending |
| JOUR-01 | Phase 2 | Pending |
| JOUR-02 | Phase 2 | Pending |
| JOUR-03 | Phase 2 | Pending |
| JOUR-04 | Phase 2 | Pending |
| JOUR-05 | Phase 4 | Pending |
| PLAY-01 | Phase 3 | Pending |
| PLAY-02 | Phase 3 | Pending |
| PLAY-03 | Phase 3 | Pending |
| PLAY-04 | Phase 3 | Pending |
| PLAY-05 | Phase 3 | Pending |
| PLAY-06 | Phase 3 | Pending |
| PLAY-07 | Phase 3 | Pending |
| CONV-01 | Phase 4 | Pending |
| CONV-02 | Phase 4 | Pending |
| CONV-03 | Phase 4 | Pending |
| CONV-04 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 45 total
- Mapped to phases: 45/45 ✓
- Unmapped: 0

---
*Requirements defined: 2026-01-29*
*Last updated: 2026-01-29 after roadmap creation*
