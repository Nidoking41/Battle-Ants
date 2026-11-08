import { createInitialGameState, createAnt, endTurn } from './gameState';
import { resolveCombat } from './combatSystem';
import { HexCoord } from './hexUtils';

test('a skeleton appears when an ant dies and is cleared when the turn passes', () => {
  const base = createInitialGameState({ playerCount: 2, mapSize: 'small' });
  const attacker = { ...createAnt('soldier', 'player1', new HexCoord(0, 0)), id: 'a' };
  const victim = { ...createAnt('drone', 'player2', new HexCoord(1, 0)), id: 'v', health: 1 };
  const state = { ...base, currentPlayer: 'player1', ants: { a: attacker, v: victim }, anthills: {} };
  const after = resolveCombat(state, 'a', 'v').gameState;
  expect(after.ants.v).toBeUndefined();
  expect(Object.values(after.deadAnts)).toHaveLength(1);
  expect(endTurn(after).gameState.deadAnts).toEqual({});
});
