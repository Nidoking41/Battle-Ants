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
//   player.units       pre-placed units in addition to the queen, or 'default'
//                      to keep the standard opening (2 drones + 1 scout)
//   enemy.behavior     'ai' runs the normal AI at enemy.aiDifficulty;
//                      'passive' ends the enemy turn without acting
//   enemy.hunt         true = enemy combat units march straight for the
//                      player's Queen Larva instead of guarding home first
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
    briefing: [
      'The old queen is gone. Her last larva is all that remains of the royal line.',
      'She cannot move, and she cannot lay eggs - the soldiers you have are the soldiers you get.',
      'Marauders fight up close. Acid Spitters strike from two hexes away. Keep the spitter behind the line.',
      'The enemy knows she is here, and they are coming for her. Survive 8 turns. If the larva dies, the colony dies with her.'
    ],
    map: { mapSize: 'small' },
    player: {
      queenTier: 'larva',
      resources: { food: 10, minerals: 0 },
      roster: [],
      units: 'default',
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
      ]
    },
    objectives: [
      { type: 'survive', untilTurn: 8, text: 'Survive 8 turns' },
      { type: 'protect', unitId: PLAYER_LARVA_ID, text: 'Keep the Queen Larva alive' }
    ]
  }
];

export function getLevel(id) {
  return LEVELS.find(l => l.id === id) || null;
}
