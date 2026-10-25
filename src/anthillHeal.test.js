import { createInitialGameState, endTurn, createAnt, completeAnthill, createAnthillInProgress } from './gameState';
import { GameConstants } from './antTypes';

// A finished player1 hill with a hurt soldier on it, ready for player1's next turn
function setup({ reinforced = false, gathered = 0 } = {}) {
  const state = createInitialGameState();
  const res = Object.values(state.resources).find(r => r.type === 'food');
  const hill = { ...completeAnthill(createAnthillInProgress(res.id, 'player1', res.position, 'food')), id: 'h1', resourcesGathered: gathered };
  const soldier = { ...createAnt('soldier', 'player1', res.position), id: 's1' };
  soldier.health = 10;
  state.ants = { ...state.ants, s1: soldier };
  state.anthills = { h1: hill };
  if (reinforced) state.players.player1.upgrades = { ...(state.players.player1.upgrades || {}), anthillDurability: 1 };
  return { state, soldier, res };
}
const round = s => endTurn(endTurn(s).gameState).gameState; // player1 -> player2 -> player1

test('a unit on its own anthill heals 5% a turn', () => {
  const { state, soldier } = setup();
  const after = round(state);
  expect(after.ants.s1.health).toBe(10 + Math.ceil(soldier.maxHealth * 0.05));
});

test('Reinforced Anthills make it 10%', () => {
  const { state, soldier } = setup({ reinforced: true });
  const after = round(state);
  expect(after.ants.s1.health).toBe(10 + Math.ceil(soldier.maxHealth * 0.10));
});

test('a used-up anthill stays, makes nothing more, and still heals', () => {
  const { state, res } = setup({ gathered: GameConstants.ANTHILL_TOTAL_YIELD.food - 1 });
  let s = round(state);
  expect(s.anthills.h1).toBeDefined();
  expect(s.anthills.h1.depleted).toBe(true);
  expect(s.resources[res.id]).toBeUndefined(); // the node is used up
  const food = s.players.player1.resources.food;
  const hp = s.ants.s1.health;
  s = round(s);
  expect(s.anthills.h1).toBeDefined();
  expect(s.ants.s1.health).toBeGreaterThan(hp);
  // no income from the empty hill (the queen may still earn some elsewhere)
  const gain = s.players.player1.resources.food - food;
  expect(gain).toBeLessThan(GameConstants.ANTHILL_PASSIVE_INCOME.food + 50);
  expect(s.anthills.h1.resourcesGathered).toBe(state.anthills.h1.resourcesGathered + GameConstants.ANTHILL_PASSIVE_INCOME.food);
});
