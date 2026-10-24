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
// `loseAtMost` works the same way: { type: 'loseAtMost', what: 'eggs', max: 1 }
// fails the level the moment more than `max` of the player's eggs have been
// destroyed (counted in stats.eggsLost by attackEgg).
//
// Completion is sticky: once an objective has completed it stays completed,
// so a `reachHex` unit stepping off its hex, or a resource being spent, can
// never un-win something - which matters once `byTurn` deadlines exist.
//
// `byTurn: N` on any completable objective fails it once gameState.turn > N
// without completion. `turn` counts full rounds and is incremented before
// objectives are judged, so the player gets all of rounds 1..N.

const ENEMY = 'player2';

function status(complete, failed = false) {
  if (failed) return 'failed';
  return complete ? 'complete' : 'pending';
}

function baseStatus(objective, gameState, playerId) {
  const ants = Object.values(gameState.ants || {});
  const stats = gameState.stats?.[playerId] || {};

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

    case 'killUnits': {
      const ids = objective.unitIds || [];
      const dead = ids.filter(id => isKilled(gameState, id)).length;
      return status(dead >= (objective.count ?? ids.length));
    }

    case 'protect':
      return status(false, !gameState.ants[objective.unitId]);

    case 'loseAtMost':
      // Only eggs are counted so far
      return status(false, (stats.eggsLost || 0) > objective.max);

    case 'reachHex': {
      // at: one hex, a list of hexes, or 'goal' (the map's G hexes).
      // unitId: only that unit counts (an escort); otherwise any of yours.
      const targets = objective.at === 'goal'
        ? (gameState.campaign?.goalHexes || [])
        : (Array.isArray(objective.at) ? objective.at : [objective.at]);
      const movers = objective.unitId
        ? [gameState.ants?.[objective.unitId]].filter(Boolean)
        : ants.filter(a => a.owner === playerId);
      // afterTurn: N - a second-stage goal that only counts from round N on
      if (Number.isFinite(objective.afterTurn) && (gameState.turn || 1) < objective.afterTurn) return 'pending';
      return status(movers.some(a => targets.some(t => a.position.q === t.q && a.position.r === t.r)));
    }

    case 'buildAnthill':
      // Started counts: the drone has laid the foundations
      return status(Object.values(gameState.anthills || {}).some(h => h.owner === playerId));
    case 'layEgg': {
      // An egg on the board, or one that has already hatched
      const laid = Object.values(gameState.eggs || {}).some(e => e.owner === playerId) ||
        Object.values(stats.antsHatched || {}).some(v => v > 0);
      return status(laid);
    }

    case 'hatch': {
      const hatched = stats.antsHatched || {};
      const n = objective.unitType
        ? (hatched[objective.unitType] || 0)
        : Object.values(hatched).reduce((s, v) => s + (v || 0), 0);
      return status(n >= objective.count);
    }

    case 'destroyAnthills':
      return status((stats.anthillsDestroyed || 0) >= objective.count);

    case 'destroyAnthill':
      // One named anthill, e.g. the fungus garden
      return status(!gameState.anthills?.[objective.anthillId]);

    case 'convert':
      // Enemy ants turned with Cordyceps Purge (stats.antsConverted)
      return status((stats.antsConverted || 0) >= objective.count);

    default:
      console.warn(`Unknown campaign objective type: ${objective.type}`);
      return 'pending';
  }
}

const NO_DEADLINE = new Set(['protect', 'survive', 'loseAtMost']);
// Objectives that can only fail, never complete: left out of the win check
const FAIL_ONLY = new Set(['protect', 'loseAtMost']);

export function evaluateObjective(objective, gameState, playerId) {
  let s = baseStatus(objective, gameState, playerId);
  if (objective.status === 'complete' && s !== 'failed') s = 'complete';
  if (s === 'pending' && !NO_DEADLINE.has(objective.type) &&
      Number.isFinite(objective.byTurn) && gameState.turn > objective.byTurn) {
    s = 'failed';
  }
  return s;
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
  const completable = objectives.filter(o => !FAIL_ONLY.has(o.type));
  const won = !lost && completable.length > 0 && completable.every(o => o.status === 'complete');

  return { objectives, won, lost };
}

/**
 * Judge the objectives straight after a player's action, so a level is won
 * (or lost) the moment it happens instead of at End Turn. Returns the state
 * unchanged when nothing is decided. A killAll level with reinforcement
 * waves still to come is left to the round change, where the waves land first.
 */
export function settleObjectivesNow(gameState, playerId = 'player1') {
  if (!gameState?.campaign || gameState.gameOver) return gameState;
  const objectives = gameState.campaign.objectives || [];
  const wavesPending = (gameState.campaign.waves || []).some(w => !w.spawned);
  if (wavesPending && objectives.some(o => o.type === 'killAll')) return gameState;
  const result = evaluateAllObjectives(gameState, playerId);
  if (!result.won && !result.lost) {
    // Not decided yet, but tick off any goal that is now met
    const changed = result.objectives.some((o, i) => o.status !== objectives[i]?.status);
    return changed ? { ...gameState, campaign: { ...gameState.campaign, objectives: result.objectives } } : gameState;
  }
  return {
    ...gameState,
    gameOver: true,
    winner: result.won ? playerId : 'player2',
    campaign: { ...gameState.campaign, objectives: result.objectives }
  };
}

/** Progress text for the panel, e.g. "37 / 100". Null when not applicable. */
export function objectiveProgress(objective, gameState) {
  const stats = gameState.stats?.player1 || {};
  switch (objective.type) {
    case 'gather':
      return `${Math.min(objective.amount, gameState.campaign?.gathered?.[objective.resource] || 0)} / ${objective.amount}`;
    case 'survive':
      return `Turn ${Math.min(objective.untilTurn, gameState.turn)} / ${objective.untilTurn}`;
    case 'killAll': {
      const left = Object.values(gameState.ants || {}).filter(a => a.owner === ENEMY).length;
      return `${left} remaining`;
    }
    case 'killUnits': {
      const ids = objective.unitIds || [];
      const dead = ids.filter(id => isKilled(gameState, id)).length;
      return `${Math.min(dead, objective.count ?? ids.length)} / ${objective.count ?? ids.length}`;
    }
    case 'hatch': {
      const hatched = stats.antsHatched || {};
      const n = objective.unitType
        ? (hatched[objective.unitType] || 0)
        : Object.values(hatched).reduce((s, v) => s + (v || 0), 0);
      return `${Math.min(n, objective.count)} / ${objective.count}`;
    }
    case 'destroyAnthills':
      return `${Math.min(stats.anthillsDestroyed || 0, objective.count)} / ${objective.count}`;
    case 'convert':
      return `${Math.min(stats.antsConverted || 0, objective.count)} / ${objective.count}`;
    case 'loseAtMost':
      return `${stats.eggsLost || 0} lost`;
    default:
      return null;
  }
}

// A unit named by an objective counts as killed once it is gone from the
// board - but a scripted wave unit (camp_wave<turn>_...) that has not arrived
// yet is not dead, just not here yet.
function isKilled(gameState, id) {
  if (gameState.ants?.[id]) return false;
  const wave = /^camp_wave(\d+)_/.exec(id);
  if (wave && (gameState.turn || 0) < Number(wave[1])) return false;
  return true;
}
