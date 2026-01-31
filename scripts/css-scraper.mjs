/**
 * CSS Scraper for StoryFrame
 * Extracts and namespaces journal CSS styles
 */
export class CSSScraper {
  constructor() {
    this.cache = new Map(); // journalUuid -> cssText
  }

  /**
   * Extract journal-relevant CSS rules from document stylesheets
   * @param {JournalEntry} journal - Journal document to extract CSS for
   * @param {string} extractedClass - Optional pre-extracted class (e.g., 'pf2e-km')
   * @returns {string} Concatenated CSS text
   */
  extractJournalCSS(journal, extractedClass = null) {
    if (!journal) return '';

    // Check cache
    if (this.cache.has(journal.uuid)) {
      return this.cache.get(journal.uuid);
    }

    const styles = [];

    // Determine which module/pack this journal is from
    const journalPack = journal.pack; // e.g., "pf2e-beginner-box.journals"
    let targetModuleId = journalPack ? journalPack.split('.')[0] : null;

    // For world journals (pack is null), use extractedClass to determine module
    if (!targetModuleId && extractedClass) {
      targetModuleId = extractedClass;
      // Extract module name from class (e.g., 'km' from 'pf2e-km')
      const match = extractedClass.match(/pf2e-(\w+)/);
      if (match) {
        targetModuleId = match[1]; // e.g., 'km' from 'pf2e-km'
      }
    }

    // Build keyword list for content filtering
    // Primary keywords: the extracted class itself
    const primaryKeywords = [];
    if (extractedClass) {
      primaryKeywords.push(extractedClass);
      // Also add the class without 'pf2e-' prefix if applicable
      const shortName = extractedClass.replace('pf2e-', '');
      if (shortName !== extractedClass) {
        primaryKeywords.push(shortName);
      }
    }

    // Secondary keywords: general journal-related classes
    const secondaryKeywords = [
      'journal',
      'page-content',
      'entry-page',
      'text-content',
    ];

    // Build exclusion list for URL filtering (other premium modules)
    const otherPremiumModules = [
      'kingmaker', 'beginner-box', 'abomination-vaults', 'outlaws',
      'bloodlords', 'gatewalkers', 'stolenfate', 'skyking', 'seasonofghosts',
      'wardensofwildwood', 'curtaincall', 'triumphofthetusk', 'sporewar', 'pfs'
    ];

    // Iterate all stylesheets
    for (let i = 0; i < document.styleSheets.length; i++) {
      const sheet = document.styleSheets[i];

      // URL-based filtering: Skip stylesheets from other premium modules
      if (targetModuleId && sheet.href) {
        const sheetLower = sheet.href.toLowerCase();

        const isFromOtherModule = otherPremiumModules.some(mod => {
          // Skip if stylesheet contains another module's name AND target doesn't match
          return sheetLower.includes(mod) && !targetModuleId.toLowerCase().includes(mod);
        });

        if (isFromOtherModule) {
          console.debug('CSSScraper | Skipping stylesheet from other module:', sheet.href);
          continue;
        }
      }

      // Access cssRules with CORS handling
      try {
        const rules = sheet.cssRules || sheet.rules;
        if (!rules) continue;

        for (let j = 0; j < rules.length; j++) {
          const rule = rules[j];

          if (rule.cssText) {
            // Keyword-based filtering: Check if rule matches primary OR secondary keywords
            const ruleText = rule.cssText.toLowerCase();

            const matchesPrimary = primaryKeywords.length === 0 ||
              primaryKeywords.some(kw => ruleText.includes(kw.toLowerCase()));
            const matchesSecondary = secondaryKeywords.some(kw => ruleText.includes(kw));

            if (matchesPrimary || matchesSecondary) {
              styles.push(rule.cssText);
            }
          }
        }
      } catch (e) {
        // CORS - skip external stylesheet
        if (e.name === 'SecurityError') {
          console.debug('CSSScraper | Cannot access external stylesheet:', sheet.href);
        } else {
          console.warn('CSSScraper | Error reading stylesheet:', e);
        }
      }
    }

    const cssText = styles.join('\n');
    this.cache.set(journal.uuid, cssText);
    return cssText;
  }

  /**
   * Determine if a selector should be namespaced
   * @param {string} selector - CSS selector
   * @returns {boolean} True if selector should be namespaced
   * @private
   */
  shouldNamespace(selector) {
    const selectorLower = selector.toLowerCase();

    // Don't namespace selectors with DOM-contextual elements
    const contextualElements = ['body', 'html', ':root'];
    if (contextualElements.some(ctx => selectorLower.includes(ctx))) {
      return false;
    }

    // Don't namespace already-scoped selectors
    if (selector.includes('.journal-page-content')) return false;
    if (selector.includes('.journal-entry')) return false;

    // Namespace everything else
    return true;
  }

  /**
   * Namespace CSS rules to prevent conflicts
   * @param {string} cssText - Raw CSS text
   * @param {string} namespace - Selector prefix (default: .storyframe-content)
   * @returns {string} Namespaced CSS
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
    return rules
      .map((rule) => {
        // Preserve @layer directives entirely (complex cascade implications)
        if (rule.trim().startsWith('@layer')) {
          return rule;
        }

        // Handle @media rules by recursing into their contents
        if (rule.trim().startsWith('@media')) {
          // Extract media query and rules inside
          const openBrace = rule.indexOf('{');
          if (openBrace === -1) return rule;

          const mediaQuery = rule.substring(0, openBrace + 1);
          const innerRules = rule.substring(openBrace + 1, rule.lastIndexOf('}'));
          const closeBrace = rule.substring(rule.lastIndexOf('}'));

          // Recurse to namespace inner rules
          const namespacedInner = this.namespaceCSSRules(innerRules, namespace);
          return `${mediaQuery}\n${namespacedInner}\n${closeBrace}`;
        }

        // Preserve @keyframes entirely
        if (rule.trim().startsWith('@keyframes')) {
          return rule;
        }

        // Skip other @-rules
        if (rule.startsWith('@')) {
          return rule;
        }

        // Split selector from declaration
        const openBrace = rule.indexOf('{');
        if (openBrace === -1) return rule;

        const selector = rule.substring(0, openBrace).trim();
        const declaration = rule.substring(openBrace);

        // Split multiple selectors (comma-separated)
        const selectors = selector.split(',').map((s) => s.trim());

        // Apply selective namespacing to each selector
        const namespaced = selectors
          .map((sel) => {
            // Already namespaced
            if (sel.startsWith(namespace)) return sel;

            // Check if this selector should be namespaced
            if (!this.shouldNamespace(sel)) {
              return sel; // Preserve original
            }

            // Namespace this selector
            return `${namespace} ${sel}`;
          })
          .join(', ');

        return `${namespaced} ${declaration}`;
      })
      .join('\n');
  }

  /**
   * Clear cached CSS for journal
   * @param {string} journalUuid - Journal UUID
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
