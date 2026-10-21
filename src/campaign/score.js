import { unitStrength } from '../gameState';

// End-of-level score for a campaign level.
//
// Most of it is speed: a win is worth SPEED_BASE minus SPEED_PER_TURN for
// every round it took (never below 0; a loss scores no speed). On top of
// that, the same valuation as the multiplayer army-strength chart - a fixed
// value per unit type plus +2 per upgrade tier that applies to it - used two
// ways:
//   survivorStrength  "Army value": every unit you still have standing
//   killStrength      "Army value destroyed": every enemy unit you killed
// Economy (food mined, anthills built) is deliberately not part of it: on a
// level like "Hold the Nest" there is nothing to mine or build.

export const SPEED_BASE = 500;
export const SPEED_PER_TURN = 20;

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

  const won = !!state.gameOver && state.winner === playerId;
  const turns = state.turn || 0;
  // A longer level can raise its base (level.speedBase), e.g. 600 for level 7
  const base = state.campaign?.speedBase ?? SPEED_BASE;
  const speedScore = won ? Math.max(0, base - SPEED_PER_TURN * turns) : 0;

  return {
    kept: kept.length,
    starting: starting.length,
    survivorStrength,
    kills,
    killStrength,
    lost,
    turns,
    speedScore,
    score: speedScore + survivorStrength + killStrength
  };
}
