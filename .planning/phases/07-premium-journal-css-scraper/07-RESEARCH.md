# Phase 7: Premium Journal CSS Scraper - Research

**Researched:** 2026-01-31
**Domain:** CSS Object Model (CSSOM) extraction, filtering, and scoping
**Confidence:** MEDIUM

## Summary

This phase refines the CSS scraper to correctly extract and apply premium module journal styles (Kingmaker, PFS, Beginner Box, etc.) without breaking functionality or mixing styles between different modules. The core challenges are: (1) filtering stylesheets to extract only relevant CSS without 200KB payloads, (2) preserving complex selectors that break when naively namespaced, and (3) handling world journals that lack pack identifiers.

The standard approach uses CSSOM (`document.styleSheets` and `cssRules`) for extraction, combined with smart filtering strategies (URL pattern matching + content-based keywords), and selective namespacing that preserves complex selector semantics. Modern CSS features like `@layer` and `@scope` exist but require careful handling when extracting and re-injecting CSS.

The existing v1.0.3 implementation correctly uses CSSOM extraction and has working class detection, but filters too broadly and applies naive namespacing that breaks selectors like `body.game .app .pf2e-km`.

**Primary recommendation:** Use hybrid filtering (URL-based + keyword-based) with intelligent selector preservation that detects and avoids namespacing selectors with DOM-contextual elements (body, html, :root).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| CSSOM | Browser Native | Access and manipulate stylesheets | Native browser API, no external dependencies, full cascade context |
| Foundry Settings API | Foundry v13+ | Persist CSS class cache | Built-in persistence with scope support (client/world/user) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CSS Typed Object Model | Chrome 66+, Firefox (partial) | Type-safe CSS value manipulation | When manipulating CSS variable values programmatically (color extraction) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSSOM extraction | Shadow DOM | Shadow DOM breaks Foundry's ProseMirror enrichment and content links - not viable |
| In-memory cache | Settings persistence | In-memory only loses data on reload, settings survive restarts |
| Naive namespacing | CSS @scope | @scope has limited browser support as of 2026, not baseline yet |

**Installation:**
```bash
# No external dependencies - uses browser native APIs
```

## Architecture Patterns

### Recommended Project Structure
```
scripts/
├── css-scraper.mjs           # CSS extraction and filtering
└── applications/
    └── gm-interface.mjs      # Consumes scraper, manages injection
```

### Pattern 1: Hybrid CSS Filtering
**What:** Combine URL-based filtering (when href available) with content-based keyword filtering (when href unavailable or for inline styles)
**When to use:** Always - handles both external stylesheets and inline styles
**Example:**
```javascript
// Source: Based on MDN CSSOM documentation and current implementation
for (let sheet of document.styleSheets) {
  // URL filtering: Skip stylesheets from other premium modules
  if (sheet.href) {
    const sheetLower = sheet.href.toLowerCase();
    const otherModules = ['kingmaker', 'beginner-box', 'abomination-vaults'];
    const isFromOtherModule = otherModules.some(mod =>
      sheetLower.includes(mod) && !targetModuleId.includes(mod)
    );
    if (isFromOtherModule) continue;
  }

  // Content filtering: Check rule text for relevant keywords
  try {
    const rules = sheet.cssRules || sheet.rules;
    for (let rule of rules) {
      const ruleText = rule.cssText.toLowerCase();
      const isRelevant = keywords.some(kw => ruleText.includes(kw));
      if (isRelevant) styles.push(rule.cssText);
    }
  } catch (e) {
    // CORS - skip external stylesheet
    if (e.name === 'SecurityError') continue;
  }
}
```

### Pattern 2: Selective Namespacing
**What:** Only namespace selectors that don't include DOM-contextual elements (body, html, :root) which break when prefixed
**When to use:** Always when applying extracted CSS to avoid breaking complex selectors
**Example:**
```javascript
// Source: Pattern derived from CSS specificity research
function shouldNamespace(selector) {
  // Don't namespace selectors with DOM-contextual elements
  const contextual = ['body', 'html', ':root', 'body.game'];
  if (contextual.some(ctx => selector.includes(ctx))) return false;

  // Don't namespace already-scoped selectors
  if (selector.includes('.journal-page-content')) return false;

  // Namespace everything else
  return true;
}

const namespaced = selectors.map(sel => {
  if (shouldNamespace(sel)) return `${namespace} ${sel}`;
  return sel; // Preserve original
}).join(', ');
```

### Pattern 3: Strategic Class Placement
**What:** Apply CSS classes to different DOM levels depending on what CSS targets
**When to use:** When premium module CSS targets both global variables (at :root) and content elements
**Example:**
```javascript
// Source: Current implementation pattern
// Apply global classes to window root for :root variables
windowRoot.classList.add('journal-sheet', systemId, premiumClass);

// Apply content classes to content area for scoped selectors
contentArea.classList.add('journal-page-content', premiumClass);
```

### Pattern 4: Settings-Based CSS Cache
**What:** Persist CSS class mappings (journal UUID -> extracted class) in Foundry settings
**When to use:** Always - provides cache persistence across Foundry restarts
**Example:**
```javascript
// Source: Foundry Settings API documentation
game.settings.register(MODULE_ID, 'journalClassCache', {
  scope: 'client',
  config: false,
  type: Object,
  default: {}
});

// Usage
async function cacheJournalClass(journalUuid, extractedClass) {
  const cache = game.settings.get(MODULE_ID, 'journalClassCache');
  cache[journalUuid] = extractedClass;
  await game.settings.set(MODULE_ID, 'journalClassCache', cache);
}
```

### Anti-Patterns to Avoid
- **Blanket namespacing:** Don't prefix ALL selectors - breaks complex selectors like `body.game .app`
- **Pack-only filtering:** Don't rely solely on journal.pack for filtering - world journals have `pack: null`
- **Aggressive CSS extraction:** Don't extract all journal-related CSS without filtering - creates 200KB+ payloads
- **Applying sheet/window-app classes to ApplicationV2 root:** Breaks dragging functionality in ApplicationV2

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSS variable extraction | Custom regex parser | `getComputedStyle(element).getPropertyValue('--var')` | Native API handles all edge cases, inheritance, fallbacks |
| Stylesheet access | Custom HTTP requests | `document.styleSheets` CSSOM API | Already loaded and parsed, respects CORS, includes inline styles |
| CSS parsing | Regex-based selector parser | Work with `cssText` strings, split on braces | CSS syntax is complex (nested @rules, media queries, @layer) |
| Settings persistence | Custom localStorage wrapper | Foundry's `game.settings` API | Handles client/world scopes, change callbacks, migrations |
| jQuery element access | `$(sheet.element)` wrapping | Native `sheet.element[0]` or iterate collection | ApplicationV2 prefers native DOM, jQuery adds overhead |

**Key insight:** CSS parsing is deceptively complex. The browser's CSSOM has already done the hard work - leverage it rather than reimplementing with fragile string manipulation.

## Common Pitfalls

### Pitfall 1: CORS Security Errors on External Stylesheets
**What goes wrong:** Accessing `cssRules` on cross-origin stylesheets throws `SecurityError` exceptions, crashing the extraction process
**Why it happens:** Same-origin policy prevents reading CSS from external domains without CORS headers
**How to avoid:** Always wrap `cssRules` access in try-catch, catch `SecurityError` specifically, skip those stylesheets
**Warning signs:** Console errors with "SecurityError", crashes when certain stylesheets are present

### Pitfall 2: Complex Selector Breakage
**What goes wrong:** Selectors like `body.game .app .pf2e-km .sidebar` become `.namespace body.game .app .pf2e-km .sidebar` which doesn't match anything
**Why it happens:** Naive prefixing doesn't understand selector semantics - `body.game` must be at document root, not inside `.namespace`
**How to avoid:** Parse selectors to detect DOM-contextual elements (body, html, :root), skip namespacing for those
**Warning signs:** CSS extracted but visual styling doesn't match native journals, inspector shows no matched rules

### Pitfall 3: @layer Cascade Priority Inversion
**What goes wrong:** Extracted CSS with `@layer` directives may have different cascade priority when re-injected
**Why it happens:** Layer order matters - first declared = lowest priority, but extraction reorders them
**Why it happens:** Premium module CSS may declare layers in specific order (`@layer base, theme, utilities`) which changes when extracted out of context
**How to avoid:** Extract entire `@layer` blocks together, preserve layer declaration order, consider stripping @layer and relying on injection order
**Warning signs:** Some styles apply but others don't, !important styles behave unexpectedly

### Pitfall 4: World Journal Pack Ambiguity
**What goes wrong:** World journals (imported from compendiums) have `pack: null`, can't filter by pack, extract massive CSS payloads
**Why it happens:** Journal.pack property only exists for compendium journals, imported journals lose pack reference
**How to avoid:** Extract CSS class from journal sheet DOM (e.g., 'pf2e-km'), use that class as filter keyword
**Warning signs:** 200KB+ CSS payloads, slow rendering, CSS includes unrelated premium module styles

### Pitfall 5: jQuery Collection Confusion
**What goes wrong:** Accessing `sheet.element` returns jQuery collection, treating it like single element fails
**Why it happens:** Foundry journal sheets use jQuery, `element` is collection not single DOM node
**How to avoid:** Iterate collection to find element with `.app` and `.journal-sheet` classes, or use `sheet.element[0]` if confident it's first
**Warning signs:** `classList` is undefined, "cannot read property of undefined" errors

### Pitfall 6: CSS Cache Invalidation Timing
**What goes wrong:** Cached CSS shows old styles after journal edited, or cache cleared too aggressively causing performance issues
**Why it happens:** Invalidation strategy either too conservative (never clears) or too aggressive (clears on every render)
**How to avoid:** Clear cache only on `updateJournalEntry` and `closeJournalSheet` hooks, NOT on simple navigation
**Warning signs:** Stale styles persisting, or CSS re-extracted on every journal switch

### Pitfall 7: Async Class Extraction Race Conditions
**What goes wrong:** Journal renders with default class (e.g., 'pf2e'), then re-renders milliseconds later with correct class ('pf2e-km')
**Why it happens:** Class extraction requires temporarily rendering journal sheet, which is async
**How to avoid:** Show loading indicator, use cached class if available, only extract once per journal (cache in settings)
**Warning signs:** Visual flicker when opening journals, double-renders in console logs

## Code Examples

### CORS-Safe Stylesheet Iteration
```javascript
// Source: MDN CSSOM documentation
for (let i = 0; i < document.styleSheets.length; i++) {
  const sheet = document.styleSheets[i];

  try {
    const rules = sheet.cssRules || sheet.rules;
    if (!rules) continue;

    for (let j = 0; j < rules.length; j++) {
      const rule = rules[j];
      // Process rule.cssText
    }
  } catch (e) {
    // CORS - skip external stylesheet
    if (e.name === 'SecurityError') {
      console.debug('Cannot access external stylesheet:', sheet.href);
      continue;
    }
    console.warn('Error reading stylesheet:', e);
  }
}
```

### Intelligent Selector Namespacing
```javascript
// Source: Derived from CSS specificity research
function namespaceCSSRules(cssText, namespace) {
  const rules = [];
  // ... split into rules ...

  return rules.map(rule => {
    if (rule.startsWith('@')) return rule; // Preserve @-rules

    const [selector, declaration] = rule.split('{');
    const selectors = selector.split(',').map(s => s.trim());

    const namespaced = selectors.map(sel => {
      // Skip DOM-contextual selectors
      if (sel.includes('body') || sel.includes('html') ||
          sel.includes(':root')) {
        return sel;
      }

      // Skip already-scoped selectors
      if (sel.startsWith(namespace)) return sel;

      // Namespace everything else
      return `${namespace} ${sel}`;
    }).join(', ');

    return `${namespaced} {${declaration}`;
  }).join('\n');
}
```

### jQuery Collection Iteration (Foundry Pattern)
```javascript
// Source: FoundryVTT ApplicationV2 wiki and jQuery documentation
let domElement = null;

if (journal.sheet.element.length) {
  // Iterate jQuery collection to find root element
  for (let i = 0; i < journal.sheet.element.length; i++) {
    const el = journal.sheet.element[i];
    if (el.classList?.contains('app') &&
        el.classList?.contains('journal-sheet')) {
      domElement = el;
      break;
    }
  }
}

if (domElement) {
  // Extract classes from native DOM element
  const classes = Array.from(domElement.classList);
}
```

### Settings-Based Cache Pattern
```javascript
// Source: Foundry Settings API and current implementation
// Register setting (in init hook)
game.settings.register(MODULE_ID, 'journalClassCache', {
  scope: 'client',
  config: false,
  type: Object,
  default: {}
});

// Read from cache
async function getJournalClass(journalUuid) {
  const cache = game.settings.get(MODULE_ID, 'journalClassCache');
  return cache[journalUuid] || null;
}

// Write to cache
async function setJournalClass(journalUuid, className) {
  const cache = game.settings.get(MODULE_ID, 'journalClassCache');
  cache[journalUuid] = className;
  await game.settings.set(MODULE_ID, 'journalClassCache', cache);
}
```

### CSS Variable Extraction
```javascript
// Source: MDN CSS Custom Properties documentation
function extractCSSVariables(element, variables) {
  const computed = getComputedStyle(element);
  const values = {};

  for (let varName of variables) {
    const value = computed.getPropertyValue(varName).trim();
    if (value) values[varName] = value;
  }

  return values;
}

// Usage
const colors = extractCSSVariables(document.documentElement, [
  '--color-primary',
  '--color-sidebar-bg',
  '--pf2e-color-theme'
]);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Shadow DOM for scoping | Selective namespacing | 2024 (v1.0) | Shadow DOM breaks ProseMirror enrichment |
| In-memory cache only | Settings-based persistence | Phase 7 (2026) | Cache survives Foundry restarts |
| jQuery element access | Native DOM in ApplicationV2 | Foundry v12-13 (2024) | Better performance, future-proof |
| CSS @scope for scoping | Manual namespacing | Current (2026) | @scope not baseline yet, limited browser support |

**Deprecated/outdated:**
- ApplicationV1: Use ApplicationV2 for new applications, V1 support ends in Foundry v16
- `sheet.element` as single element: It's a jQuery collection, iterate or use `[0]`
- Global cache clearing on navigation: Clear only on edit events, not navigation

## Open Questions

1. **@layer directive handling**
   - What we know: CSS @layer affects cascade priority, extraction can reorder layers
   - What's unclear: Should we strip @layer directives entirely, or try to preserve them?
   - Recommendation: Start by preserving @layer blocks, monitor for cascade issues, add fallback to strip if needed

2. **CSS variable inheritance strategy**
   - What we know: Variables defined at :root inherit down, some premium modules override them
   - What's unclear: Should we extract and apply :root variables separately, or rely on cascade?
   - Recommendation: Apply extracted classes to window root and let cascade work naturally, extract :root rules if visual issues persist

3. **Adaptive extraction threshold**
   - What we know: Context mentions "adaptive extraction" (conservative vs aggressive)
   - What's unclear: What metrics determine "styling looks broken"? CSS size? Rule count? Manual toggle?
   - Recommendation: Start conservative (keyword filtering), add user setting to enable aggressive mode for troubleshooting

4. **Temporary sheet cleanup reliability**
   - What we know: Sheets temporarily opened for class extraction should close afterward
   - What's unclear: What if extraction crashes mid-process? Are sheets leaked?
   - Recommendation: Use try-finally blocks to guarantee sheet.close() even on error

5. **Performance impact of settings writes**
   - What we know: Writing to Foundry settings is async, may hit database/localStorage
   - What's unclear: Is writing cache on every journal switch too frequent? Should we batch writes?
   - Recommendation: Write immediately (low frequency - once per journal lifetime), debounce if performance issues observed

## Sources

### Primary (HIGH confidence)
- [MDN: CSS Object Model (CSSOM)](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Object_Model) - CSSOM interfaces and security
- [MDN: CSSStyleSheet.cssRules](https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet/cssRules) - cssRules property documentation
- [MDN: Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy) - CORS and stylesheet security
- [MDN: CSS Custom Properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascading_variables/Using_custom_properties) - CSS variable extraction
- [MDN: @layer](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@layer) - Cascade layers documentation
- [Foundry VTT API: ApplicationV2](https://foundryvtt.com/api/classes/foundry.applications.api.ApplicationV2.html) - ApplicationV2 element property

### Secondary (MEDIUM confidence)
- [FoundryVTT Wiki: ApplicationV2 Conversion Guide](https://foundryvtt.wiki/en/development/guides/applicationV2-conversion-guide) - jQuery vs native DOM patterns
- [FoundryVTT Wiki: Settings](https://foundryvtt.wiki/en/development/api/settings) - Settings API usage
- [MDN: @scope](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@scope) - CSS @scope at-rule (baseline 2026, limited support)
- [MDN: CSS Specificity](https://developer.mozilla.org/en-US/docs/Web/CSS/Specificity) - Specificity calculation and preservation
- [jQuery API: .each()](https://api.jquery.com/each/) - jQuery collection iteration
- [MDN: Descendant combinator](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/Descendant_combinator) - Descendant selector semantics

### Tertiary (LOW confidence)
- WebSearch findings on CSS extraction tools (GitHub: CSS-Used-ChromeExt, custom-property-extract) - Community patterns, not verified in production context

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - CSSOM and Foundry Settings API are official, well-documented
- Architecture: MEDIUM - Patterns derived from current implementation and best practices, not officially documented
- Pitfalls: HIGH - CORS, jQuery collection, selector breakage verified in MDN docs and Foundry wiki
- Code examples: HIGH - Derived from official API documentation with Foundry-specific context

**Research date:** 2026-01-31
**Valid until:** 2026-03-31 (60 days - stable browser APIs and Foundry v13 still current)
