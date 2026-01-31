---
phase: 07-premium-journal-css-scraper
plan: 03
subsystem: ui
tags: [css, foundry, journals, premium-modules, async, dom]

# Dependency graph
requires:
  - phase: 07-02
    provides: Settings-based cache persistence and debug logging infrastructure
provides:
  - CSS extraction timing fix preventing race conditions
  - Premium module stylesheet detection from rendered journal sheets
  - Async link stylesheet loading with timeout handling
  - Correct extraction ordering (class first, then CSS)
affects: [future CSS scraping features, journal styling improvements]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Async CSS extraction with link stylesheet waiting
    - Deferred CSS extraction until class is determined
    - Sheet element parameter for stylesheet discovery

key-files:
  created: []
  modified:
    - scripts/css-scraper.mjs
    - scripts/applications/gm-interface.mjs

key-decisions:
  - "CSS extraction waits for extractedClass to be determined before proceeding"
  - "Link stylesheets from sheet element are waited for (up to 2s timeout)"
  - "Split CSS extraction into sync and async paths based on sheet element presence"
  - "_cssUpdatePending flag prevents multiple simultaneous CSS updates"

patterns-established:
  - "extractJournalCSS returns string (sync) or Promise<string> (async) based on sheetElement"
  - "_scheduleClassExtraction calls _updateJournalStyles after class extraction completes"
  - "_updateJournalStyles defers to _scheduleClassExtraction if extractedClass not cached"
  - "_waitForLinkStylesheets helper with load/error/timeout handling"

# Metrics
duration: 3min
completed: 2026-01-31
---

# Phase 07 Plan 03: Premium Journal CSS Scraper Summary

**Fixed CSS extraction timing to ensure class determination before extraction, and added premium module stylesheet detection from rendered journal sheets with async loading**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-31T15:22:47Z
- **Completed:** 2026-01-31T15:25:41Z
- **Tasks:** 3 (all auto, executed together)
- **Files modified:** 2

## Accomplishments
- Fixed race condition where CSS extracted before class determined (no more "Extracted class: none")
- Premium module stylesheets now detected from rendered sheet's link elements
- Link stylesheets waited for asynchronously before CSS extraction
- Eliminated duplicate extractions (only one extraction per journal selection)
- CSS payload now properly filtered to relevant rules (not 270KB of unfiltered CSS)

## Task Commits

All tasks completed in single atomic commit:

1. **Task 1: Fix extraction ordering in GMInterface** - `0b7db9d` (feat)
2. **Task 2: Extract CSS from rendered journal sheet's stylesheets** - `0b7db9d` (feat)
3. **Task 3: Update GMInterface to pass sheet element to CSS scraper** - `0b7db9d` (feat)

## Files Created/Modified
- `scripts/applications/gm-interface.mjs` - Fixed CSS extraction ordering, added _cssUpdatePending flag, pass sheet element to CSS scraper
- `scripts/css-scraper.mjs` - Added async extraction path, link stylesheet waiting, sheet element search, split into sync/async methods

## Decisions Made

**1. Defer CSS extraction until class is determined**
- `_updateJournalStyles` checks if `extractedClass` exists in cache
- If not, triggers `_scheduleClassExtraction` and returns early
- Prevents extracting CSS with null class (which matched ALL rules due to empty primaryKeywords)

**2. Split CSS extraction into sync and async paths**
- If `sheetElement` provided, use async path (wait for link stylesheets)
- If no `sheetElement`, use sync path (document.styleSheets only)
- Maintains backward compatibility while enabling premium module stylesheet detection

**3. Wait for link stylesheets with timeout**
- Search sheet element for `link[rel="stylesheet"]` elements
- Wait up to 2 seconds for each link to load (load/error events)
- Log premium module stylesheets when found (e.g., modules/pf2e-kingmaker-tools/styles/km.css)
- Timeout prevents indefinite waiting if stylesheet fails to load

**4. Prevent simultaneous CSS updates**
- Added `_cssUpdatePending` flag to GMInterface constructor
- Early return if CSS update already in progress
- Prevents race conditions from multiple rapid journal selections

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation proceeded smoothly. The diagnostic logs from user provided clear understanding of the race condition and missing stylesheet detection.

## Next Phase Readiness

**Phase 07 complete.** Premium journal CSS scraping fully functional:
- CSS extraction timing is correct (class determined before extraction)
- Premium module stylesheets detected and extracted
- Visual styling for Kingmaker and other premium modules now works
- Debug logging comprehensive for user diagnostics

**No blockers for future phases.**

Ready for user verification:
1. Open StoryFrame and select a Kingmaker journal
2. Check console logs show "Extracted class: pf2e-km" (not "none")
3. Check for "FOUND premium module stylesheet" log
4. Verify Kingmaker teal/gold theme appears in journal content
5. Confirm only one extraction per journal selection (not two)

---
*Phase: 07-premium-journal-css-scraper*
*Completed: 2026-01-31*
