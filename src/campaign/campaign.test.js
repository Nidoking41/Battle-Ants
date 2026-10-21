import { createInitialGameState, endTurn } from '../gameState';
import { buildCampaignGameState } from './campaignState';
import { evaluateAllObjectives } from './objectives';
import { getLevel, PLAYER_QUEEN_ID, PLAYER_LARVA_ID } from './levels';
import { loadProgress, markLevelComplete, isUnlocked, isCompleted, resetProgress, bestScore } from './progress';
import { isVital, resolveCombat } from '../combatSystem';
import { scoreLevel } from './score';
import { unitStrength, calculateArmyStrength, getSpawningPoolHexes as spawnSpotsOf } from '../gameState';
import { getNeighbors, hexDistance, isValidHex } from '../hexUtils';
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
    // Light, steady pressure: the enemy hatches only drones, a scout arrives
    // every three rounds, and every scout goes for the larva
    expect(state.campaign.enemyHunts).toBe(true);
    expect(state.campaign.enemyHuntsWithScouts).toBe(true);
    expect(state.campaign.enemyUnitMix).toEqual({ drone: 1 });
    expect(state.campaign.waves.map(w => w.turn)).toEqual([3, 6, 9, 12, 15, 18]);

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
    // Opening slots swapped: 3 spitters (one is a guard), 1 scout, no drones
    expect(mine.filter(a => a.type === 'spitter')).toHaveLength(3);
    expect(mine.filter(a => a.type === 'scout')).toHaveLength(1);
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
    // The layout puts three trees two hexes out on the enemy's side of her
    expect(toward).toBe(-1);
    [[0, -2], [-1, -1], [1, -2]].forEach(([dq, dr]) => {
      expect(treeAt(larva.position.q + dq, larva.position.r + dr)).toBe(true);
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
    expect(state.campaign.startingUnitIds).toHaveLength(6); // 2 soldiers, 3 spitters, 1 scout

    const fresh = scoreLevel(state);
    expect(fresh.kept).toBe(6);
    expect(fresh.kills).toBe(0);
    expect(fresh.killStrength).toBe(0);
    // 2 Marauders (20) + 3 Spitters (20) + 1 Scout (10) = 110
    expect(fresh.survivorStrength).toBe(110);
    expect(fresh.score).toBe(110);

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

  test('a win adds a speed score of 500 - 20 per turn, never below 0; a loss adds none', () => {
    const state = buildCampaignGameState(level);
    const army = scoreLevel(state).survivorStrength;
    const won = turn => scoreLevel({ ...state, gameOver: true, winner: 'player1', turn });
    expect(won(10).speedScore).toBe(300);
    expect(won(10).score).toBe(300 + army);
    expect(won(30).speedScore).toBe(0);
    expect(scoreLevel({ ...state, gameOver: true, winner: 'player2', turn: 5 }).speedScore).toBe(0);
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

describe('level schema: heroes, upgrades, tiers, anthills, ids', () => {
  const { getSpawningPoolHexes } = require('../gameState');
  const { QueenTiers } = require('../antTypes');
  const base = getLevel(2);

  test('heroes flow through to players, leaders and every campaign-placed unit', () => {
    // A queen instead of the larva, so the objectives must follow (level 2's
    // "protect the larva" would fail on turn 1 and end the level).
    const level = {
      ...base,
      player: { ...base.player, hero: 'thorgrim', queenTier: 'queen' },
      enemy: { ...base.enemy, hero: 'gorlak' },
      objectives: [{ type: 'survive', untilTurn: 10, text: 's' }, { type: 'protect', unitId: PLAYER_QUEEN_ID, text: 'p' }]
    };
    const state = buildCampaignGameState(level);
    expect(state.players.player1.heroId).toBe('thorgrim');
    expect(state.players.player2.heroId).toBe('gorlak');
    expect(state.ants[PLAYER_QUEEN_ID].heroId).toBe('thorgrim');
    // Thorgrim: health x1.2 - a slot-swapped Spitter (18) becomes 21
    const spitter = Object.values(state.ants).find(a => a.owner === 'player1' && a.type === 'spitter');
    expect(spitter.maxHealth).toBeGreaterThan(18);
    // Gorlak: melee attack x1.2 - her guard Marauders carry a bonus
    const theirs = Object.values(state.ants).find(a => a.owner === 'player2' && a.type === 'soldier');
    expect(theirs.bonusAttack || 0).toBeGreaterThan(0);
    // Waves inherit it too
    const later = fullRound(fullRound(state));
    const wave = Object.values(later.ants).find(a => a.id.startsWith('camp_wave3_soldier'));
    expect(wave.bonusAttack || 0).toBeGreaterThan(0);
  });

  test('pre-granted upgrades merge over the defaults', () => {
    const level = { ...base, player: { ...base.player, upgrades: { burrow: 1, meleeAttack: 2 } } };
    const state = buildCampaignGameState(level);
    const u = state.players.player1.upgrades;
    expect(u.meleeAttack).toBe(2);
    expect(u.burrow).toBe(1);
    expect(u.defense).toBe(0);
    expect(u.rangedAttack).toBe(0);
  });

  test('a pre-set queen tier starts at full energy with its spawn spots', () => {
    const level = { ...base, player: { ...base.player, queenTier: 'broodQueen' } };
    const state = buildCampaignGameState(level);
    const q = state.ants[PLAYER_QUEEN_ID];
    expect(q.queenTier).toBe('broodQueen');
    expect(q.energy).toBe(QueenTiers.broodQueen.maxEnergy);
    expect(q.maxEnergy).toBe(50);
    expect(getSpawningPoolHexes(q, getNeighbors)).toHaveLength(4);
    const plain = buildCampaignGameState({ ...base, player: { ...base.player, queenTier: 'queen' } });
    expect(plain.ants[PLAYER_QUEEN_ID].energy).toBe(25);
  });

  test('pre-built anthills sit on the nearest nodes, pay out, and keep the node', () => {
    const level = { ...base, enemy: { ...base.enemy, anthills: [{ type: 'food', count: 1 }] }, player: { ...base.player, anthills: [{ type: 'food', count: 1, reinforced: true }] } };
    const state = buildCampaignGameState(level);
    const hills = Object.values(state.anthills);
    expect(hills).toHaveLength(2);
    const mine = hills.find(h => h.owner === 'player1');
    const theirs = hills.find(h => h.owner === 'player2');
    expect(mine.isComplete).toBe(true);
    expect(mine.maxHealth).toBe(30); // reinforced
    expect(theirs.maxHealth).toBe(20);
    expect(state.resources[theirs.resourceId]).toBeDefined();
    const before = state.players.player2.resources.food;
    const after = fullRound(state);
    expect(after.players.player2.resources.food).toBe(before + 5 + 5); // queen + hill
    expect(after.campaign.gathered.food).toBe(5); // only the player's hill counts
  });

  test('guards and slot entries keep explicit ids', () => {
    const level = { ...base, player: { ...base.player, units: [{ type: 'spitter', id: 'my_spitter' }, 'scout', 'scout'], guards: [{ type: 'soldier', offset: { dq: -1, dr: 0 }, id: 'my_guard' }] } };
    const state = buildCampaignGameState(level);
    expect(state.ants.my_spitter.type).toBe('spitter');
    expect(state.ants.my_guard.type).toBe('soldier');
  });
});

describe('new objective types and deadlines', () => {
  const base = getLevel(2);
  const withObjectives = objectives => buildCampaignGameState({ ...base, objectives });

  test('hatch counts from stats.antsHatched', () => {
    const state = withObjectives([{ type: 'hatch', count: 2, text: 'x' }]);
    expect(evaluateAllObjectives(state).won).toBe(false);
    state.stats.player1.antsHatched.scout = 2;
    expect(evaluateAllObjectives(state).won).toBe(true);
  });

  test('destroyAnthills and killUnits complete from the world', () => {
    const state = withObjectives([
      { type: 'destroyAnthills', count: 1, text: 'x' },
      { type: 'killUnits', unitIds: ['a', 'b', 'c'], count: 2, text: 'y' }
    ]);
    state.ants.a = { id: 'a', owner: 'player2', type: 'scout', position: { q: 0, r: 0 } };
    expect(evaluateAllObjectives(state).won).toBe(false);
    state.stats.player1.anthillsDestroyed = 1;
    const r = evaluateAllObjectives(state);
    expect(r.objectives[0].status).toBe('complete');
    expect(r.objectives[1].status).toBe('complete'); // b and c are absent = dead
    expect(r.won).toBe(true);
  });

  test('byTurn fails a pending objective once the turn has passed, and completion is sticky', () => {
    let state = withObjectives([{ type: 'killUnit', unitId: 'never', byTurn: 3, text: 'x' }, { type: 'protect', unitId: PLAYER_LARVA_ID, text: 'p' }]);
    state.ants.never = { id: 'never', owner: 'player2', type: 'scout', position: { q: 0, r: 0 } };
    state.turn = 3;
    expect(evaluateAllObjectives(state).objectives[0].status).toBe('pending');
    state.turn = 4;
    const r = evaluateAllObjectives(state);
    expect(r.objectives[0].status).toBe('failed');
    expect(r.lost).toBe(true);
    // Completed before the deadline stays complete after it, even though the
    // unit is no longer on the hex
    const done = withObjectives([{ type: 'reachHex', at: { q: 99, r: 99 }, byTurn: 2, text: 'x' }]);
    done.campaign.objectives[0].status = 'complete';
    done.turn = 10;
    expect(evaluateAllObjectives(done).objectives[0].status).toBe('complete');
  });
});

describe('AI level controls', () => {
  const { resolveAIConfig, chooseUnitToProduce, huntTarget } = require('../aiController');
  const base = getLevel(2);

  test('a strict unit mix never hatches outside the list and returns null when broke', () => {
    const state = buildCampaignGameState({ ...base, enemy: { ...base.enemy, unitMix: { soldier: 1 } } });
    const config = resolveAIConfig(state, 'medium');
    expect(config.strictMix).toBe(true);
    state.players.player2.resources = { food: 100, minerals: 100 };
    const strategy = { shouldExpand: true, shouldAttack: false, shouldDefend: false };
    for (let i = 0; i < 20; i++) expect(chooseUnitToProduce(state, 'player2', config, strategy)).toBe('soldier');
    state.players.player2.resources = { food: 0, minerals: 0 };
    expect(chooseUnitToProduce(state, 'player2', config, strategy)).toBeNull();
    // Without a level mix the normal config comes back untouched
    expect(resolveAIConfig(createInitialGameState(), 'hard').strictMix).toBeUndefined();
  });

  test('hunt targets the player leader, or a named unit while it lives', () => {
    const state = buildCampaignGameState({ ...base, player: { ...base.player, queenTier: 'queen' } });
    expect(huntTarget(state, 'player2')).toEqual(state.ants[PLAYER_QUEEN_ID].position);
    const spitter = Object.values(state.ants).find(a => a.owner === 'player1' && a.type === 'spitter');
    const named = { ...state, campaign: { ...state.campaign, enemyHunts: `unit:${spitter.id}` } };
    expect(huntTarget(named, 'player2')).toEqual(spitter.position);
    const gone = { ...named, ants: { ...named.ants } };
    delete gone.ants[spitter.id];
    expect(huntTarget(gone, 'player2')).toEqual(state.ants[PLAYER_QUEEN_ID].position);
    expect(huntTarget({ ...state, campaign: { ...state.campaign, enemyHunts: false } }, 'player2')).toBeNull();
  });
});

describe('levels 3-6 content', () => {
  const { ENEMY_QUEEN_ID } = require('./levels');
  const { normalizeCutsceneLines } = require('./Cutscene');
  const { executeAITurn } = require('../aiController');
  const { createEgg } = require('../gameState');

  test('cutscene lines resolve rival portraits and names', () => {
    const lines = normalizeCutsceneLines(getLevel(3).cutscene);
    const skraz = lines.find(l => l.speaker);
    expect(skraz.speaker).toMatch(/Skrazzit/);
    expect(skraz.portrait).toBe('hero_blue.png');
    expect(lines[0].portrait).toBe('hero_black.png');
    expect(lines[0].speaker).toBeNull();
  });

  test('level 3: a real queen with Vexxara, a scout-only swarm, and eggs get sniped', async () => {
    const level = getLevel(3);
    const state = buildCampaignGameState(level);
    expect(state.ants[PLAYER_QUEEN_ID].type).toBe('queen');
    expect(state.players.player1.heroId).toBe('vexxara');
    expect(state.players.player2.heroId).toBe('skrazzit');
    expect(state.campaign.enemyUnitMix).toEqual({ scout: 1 });

    // An enemy scout beside an UNGUARDED player egg breaks it on its turn.
    // (With a unit in reach the AI hits the unit instead - a guarded egg lives.)
    Object.values(state.ants).filter(a => a.owner === 'player1' && a.type !== 'queen').forEach(a => { delete state.ants[a.id]; });
    const queen = state.ants[PLAYER_QUEEN_ID];
    const eggHex = getNeighbors(queen.position).find(h =>
      isValidHex(h, state.gridRadius, state.mapShape) &&
      !Object.values(state.ants).some(a => a.position.q === h.q && a.position.r === h.r));
    const egg = createEgg('soldier', 'player1', eggHex, state.turn);
    state.eggs[egg.id] = egg;
    const scoutHex = getNeighbors(eggHex).find(h =>
      isValidHex(h, state.gridRadius, state.mapShape) &&
      hexDistance(h, queen.position) >= 2 &&
      !Object.values(state.ants).some(a => a.position.q === h.q && a.position.r === h.r));
    const scout = createAnt('scout', 'player2', scoutHex);
    scout.id = 'sniper';
    state.ants[scout.id] = scout;
    state.currentPlayer = 'player2';

    const { gameState: after, combatActions } = await executeAITurn(state, 'player2', 'easy');
    const hit = combatActions.find(c => c.attackerId === 'sniper');
    expect(hit).toBeDefined();
    expect(hit.targetPosition.q).toBe(eggHex.q);
    expect(hit.targetPosition.r).toBe(eggHex.r);
    expect((after.eggs[egg.id]?.health ?? 0)).toBeLessThan(10);
  }, 15000);

  test('level 4: the lake blocks the straight road, and nothing stands in it', () => {
    const state = buildCampaignGameState(getLevel(4));
    expect(state.mapWater.length).toBeGreaterThan(0);
    // Water is drawn but never playable
    state.mapWater.forEach(w => expect(isValidHex(w, state.gridRadius, state.mapShape)).toBe(false));
    // The hex halfway between the leaders is water
    const p1 = state.ants[PLAYER_QUEEN_ID].position;
    const p2 = Object.values(state.ants).find(a => a.owner === 'player2' && a.type === 'queen').position;
    const mid = { q: p1.q, r: Math.round((p1.r + p2.r) / 2) };
    expect(state.mapWater.some(w => w.q === mid.q && w.r === mid.r)).toBe(true);
    // ...but a route still exists: the AI's own reachability from the enemy queen grows past the lake
    const { getMovementRange } = require('../hexUtils');
    const reach = getMovementRange(p2, 12, state.gridRadius, [], state.mapShape);
    expect(reach.some(h => h.q === p1.q && h.r === p1.r - 1)).toBe(true);
  });

  test('level 4: Skrazzit starts with two mineral hills on the ridge', () => {
    const state = buildCampaignGameState(getLevel(4));
    const hills = Object.values(state.anthills).filter(h => h.owner === 'player2');
    expect(hills).toHaveLength(2);
    hills.forEach(h => {
      expect(h.resourceType).toBe('minerals');
      expect(h.isComplete).toBe(true);
      expect(state.resources[h.resourceId]).toBeDefined();
    });
    expect(state.campaign.objectives.map(o => o.type)).toEqual(['gather', 'destroyAnthills', 'killUnit', 'protect']);
  });

  test('level 5: Gorlak starts with no head start, a lane map, and a deadline', () => {
    const state = buildCampaignGameState(getLevel(5));
    expect(state.players.player2.upgrades.meleeAttack || 0).toBe(0);
    expect(state.players.player2.heroId).toBe('gorlak');
    expect(state.players.player2.resources).toEqual({ food: 10, minerals: 0 });
    expect(Object.values(state.anthills).filter(h => h.owner === 'player2')).toHaveLength(0);
    // Your two drones start on the queen's two egg spots, one each side
    const spots = spawnSpotsOf(state.ants[PLAYER_QUEEN_ID], getNeighbors, state).map(h => `${h.q},${h.r}`);
    expect(spots).toHaveLength(2);
    const drones = Object.values(state.ants).filter(a => a.owner === 'player1' && a.type === 'drone').map(a => `${a.position.q},${a.position.r}`);
    expect(drones.sort()).toEqual(spots.sort());
    expect(state.ants[ENEMY_QUEEN_ID]).toBeDefined();
    const kill = state.campaign.objectives.find(o => o.type === 'killUnit');
    expect(kill.unitId).toBe(ENEMY_QUEEN_ID);
    expect(kill.byTurn).toBeUndefined(); // no time limit
    // The void spine: the centre column between the lanes is not on the map
    const p1 = state.ants[PLAYER_QUEEN_ID].position;
    const p2 = state.ants[ENEMY_QUEEN_ID].position;
    const midQ = p1.q; // both leaders share the column
    const midR = Math.round((p1.r + p2.r) / 2);
    expect(isValidHex({ q: midQ, r: midR }, state.gridRadius, state.mapShape)).toBe(false);
  });

  test('level 6: Brood Queen with a placed force, Thorgrim\'s Bullet Ants, and the wave ids the objective names', () => {
    let state = buildCampaignGameState(getLevel(6));
    const q = state.ants[PLAYER_QUEEN_ID];
    expect(q.queenTier).toBe('broodQueen');
    expect(q.energy).toBe(50);
    const mine = Object.values(state.ants).filter(a => a.owner === 'player1' && a.type !== 'queen');
    expect(mine.filter(a => a.type === 'healer')).toHaveLength(2);
    expect(mine.filter(a => a.type === 'spitter')).toHaveLength(3);
    expect(mine.filter(a => a.type === 'soldier')).toHaveLength(0); // no Marauders on this level
    expect(mine.filter(a => a.type === 'drone')).toHaveLength(0);
    expect(mine.filter(a => a.type === 'bombardier')).toHaveLength(2);
    expect(mine.filter(a => a.type === 'bomber')).toHaveLength(1);
    expect(state.ants.camp_player2_B1.type).toBe('tank');
    expect(state.ants.camp_player2_B2.maxHealth).toBeGreaterThan(55); // Thorgrim: x1.2 health
    expect(state.campaign.roster).toEqual([]); // no hatching on this level

    state = fullRound(fullRound(state)); // turn 3: not yet
    expect(state.ants.camp_wave6_tank1).toBeUndefined();
    state = fullRound(fullRound(fullRound(state))); // turn 6: the second pair lands
    expect(state.ants.camp_wave6_tank1).toBeDefined();
    expect(state.ants.camp_wave6_tank2).toBeDefined();
    expect(state.campaign.enemyAggressive).toBe(true);
    const ids = state.campaign.objectives.find(o => o.type === 'killUnits').unitIds;
    ids.forEach(id => expect(state.ants[id]).toBeDefined());
  });
});

describe('custom map layouts', () => {
  const { parseLayout } = require('./mapLayout');
  const { isValidHex, getMovementRange } = require('../hexUtils');

  // A tiny map: a 3-hex column with a hole, enemy at top, player at bottom.
  //   x: 0 1 2
  const ROWS = [
    ' 2 ',   // y0: (1,0)
    '. .',   // y1: (0,1) (2,1)
    ' T ',   // y2: (1,2)
    '. .',   // y3: (0,3) (2,3)
    ' 1 '    // y4: (1,4)
  ];

  test('parses double-height text into axial hexes with even recentering', () => {
    const l = parseLayout(ROWS);
    expect(l.mapHexes).toHaveLength(7);
    // Every declared cell has x + y even; q = x - dx, r = (y - dy - q) / 2 with even shifts
    l.mapHexes.forEach(h => expect(Number.isInteger(h.r)).toBe(true));
    expect(l.leaders.player1).toBeDefined();
    expect(l.leaders.player2).toBeDefined();
    // Player is south (larger r) of the enemy
    expect(l.leaders.player1.r).toBeGreaterThan(l.leaders.player2.r);
    expect(l.trees).toHaveLength(1);
    // The tree sits directly between the two leaders on the same column
    expect(l.trees[0].q).toBe(l.leaders.player1.q);
    expect(l.trees[0].r).toBe(l.leaders.player1.r - 1);
    expect(l.leaders.player2.r).toBe(l.leaders.player1.r - 2);
    expect(isValidHex(l.leaders.player1, l.gridRadius, l.mapShape)).toBe(true);
    expect(isValidHex({ q: 40, r: 40 }, l.gridRadius, l.mapShape)).toBe(false);
  });

  test('rejects art that has slipped a column and unknown characters', () => {
    expect(() => parseLayout(['.1'])).toThrow(/off-grid/);
    expect(() => parseLayout([' 1 ', 'x x'], {})).toThrow(/legend/);
    expect(() => parseLayout([' 1 ', '? ?'])).toThrow(/unknown/);
    expect(() => parseLayout(['. .'])).toThrow(/missing player leader/);
  });

  test('a level built from a layout has exactly that shape, and nothing stands in void', () => {
    const level = {
      id: 99, name: 'Test',
      map: { layout: ROWS, legend: { A: 'soldier' } },
      player: { queenTier: 'queen', units: 'default' },
      enemy: { queenTier: 'queen', units: 'default', waves: [{ turn: 2, units: [{ type: 'scout', count: 2 }] }] },
      objectives: [{ type: 'survive', untilTurn: 5, text: 'x' }]
    };
    let state = buildCampaignGameState(level);
    expect(state.mapHexes).toHaveLength(7);
    expect(state.mapShape.type).toBe('custom');
    expect(Object.keys(state.trees)).toHaveLength(1);
    expect(Object.keys(state.resources)).toHaveLength(0);

    const onMap = h => isValidHex(h, state.gridRadius, state.mapShape);
    const allUnits = s => Object.values(s.ants);
    allUnits(state).forEach(a => expect(onMap(a.position)).toBe(true));
    // Leaders are where the markers put them
    const p1 = state.ants[PLAYER_QUEEN_ID];
    const p2 = Object.values(state.ants).find(a => a.owner === 'player2' && a.type === 'queen');
    expect(p1.position.r - p2.position.r).toBe(2);
    // The opening units were re-seated on the map, not left on the old hexagon
    expect(allUnits(state).filter(a => a.owner === 'player1')).toHaveLength(4);

    // Movement never enters void: from the player's hex, range 3, all results on-map
    getMovementRange(p1.position, 3, state.gridRadius, [], state.mapShape).forEach(h => expect(onMap(h)).toBe(true));

    // Waves land on the map (or not at all)
    state = fullRound(state);
    allUnits(state).forEach(a => expect(onMap(a.position)).toBe(true));
  });

  test('legend markers place units for each side with stable ids', () => {
    const level = {
      id: 98, name: 'Markers',
      map: { layout: [' 2 ', 'A A', ' . ', 'a a', ' 1 '], legend: { a: 'spitter', A: 'soldier' } },
      player: { queenTier: 'queen', units: [] },
      enemy: { queenTier: 'queen', units: [] },
      objectives: []
    };
    const state = buildCampaignGameState(level);
    expect(state.ants['camp_player1_a1'].type).toBe('spitter');
    expect(state.ants['camp_player1_a2'].owner).toBe('player1');
    expect(state.ants['camp_player2_A1'].type).toBe('soldier');
    expect(state.ants['camp_player2_A2'].owner).toBe('player2');
  });

  test('every shipped level builds, with its leaders and units on the map', () => {
    const { LEVELS } = require('./levels');
    LEVELS.forEach(level => {
      const state = buildCampaignGameState(level);
      const onMap = h => isValidHex(h, state.gridRadius, state.mapShape);
      const ants = Object.values(state.ants);
      expect(ants.some(a => a.owner === 'player1' && (a.type === 'queen' || a.type === 'queenLarva'))).toBe(true);
      // A level can field an enemy with no leader on the map (level 7: Sorlorg's hidden guns)
      const enemyLeader = level.enemy?.queenTier !== null;
      expect(ants.some(a => a.owner === 'player2' && (a.type === 'queen' || a.type === 'queenLarva'))).toBe(enemyLeader);
      ants.forEach(a => expect(onMap(a.position)).toBe(true));
      Object.values(state.trees).forEach(t => expect(onMap(t.position)).toBe(true));
      Object.values(state.resources).forEach(r => expect(onMap(r.position)).toBe(true));
      // No two things on one hex
      const keys = ants.map(a => `${a.position.q},${a.position.r}`);
      expect(new Set(keys).size).toBe(keys.length);
      if (level.map?.layout && enemyLeader) {
        const p1 = ants.find(a => a.owner === 'player1' && (a.type === 'queen' || a.type === 'queenLarva'));
        const p2 = ants.find(a => a.owner === 'player2' && (a.type === 'queen' || a.type === 'queenLarva'));
        const apart = hexDistance(p1.position, p2.position);
        // Levels 1-2 were tuned at six hexes apart; later maps set their own distance
        if (level.id <= 2) expect(apart).toBe(6);
        else expect(apart).toBeGreaterThanOrEqual(4);
      }
    });
  });

  test('normal games are untouched by the mask branch', () => {
    const state = createInitialGameState();
    expect(state.mapHexes).toBeUndefined();
    expect(typeof state.mapShape).toBe('string');
    expect(isValidHex({ q: 0, r: 0 }, state.gridRadius, state.mapShape)).toBe(true);
  });
});

describe('non-campaign games are untouched', () => {
  test('endTurn adds no campaign slice and never ends the game on objectives', () => {
    const state = fullRound(createInitialGameState());
    expect(state.campaign).toBeUndefined();
    expect(state.gameOver).toBe(false);
  });
});

describe('level 3 - lose no more than 1 egg', () => {
  test('the goal fails on the second destroyed egg, and never blocks the win', () => {
    const level = getLevel(3);
    expect(level.objectives.map(o => o.type)).toEqual(['hatch', 'survive', 'loseAtMost']);
    const state = buildCampaignGameState(level);
    const withLost = n => ({ ...state, stats: { ...state.stats, player1: { ...state.stats.player1, eggsLost: n } } });
    const goal = state.campaign.objectives.find(o => o.type === 'loseAtMost');
    expect(evaluateAllObjectives(withLost(0)).objectives.find(o => o.type === 'loseAtMost').status).toBe('pending');
    expect(evaluateAllObjectives(withLost(1)).lost).toBe(false);
    expect(evaluateAllObjectives(withLost(2)).lost).toBe(true);
    expect(goal.text).toBe('Lose no more than 1 egg');
  });

  test('destroying an egg counts it against its owner', () => {
    const { attackEgg } = require('../combatSystem');
    const state = buildCampaignGameState(getLevel(3));
    const egg = { id: 'test_egg', antType: 'scout', owner: 'player1', position: { q: 0, r: 0 }, health: 1, maxHealth: 10, turnLaid: 1 };
    const enemy = Object.values(state.ants).find(a => a.owner === 'player2' && a.type === 'scout');
    const s1 = { ...state, eggs: { test_egg: egg }, ants: { ...state.ants, [enemy.id]: { ...enemy, position: { q: 1, r: 0 } } } };
    const after = attackEgg(s1, enemy.id, 'test_egg').gameState;
    expect(after.eggs.test_egg).toBeUndefined();
    expect(after.stats.player1.eggsLost).toBe(1);
  });
});

describe('level 4 - the enemy queen must die too', () => {
  const { ENEMY_QUEEN_ID } = require('./levels');
  const killQueen = (state) => {
    const queen = state.ants[ENEMY_QUEEN_ID];
    const mine = Object.values(state.ants).find(a => a.owner === 'player1' && a.type !== 'queen');
    const spot = getNeighbors(queen.position).find(h => !Object.values(state.ants).some(a => a.position.q === h.q && a.position.r === h.r));
    const s = { ...state, ants: { ...state.ants, [queen.id]: { ...queen, health: 1 }, [mine.id]: { ...mine, position: spot, hasMoved: false, hasAttacked: false } } };
    return resolveCombat(s, mine.id, queen.id).gameState;
  };

  test('killing her early does not end the level while the other goals are open', () => {
    const after = killQueen(buildCampaignGameState(getLevel(4)));
    expect(after.ants[ENEMY_QUEEN_ID]).toBeUndefined();
    expect(after.gameOver).toBeFalsy();
  });

  test('once the other goals are done, killing her wins at once', () => {
    const state = buildCampaignGameState(getLevel(4));
    state.campaign = { ...state.campaign, objectives: state.campaign.objectives.map(o =>
      (o.type === 'gather' || o.type === 'destroyAnthills') ? { ...o, status: 'complete' } : o) };
    const after = killQueen(state);
    expect(after.gameOver).toBe(true);
    expect(after.winner).toBe('player1');
  });
});

describe('level 6 - wave units are not dead before they arrive', () => {
  test('the Bullet Ant count starts at 0 / 4, and killing the first two does not win', () => {
    const { objectiveProgress, evaluateObjective } = require('./objectives');
    const state = buildCampaignGameState(getLevel(6));
    const kill = getLevel(6).objectives.find(o => o.type === 'killUnits');
    expect(objectiveProgress(kill, state)).toBe('0 / 4');
    const placedGone = { ...state, ants: { ...state.ants } };
    delete placedGone.ants.camp_player2_B1;
    delete placedGone.ants.camp_player2_B2;
    expect(objectiveProgress(kill, placedGone)).toBe('2 / 4');
    expect(evaluateObjective(kill, placedGone, 'player1')).not.toBe('complete');
  });
});

describe('victory cutscenes', () => {
  test('every level has an outro whose lines all resolve to text and a portrait', () => {
    const { LEVELS } = require('./levels');
    const { normalizeCutsceneLines } = require('./Cutscene');
    LEVELS.forEach(level => {
      const lines = normalizeCutsceneLines(level.outro);
      expect(lines.length).toBeGreaterThan(0);
      lines.forEach(l => {
        expect(l.text.length).toBeGreaterThan(0);
        expect(l.portrait).toBeTruthy();
      });
    });
  });
});

describe('level 7 - The Long Grass', () => {
  const { evaluateAllObjectives } = require('./objectives');
  const { executeAITurn } = require('../aiController');

  test('fog, an escort, gold goal hexes and Sorlorg\'s hidden guns', () => {
    const level = getLevel(7);
    expect(level.fogOfWar).toBe(true);
    const state = buildCampaignGameState(level);
    expect(state.ants.camp_player1_e1.type).toBe('emissary');
    expect(state.campaign.goalHexes.length).toBe(1); // the Golden Throne
    const theirs = Object.values(state.ants).filter(a => a.owner === 'player2').map(a => a.type).sort();
    const count = t => theirs.filter(x => x === t).length;
    expect([count('bombardier'), count('scout'), count('soldier'), count('bomber')]).toEqual([5, 6, 4, 2]);
    expect(Object.values(state.ants).some(a => a.owner === 'player2' && a.type === 'queen')).toBe(false);
    expect(state.campaign.roster).toEqual([]);
  });

  test('with nobody spotted, only the Scouts move: they patrol, everything else holds', async () => {
    let state = buildCampaignGameState(getLevel(7));
    const where = s => Object.values(s.ants).filter(a => a.owner === 'player2' && a.type !== 'scout').map(a => `${a.id}@${a.position.q},${a.position.r}`).sort();
    const before = where(state);
    state = endTurn(state).gameState;
    const res = await executeAITurn(state, 'player2', 'medium', { fogOfWar: true });
    expect(where(res.gameState)).toEqual(before);
    const scoutsMoved = Object.values(res.gameState.ants).filter(a => a.type === 'scout' && a.owner === 'player2' && !a.hunter && (a.position.q !== a.post.q || a.position.r !== a.post.r));
    expect(scoutsMoved.length).toBeGreaterThan(0);
  }, 60000);

  test('when one of your units is spotted, the nearest Marauder goes after it; Bombardiers stay put', async () => {
    let state = buildCampaignGameState(getLevel(7));
    const guard = Object.values(state.ants).find(a => a.owner === 'player2' && a.type === 'soldier');
    const bombs = Object.values(state.ants).filter(a => a.owner === 'player2' && a.type === 'bombardier');
    // Drop one of your Marauders 3 hexes from the guard, in the open
    const mine = Object.values(state.ants).find(a => a.owner === 'player1' && a.type === 'soldier');
    const { hexesInRange, hexDistance, isValidHex } = require('../hexUtils');
    const spot = hexesInRange(guard.position, 3).find(h => hexDistance(h, guard.position) === 3 &&
      isValidHex(h, state.gridRadius, state.mapShape) && !Object.values(state.ants).some(a => a.position.q === h.q && a.position.r === h.r) &&
      !Object.values(state.trees).some(t => t.position.q === h.q && t.position.r === h.r));
    state = { ...state, ants: { ...state.ants, [mine.id]: { ...mine, position: { q: spot.q, r: spot.r } } } };
    state = endTurn(state).gameState;
    const res = await executeAITurn(state, 'player2', 'medium', { fogOfWar: false });
    const after = res.gameState.ants[guard.id];
    const engaged = !after || hexDistance(after.position, guard.position) > 0 || res.combatActions.some(c => c.attackerId === guard.id);
    expect(engaged).toBe(true);
    bombs.forEach(b => { const now = res.gameState.ants[b.id]; if (now) expect(now.position).toEqual(b.position); });
  }, 60000);

  test('level 7 speed score starts at 600', () => {
    const state = buildCampaignGameState(getLevel(7));
    expect(scoreLevel({ ...state, gameOver: true, winner: 'player1', turn: 10 }).speedScore).toBe(400);
  });

  test('the hunter-killer team sleeps until the halfway event, then goes for the Emissary', async () => {
    let state = buildCampaignGameState(getLevel(7));
    const hunters = Object.values(state.ants).filter(a => a.hunter);
    expect(hunters.map(h => h.type).sort()).toEqual(['bomber', 'bomber', 'scout', 'scout']);
    expect(hunters.every(h => h.dormant)).toBe(true);
    expect(state.campaign.midEvent).toEqual({ escortId: 'camp_player1_e1', done: false });
    const where = s => Object.fromEntries(hunters.map(h => [h.id, s.ants[h.id] && s.ants[h.id].position]));
    // Asleep: they do not move
    state = endTurn(state).gameState;
    const asleep = await executeAITurn(state, 'player2', 'medium', { fogOfWar: true });
    expect(where(asleep.gameState)).toEqual(where(state));
    // Awake (what App.js does after the cutscene): every hunter closes on the Emissary
    const awake = { ...state, ants: Object.fromEntries(Object.entries(state.ants).map(([id, a]) => [id, a.hunter ? { ...a, dormant: false } : a])),
      campaign: { ...state.campaign, midEvent: { ...state.campaign.midEvent, done: true } } };
    const res = await executeAITurn(awake, 'player2', 'medium', { fogOfWar: true });
    const emissary = state.ants.camp_player1_e1.position;
    hunters.forEach(h => {
      const now = res.gameState.ants[h.id];
      expect(hexDistance(now.position, emissary)).toBeLessThan(hexDistance(h.position, emissary));
    });
  }, 60000);

  test('level 7 has no economy: no resources and no income', () => {
    let state = buildCampaignGameState(getLevel(7));
    expect(state.campaign.noEconomy).toBe(true);
    expect(state.players.player1.resources).toMatchObject({ food: 0, minerals: 0 });
    for (let i = 0; i < 4; i++) state = endTurn(state).gameState;
    expect(state.players.player1.resources).toMatchObject({ food: 0, minerals: 0 });
  });

  test('the halfway column sits in the middle of the map', () => {
    const state = buildCampaignGameState(getLevel(7));
    const qs = state.mapHexes.map(h => h.q);
    expect(state.campaign.halfwayQ).toBe((Math.min(...qs) + Math.max(...qs)) / 2);
    expect(state.ants.camp_player1_e1.position.q).toBeLessThan(state.campaign.halfwayQ);
  });

  test('the Emissary reaching a gold hex wins; losing it loses', () => {
    const state = buildCampaignGameState(getLevel(7));
    const goal = state.campaign.goalHexes[0];
    const arrived = { ...state, ants: { ...state.ants, camp_player1_e1: { ...state.ants.camp_player1_e1, position: { q: goal.q, r: goal.r } } } };
    expect(evaluateAllObjectives(arrived).won).toBe(true);
    const lostIt = { ...state, ants: { ...state.ants } };
    delete lostIt.ants.camp_player1_e1;
    expect(evaluateAllObjectives(lostIt).lost).toBe(true);
  });
});

describe("level 8 - Sorlorg's Eyes", () => {
  const { executeAITurn } = require('../aiController');
  const { HexCoord, hexesInRange } = require('../hexUtils');

  test('three enemy watch-nests, burrowed ambushers and a sleeping raid', () => {
    const state = buildCampaignGameState(getLevel(8));
    const nests = Object.values(state.anthills).filter(h => h.owner === 'player2');
    expect(nests).toHaveLength(3);
    expect(nests.every(h => h.isComplete)).toBe(true);
    const enemy = Object.values(state.ants).filter(a => a.owner === 'player2');
    expect(enemy.filter(a => a.isBurrowed).length).toBe(5);
    expect(enemy.filter(a => a.hunter && a.dormant).length).toBe(4);
    expect(state.campaign.huntersWakeTurn).toBe(12);
    expect(state.ants[PLAYER_QUEEN_ID].queenTier).toBe('broodQueen');
  });

  test('a burrowed Marauder stays hidden, then bursts out at a unit 2 hexes away', async () => {
    let state = buildCampaignGameState(getLevel(8));
    const u = state.ants.camp_player2_U1;
    const res1 = await executeAITurn(state, 'player2', 'medium', { fogOfWar: true });
    expect(res1.gameState.ants[u.id].isBurrowed).toBe(true);
    expect(res1.gameState.ants[u.id].position).toEqual(u.position);
    // Put a player Scout 2 hexes from it
    const free = hexesInRange(u.position, 2).find(h => hexDistance(h, u.position) === 2 &&
      isValidHex(h, state.gridRadius, state.mapShape) &&
      !Object.values(state.ants).some(a => a.position.q === h.q && a.position.r === h.r) &&
      !Object.values(state.trees).some(t => t.position.q === h.q && t.position.r === h.r));
    const bait = createAnt('scout', 'player1', new HexCoord(free.q, free.r));
    bait.id = 'bait';
    state = { ...state, ants: { ...state.ants, bait } };
    const res2 = await executeAITurn(state, 'player2', 'medium', { fogOfWar: true });
    const after = res2.gameState.ants[u.id];
    expect(after.isBurrowed).toBe(false);
    const baitAfter = res2.gameState.ants.bait;
    expect(!baitAfter || baitAfter.health < bait.health || hexDistance(after.position, free) <= 1).toBe(true);
  }, 60000);

  test('the raid wakes on round 12 and marches on the queen', async () => {
    let state = buildCampaignGameState(getLevel(8));
    const queen = state.ants[PLAYER_QUEEN_ID].position;
    const raid = Object.values(state.ants).filter(a => a.hunter);
    const asleep = await executeAITurn(state, 'player2', 'medium', { fogOfWar: true });
    raid.forEach(h => expect(asleep.gameState.ants[h.id].position).toEqual(h.position));
    state = { ...state, turn: 12 };
    const awake = await executeAITurn(state, 'player2', 'medium', { fogOfWar: true });
    raid.forEach(h => expect(hexDistance(awake.gameState.ants[h.id].position, queen)).toBeLessThan(hexDistance(h.position, queen)));
  }, 60000);

  test('burning all 3 watch-nests wins', () => {
    const state = buildCampaignGameState(getLevel(8));
    const won = { ...state, stats: { ...state.stats, player1: { ...state.stats.player1, anthillsDestroyed: 3 } } };
    expect(evaluateAllObjectives(won).won).toBe(true);
  });
});
