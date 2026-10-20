import { createInitialGameState, createAnt } from './gameState';
import { resolveCombat } from './combatSystem';
import { getAntTypeById, isMeleeType } from './antTypes';

// Campaign bugs: the Termite is a slow wall, the Mantis hits from 2 hexes
// but fights as melee (its targets strike back, and ranged shots don't).
const place = (state, ant) => { state.ants[ant.id] = ant; return ant; };
const fresh = () => {
  const s = createInitialGameState({ mapSize: 'small' });
  s.ants = Object.fromEntries(Object.entries(s.ants).filter(([, a]) => a.type === 'queen'));
  return s;
};

test('Termite and Mantis stats', () => {
  expect(getAntTypeById('termite')).toMatchObject({ maxHealth: 90, moveRange: 1, attackRange: 1, large: true });
  expect(getAntTypeById('mantis')).toMatchObject({ attackRange: 2, meleeReach: true, large: true });
  expect(isMeleeType(getAntTypeById('mantis'))).toBe(true);
  expect(isMeleeType(getAntTypeById('spitter'))).toBe(false);
});

test('a Mantis striking from 2 hexes is struck back by melee', () => {
  const s = fresh();
  const mantis = place(s, createAnt('mantis', 'player2', { q: 0, r: 0 }));
  const marauder = place(s, createAnt('soldier', 'player1', { q: 2, r: 0 }));
  const { gameState, damageDealt } = resolveCombat(s, mantis.id, marauder.id);
  expect(gameState.ants[marauder.id]).toBeDefined();
  expect(gameState.ants[mantis.id].health).toBeLessThan(mantis.health); // counter-attack landed
  expect(damageDealt.length).toBe(2);
});

test('a Spitter shooting a Mantis from 2 hexes takes nothing back', () => {
  const s = fresh();
  const mantis = place(s, createAnt('mantis', 'player2', { q: 0, r: 0 }));
  const spitter = place(s, createAnt('spitter', 'player1', { q: 2, r: 0 }));
  const { gameState } = resolveCombat(s, spitter.id, mantis.id);
  expect(gameState.ants[spitter.id].health).toBe(spitter.health);
});
