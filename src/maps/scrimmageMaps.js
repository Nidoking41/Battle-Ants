import { createInitialGameState } from '../gameState';
import { applyMapLayout } from '../campaign/campaignState';

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
      '   . T',
      '  . 2 .',
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
      '  . 1 .',
      '   T .',
      '  . . .'
    ]
  },
  {
    id: 'long_hall',
    size: 'small',
    name: 'Long Hall',
    description: 'A long, narrow tunnel. Little room to go around, so every fight is head-on.',
    layout: [
      '. . .',
      ' . T',
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
      ' T .',
      '. . .'
    ]
  },
  {
    id: 'hourglass',
    size: 'small',
    name: 'Hourglass',
    description: 'Wide nests and a tight waist in the middle, guarded by two cliffs.',
    layout: [
      ' T . . .',
      '. . 2 T .',
      ' ~ . . .',
      '  . . F',
      ' . M . M',
      '  F T .',
      '   . T',
      '  . . .',
      '   ^ .',
      '    .',
      '   . v',
      '  . . .',
      '   T .',
      '  . T F',
      ' M . M .',
      '  F . .',
      ' . . . ~',
      '. T 1 . .',
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
      ' . T 2 . .',
      '. . . . . .',
      ' T . . F .',
      '. F . . . .',
      ' ~ . F . M',
      '~ . . T . .',
      ' M ~ . . .',
      '. . ~ . . .',
      ' . ^ ~ v .',
      '. . . ~ . .',
      ' . . . ~ M',
      '. . T . . ~',
      ' M . F . ~',
      '. . . . F .',
      ' . F . . T',
      '. . . . . .',
      ' . . 1 T .',
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
      ' . . . .'
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
      '  . T 2 . .',
      ' . . . . . .',
      '. . . . T . .',
      ' . F M . F .',
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
      ' . F . M F .',
      '. . T . . . .',
      ' . . . . . .',
      '  . . 1 T .',
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
    return createInitialGameState(options);
  }
  const state = createInitialGameState({ ...options, playerCount: 2, mapSize: map.size, river: false });
  applyMapLayout(state, map.layout);
  state.mapId = map.id;
  state.mapName = map.name;
  return state;
}
