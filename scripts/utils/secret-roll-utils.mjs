/**
 * Apply Foundry's secret visibility field for current core generation.
 * Foundry v14 replaced legacy rollMode values with ChatMessage messageMode values.
 */
export function applySecretRollMode(options, coreGeneration, diceRollModes) {
  if (coreGeneration >= 14) {
    options.messageMode = 'blind';
  } else {
    options.rollMode = diceRollModes.BLIND;
  }
  return options;
}

/**
 * Force chat data for a StoryFrame secret roll.
 * Roll APIs can allow the player's modifier dialog to replace the requested mode,
 * so enforce privacy at the final chat-message boundary.
 */
export function enforceSecretRollMessage(message, activeSecretRoll, gmUsers) {
  if (!activeSecretRoll || message.speaker?.actor !== activeSecretRoll.actorId) {
    return false;
  }

  message.updateSource({
    blind: true,
    whisper: gmUsers.map((user) => user.id),
  });
  return true;
}
