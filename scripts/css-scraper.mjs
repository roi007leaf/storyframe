/**
 * CSS Scraper for StoryFrame
 * Extracts and namespaces journal CSS styles
 */
export class CSSScraper {
  constructor() {
    this.cache = new Map(); // journalUuid -> cssText
    this._loadCacheFromSettings();
  }

  /**
   * Load cache from Foundry settings
   * @private
   */
  _loadCacheFromSettings() {
    if (typeof game === 'undefined' || !game.settings) return;
    try {
      const saved = game.settings.get('storyframe', 'journalClassCache');
      if (saved && typeof saved === 'object') {
        for (const [uuid, cssText] of Object.entries(saved)) {
          this.cache.set(uuid, cssText);
        }
        console.log(`CSSScraper | Loaded cache from settings: ${this.cache.size} entries`);
      }
    } catch (e) {
      console.debug('CSSScraper | Could not load cache from settings:', e);
    }
  }

  /**
   * Save cache to Foundry settings
   * @private
   */
  async _saveCacheToSettings() {
    if (typeof game === 'undefined' || !game.settings) return;
    try {
      const cacheObj = Object.fromEntries(this.cache);
      await game.settings.set('storyframe', 'journalClassCache', cacheObj);
      console.log(`CSSScraper | Saved cache to settings: ${this.cache.size} entries`);
    } catch (e) {
      console.debug('CSSScraper | Could not save cache to settings:', e);
    }
  }

  /**
   * Extract journal-relevant CSS rules from document stylesheets
   * @param {JournalEntry} journal - Journal document to extract CSS for
   * @param {string} extractedClass - Optional pre-extracted class (e.g., 'pf2e-km')
   * @returns {string} Concatenated CSS text
   */
  extractJournalCSS(journal, extractedClass = null) {
    if (!journal) return '';

    console.log(`CSSScraper | Extracting CSS for journal: ${journal.name} (${journal.uuid})`);
    console.log(`CSSScraper | Extracted class: ${extractedClass || 'none'}`);

    // Check cache
    if (this.cache.has(journal.uuid)) {
      console.log(`CSSScraper | Cache HIT for ${journal.uuid}`);
      return this.cache.get(journal.uuid);
    }

    console.log(`CSSScraper | Cache MISS for ${journal.uuid} - extracting fresh CSS`);

    const styles = [];

    // Determine which module/pack this journal is from
    const journalPack = journal.pack; // e.g., "pf2e-beginner-box.journals"
    let targetModuleId = journalPack ? journalPack.split('.')[0] : null;

    console.log(`CSSScraper | Journal pack: ${journalPack || 'none (world journal)'}`);
    console.log(`CSSScraper | Initial target module ID: ${targetModuleId || 'none'}`);

    // For world journals (pack is null), use extractedClass to determine module
    if (!targetModuleId && extractedClass) {
      targetModuleId = extractedClass;
      // Extract module name from class (e.g., 'km' from 'pf2e-km')
      const match = extractedClass.match(/pf2e-(\w+)/);
      if (match) {
        targetModuleId = match[1]; // e.g., 'km' from 'pf2e-km'
      }
      console.log(`CSSScraper | Target module ID from extractedClass: ${targetModuleId}`);
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

    console.log(`CSSScraper | Primary keywords: ${primaryKeywords.join(', ') || 'none'}`);
    console.log(`CSSScraper | Secondary keywords: ${secondaryKeywords.join(', ')}`);

    // Build exclusion list for URL filtering (other premium modules)
    const otherPremiumModules = [
      'kingmaker', 'beginner-box', 'abomination-vaults', 'outlaws',
      'bloodlords', 'gatewalkers', 'stolenfate', 'skyking', 'seasonofghosts',
      'wardensofwildwood', 'curtaincall', 'triumphofthetusk', 'sporewar', 'pfs'
    ];

    console.log(`CSSScraper | Processing ${document.styleSheets.length} stylesheets`);

    // Iterate all stylesheets
    let processedSheets = 0;
    let skippedSheets = 0;
    let totalRules = 0;
    let matchedRules = 0;

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
          console.log(`CSSScraper | SKIPPED (other module): ${sheet.href}`);
          skippedSheets++;
          continue;
        }
      }

      // Access cssRules with CORS handling
      try {
        const rules = sheet.cssRules || sheet.rules;
        if (!rules) continue;

        console.debug(`CSSScraper | Processing stylesheet: ${sheet.href || '(inline)'} - ${rules.length} rules`);
        processedSheets++;
        totalRules += rules.length;

        let sheetMatches = 0;
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
              sheetMatches++;
              matchedRules++;
            }
          }
        }

        if (sheetMatches > 0) {
          console.log(`CSSScraper | Matched ${sheetMatches} rules from: ${sheet.href || '(inline)'}`);
        }
      } catch (e) {
        // CORS - skip external stylesheet
        if (e.name === 'SecurityError') {
          console.debug('CSSScraper | Cannot access external stylesheet (CORS):', sheet.href);
          skippedSheets++;
        } else {
          console.warn('CSSScraper | Error reading stylesheet:', e);
        }
      }
    }

    console.log(`CSSScraper | SUMMARY: Processed ${processedSheets} sheets, skipped ${skippedSheets} sheets`);
    console.log(`CSSScraper | Total rules examined: ${totalRules}, matched: ${matchedRules}`);
    console.log(`CSSScraper | Final CSS payload: ${styles.join('\n').length} characters`);

    const cssText = styles.join('\n');
    this.cache.set(journal.uuid, cssText);
    console.log(`CSSScraper | Cached CSS for ${journal.uuid}`);
    // Save to settings (fire-and-forget, don't await)
    this._saveCacheToSettings();
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
    console.log(`CSSScraper | Namespacing CSS with selector: ${namespace}`);
    console.log(`CSSScraper | Input CSS length: ${cssText.length} characters`);

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

    console.log(`CSSScraper | Parsed ${rules.length} CSS rules for namespacing`);

    // Process each rule
    let preserved = 0;
    let namespaced = 0;

    const result = rules
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
        const namespacedSelectors = selectors
          .map((sel) => {
            // Already namespaced
            if (sel.startsWith(namespace)) return sel;

            // Check if this selector should be namespaced
            if (!this.shouldNamespace(sel)) {
              preserved++;
              console.debug(`CSSScraper | PRESERVED: ${sel}`);
              return sel; // Preserve original
            }

            // Namespace this selector
            namespaced++;
            return `${namespace} ${sel}`;
          })
          .join(', ');

        return `${namespacedSelectors} ${declaration}`;
      })
      .join('\n');

    console.log(`CSSScraper | Namespacing complete: ${namespaced} selectors namespaced, ${preserved} preserved`);
    console.log(`CSSScraper | Output CSS length: ${result.length} characters`);

    return result;
  }

  /**
   * Clear cached CSS for journal
   * @param {string} journalUuid - Journal UUID
   */
  clearCache(journalUuid) {
    this.cache.delete(journalUuid);
    // Save updated cache to settings
    this._saveCacheToSettings();
  }

  /**
   * Clear all cached CSS
   */
  clearAllCache() {
    this.cache.clear();
    // Clear settings cache
    this._saveCacheToSettings();
  }
}
