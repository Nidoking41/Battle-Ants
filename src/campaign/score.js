import { unitStrength } from '../gameState';

// End-of-level score for a campaign level.
//
// Same valuation as the multiplayer army-strength chart - a fixed value per
// unit type plus +2 per upgrade tier that applies to it - used two ways:
//   survivorStrength  the value of every unit you still have standing
//   killStrength      the value of every enemy unit you destroyed
// score = the two added together. Economy (food mined, anthills built) is
// deliberately not part of it: on a level like "Hold the Nest" there is
// nothing to mine or build, and the score should not punish that.

export function scoreLevel(state, playerId = 'player1') {
  const player = state.players?.[playerId];
  const isLeader = a => a.type === 'queen' || a.type === 'queenLarva';

  const living = Object.values(state.ants || {}).filter(a => a.owner === playerId && !isLeader(a));
  const starting = state.campaign?.startingUnitIds || [];
  const kept = starting.filter(id => state.ants?.[id]);

  const survivorStrength = living.reduce((sum, a) => sum + unitStrength(a, player), 0);
  const stats = state.stats?.[playerId] || {};
  const kills = stats.antsKilled || 0;
  const killStrength = stats.killStrength || 0;
  const lost = stats.antsLost || 0;

  return {
    kept: kept.length,
    starting: starting.length,
    survivorStrength,
    kills,
    killStrength,
    lost,
    score: survivorStrength + killStrength
  };
}
