/**
 * PF2e Party Utilities
 */

/**
 * Get PF2e party members as roll-requester-compatible entries.
 * Returns null if no party actor exists (caller should fall back).
 */
export async function getPF2ePartyPCs(toEntry) {
  const party = game.actors.find(a => a.type === 'party');
  if (!party) return null;

  const memberRefs = party.system?.details?.members || [];
  const members = await Promise.all(memberRefs.map(ref => fromUuid(ref.uuid)));
  const valid = members.filter(Boolean);
  return valid.length > 0 ? valid.map(toEntry) : null;
}
