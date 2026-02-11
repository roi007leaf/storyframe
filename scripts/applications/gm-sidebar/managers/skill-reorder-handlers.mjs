/**
 * Skill Reorder Handler for GM Sidebar
 * Handles drag-and-drop reordering of skills and categories
 */

import { MODULE_ID } from '../../../constants.mjs';

/**
 * Attach drag-and-drop handlers for skill and category reordering
 * @param {Object} sidebar - The sidebar instance
 */
export function attachSkillReorderHandlers(sidebar) {
  if (!sidebar.element) return;

  const skillCategories = sidebar.element.querySelector('.skill-categories');
  if (!skillCategories) return;

  // Make category labels draggable and set up drop zones
  const categoryElements = skillCategories.querySelectorAll('.skill-category');
  categoryElements.forEach((categoryEl) => {
    const label = categoryEl.querySelector('.category-label');
    if (label) {
      makeCategoryDraggable(label, categoryEl, sidebar);
    }

    // Set up drop zone for skills within this category
    const skillsContainer = categoryEl.querySelector('.category-skills');
    if (skillsContainer) {
      setupSkillDropZone(skillsContainer, categoryEl, sidebar);
    }

    // Make skill buttons within this category draggable
    const skillWrappers = categoryEl.querySelectorAll('.skill-btn-wrapper');
    skillWrappers.forEach((wrapper) => {
      makeSkillDraggable(wrapper, sidebar);
    });
  });
}

/**
 * Make a category label draggable for reordering
 */
function makeCategoryDraggable(label, categoryEl, sidebar) {
  label.setAttribute('draggable', 'true');
  label.style.cursor = 'grab';

  label.addEventListener('dragstart', (e) => {
    label.style.cursor = 'grabbing';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', 'category');
    categoryEl.classList.add('dragging');
  });

  label.addEventListener('dragend', (e) => {
    label.style.cursor = 'grab';
    categoryEl.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  });

  // Make category droppable
  categoryEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const dragging = document.querySelector('.skill-category.dragging');
    if (!dragging) return;

    categoryEl.classList.add('drag-over');
    const container = categoryEl.parentElement;
    const afterElement = getDragAfterCategory(container, e.clientY, '.skill-category:not(.dragging)');

    if (afterElement == null) {
      container.appendChild(dragging);
    } else {
      container.insertBefore(dragging, afterElement);
    }
  });

  categoryEl.addEventListener('dragleave', (e) => {
    if (e.target === categoryEl) {
      categoryEl.classList.remove('drag-over');
    }
  });

  categoryEl.addEventListener('drop', async (e) => {
    e.preventDefault();
    categoryEl.classList.remove('drag-over');

    // Save new category order
    await saveCategoryOrder(sidebar);
  });
}

/**
 * Make a skill wrapper draggable for reordering within its category
 */
function makeSkillDraggable(wrapper, sidebar) {
  wrapper.setAttribute('draggable', 'true');
  wrapper.style.cursor = 'grab';

  wrapper.addEventListener('dragstart', (e) => {
    wrapper.style.cursor = 'grabbing';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', 'skill');
    wrapper.classList.add('dragging');
  });

  wrapper.addEventListener('dragend', () => {
    wrapper.style.cursor = 'grab';
    wrapper.classList.remove('dragging');
  });
}

/**
 * Set up drop zone for skills within a category
 */
function setupSkillDropZone(skillsContainer, categoryEl, sidebar) {
  skillsContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const dragging = skillsContainer.querySelector('.skill-btn-wrapper.dragging');
    if (!dragging) return;

    const afterElement = getDragAfterElement(skillsContainer, e.clientX, '.skill-btn-wrapper:not(.dragging)');

    if (afterElement == null) {
      skillsContainer.appendChild(dragging);
    } else {
      skillsContainer.insertBefore(dragging, afterElement);
    }
  });

  skillsContainer.addEventListener('drop', async (e) => {
    e.preventDefault();

    // Save new skill order for this category
    const categoryLabel = categoryEl.querySelector('.category-label')?.textContent.trim();
    await saveSkillOrder(sidebar, categoryLabel, categoryEl);
  });
}

/**
 * Get the element after which the dragged item should be inserted (for grid layouts)
 */
function getDragAfterElement(container, clientX, selector) {
  const draggableElements = [...container.querySelectorAll(selector)];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const centerX = box.left + box.width / 2;
    const offset = clientX - centerX;

    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

/**
 * Get the element after which the dragged category should be inserted (vertical layout)
 */
function getDragAfterCategory(container, clientY, selector) {
  const draggableElements = [...container.querySelectorAll(selector)];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const centerY = box.top + box.height / 2;
    const offset = clientY - centerY;

    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

/**
 * Save category order to settings
 */
async function saveCategoryOrder(sidebar) {
  const container = sidebar.element.querySelector('.skill-categories');
  const categories = [...container.querySelectorAll('.skill-category')];

  const order = categories.map(cat => {
    const label = cat.querySelector('.category-label')?.textContent.trim();
    return getCategoryKey(label);
  }).filter(Boolean);

  await game.settings.set(MODULE_ID, 'skillCategoryOrder', order);
  ui.notifications.info('Category order saved');
}

/**
 * Save skill order within a category to settings
 */
async function saveSkillOrder(sidebar, categoryLabel, categoryEl) {
  const skillWrappers = [...categoryEl.querySelectorAll('.skill-btn-wrapper')];
  const skillSlugs = skillWrappers.map(wrapper => {
    return wrapper.querySelector('.skill-btn')?.dataset.skill;
  }).filter(Boolean);

  const categoryKey = getCategoryKey(categoryLabel);
  const allOrders = game.settings.get(MODULE_ID, 'skillOrderByCategory') || {};
  allOrders[categoryKey] = skillSlugs;

  await game.settings.set(MODULE_ID, 'skillOrderByCategory', allOrders);
  ui.notifications.info(`${categoryLabel} skills order saved`);
}

/**
 * Get category key from label
 */
function getCategoryKey(label) {
  const mapping = {
    'Physical': 'physical',
    'Magical': 'magical',
    'Social': 'social',
    'Utility': 'utility',
  };
  return mapping[label] || label.toLowerCase();
}

/**
 * Apply saved order to skills array
 */
export function applySavedSkillOrder(skills, categoryKey) {
  const savedOrders = game.settings.get(MODULE_ID, 'skillOrderByCategory') || {};
  const savedOrder = savedOrders[categoryKey];

  if (!savedOrder || savedOrder.length === 0) return skills;

  // Create a map of slug to skill
  const skillMap = new Map(skills.map(s => [s.slug, s]));

  // Build ordered array based on saved order
  const ordered = [];
  for (const slug of savedOrder) {
    if (skillMap.has(slug)) {
      ordered.push(skillMap.get(slug));
      skillMap.delete(slug);
    }
  }

  // Add any skills not in saved order at the end
  ordered.push(...skillMap.values());

  return ordered;
}

/**
 * Apply saved category order
 */
export function applySavedCategoryOrder(context) {
  const savedOrder = game.settings.get(MODULE_ID, 'skillCategoryOrder') || [];

  if (savedOrder.length === 0) return context;

  // Reorder categories based on saved order
  const categoryMap = {
    'physical': { skills: context.physicalSkills, label: 'Physical' },
    'magical': { skills: context.magicalSkills, label: 'Magical' },
    'social': { skills: context.socialSkills, label: 'Social' },
    'utility': { skills: context.utilitySkills, label: 'Utility' },
  };

  context.orderedCategories = savedOrder
    .map(key => ({ key, ...categoryMap[key] }))
    .filter(cat => cat.skills && cat.skills.length > 0);

  return context;
}
