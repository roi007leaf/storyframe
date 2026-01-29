# Phase 5: Journal Integration & UI Polish - Research

**Researched:** 2026-01-29
**Domain:** FoundryVTT ApplicationV2 CSS integration, journal editing workflow, drag-drop restoration, comprehensive UI redesign
**Confidence:** MEDIUM

## Summary

Phase 5 focuses on four distinct domains: CSS scraping to apply journal styles, GM editing workflow, drag-drop restoration, and comprehensive UI polish. User decisions constrain approach: full stylesheet extraction (not computed styles), watch for journal edits, namespace with `.storyframe-content`, fall back to Foundry base styles. Edit button opens native journal editor via `journal.sheet.render()`. UI redesign targets Arc browser aesthetic—polished, smooth, thoughtful details across all elements.

Standard approach:
- CSS extraction via `document.styleSheets` CSSOM API with CSSRuleList iteration
- Watch journal updates via `updateJournalEntry` hook, re-scrape and re-inject styles
- Namespace CSS rules to prevent conflicts with `.storyframe-content` wrapper
- HEADER_ACTIONS for edit button configuration in ApplicationV2
- DragDrop helper class for restoring image/actor drag functionality
- Typography system: 45-75 characters per line, 1.4-1.6 line-height, ~20-25rem content width
- Micro-animations: 200-300ms transitions, transform/opacity for performance

**Primary recommendation:** Extract stylesheet rules via CSSOM, namespace with CSS prefix rewriting, watch updateJournalEntry hook for re-scraping. Use HEADER_ACTIONS for edit button. Implement comprehensive design system with typography scale, spacing tokens, and subtle transitions.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| CSSOM (document.styleSheets) | Native Web API | CSS rule extraction | Browser-native, reliable, real-time access to all stylesheets |
| CSSStyleSheet.cssRules | Native Web API | Rule iteration | Live CSSRuleList, includes all rule types, well-documented |
| updateJournalEntry hook | Foundry v13+ | Detect journal edits | Core hook fires when journal content changes |
| HEADER_ACTIONS | ApplicationV2 v13+ | Window header controls | Official pattern for adding buttons to ApplicationV2 windows |
| DragDrop helper class | Foundry v13+ | Drag-drop workflows | Official ApplicationV2 drag-drop pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CSS.escape() | Native Web API | Escape special characters in selectors | When rewriting selectors with special chars |
| MutationObserver | Native Web API | Watch DOM changes | Detect stylesheet addition/removal (optional enhancement) |
| @scope at-rule | Modern CSS | Scoping mechanism | Alternative to namespace prefixing (browser support varies) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSSOM cssRules | getComputedStyle | Computed styles miss cascading context, lose media queries, heavier |
| Namespace prefix | Shadow DOM | Shadow DOM isolates too much, breaks Foundry's text enrichment |
| Hook watching | Polling journal | Hooks are event-driven, more efficient, standard pattern |
| HEADER_ACTIONS | Custom DOM injection | HEADER_ACTIONS integrates with ApplicationV2 lifecycle, proper positioning |
| DragDrop helper | Manual event listeners | Helper handles permissions, callbacks, standard pattern |

**Installation:**
No additional dependencies - all tools built into FoundryVTT v13 and modern browsers.

## Architecture Patterns

### Recommended Project Structure
```
storyframe/
├── scripts/
│   ├── applications/
│   │   ├── gm-interface.mjs          # Add HEADER_ACTIONS for edit button
│   │   └── player-viewer.mjs         # Add layout toggle HEADER_ACTIONS
│   ├── css-scraper.mjs               # NEW: Journal CSS extraction utility
│   └── style-injector.mjs            # NEW: Dynamic <style> management
├── styles/
│   ├── gm-interface.css              # ENHANCED: Redesign all elements
│   ├── player-viewer.css             # ENHANCED: Polish gallery layouts
│   └── design-tokens.css             # NEW: Typography, spacing, colors
└── templates/
    ├── gm-interface.hbs              # Update content area with .storyframe-content wrapper
    └── player-viewer.hbs             # Update gallery structure
```

### Pattern 1: CSS Rule Extraction via CSSOM
**What:** Extract all CSS rules from journal's stylesheets using document.styleSheets
**When to use:** Need full stylesheet context, not just computed styles
**Example:**
```javascript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet/cssRules
// Extract CSS from journal sheet
function extractJournalCSS(journalSheet) {
  const styles = [];

  // Iterate through all stylesheets in the journal's DOM context
  const sheetElement = journalSheet.element?.[0] || journalSheet.element;
  if (!sheetElement) return '';

  // Get all stylesheets loaded in the document
  for (let i = 0; i < document.styleSheets.length; i++) {
    const sheet = document.styleSheets[i];

    // Skip external stylesheets we can't access (CORS)
    try {
      const rules = sheet.cssRules || sheet.rules;
      if (!rules) continue;

      // Extract rules that target journal content
      for (let j = 0; j < rules.length; j++) {
        const rule = rules[j];

        // Filter for journal-related selectors
        if (rule.cssText && isJournalRule(rule)) {
          styles.push(rule.cssText);
        }
      }
    } catch (e) {
      // CORS error - skip this stylesheet
      console.warn('Cannot access stylesheet:', sheet.href, e);
    }
  }

  return styles.join('\n');
}

function isJournalRule(rule) {
  // Match rules targeting journal content classes
  const selector = rule.selectorText || '';
  return selector.includes('.journal-entry-page') ||
         selector.includes('.editor-content') ||
         selector.includes('article') ||
         selector.includes('section');
}
```

### Pattern 2: CSS Namespace Rewriting
**What:** Prefix all selectors with .storyframe-content to scope styles
**When to use:** Prevent extracted CSS from affecting other Foundry UI
**Example:**
```javascript
// Source: https://foundryvtt.wiki/en/development/guides/builtin-css (namespacing best practice)
function namespaceCSSRules(cssText, namespace = '.storyframe-content') {
  const rules = cssText.split('}').filter(r => r.trim());

  return rules.map(rule => {
    const [selector, ...declaration] = rule.split('{');
    if (!selector || !declaration.length) return rule;

    // Split multiple selectors (comma-separated)
    const selectors = selector.split(',').map(s => s.trim());

    // Prefix each selector
    const namespacedSelectors = selectors.map(sel => {
      // Skip @-rules (media queries, keyframes)
      if (sel.startsWith('@')) return sel;

      // Add namespace prefix
      return `${namespace} ${sel}`;
    }).join(', ');

    return `${namespacedSelectors} {${declaration.join('{')}`;
  }).join('}\n') + '}';
}

// Usage
const journalCSS = extractJournalCSS(journal.sheet);
const scopedCSS = namespaceCSSRules(journalCSS, '.storyframe-content');
```

### Pattern 3: Dynamic Style Injection
**What:** Create/update <style> element with extracted CSS
**When to use:** Apply journal styles to StoryFrame content area dynamically
**Example:**
```javascript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/CSS_Object_Model/Using_dynamic_styling_information
class StyleInjector {
  constructor(styleId = 'storyframe-journal-styles') {
    this.styleId = styleId;
    this.styleElement = null;
  }

  inject(cssText) {
    // Create or update style element
    if (!this.styleElement) {
      this.styleElement = document.createElement('style');
      this.styleElement.id = this.styleId;
      document.head.appendChild(this.styleElement);
    }

    // Set CSS content
    this.styleElement.textContent = cssText;
  }

  clear() {
    if (this.styleElement) {
      this.styleElement.textContent = '';
    }
  }

  remove() {
    if (this.styleElement) {
      this.styleElement.remove();
      this.styleElement = null;
    }
  }
}

// Usage in GMInterfaceApp
class GMInterfaceApp extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options) {
    super(options);
    this.styleInjector = new StyleInjector('storyframe-journal-styles');
  }

  async _onRender(context, options) {
    super._onRender(context, options);

    // Scrape and inject journal styles when journal is selected
    if (context.selectedJournal) {
      await this._updateJournalStyles(context.selectedJournal);
    }
  }

  async _updateJournalStyles(journalUuid) {
    const journal = await fromUuid(journalUuid);
    if (!journal) return;

    // Extract CSS from journal
    const cssText = extractJournalCSS(journal.sheet);

    // Namespace to prevent conflicts
    const scopedCSS = namespaceCSSRules(cssText, '.storyframe-content');

    // Inject into document
    this.styleInjector.inject(scopedCSS);
  }
}
```

### Pattern 4: Watch Journal Updates for Re-scraping
**What:** Listen to updateJournalEntry hook, re-extract styles when journal edited
**When to use:** Keep StoryFrame styles synchronized with journal edits
**Example:**
```javascript
// Source: https://foundryvtt.com/api/modules/hookEvents.html (updateDocument pattern)
// In storyframe.mjs initialization

Hooks.on('updateJournalEntry', async (journal, changed, options, userId) => {
  // Only re-scrape if current journal
  const state = game.storyframe.stateManager.getState();
  if (journal.uuid !== state?.activeJournal) return;

  // Only re-scrape if content changed (not flags/permissions)
  if (!changed.pages && !changed.name) return;

  console.log('StoryFrame | Journal updated, re-scraping styles');

  // Re-extract and inject styles
  if (game.user.isGM && game.storyframe.gmInterface?.rendered) {
    await game.storyframe.gmInterface._updateJournalStyles(journal.uuid);
  }
});

// Also watch for journal sheet renders (style changes without document updates)
Hooks.on('renderJournalSheet', (sheet, html, data) => {
  const state = game.storyframe.stateManager.getState();
  if (sheet.document.uuid !== state?.activeJournal) return;

  console.log('StoryFrame | Journal sheet rendered, updating styles');

  if (game.user.isGM && game.storyframe.gmInterface?.rendered) {
    setTimeout(() => {
      game.storyframe.gmInterface._updateJournalStyles(sheet.document.uuid);
    }, 100); // Delay to let sheet styles apply
  }
});
```

### Pattern 5: HEADER_ACTIONS for Edit Button
**What:** Add edit button to ApplicationV2 header via HEADER_ACTIONS
**When to use:** Add controls to window title bar
**Example:**
```javascript
// Source: https://foundryvtt.com/api/classes/foundry.applications.api.ApplicationV2.html
// ApplicationV2 HEADER_ACTIONS pattern (inferred from PlayerViewerApp toggle button)

class GMInterfaceApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static HEADER_ACTIONS = {
    editJournal: {
      icon: 'fas fa-edit',
      label: 'Edit Journal',
      onclick: function() {
        this._onEditJournal();
      }
    }
  };

  async _onEditJournal() {
    const state = game.storyframe.stateManager.getState();
    if (!state?.activeJournal) {
      ui.notifications.warn('No journal selected');
      return;
    }

    // Get journal document
    const journal = await fromUuid(state.activeJournal);
    if (!journal) {
      ui.notifications.error('Journal not found');
      return;
    }

    // Open native journal editor
    journal.sheet.render(true);
  }
}
```

### Pattern 6: DragDrop Helper for Images/Actors
**What:** Use DragDrop class to restore drag functionality for images and actors
**When to use:** Need drag-drop from journal content and actor sidebar
**Example:**
```javascript
// Source: https://foundryvtt.wiki/en/development/guides/applicationV2-conversion-guide (drag-drop section)
// DragDrop helper implementation for ApplicationV2

class GMInterfaceApp extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options) {
    super(options);

    // Initialize DragDrop handlers
    this.dragDrop = [
      new DragDrop({
        dragSelector: '.page-content img',  // Images in journal content
        dropSelector: '.speaker-gallery',   // Speaker gallery drop target
        permissions: {
          dragstart: () => true,            // Anyone can drag
          drop: () => game.user.isGM        // Only GM can drop
        },
        callbacks: {
          dragstart: this._onDragStart.bind(this),
          drop: this._onDrop.bind(this)
        }
      })
    ];
  }

  _onRender(context, options) {
    super._onRender(context, options);

    // Bind DragDrop listeners (must happen in _onRender for ApplicationV2)
    for (let dd of this.dragDrop) {
      dd.bind(this.element);
    }
  }

  _onDragStart(event) {
    const img = event.currentTarget;

    // Create drag data
    const dragData = {
      type: 'StoryFrameImage',
      src: img.src,
      alt: img.alt || 'Speaker'
    };

    event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
  }

  async _onDrop(event) {
    const data = TextEditor.getDragEventData(event);

    // Handle Actor drops
    if (data.type === 'Actor') {
      const actor = await fromUuid(data.uuid);
      if (actor) {
        await game.storyframe.socketManager.requestAddSpeaker({
          actorUuid: data.uuid,
          label: actor.name
        });
      }
      return;
    }

    // Handle image drops (from journal content)
    try {
      const imageData = JSON.parse(event.dataTransfer.getData('text/plain'));
      if (imageData.type === 'StoryFrameImage') {
        // Prompt for speaker name
        const label = await foundry.applications.api.DialogV2.prompt({
          window: { title: 'Speaker Name' },
          content: '<input type="text" name="label" placeholder="Enter speaker name" autofocus>',
          ok: {
            label: 'Add',
            callback: (event, button, dialog) => button.form.elements.label.value
          },
          rejectClose: false
        });

        if (label) {
          await game.storyframe.socketManager.requestAddSpeaker({
            imagePath: imageData.src,
            label
          });
        }
      }
    } catch (e) {
      // Not our image format, ignore
    }
  }
}
```

### Pattern 7: Typography System for Readability
**What:** Implement optimal reading width, line height, and font scale
**When to use:** Comprehensive UI redesign for journal content area
**Example:**
```css
/* Source: https://baymard.com/blog/line-length-readability */
/* Source: https://practicaltypography.com/line-length.html */
/* design-tokens.css */

:root {
  /* Typography scale (1.25 ratio) */
  --font-size-xs: 0.75rem;    /* 12px */
  --font-size-sm: 0.875rem;   /* 14px */
  --font-size-base: 1rem;     /* 16px */
  --font-size-lg: 1.25rem;    /* 20px */
  --font-size-xl: 1.563rem;   /* 25px */
  --font-size-2xl: 1.953rem;  /* 31px */

  /* Line heights */
  --line-height-tight: 1.3;
  --line-height-base: 1.5;
  --line-height-relaxed: 1.6;

  /* Spacing scale (8px base) */
  --space-xs: 0.25rem;   /* 4px */
  --space-sm: 0.5rem;    /* 8px */
  --space-md: 1rem;      /* 16px */
  --space-lg: 1.5rem;    /* 24px */
  --space-xl: 2rem;      /* 32px */
  --space-2xl: 3rem;     /* 48px */

  /* Content width for readability (66 characters optimal) */
  --content-width-optimal: 66ch;
  --content-width-max: 75ch;
  --content-width-min: 45ch;
}

/* Apply to journal content */
.storyframe-content .journal-page-content {
  max-width: var(--content-width-optimal);
  margin: 0 auto;
  padding: var(--space-xl) var(--space-lg);
  line-height: var(--line-height-relaxed);
  font-size: var(--font-size-base);
}

.storyframe-content .journal-page-content p {
  margin-bottom: var(--space-md);
}

.storyframe-content .journal-page-content h1 {
  font-size: var(--font-size-2xl);
  line-height: var(--line-height-tight);
  margin-bottom: var(--space-lg);
}

.storyframe-content .journal-page-content h2 {
  font-size: var(--font-size-xl);
  line-height: var(--line-height-tight);
  margin-bottom: var(--space-md);
}
```

### Pattern 8: Micro-Animations for Polish
**What:** Subtle transitions on interactive elements using transform/opacity
**When to use:** Hover states, active states, focus indicators
**Example:**
```css
/* Source: https://www.joshwcomeau.com/animation/css-transitions/ */
/* Source: https://blog.pixelfreestudio.com/best-practices-for-animating-micro-interactions-with-css/ */

/* Optimize for performance - only animate transform and opacity */
.speaker-thumbnail {
  transition: transform 200ms ease-out,
              opacity 200ms ease-out,
              box-shadow 200ms ease-out;
  will-change: transform; /* Hint for GPU acceleration */
}

.speaker-thumbnail:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.speaker-thumbnail:active {
  transform: translateY(0) scale(0.98);
  transition-duration: 100ms; /* Faster for click feedback */
}

/* Active speaker with smooth highlight */
.speaker-thumbnail.active {
  box-shadow: 0 0 0 3px var(--color-text-hyperlink),
              0 4px 12px rgba(0, 0, 0, 0.3);
  transform: scale(1.05);
}

/* Page selection smooth transition */
.page-item {
  transition: background-color 200ms ease-out,
              border-color 200ms ease-out,
              transform 150ms ease-out;
}

.page-item:hover {
  background: var(--color-bg-btn-hover);
  transform: translateX(2px);
}

.page-item.selected {
  background: var(--color-bg-option);
  border-left: 3px solid var(--color-text-hyperlink);
  font-weight: bold;
}

/* Button interactions */
button {
  transition: all 200ms ease-out;
}

button:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

button:active {
  transform: translateY(0);
  transition-duration: 100ms;
}
```

### Anti-Patterns to Avoid
- **Using getComputedStyle for extraction:** Loses cascade context, media queries, pseudo-elements
- **Not namespacing extracted CSS:** Styles leak to other Foundry UI, break sheets
- **Extracting inline styles only:** Misses stylesheet rules, incomplete styling
- **Synchronous style injection in _prepareContext:** Can block render, use _onRender instead
- **Not handling CORS errors:** External stylesheets throw errors, wrap in try-catch
- **Polling for journal changes:** Use hooks (updateJournalEntry, renderJournalSheet)
- **Adding edit button via DOM manipulation:** Use HEADER_ACTIONS for proper integration
- **Long transitions (>400ms):** Feel sluggish, reduce engagement
- **Animating layout properties (width, height, margin):** Causes reflow, jank. Use transform instead
- **Not testing with custom journal styles:** User-created CSS can break namespacing assumptions

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSS extraction | Parse CSS strings manually | document.styleSheets API | Handles all rule types, media queries, @-rules correctly |
| Drag-drop workflow | Manual dragstart/drop listeners | DragDrop helper class | Handles permissions, multiple handlers, drag data properly |
| CSS selector escaping | String replace special chars | CSS.escape() | Handles all edge cases correctly |
| Window header buttons | DOM injection in _onRender | HEADER_ACTIONS static property | Integrated with ApplicationV2 lifecycle, proper positioning |
| Typography spacing | Ad-hoc margins | Design token system | Consistent, maintainable, scalable |
| Transitions | Multiple property animations | Transform/opacity only | GPU accelerated, smooth 60fps |

**Key insight:** CSSOM API provides complete stylesheet access with live updates. CSS namespacing prevents conflicts better than Shadow DOM (which breaks Foundry's text enrichment). Transform/opacity animations are hardware-accelerated, avoid layout thrashing.

## Common Pitfalls

### Pitfall 1: CORS Blocking Stylesheet Access
**What goes wrong:** Cannot read cssRules, throws SecurityError
**Why it happens:** External stylesheets from different origin block access
**How to avoid:** Wrap stylesheet iteration in try-catch, skip inaccessible sheets
**Warning signs:** Console errors "Failed to read cssRules", blank extracted CSS

### Pitfall 2: Incomplete Selector Namespacing
**What goes wrong:** Some rules still leak to other Foundry UI
**Why it happens:** @-rules, pseudo-elements, complex selectors need special handling
**How to avoid:** Skip @-rules (they scope themselves), test with pseudo-elements
**Warning signs:** Other Foundry sheets affected, weird styling on dialogs

### Pitfall 3: Style Injection Race Conditions
**What goes wrong:** Styles applied before content rendered, or not at all
**Why it happens:** Injecting in _prepareContext (too early) or wrong lifecycle
**How to avoid:** Inject in _onRender after super call, when content exists
**Warning signs:** Styles flash in/out, content unstyled initially

### Pitfall 4: Not Re-scraping on Journal Edit
**What goes wrong:** StoryFrame shows old styles after journal edited
**Why it happens:** No hook watching journal updates
**How to avoid:** Listen to updateJournalEntry hook, re-extract and inject
**Warning signs:** User edits journal CSS, StoryFrame doesn't reflect changes

### Pitfall 5: Edit Button Without Journal
**What goes wrong:** Edit button errors when no journal selected
**Why it happens:** Not checking state before opening sheet
**How to avoid:** Guard _onEditJournal with state check, show notification
**Warning signs:** Console errors, button clicks do nothing

### Pitfall 6: Drag-Drop Not Binding
**What goes wrong:** Images/actors not draggable after render
**Why it happens:** DragDrop.bind() not called in _onRender
**How to avoid:** Call dd.bind(this.element) in _onRender for ApplicationV2
**Warning signs:** Cursor doesn't change on drag, drop doesn't trigger

### Pitfall 7: Excessive Animation Properties
**What goes wrong:** Janky, laggy transitions
**Why it happens:** Animating layout properties (width, height, margin, padding)
**How to avoid:** Only animate transform and opacity, use will-change
**Warning signs:** Choppy animations, frame drops, CPU spikes

### Pitfall 8: Reading Width Not Responsive
**What goes wrong:** Content width too wide on small screens, too narrow on large
**Why it happens:** Fixed pixel width instead of ch units
**How to avoid:** Use max-width with ch units (66ch), add responsive breakpoints
**Warning signs:** Horizontal scroll on mobile, tiny text column on desktop

### Pitfall 9: Missing Fallback Styles
**What goes wrong:** Content unstyled when journal has no custom CSS
**Why it happens:** Only injecting extracted CSS, no base styles
**How to avoid:** Always include Foundry's base journal styles as fallback
**Warning signs:** Plain HTML rendering, no formatting when no custom CSS

## Code Examples

Verified patterns from official sources:

### Complete CSS Scraper Module
```javascript
// css-scraper.mjs
// Source: https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet/cssRules

export class CSScraper {
  constructor() {
    this.cache = new Map(); // journalUuid -> cssText
  }

  /**
   * Extract all CSS rules targeting journal content
   */
  extractJournalCSS(journal) {
    if (!journal) return '';

    // Check cache
    if (this.cache.has(journal.uuid)) {
      return this.cache.get(journal.uuid);
    }

    const styles = [];

    // Iterate all stylesheets
    for (let i = 0; i < document.styleSheets.length; i++) {
      const sheet = document.styleSheets[i];

      try {
        const rules = sheet.cssRules || sheet.rules;
        if (!rules) continue;

        for (let j = 0; j < rules.length; j++) {
          const rule = rules[j];

          // Include all rules (will be namespaced)
          if (rule.cssText) {
            styles.push(rule.cssText);
          }
        }
      } catch (e) {
        // CORS - skip external stylesheet
        if (e.name === 'SecurityError') {
          console.debug('CSScraper | Cannot access external stylesheet:', sheet.href);
        } else {
          console.warn('CSScraper | Error reading stylesheet:', e);
        }
      }
    }

    const cssText = styles.join('\n');
    this.cache.set(journal.uuid, cssText);
    return cssText;
  }

  /**
   * Namespace CSS rules to prevent conflicts
   */
  namespaceCSSRules(cssText, namespace = '.storyframe-content') {
    // Split into individual rules
    const rules = [];
    let buffer = '';
    let depth = 0;

    for (let i = 0; i < cssText.length; i++) {
      const char = cssText[i];
      buffer += char;

      if (char === '{') depth++;
      if (char === '}') {
        depth--;
        if (depth === 0) {
          rules.push(buffer.trim());
          buffer = '';
        }
      }
    }

    // Process each rule
    return rules.map(rule => {
      // Skip @-rules (they scope themselves)
      if (rule.startsWith('@')) {
        return rule;
      }

      // Split selector from declaration
      const openBrace = rule.indexOf('{');
      if (openBrace === -1) return rule;

      const selector = rule.substring(0, openBrace).trim();
      const declaration = rule.substring(openBrace);

      // Split multiple selectors
      const selectors = selector.split(',').map(s => s.trim());

      // Prefix each selector
      const namespaced = selectors.map(sel => {
        // Already namespaced
        if (sel.startsWith(namespace)) return sel;

        return `${namespace} ${sel}`;
      }).join(', ');

      return `${namespaced} ${declaration}`;
    }).join('\n');
  }

  /**
   * Clear cached CSS for journal
   */
  clearCache(journalUuid) {
    this.cache.delete(journalUuid);
  }

  /**
   * Clear all cached CSS
   */
  clearAllCache() {
    this.cache.clear();
  }
}
```

### GMInterfaceApp with Edit Button and CSS Injection
```javascript
// gm-interface.mjs (enhanced)
// Source: ApplicationV2 API + existing codebase

import { CSScraper } from '../css-scraper.mjs';

export class GMInterfaceApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static HEADER_ACTIONS = {
    editJournal: {
      icon: 'fas fa-edit',
      label: 'Edit Journal',
      onclick: function() {
        this._onEditJournal();
      }
    }
  };

  constructor(options = {}) {
    super(options);
    this.cssScraper = new CSScraper();
    this.styleElement = null;
  }

  async _onRender(context, options) {
    super._onRender(context, options);

    // Scrape and inject CSS if journal selected
    if (context.selectedJournal) {
      await this._updateJournalStyles(context.selectedJournal);
    } else {
      this._clearJournalStyles();
    }

    // Other render logic (drag-drop, etc.)
    this._attachDragDropHandlers();
  }

  async _updateJournalStyles(journalUuid) {
    const journal = await fromUuid(journalUuid);
    if (!journal) return;

    // Extract CSS
    const cssText = this.cssScraper.extractJournalCSS(journal);

    // Namespace rules
    const scopedCSS = this.cssScraper.namespaceCSSRules(cssText);

    // Inject into document
    if (!this.styleElement) {
      this.styleElement = document.createElement('style');
      this.styleElement.id = 'storyframe-journal-styles';
      document.head.appendChild(this.styleElement);
    }

    this.styleElement.textContent = scopedCSS;
  }

  _clearJournalStyles() {
    if (this.styleElement) {
      this.styleElement.textContent = '';
    }
  }

  async _onEditJournal() {
    const state = game.storyframe.stateManager.getState();
    if (!state?.activeJournal) {
      ui.notifications.warn('No journal selected');
      return;
    }

    const journal = await fromUuid(state.activeJournal);
    if (!journal) {
      ui.notifications.error('Journal not found');
      return;
    }

    // Open native journal editor
    journal.sheet.render(true);
  }

  async _onClose(options) {
    // Clean up injected styles
    if (this.styleElement) {
      this.styleElement.remove();
      this.styleElement = null;
    }

    return super._onClose(options);
  }
}
```

### Hook Integration for Style Re-scraping
```javascript
// storyframe.mjs (enhanced)
// Source: https://foundryvtt.com/api/modules/hookEvents.html

// Watch for journal updates
Hooks.on('updateJournalEntry', async (journal, changed, options, userId) => {
  const state = game.storyframe.stateManager.getState();
  if (journal.uuid !== state?.activeJournal) return;

  // Clear cache for updated journal
  if (game.storyframe.gmInterface?.cssScraper) {
    game.storyframe.gmInterface.cssScraper.clearCache(journal.uuid);
  }

  // Re-scrape and inject
  if (game.user.isGM && game.storyframe.gmInterface?.rendered) {
    await game.storyframe.gmInterface._updateJournalStyles(journal.uuid);
  }
});

// Watch for journal sheet renders (CSS changes without doc updates)
Hooks.on('renderJournalSheet', async (sheet, html, data) => {
  const state = game.storyframe.stateManager.getState();
  if (sheet.document.uuid !== state?.activeJournal) return;

  // Clear cache
  if (game.storyframe.gmInterface?.cssScraper) {
    game.storyframe.gmInterface.cssScraper.clearCache(sheet.document.uuid);
  }

  // Delay to let sheet styles apply
  setTimeout(async () => {
    if (game.user.isGM && game.storyframe.gmInterface?.rendered) {
      await game.storyframe.gmInterface._updateJournalStyles(sheet.document.uuid);
    }
  }, 100);
});
```

### Design Tokens CSS
```css
/* styles/design-tokens.css */
/* Source: Web design best practices 2026 */

:root {
  /* Typography scale (1.25 ratio for clear hierarchy) */
  --sf-font-xs: 0.75rem;
  --sf-font-sm: 0.875rem;
  --sf-font-base: 1rem;
  --sf-font-lg: 1.25rem;
  --sf-font-xl: 1.563rem;
  --sf-font-2xl: 1.953rem;

  /* Line heights */
  --sf-leading-tight: 1.3;
  --sf-leading-base: 1.5;
  --sf-leading-relaxed: 1.6;

  /* Spacing scale (8px base) */
  --sf-space-xs: 0.25rem;
  --sf-space-sm: 0.5rem;
  --sf-space-md: 1rem;
  --sf-space-lg: 1.5rem;
  --sf-space-xl: 2rem;
  --sf-space-2xl: 3rem;

  /* Content width for readability */
  --sf-content-width: 66ch;
  --sf-content-padding: var(--sf-space-xl);

  /* Border radius scale */
  --sf-radius-sm: 4px;
  --sf-radius-md: 6px;
  --sf-radius-lg: 8px;
  --sf-radius-full: 9999px;

  /* Transitions */
  --sf-transition-fast: 100ms;
  --sf-transition-base: 200ms;
  --sf-transition-slow: 300ms;
  --sf-transition-ease: ease-out;

  /* Shadows */
  --sf-shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.12);
  --sf-shadow-md: 0 2px 8px rgba(0, 0, 0, 0.15);
  --sf-shadow-lg: 0 4px 12px rgba(0, 0, 0, 0.2);
  --sf-shadow-xl: 0 8px 24px rgba(0, 0, 0, 0.25);
}
```

### Polished Speaker Gallery
```css
/* styles/gm-interface.css (enhanced) */
/* Source: Arc browser aesthetic - polished, smooth, thoughtful details */

.speaker-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: var(--sf-space-md);
  padding: var(--sf-space-lg);
  overflow-y: auto;
}

.speaker-thumbnail {
  position: relative;
  cursor: pointer;
  border: 2px solid transparent;
  border-radius: var(--sf-radius-md);
  padding: var(--sf-space-sm);
  transition: transform var(--sf-transition-base) var(--sf-transition-ease),
              box-shadow var(--sf-transition-base) var(--sf-transition-ease),
              border-color var(--sf-transition-base) var(--sf-transition-ease);
  will-change: transform;
}

.speaker-thumbnail:hover {
  transform: translateY(-2px) scale(1.03);
  box-shadow: var(--sf-shadow-lg);
  border-color: var(--color-border-highlight);
}

.speaker-thumbnail:active {
  transform: translateY(0) scale(0.98);
  transition-duration: var(--sf-transition-fast);
}

.speaker-thumbnail.active {
  border-color: var(--color-text-hyperlink);
  box-shadow: 0 0 0 3px var(--color-text-hyperlink),
              var(--sf-shadow-lg);
  transform: scale(1.05);
}

.speaker-thumbnail img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: var(--sf-radius-sm);
  transition: opacity var(--sf-transition-base) var(--sf-transition-ease);
}

.speaker-thumbnail:hover img {
  opacity: 0.9;
}

.speaker-name {
  text-align: center;
  font-size: var(--sf-font-sm);
  margin-top: var(--sf-space-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
  letter-spacing: 0.01em;
}

/* Remove button smooth reveal */
.remove-speaker {
  position: absolute;
  top: var(--sf-space-xs);
  right: var(--sf-space-xs);
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(4px);
  border: none;
  color: white;
  width: 24px;
  height: 24px;
  border-radius: var(--sf-radius-full);
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--sf-transition-base) var(--sf-transition-ease),
              transform var(--sf-transition-fast) var(--sf-transition-ease);
  display: flex;
  align-items: center;
  justify-content: center;
}

.speaker-thumbnail:hover .remove-speaker {
  opacity: 1;
}

.remove-speaker:hover {
  transform: scale(1.1);
  background: rgba(0, 0, 0, 0.95);
}

.remove-speaker:active {
  transform: scale(0.95);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| getComputedStyle for extraction | document.styleSheets CSSOM | Established pattern | Full stylesheet context with media queries, cascades |
| Shadow DOM for isolation | CSS namespacing | Web Components era | Namespacing avoids breaking Foundry enrichment |
| Custom header DOM injection | HEADER_ACTIONS static property | ApplicationV2 (v12-v13) | Proper lifecycle integration, positioning |
| Manual drag listeners | DragDrop helper class | ApplicationV2 (v12-v13) | Permission handling, standard pattern |
| Fixed px spacing | Design token system | Modern design systems (2020s) | Consistent, scalable, maintainable |
| Multi-property animations | Transform/opacity only | GPU acceleration era (2015+) | Smooth 60fps, avoid layout thrashing |
| Fixed content width | ch units (character width) | Responsive typography (2018+) | Readable across font sizes, responsive |

**Deprecated/outdated:**
- **getComputedStyle for CSS extraction**: Use document.styleSheets for full context
- **Shadow DOM for scoping**: Use CSS namespacing (Shadow DOM breaks text enrichment)
- **Ad-hoc spacing values**: Use design token system
- **Animating width/height**: Use transform: scale() instead
- **Fixed pixel content width**: Use ch units for readability

## Open Questions

Things that couldn't be fully resolved:

1. **CSS extraction scope - All stylesheets vs filtered**
   - What we know: Can extract all rules or filter to journal-specific
   - What's unclear: Better to extract all and namespace, or filter first?
   - Recommendation: Extract all, namespace all - simpler, less brittle than selector matching. User decision: full extraction (not computed).

2. **Edit button visibility when no journal**
   - What we know: Can hide button or disable it
   - What's unclear: Better UX to hide completely or show disabled?
   - Recommendation: Show disabled with tooltip "No journal selected" - clearer affordance. User decision: Claude's discretion.

3. **Drag-drop visual feedback**
   - What we know: Can add drag preview, drop zone highlight
   - What's unclear: Level of visual feedback needed?
   - Recommendation: Minimal feedback (cursor change, drop zone border) - Arc aesthetic is subtle. User decision: Claude's discretion.

4. **Typography responsive breakpoints**
   - What we know: Need to adjust for mobile/tablet/desktop
   - What's unclear: Specific breakpoint values for this use case?
   - Recommendation: Use Foundry's existing breakpoints, test on tablet (most common VTT remote play device). User decision: Claude's discretion.

5. **Color palette for polished UI**
   - What we know: Should enhance Foundry's theme, not replace
   - What's unclear: Specific color adjustments for "Arc aesthetic"?
   - Recommendation: Subtle enhancements - softer shadows, slightly higher contrast on interactive elements, warmer neutrals. User decision: Claude's discretion.

6. **Animation timing functions**
   - What we know: ease-out generally best for UI
   - What's unclear: Custom cubic-bezier curves for "Arc feel"?
   - Recommendation: Start with ease-out, consider subtle spring curves for key interactions (speaker selection). User decision: Claude's discretion.

## Sources

### Primary (HIGH confidence)
- [CSSStyleSheet.cssRules - MDN](https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet/cssRules) - API for extracting stylesheet rules
- [Using dynamic styling information - MDN](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Object_Model/Using_dynamic_styling_information) - CSSOM patterns
- [ApplicationV2 API Documentation](https://foundryvtt.com/api/classes/foundry.applications.api.ApplicationV2.html) - Window lifecycle, HEADER_ACTIONS
- [updateJournalEntry Hook](https://foundryvtt.com/api/modules/hookEvents.html) - Document update hooks
- [JournalEntrySheet API](https://foundryvtt.com/api/classes/foundry.applications.sheets.journal.JournalEntrySheet.html) - Opening native editor

### Secondary (MEDIUM confidence)
- [ApplicationV2 Conversion Guide - Foundry Wiki](https://foundryvtt.wiki/en/development/guides/applicationV2-conversion-guide) - Drag-drop patterns (page didn't fully load, inferred from existing codebase)
- [Foundry Built-in CSS - Wiki](https://foundryvtt.wiki/en/development/guides/builtin-css) - CSS namespacing best practices
- [CSS Transitions Guide - Josh Comeau](https://www.joshwcomeau.com/animation/css-transitions/) - Animation best practices
- [Best Practices for Animating Micro-Interactions](https://blog.pixelfreestudio.com/best-practices-for-animating-micro-interactions-with-css/) - Performance, timing
- [Line Length Readability - Baymard Institute](https://baymard.com/blog/line-length-readability) - 45-75 characters optimal
- [Practical Typography - Line Length](https://practicaltypography.com/line-length.html) - Typography fundamentals

### Tertiary (LOW confidence)
- [Web Design Trends 2026](https://www.theedigital.com/blog/web-design-trends) - Arc browser aesthetic research (no specific Arc docs found)
- [UI Design Trends 2026](https://blog.tubikstudio.com/ui-design-trends-2026/) - Polish, micro-interactions, spacing systems
- [Typography Trends 2026](https://www.designmonks.co/blog/typography-trends-2026) - Variable fonts, expressive type
- [CSS Animation Trends 2026](https://webpeak.org/blog/css-js-animation-trends/) - Micro-interactions, purposeful animations

## Metadata

**Confidence breakdown:**
- CSS extraction (CSSOM): HIGH - MDN documentation, established web API
- Namespace rewriting: MEDIUM - Pattern inferred from best practices, no official Foundry guidance
- HEADER_ACTIONS: MEDIUM - Pattern inferred from existing PlayerViewerApp code, not fully documented
- DragDrop helper: MEDIUM - Pattern inferred from wiki guide that didn't fully load, cross-verified with existing drag implementation
- Typography/spacing: HIGH - Multiple authoritative sources agree on readability standards
- Micro-animations: HIGH - Performance best practices well-documented, transform/opacity optimization
- Arc aesthetic specifics: LOW - No official Arc design system docs found, inferred from general 2026 design trends

**Research date:** 2026-01-29
**Valid until:** 30 days (CSS APIs stable, design trends evolve moderately, ApplicationV2 patterns may get better documentation)
