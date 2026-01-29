# Phase 5: Journal Integration & UI Polish - Context

**Gathered:** 2026-01-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix journal style integration, add GM editing workflow, restore broken drag-drop functionality, and comprehensively redesign interface for professional polish. Scope: visual quality improvements and missing editor workflow — no new speaker/journal capabilities.

</domain>

<decisions>
## Implementation Decisions

### CSS Scraping Approach
- Full journal stylesheet extraction (not just computed styles)
- Watch for changes: re-scrape when journal is edited while StoryFrame open
- Namespace with `.storyframe-content` class to avoid affecting other Foundry UI
- Fall back to Foundry journal base styles when journal has no custom styles

### Edit Button Placement & Behavior
- Opens journal's native editor (call `journal.sheet.render()`)
- Icon only: pencil/edit icon matching Foundry style

### Design Improvements
- **Identity:** Distinct identity with polish (not just Foundry defaults)
- **Reference:** Arc browser aesthetic — polished UI, smooth interactions, thoughtful details
- **Scope:** Comprehensive redesign needed across all elements:
  - Speaker gallery thumbnails (size, spacing, active state, hover effects)
  - Journal content area (typography, margins, reading width)
  - Window chrome/header (title bar, controls, overall frame)
- **Problems to solve:**
  - Typography/spacing feels cramped
  - Visual hierarchy unclear
  - Colors/contrast off
  - Currently just uses regular Foundry CSS without refinement

### Claude's Discretion
- Edit button placement (header vs content area)
- Edit button visibility handling (hide vs disable when no journal)
- Exact typography scale and spacing system
- Color palette refinement
- Interaction micro-animations
- Drag-drop restoration implementation approach

</decisions>

<specifics>
## Specific Ideas

- "The whole style lacks some punch currently, we just use regular foundry css"
- Arc browser reference: focus on polished details and smooth interactions
- All elements need visual improvement, not selective refinements

</specifics>

<deferred>
## Deferred Ideas

Drag-drop restoration — User didn't select this for detailed discussion, but noted as broken. Claude has full discretion on implementation approach (which drag sources, visual feedback, URL extraction).

</deferred>

---

*Phase: 05-journal-integration-ui-polish*
*Context gathered: 2026-01-29*
