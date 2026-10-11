import { createInitialGameState, endTurn, getSpawningPoolHexes } from './gameState';
import { executeAITurn, anotherDroneIsUseful } from './aiController';
import { buildCampaignGameState } from './campaign/campaignState';
import { getLevel } from './campaign/levels';
import { getNeighbors } from './hexUtils';

const eq = (a, b) => a.q === b.q && a.r === b.r;

describe('the computer player and drones', () => {
  test('another drone is only useful while there is a free node on its own side', () => {
    const state = createInitialGameState({ mapSize: 'small' });
    // Opening: eight nodes on its side, two drones
    expect(anotherDroneIsUseful(state, 'player2')).toBe(true);
    // Take every node away: a new drone would have nothing to build
    expect(anotherDroneIsUseful({ ...state, resources: {} }, 'player2')).toBe(false);
    // Nodes that all have an anthill on them are not free either
    const anthills = {};
    Object.values(state.resources).forEach(n => { anthills[n.id] = { id: n.id, owner: 'player1', position: n.position, isComplete: true, resourceType: n.type }; });
    expect(anotherDroneIsUseful({ ...state, anthills }, 'player2')).toBe(false);
  });

  test('with nothing to build it hatches no extra drones, and idle drones keep off the egg spots', async () => {
    // No resource nodes at all, plenty of food, and a drone parked on an egg spot
    let state = createInitialGameState({ mapSize: 'small' });
    state = { ...state, resources: {}, players: { ...state.players, player2: { ...state.players.player2, resources: { food: 200, minerals: 0 } } } };
    const dronesAtStart = Object.values(state.ants).filter(a => a.owner === 'player2' && a.type === 'drone').length;
    for (let round = 0; round < 6; round++) {
      state = endTurn(state).gameState;                      // player 1 passes
      const res = await executeAITurn(state, 'player2', 'easy');
      const ai = res.gameState;
      const queen = Object.values(ai.ants).find(a => a.owner === 'player2' && a.type === 'queen');
      const spots = getSpawningPoolHexes(queen, getNeighbors);
      const drones = Object.values(ai.ants).filter(a => a.owner === 'player2' && a.type === 'drone');
      drones.forEach(d => expect(spots.some(s => eq(s, d.position))).toBe(false));
      expect(drones.length).toBe(dronesAtStart);
      expect(Object.values(ai.eggs || {}).filter(e => e.owner === 'player2' && e.antType === 'drone')).toHaveLength(0);
      state = endTurn(ai).gameState;
    }
    // ...and with the egg spots clear it spent the food on scouts instead
    expect(Object.values(state.ants).filter(a => a.owner === 'player2' && a.type === 'scout').length).toBeGreaterThan(1);
  }, 60000);
});

describe('campaign level 1 enemy', () => {
  test('keeps to two drones, gets a scout every three rounds, and the scouts go for the larva', async () => {
    let state = buildCampaignGameState(getLevel(1));
    const scoutsSeen = [];
    let larvaHit = false;
    for (let round = 1; round <= 9 && !state.gameOver; round++) {
      state = endTurn(state).gameState;                      // player 1 passes
      if (state.gameOver) break;
      const res = await executeAITurn(state, 'player2', 'easy');
      const ai = res.gameState;
      const p2 = Object.values(ai.ants).filter(a => a.owner === 'player2');
      expect(p2.filter(a => a.type === 'drone').length).toBeLessThanOrEqual(2);
      scoutsSeen.push(p2.filter(a => a.type === 'scout').length);
      const larva = Object.values(ai.ants).find(a => a.type === 'queenLarva');
      if (!larva || larva.health < 20) larvaHit = true;
      state = endTurn(ai).gameState;
    }
    // one scout to start, a second from round 3, a third from round 6 (nobody is killing them here)
    expect(scoutsSeen[0]).toBe(1);
    expect(Math.max(...scoutsSeen)).toBeGreaterThanOrEqual(3);
    expect(larvaHit).toBe(true);
  }, 60000);
});
