import { createInitialGameState, createAnt } from './gameState';
import { findAmbushStop } from './combatSystem';
import { HexCoord } from './hexUtils';

const H = (q, r) => new HexCoord(q, r);

// A Marauder walking right along r = 0 runs into a hidden burrowed enemy at (3, 0)
function setup(extra = {}) {
  const base = createInitialGameState({ playerCount: 2, mapSize: 'small' });
  const walker = { ...createAnt('soldier', 'player1', H(0, 0)), id: 'walker' };
  const lurker = { ...createAnt('soldier', 'player2', H(3, 0)), id: 'lurker', isBurrowed: true };
  return { ...base, ants: { walker, lurker, ...extra }, eggs: {}, anthills: {} };
}
const path = [H(0, 0), H(1, 0), H(2, 0), H(3, 0), H(4, 0)];
const end = r => r.path[r.path.length - 1];

describe('ambush stop hex', () => {
  test('stops on the hex just before the hidden enemy', () => {
    const r = findAmbushStop(setup(), 'walker', path, 3);
    expect(end(r)).toEqual(H(2, 0));
    expect(r.adjacent).toBe(true);
  });

  test('a friend on that hex: goes to another open hex beside the enemy, not back to start', () => {
    const friend = { ...createAnt('scout', 'player1', H(2, 0)), id: 'friend' };
    const other = [[H(0, 0), H(1, 0), H(2, 0)], [H(0, 0), H(1, 0), H(2, 1)]];
    const r = findAmbushStop(setup({ friend }), 'walker', path, 3, other);
    expect(end(r)).toEqual(H(2, 1));
    expect(r.adjacent).toBe(true);
  });

  test('no open hex beside the enemy: stops on the furthest free hex of the path', () => {
    const friend = { ...createAnt('scout', 'player1', H(2, 0)), id: 'friend' };
    const r = findAmbushStop(setup({ friend }), 'walker', path, 3, []);
    expect(end(r)).toEqual(H(1, 0));
    expect(r.adjacent).toBe(false);
  });

  test('enemy right next to the start: moves to another open hex beside it if it can', () => {
    const s = setup();
    s.ants.lurker = { ...s.ants.lurker, position: H(1, 0) };
    const other = [[H(0, 0), H(1, -1)]];
    const r = findAmbushStop(s, 'walker', [H(0, 0), H(1, 0), H(2, 0)], 1, other);
    expect(end(r)).toEqual(H(1, -1));
  });
});
