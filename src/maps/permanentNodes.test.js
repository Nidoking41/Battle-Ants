import { createScrimmageGameState, PERMANENT_PER_SIDE } from './scrimmageMaps';
import { getMapsForSize } from './scrimmageMaps';
import { hexDistance } from '../hexUtils';

const cases = [];
['small', 'medium', 'large'].forEach(size => getMapsForSize(size).forEach(m => cases.push([m.id, size])));

describe.each(cases)('map %s (%s)', (mapId, mapSize) => {
  test('each side has 2 Honeypots, 2 Mines and at least one normal node of each', () => {
    const state = createScrimmageGameState({ mapId, mapSize });
    const queens = Object.values(state.ants).filter(a => a.type === 'queen');
    expect(queens).toHaveLength(2);
    queens.forEach(queen => {
      const mine = Object.values(state.resources).filter(r => {
        const d = queens.map(q => hexDistance(q.position, r.position));
        const px = h => [1.5 * h.q, Math.sqrt(3) * (h.r + h.q / 2)];
        const e = queens.map(q => { const [a, b] = px(q.position), [c, f] = px(r.position); return Math.round(((a - c) ** 2 + (b - f) ** 2) * 1000) * 100 + Math.abs(q.position.r - r.position.r); });
        return e[queens.indexOf(queen)] < e[1 - queens.indexOf(queen)];
      });
      ['food', 'minerals'].forEach(type => {
        expect(mine.filter(r => r.type === type && r.permanent)).toHaveLength(PERMANENT_PER_SIDE);
        expect(mine.filter(r => r.type === type && !r.permanent).length).toBeGreaterThanOrEqual(1);
      });
    });
  });
});

test('3 and 4 player maps get them too: 2 of each per player', () => {
  [3, 4].forEach(playerCount => {
    const state = createScrimmageGameState({ playerCount, mapShape: playerCount === 3 ? 'triangle' : 'square', mapSize: 'large' });
    ['food', 'minerals'].forEach(type => {
      expect(Object.values(state.resources).filter(r => r.permanent && r.type === type)).toHaveLength(playerCount * PERMANENT_PER_SIDE);
    });
  });
});
