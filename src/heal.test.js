import { createInitialGameState, endTurn, healAnt } from './gameState';

// A queen heals once a turn (it is her terminal action). The heal count used
// to carry over between turns, which once left heals silently refused for the
// rest of the game - so check it across several turns.
test('a Vexxara queen heals once in every turn, for 7 energy', () => {
  let state = createInitialGameState({ mapSize: 'small', player1Hero: 'vexxara', player2Hero: 'gorlak' });
  const queen = Object.values(state.ants).find(a => a.owner === 'player1' && a.type === 'queen');
  const drone = Object.values(state.ants).find(a => a.owner === 'player1' && a.type === 'drone');
  for (let round = 0; round < 3; round++) {
    state = { ...state, ants: { ...state.ants, [drone.id]: { ...state.ants[drone.id], health: 1 }, [queen.id]: { ...state.ants[queen.id], energy: 25 } } };
    const healed = healAnt(state, queen.id, drone.id);
    expect(healed.ants[drone.id].health).toBeGreaterThan(1);
    expect(healed.ants[queen.id].energy).toBe(18); // 7 energy for Vexxara instead of 10
    // a second heal in the same turn is refused
    const second = { ...healed, ants: { ...healed.ants, [drone.id]: { ...healed.ants[drone.id], health: 1 } } };
    expect(healAnt(second, queen.id, drone.id)).toBe(second);
    state = endTurn(endTurn(healed).gameState).gameState;
  }
});
