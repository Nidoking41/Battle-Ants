import { createInitialGameState, endTurn } from '../gameState';
import { buildCampaignGameState } from './campaignState';
import { evaluateAllObjectives } from './objectives';
import { getLevel, PLAYER_QUEEN_ID, PLAYER_LARVA_ID } from './levels';
import { loadProgress, markLevelComplete, isUnlocked, isCompleted, resetProgress, bestScore } from './progress';
import { isVital, resolveCombat } from '../combatSystem';
import { scoreLevel } from './score';
import { unitStrength, calculateArmyStrength } from '../gameState';
import { getNeighbors, hexDistance } from '../hexUtils';
import { createAnt } from '../gameState';

// Runs a full round: player1's end of turn, then player2's, so income and
// round-based bookkeeping in endTurn actually fire.
function fullRound(state) {
  const afterP1 = endTurn(state).gameState;
  return endTurn(afterP1).gameState;
}

describe('campaign level 1', () => {
  const level = getLevel(1);

  test('builds a normal 2-player state with a campaign slice attached', () => {
    const state = buildCampaignGameState(level);

    expect(state.campaign).toBeDefined();
    expect(state.campaign.levelId).toBe(1);
    expect(state.campaign.roster).toEqual([]);
    expect(state.campaign.gathered).toEqual({ food: 0, minerals: 0 });
    expect(state.campaign.objectives.map(o => o.status)).toEqual(['pending', 'pending']);

    // The player leads with a Queen Larva, not a queen, so nothing can hatch
    expect(state.ants[PLAYER_LARVA_ID]).toBeDefined();
    expect(state.ants[PLAYER_LARVA_ID].type).toBe('queenLarva');
    expect(state.ants[PLAYER_LARVA_ID].owner).toBe('player1');
    expect(state.ants[PLAYER_LARVA_ID].maxHealth).toBe(20);

    // Larva + the default opening (2 drones + 1 scout); enemy keeps a full queen
    const owned = pid => Object.values(state.ants).filter(a => a.owner === pid);
    expect(owned('player1')).toHaveLength(4);
    expect(owned('player1').filter(a => a.type === 'queen')).toHaveLength(0);
    expect(owned('player2')).toHaveLength(4);
    expect(owned('player2').filter(a => a.type === 'queen')).toHaveLength(1);
    expect(state.campaign.enemyHunts).toBe(false);

    expect(state.players.player1.resources).toEqual({ food: 25, minerals: 0 });

    // Level 1 is food-only: minerals are useless to drones and scouts
    const nodeTypes = new Set(Object.values(state.resources).map(r => r.type));
    expect(nodeTypes).toEqual(new Set(['food']));
    expect(Object.keys(state.resources).length).toBeGreaterThan(0);
    expect(state.gameOver).toBe(false);
  });

  test('objectives stay pending through a normal round', () => {
    const state = fullRound(buildCampaignGameState(level));

    expect(state.turn).toBe(2);
    expect(state.gameOver).toBe(false);
    expect(state.campaign.objectives.map(o => o.status)).toEqual(['pending', 'pending']);
    // No anthills yet, so nothing gathered
    expect(state.campaign.gathered.food).toBe(0);
  });

  test('reaching the food total wins the level at end of turn', () => {
    const start = buildCampaignGameState(level);
    start.campaign.gathered.food = 50;

    const state = endTurn(start).gameState;

    expect(state.gameOver).toBe(true);
    expect(state.winner).toBe('player1');
    const gather = state.campaign.objectives.find(o => o.type === 'gather');
    expect(gather.status).toBe('complete');
  });

  test('losing the larva fails the level', () => {
    const start = buildCampaignGameState(level);
    delete start.ants[PLAYER_LARVA_ID];

    const state = endTurn(start).gameState;

    expect(state.gameOver).toBe(true);
    expect(state.winner).toBe('player2');
    const protect = state.campaign.objectives.find(o => o.type === 'protect');
    expect(protect.status).toBe('failed');
  });

  test('a level led by a real queen still re-keys her and fails on her death', () => {
    // No shipped level uses a queen yet; keep that path honest for later levels.
    const queenLevel = {
      ...level,
      player: { ...level.player, queenTier: 'queen' },
      objectives: [{ type: 'protect', unitId: PLAYER_QUEEN_ID, text: 'Keep your Queen alive' }]
    };
    const start = buildCampaignGameState(queenLevel);
    expect(start.ants[PLAYER_QUEEN_ID].type).toBe('queen');
    expect(start.ants[PLAYER_LARVA_ID]).toBeUndefined();

    delete start.ants[PLAYER_QUEEN_ID];
    const state = endTurn(start).gameState;
    expect(state.gameOver).toBe(true);
    expect(state.winner).toBe('player2');
  });

  test('a protect objective never counts toward the win', () => {
    const state = buildCampaignGameState(level);
    const withoutGather = {
      ...state,
      campaign: { ...state.campaign, objectives: state.campaign.objectives.filter(o => o.type === 'protect') }
    };
    // Only a protect objective: nothing can complete, so never "won"
    expect(evaluateAllObjectives(withoutGather).won).toBe(false);
  });
});

describe('campaign level 2 - queen larva', () => {
  const level = getLevel(2);

  test('the queen is replaced by an immobile larva with guards, and nothing is buildable', () => {
    const state = buildCampaignGameState(level);
    const mine = Object.values(state.ants).filter(a => a.owner === 'player1');

    expect(state.ants[PLAYER_LARVA_ID]).toBeDefined();
    expect(state.ants[PLAYER_LARVA_ID].type).toBe('queenLarva');
    expect(mine.filter(a => a.type === 'queen')).toHaveLength(0);
    expect(mine.filter(a => a.type === 'soldier')).toHaveLength(2);
    // Opening slots swapped: 2 spitters, 2 scouts, no drones
    expect(mine.filter(a => a.type === 'spitter')).toHaveLength(2);
    expect(mine.filter(a => a.type === 'scout')).toHaveLength(2);
    expect(mine.filter(a => a.type === 'drone')).toHaveLength(0);
    expect(mine).toHaveLength(7); // larva + 3 opening + 3 guards
    expect(state.campaign.roster).toEqual([]);
    // The enemy keeps a real queen, opens with two extra Marauders, and hunts
    const theirs = Object.values(state.ants).filter(a => a.owner === 'player2');
    expect(theirs.some(a => a.type === 'queen')).toBe(true);
    expect(theirs.filter(a => a.type === 'soldier')).toHaveLength(2);
    expect(state.campaign.enemyHunts).toBe(true);
    // Waves are queued but nothing has landed yet
    expect(state.campaign.waves.map(w => w.spawned)).toEqual([false, false]);
    // Defensive trees were added beside the larva, on the enemy's side
    const larva = state.ants[PLAYER_LARVA_ID];
    const enemyQueen = theirs.find(a => a.type === 'queen');
    const toward = Math.sign(enemyQueen.position.r - larva.position.r);
    const treeAt = (q, r) => Object.values(state.trees).some(t => t.position.q === q && t.position.r === r);
    level.map.trees.forEach(o => {
      expect(treeAt(larva.position.q + o.dq, larva.position.r + o.dr * toward)).toBe(true);
    });
  });

  test('reinforcement waves land beside the enemy queen on their turn, not before', () => {
    let state = buildCampaignGameState(level);
    const enemySoldiers = s => Object.values(s.ants).filter(a => a.owner === 'player2' && a.type === 'soldier').length;
    const enemySpitters = s => Object.values(s.ants).filter(a => a.owner === 'player2' && a.type === 'spitter').length;
    expect(enemySoldiers(state)).toBe(2);

    state = fullRound(state); // turn 2
    expect(state.turn).toBe(2);
    expect(enemySoldiers(state)).toBe(2);
    expect(state.campaign.waves[0].spawned).toBe(false);

    state = fullRound(state); // turn 3: first wave
    expect(state.turn).toBe(3);
    expect(state.campaign.waves[0].spawned).toBe(true);
    expect(state.campaign.waves[1].spawned).toBe(false);
    expect(enemySoldiers(state)).toBe(3);
    expect(enemySpitters(state)).toBe(1);

    const queen = Object.values(state.ants).find(a => a.owner === 'player2' && a.type === 'queen');
    const arrived = Object.values(state.ants).filter(a => a.id.startsWith('camp_wave3_'));
    expect(arrived).toHaveLength(2);
    arrived.forEach(a => expect(hexDistance(a.position, queen.position)).toBeLessThanOrEqual(3));

    state = fullRound(state); state = fullRound(state); state = fullRound(state); // turn 6
    expect(state.turn).toBe(6);
    expect(state.campaign.waves[1].spawned).toBe(true);
    expect(enemySoldiers(state)).toBe(5);
    expect(enemySpitters(state)).toBe(2);
    expect(state.gameOver).toBe(false);
  });

  test('the larva feeds the colony each round', () => {
    const start = buildCampaignGameState(level);
    const before = start.players.player1.resources.food;
    const state = fullRound(start);
    expect(state.players.player1.resources.food).toBe(before + 4);
  });

  test('the larva counts as vital, like a queen', () => {
    const state = buildCampaignGameState(level);
    expect(isVital(state.ants[PLAYER_LARVA_ID])).toBe(true);
    expect(isVital({ type: 'soldier' })).toBe(false);
  });

  test('losing the larva fails the level', () => {
    const start = buildCampaignGameState(level);
    delete start.ants[PLAYER_LARVA_ID];
    const state = endTurn(start).gameState;
    expect(state.gameOver).toBe(true);
    expect(state.winner).toBe('player2');
  });

  test('a killing blow on the larva ends the level through combat, not just end of turn', () => {
    const state = buildCampaignGameState(level);
    const larva = state.ants[PLAYER_LARVA_ID];

    // Every hex beside her is held by her own colony (defaults + guards), so
    // vacate the scout's hex and put an enemy Marauder there, one hit from a kill.
    const scout = Object.values(state.ants).find(a => a.owner === 'player1' && a.type === 'scout');
    expect(getNeighbors(larva.position).some(h => h.q === scout.position.q && h.r === scout.position.r)).toBe(true);
    delete state.ants[scout.id];
    const attacker = createAnt('soldier', 'player2', scout.position);
    attacker.id = 'test_enemy_soldier';
    state.ants[attacker.id] = attacker;
    state.ants[PLAYER_LARVA_ID] = { ...larva, health: 1 };
    state.currentPlayer = 'player2';

    const { gameState: after } = resolveCombat(state, attacker.id, PLAYER_LARVA_ID);

    expect(after.ants[PLAYER_LARVA_ID]).toBeUndefined();
    expect(after.gameOver).toBe(true);
    expect(after.winner).toBe('player2');
  });

  test('score counts kept units and the value of what was killed, not economy', () => {
    const state = buildCampaignGameState(level);
    expect(state.campaign.startingUnitIds).toHaveLength(6); // 2 soldiers, 2 spitters, 2 scouts

    const fresh = scoreLevel(state);
    expect(fresh.kept).toBe(6);
    expect(fresh.kills).toBe(0);
    expect(fresh.killStrength).toBe(0);
    // 2 Marauders (20) + 2 Spitters (20) + 2 Scouts (10) = 100
    expect(fresh.survivorStrength).toBe(100);
    expect(fresh.score).toBe(100);

    // A player Marauder kills an enemy Marauder: kill value recorded, score rises
    const mine = Object.values(state.ants).find(a => a.owner === 'player1' && a.type === 'soldier');
    const theirs = Object.values(state.ants).find(a => a.owner === 'player2' && a.type === 'soldier');
    state.ants[theirs.id] = { ...theirs, health: 1, position: getNeighbors(mine.position).find(h =>
      !Object.values(state.ants).some(a => a.position.q === h.q && a.position.r === h.r)) };
    const { gameState: after } = resolveCombat(state, mine.id, theirs.id);
    expect(after.ants[theirs.id]).toBeUndefined();
    expect(after.stats.player1.antsKilled).toBe(1);
    expect(after.stats.player1.killStrength).toBe(20);
    const s = scoreLevel(after);
    expect(s.kills).toBe(1);
    expect(s.killStrength).toBe(20);
    expect(s.score).toBe(s.survivorStrength + 20);

    // Losing a unit drops kept and survivor value
    delete after.ants[mine.id];
    expect(scoreLevel(after).kept).toBe(5);
  });

  test('unit strength includes upgrades, and army strength is its sum', () => {
    const player = { upgrades: { meleeAttack: 2, rangedAttack: 1, defense: 1 } };
    expect(unitStrength({ type: 'soldier' }, player)).toBe(20 + 4 + 2);
    expect(unitStrength({ type: 'spitter' }, player)).toBe(20 + 2 + 2);
    expect(unitStrength({ type: 'queenLarva' }, player)).toBe(2); // defense applies, base is 0
    const state = buildCampaignGameState(level);
    const mine = Object.values(state.ants).filter(a => a.owner === 'player1');
    const expected = mine.reduce((t, a) => t + unitStrength(a, state.players.player1), 0);
    expect(calculateArmyStrength(state, 'player1')).toBe(expected);
  });

  test('surviving to the target turn wins', () => {
    const start = buildCampaignGameState(level);
    start.turn = 10;
    const state = endTurn(start).gameState;
    expect(state.gameOver).toBe(true);
    expect(state.winner).toBe('player1');
  });
});

describe('campaign progress', () => {
  beforeEach(() => window.localStorage.clear());

  test('only level 1 is unlocked at first', () => {
    const p = loadProgress();
    expect(p).toEqual({ highestUnlocked: 1, completed: [], best: {} });
    expect(isUnlocked(1, p)).toBe(true);
    expect(isUnlocked(2, p)).toBe(false);
  });

  test('beating a level unlocks the next and survives a reload', () => {
    markLevelComplete(1);
    const p = loadProgress(); // fresh read, as the menu does on mount
    expect(isCompleted(1, p)).toBe(true);
    expect(isUnlocked(2, p)).toBe(true);
    expect(isUnlocked(3, p)).toBe(false);
  });

  test('recording the same win twice changes nothing', () => {
    markLevelComplete(1);
    markLevelComplete(1);
    expect(loadProgress()).toEqual({ highestUnlocked: 2, completed: [1], best: {} });
  });

  test('replaying an earlier level never locks later ones', () => {
    markLevelComplete(1);
    markLevelComplete(2);
    markLevelComplete(1);
    expect(loadProgress().highestUnlocked).toBe(3);
  });

  test('corrupt storage falls back to defaults', () => {
    window.localStorage.setItem('battleAnts.campaign.v1', '{not json');
    expect(loadProgress()).toEqual({ highestUnlocked: 1, completed: [], best: {} });
  });

  test('reset locks everything past level 1 again', () => {
    markLevelComplete(1);
    resetProgress();
    expect(isUnlocked(2)).toBe(false);
  });

  test('best score is kept per level and only ever goes up', () => {
    expect(bestScore(1)).toBeNull();
    markLevelComplete(1, 120);
    expect(bestScore(1)).toBe(120);
    markLevelComplete(1, 90);
    expect(bestScore(1)).toBe(120);
    markLevelComplete(1, 150);
    expect(bestScore(1)).toBe(150);
    markLevelComplete(2, 40);
    expect(loadProgress().best).toEqual({ 1: 150, 2: 40 });
    resetProgress();
    expect(bestScore(1)).toBeNull();
  });
});

describe('non-campaign games are untouched', () => {
  test('endTurn adds no campaign slice and never ends the game on objectives', () => {
    const state = fullRound(createInitialGameState());
    expect(state.campaign).toBeUndefined();
    expect(state.gameOver).toBe(false);
  });
});
