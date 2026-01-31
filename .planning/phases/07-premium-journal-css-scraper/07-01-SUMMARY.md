---
phase: 07
plan: 01
subsystem: css-scraper
completed: 2026-01-31
duration: 2h 2min
tags: [css, filtering, namespacing, cssom, premium-modules]

requires:
  - phase: 05
    plan: 01
    artifact: "CSSScraper class with CSSOM extraction"

provides:
  - artifact: "Hybrid CSS filtering (URL + keyword)"
    location: "scripts/css-scraper.mjs"
    exports: ["extractJournalCSS"]
  - artifact: "Selective namespacing with DOM-context preservation"
    location: "scripts/css-scraper.mjs"
    exports: ["namespaceCSSRules", "shouldNamespace"]

affects:
  - phase: 07
    plan: 02
    note: "Filtered CSS will be smaller and more accurate for class extraction"

tech-stack:
  added: []
  patterns:
    - "Hybrid filtering: URL pattern matching + keyword filtering"
    - "Selective namespacing: Preserve DOM-contextual selectors"
    - "@-rule special handling: @layer, @media, @keyframes"

key-files:
  created: []
  modified:
    - path: "scripts/css-scraper.mjs"
      changes: "Refactored extractJournalCSS and namespaceCSSRules methods"

decisions:
  - id: "hybrid-filtering-approach"
    what: "Combine URL-based filtering (when href available) with keyword-based filtering"
    why: "Handles both external stylesheets and inline styles, filters out other premium modules"
    alternatives: ["Pure URL filtering (fails for inline styles)", "Pure keyword filtering (includes too much)"]

  - id: "selective-namespacing"
    what: "Only namespace selectors without DOM-contextual elements (body, html, :root)"
    why: "Complex selectors like 'body.game .app .pf2e-km' break when naively prefixed"
    alternatives: ["Blanket namespacing (breaks complex selectors)", "No namespacing (causes conflicts)"]

  - id: "layer-preservation"
    what: "Preserve @layer directives entirely without modification"
    why: "Layer cascade order is complex, extraction can reorder layers and break styles"
    alternatives: ["Strip @layer directives", "Attempt to namespace inside @layer"]

  - id: "world-journal-handling"
    what: "Use extractedClass parameter for filtering when journal.pack is null"
    why: "World journals (imported from compendiums) lose pack reference, need alternative filter"
    alternatives: ["Skip filtering for world journals", "Extract all journal CSS"]

commits:
  - hash: "9688124"
    message: "feat(07-01): implement hybrid CSS filtering"
    files: ["scripts/css-scraper.mjs"]
  - hash: "774ad54"
    message: "feat(07-01): implement selective namespacing"
    files: ["scripts/css-scraper.mjs"]
---

# Phase 07 Plan 01: Hybrid CSS Filtering & Selective Namespacing Summary

Refactored CSS scraper with hybrid filtering (URL + keyword) and selective namespacing that preserves complex selectors.

## What Was Built

### 1. Hybrid CSS Filtering (`extractJournalCSS`)

**URL-based filtering:**
- Built exclusion list of 14 premium modules (kingmaker, pfs, beginner-box, etc.)
- Skips stylesheets from other modules when target module is known
- Allows stylesheets from target module or generic (pf2e, system, foundry)

**Keyword-based filtering:**
- Primary keywords: Extracted class itself (e.g., 'pf2e-km', 'pf2e-pfs07')
- Secondary keywords: journal, page-content, entry-page, text-content
- Includes rule only if it matches primary OR secondary keywords

**World journal handling:**
- When `journal.pack` is null, uses `extractedClass` parameter for filtering
- Extracts module name from class (e.g., 'km' from 'pf2e-km') for URL filtering
- Enables accurate filtering for journals imported to world from compendiums

**CORS handling:**
- Wraps `cssRules` access in try-catch
- Catches `SecurityError` specifically for cross-origin stylesheets
- Logs debug message and continues gracefully

### 2. Selective Namespacing (`namespaceCSSRules`)

**`shouldNamespace()` helper function:**
- Detects DOM-contextual elements: body, html, :root
- Detects already-scoped selectors: .journal-page-content, .journal-entry
- Returns `false` for these cases, `true` for everything else

**Selective namespacing logic:**
- Splits multi-selector rules by comma
- Applies `shouldNamespace()` check to each selector individually
- Some selectors may be namespaced, others preserved in same rule

**@-rule special handling:**
- `@layer`: Preserved entirely (complex cascade implications)
- `@media`: Recurses into contents for selective namespacing
- `@keyframes`: Preserved entirely (no namespacing needed)
- Other @-rules: Skipped

## Implementation Details

### Key Algorithm Changes

**Before (naive filtering):**
```javascript
const isJournalRelated = journalKeywords.some(kw => ruleText.includes(kw)) ||
  packKeywords.some(kw => ruleText.includes(kw));
```

**After (hybrid filtering):**
```javascript
// URL filtering first
if (targetModuleId && sheet.href) {
  const isFromOtherModule = otherPremiumModules.some(mod =>
    sheetLower.includes(mod) && !targetModuleId.toLowerCase().includes(mod)
  );
  if (isFromOtherModule) continue; // Skip entire stylesheet
}

// Then keyword filtering on rules
const matchesPrimary = primaryKeywords.length === 0 ||
  primaryKeywords.some(kw => ruleText.includes(kw.toLowerCase()));
const matchesSecondary = secondaryKeywords.some(kw => ruleText.includes(kw));

if (matchesPrimary || matchesSecondary) {
  styles.push(rule.cssText);
}
```

**Before (blanket namespacing):**
```javascript
return `${namespace} ${sel}`;
```

**After (selective namespacing):**
```javascript
if (!this.shouldNamespace(sel)) {
  return sel; // Preserve original
}
return `${namespace} ${sel}`;
```

### Edge Cases Handled

1. **World journals without pack:** Uses `extractedClass` parameter for filtering
2. **Multi-selector rules:** Splits on comma, processes individually
3. **@media recursion:** Extracts media query, namespaces inner rules, reconstructs
4. **Case sensitivity:** Converts to lowercase for comparisons
5. **Empty primaryKeywords:** Treats as "match all" (for generic journals)

## Testing Notes

**Manual verification needed:**
- Open Kingmaker journal → should extract only Kingmaker CSS (not PFS, Beginner Box, etc.)
- Open world journal imported from Kingmaker → should use extractedClass for filtering
- Complex selectors like `body.game .app .pf2e-km .sidebar` should not be prefixed
- @layer directives should remain intact in final CSS
- @media rules should have namespaced contents but preserved media query

**Success indicators:**
- CSS payload size reduced from 200KB to <50KB
- Visual styling matches native Kingmaker/PFS journals
- No console errors about SecurityError
- Inspector shows matched rules for complex selectors

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

See frontmatter `decisions` section for detailed decision log.

**Key decision highlights:**
1. Hybrid filtering enables both URL-based exclusion and content-based inclusion
2. Selective namespacing preserves complex selector semantics
3. @layer preservation avoids cascade priority issues
4. World journal handling via extractedClass enables consistent filtering

## Next Phase Readiness

**Blockers:** None

**Concerns:**
- @layer preservation assumes layers are self-contained (may need fallback to strip if cascade issues observed)
- Keyword filtering may be too conservative for some premium modules (may need adaptive extraction in future)

**Opportunities:**
- CSS payload reduction improves performance significantly
- Accurate filtering enables better visual matching to native journals
- Selective namespacing enables support for more complex premium module CSS

**Recommendations for next plan:**
- Test with all premium modules (Kingmaker, PFS, Beginner Box, Abomination Vaults, etc.)
- Monitor CSS payload sizes in production
- Add user setting to enable aggressive mode if conservative filtering too restrictive

## Performance Impact

**Before:**
- 200KB CSS payloads for world journals
- All journal-related CSS extracted regardless of source

**After:**
- <50KB CSS payloads (estimated based on filtering)
- Only target module CSS extracted
- URL filtering skips entire stylesheets (faster than rule-by-rule filtering)

**Metrics:**
- 2 commits
- 2 tasks completed
- 114 lines added, 25 lines removed (net +89 lines)
- 0 syntax errors (ESLint passed)

## Related Documentation

- Phase 07 Research: `.planning/phases/07-premium-journal-css-scraper/07-RESEARCH.md`
- Phase 07 Context: `.planning/phases/07-premium-journal-css-scraper/07-CONTEXT.md`
- CSSScraper implementation: `scripts/css-scraper.mjs`

---

*Phase: 07-premium-journal-css-scraper*
*Plan: 01*
*Completed: 2026-01-31*
*Duration: 2h 2min*
