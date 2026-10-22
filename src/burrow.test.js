import { createInitialGameState, createAnt } from './gameState';
import { resolveCombat, calculateDamage, isHiddenBurrowedMarauder } from './combatSystem';
import { HexCoord } from './hexUtils';

// A burrowed Marauder (player1) next to an enemy Marauder (player2)
function setup(withScout) {
  const base = createInitialGameState({ playerCount: 2, mapSize: 'small' });
  const lurker = { ...createAnt('soldier', 'player1', new HexCoord(0, 0)), id: 'lurker', isBurrowed: true };
  const foe = { ...createAnt('soldier', 'player2', new HexCoord(1, 0)), id: 'foe' };
  const ants = { lurker, foe };
  if (withScout) ants.spotter = { ...createAnt('scout', 'player2', new HexCoord(2, 0)), id: 'spotter' };
  return { ...base, ants, anthills: {} };
}

describe('burrowed Marauders', () => {
  test('undetected, it strikes without being hit back', () => {
    const s = setup(false);
    expect(isHiddenBurrowedMarauder(s, s.ants.lurker, 'player2')).toBe(true);
    const r = resolveCombat(s, 'lurker', 'foe');
    expect(r.gameState.ants.lurker.health).toBe(s.ants.lurker.health);
    expect(r.gameState.ants.foe.health).toBeLessThan(s.ants.foe.health);
  });

  test('detected by a Scout, it is hit back - and takes 25% more', () => {
    const s = setup(true);
    expect(isHiddenBurrowedMarauder(s, s.ants.lurker, 'player2')).toBe(false);
    const r = resolveCombat(s, 'lurker', 'foe');
    expect(r.gameState.ants.lurker.health).toBeLessThan(s.ants.lurker.health);
    const normal = calculateDamage(s.ants.foe, { ...s.ants.lurker, isBurrowed: false }, s);
    const burrowed = calculateDamage(s.ants.foe, s.ants.lurker, s);
    expect(burrowed).toBe(Math.max(1, Math.floor(normal * 1.25)));
    expect(burrowed).toBeGreaterThan(normal);
  });
});
