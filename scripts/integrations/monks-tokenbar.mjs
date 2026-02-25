/**
 * Monks TokenBar Integration
 * Routes StoryFrame skill/save checks through Monks TokenBar when active.
 */

import { MODULE_ID } from '../constants.mjs';
import * as SystemAdapter from '../system-adapter.mjs';
import { PF2E_SKILL_SLUG_MAP } from '../system/pf2e/skills.mjs';
import { DND5E_SKILL_SLUG_MAP } from '../system/dnd5e/skills.mjs';

/**
 * Check if Monks TokenBar is active and available.
 */
export function isActive() {
  return !!(game.modules.get('monks-tokenbar')?.active && game.MonksTokenBar);
}

/**
 * Map StoryFrame skill/save slug to MTB request format.
 * @param {string} slug - StoryFrame short slug (e.g., 'per', 'acr', 'fortitude')
 * @param {string} checkType - 'skill' or 'save'
 * @returns {{ type: string, key: string }}
 */
function mapToMTBRequest(slug, checkType) {
  if (checkType === 'save') {
    return { type: 'save', key: slug };
  }

  const system = SystemAdapter.detectSystem();
  if (system === 'pf2e') {
    return { type: 'skill', key: PF2E_SKILL_SLUG_MAP[slug] || slug };
  }
  if (system === 'dnd5e') {
    return { type: 'skill', key: DND5E_SKILL_SLUG_MAP[slug] || slug };
  }
  return { type: 'skill', key: slug };
}

/**
 * Resolve tokens or actors for the given actor UUIDs.
 * Prefers tokens on the current scene, falls back to actor objects.
 * @param {string[]} actorUuids
 * @returns {Promise<Array<Token|Actor>>}
 */
async function resolveTargets(actorUuids) {
  const targets = [];
  for (const uuid of actorUuids) {
    // Try to find a token on the current scene first
    const token = canvas.tokens?.placeables.find(t => t.actor?.uuid === uuid);
    if (token) {
      targets.push(token);
    } else {
      // Fall back to actor object — MTB accepts actors too
      const actor = await fromUuid(uuid);
      if (actor) targets.push(actor);
    }
  }
  return targets;
}

/**
 * Route a skill/save check through Monks TokenBar.
 * @returns {boolean} true if request was sent, false if MTB couldn't handle it
 */
export async function requestRoll({ actorUuids, skillSlug, checkType, dc, isSecret }) {
  const targets = await resolveTargets(actorUuids);
  if (targets.length === 0) return false;

  const request = mapToMTBRequest(skillSlug, checkType);

  const options = {
    request,
    silent: true,
    rollmode: isSecret ? 'blindroll' : 'roll',
  };

  if (dc != null) {
    options.dc = dc;
    options.showdc = true;
  }

  try {
    await game.MonksTokenBar.requestRoll(targets, options);
    return true;
  } catch (error) {
    console.warn(`${MODULE_ID} | Monks TokenBar requestRoll failed:`, error);
    return false;
  }
}

/**
 * Register hooks to capture MTB roll results into StoryFrame roll history.
 * Should be called once on ready (GM only).
 */
export function initHooks() {
  if (!isActive()) return;

  Hooks.on('monks-tokenbar.updateRoll', (result, message) => {
    if (!game.user.isGM) return;
    if (!result?.tokenresults) return;

    for (const tr of result.tokenresults) {
      // Resolve actor UUID from token on canvas
      const token = canvas.tokens?.get(tr.id);
      const actorUuid = token?.actor?.uuid;
      if (!actorUuid) continue;

      game.storyframe.stateManager?.addRollResult({
        requestId: `mtb-${foundry.utils.randomID()}`,
        actorUuid,
        skillSlug: tr.request?.key || 'unknown',
        total: tr.total ?? 0,
        degreeOfSuccess: null,
        timestamp: Date.now(),
        chatMessageId: message?.id || null,
      });
    }
  });

  console.log(`${MODULE_ID} | Monks TokenBar integration hooks registered`);
}
