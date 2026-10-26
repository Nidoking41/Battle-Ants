import { createInitialGameState } from '../gameState';
import { applyMapLayout } from '../campaign/campaignState';
import { HexCoord, hexDistance, isValidHex, isMapWater, cliffAt } from '../hexUtils';

// Hand-drawn 2-player Scrimmage maps, three per map size. Layouts use the
// same ASCII format as the campaign (see campaign/mapLayout.js): '.' ground,
// '~' water, 'T' tree, 'F' food, 'M' minerals, '1' / '2' the two queens, and
// the cliff characters ^ v { } [ ]. Every map is the same when turned upside
// down, so both sides get the same ground.
//
// Alongside these, each size keeps its 'classic' map: the hexagon with the
// lake or river and randomly dealt resources (built by createInitialGameState).

export const CLASSIC_MAP_ID = 'classic';

export const SCRIMMAGE_MAPS = [
  {
    id: 'twin_ponds',
    size: 'small',
    name: 'Twin Ponds',
    description: 'Two ponds split the middle into three paths, with a cliff lookout on each side.',
    layout: [
      '  . . .',
      '   . .',
      '  . 2 T',
      ' . . . .',
      '. F . F .',
      ' . T . T',
      'M . . . .',
      ' ~ ^ M ~',
      'T ~ . ~ T',
      ' ~ M v ~',
      '. . . . M',
      ' T . T .',
      '. F . F .',
      ' . . . .',
      '  T 1 .',
      '   . .',
      '  . . .'
    ]
  },
  {
    id: 'long_hall',
    size: 'small',
    name: 'Long Hall',
    description: 'A long, narrow tunnel. Little room to go around, so every fight is head-on.',
    layout: [
      '. . T',
      ' . .',
      '. 2 .',
      ' . .',
      'F . M',
      ' T .',
      '. T ~',
      ' . F',
      'M . .',
      ' T .',
      '~ . .',
      ' . ^',
      '. . .',
      ' v .',
      '. . ~',
      ' . T',
      '. . M',
      ' F .',
      '~ T .',
      ' . T',
      'M . F',
      ' . .',
      '. 1 .',
      ' . .',
      'T . .'
    ]
  },
  {
    id: 'hourglass',
    size: 'small',
    name: 'Hourglass',
    description: 'Wide nests and a tight waist in the middle, guarded by two cliffs.',
    layout: [
      ' T . . .',
      '. . . T .',
      ' ~ . . .',
      '  M 2 F',
      ' . . . M',
      '  F . .',
      '   . T',
      '  . T .',
      '   ^ .',
      '    .',
      '   . v',
      '  . T .',
      '   T .',
      '  . . F',
      ' M . . .',
      '  F 1 M',
      ' . . . ~',
      '. T . . .',
      ' . . . T'
    ]
  },
  {
    id: 'crossing',
    size: 'medium',
    name: 'River Crossing',
    description: 'A river cuts the map corner to corner. Two fords near the edges.',
    layout: [
      '  . . . T',
      ' . T . . .',
      '. . . . . .',
      ' T . 2 F .',
      '. F . . . .',
      ' ~ . . . M',
      '~ . . T . .',
      ' M ~ F . .',
      '. . ~ . . .',
      ' . ^ ~ v .',
      '. . . ~ . .',
      ' . . F ~ M',
      '. . T . . ~',
      ' M . . . ~',
      '. . . . F .',
      ' . F 1 . T',
      '. . . . . .',
      ' . . . T .',
      '  T . . .'
    ]
  },
  {
    id: 'crater',
    size: 'medium',
    name: 'Crater',
    description: 'A ring of land round a crater lake, with cliffs on the rim.',
    layout: [
      '     .',
      '    . .',
      '   T 2 .',
      '  . . . .',
      ' . . . . .',
      '. F M T F .',
      ' . . ^ . .',
      '. . . . . .',
      ' . } ~ M T',
      'T . ~ ~ . .',
      ' F . ~ . F',
      '. . ~ ~ . T',
      ' T M ~ [ .',
      '. . . . . .',
      ' . . v . .',
      '. F T M F .',
      ' . . . . .',
      '  . . . .',
      '   . 1 T',
      '    . .',
      '     .'
    ]
  },
  {
    id: 'twin_lanes',
    size: 'medium',
    name: 'Twin Lanes',
    description: 'A long lake splits the map into two lanes, with one bridge in the middle.',
    layout: [
      '. . . . .',
      ' . . . .',
      '. T 2 T .',
      ' . . . .',
      '. . . . .',
      ' F M . F',
      'T . ~ . .',
      ' . ~ ~ .',
      '. . ~ . .',
      ' F ~ ~ T',
      '. . ~ M .',
      ' . . . .',
      '. ^ . v .',
      ' . . . .',
      '. M ~ . .',
      ' T ~ ~ F',
      '. . ~ . .',
      ' . ~ ~ .',
      '. . ~ . T',
      ' F . M F',
      '. . . . .',
      ' . . . .',
      '. T 1 T .',
      ' . . . .',
      '. . . . .'
    ]
  },
  {
    id: 'great_lake',
    size: 'large',
    name: 'Great Lake',
    description: 'A big lake in the centre. March round the shore and fight for the cliffs.',
    layout: [
      '      .',
      '     . .',
      '    T 2 .',
      '   . . . .',
      '  . . . . .',
      ' T F . T F .',
      '  . . M . .',
      ' ~ . . . . .',
      '. . . M . T .',
      ' ~ ^ . . ^ .',
      '. F . ~ . . .',
      ' . . ~ ~ . F',
      '. . ~ ~ ~ . .',
      ' F . ~ ~ . .',
      '. . . ~ . F .',
      ' . v . . v ~',
      '. T . M . . .',
      ' . . . . . ~',
      '  . . M . .',
      ' . F T . F T',
      '  . . . . .',
      '   . . . .',
      '    . 1 T',
      '     . .',
      '      .'
    ]
  },
  {
    id: 'archipelago',
    size: 'large',
    name: 'Archipelago',
    description: 'Islands joined by thin land bridges. Long walks and easy ambushes.',
    layout: [
      '        ~',
      '       ~ ~',
      '      ~ . ~',
      '     ~ . . ~',
      '      T . .',
      '     ~ . . ~',
      '    ~ . 2 T ~',
      '     . . . .',
      '    ~ . . F ~',
      '     ~ . . ~',
      '    ~ F . .',
      '   ~ . T M ~',
      '  ~ ~ ~ . ~',
      ' ~ . . ~ ~',
      '~ M T ~ .',
      ' . . ~ ~ ~   ~ ~',
      '~ } . ~ F ~ ~ ~',
      ' . F . . . ~ . ~',
      '~ . . . . . . . ~',
      ' ~ . ~ . . . F .',
      '  ~ ~ ~ F ~ . [ ~',
      ' ~ ~   ~ ~ ~ . .',
      '        . ~ T M ~',
      '       ~ ~ . . ~',
      '      ~ . ~ ~ ~',
      '     ~ M T . ~',
      '      . . F ~',
      '     ~ . . ~',
      '    ~ F . . ~',
      '     . . . .',
      '    ~ T 1 . ~',
      '     ~ . . ~',
      '      . . T',
      '     ~ . . ~',
      '      ~ . ~',
      '       ~ ~',
      '        ~'
    ]
  },
  {
    id: 'highlands',
    size: 'large',
    name: 'Highlands',
    description: 'Rolling hills full of cliffs. Hold the high ground to see further.',
    layout: [
      '   . . . .',
      '  . T . . .',
      ' . . . . . .',
      '. . M 2 T . .',
      ' . F . . F .',
      '. . . . . . .',
      ' F . ^ ^ . {',
      '. . . ^ . . .',
      ' . . . F T ~',
      '. ^ T . . M .',
      ' . ~ . . . .',
      '. . . . . . .',
      ' . . . . ~ .',
      '. M . . T v .',
      ' ~ T F . . .',
      '. . . v . . .',
      ' ] . v v . F',
      '. . . . . . .',
      ' . F . . F .',
      '. . T 1 M . .',
      ' . . . . . .',
      '  . . . T .',
      '   . . . .'
    ]
  }
];

const CLASSIC_DESCRIPTIONS = {
  small: 'The original: a hexagon with a lake in the middle and resources dealt at random.',
  medium: 'The original: a hexagon cut by a river with three crossings, resources dealt at random.',
  large: 'The original: a big hexagon cut by a river with three crossings, resources dealt at random.'
};

/** The maps a player can pick for a map size, the classic one first. */
export function getMapsForSize(size) {
  return [
    { id: CLASSIC_MAP_ID, size, name: 'Classic', description: CLASSIC_DESCRIPTIONS[size] || CLASSIC_DESCRIPTIONS.large, layout: null },
    ...SCRIMMAGE_MAPS.filter(m => m.size === size)
  ];
}

export function getScrimmageMap(id) {
  return SCRIMMAGE_MAPS.find(m => m.id === id) || null;
}

/**
 * createInitialGameState plus the chosen map: options.mapId picks one of the
 * hand-drawn maps above (2-player games only). Anything else is the classic
 * map for options.mapSize.
 */
export function createScrimmageGameState(options = {}) {
  const map = getScrimmageMap(options.mapId);
  if (!map || (options.playerCount && options.playerCount !== 2)) {
    return assignPermanentNodes(createInitialGameState(options));
  }
  const state = createInitialGameState({ ...options, playerCount: 2, mapSize: map.size, river: false });
  applyMapLayout(state, map.layout);
  state.mapId = map.id;
  state.mapName = map.name;
  return assignPermanentNodes(state);
}

export const PERMANENT_PER_SIDE = 2; // Honeypots and Mines each, per player

/**
 * Every Scrimmage and multiplayer map: each player's side gets 2 Honeypots
 * (food) and 2 Mines (minerals) - the nodes of each type nearest that queen -
 * and every other node stays the normal kind that runs out. A side left with
 * no normal node of a type gets one added (mirrored for the other player on a
 * 2-player map), so there is always something to use up and respawn.
 */
export function assignPermanentNodes(state) {
  const queens = Object.values(state.ants).filter(a => a.type === 'queen');
  if (queens.length === 0) return state;
  const resources = { ...state.resources };
  // Which queen a hex belongs to: the nearest one, measured straight across
  // the board (hex steps tie too often); an exact tie goes to neither
  const px = h => [1.5 * h.q, Math.sqrt(3) * (h.r + h.q / 2)];
  const ownerOf = pos => {
    const [x, y] = px(pos);
    // straight-line distance first, then rows apart (r) to settle a hex on the middle line
    const d = queens.map(q => { const [qx, qy] = px(q.position); return Math.round(((qx - x) ** 2 + (qy - y) ** 2) * 1000) * 100 + Math.abs(q.position.r - pos.r); });
    const best = Math.min(...d);
    return d.filter(x2 => x2 === best).length === 1 ? queens[d.indexOf(best)] : null;
  };
  queens.forEach(queen => {
    ['food', 'minerals'].forEach(type => {
      Object.values(resources)
        .filter(r => r.type === type && ownerOf(r.position) === queen)
        .sort((a, b) => hexDistance(a.position, queen.position) - hexDistance(b.position, queen.position) ||
          a.position.q - b.position.q || a.position.r - b.position.r)
        .slice(0, PERMANENT_PER_SIDE)
        .forEach(r => { resources[r.id] = { ...r, permanent: true }; });
    });
  });

  // Top up: a side short of Honeypots or Mines gets them added, and a side
  // with no normal node of a type left gets one
  let strict = true;
  const free = h => {
    if (!isValidHex(h, state.gridRadius, state.mapShape) || isMapWater(h, state.gridRadius, state.mapShape)) return false;
    if (cliffAt(h, state.mapShape) !== undefined) return false;
    const taken = [...Object.values(resources), ...Object.values(state.ants), ...Object.values(state.trees || {}), ...Object.values(state.anthills || {})]
      .some(o => o.position.q === h.q && o.position.r === h.r);
    if (taken) return false;
    // never touching another node, and clear of every queen's egg ring
    // (a cramped map may need a second, looser look)
    if (strict && Object.values(resources).some(r => hexDistance(r.position, h) <= 1)) return false;
    return queens.every(q => hexDistance(q.position, h) >= (strict ? 3 : 2));
  };
  let n = 0;
  const add = (type, pos, permanent) => {
    const id = `resource_extra_${++n}`;
    resources[id] = { id, type, position: new HexCoord(pos.q, pos.r), ...(permanent ? { permanent: true } : {}) };
  };
  const count = (queen, type, permanent) => Object.values(resources)
    .filter(r => r.type === type && !!r.permanent === permanent && ownerOf(r.position) === queen).length;
  const twoPlayer = queens.length === 2;
  // Fill a side up to `want` nodes of a kind: Honeypots/Mines close in (3 hexes
  // out), normal nodes a little further (4). On a 2-player map the other side
  // gets the mirror spot, so both stay the same.
  const fill = (type, permanent, want, dist) => {
    queens.forEach((queen, qi) => {
      while (count(queen, type, permanent) < want) {
        const spots = [];
        for (let q = -state.gridRadius - 2; q <= state.gridRadius + 2; q++) {
          for (let r = -state.gridRadius - 2; r <= state.gridRadius + 2; r++) {
            const h = new HexCoord(q, r);
            if (ownerOf(h) === queen && free(h)) spots.push(h);
          }
        }
        if (spots.length === 0) return;
        spots.sort((a, b) => Math.abs(hexDistance(a, queen.position) - dist) - Math.abs(hexDistance(b, queen.position) - dist) ||
          a.q - b.q || a.r - b.r);
        const other = twoPlayer ? queens[1 - qi] : null;
        const mirrored = other && other.position.q === -queen.position.q && other.position.r === -queen.position.r;
        const mirrorOk = h => free({ q: -h.q, r: -h.r }) && ownerOf({ q: -h.q, r: -h.r }) === other;
        const pick = (mirrored && spots.find(mirrorOk)) || spots[0];
        add(type, pick, permanent);
        if (mirrored && mirrorOk(pick) && count(other, type, permanent) < want) add(type, { q: -pick.q, r: -pick.r }, permanent);
      }
    });
  };
  for (const pass of [true, false]) {
    strict = pass;
    ['food', 'minerals'].forEach(type => {
      fill(type, true, PERMANENT_PER_SIDE, 3);
      fill(type, false, 1, 4);
    });
  }
  return { ...state, resources };
}
