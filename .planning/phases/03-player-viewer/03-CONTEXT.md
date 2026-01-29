# Phase 3: Player Viewer - Context

**Gathered:** 2026-01-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Read-only window for players showing the conversation's speaker gallery with real-time updates. Displays ALL speakers in the current scene, highlights whoever is actively speaking, and provides layout options for different player preferences.

</domain>

<decisions>
## Implementation Decisions

### Window Behavior
- **Auto-open immediately** when GM sets first speaker in session
- **Show ALL speakers in gallery** (not just active speaker) - like a mini version of GM's speaker gallery
- **When speaker cleared (narration):** Gallery remains visible showing all speakers, just no active highlight
- **Position and size persist** across sessions via client settings

### Visual Presentation
- **Layout options:** Configurable setting - players choose between grid, vertical list, or horizontal row
- **Layout preference persists** across sessions (client-scoped setting)
- Active speaker emphasis style: Claude's discretion
- Name display approach: Claude's discretion
- Default window dimensions: Claude's discretion (adapt to layout mode)

### Player Controls
- **Button icon:** Same as GM interface (fas fa-book-open) for consistent branding
- **Layout toggle control** within viewer window - button to switch between grid/list/horizontal
- Layout preference saved per player
- Button placement in UI: Claude's discretion

### Transition Behavior
- Speaker change transitions: Claude's discretion
- New speaker appearance: Claude's discretion
- Loading state presentation: Claude's discretion
- Deleted actor fallback: Claude's discretion

### Claude's Discretion
- Active speaker visual emphasis (border/shadow vs enlarge vs color)
- Name display (below thumbnails, on hover, or active only)
- Default window size based on layout mode
- Button placement (token controls vs sidebar vs both)
- All transition animations and timing
- Loading skeleton or spinner design
- Deleted actor presentation (mystery-man transition style)

</decisions>

<specifics>
## Specific Ideas

- Gallery should show ALL speakers currently in the conversation, with active speaker emphasized
- Different players prefer different layouts - some like grid, some vertical, some horizontal
- Layout preference should be remembered per player (not world-wide)
- When no speaker is active (narration), gallery stays visible but no highlight

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-player-viewer*
*Context gathered: 2026-01-29*
