import { SCRIMMAGE_MAPS, getMapsForSize, createScrimmageGameState } from './scrimmageMaps';
import { parseLayout } from '../campaign/mapLayout';
import { getNeighbors, isValidHex, isCliffEdge, getMovementRange, HexCoord } from '../hexUtils';
import { getVisibleHexes } from '../fogOfWar';
import { createAnt } from '../gameState';
import { canAttack, resolveCombat } from '../combatSystem';

const key = h => `${h.q},${h.r}`;
const NODES_PER_SIDE = { small: { food: 2, minerals: 2 }, medium: { food: 3, minerals: 2 }, large: { food: 4, minerals: 2 } };

// Every hex reachable from `start` on foot, respecting cliff faces
function walkable(layout, start) {
  const seen = new Set([key(start)]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    for (const n of getNeighbors(queue[i])) {
      if (seen.has(key(n)) || !isValidHex(n, layout.gridRadius, layout.mapShape) || isCliffEdge(queue[i], n, layout.mapShape)) continue;
      seen.add(key(n));
      queue.push(n);
    }
  }
  return seen;
}

describe('Scrimmage maps', () => {
  test('three hand-drawn maps per size, plus the classic one', () => {
    ['small', 'medium', 'large'].forEach(size => {
      expect(SCRIMMAGE_MAPS.filter(m => m.size === size)).toHaveLength(3);
      expect(getMapsForSize(size)[0].id).toBe('classic');
    });
  });

  test.each(SCRIMMAGE_MAPS.map(m => [m.id, m]))('%s is fair and fully walkable', (id, map) => {
    const layout = parseLayout(map.layout);
    // the same when turned upside down (round the point between the queens)
    const { player1: a, player2: b } = layout.leaders;
    const flip = h => `${a.q + b.q - h.q},${a.r + b.r - h.r}`;
    const at = new Set(layout.mapHexes.map(key));
    layout.mapHexes.forEach(h => expect(at.has(flip(h))).toBe(true));
    layout.water.forEach(h => expect(layout.water.map(key)).toContain(flip(h)));
    Object.entries(layout.mapShape.cliffs || {}).forEach(([k, ramp]) => {
      const [q, r] = k.split(',').map(Number);
      expect(layout.mapShape.cliffs[flip({ q, r })]).toBe((ramp + 3) % 6);
    });
    // resources: the right number for the size, split evenly
    const want = NODES_PER_SIDE[map.size];
    ['food', 'minerals'].forEach(type => {
      expect(layout.resources.filter(r => r.type === type)).toHaveLength(want[type] * 2);
    });
    // every hex can be walked to from the player's queen
    const reach = walkable(layout, layout.leaders.player1);
    expect(layout.mapHexes.filter(h => !reach.has(key(h)))).toEqual([]);
  });

  test.each(SCRIMMAGE_MAPS.map(m => [m.id]))('%s builds a game with both armies on the map', id => {
    const state = createScrimmageGameState({ mapId: id, mapSize: 'large' });
    expect(state.mapId).toBe(id);
    const ants = Object.values(state.ants);
    expect(ants.filter(a => a.type === 'queen')).toHaveLength(2);
    expect(ants.length).toBe(8); // queen, 2 drones and a scout each
    ants.forEach(a => expect(isValidHex(a.position, state.gridRadius, state.mapShape)).toBe(true));
  });

  test('no mapId (or classic) still makes the classic map', () => {
    expect(createScrimmageGameState({ mapSize: 'small' }).mapShape).toBe('lake');
    expect(createScrimmageGameState({ mapSize: 'medium', mapId: 'classic' }).mapShape).toBe('river');
  });
});

describe('Cliffs', () => {
  // A cliff with its ramp facing north, in the middle of open ground
  const layout = parseLayout([
    '. . . . .',
    ' . . . . ',
    '. . . . .',
    ' . . . . ',
    '. . ^ . .',
    ' . . . . ',
    '. . 1 . .',
    ' . . . . ',
    '. . . . .'
  ]);
  const cliff = Object.keys(layout.mapShape.cliffs).map(k => { const [q, r] = k.split(',').map(Number); return new HexCoord(q, r); })[0];
  const north = new HexCoord(cliff.q, cliff.r - 1);
  const south = new HexCoord(cliff.q, cliff.r + 1);
  const southEast = new HexCoord(cliff.q + 1, cliff.r);
  const northEast = new HexCoord(cliff.q + 1, cliff.r - 1);

  test('the rock face blocks the three southern sides, both ways', () => {
    expect(isCliffEdge(south, cliff, layout.mapShape)).toBe(true);
    expect(isCliffEdge(cliff, south, layout.mapShape)).toBe(true);
    expect(isCliffEdge(southEast, cliff, layout.mapShape)).toBe(true);
    expect(isCliffEdge(north, cliff, layout.mapShape)).toBe(false);
    expect(isCliffEdge(northEast, cliff, layout.mapShape)).toBe(false);
  });

  test('an ant below the face has to walk round to the ramp', () => {
    const oneStep = getMovementRange(south, 1, layout.gridRadius, [], layout.mapShape).map(key);
    expect(oneStep).not.toContain(key(cliff));
    const threeSteps = getMovementRange(south, 3, layout.gridRadius, [], layout.mapShape).map(key);
    expect(threeSteps).toContain(key(cliff)); // round the side and up the ramp
  });

  test('an ant on a cliff sees 1 hex further', () => {
    const state = {
      mapShape: layout.mapShape,
      players: { player1: {} },
      ants: { a: { id: 'a', type: 'drone', owner: 'player1', position: cliff } }
    };
    const seen = getVisibleHexes(state, 'player1');
    expect(seen.has(`${cliff.q},${cliff.r + 2}`)).toBe(true);
    state.ants.a.position = north;
    expect(getVisibleHexes(state, 'player1').has(`${north.q},${north.r + 2}`)).toBe(false);
  });

  const players = {
    player1: { id: 'player1', upgrades: { meleeAttack: 0, rangedAttack: 0, defense: 0 }, resources: {} },
    player2: { id: 'player2', upgrades: { meleeAttack: 0, rangedAttack: 0, defense: 0 }, resources: {} }
  };
  const stats = { player1: {}, player2: {} };
  const battle = (mine, theirs) => {
    const a = { ...createAnt(mine.type, 'player1', mine.at), id: 'a' };
    const b = { ...createAnt(theirs.type, 'player2', theirs.at), id: 'b' };
    return { mapShape: layout.mapShape, gridRadius: layout.gridRadius, players, stats, ants: { a, b }, eggs: {}, anthills: {} };
  };

  test("melee can't bite through a cliff wall, either way", () => {
    const up = battle({ type: 'soldier', at: south }, { type: 'soldier', at: cliff });
    expect(canAttack(up.ants.a, up.ants.b, up)).toBe(false);
    const down = battle({ type: 'soldier', at: cliff }, { type: 'soldier', at: south });
    expect(canAttack(down.ants.a, down.ants.b, down)).toBe(false);
    // from the ramp side it's a normal fight
    const ramp = battle({ type: 'soldier', at: north }, { type: 'soldier', at: cliff });
    expect(canAttack(ramp.ants.a, ramp.ants.b, ramp)).toBe(true);
  });

  test('ranged units shoot over cliff walls, and nobody bites back through one', () => {
    const shot = battle({ type: 'spitter', at: new HexCoord(cliff.q, cliff.r + 2) }, { type: 'soldier', at: cliff });
    expect(canAttack(shot.ants.a, shot.ants.b, shot)).toBe(true);
    const r = resolveCombat(shot, 'a', 'b');
    expect(r.damageDealt).toHaveLength(1);
  });

  test("long-range sight can't see up a cliff through its wall", () => {
    const below = new HexCoord(cliff.q, cliff.r + 2);
    const above = new HexCoord(cliff.q, cliff.r - 2);
    const sees = (type, at) => getVisibleHexes({
      mapShape: layout.mapShape,
      players: { player1: {} },
      ants: { s: { id: 's', type, owner: 'player1', position: at } }
    }, 'player1').has(key(cliff));
    expect(sees('scout', below)).toBe(false); // the rock face is in the way
    expect(sees('scout', above)).toBe(true);  // looking from the ramp side
    expect(sees('drone', south)).toBe(true);  // right next to it, it still sees
  });
});
