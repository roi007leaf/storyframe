# Phase 7: Premium Journal CSS Scraper - Context

**Gathered:** 2026-01-31
**Status:** Ready for planning

<domain>
## Phase Boundary

StoryFrame correctly identifies which premium module (Kingmaker, PFS, Beginner Box, etc.) a journal belongs to, extracts that module's specific CSS, and applies proper styling to the StoryFrame interface without breaking window functionality or mixing styles from different premium modules. Handles both compendium journals (with pack property) and world journals (imported, pack is null).

**Current state:** v1.0.3 has partial implementation
- ✓ Class extraction from journal sheets working
- ✓ Class caching implemented (in-memory)
- ✓ Class application to window working
- ⚠️ CSS extraction too broad (grabs all journal CSS)
- ⚠️ CSS namespacing breaks complex selectors
- ⚠️ Styling doesn't visually match native journals

</domain>

<decisions>
## Implementation Decisions

### Class Detection Strategy

- **Hybrid extraction approach:** Temporarily render journal sheet once per journal to extract CSS classes, cache the result forever. Subsequent opens use cached value. Balance between accuracy (gets real classes from DOM) and performance (only happens once).

- **Class priority:** When multiple classes exist (e.g., 'pf2e' and 'pf2e-km'), prioritize premium module class first (pf2e-km). Specific over general. Ensures most accurate styling.

- **Cache persistence:** Save class cache to Foundry settings, not just in-memory. Survives Foundry restarts. Faster subsequent sessions.

### Stylesheet Filtering

- **Combined filtering approach:** Filter stylesheets by URL pattern when href available (skip kingmaker CSS when viewing PFS journals). Fall back to content-based filtering for inline styles or when URL not available.

- **Adaptive extraction strategy:** Start conservative (only premium module-specific CSS with keywords). If styling looks broken or minimal, fall back to aggressive mode (include all journal-related CSS). Balances payload size with coverage.

- **Smart cache invalidation:** Clear CSS cache only when journal is edited or module settings change. Don't clear on simple journal switching. Faster navigation while staying fresh when content changes.

### CSS Application Approach

- **Strategic class placement:** Apply some classes to window root (for global theme variables), others to journal content area specifically (for content styling). Both needed because different CSS targets different levels.

- **Selective namespacing:** Only namespace CSS selectors that don't already have specific scoping (like `.journal-page-content`). Preserve complex selectors (like `body.game .app .pf2e-km .sidebar`). Don't break premium module CSS that expects specific DOM structure.

### Fallback Handling

- **Extraction failure:** When class extraction fails, use last known class from previous journal. Better than base system ID because maintains visual continuity.

- **User control:** Add module setting to disable CSS scraper entirely. Good for troubleshooting CSS conflicts or performance issues.

### Claude's Discretion

- jQuery element extraction approach (search collection vs trust first)
- Whether to use extracted class as filter keyword when pack is null
- Exact class cleanup strategy (remove all vs targeted)
- Color variable extraction and application method
- Retry strategy for failed journal renders
- Loading indicator during async CSS extraction
- Exact logic for "selective namespacing" implementation

</decisions>

<specifics>
## Specific Ideas

### Problem Context (from v1.0.3)

Current implementation issues discovered:
1. World journals have `pack: null` → can't filter by pack, extracts 200KB of CSS
2. CSS namespacing breaks selectors like `body.game .app` → styling doesn't apply
3. Classes being extracted but visual styling not matching native journals
4. Some journals temporarily opened aren't closing properly

### Visual Examples Mentioned

- PFS journals should have distinctive teal/turquoise sidebar with texture
- Kingmaker journals should match Kingmaker's visual theme
- CSS classes like `pf2e-km`, `pf2e-pfs07` are being extracted correctly from journal sheets

### Technical Constraints

- Journal sheets use jQuery objects in Foundry (need to access `.element[0]` or iterate collection)
- Premium module CSS includes `@layer` directives that may not work after namespacing
- Complex selectors in premium CSS expect specific DOM hierarchy
- ApplicationV2 window root shouldn't have 'sheet' or 'window-app' classes (breaks dragging)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-premium-journal-css-scraper*
*Context gathered: 2026-01-31*
