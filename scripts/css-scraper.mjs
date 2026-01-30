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
   * @returns {string} Concatenated CSS text
   */
  extractJournalCSS(journal) {
    if (!journal) return '';

    // Check cache
    if (this.cache.has(journal.uuid)) {
      return this.cache.get(journal.uuid);
    }

    const styles = [];

    // Keywords that indicate journal/premium module CSS
    const journalKeywords = [
      'journal',
      'pf2e',
      'dnd5e',
      'swade',
      'outlaws',
      'bloodlords',
      'gatewalkers',
      'stolenfate',
      'skyking',
      'seasonofghosts',
      'wardensofwildwood',
      'curtaincall',
      'triumphofthetusk',
      'sporewar',
      'beginner-box',
      'abomination-vaults',
      'kingmaker',
      'page-content',
      'entry-page',
      'text-content',
    ];

    // Iterate all stylesheets
    for (let i = 0; i < document.styleSheets.length; i++) {
      const sheet = document.styleSheets[i];

      try {
        const rules = sheet.cssRules || sheet.rules;
        if (!rules) continue;

        for (let j = 0; j < rules.length; j++) {
          const rule = rules[j];

          if (rule.cssText) {
            // Only include rules that look journal-related
            const ruleText = rule.cssText.toLowerCase();
            const isJournalRelated = journalKeywords.some((kw) => ruleText.includes(kw));

            if (isJournalRelated) {
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

    console.log(`CSSScraper | Extracted ${styles.length} journal-related CSS rules`);
    const cssText = styles.join('\n');
    this.cache.set(journal.uuid, cssText);
    return cssText;
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
        const selectors = selector.split(',').map((s) => s.trim());

        // Prefix each selector
        const namespaced = selectors
          .map((sel) => {
            // Already namespaced
            if (sel.startsWith(namespace)) return sel;

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
