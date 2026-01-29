# Phase 2: GM Interface - Context

**Gathered:** 2026-01-29
**Status:** Ready for planning

<domain>
## Phase Boundary

GM control window that combines journal reading with speaker management. GM can select a journal to display, build a speaker gallery from actors or images, and broadcast the active speaker to players. This phase delivers the GM-facing interface only - player viewer is Phase 3, persistence features are Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Window layout & organization
- Window is resizable with adjustable split between journal and speaker gallery
- Claude's Discretion: Overall layout pattern (side-by-side vs top-bottom), empty gallery state, toolbar/header design

### Speaker addition workflow
- Support multiple methods: drag-drop from actor sidebar AND button that opens picker
- Claude's Discretion: Image-only speaker workflow, label defaulting behavior, duplicate validation approach

### Speaker gallery interaction
- Fixed order (speakers stay in order they were added, not reorderable by drag)
- Claude's Discretion: Click behavior (set active vs toggle), active speaker visual treatment, remove/edit pattern

### Journal selection & display
- Claude's Discretion: Selection UI (dropdown vs search vs recent), content amount to display, rich formatting support, empty state behavior

</decisions>

<specifics>
## Specific Ideas

No specific requirements - open to standard approaches that feel native to FoundryVTT.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope

</deferred>

---

*Phase: 02-gm-interface*
*Context gathered: 2026-01-29*
