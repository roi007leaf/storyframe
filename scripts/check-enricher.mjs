/**
 * Enriches journal content with draggable skill checks
 * Auto-detects patterns like "Perception DC 20", "Stealth (Hide) DC 15"
 */

const SKILL_NAME_MAP = {
  perception: 'per',
  acrobatics: 'acr',
  arcana: 'arc',
  athletics: 'ath',
  crafting: 'cra',
  deception: 'dec',
  diplomacy: 'dip',
  intimidation: 'itm',
  medicine: 'med',
  nature: 'nat',
  occultism: 'occ',
  performance: 'prf',
  religion: 'rel',
  society: 'soc',
  stealth: 'ste',
  survival: 'sur',
  thievery: 'thi',
};

// Pattern: "Perception DC 20" or "Stealth (Hide) DC 15"
const CHECK_PATTERN = /\b([A-Z][a-z]+)(?:\s*\(([^)]+)\))?\s+DC\s+(\d+)\b/gi;

/**
 * Enriches HTML content with draggable check elements
 * @param {HTMLElement} element - The container element to enrich
 */
export function enrichChecks(element) {
  if (!element) return;

  // Walk DOM and find text nodes containing check patterns
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement;
      // Skip script/style nodes
      if (parent && ['SCRIPT', 'STYLE'].includes(parent.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }
      // Skip already processed nodes
      if (parent && parent.classList.contains('sf-check')) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodesToReplace = [];
  let node;

  while ((node = walker.nextNode())) {
    CHECK_PATTERN.lastIndex = 0;
    if (CHECK_PATTERN.test(node.textContent)) {
      nodesToReplace.push(node);
    }
  }

  // Replace nodes (do this after walking to avoid iterator issues)
  nodesToReplace.forEach((node) => {
    const text = node.textContent;
    CHECK_PATTERN.lastIndex = 0;

    const newHTML = text.replace(CHECK_PATTERN, (match, skillName, actionName, dc) => {
      const skillSlug = SKILL_NAME_MAP[skillName.toLowerCase()];
      const checkData = {
        type: 'StoryFrameCheck',
        skillSlug: skillSlug || null,
        actionSlug: actionName ? actionName.toLowerCase().trim() : null,
        dc: parseInt(dc),
        label: match,
      };

      const dataAttr = JSON.stringify(checkData).replace(/"/g, '&quot;');
      return `<span class="sf-check" data-check="${dataAttr}" draggable="true" title="Drag to StoryFrame sidebar">${match}</span>`;
    });

    const wrapper = document.createElement('span');
    wrapper.innerHTML = newHTML;
    node.replaceWith(...wrapper.childNodes);
  });

  // Add drag handlers to newly created check spans
  element.querySelectorAll('.sf-check[data-check]').forEach((el) => {
    el.addEventListener('dragstart', (e) => {
      const checkData = JSON.parse(el.dataset.check);
      e.dataTransfer.setData('text/plain', JSON.stringify(checkData));
      e.dataTransfer.effectAllowed = 'copy';
      el.style.cursor = 'grabbing';
    });

    el.addEventListener('dragend', () => {
      el.style.cursor = 'grab';
    });
  });
}
