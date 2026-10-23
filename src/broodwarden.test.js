import { createInitialGameState, createAnt, endTurn, deployEmissary, canDeployEmissary, emissaryDeployBlock, getSpawningPoolHexes } from './gameState';
import { createScrimmageGameState } from './maps/scrimmageMaps';
import { buildCampaignGameState } from './campaign/campaignState';
import { getLevel } from './campaign/levels';
import { getNeighbors, HexCoord } from './hexUtils';
import { getAntTypeById } from './antTypes';

describe('Emissary deploys into a Broodwarden', () => {
  test('deploying makes a cocoon that opens one turn later into a 30-health Broodwarden with 2 egg spots', () => {
    const base = createInitialGameState({ playerCount: 2, mapSize: 'small' });
    const e = { ...createAnt('emissary', 'player1', new HexCoord(0, 3)), id: 'e1' }; // off the small map's centre lake
    let s = deployEmissary({ ...base, turn: 3, ants: { ...base.ants, e1: e } }, 'e1');
    expect(s.ants.e1).toBeUndefined();
    expect(s.ants.cocoon_e1.type).toBe('broodwardenCocoon');
    // Still a cocoon while the round plays out...
    s = endTurn(s).gameState;
    expect(s.ants.cocoon_e1.type).toBe('broodwardenCocoon');
    // ...and open when round 4 begins
    s = endTurn(s).gameState;
    expect(s.turn).toBe(4);
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

  test("can't deploy on or next to a cliff, or next to water", () => {
    const s = createScrimmageGameState({ mapId: 'highlands', heroes: {} });
    const cliffs = Object.keys(s.mapShape.cliffs).map(k => { const [q, r] = k.split(',').map(Number); return new HexCoord(q, r); });
    expect(cliffs.length).toBeGreaterThan(0);
    const onCliff = { ...createAnt('emissary', 'player1', cliffs[0]), id: 'e1' };
    expect(emissaryDeployBlock(s, onCliff.position)).toBe('cliff');
    expect(canDeployEmissary(s, onCliff)).toBe(false);
    expect(canDeployEmissary(s, onCliff, { ignoreGround: true })).toBe(true);
    const nextToCliff = getNeighbors(cliffs[0]).find(h => s.mapHexes.some(m => m.q === h.q && m.r === h.r) && !s.mapShape.cliffs[`${h.q},${h.r}`]);
    expect(emissaryDeployBlock(s, nextToCliff)).toBe('cliff');
    const lake = createScrimmageGameState({ mapId: 'great_lake', heroes: {} });
    const cliffy = h => [h, ...getNeighbors(h)].some(n => (lake.mapShape.cliffs || {})[`${n.q},${n.r}`] !== undefined);
    const shore = lake.mapWater.flatMap(w => getNeighbors(w))
      .find(h => lake.mapHexes.some(m => m.q === h.q && m.r === h.r) && !cliffy(h));
    expect(emissaryDeployBlock(lake, shore)).toBe('water');
  });

  test('deploying clears trees off the future egg spots', () => {
    const base = createInitialGameState({ playerCount: 2, mapSize: 'small' });
    const pos = new HexCoord(0, 3);
    const spots = getSpawningPoolHexes({ type: 'broodwarden', position: pos }, getNeighbors, base);
    const other = getNeighbors(pos).find(h => !spots.some(p => p.q === h.q && p.r === h.r));
    const trees = { t1: { id: 't1', position: spots[0] }, t2: { id: 't2', position: other } };
    const e = { ...createAnt('emissary', 'player1', pos), id: 'e1' };
    const s = deployEmissary({ ...base, turn: 3, trees, ants: { ...base.ants, e1: e } }, 'e1');
    expect(s.trees.t1).toBeUndefined();
    expect(s.trees.t2).toBeDefined();
  });
});
