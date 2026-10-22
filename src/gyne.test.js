import { createInitialGameState, createAnt, deployEmissary, canDeployEmissary, getSpawningPoolHexes } from './gameState';
import { buildCampaignGameState } from './campaign/campaignState';
import { getLevel } from './campaign/levels';
import { getNeighbors, HexCoord } from './hexUtils';
import { getAntTypeById } from './antTypes';

describe('Emissary deploys into a Gyne', () => {
  test('deploying swaps the Emissary for a 30-health Gyne with 2 egg spots', () => {
    const base = createInitialGameState({ playerCount: 2, mapSize: 'small' });
    const e = { ...createAnt('emissary', 'player1', new HexCoord(0, 3)), id: 'e1' }; // off the small map's centre lake
    const s = deployEmissary({ ...base, ants: { ...base.ants, e1: e } }, 'e1');
    expect(s.ants.e1).toBeUndefined();
    const g = s.ants.gyne_e1;
    expect(g.type).toBe('gyne');
    expect(g.health).toBe(30);
    expect(g.position).toEqual(e.position);
    expect(getSpawningPoolHexes(g, getNeighbors, s)).toHaveLength(2);
    const t = getAntTypeById('gyne');
    expect([t.attack, t.moveRange]).toEqual([0, 0]);
  });

  test('the Emissary is buildable from level 8, and level 7\'s escort cannot deploy', () => {
    expect(getAntTypeById('emissary').cost.food).toBeLessThan(100);
    expect(getLevel(8).player.roster).toContain('emissary');
    const l7 = buildCampaignGameState(getLevel(7));
    expect(canDeployEmissary(l7, l7.ants.camp_player1_e1)).toBe(false);
    const l8 = buildCampaignGameState(getLevel(8));
    const e = { ...createAnt('emissary', 'player1', new HexCoord(0, 0)), id: 'e1' };
    expect(canDeployEmissary(l8, e)).toBe(true);
  });
});
