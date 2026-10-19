import { createInitialGameState, createAnt, markAntMoved } from './gameState';
import { moveAnt, canAttack } from './combatSystem';
import { getNeighbors } from './hexUtils';

// A Bombardier cannot move and shoot in one turn, so moving ends her turn.
test('a Bombardier goes dormant once it has moved', () => {
  const state = createInitialGameState({ mapSize: 'small' });
  const queen = Object.values(state.ants).find(a => a.owner === 'player1' && a.type === 'queen');
  const free = h => !Object.values(state.ants).some(a => a.position.q === h.q && a.position.r === h.r);
  const start = getNeighbors(queen.position).filter(free)[0];
  const bomb = createAnt('bombardier', 'player1', start);
  state.ants[bomb.id] = bomb;
  const dest = getNeighbors(start).filter(free).find(h => !(h.q === start.q && h.r === start.r));
  const moved = markAntMoved(moveAnt(state, bomb.id, dest), bomb.id);
  expect(moved.ants[bomb.id].position).toEqual(dest);
  expect(moved.ants[bomb.id].hasAttacked).toBe(true);
  // Other units are unaffected
  const scout = Object.values(state.ants).find(a => a.owner === 'player1' && a.type === 'scout');
  const scoutDest = getNeighbors(scout.position).filter(free)[0];
  expect(moveAnt(state, scout.id, scoutDest).ants[scout.id].hasAttacked).toBeFalsy();
});
