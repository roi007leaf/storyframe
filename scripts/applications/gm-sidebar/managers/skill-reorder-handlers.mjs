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

  // Clean up old handlers before attaching new ones
  cleanupSkillReorderHandlers(sidebar);

  // Initialize handler storage
  if (!sidebar._reorderHandlers) {
    sidebar._reorderHandlers = {
      categoryDragover: null,
      categoryDrop: null,
      elements: []
    };
  }

  // Set up category drop zone on container
  setupCategoryDropZone(skillCategories, sidebar);

  // Make category labels draggable and set up drop zones
  const categoryElements = skillCategories.querySelectorAll('.skill-category');
  categoryElements.forEach((categoryEl) => {
    const label = categoryEl.querySelector('.category-label');
    if (label) {
      makeCategoryDraggable(label, categoryEl);
    }

    // Set up drop zone for skills within this category
    const skillsContainer = categoryEl.querySelector('.category-skills');
    if (skillsContainer) {
      setupSkillDropZone(skillsContainer, categoryEl, sidebar);
    }

    // Make skill buttons within this category draggable
    const skillWrappers = categoryEl.querySelectorAll('.skill-btn-wrapper');
    skillWrappers.forEach((wrapper) => {
      makeSkillDraggable(wrapper, sidebar, categoryEl);
    });
  });
}

/**
 * Make a category label draggable for reordering
 */
function makeCategoryDraggable(label, categoryEl) {
  label.setAttribute('draggable', 'true');
  label.style.cursor = 'grab';

  label.addEventListener('dragstart', (e) => {
    label.style.cursor = 'grabbing';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', 'category');
    categoryEl.classList.add('dragging');
  });

  label.addEventListener('dragend', async () => {
    label.style.cursor = 'grab';
    categoryEl.classList.remove('dragging');

    // Save on dragend since drop doesn't fire reliably when moving elements
    console.log('StoryFrame: Category dragend - saving order');
    const container = categoryEl.parentElement;
    if (container && container.classList.contains('skill-categories')) {
      await saveCategoryOrder({ element: container.closest('.storyframe.gm-sidebar') });
    }
  });
}

/**
 * Set up drop zone for category reordering
 */
function setupCategoryDropZone(container, sidebar) {
  let currentSwapTarget = null;

  const dragoverHandler = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const dragging = container.querySelector('.skill-category.dragging');
    if (!dragging) return;

    // Find category directly under cursor
    const categories = [...container.querySelectorAll('.skill-category:not(.dragging):not(.saves-category)')];
    const targetCategory = categories.find(cat => {
      const rect = cat.getBoundingClientRect();
      return e.clientY >= rect.top && e.clientY <= rect.bottom;
    });

    // Swap positions if hovering over a different category
    if (targetCategory && targetCategory !== currentSwapTarget) {
      // Get references before moving
      const dragNext = dragging.nextSibling;
      const targetNext = targetCategory.nextSibling;
      const parent = dragging.parentNode;

      // Swap the two elements
      if (dragNext === targetCategory) {
        // Adjacent: dragging is right before target
        parent.insertBefore(targetCategory, dragging);
      } else if (targetNext === dragging) {
        // Adjacent: target is right before dragging
        parent.insertBefore(dragging, targetCategory);
      } else {
        // Not adjacent
        parent.insertBefore(dragging, targetNext);
        parent.insertBefore(targetCategory, dragNext);
      }

      currentSwapTarget = targetCategory;
    } else if (!targetCategory) {
      // Reset swap target when not hovering over any category
      currentSwapTarget = null;
    }
  };

  const dragendHandler = () => {
    currentSwapTarget = null;
  };

  container.addEventListener('dragend', dragendHandler, true);

  const dropHandler = async (e) => {
    e.preventDefault();
    await saveCategoryOrder(sidebar);
  };

  container.addEventListener('dragover', dragoverHandler);
  container.addEventListener('drop', dropHandler);

  // Store handlers for cleanup
  sidebar._reorderHandlers.categoryDragover = dragoverHandler;
  sidebar._reorderHandlers.categoryDrop = dropHandler;
  sidebar._reorderHandlers.container = container;
}

/**
 * Make a skill wrapper draggable for reordering within its category
 */
function makeSkillDraggable(wrapper, sidebar, categoryEl) {
  wrapper.setAttribute('draggable', 'true');
  wrapper.style.cursor = 'grab';

  wrapper.addEventListener('dragstart', (e) => {
    wrapper.style.cursor = 'grabbing';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', 'skill');
    wrapper.classList.add('dragging');
  });

  wrapper.addEventListener('dragend', async () => {
    wrapper.style.cursor = 'grab';
    wrapper.classList.remove('dragging');

    // Save on dragend since drop doesn't fire reliably when moving elements
    console.log('StoryFrame: Skill dragend - saving order');
    const categoryKey = categoryEl.dataset.categoryKey;
    if (categoryKey) {
      await saveSkillOrder({ element: categoryEl.closest('.storyframe.gm-sidebar') }, categoryKey, categoryEl);
    }
  });
}

/**
 * Set up drop zone for skills within a category
 */
function setupSkillDropZone(skillsContainer, categoryEl, sidebar) {
  let currentSwapTarget = null;

  skillsContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const dragging = skillsContainer.querySelector('.skill-btn-wrapper.dragging');
    if (!dragging) return;

    // Find skill directly under cursor
    const skills = [...skillsContainer.querySelectorAll('.skill-btn-wrapper:not(.dragging)')];
    const targetSkill = skills.find(skill => {
      const rect = skill.getBoundingClientRect();
      return e.clientX >= rect.left && e.clientX <= rect.right &&
             e.clientY >= rect.top && e.clientY <= rect.bottom;
    });

    // Swap positions if hovering over a different skill
    if (targetSkill && targetSkill !== currentSwapTarget) {
      // Get references before moving
      const dragNext = dragging.nextSibling;
      const targetNext = targetSkill.nextSibling;
      const parent = dragging.parentNode;

      // Swap the two elements
      if (dragNext === targetSkill) {
        // Adjacent: dragging is right before target
        parent.insertBefore(targetSkill, dragging);
      } else if (targetNext === dragging) {
        // Adjacent: target is right before dragging
        parent.insertBefore(dragging, targetSkill);
      } else {
        // Not adjacent
        parent.insertBefore(dragging, targetNext);
        parent.insertBefore(targetSkill, dragNext);
      }

      currentSwapTarget = targetSkill;
    } else if (!targetSkill) {
      // Reset swap target when not hovering over any skill
      currentSwapTarget = null;
    }
  });

  skillsContainer.addEventListener('dragend', () => {
    currentSwapTarget = null;
  }, true);

  skillsContainer.addEventListener('drop', async (e) => {
    e.preventDefault();
    // Save new skill order for this category
    const categoryKey = categoryEl.dataset.categoryKey;
    await saveSkillOrder(sidebar, categoryKey, categoryEl);
  });
}

/**
 * Save category order to settings
 */
async function saveCategoryOrder(sidebar) {
  const container = sidebar.element.querySelector('.skill-categories');
  const categories = [...container.querySelectorAll('.skill-category:not(.saves-category)')];

  const order = categories.map(cat => {
    return cat.dataset.categoryKey;
  }).filter(Boolean);

  console.log('StoryFrame: Saving category order:', order);
  await game.settings.set(MODULE_ID, 'skillCategoryOrder', order);
  ui.notifications.info('Category order saved');
}

/**
 * Save skill order within a category to settings
 */
async function saveSkillOrder(sidebar, categoryKey, categoryEl) {
  const skillWrappers = [...categoryEl.querySelectorAll('.skill-btn-wrapper')];
  const skillSlugs = skillWrappers.map(wrapper => {
    return wrapper.querySelector('.skill-btn')?.dataset.skill;
  }).filter(Boolean);

  const allOrders = game.settings.get(MODULE_ID, 'skillOrderByCategory') || {};
  allOrders[categoryKey] = skillSlugs;

  console.log(`StoryFrame: Saving skill order for ${categoryKey}:`, skillSlugs);
  await game.settings.set(MODULE_ID, 'skillOrderByCategory', allOrders);
  const categoryLabel = categoryEl.querySelector('.category-label')?.textContent.trim();
  ui.notifications.info(`${categoryLabel} skills order saved`);
}

/**
 * Apply saved order to skills array
 */
export function applySavedSkillOrder(skills, categoryKey) {
  const savedOrders = game.settings.get(MODULE_ID, 'skillOrderByCategory') || {};
  const savedOrder = savedOrders[categoryKey];

  console.log(`StoryFrame: Loading skill order for ${categoryKey}:`, savedOrder);
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
  console.log('StoryFrame: Loading category order:', savedOrder);

  // Category map
  const categoryMap = {
    'physical': { skills: context.physicalSkills, label: 'Physical' },
    'magical': { skills: context.magicalSkills, label: 'Magical' },
    'social': { skills: context.socialSkills, label: 'Social' },
    'utility': { skills: context.utilitySkills, label: 'Utility' },
  };

  if (savedOrder.length === 0) {
    // Use default order if no saved order
    context.orderedCategories = ['physical', 'magical', 'social', 'utility']
      .map(key => ({ key, ...categoryMap[key] }))
      .filter(cat => cat.skills && cat.skills.length > 0);
  } else {
    // Use saved order
    context.orderedCategories = savedOrder
      .map(key => ({ key, ...categoryMap[key] }))
      .filter(cat => cat.skills && cat.skills.length > 0);
  }

  console.log('StoryFrame: Ordered categories:', context.orderedCategories.map(c => c.key));
  return context;
}

/**
 * Clean up drag-and-drop handlers to prevent memory leaks
 * @param {Object} sidebar - The sidebar instance
 */
export function cleanupSkillReorderHandlers(sidebar) {
  if (!sidebar._reorderHandlers) return;

  const handlers = sidebar._reorderHandlers;

  // Remove container-level handlers
  if (handlers.categoryDragover && handlers.container) {
    handlers.container.removeEventListener('dragover', handlers.categoryDragover);
    handlers.container.removeEventListener('drop', handlers.categoryDrop);
  }

  // Clear stored elements (event listeners will be garbage collected with elements)
  handlers.elements = [];
  handlers.categoryDragover = null;
  handlers.categoryDrop = null;
  handlers.container = null;
}
