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
   * Wait for link stylesheets to load
   * @param {NodeList} linkElements - Link elements to wait for
   * @param {number} timeoutMs - Timeout in milliseconds
   * @returns {Promise<void>}
   * @private
   */
  async _waitForLinkStylesheets(linkElements, timeoutMs = 2000) {
    const promises = Array.from(linkElements).map(link => {
      // Check if already loaded (has matching entry in document.styleSheets)
      const alreadyLoaded = Array.from(document.styleSheets).some(s => s.href === link.href);
      if (alreadyLoaded) return Promise.resolve();

      // Wait for load event or timeout
      return new Promise(resolve => {
        const timeout = setTimeout(() => {
          console.warn(`CSSScraper | Timeout waiting for stylesheet: ${link.href}`);
          resolve();
        }, timeoutMs);
        link.addEventListener('load', () => {
          clearTimeout(timeout);
          console.log(`CSSScraper | Link stylesheet loaded: ${link.href}`);
          resolve();
        }, { once: true });
        // Also handle error event
        link.addEventListener('error', () => {
          clearTimeout(timeout);
          console.warn(`CSSScraper | Failed to load stylesheet: ${link.href}`);
          resolve();
        }, { once: true });
      });
    });
    await Promise.all(promises);
  }

  /**
   * Extract journal-relevant CSS rules from document stylesheets
   * @param {JournalEntry} journal - Journal document to extract CSS for
   * @param {string} extractedClass - Optional pre-extracted class (e.g., 'pf2e-km')
   * @param {HTMLElement} sheetElement - Optional rendered sheet DOM element
   * @returns {Promise<string>|string} Concatenated CSS text
   */
  extractJournalCSS(journal, extractedClass = null, sheetElement = null) {
    if (!journal) return '';

    console.log(`CSSScraper | Extracting CSS for journal: ${journal.name} (${journal.uuid})`);
    console.log(`CSSScraper | Extracted class: ${extractedClass || 'none'}`);
    console.log(`CSSScraper | Sheet element provided: ${!!sheetElement}`);

    // Check cache
    if (this.cache.has(journal.uuid)) {
      console.log(`CSSScraper | Cache HIT for ${journal.uuid}`);
      return this.cache.get(journal.uuid);
    }

    console.log(`CSSScraper | Cache MISS for ${journal.uuid} - extracting fresh CSS`);

    // For known premium modules, fetch CSS directly from their module files
    // These modules load CSS in non-standard ways (not in document.styleSheets)
    const premiumModuleMap = {
      'pf2e-km': ['modules/pf2e-kingmaker/styles/pf2e-km.css'],
      'pf2e-bb': ['modules/pf2e-beginner-box/styles/pf2e-bb.css'],
      'pf2e-av': ['modules/pf2e-abomination-vaults/styles/pf2e-av.css'],
      'pf2e-pfs04': ['modules/pf2e-pfs04-year-of-boundless-wonder-1314/style.css'],
      'pf2e-pfs05': ['modules/pf2e-pfs05-year-of-unfettered-exploration-assets/style.css'],
      'pf2e-pfs06': ['modules/pf2e-pfs06-year-of-immortal-influence/style.css'],
      'pf2e-pfs07': ['modules/pf2e-pfs07-year-of-battles-spark/style.css']
    };

    if (extractedClass && premiumModuleMap[extractedClass]) {
      console.log(`CSSScraper | Premium module detected: ${extractedClass}`);
      return this._fetchPremiumCSS(journal, extractedClass, premiumModuleMap[extractedClass]);
    }

    // If sheet element is provided, we need to wait for link stylesheets - use async
    if (sheetElement) {
      return this._extractJournalCSSAsync(journal, extractedClass, sheetElement);
    } else {
      return this._extractJournalCSSSync(journal, extractedClass);
    }
  }

  /**
   * Fetch premium module CSS directly from known file paths
   * @private
   */
  async _fetchPremiumCSS(journal, extractedClass, cssUrls) {
    console.log(`CSSScraper | Fetching premium CSS from ${cssUrls.length} file(s)`);

    const allCSS = [];

    for (const cssUrl of cssUrls) {
      console.log(`CSSScraper | Fetching: ${cssUrl}`);

      try {
        const response = await fetch(cssUrl);
        if (!response.ok) {
          console.warn(`CSSScraper | Failed to fetch ${cssUrl}: ${response.status}`);
          continue;
        }

        const css = await response.text();
        console.log(`CSSScraper | Fetched ${css.length} characters from ${cssUrl}`);
        allCSS.push(css);
      } catch (error) {
        console.error(`CSSScraper | Error fetching ${cssUrl}:`, error);
      }
    }

    if (allCSS.length === 0) {
      console.warn(`CSSScraper | No premium CSS fetched, falling back to document.styleSheets`);
      return this._extractJournalCSSSync(journal, extractedClass);
    }

    const combined = allCSS.join('\n\n');
    console.log(`CSSScraper | Combined premium CSS: ${combined.length} characters`);

    // Cache it
    this.cache.set(journal.uuid, combined);
    await this._saveCacheToSettings();

    return combined;
  }

  /**
   * Synchronous CSS extraction (no sheet element)
   * @private
   */
  _extractJournalCSSSync(journal, extractedClass) {

    return this._processStylesheets(journal, extractedClass, document.styleSheets);
  }

  /**
   * Async CSS extraction (with sheet element to search for link stylesheets)
   * @private
   */
  async _extractJournalCSSAsync(journal, extractedClass, sheetElement) {
    console.log(`CSSScraper | Searching for link stylesheets in sheet element...`);

    // Search for link stylesheets in the sheet element
    const linkElements = sheetElement.querySelectorAll('link[rel="stylesheet"]');
    console.log(`CSSScraper | Found ${linkElements.length} link element(s) in sheet`);

    if (linkElements.length > 0) {
      // Log each link found
      linkElements.forEach(link => {
        console.log(`CSSScraper | Link href: ${link.href}`);

        // Check for premium module stylesheets
        const premiumModules = [
          'pf2e-kingmaker-tools', 'pf2e-pfs', 'pf2e-beginner-box',
          'pf2e-abomination-vaults', 'pf2e-outlaws', 'pf2e-bloodlords',
          'pf2e-gatewalkers', 'pf2e-stolenfate', 'pf2e-skyking',
          'pf2e-seasonofghosts', 'pf2e-wardensofwildwood', 'pf2e-curtaincall',
          'pf2e-triumphofthetusk', 'pf2e-sporewar'
        ];

        const isPremium = premiumModules.some(mod => link.href.includes(`modules/${mod}/`));
        if (isPremium) {
          console.log(`CSSScraper | FOUND premium module stylesheet: ${link.href}`);
        }
      });

      // Wait for link stylesheets to load
      console.log(`CSSScraper | Waiting for ${linkElements.length} link stylesheet(s) to load...`);
      await this._waitForLinkStylesheets(linkElements);
      console.log(`CSSScraper | Finished waiting for link stylesheets`);
    }

    // Check for adoptedStyleSheets (shadow DOM or modern pattern)
    if (sheetElement.adoptedStyleSheets && sheetElement.adoptedStyleSheets.length > 0) {
      console.log(`CSSScraper | Found ${sheetElement.adoptedStyleSheets.length} adopted stylesheet(s) in sheet`);
    }

    // Now extract from document.styleSheets (includes the loaded link stylesheets)
    console.log(`CSSScraper | Processing document.styleSheets: ${document.styleSheets.length} total sheets`);
    const result = this._processStylesheets(journal, extractedClass, document.styleSheets);
    console.log(`CSSScraper | Async extraction returning CSS: ${result.length} characters`);
    return result;
  }

  /**
   * Process stylesheets and extract matching rules
   * @private
   */
  _processStylesheets(journal, extractedClass, styleSheets) {
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

    console.log(`CSSScraper | Processing ${styleSheets.length} stylesheets`);

    // Log ALL stylesheet URLs first to see if pf2e-km.css is present
    console.log(`CSSScraper | All stylesheet URLs:`);
    for (let i = 0; i < styleSheets.length; i++) {
      const sheet = styleSheets[i];
      console.log(`CSSScraper |   [${i}] ${sheet.href || '(inline style)'}`);
    }

    // Iterate all stylesheets
    let processedSheets = 0;
    let skippedSheets = 0;
    let totalRules = 0;
    let matchedRules = 0;

    for (let i = 0; i < styleSheets.length; i++) {
      const sheet = styleSheets[i];

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

        // For large inline stylesheets (>100 rules), log first few rules to identify content
        if (!sheet.href && rules.length > 100) {
          console.log(`CSSScraper | Large inline stylesheet detected (${rules.length} rules). First 3 rules:`);
          for (let j = 0; j < Math.min(3, rules.length); j++) {
            const ruleText = rules[j].cssText.substring(0, 150); // First 150 chars
            console.log(`CSSScraper |   Rule ${j}: ${ruleText}...`);
          }
        }

        processedSheets++;
        totalRules += rules.length;

        let sheetMatches = 0;
        for (let j = 0; j < rules.length; j++) {
          const rule = rules[j];

          if (rule.cssText) {
            // Keyword-based filtering: Check if rule matches primary OR secondary keywords
            const ruleText = rule.cssText.toLowerCase();

            // For premium modules with extractedClass, be more lenient with filtering
            // The Kingmaker CSS might not contain "pf2e-km" in every rule
            const hasPremiumClass = extractedClass && (
              extractedClass.includes('pf2e-km') ||
              extractedClass.includes('pf2e-pfs') ||
              extractedClass.includes('pf2e-bb')
            );

            const matchesPrimary = primaryKeywords.length === 0 ||
              primaryKeywords.some(kw => ruleText.includes(kw.toLowerCase()));
            const matchesSecondary = secondaryKeywords.some(kw => ruleText.includes(kw));

            // If we have a premium class, include ALL journal-related rules (don't filter by premium keywords)
            const matchesRule = hasPremiumClass ? matchesSecondary : (matchesPrimary || matchesSecondary);

            if (matchesRule) {
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
