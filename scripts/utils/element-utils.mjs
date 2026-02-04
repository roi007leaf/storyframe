/**
 * Element Utilities
 * Helper functions for extracting and manipulating DOM elements
 */

/**
 * Extract HTMLElement from various formats (jQuery, array, raw element)
 * @param {*} html - The element in various possible formats
 * @param {*} fallback - Optional fallback object with .element property
 * @returns {HTMLElement|null}
 */
export function extractElement(html, fallback = null) {
  if (Array.isArray(html)) return html[0];
  if (html instanceof HTMLElement) return html;
  if (html?.jquery) return html[0];

  if (fallback?.element) {
    const elem = fallback.element;
    return elem?.jquery ? elem[0] : elem;
  }

  return null;
}

/**
 * Extract parent element from sheet/application interface
 * @param {*} parentInterface - The parent interface object
 * @returns {HTMLElement|null}
 */
export function extractParentElement(parentInterface) {
  if (!parentInterface?.element) return null;

  const element = parentInterface.element;
  return element instanceof HTMLElement ? element : (element[0] || element);
}
