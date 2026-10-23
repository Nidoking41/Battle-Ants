import { createInitialGameState, respawnResource } from './gameState';
import { HexCoord, getNeighbors, isValidHex, hexToPixel, getRiverLayout, isOnRiverLine, isNorthOfRiver, isSouthOfRiver, getLakeHexes, getMovementRangeWithPaths } from './hexUtils';
import { executeAITurn } from './aiController';
import { buildCampaignGameState } from './campaign/campaignState';
import { getLevel } from './campaign/levels';

const key = h => `${h.q},${h.r}`;

// Walking distance over terrain only, from one hex to every hex it can reach.
function flood(start, state, extraBlocked = new Set()) {
  const dist = new Map([[key(start), 0]]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    for (const n of getNeighbors(queue[i])) {
      if (dist.has(key(n)) || extraBlocked.has(key(n))) continue;
      if (!isValidHex(n, state.gridRadius, state.mapShape)) continue;
      dist.set(key(n), dist.get(key(queue[i])) + 1);
      queue.push(n);
    }
  }
  return dist;
}

describe.each(['medium', 'large'])('river on a %s 2-player map', (mapSize) => {
  const state = createInitialGameState({ mapSize });
  const R = state.gridRadius;
  const { water, crossings } = getRiverLayout(R);
  const queens = Object.values(state.ants).filter(a => a.type === 'queen');

  test('is a river map with exactly three crossings, the same every game', () => {
    expect(state.mapShape).toBe('river');
    expect(crossings).toHaveLength(3);
    expect(water).toHaveLength(2 * R + 1 - 3);
    const again = getRiverLayout(createInitialGameState({ mapSize }).gridRadius);
    expect(again.water.map(key)).toEqual(water.map(key));
  });

  test('is fair: rotating the map half a turn gives the same river', () => {
    const set = new Set(water.map(key));
    water.forEach(w => expect(set.has(key({ q: -w.q, r: -w.r }))).toBe(true));
  });

  test('water is off the board and crossings are on it', () => {
    water.forEach(w => expect(isValidHex(w, R, state.mapShape)).toBe(false));
    crossings.forEach(c => expect(isValidHex(c, R, state.mapShape)).toBe(true));
  });

  test('runs east to west: one river hex in every column, level across the screen', () => {
    const line = [...water, ...crossings];
    expect(new Set(line.map(h => h.q)).size).toBe(2 * R + 1);
    // On screen no river hex is more than half a hex above or below the middle line.
    const rowHeight = Math.sqrt(3);
    line.forEach(h => expect(Math.abs(hexToPixel(h, 1).y)).toBeLessThanOrEqual(rowHeight / 2 + 1e-9));
    // Each river hex touches the next one, so there are no gaps besides the crossings.
    const sorted = line.slice().sort((a, b) => a.q - b.q);
    for (let i = 1; i < sorted.length; i++) {
      expect(getNeighbors(sorted[i - 1]).some(n => key(n) === key(sorted[i]))).toBe(true);
    }
  });

  test('nothing starts on the river line, and each bank gets the same share', () => {
    const things = [
      ...Object.values(state.ants), ...Object.values(state.resources), ...Object.values(state.trees)
    ];
    things.forEach(t => {
      expect(isOnRiverLine(t.position, R)).toBe(false);
      expect(isValidHex(t.position, R, state.mapShape)).toBe(true);
    });
    const count = (list, type) => {
      const mine = list.filter(x => !type || x.type === type);
      return [mine.filter(x => isNorthOfRiver(x.position)).length, mine.filter(x => isSouthOfRiver(x.position)).length];
    };
    expect(count(Object.values(state.resources), 'food')).toEqual(R === 5 ? [3, 3] : [4, 4]);
    expect(count(Object.values(state.resources), 'minerals')).toEqual([2, 2]);
    const trees = count(Object.values(state.trees));
    expect(trees[0]).toBe(trees[1]);
    // Each queen is on her own bank.
    const north = queens.find(q => q.position.r < 0);
    const south = queens.find(q => q.position.r > 0);
    expect(isNorthOfRiver(north.position)).toBe(true);
    expect(isSouthOfRiver(south.position)).toBe(true);
  });

  test('a used-up resource comes back on the same bank, never in the river', () => {
    for (let i = 0; i < 40; i++) {
      const n = respawnResource(state, 'food', true);
      const s = respawnResource(state, 'food', false);
      expect(isNorthOfRiver(n.position)).toBe(true);
      expect(isSouthOfRiver(s.position)).toBe(true);
    }
  });

  test('the queens can reach each other, but only through a crossing', () => {
    const [a, b] = queens.map(q => new HexCoord(q.position.q, q.position.r));
    expect(flood(a, state).has(key(b))).toBe(true);
    const plugged = new Set(crossings.map(key));
    expect(flood(a, state, plugged).has(key(b))).toBe(false);
  });

  test('a unit next to the water cannot move across it', () => {
    const start = new HexCoord(1, -2); // north bank, directly above the water hex at (1,-1)
    expect(water.some(w => key(w) === '1,-1')).toBe(true);
    const moves = getMovementRangeWithPaths(start, 1, R, [], [], state.mapShape);
    moves.forEach(m => {
      expect(isValidHex(m.hex, R, state.mapShape)).toBe(true);
      expect(isSouthOfRiver(m.hex)).toBe(false);
    });
  });
});

test('water can be switched off, and 3-player and campaign maps have none', () => {
  expect(createInitialGameState({ river: false }).mapShape).toBe('rectangle');
  expect(createInitialGameState({ river: false, mapSize: 'small' }).mapShape).toBe('rectangle');
  expect(createInitialGameState({ playerCount: 3 }).mapShape).toBe('rectangle');
  const campaign = buildCampaignGameState(getLevel(1));
  expect(campaign.mapShape).not.toBe('river');
  expect(campaign.mapShape).not.toBe('lake');
});

describe('lake on the small 2-player map', () => {
  const state = createInitialGameState({ mapSize: 'small' });
  const R = state.gridRadius;
  const lake = getLakeHexes();
  const queens = Object.values(state.ants).filter(a => a.type === 'queen');

  test('is the centre hex plus the ring around it except its top and bottom, the same every game, and there is no river', () => {
    expect(state.mapShape).toBe('lake');
    expect(lake.map(key).sort()).toEqual(['-1,0', '-1,1', '0,0', '1,-1', '1,0'].sort());
    lake.forEach(w => expect(isValidHex(w, R, state.mapShape)).toBe(false));
    getRiverLayout(R).water.filter(w => !lake.some(l => key(l) === key(w)))
      .forEach(w => expect(isValidHex(w, R, state.mapShape)).toBe(true));
  });

  test('nothing starts in the lake, and each half gets the same share', () => {
    for (let i = 0; i < 25; i++) {
      const fresh = createInitialGameState({ mapSize: 'small' });
      const things = [...Object.values(fresh.ants), ...Object.values(fresh.resources), ...Object.values(fresh.trees)];
      things.forEach(t => expect(isValidHex(t.position, R, fresh.mapShape)).toBe(true));
      const res = Object.values(fresh.resources);
      const n = type => res.filter(x => x.type === type && x.position.r < 0).length;
      const so = type => res.filter(x => x.type === type && x.position.r > 0).length;
      expect([n('food'), so('food'), n('minerals'), so('minerals')]).toEqual([2, 2, 2, 2]);
    }
  });

  test('a used-up resource never comes back in the lake', () => {
    for (let i = 0; i < 40; i++) {
      [true, false].forEach(north => {
        const r = respawnResource(state, 'food', north);
        expect(isValidHex(r.position, R, state.mapShape)).toBe(true);
      });
    }
  });

  test('the queens can reach each other round either side of the lake', () => {
    const [a, b] = queens.map(q => new HexCoord(q.position.q, q.position.r));
    expect(flood(a, state).has(key(b))).toBe(true);
    const all = [];
    for (let q = -R; q <= R; q++) for (let r = -R; r <= R; r++) all.push({ q, r });
    const west = new Set(all.filter(h => h.q < 0).map(key));
    const east = new Set(all.filter(h => h.q > 0).map(key));
    expect(flood(a, state, west).has(key(b))).toBe(true);  // west side walled off: go east
    expect(flood(a, state, east).has(key(b))).toBe(true);  // east side walled off: go west
  });

  test('a unit next to the lake cannot step into it', () => {
    const moves = getMovementRangeWithPaths(new HexCoord(0, -2), 2, R, [], [], state.mapShape);
    expect(moves.length).toBeGreaterThan(0);
    moves.forEach(m => expect(lake.some(l => key(l) === key(m.hex))).toBe(false));
  });
});

test('the computer player gets a unit round the lake', async () => {
  let state = createInitialGameState({ mapSize: 'small' });
  const owner = Object.values(state.ants).find(a => a.type === 'queen' && a.position.r < 0).owner;
  // Only the enemy queen is left, so nothing scares the soldier off, and it is past the early-game rally phase.
  Object.values(state.ants).forEach(a => { if (a.owner !== owner && a.type !== 'queen') delete state.ants[a.id]; });
  state.turn = 30;
  // Straight above the lake, with the enemy queen straight below it.
  state.ants.test_soldier = { id: 'test_soldier', type: 'soldier', owner, position: new HexCoord(0, -2), health: 10, maxHealth: 10 };
  let past = false;
  for (let turn = 0; turn < 12 && !past; turn++) {
    state.currentPlayer = owner;
    Object.values(state.ants).forEach(a => { if (a.owner === owner) { a.hasMoved = false; a.hasAttacked = false; } });
    const result = await executeAITurn(state, owner, 'hard');
    state = result.gameState || result.state || result;
    const s = state.ants.test_soldier;
    if (!s) break;
    expect(isValidHex(s.position, state.gridRadius, state.mapShape)).toBe(true);
    if (s.position.r >= 2) past = true;
  }
  expect(past).toBe(true);
}, 60000);

test('the computer player gets units across the river', async () => {
  let state = createInitialGameState({ mapSize: 'medium' });
  // A lone soldier on the north bank, away from the middle crossing, sent after the south queen.
  const south = Object.values(state.ants).find(a => a.type === 'queen' && a.position.r > 0);
  const owner = Object.values(state.ants).find(a => a.type === 'queen' && a.position.r < 0).owner;
  state.ants.test_soldier = { id: 'test_soldier', type: 'soldier', owner, position: new HexCoord(2, -2), health: 10, maxHealth: 10 };
  let crossed = false;
  for (let turn = 0; turn < 12 && !crossed; turn++) {
    state.currentPlayer = owner;
    Object.values(state.ants).forEach(a => { if (a.owner === owner) { a.hasMoved = false; a.hasAttacked = false; } });
    const result = await executeAITurn(state, owner, 'hard');
    state = result.gameState || result.state || result;
    const s = state.ants.test_soldier;
    if (!s) break;
    expect(isValidHex(s.position, state.gridRadius, state.mapShape)).toBe(true);
    if (isSouthOfRiver(s.position)) crossed = true;
  }
  expect(crossed).toBe(true);
  expect(south).toBeDefined();
}, 60000);
