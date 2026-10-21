import { createInitialGameState, createAnt } from './gameState';
import { applyFogOfWar } from './fogOfWar';

// A queen's Reveal (the player's revealedHexes for this turn) uncovers enemy
// units hiding in trees and burrowed units; without it they stay hidden.
const setup = () => {
  const s = createInitialGameState({ mapSize: 'large' });
  s.ants = Object.fromEntries(Object.entries(s.ants).filter(([, a]) => a.type === 'queen'));
  s.trees = {};
  return s;
};
const put = (s, type, owner, q, r, extra = {}) => { const a = { ...createAnt(type, owner, { q, r }), ...extra }; s.ants[a.id] = a; return a; };

test('an enemy in a tree inside your sight stays hidden until Revealed', () => {
  const s = setup();
  put(s, 'scout', 'player1', 0, 0);
  const hidden = put(s, 'soldier', 'player2', 2, 0);
  s.trees = { t: { id: 't', position: { q: 2, r: 0 } } };
  expect(applyFogOfWar(s, 'player1').ants[hidden.id]).toBeUndefined();
  s.players.player1 = { ...s.players.player1, revealedHexes: ['2,0'] };
  expect(applyFogOfWar(s, 'player1').ants[hidden.id]).toBeDefined();
});

test('a burrowed enemy in your sight stays hidden until Revealed', () => {
  const s = setup();
  put(s, 'soldier', 'player1', 0, 0);
  const dug = put(s, 'soldier', 'player2', 1, 0, { isBurrowed: true });
  expect(applyFogOfWar(s, 'player1').ants[dug.id]).toBeUndefined();
  s.players.player1 = { ...s.players.player1, revealedHexes: ['1,0'] };
  expect(applyFogOfWar(s, 'player1').ants[dug.id]).toBeDefined();
});
