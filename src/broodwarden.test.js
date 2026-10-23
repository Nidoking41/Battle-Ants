import { createInitialGameState, createAnt, endTurn, deployEmissary, canDeployEmissary, getSpawningPoolHexes } from './gameState';
import { buildCampaignGameState } from './campaign/campaignState';
import { getLevel } from './campaign/levels';
import { getNeighbors, HexCoord } from './hexUtils';
import { getAntTypeById } from './antTypes';

describe('Emissary deploys into a Broodwarden', () => {
  test('deploying makes a cocoon that opens two turns later into a 30-health Broodwarden with 2 egg spots', () => {
    const base = createInitialGameState({ playerCount: 2, mapSize: 'small' });
    const e = { ...createAnt('emissary', 'player1', new HexCoord(0, 3)), id: 'e1' }; // off the small map's centre lake
    let s = deployEmissary({ ...base, turn: 3, ants: { ...base.ants, e1: e } }, 'e1');
    expect(s.ants.e1).toBeUndefined();
    expect(s.ants.cocoon_e1.type).toBe('broodwardenCocoon');
    // player1 ends, player2 ends (round 3 over), then round 4
    s = endTurn(endTurn(s).gameState).gameState;
    expect(s.turn).toBe(4);
    expect(s.ants.cocoon_e1.type).toBe('broodwardenCocoon');
    s = endTurn(endTurn(s).gameState).gameState;
    expect(s.turn).toBe(5);
    expect(s.ants.cocoon_e1).toBeUndefined();
    const g = s.ants.broodwarden_e1;
    expect(g.type).toBe('broodwarden');
    expect(g.health).toBe(30);
    expect(g.position).toEqual(e.position);
    expect(getSpawningPoolHexes(g, getNeighbors, s)).toHaveLength(2);
    const t = getAntTypeById('broodwarden');
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
