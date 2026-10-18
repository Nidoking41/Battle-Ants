// Campaign level definitions - data only, no logic.
//
// Each level is turned into a playable game state by buildCampaignGameState in
// campaignState.js. Fields:
//
//   map.mapSize        'small' | 'medium' | 'large' (ignored when map.layout is set)
//   map.layout         a hand-drawn map: an array of strings in double-height
//                      form (see mapLayout.js). '.' open, ' ' void, '~' water
//                      (drawn blue, impassable, nothing can be placed on it),
//                      'T' tree, 'F' food, 'M' minerals, '1' player leader, '2' enemy
//                      leader, a-z / A-Z unit markers resolved by map.legend.
//                      Replaces the generated hexagon, nodes, trees and leader
//                      positions entirely; void hexes are impassable.
//   map.legend         { a: 'scout', A: 'soldier' } for layout unit markers
//   map.resourceTypes  node types allowed on the map, e.g. ['food']; omit for both
//   player.roster      unit ids the player may build; null = everything
//   player.queenTier   'queen' (normal), 'larva' (the queen is replaced by a Queen
//                      Larva: immobile, cannot lay eggs, feeds the colony, and
//                      losing her loses the level), or null for no leader at all
//   player.queenUpgrades  false = the queen cannot be upgraded on this level, for
//                      either side (the Queen Upgrade card is hidden)
//   player.resources   starting stockpile
//   player.units       'default' keeps the standard opening (2 drones + 1 scout);
//                      a list of type names swaps those three slot-for-slot,
//                      e.g. ['spitter', 'scout', 'scout']; or explicit
//                      [{ type, at: {q, r} }] placements
//   enemy.behavior     'ai' runs the normal AI at enemy.aiDifficulty;
//                      'passive' ends the enemy turn without acting
//   enemy.hunt         true = enemy combat units march straight for the
//                      player's Queen Larva instead of guarding home first
//   enemy.huntWithScouts  true = scouts join that hunt too (normally scouts
//                      keep scouting). For levels where scouts are the only
//                      fighters the enemy has.
//   enemy.waves        scripted reinforcements: [{ turn, units: [{ type, count }] }],
//                      spawned beside the enemy leader at the start of that round
//   map.trees          extra tree hexes as {dq, dr} offsets from the player's
//                      leader, dr positive = toward the enemy (units standing on
//                      a tree get +1 defence)
//   *.guards           extra units placed at {dq, dr} offsets from that side's
//                      leader; a taken or off-map hex falls back to the
//                      nearest free one
//   uiTips             optional pop-ups at level start that ring a button and
//                      explain it: [{ target, title, text }], target = the
//                      button's data-tip name in App.js
//   cutscene           optional intro shown when the level starts (skipped on
//                      Retry): { portrait: '<file under public/sprites/>', lines: [] }
//   objectives         see objectives.js for the supported types
//
// The player's queen always has the id 'camp_p1_queen' so objectives can
// reference it directly.

export const PLAYER_QUEEN_ID = 'camp_p1_queen';
export const PLAYER_LARVA_ID = 'camp_p1_larva';
export const ENEMY_QUEEN_ID = 'camp_p2_queen';

export const LEVELS = [
  {
    id: 1,
    name: 'First Foraging',
    cutscene: {
      portrait: 'hero_black.png', // Vexxara the Lifebinder
      lines: [
        'The old queen is dead. The throne of the colony stands empty.',
        'This is Vexxara the Lifebinder, her heir. By right, the colony is hers.',
        'But today she is only a larva. Blind, hungry, and unable to move.',
        'And she has rivals. Gorlak, Sorlorg, Skrazzit, Thorgrim: each of them wants the throne, and none of them can hold it while the heir lives. They want her dead before she can moult.',
        'Feed her. Every anthill your drones raise on a food node brings her closer to her first moult.',
        'Defend her. Their scouts are already on the way. Gather the food, and keep her alive.'
      ]
    },
    briefing: [
      'The old queen is dead. Her heir is a larva, her rivals want her dead - and she is hungry.',
      'Worker Drones build anthills on resource nodes. Each anthill pays out every turn until the node runs dry.',
      'Scouts see far and move fast, but they cannot build. Use yours to find the food nodes.',
      'The larva cannot lay eggs: two drones and a scout are all you have. Mine 50 food. Keep her alive.'
    ],
    // The Clearing: a compact diamond (59 hexes, close to the original 61),
    // two food nodes two hexes from each nest and a tree pair screening each
    // side. Leaders six hexes apart, as the original map had.
    map: {
      resourceTypes: ['food'],
      layout: [
        '   . .   ',
        '  . 2 .  ',
        ' . . . . ',
        '. F . F .',
        ' . T T . ',
        '. . . . .',
        ' . . . . ',
        '. . . . .',
        ' . . . . ',
        '. . . . .',
        ' . T T . ',
        '. F . F .',
        ' . . . . ',
        '  . 1 .  ',
        '   . .   '
      ]
    },
    player: {
      queenTier: 'larva',
      resources: { food: 25, minerals: 0 },
      roster: [],
      units: 'default'
    },
    // Light, steady pressure. The map has no minerals, so scouts are the only
    // fighters the enemy can ever have. Left to itself the AI hatched drones
    // with nothing to do and almost never a scout, so after its first scout
    // the player was left alone. Instead:
    //  - unitMix: the enemy only hatches drones (and only while it has a free
    //    node to build on), never scouts of its own;
    //  - waves: one new scout arrives every three rounds;
    //  - hunt + huntWithScouts: every scout goes straight for the larva.
    // A player who builds both anthills promptly wins on about round 8 having
    // had to fight off two or three scouts. One who ignores them loses the
    // larva at about the same time, and the longer the level drags on the more
    // scouts arrive.
    enemy: {
      behavior: 'ai',
      aiDifficulty: 'easy',
      queenTier: 'queen',
      units: 'default',
      unitMix: { drone: 1 },
      hunt: true,
      huntWithScouts: true,
      waves: [
        { turn: 3, units: [{ type: 'scout', count: 1 }] },
        { turn: 6, units: [{ type: 'scout', count: 1 }] },
        { turn: 9, units: [{ type: 'scout', count: 1 }] },
        { turn: 12, units: [{ type: 'scout', count: 1 }] },
        { turn: 15, units: [{ type: 'scout', count: 1 }] },
        { turn: 18, units: [{ type: 'scout', count: 1 }] }
      ]
    },
    // Pop-up pointing at the food node nearest the larva until the first
    // anthill goes down (or the player clicks Got it). Drawn by App.js.
    tutorialTip: {
      resource: 'food',
      title: 'Food',
      text: 'Move a Worker Drone onto this food, then press Build Anthill (B). The anthill mines food for you every turn.'
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
    // The Nest: a narrow arena, leaders six hexes apart, with three trees two
    // hexes in front of the larva - the defensive line the level is about.
    map: {
      layout: [
        '  . .  ',
        ' . 2 . ',
        '. . . .',
        ' F . F ',
        '. . . .',
        ' . . . ',
        '. . . .',
        ' . . . ',
        '. . . .',
        ' . T . ',
        '. T T .',
        ' F . F ',
        '. . . .',
        ' . 1 . ',
        '. . . .',
        ' . . . ',
        '  . .  '
      ]
    },
    player: {
      queenTier: 'larva',
      resources: { food: 10, minerals: 0 },
      roster: [],
      // No drones: nothing to build and no economy to run. Three Spitters (two
      // here, one in the guards below) give real ranged punch and a Scout
      // screens a flank. One of the two original Scouts was swapped for a
      // Spitter after playtesting: played well, the level was only barely winnable.
      units: ['spitter', 'spitter', 'scout'],
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
      // The pressure on this level is the two guards and the two waves below,
      // nothing else, so the AI is held to drones (and only ones it has a use
      // for). Without this it spends its food on scouts - about five over the
      // ten turns - on top of the scripted attack the level was sized for.
      unitMix: { drone: 1 },
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
  },

  // ---------------------------------------------------------------------
  // Level 3 - Moult (vs Skrazzit the Swarm)
  // Vexxara becomes a Queen. Teaches hatching: two spawn spots, 5 energy an
  // egg, hatch times, and that an egg has 10 HP and dies to one blow.
  {
    id: 3,
    name: 'Moult',
    cutscene: {
      portrait: 'hero_black.png',
      lines: [
        'She moults. The larva that could only be fed is a Queen now, and a Queen can lay.',
        'Two spawn spots beside her. Five energy an egg. A Drone hatches at once; a Scout or a Marauder takes a turn.',
        'An egg has ten health. Anything that reaches it kills it. Guard what you lay.',
        { hero: 'skrazzit', text: 'One queen. Two eggs a turn. Adorable. My swarm outnumbers you ten to one, and my scouts are already hungry.' },
        'Hatch four ants and hold the nest for eight turns. And guard your eggs: lose a second one and you lose the nest.'
      ]
    },
    briefing: ['Lay eggs and guard them - lose more than one and the level is lost. Hatch four units. Survive eight turns.'],
    // The Nursery: a diamond with food close to each nest and a mineral node
    // on each side's approach. Leaders seven hexes apart.
    map: {
      layout: [
        '    . .    ',
        '   . 2 .   ',
        '  . . . .  ',
        ' . . . . . ',
        '. . . M . .',
        ' . . . . . ',
        '. F . . F .',
        ' . . . . . ',
        'T . . . . T',
        ' . . . . . ',
        '. F . . F .',
        ' . . . . . ',
        '. . M . . .',
        ' . . . . . ',
        '  . . . .  ',
        '   . 1 .   ',
        '    . .    '
      ]
    },
    player: {
      hero: 'vexxara',
      queenTier: 'queen',
      queenUpgrades: false,
      resources: { food: 25, minerals: 0 },
      roster: ['drone', 'scout', 'soldier'],
      units: 'default'
    },
    enemy: {
      hero: 'skrazzit',
      queenTier: 'queen',
      behavior: 'ai',
      aiDifficulty: 'easy',
      unitMix: { scout: 1 },
      resources: { food: 40, minerals: 0 },
      units: 'default',
      hunt: true,
      waves: [
        { turn: 3, units: [{ type: 'scout', count: 2 }] },
        { turn: 5, units: [{ type: 'scout', count: 2 }] }
      ]
    },
    // Pop-ups at the start, stepped through with Next: each rings a button
    // (by its data-tip name in App.js) and explains it. The queen's buttons
    // only show while she is selected, so App.js selects her for those steps.
    uiTips: [
      { target: 'upgrades', title: 'Upgrades', text: 'Spend food and minerals here on permanent boosts for your whole colony - harder hits, tougher armour and more. Check it whenever you have resources to spare.' },
      { target: 'queenAttack', title: 'Queen: Attack', text: 'Your Queen can fight. Press Attack (A), then click an enemy up to two hexes away. Use it to stop scouts before they reach your eggs.' },
      { target: 'queenHeal', title: 'Queen: Heal', text: 'Heal (H) spends some of her energy to restore a wounded ant near her. Energy also pays for eggs, so choose when to spend it.' }
    ],
    objectives: [
      { type: 'hatch', count: 4, text: 'Hatch 4 ants' },
      { type: 'survive', untilTurn: 8, text: 'Survive 8 turns' },
      // Replaces "Keep the Queen alive": drones and scouts can barely scratch
      // a queen, so that goal never mattered. Skrazzit's scouts go for eggs.
      { type: 'loseAtMost', what: 'eggs', max: 1, text: 'Lose no more than 1 egg' }
    ]
  },

  // ---------------------------------------------------------------------
  // Level 4 - The Mineral Line (vs Skrazzit)
  // Minerals gate every real unit and every upgrade. Anthills run dry, so
  // keep expanding - and two Marauder blows bring down an enemy hill. A basic
  // queen throughout, so the roster is the four basic castes only.
  {
    id: 4,
    name: 'The Mineral Line',
    cutscene: {
      portrait: 'hero_black.png',
      lines: [
        'Food feeds the colony. Minerals build the army. Every Marauder, every Spitter, every upgrade costs them.',
        'There are four mineral nodes on this ground, all on the ridge between the nests - and two of them are already his.',
        { hero: 'skrazzit', text: 'Two hills on the ridge before you have laid an egg. You cannot build what you cannot afford, Lifebinder.' },
        'A hill pays four minerals a turn until the node runs dry. His hills are targets: an anthill has no armour, and two blows from a Marauder bring one down.',
        'Mine forty minerals, burn two of his hills - and then finish him. Skrazzit dies on this ridge.'
      ]
    },
    briefing: ['Take the ridge. Mine 40 minerals, destroy 2 enemy anthills, and kill Skrazzit\'s queen.'],
    // The Line: a lake fills the middle of the ridge, so there is no straight
    // road - you go round by the left shore or the right. Four mineral nodes
    // in two point-symmetric pairs on the shores, one pair leaning to each
    // nest, so Skrazzit pre-builds on his pair and the player races for
    // theirs. Food on the flanks, trees on the banks. Leaders seven apart.
    map: {
      layout: [
        '      . .      ',
        '     . 2 .     ',
        '    . . . .    ',
        '   F . . . F   ',
        '  . . . . . .  ',
        ' . . T ~ T . . ',
        '. . M ~ ~ M . .',
        ' . T ~ ~ ~ T . ',
        '. . . ~ ~ . . .',
        ' . T ~ ~ ~ T . ',
        '. . M ~ ~ M . .',
        ' . . T ~ T . . ',
        '  . . . . . .  ',
        '   F . . . F   ',
        '    . . . .    ',
        '     . 1 .     ',
        '      . .      '
      ]
    },
    player: {
      hero: 'vexxara',
      queenTier: 'queen',
      queenUpgrades: false,
      resources: { food: 30, minerals: 5 },
      roster: ['drone', 'scout', 'soldier', 'spitter'],
      units: 'default'
    },
    enemy: {
      hero: 'skrazzit',
      queenTier: 'queen',
      behavior: 'ai',
      aiDifficulty: 'medium',
      resources: { food: 40, minerals: 20 },
      units: 'default',
      anthills: [{ type: 'minerals', count: 2 }]
    },
    objectives: [
      { type: 'gather', resource: 'minerals', amount: 40, text: 'Mine 40 minerals' },
      { type: 'destroyAnthills', count: 2, text: 'Destroy 2 enemy anthills' },
      // Killing her early does not end the level while the other two goals are
      // still open (see campaignDefersWin in combatSystem.js).
      { type: 'killUnit', unitId: ENEMY_QUEEN_ID, text: "Kill Skrazzit's queen" },
      { type: 'protect', unitId: PLAYER_QUEEN_ID, text: 'Keep the Queen alive' }
    ]
  },

  // ---------------------------------------------------------------------
  // Level 5 - Iron (vs Gorlak the Crusher)
  // Upgrades and the armour math. Defence is +2 flat per tier, so it blanks
  // weak hitters and barely dents strong ones. Melee-vs-ranged is free both
  // ways. First time limit. A basic queen throughout, so the roster is the
  // four basic castes only - no Bullet Ant (that is a Swarm Queen unit).
  {
    id: 5,
    name: 'Iron',
    cutscene: {
      portrait: 'hero_black.png',
      lines: [
        { hero: 'gorlak', text: 'Armour is for cowards. My Marauders hit harder than anything you can hatch, and they are coming down both lanes.' },
        'He is not wrong about the hitting. He is wrong about the armour.',
        'Defence takes two off every blow, flat. A Scout that hits for six now hits for four. A Marauder that hits for eleven still lands nine. Armour blanks the weak and shrugs at the strong.',
        'And ranged units are never struck back. A Spitter hitting a Marauder takes nothing in return - and a Marauder hitting a Spitter takes nothing either. Choose your trades.',
        'Kill his queen inside fourteen turns. The Upgrades button is your first move.'
      ]
    },
    briefing: ['Buy Defence. Trade Spitters into his melee. Kill his queen by turn 14.'],
    // Two Lanes: a water channel splits the field; he comes down both.
    map: {
      layout: [
        '    . .    ',
        '   . 2 .   ',
        '  F . . M  ',
        ' . . ~ . . ',
        '. . . . . .',
        ' . . ~ . . ',
        '. . . . . .',
        ' . . ~ . . ',
        '. . . . . .',
        ' . . ~ . . ',
        '. T . . T .',
        ' . . ~ . . ',
        '  M . . F  ',
        '   . 1 .   ',
        '    . .    '
      ]
    },
    player: {
      hero: 'vexxara',
      queenTier: 'queen',
      queenUpgrades: false,
      resources: { food: 40, minerals: 30 },
      roster: ['drone', 'scout', 'soldier', 'spitter'],
      units: 'default'
    },
    enemy: {
      hero: 'gorlak',
      queenTier: 'queen',
      behavior: 'ai',
      aiDifficulty: 'medium',
      upgrades: { meleeAttack: 2 },
      unitMix: { soldier: 0.7, scout: 0.3 },
      resources: { food: 60, minerals: 30 },
      units: 'default',
      anthills: [{ type: 'minerals', count: 1 }],
      hunt: true,
      waves: [
        { turn: 4, units: [{ type: 'soldier', count: 2 }] },
        { turn: 8, units: [{ type: 'soldier', count: 2 }] }
      ]
    },
    objectives: [
      { type: 'killUnit', unitId: ENEMY_QUEEN_ID, byTurn: 14, text: "Kill Gorlak's queen" },
      { type: 'protect', unitId: PLAYER_QUEEN_ID, text: 'Keep the Queen alive' }
    ]
  },

  // ---------------------------------------------------------------------
  // Level 6 - The Broodmother (vs Thorgrim the Mighty)
  // Brood Queen: four spawn spots, Reveal, and her three castes - the Weaver,
  // the Acid Bomber and the Bombardier. Ensnare roots a unit for three turns;
  // heal restores 20 and cleanses. Vexxara's own ability charges on damage
  // dealt and refills every Weaver. Thorgrim is a Swarm Queen, which is what
  // lets him field Bullet Ants.
  {
    id: 6,
    name: 'The Broodmother',
    cutscene: {
      portrait: 'hero_black.png',
      lines: [
        'She grows again. A Brood Queen lays from four spots, sees further, and hatches three new castes: the Weaver, the Acid Bomber and the Bombardier.',
        'A Weaver cannot fight. She heals twenty at arm\'s length, and she ensnares - a unit caught in her web cannot move for three turns.',
        { hero: 'thorgrim', text: 'Webs. Healers. My Bullet Ants will walk straight through your little nurses and eat your queen.' },
        'They will, if they reach her. Bullet Ants are a Swarm Queen\'s brood, one growth beyond yours: fifty-five health, twenty-four attack, and they do not stop. Do not let them close. Snare the lead one, pour Spitters into it, heal the line.',
        'A Bombardier shells from three hexes away but cannot fire at anything beside her, or after she moves. An Acid Bomber splashes everything around her target. Hatch what the corridor needs.',
        'And when the bar under Vexxara fills - every blow you land charges it - fire it. Every unit heals, every Weaver refills.',
        'Four Bullet Ants are coming down the corridor. Kill them all.'
      ]
    },
    briefing: ['Ensnare the lead Bullet Ant, focus it with Spitters and Bombardiers, heal the line, fire Vexxara. Kill all four.'],
    // The Gauntlet: one corridor, trees at intervals, your nest in a bulb at the end.
    map: {
      layout: [
        '  2  ',
        ' B B ',
        '. . .',
        ' . . ',
        '. T .',
        ' . . ',
        '. . .',
        ' T . ',
        '. . .',
        ' . . ',
        '. . T',
        ' . . ',
        '. . .',
        ' m m ',
        's s s',
        ' w w ',
        '. 1 .',
        ' . . ',
        '  .  '
      ],
      legend: { B: 'tank', m: 'soldier', s: 'spitter', w: 'healer' }
    },
    player: {
      hero: 'vexxara',
      queenTier: 'broodQueen',
      resources: { food: 30, minerals: 20 },
      roster: ['healer', 'bomber', 'bombardier'],
      units: []
    },
    enemy: {
      hero: 'thorgrim',
      queenTier: 'swarmQueen',
      behavior: 'ai',
      aiDifficulty: 'medium',
      unitMix: { tank: 1 },
      resources: { food: 0, minerals: 0 },
      units: [],
      hunt: true,
      waves: [
        { turn: 3, units: [{ type: 'tank', count: 2 }] }
      ]
    },
    objectives: [
      {
        type: 'killUnits',
        unitIds: ['camp_player2_B1', 'camp_player2_B2', 'camp_wave3_tank1', 'camp_wave3_tank2'],
        text: 'Kill all four Bullet Ants'
      },
      { type: 'protect', unitId: PLAYER_QUEEN_ID, text: 'Keep the Queen alive' }
    ]
  }
];

export function getLevel(id) {
  return LEVELS.find(l => l.id === id) || null;
}
