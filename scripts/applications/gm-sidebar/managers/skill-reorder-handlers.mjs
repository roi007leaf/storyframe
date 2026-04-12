/**
 * Skill Reorder Handler for GM Sidebar
 * Handles drag-and-drop reordering of skills and categories using SortableJS.
 */

import { MODULE_ID } from '../../../constants.mjs';
import { getSortable } from '../../../vendor-loader.mjs';

let _sortableFailed = false;

/**
 * Attach drag-and-drop handlers for skill and category reordering.
 * Uses SortableJS when available, otherwise falls back to native drag-and-drop.
 * @param {Object} sidebar - The sidebar instance
 */
export function attachSkillReorderHandlers(sidebar) {
  if (!sidebar.element) return;

  const skillCategories = sidebar.element.querySelector('.skill-categories');
  if (!skillCategories) return;

  // Clean up old handlers before attaching new ones
  cleanupSkillReorderHandlers(sidebar);

  // Try SortableJS first, fall back to native
  if (!_sortableFailed) {
    _attachSortable(sidebar, skillCategories);
  } else {
    _attachNativeDrag(sidebar, skillCategories);
  }
}

/**
 * Attach SortableJS-based reordering (preferred)
 */
async function _attachSortable(sidebar, skillCategories) {
  let Sortable;
  try {
    Sortable = await getSortable();
  } catch {
    _sortableFailed = true;
    _attachNativeDrag(sidebar, skillCategories);
    return;
  }

  if (!sidebar.element?.isConnected) return;

  sidebar._sortableInstances = [];

  // 1. Category reordering (drag by category header)
  const categorySortable = new Sortable(skillCategories, {
    animation: 200,
    handle: '.category-label',
    ghostClass: 'swap-target',
    dragClass: 'dragging',
    filter: '.saves-category',
    onEnd: async () => {
      await saveCategoryOrder(sidebar);
    },
  });
  sidebar._sortableInstances.push(categorySortable);

  // 2. Skill reordering within each category
  const categoryContainers = skillCategories.querySelectorAll('.category-skills');
  categoryContainers.forEach((container) => {
    const categoryEl = container.closest('.skill-category');
    const categoryKey = categoryEl?.dataset.categoryKey;

    const skillSortable = new Sortable(container, {
      animation: 150,
      ghostClass: 'swap-target',
      dragClass: 'dragging',
      onEnd: async () => {
        if (categoryKey) {
          await saveSkillOrder(sidebar, categoryKey, categoryEl);
        }
      },
    });
    sidebar._sortableInstances.push(skillSortable);
  });
}

/**
 * Native drag-and-drop fallback (used when SortableJS fails to load)
 */
function _attachNativeDrag(sidebar, skillCategories) {
  if (!sidebar._reorderHandlers) {
    sidebar._reorderHandlers = {
      categoryDragover: null,
      categoryDrop: null,
      elements: [],
    };
  }

  setupCategoryDropZone(skillCategories, sidebar);

  const categoryElements = skillCategories.querySelectorAll('.skill-category');
  categoryElements.forEach((categoryEl) => {
    const label = categoryEl.querySelector('.category-label');
    if (label) {
      makeCategoryDraggable(label, categoryEl);
    }

    const skillsContainer = categoryEl.querySelector('.category-skills');
    if (skillsContainer) {
      setupSkillDropZone(skillsContainer, categoryEl, sidebar);
    }

    const skillWrappers = categoryEl.querySelectorAll('.skill-btn-wrapper');
    skillWrappers.forEach((wrapper) => {
      makeSkillDraggable(wrapper, sidebar, categoryEl);
    });
  });
}

/* ---------- Native DnD helpers (fallback) ---------- */

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

    const container = categoryEl.parentElement;
    if (container && container.classList.contains('skill-categories')) {
      await saveCategoryOrder({ element: container.closest('.storyframe.gm-sidebar') });
    }
  });
}

function setupCategoryDropZone(container, sidebar) {
  let targetCategory = null;
  let startCategory = null;

  const dragstartHandler = (e) => {
    const dragging = e.target.closest('.skill-category');
    if (dragging && !dragging.classList.contains('saves-category')) {
      startCategory = dragging;
      targetCategory = null;
    }
  };

  const dragoverHandler = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const dragging = container.querySelector('.skill-category.dragging');
    if (!dragging) return;

    const categories = [...container.querySelectorAll('.skill-category:not(.dragging):not(.saves-category)')];
    let hoveredCategory = null;
    let minDistance = Infinity;

    for (const cat of categories) {
      const rect = cat.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;
      const distance = Math.abs(e.clientY - centerY);

      if (distance < minDistance) {
        minDistance = distance;
        hoveredCategory = cat;
      }
    }

    if (hoveredCategory) {
      const rect = hoveredCategory.getBoundingClientRect();
      if (e.clientY < rect.top || e.clientY > rect.bottom) {
        hoveredCategory = null;
      }
    }

    if (hoveredCategory) {
      targetCategory = hoveredCategory;
      categories.forEach(c => c.classList.remove('swap-target'));
      hoveredCategory.classList.add('swap-target');
    }
  };

  const dragendHandler = () => {
    if (startCategory && targetCategory && startCategory !== targetCategory) {
      const parent = startCategory.parentNode;
      const startNext = startCategory.nextSibling;
      const targetNext = targetCategory.nextSibling;

      if (startNext === targetCategory) {
        parent.insertBefore(targetCategory, startCategory);
      } else if (targetNext === startCategory) {
        parent.insertBefore(startCategory, targetCategory);
      } else {
        parent.insertBefore(startCategory, targetNext);
        parent.insertBefore(targetCategory, startNext);
      }
    }

    const categories = [...container.querySelectorAll('.skill-category')];
    categories.forEach(c => c.classList.remove('swap-target'));
    targetCategory = null;
    startCategory = null;
  };

  container.addEventListener('dragstart', dragstartHandler, true);
  container.addEventListener('dragend', dragendHandler, true);

  const dropHandler = async (e) => {
    e.preventDefault();
    await saveCategoryOrder(sidebar);
  };

  container.addEventListener('dragover', dragoverHandler);
  container.addEventListener('drop', dropHandler);

  sidebar._reorderHandlers.categoryDragover = dragoverHandler;
  sidebar._reorderHandlers.categoryDrop = dropHandler;
  sidebar._reorderHandlers.container = container;
}

function makeSkillDraggable(wrapper, _sidebar, categoryEl) {
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

    const categoryKey = categoryEl.dataset.categoryKey;
    if (categoryKey) {
      await saveSkillOrder({ element: categoryEl.closest('.storyframe.gm-sidebar') }, categoryKey, categoryEl);
    }
  });
}

function setupSkillDropZone(skillsContainer, categoryEl, _sidebar) {
  let targetSkill = null;
  let startSkill = null;

  skillsContainer.addEventListener('dragstart', (e) => {
    const dragging = e.target.closest('.skill-btn-wrapper');
    if (dragging) {
      startSkill = dragging;
      targetSkill = null;
    }
  }, true);

  skillsContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const dragging = skillsContainer.querySelector('.skill-btn-wrapper.dragging');
    if (!dragging) return;

    const skills = [...skillsContainer.querySelectorAll('.skill-btn-wrapper:not(.dragging)')];
    const hoveredSkill = skills.find(skill => {
      const rect = skill.getBoundingClientRect();
      return e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top && e.clientY <= rect.bottom;
    });

    if (hoveredSkill) {
      targetSkill = hoveredSkill;
      skills.forEach(s => s.classList.remove('swap-target'));
      hoveredSkill.classList.add('swap-target');
    }
  });

  skillsContainer.addEventListener('dragend', () => {
    if (startSkill && targetSkill && startSkill !== targetSkill) {
      const parent = startSkill.parentNode;
      const startNext = startSkill.nextSibling;
      const targetNext = targetSkill.nextSibling;

      if (startNext === targetSkill) {
        parent.insertBefore(targetSkill, startSkill);
      } else if (targetNext === startSkill) {
        parent.insertBefore(startSkill, targetSkill);
      } else {
        parent.insertBefore(startSkill, targetNext);
        parent.insertBefore(targetSkill, startNext);
      }
    }

    const skills = [...skillsContainer.querySelectorAll('.skill-btn-wrapper')];
    skills.forEach(s => s.classList.remove('swap-target'));
    targetSkill = null;
    startSkill = null;
  }, true);

  skillsContainer.addEventListener('drop', async (e) => {
    e.preventDefault();
    const categoryKey = categoryEl.dataset.categoryKey;
    await saveSkillOrder({ element: categoryEl.closest('.storyframe.gm-sidebar') }, categoryKey, categoryEl);
  });
}

/* ---------- Persistence (shared between both modes) ---------- */

/**
 * Save category order to settings
 */
async function saveCategoryOrder(sidebar) {
  const container = sidebar.element.querySelector('.skill-categories');
  const categories = [...container.querySelectorAll('.skill-category:not(.saves-category)')];

  const order = categories.map(cat => {
    return cat.dataset.categoryKey;
  }).filter(Boolean);

  await game.settings.set(MODULE_ID, 'skillCategoryOrder', order);
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

  await game.settings.set(MODULE_ID, 'skillOrderByCategory', allOrders);
}

/**
 * Apply saved order to skills array
 */
export function applySavedSkillOrder(skills, categoryKey) {
  const savedOrders = game.settings.get(MODULE_ID, 'skillOrderByCategory') || {};
  const savedOrder = savedOrders[categoryKey];

  if (!savedOrder || savedOrder.length === 0) return skills;

  const skillMap = new Map(skills.map(s => [s.slug, s]));

  const ordered = [];
  for (const slug of savedOrder) {
    if (skillMap.has(slug)) {
      ordered.push(skillMap.get(slug));
      skillMap.delete(slug);
    }
  }

  ordered.push(...skillMap.values());

  return ordered;
}

/**
 * Apply saved category order
 */
export function applySavedCategoryOrder(context) {
  const savedOrder = game.settings.get(MODULE_ID, 'skillCategoryOrder') || [];

  const categoryMap = {
    'physical': { skills: context.physicalSkills, label: 'Physical' },
    'magical': { skills: context.magicalSkills, label: 'Magical' },
    'social': { skills: context.socialSkills, label: 'Social' },
    'utility': { skills: context.utilitySkills, label: 'Utility' },
  };

  if (savedOrder.length === 0) {
    context.orderedCategories = ['physical', 'magical', 'social', 'utility']
      .map(key => ({ key, ...categoryMap[key] }))
      .filter(cat => cat.skills && cat.skills.length > 0);
  } else {
    context.orderedCategories = savedOrder
      .map(key => ({ key, ...categoryMap[key] }))
      .filter(cat => cat.skills && cat.skills.length > 0);
  }

  return context;
}

/**
 * Clean up drag-and-drop handlers to prevent memory leaks
 * @param {Object} sidebar - The sidebar instance
 */
export function cleanupSkillReorderHandlers(sidebar) {
  // Clean up SortableJS instances
  if (sidebar._sortableInstances) {
    sidebar._sortableInstances.forEach(s => s.destroy());
    sidebar._sortableInstances = [];
  }

  // Clean up native fallback handlers
  if (!sidebar._reorderHandlers) return;

  const handlers = sidebar._reorderHandlers;

  if (handlers.categoryDragover && handlers.container) {
    handlers.container.removeEventListener('dragover', handlers.categoryDragover);
    handlers.container.removeEventListener('drop', handlers.categoryDrop);
  }

  handlers.elements = [];
  handlers.categoryDragover = null;
  handlers.categoryDrop = null;
  handlers.container = null;
}
