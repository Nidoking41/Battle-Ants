import { createInitialGameState, endTurn } from './gameState';
import { executeAITurn } from './aiController';
import { getNeighbors } from './hexUtils';

const free = (state, hexes) => hexes.find(h => !Object.values(state.ants).some(a => a.position.q === h.q && a.position.r === h.r));

describe('the AI queen fights and heals', () => {
  const setup = () => {
    let state = createInitialGameState({ mapSize: 'small', player1Hero: 'gorlak', player2Hero: 'thorgrim' });
    state = endTurn(state).gameState; // player 2 (AI) to move
    return state;
  };
  const aiQueen = s => Object.values(s.ants).find(a => a.owner === 'player2' && a.type === 'queen');

  test('she attacks an enemy in range', async () => {
    let state = setup();
    const queen = aiQueen(state);
    const scout = Object.values(state.ants).find(a => a.owner === 'player1' && a.type === 'scout');
    const spot = free(state, getNeighbors(queen.position));
    state = { ...state, ants: { ...state.ants, [scout.id]: { ...scout, position: spot } } };
    const res = await executeAITurn(state, 'player2', 'easy');
    const hitScout = !res.gameState.ants[scout.id] || res.gameState.ants[scout.id].health < scout.health;
    expect(hitScout).toBe(true);
    expect(res.combatActions.some(c => c.attackerId === queen.id)).toBe(true);
  }, 60000);

  test('she heals a badly wounded unit near her when nothing is in range', async () => {
    let state = setup();
    const queen = aiQueen(state);
    const drone = Object.values(state.ants).find(a => a.owner === 'player2' && a.type === 'drone');
    state = { ...state, ants: { ...state.ants, [drone.id]: { ...state.ants[drone.id], health: 3 }, [queen.id]: { ...queen, energy: 25 } } };
    const res = await executeAITurn(state, 'player2', 'easy');
    expect(res.gameState.ants[drone.id].health).toBeGreaterThan(3);
  }, 60000);
});
