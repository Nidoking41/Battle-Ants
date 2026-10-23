// Lost ants (campaign level 8): a few of the player's kind wandering alone in
// the fog. They belong to no one until the player's vision touches them, then
// they join the player. Until then they sit on the enemy's side of the state
// with lost: true, so the enemy's AI leaves them alone and the player's fog
// hides them like any other unseen unit.

import { getVisibleHexes } from '../fogOfWar';

/** Hand any lost ants the player can now see over to the player. */
export function recruitLostAnts(gameState, playerId = 'player1') {
  const lost = Object.values(gameState.ants || {}).filter(a => a.lost);
  if (lost.length === 0 || !gameState.campaign) return gameState;
  const seen = getVisibleHexes(gameState, playerId);
  const found = lost.filter(a => seen.has(`${a.position.q},${a.position.r}`));
  if (found.length === 0) return gameState;
  const ants = { ...gameState.ants };
  found.forEach(a => {
    const { lost: _lost, colorOverride: _color, ...rest } = a;
    ants[a.id] = { ...rest, owner: playerId, hasMoved: false, hasAttacked: false };
  });
  return {
    ...gameState,
    ants,
    campaign: { ...gameState.campaign, recruited: (gameState.campaign.recruited || 0) + found.length }
  };
}
