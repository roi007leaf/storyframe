# Phase 05 Plan 01: Journal CSS Integration Summary

**One-liner:** CSS extraction and namespacing for journal custom styles via CSSOM API

---
phase: 05
plan: 01
subsystem: ui
tags: [css, journal, styling, foundry-integration]
dependency-graph:
  requires: [04-02]
  provides: [journal-css-extraction, css-namespacing]
  affects: []
tech-stack:
  added: []
  patterns: [css-scraper, cssom-extraction, css-namespacing, style-injection]
decisions:
  - id: full-stylesheet-extraction
    choice: Extract all document.styleSheets, not just journal-specific
    rationale: Simpler, less brittle than selector filtering
  - id: namespace-prefix
    choice: .storyframe-content wrapper class
    rationale: Scopes styles without Shadow DOM breaking text enrichment
  - id: hook-timing
    choice: closeJournalSheet over renderJournalSheet
    rationale: Fires once when editor closes, CSS changes finalized
key-files:
  created:
    - scripts/css-scraper.mjs
  modified:
    - scripts/applications/gm-interface.mjs
    - storyframe.mjs
    - templates/gm-interface.hbs
metrics:
  duration: 2min
  completed: 2026-01-29
---

## What Was Built

Created CSS scraping system that extracts journal stylesheet rules and applies them to StoryFrame content with proper namespacing.

**Key components:**

1. **CSSScraper utility** (scripts/css-scraper.mjs)
   - extractJournalCSS: iterates document.styleSheets via CSSOM
   - namespaceCSSRules: prefixes selectors with .storyframe-content
   - Cache management with clearCache/clearAllCache
   - CORS error handling for external stylesheets

2. **GM interface integration** (gm-interface.mjs)
   - Import and initialize CSSScraper
   - _updateJournalStyles: extract → namespace → inject
   - _clearJournalStyles: clear when no journal
   - Style element cleanup in _onClose

3. **Template updates** (gm-interface.hbs)
   - Added .storyframe-content wrapper to journal-page-content section

4. **Hook watchers** (storyframe.mjs)
   - updateJournalEntry: re-scrape on content changes
   - closeJournalSheet: re-scrape after editor closes (200ms delay)

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

| Decision | Options Considered | Choice | Rationale |
|----------|-------------------|--------|-----------|
| CSS extraction scope | Filtered vs all rules | Extract all document.styleSheets | Simpler, less brittle than selector matching |
| Namespacing approach | Shadow DOM vs prefix | .storyframe-content prefix | Shadow DOM breaks Foundry text enrichment |
| Re-scrape hook | renderJournalSheet vs closeJournalSheet | closeJournalSheet with 200ms delay | Fires once, CSS changes finalized, no race conditions |

## Technical Highlights

**CSSOM extraction pattern:**
- Direct access to CSSStyleSheet.cssRules for full cascade context
- Handles media queries, @-rules (skips from namespacing - they scope themselves)
- Try-catch for CORS errors on external stylesheets

**CSS namespacing algorithm:**
- Parse CSS by brace depth to handle nested rules
- Skip @-rules from prefixing
- Split comma-separated selectors
- Prefix each with .storyframe-content

**Hook timing:**
- closeJournalSheet preferred over renderJournalSheet
- Fires once when editor closes (not on every re-render)
- 200ms delay ensures stylesheets fully detached/updated
- No race conditions with stylesheet loading

## Risks Mitigated

1. **Style leakage to other Foundry UI** → Namespacing with .storyframe-content
2. **CORS blocking external stylesheets** → Try-catch, skip inaccessible sheets
3. **Stale cached CSS after edits** → clearCache on updateJournalEntry and closeJournalSheet
4. **Race conditions with stylesheet loading** → 200ms delay after closeJournalSheet

## Next Phase Readiness

**Phase 05-02 (Edit Button & Drag-Drop Fix):**
- Edit button already exists in HEADER_ACTIONS (added in this phase's GM interface changes)
- Drag-drop handlers exist, may need restoration/fixes
- Ready to proceed

**Blockers:** None

**Open questions:**
- Should edit button be disabled vs hidden when no journal selected? (Low priority UX detail)
- Typography/spacing improvements scope for 05-03? (Design polish deferred to next plan)

## Testing Notes

**Manual verification required:**
1. Load Foundry, select journal with custom CSS (e.g., Monk's Enhanced Journal)
2. Verify styles render in StoryFrame matching native journal
3. Open journal editor, modify CSS (change color/font), close editor
4. Verify StoryFrame updates within 500ms
5. Select different journal, verify old styles cleared
6. Close StoryFrame, verify no orphan <style id="storyframe-journal-styles"> in document.head

**Expected behavior:**
- Custom journal CSS renders correctly
- Plain journals use Foundry base styles (fallback)
- No style pollution outside .storyframe-content
- Closing editor triggers re-scrape automatically

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| 34e04ec | feat | Create CSS scraper utility |
| aff663f | feat | Integrate CSS scraper into GM interface |

## Lessons Learned

**What worked well:**
- CSSOM API straightforward, handles all CSS rule types
- closeJournalSheet hook timing perfect for editor workflow
- Namespacing simple, effective, no Shadow DOM complexity

**What to watch:**
- Cache invalidation - ensure clearCache called on all edit paths
- CORS errors common with external stylesheets (expected, handled)
- 200ms delay may need tuning on slow systems

**Code patterns to reuse:**
- Brace-depth CSS parsing for handling nested rules
- Try-catch around sheet.cssRules for CORS
- setTimeout after sheet close for stylesheet detachment
