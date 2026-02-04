/**
 * Journal Integration Handler for GM Sidebar
 * Handles journal check extraction, highlighting, and content monitoring
 */

import { extractParentElement } from '../../../utils/element-utils.mjs';
import { findJournalContent } from '../../../utils/dom-utils.mjs';
import * as SystemAdapter from '../../../system-adapter.mjs';

/**
 * Extract checks from parent journal content
 * Returns checks grouped by skill
 */
export function extractJournalChecks(sidebar) {
  if (!sidebar.parentInterface?.element) {
    console.log('StoryFrame | extractJournalChecks: no parent interface element');
    return [];
  }

  const content = getJournalContent(sidebar);
  if (!content) {
    console.log('StoryFrame | extractJournalChecks: no journal content found');
    return [];
  }

  const checks = sidebar._parseChecksFromContent(content);
  console.log('StoryFrame | extractJournalChecks: found', checks.length, 'checks');
  const grouped = groupChecksBySkill(checks);
  console.log('StoryFrame | extractJournalChecks: grouped into', grouped.length, 'groups');
  return grouped;
}

/**
 * Extract checks from parent journal (ungrouped version for backward compat)
 */
export function extractJournalChecksFlat(sidebar) {
  const grouped = extractJournalChecks(sidebar);
  const flat = [];
  grouped.forEach((group) => flat.push(...group.checks));
  return flat;
}

/**
 * Get journal content element (helper)
 * Returns the container with all journal content for check parsing
 */
export function getJournalContent(sidebar) {
  const element = extractParentElement(sidebar.parentInterface);
  return findJournalContent(element);
}

/**
 * Group checks by skill (common logic)
 */
export function groupChecksBySkill(checks) {
  // Remove duplicates
  const unique = [];
  const seen = new Set();
  checks.forEach((check) => {
    const key = `${check.skillName}-${check.dc}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(check);
    }
  });

  // Group by skill type
  const grouped = {};
  unique.forEach((check) => {
    const skill = check.skillName;
    const skillDisplay = skill.charAt(0).toUpperCase() + skill.slice(1);
    // Convert skill name to proper slug for batch highlighting
    const skillSlug = SystemAdapter.getSkillSlugFromName(skill) || skill.toLowerCase();
    if (!grouped[skill]) {
      grouped[skill] = {
        skillName: skillDisplay,
        skillSlug: skillSlug,
        checks: [],
      };
    }
    grouped[skill].checks.push(check);
  });

  // Sort groups alphabetically by skill name (A-Z)
  return Object.values(grouped).sort((a, b) =>
    a.skillName.localeCompare(b.skillName)
  );
}

/**
 * Setup IntersectionObserver to highlight journal check buttons when checks are in view
 */
export function setupJournalCheckHighlighting(sidebar) {
  // Clean up existing observer and scroll listener
  if (sidebar._checkObserver) {
    sidebar._checkObserver.disconnect();
    sidebar._checkObserver = null;
  }
  if (sidebar._scrollCheckTimeout) {
    clearTimeout(sidebar._scrollCheckTimeout);
    sidebar._scrollCheckTimeout = null;
  }

  if (!sidebar.parentInterface?.element) return;

  // Get the journal's scrollable container
  const parentElement = extractParentElement(sidebar.parentInterface);

  // Find the scrollable content area (the part that actually scrolls)
  // Try multiple selectors for different journal sheet types
  const scrollContainer = parentElement.querySelector('.journal-entry-pages') ||
    parentElement.querySelector('.journal-entry-content') ||
    parentElement.querySelector('.scrollable') ||
    parentElement.querySelector('.journal-page-content')?.parentElement;

  if (!scrollContainer) return;

  // Get all inline check elements (PF2e format)
  const checkElements = scrollContainer.querySelectorAll('a.inline-check[data-pf2-check][data-pf2-dc]');
  if (checkElements.length === 0) return;

  // Initialize visible checks Map on instance (persists across callbacks)
  sidebar._visibleChecksMap = new Map(); // skill -> Set of DCs

  // Helper to update button highlights
  const updateButtonHighlights = () => {
    if (!sidebar.element) return;

    // Store for popup highlighting
    sidebar._visibleChecks = new Map(sidebar._visibleChecksMap);

    // Update button highlight state
    const buttons = sidebar.element.querySelectorAll('.journal-skill-btn');
    buttons.forEach((btn) => {
      const skillName = btn.dataset.skill?.toLowerCase();
      if (skillName && sidebar._visibleChecksMap.has(skillName)) {
        btn.classList.add('in-view');
      } else {
        btn.classList.remove('in-view');
      }
    });
  };

  // Create observer with a small buffer to reduce edge flickering
  sidebar._checkObserver = new IntersectionObserver(
    (entries) => {
      let changed = false;

      entries.forEach((entry) => {
        const skillName = entry.target.dataset.pf2Check;
        const dc = entry.target.dataset.pf2Dc;
        if (!skillName || !dc) return;

        // Normalize skill name to match button data-skill format
        const normalizedSkill = skillName.toLowerCase();

        if (entry.isIntersecting) {
          // Add skill and DC to visible set
          if (!sidebar._visibleChecksMap.has(normalizedSkill)) {
            sidebar._visibleChecksMap.set(normalizedSkill, new Set());
          }
          if (!sidebar._visibleChecksMap.get(normalizedSkill).has(dc)) {
            sidebar._visibleChecksMap.get(normalizedSkill).add(dc);
            changed = true;
          }
        } else {
          // Remove DC from visible set
          if (sidebar._visibleChecksMap.has(normalizedSkill)) {
            sidebar._visibleChecksMap.get(normalizedSkill).delete(dc);
            if (sidebar._visibleChecksMap.get(normalizedSkill).size === 0) {
              sidebar._visibleChecksMap.delete(normalizedSkill);
            }
            changed = true;
          }
        }
      });

      // Update button highlights if anything changed
      if (changed) {
        updateButtonHighlights();
      }
    },
    {
      root: scrollContainer,
      // Small buffer to reduce flickering at viewport edges
      rootMargin: '10px 0px',
      threshold: [0, 0.1, 0.5, 1.0],
    }
  );

  // Observe all check elements
  checkElements.forEach((el) => sidebar._checkObserver.observe(el));

  // Force an initial highlight update after a short delay to ensure DOM is stable
  // This catches cases where the observer's initial callback fires before layout is complete
  sidebar._scrollCheckTimeout = setTimeout(() => {
    forceCheckVisibility(sidebar, scrollContainer, checkElements, updateButtonHighlights);
  }, 100);
}

/**
 * Force a manual visibility check as a fallback when IntersectionObserver might miss updates
 */
export function forceCheckVisibility(sidebar, scrollContainer, checkElements, updateCallback) {
  if (!scrollContainer || !checkElements || !sidebar._visibleChecksMap) return;

  const containerRect = scrollContainer.getBoundingClientRect();

  checkElements.forEach((el) => {
    const skillName = el.dataset.pf2Check;
    const dc = el.dataset.pf2Dc;
    if (!skillName || !dc) return;

    const normalizedSkill = skillName.toLowerCase();
    const elRect = el.getBoundingClientRect();

    // Check if element is visible within the scroll container (with small buffer)
    const isVisible = elRect.top < containerRect.bottom + 10 &&
      elRect.bottom > containerRect.top - 10 &&
      elRect.left < containerRect.right &&
      elRect.right > containerRect.left;

    if (isVisible) {
      if (!sidebar._visibleChecksMap.has(normalizedSkill)) {
        sidebar._visibleChecksMap.set(normalizedSkill, new Set());
      }
      sidebar._visibleChecksMap.get(normalizedSkill).add(dc);
    } else {
      if (sidebar._visibleChecksMap.has(normalizedSkill)) {
        sidebar._visibleChecksMap.get(normalizedSkill).delete(dc);
        if (sidebar._visibleChecksMap.get(normalizedSkill).size === 0) {
          sidebar._visibleChecksMap.delete(normalizedSkill);
        }
      }
    }
  });

  // Always call updateCallback on force check - this ensures buttons are updated
  // even if the IntersectionObserver already populated the map
  updateCallback();
}

/**
 * Setup MutationObserver to detect when new journal pages load (multi-page journals)
 * and trigger a re-render to pick up new images/actors
 */
export function setupJournalContentObserver(sidebar) {
  // Clean up existing observer
  if (sidebar._journalContentObserver) {
    sidebar._journalContentObserver.disconnect();
    sidebar._journalContentObserver = null;
  }
  if (sidebar._journalContentDebounce) {
    clearTimeout(sidebar._journalContentDebounce);
    sidebar._journalContentDebounce = null;
  }

  if (!sidebar.parentInterface?.element) return;

  const parentElement = extractParentElement(sidebar.parentInterface);

  // Watch the journal pages container for new content
  const pagesContainer = parentElement.querySelector('.journal-entry-pages') ||
    parentElement.querySelector('.journal-entry-content') ||
    parentElement;

  if (!pagesContainer) return;

  // Track how many page content elements we've seen
  let lastPageCount = parentElement.querySelectorAll('.journal-page-content').length;

  sidebar._journalContentObserver = new MutationObserver((mutations) => {
    // Check if any new .journal-page-content elements were added
    let hasNewPages = false;
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.classList?.contains('journal-page-content') ||
              node.querySelector?.('.journal-page-content')) {
              hasNewPages = true;
              break;
            }
          }
        }
      }
      if (hasNewPages) break;
    }

    // Also check if page count increased (covers nested additions)
    const currentPageCount = parentElement.querySelectorAll('.journal-page-content').length;
    if (currentPageCount > lastPageCount) {
      hasNewPages = true;
      lastPageCount = currentPageCount;
    }

    if (hasNewPages) {
      // Debounce re-render to avoid multiple rapid updates
      if (sidebar._journalContentDebounce) {
        clearTimeout(sidebar._journalContentDebounce);
      }
      sidebar._journalContentDebounce = setTimeout(() => {
        sidebar.render();
      }, 150);
    }
  });

  sidebar._journalContentObserver.observe(pagesContainer, {
    childList: true,
    subtree: true,
  });
}

/**
 * Cleanup journal observers
 */
export function cleanupJournalObservers(sidebar) {
  // Clean up IntersectionObserver and timeout
  if (sidebar._checkObserver) {
    sidebar._checkObserver.disconnect();
    sidebar._checkObserver = null;
  }
  if (sidebar._scrollCheckTimeout) {
    clearTimeout(sidebar._scrollCheckTimeout);
    sidebar._scrollCheckTimeout = null;
  }
  sidebar._visibleChecksMap = null;

  // Clean up journal content observer
  if (sidebar._journalContentObserver) {
    sidebar._journalContentObserver.disconnect();
    sidebar._journalContentObserver = null;
  }
  if (sidebar._journalContentDebounce) {
    clearTimeout(sidebar._journalContentDebounce);
    sidebar._journalContentDebounce = null;
  }
}
