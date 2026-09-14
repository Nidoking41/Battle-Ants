// Campaign objectives.
//
// Every evaluator is a pure function of the game state. Objectives are
// re-evaluated at the end of every turn (see the hook at the bottom of
// endTurn in gameState.js) and their status is written back onto
// gameState.campaign.objectives, which is what the on-board panel renders.
//
// Status values: 'pending' | 'complete' | 'failed'.
//
// A level is won when every objective that CAN complete has completed. A
// `protect` objective can never complete - it only fails - so it is excluded
// from the win check and instead ends the level the moment its unit dies.

const ENEMY = 'player2';

function status(complete, failed = false) {
  if (failed) return 'failed';
  return complete ? 'complete' : 'pending';
}

export function evaluateObjective(objective, gameState, playerId) {
  const ants = Object.values(gameState.ants || {});

  switch (objective.type) {
    case 'gather': {
      // Running total, not the current stockpile, so spending the resource on
      // units does not un-complete the objective.
      const gathered = gameState.campaign?.gathered?.[objective.resource] || 0;
      return status(gathered >= objective.amount);
    }

    case 'survive':
      // gameState.turn counts full rounds, not individual player turns.
      return status(gameState.turn >= objective.untilTurn);

    case 'killAll':
      return status(!ants.some(a => a.owner === ENEMY));

    case 'killUnit':
      // Dead units are deleted from gameState.ants rather than flagged.
      return status(!gameState.ants[objective.unitId]);

    case 'protect':
      return status(false, !gameState.ants[objective.unitId]);

    case 'reachHex':
      return status(ants.some(a =>
        a.owner === playerId &&
        a.position.q === objective.at.q &&
        a.position.r === objective.at.r
      ));

    default:
      console.warn(`Unknown campaign objective type: ${objective.type}`);
      return 'pending';
  }
}

/**
 * Evaluate every objective on the level.
 * Returns { objectives, won, lost } where `objectives` is the input list with
 * a `status` on each entry. Never mutates its inputs.
 */
export function evaluateAllObjectives(gameState, playerId = 'player1') {
  const source = gameState.campaign?.objectives || [];
  const objectives = source.map(o => ({ ...o, status: evaluateObjective(o, gameState, playerId) }));

  const lost = objectives.some(o => o.status === 'failed');
  const completable = objectives.filter(o => o.type !== 'protect');
  const won = !lost && completable.length > 0 && completable.every(o => o.status === 'complete');

  return { objectives, won, lost };
}

/** Progress text for the panel, e.g. "37 / 100". Null when not applicable. */
export function objectiveProgress(objective, gameState) {
  switch (objective.type) {
    case 'gather':
      return `${Math.min(objective.amount, gameState.campaign?.gathered?.[objective.resource] || 0)} / ${objective.amount}`;
    case 'survive':
      return `Turn ${Math.min(objective.untilTurn, gameState.turn)} / ${objective.untilTurn}`;
    case 'killAll': {
      const left = Object.values(gameState.ants || {}).filter(a => a.owner === ENEMY).length;
      return `${left} remaining`;
    }
    default:
      return null;
  }
}
