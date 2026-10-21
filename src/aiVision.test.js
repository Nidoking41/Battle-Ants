import { createInitialGameState, createAnt, endTurn } from './gameState';
import { executeAITurn } from './aiController';

// With fog of war on, the computer may only attack what its own units can
// see: a Bombardier (2-hex sight, 2-3 hex range) needs a spotter for targets 3 away, and a unit
// in a tree is hidden unless an enemy unit stands right next to it.
const setup = () => {
  let s = createInitialGameState({ mapSize: 'large' });
  s.ants = Object.fromEntries(Object.entries(s.ants).filter(([, a]) => a.type === 'queen'));
  s.trees = {};
  s = endTurn(s).gameState; // computer's turn
  return s;
};
const add = (s, type, owner, q, r) => { const a = createAnt(type, owner, { q, r }); a.hasMoved = false; a.hasAttacked = false; s.ants[a.id] = a; return a; };
const quiet = async fn => { const l = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = l; } };

test('under fog a lone Bombardier cannot fire at a target it cannot see', async () => {
  const s = setup();
  s.campaign = { enemyHoldPosition: true };
  const bomb = add(s, 'bombardier', 'player2', 0, 0);
  const target = add(s, 'soldier', 'player1', 3, 0);
  const fogged = await quiet(() => executeAITurn(s, 'player2', 'easy', { fogOfWar: true }));
  expect(fogged.combatActions.some(c => c.attackerId === bomb.id)).toBe(false);
  const clear = await quiet(() => executeAITurn(s, 'player2', 'easy', { fogOfWar: false }));
  expect(clear.combatActions.some(c => c.attackerId === bomb.id)).toBe(true);
  expect(target).toBeDefined();
}, 60000);

test('a Scout spotter lets the Bombardier fire', async () => {
  const s = setup();
  s.campaign = { enemyHoldPosition: true };
  const bomb = add(s, 'bombardier', 'player2', 0, 0);
  add(s, 'scout', 'player2', 1, 0); // sees 2 hexes: covers (3,0)
  add(s, 'soldier', 'player1', 3, 0);
  const res = await quiet(() => executeAITurn(s, 'player2', 'easy', { fogOfWar: true }));
  expect(res.combatActions.some(c => c.attackerId === bomb.id)).toBe(true);
}, 60000);

test('a unit in a tree is hidden from a spotter that is not next to it', async () => {
  const s = setup();
  s.campaign = { enemyHoldPosition: true };
  const bomb = add(s, 'bombardier', 'player2', 0, 0);
  add(s, 'scout', 'player2', 1, 0);
  add(s, 'soldier', 'player1', 3, 0);
  s.trees = { t1: { id: 't1', position: { q: 3, r: 0 } } };
  const res = await quiet(() => executeAITurn(s, 'player2', 'easy', { fogOfWar: true }));
  expect(res.combatActions.some(c => c.attackerId === bomb.id)).toBe(false);
}, 60000);

test('a lone Bombardier sees 2 hexes, so it can fire at a target 2 away', async () => {
  const s = setup();
  s.campaign = { enemyHoldPosition: true };
  const bomb = add(s, 'bombardier', 'player2', 0, 0);
  add(s, 'soldier', 'player1', 2, 0);
  const res = await quiet(() => executeAITurn(s, 'player2', 'easy', { fogOfWar: true }));
  expect(res.combatActions.some(c => c.attackerId === bomb.id)).toBe(true);
}, 60000);
