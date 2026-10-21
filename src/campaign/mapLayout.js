import { HexCoord } from '../hexUtils';

// Custom map layouts for campaign levels, authored as ASCII in levels.js.
//
// The board is flat-top: q is the column and each step in q moves right and
// half a row DOWN; r moves straight down. So layouts use "double-height"
// coordinates: a character grid where cell (x, y) is a hex only when x + y is
// even, and
//     q = x
//     r = (y - x) / 2
// Each text row is half a hex tall, which means the art on the page matches
// the map on screen. Neighbours of a cell are (x±1, y±1) and (x, y±2).
//
// Legend:
//   '.'  open hex          ' ' void (not part of the map)
//   '~'  water: drawn as a blue hex but NOT part of the map - nothing can
//        enter it, stand on it, or be placed on it
//   'T'  tree              'F' food node       'M' mineral node
//   'G'  goal hex: open ground an escort objective must reach
//   'W'  enemy watch-nest: a finished enemy anthill on a mineral node
//   'P'  wave spawn point: open ground where enemy.waves can arrive (numbered
//        0, 1, 2... in reading order, top row first; a wave picks one with `at`)
//   '1'  player leader     '2' enemy leader
//   a-z  player unit marker, A-Z enemy unit marker - resolved via the level's
//        `legend: { a: 'scout', A: 'soldier' }`
// Any other character is an error, and so is a non-space character on an
// off-grid cell (x + y odd) - that catches art that has slipped a column.

const OPEN = '.';
const VOID = ' ';
const WATER = '~';

export function parseLayout(rows, legend = {}) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('layout: rows must be a non-empty array');

  // Read every cell first, in raw (x, y). The first non-space cell fixes the
  // grid parity - every other cell must sit on the same checkerboard, which
  // is what catches art that has slipped a column.
  const cells = [];
  let parity = null;
  rows.forEach((row, y) => {
    if (row.includes('\t')) throw new Error(`layout: tab character in row ${y}; use spaces`);
    [...row].forEach((ch, x) => {
      if (ch === VOID) return;
      if (parity === null) parity = (x + y) % 2;
      if ((x + y) % 2 !== parity) {
        throw new Error(`layout: '${ch}' at column ${x}, row ${y} is off-grid (x + y must be even)`);
      }
      cells.push({ ch, x, y });
    });
  });
  if (cells.length === 0) throw new Error('layout: no hexes');

  // Recentre so the map sits around (0, 0). The y shift absorbs the parity
  // so that x + y is even afterwards; both shifts are then kept even so every
  // (q, r) stays an integer.
  const xs = cells.map(c => c.x), ys = cells.map(c => c.y);
  const even = n => n - (n % 2);
  const dx = even(Math.round((Math.min(...xs) + Math.max(...xs)) / 2));
  const dy = even(Math.round((Math.min(...ys) + Math.max(...ys)) / 2)) + parity;

  const hexes = {};
  const mapHexes = [];
  const water = [];
  const resources = [];
  const trees = [];
  const leaders = {};
  const units = [];
  const goals = [];
  const watchNests = [];
  const spawns = [];
  let gridRadius = 0;

  cells.forEach(({ ch, x, y }) => {
    const xx = x - dx, yy = y - dy;
    const q = xx;
    const r = (yy - xx) / 2;
    const pos = new HexCoord(q, r);
    const key = `${q},${r}`;
    if (hexes[key]) throw new Error(`layout: duplicate hex at ${key}`);
    gridRadius = Math.max(gridRadius, Math.abs(q), Math.abs(r), Math.abs(q + r));

    // Water is drawn but is not a playable hex: it stays out of the mask.
    if (ch === WATER) { water.push(pos); return; }

    hexes[key] = true;
    mapHexes.push(pos);

    if (ch === OPEN) return;
    if (ch === 'G') { goals.push(pos); return; }
    if (ch === 'P') { spawns.push({ pos, x, y }); return; }
    if (ch === 'T') { trees.push(pos); return; }
    if (ch === 'F') { resources.push({ type: 'food', position: pos }); return; }
    if (ch === 'M') { resources.push({ type: 'minerals', position: pos }); return; }
    if (ch === 'W') { resources.push({ type: 'minerals', position: pos }); watchNests.push(pos); return; }
    if (ch === '1' || ch === '2') {
      const side = ch === '1' ? 'player1' : 'player2';
      if (leaders[side]) throw new Error(`layout: more than one '${ch}' leader marker`);
      leaders[side] = pos;
      return;
    }
    if (/[a-zA-Z]/.test(ch)) {
      const type = legend[ch];
      if (!type) throw new Error(`layout: unit marker '${ch}' has no entry in legend`);
      units.push({ owner: ch === ch.toLowerCase() ? 'player1' : 'player2', type, position: pos, marker: ch });
      return;
    }
    throw new Error(`layout: unknown character '${ch}' at column ${x}, row ${y}`);
  });

  if (!leaders.player1) throw new Error("layout: missing player leader marker '1'");

  return {
    mapShape: { type: 'custom', hexes },
    mapHexes,
    water,
    gridRadius,
    resources,
    trees,
    leaders,
    units,
    goals,
    watchNests,
    // reading order: top row first, then left to right
    spawns: spawns.sort((a, b) => (a.y - b.y) || (a.x - b.x)).map(s => s.pos)
  };
}

/** True when `hex` is inside a parsed layout's mask. */
export function inLayout(layout, hex) {
  return layout.mapShape.hexes[`${hex.q},${hex.r}`] === true;
}
