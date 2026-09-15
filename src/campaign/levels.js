// Campaign level definitions - data only, no logic.
//
// Each level is turned into a playable game state by buildCampaignGameState in
// campaignState.js. Fields:
//
//   map.mapSize        'small' | 'medium' | 'large'
//   map.resourceTypes  node types allowed on the map, e.g. ['food']; omit for both
//   player.roster      unit ids the player may build; null = everything
//   player.queenTier   'queen' (normal), 'larva' (the queen is replaced by a Queen
//                      Larva: immobile, cannot lay eggs, feeds the colony, and
//                      losing her loses the level), or null for no leader at all
//   player.resources   starting stockpile
//   player.units       'default' keeps the standard opening (2 drones + 1 scout);
//                      a list of type names swaps those three slot-for-slot,
//                      e.g. ['spitter', 'scout', 'scout']; or explicit
//                      [{ type, at: {q, r} }] placements
//   enemy.behavior     'ai' runs the normal AI at enemy.aiDifficulty;
//                      'passive' ends the enemy turn without acting
//   enemy.hunt         true = enemy combat units march straight for the
//                      player's Queen Larva instead of guarding home first
//   enemy.waves        scripted reinforcements: [{ turn, units: [{ type, count }] }],
//                      spawned beside the enemy leader at the start of that round
//   map.trees          extra tree hexes as {dq, dr} offsets from the player's
//                      leader, dr positive = toward the enemy (units standing on
//                      a tree get +1 defence)
//   *.guards           extra units placed at {dq, dr} offsets from that side's
//                      leader; a taken or off-map hex falls back to the
//                      nearest free one
//   cutscene           optional intro shown when the level starts (skipped on
//                      Retry): { portrait: '<file under public/sprites/>', lines: [] }
//   objectives         see objectives.js for the supported types
//
// The player's queen always has the id 'camp_p1_queen' so objectives can
// reference it directly.

export const PLAYER_QUEEN_ID = 'camp_p1_queen';
export const PLAYER_LARVA_ID = 'camp_p1_larva';

export const LEVELS = [
  {
    id: 1,
    name: 'First Foraging',
    cutscene: {
      portrait: 'hero_black.png', // Vexxara the Lifebinder
      lines: [
        'This is Vexxara the Lifebinder. One day she will be the queen who binds this colony together.',
        'Today she is a larva. Blind, hungry, and unable to move. The old queen is gone, and Vexxara is all we have.',
        'Feed her. Every anthill your drones raise on a food node brings her closer to her first moult.',
        'Defend her. The enemy knows a colony without a queen is a colony that can be ended.',
        'Food is what she needs to grow. Gather it, and keep her alive.'
      ]
    },
    briefing: [
      'The queen is gone. Her larva is all the colony has left - and she is hungry.',
      'Worker Drones build anthills on resource nodes. Each anthill pays out every turn until the node runs dry.',
      'Scouts see far and move fast, but they cannot build. Use yours to find the food nodes.',
      'The larva cannot lay eggs: two drones and a scout are all you have. Mine 50 food. Keep her alive.'
    ],
    map: { mapSize: 'small', resourceTypes: ['food'] },
    player: {
      queenTier: 'larva',
      resources: { food: 25, minerals: 0 },
      roster: [],
      units: 'default'
    },
    enemy: {
      behavior: 'ai',
      aiDifficulty: 'easy',
      queenTier: 'queen',
      units: 'default'
    },
    objectives: [
      { type: 'gather', resource: 'food', amount: 50, text: 'Mine 50 food' },
      { type: 'protect', unitId: PLAYER_LARVA_ID, text: 'Keep the Queen Larva alive' }
    ]
  },

  {
    id: 2,
    name: 'Hold the Nest',
    cutscene: {
      portrait: 'hero_black.png',
      lines: [
        'They are coming. Two Marauders now, and more behind them. The soldiers you have are the soldiers you get.',
        'Three things decide a fight. Strike first: the attacker lands a full blow, and the wounded strike back weaker. Never wait to be hit.',
        'Wounds matter. A unit at half health hits for barely half. Finish what you start, and pull back what is broken.',
        'Ground matters. A unit standing in the trees is harder to hit. There are trees in front of her. Hold them.',
        'And choose your target. Their Acid Spitters bite from two hexes away and cannot be struck back. Kill them first.',
        'Survive ten turns. Keep her alive.'
      ]
    },
    briefing: [
      'Strike first. Finish wounded enemies. Hold the trees. Kill the spitters before anything else.',
      'Reinforcements arrive on turns 3 and 6 - see the objective strip. Survive 10 turns.'
    ],
    map: {
      mapSize: 'small',
      // A defensive line one hex out from the larva, on the enemy's side
      trees: [
        { dq: 0, dr: 2 },
        { dq: 1, dr: 1 },
        { dq: -1, dr: 2 }
      ]
    },
    player: {
      queenTier: 'larva',
      resources: { food: 10, minerals: 0 },
      roster: [],
      // No drones: nothing to build and no economy to run. Two Spitters give
      // real ranged punch and two Scouts screen the flanks.
      units: ['spitter', 'scout', 'scout'],
      // Placed relative to the larva: {dq, dr} offsets from her hex
      guards: [
        { type: 'soldier', offset: { dq: -1, dr: 0 } },
        { type: 'soldier', offset: { dq: -1, dr: 1 } },
        { type: 'spitter', offset: { dq: 0, dr: 1 } }
      ]
    },
    enemy: {
      behavior: 'ai',
      aiDifficulty: 'medium',
      queenTier: 'queen',
      units: 'default',
      hunt: true,
      // Two Marauders from turn 1, on the side facing the player
      guards: [
        { type: 'soldier', offset: { dq: 0, dr: 1 } },
        { type: 'soldier', offset: { dq: -1, dr: 1 } }
      ],
      // The AI's economy cannot field anything in ten turns, so pressure is
      // scripted. Sized so that sitting still and trading blows loses.
      waves: [
        { turn: 3, units: [{ type: 'soldier', count: 1 }, { type: 'spitter', count: 1 }] },
        { turn: 6, units: [{ type: 'soldier', count: 2 }, { type: 'spitter', count: 1 }] }
      ]
    },
    objectives: [
      { type: 'survive', untilTurn: 10, text: 'Survive 10 turns' },
      { type: 'protect', unitId: PLAYER_LARVA_ID, text: 'Keep the Queen Larva alive' }
    ]
  }
];

export function getLevel(id) {
  return LEVELS.find(l => l.id === id) || null;
}
