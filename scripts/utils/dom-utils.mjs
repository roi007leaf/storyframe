/**
 * DOM Utilities
 * Helper functions for finding and manipulating DOM elements
 */

import { SELECTORS } from '../constants.mjs';

/**
 * Find journal content element with multiple fallback selectors
 * @param {HTMLElement} element - The root element to search within
 * @returns {HTMLElement|null}
 */
export function findJournalContent(element) {
  return (
    element.querySelector(SELECTORS.JOURNAL_CONTENT) ||
    element.querySelector(SELECTORS.JOURNAL_CONTENT_ALT)
  );
}

/**
 * Find close button with multiple fallback selectors
 * @param {HTMLElement} header - The header element to search within
 * @returns {HTMLElement|null}
 */
export function findCloseButton(header) {
  return (
    header.querySelector(SELECTORS.CLOSE_BTN) ||
    header.querySelector(SELECTORS.CLOSE_BTN_ALT) ||
    header.querySelector('.header-control[aria-label*="Close"]')
  );
}
