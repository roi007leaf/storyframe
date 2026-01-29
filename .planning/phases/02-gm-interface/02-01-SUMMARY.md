---
phase: 02-gm-interface
plan: 01
subsystem: ui-foundation
tags: [template, css, layout, handlebars, foundry-v13]
dependency-graph:
  requires: [01-02]
  provides: [gm-window-template, responsive-gallery-layout, page-navigation-ui]
  affects: [02-02]
tech-stack:
  added: []
  patterns: [css-grid-gallery, split-pane-layout, handlebars-conditionals]
decisions:
  - Gallery uses auto-fill grid with 100px min thumbnail size
  - Page navigation conditionally rendered with hasMultiplePages
  - Active speaker uses border + shadow highlight
  - Remove button appears on thumbnail hover
key-files:
  created:
    - templates/gm-interface.hbs
    - styles/gm-interface.css
  modified:
    - module.json
metrics:
  duration: 1min
  completed: 2026-01-29
---

# Phase 2 Plan 1: Template and CSS for GM Window Summary

**One-liner:** Split-pane GM interface template with responsive speaker gallery grid and page navigation controls

## What Was Built

Created visual foundation for GM control window:

1. **Handlebars template** (templates/gm-interface.hbs)
   - Split-container layout: journal pane (left) + gallery pane (right)
   - Journal selector dropdown using `selectOptions` helper
   - Page navigation controls (prev/next/indicator) with conditional rendering
   - Journal content area with empty state
   - Speaker gallery grid with active/deleted state conditionals
   - Resize handle between panes
   - Empty states with user instructions

2. **CSS stylesheet** (styles/gm-interface.css)
   - Flexbox split-container with 450px initial journal width
   - CSS Grid gallery with `auto-fill` and `minmax(100px, 1fr)` columns
   - Active speaker highlight: blue border + shadow glow
   - Deleted actor: 60% opacity
   - Resize handle: col-resize cursor with hover state
   - Page navigation button styling with disabled states
   - Remove button: hidden by default, appears on thumbnail hover
   - Responsive without media queries (CSS Grid handles resizing)

3. **Manifest registration** (module.json)
   - Added `styles` array with gm-interface.css

## Technical Implementation

**Template structure:**
- Outer split-container with flexbox
- Journal pane: selector + nav + content
- Gallery pane: header + grid
- Data-action attributes for ApplicationV2 routing
- Handlebars conditionals: `{{#if hasMultiplePages}}`, `{{#if hasSpeakers}}`, `{{#if (eq ../activeSpeaker this.id)}}`

**CSS patterns:**
- Grid: `repeat(auto-fill, minmax(100px, 1fr))` for fluid columns
- Active state: border-color + box-shadow
- Aspect-ratio: 1 for square thumbnails
- Transitions: 0.2s for hover/active state changes
- Foundry CSS variables: --color-border-highlight, --color-text-hyperlink, etc.

**Context data expected:**
- journals: Object with journal IDs and names
- selectedJournal: Active journal ID
- journalContent: HTML string (enriched)
- currentPage/totalPages: Page navigation state
- hasPrevPage/hasNextPage: Navigation button states
- hasMultiplePages: Conditional for showing nav
- speakers: Array with {id, img, name, actorDeleted}
- activeSpeaker: Active speaker ID
- hasSpeakers: Boolean for empty state

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Gallery actions grouped in div | Cleaner header layout | Both buttons in .gallery-actions container |
| Page navigation shows "Page X of Y" | Clear current position | Displayed between prev/next buttons |
| Remove button positioned absolute | Always accessible | Appears in top-right of thumbnail on hover |
| Empty states for both journal and gallery | User guidance | Instructions prompt dropdown selection or drag actors |

## Integration Points

**With Phase 1 (Data Layer):**
- Template expects context data from StateManager.getState()
- Data-action attributes will trigger SocketManager broadcasts
- Speaker data structure matches StateManager schema

**With Plan 02-02 (GMInterfaceApp):**
- Template path: modules/storyframe/templates/gm-interface.hbs
- Context preparation needed: journals iteration, speaker enrichment, page state calculation
- Action handlers needed: selectJournal, prevPage, nextPage, addSpeakerFromImage, setSpeaker, removeSpeaker, clearSpeaker
- Resize handler needed: mousemove listeners for .resize-handle
- Drag-drop handler needed: accept actors on .speaker-gallery

## Next Phase Readiness

**Ready for Plan 02-02:**
- Template defines all data-action triggers
- CSS provides complete visual styling
- No dependencies on future plans

**Blockers:** None

**Concerns:** None

## Files Modified

**Created:**
- `/Users/roihorowitz/Library/Application Support/FoundryVTT/Data/modules/storyframe/templates/gm-interface.hbs` (72 lines)
- `/Users/roihorowitz/Library/Application Support/FoundryVTT/Data/modules/storyframe/styles/gm-interface.css` (224 lines)

**Modified:**
- `/Users/roihorowitz/Library/Application Support/FoundryVTT/Data/modules/storyframe/module.json` (added styles array)

## Verification Results

- [x] templates/gm-interface.hbs exists with split-container layout
- [x] Template includes page navigation controls (GMUI-06, JOUR-04)
- [x] styles/gm-interface.css exists with responsive grid and active states
- [x] module.json includes styles array referencing gm-interface.css

**Success criteria met:** Template and CSS ready for ApplicationV2 class. Page navigation UI elements included. No JavaScript yet - that's Plan 02-02.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 7c6074f | Create GM interface template |
| 2 | 2c1f3a7 | Create CSS and register in manifest |

---
*Summary generated: 2026-01-29*
*Execution time: 1min*
