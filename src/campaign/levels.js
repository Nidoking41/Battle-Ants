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
//   enemy.holdPosition true = guarded positions: Bombardiers never move,
//                      Scouts patrol near their post, and when any of your units
//                      is spotted the nearest Marauder goes after it
//   enemy.aggressive   true = hunting units ignore danger and always press
//                      forward (they never hold back or retreat)
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
//   speedBase          optional: the speed score's starting value (default 500)
//   cameraOnArmy       optional: start the camera centred on your starting units
//                      instead of with the queen near the bottom of the screen
//   midEvent           optional: { escortId, cutscene } - when that unit
//                      crosses the middle of the map the cutscene plays and the
//                      enemy's hunter units (enemy.hunterMarkers in the layout)
//                      wake and go straight for it
//   outro              optional cutscene after a win (same shape as cutscene),
//                      played when leaving the score screen for the next
//                      level or the menu
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
    // Plays after a win, between the score screen and leaving the level
    outro: {
      portrait: 'hero_black.png',
      lines: [
        'The food holds. The scouts that came for her lie still in the grass.',
        'Fed and guarded, the heir sleeps - and in her sleep she begins to change.',
        'Somewhere beyond the ridge, four rivals learn that the larva did not die.'
      ]
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
    // Plays after a win, between the score screen and leaving the level
    outro: {
      portrait: 'hero_black.png',
      lines: [
        'Ten turns, and the nest still stands. The Marauders broke on the trees.',
        { hero: 'gorlak', text: 'A larva held my soldiers off? Then the next ones will not be so polite.' },
        'Vexxara has not moved an inch. She will not need to for much longer: the moult has begun.'
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
    // Plays after a win, between the score screen and leaving the level
    outro: {
      portrait: 'hero_black.png',
      lines: [
        { hero: 'skrazzit', text: 'Four hatched and the nest still standing. Fine. You can lay eggs. Can you feed what hatches?' },
        'Skrazzit pulls back to the ridge, where the minerals are. She means to out-build Vexxara.',
        'A Queen who can lay is a Queen who needs an army. And an army needs minerals.'
      ]
    },
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
        'There are four mineral nodes on this ground, all on the ridge between the nests - and two of them are already hers.',
        { hero: 'skrazzit', text: 'Two hills on the ridge before you have laid an egg. You cannot build what you cannot afford, Lifebinder.' },
        'A hill pays four minerals a turn until the node runs dry. Her hills are targets: an anthill has no armour, and two blows from a Marauder bring one down.',
        'Mine forty minerals, burn two of her hills - and then finish her. Skrazzit dies on this ridge.'
      ]
    },
    briefing: ['Take the ridge. Mine 40 minerals, destroy 2 enemy anthills, and kill Skrazzit\'s queen.'],
    // The Line: a lake fills the middle of the ridge, so there is no straight
    // road - you go round by the left shore or the right. Four mineral nodes
    // in two point-symmetric pairs on the shores, one pair leaning to each
    // nest, so Skrazzit pre-builds on her pair and the player races for
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
    // Plays after a win, between the score screen and leaving the level
    outro: {
      portrait: 'hero_black.png',
      lines: [
        { hero: 'skrazzit', text: 'My hills... my swarm... You were supposed to starve.' },
        'Skrazzit\'s queen falls on the ridge she claimed. The mineral line is hers.',
        { hero: 'gorlak', text: 'The swarm-mother was always soft. Hills and numbers mean nothing when my Marauders arrive.' },
        'Gorlak the Crusher is already marching. She does not believe in armour.'
      ]
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
  // ways. No time limit - the score rewards a quick win. A basic queen throughout, so the roster is the
  // four basic castes only - no Bullet Ant (that is a Swarm Queen unit).
  {
    id: 5,
    name: 'Iron',
    cutscene: {
      portrait: 'hero_black.png',
      lines: [
        { hero: 'gorlak', text: 'Armour is for cowards. My Marauders hit harder than anything you can hatch, and they are coming down both lanes.' },
        'She is not wrong about the hitting. She is wrong about the armour.',
        'Defence takes two off every blow, flat. A Scout that hits for six now hits for four. A Marauder that hits for eleven still lands nine. Armour blanks the weak and shrugs at the strong.',
        'And ranged units are never struck back. A Spitter hitting a Marauder takes nothing in return - and a Marauder hitting a Spitter takes nothing either. Choose your trades.',
        'Kill her queen. The Upgrades button is your first move.'
      ]
    },
    briefing: ['Buy Defence. Trade Spitters into her melee. Kill her queen.'],
    // Two Lanes: a water channel splits the field; she comes down both. Each
    // leader sits on a single hex at the very back of the map.
    map: {
      layout: [
        '     2     ',
        '    . .    ',
        '   . . .   ',
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
        '   . . .   ',
        '    . .    ',
        '     1     '
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
      unitMix: { soldier: 0.7, scout: 0.3 },
      // No head start: she builds her economy like you do. Her edge is the
      // two Marauder waves.
      resources: { food: 10, minerals: 0 },
      units: 'default',
      hunt: true,
      waves: [
        { turn: 4, units: [{ type: 'soldier', count: 2 }] },
        { turn: 8, units: [{ type: 'soldier', count: 2 }] }
      ]
    },
    // Vexxara's queen is a fighter here, not just an egg-layer - and this is
    // the first real fight her hero power charges up in
    uiTips: [
      { target: 'queenAttack', title: 'Your Queen Is a Unit', text: 'Vexxara fights too. Select her, press Attack (A), then click an enemy up to two hexes away. She is tough - use her to hold the line against her Marauders.' },
      { target: 'queenHeal', title: 'Queen: Heal', text: 'Heal (H) restores 15 health to one of your ants near her, using her energy. Vexxara heals for less energy than other queens, but energy also pays for eggs, so choose.' },
      { target: 'heroAbility', title: "Vexxara's Power: Divine Restoration", text: 'Every blow you land fills the bar under Vexxara, and blows you take fill it a little too. When it is full, press Activate Ability: every one of your units heals 15, all energy refills, and your ants hit 10% harder for the turn.' }
    ],
    // Plays after a win, between the score screen and leaving the level
    outro: {
      portrait: 'hero_black.png',
      lines: [
        { hero: 'gorlak', text: 'Armour... Spitters that bite and never get bitten back... That is not fighting. That is cheating.' },
        'Gorlak\'s queen falls between the two lanes. The Crusher is crushed.',
        'And Vexxara grows again: a Brood Queen now, with three new castes at her call.',
        { hero: 'thorgrim', text: 'Clever. But cleverness does not stop a Bullet Ant. Nothing does.' }
      ]
    },
    objectives: [
      { type: 'killUnit', unitId: ENEMY_QUEEN_ID, text: "Kill Gorlak's queen" },
      { type: 'protect', unitId: PLAYER_QUEEN_ID, text: 'Keep the Queen alive' }
    ]
  },

  // ---------------------------------------------------------------------
  // Level 6 - The Broodmother (vs Thorgrim the Mighty)
  // Brood Queen: four spawn spots, Reveal, and her three castes - the Weaver,
  // the Acid Bomber and the Bombardier. Ensnare roots a unit for three turns;
  // heal restores 20 and cleanses. Vexxara's own ability charges on damage
  // dealt and refills every Weaver. Thorgrim is a Swarm Queen, which is what
  // lets her field Bullet Ants.
  {
    id: 6,
    name: 'The Broodmother',
    cutscene: {
      portrait: 'hero_black.png',
      lines: [
        'She grows again. A Brood Queen sees further and commands three new castes: the Weaver, the Acid Bomber and the Bombardier. All three stand with you today.',
        'A Weaver cannot fight. She heals twenty at arm\'s length, and she ensnares - a unit caught in her web cannot move for three turns.',
        { hero: 'thorgrim', text: 'Webs. Healers. My Bullet Ants will walk straight through your little nurses and eat your queen.' },
        'They will, if they reach her. Bullet Ants are a Swarm Queen\'s brood, one growth beyond yours: fifty-five health, twenty-four attack, and they do not stop. Do not let them close. Snare the lead one, pour Spitters into it, heal the line.',
        'A Bombardier shells from three hexes away but cannot fire at anything beside her, or after she moves. An Acid Bomber splashes everything around her target. There is no time to lay - fight with what you have.',
        'And when the bar under Vexxara fills - every blow you land charges it - fire it. Every unit heals, every Weaver refills.',
        'Four Bullet Ants are coming down the corridor. Kill them all.'
      ]
    },
    briefing: ['Ensnare the lead Bullet Ant, focus it with Spitters and Bombardiers, heal the line, fire Vexxara. Kill all four.'],
    // The Gauntlet: one corridor (five hexes wide), trees at intervals, your
    // nest in a bulb at the end.
    map: {
      layout: [
        '    2    ',
        ' . B B . ',
        '. . . . .',
        ' . . . . ',
        '. . T . .',
        ' . . . . ',
        '. . . . .',
        ' . T . . ',
        '. . . . .',
        ' . . . . ',
        '. . . . .',
        ' . . . . ',
        '. . . T .',
        ' . . . . ',
        '. . . . .',
        ' . . . . ',
        '. s s s .',
        ' . w w . ',
        '. b 1 b .',
        ' . x . . ',
        '    .    '
      ],
      legend: { B: 'tank', s: 'spitter', w: 'healer', b: 'bombardier', x: 'bomber' }
    },
    player: {
      hero: 'vexxara',
      queenTier: 'broodQueen',
      // Swarm Queen unlocks nothing on this level, so no upgrade on offer
      queenUpgrades: false,
      // No hatching: the whole fight is the force placed on the map (two
      // Bombardiers and an Acid Bomber on top of the line). The stockpile is
      // for Upgrades - there are no resource nodes in the corridor.
      resources: { food: 60, minerals: 45 },
      roster: [],
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
      aggressive: true,
      waves: [
        { turn: 6, units: [{ type: 'tank', count: 2 }] }
      ]
    },
    // Plays after a win, between the score screen and leaving the level
    outro: {
      portrait: 'hero_black.png',
      lines: [
        { hero: 'thorgrim', text: 'Four of my finest... caught in webs and melted by acid.' },
        'The corridor is quiet. The last Bullet Ant lies where the Weavers caught it.',
        'Three rivals beaten. The throne is closer than it has ever been.',
        'But Sorlorg the Precise has watched every one of these battles - and she has not yet made her move.'
      ]
    },
    objectives: [
      {
        type: 'killUnits',
        unitIds: ['camp_player2_B1', 'camp_player2_B2', 'camp_wave6_tank1', 'camp_wave6_tank2'],
        text: 'Kill all four Bullet Ants'
      },
      { type: 'protect', unitId: PLAYER_QUEEN_ID, text: 'Keep the Queen alive' }
    ]
  },

  // ---------------------------------------------------------------------
  // Level 7 - The Long Grass (vs Sorlorg the Precise)
  // The pheromone link is cut: first level with fog of war. Escort the
  // Queen's Emissary (a crowned Drone) to the gold goal hexes at the far
  // edge. Sorlorg's Bombardiers and Marauders hold still in the fog and fire
  // on anything that comes into range, so scout ahead and use Reveal.
  {
    id: 7,
    name: 'The Long Grass',
    fogOfWar: true,
    speedBase: 600, // a long trek: the speed score starts 100 higher
    cameraOnArmy: true, // open framed on the whole starting force, not just the queen
    cutscene: {
      portrait: 'hero_black.png',
      lines: [
        'The trails have gone quiet. For as long as there has been a colony, every ant has known what every other ant could sense. Now the pheromone link is cut.',
        'Your ants see only what is right in front of them. Beyond that is fog.',
        'Something poisoned the trails, and someone cut what was left. The scouts say the rot leads toward the Throne Mound.',
        'The colony will follow only a true heir. The old queen\'s scent-mark proves it - and the Queen\'s Emissary carries it.',
        { hero: 'sorlorg', text: 'A crown on a Drone. How touching. My Bombardiers are already in the grass, Lifebinder. You will not see them until they fire.' },
        'Bring the Emissary to the gold hexes at the far edge. Scout ahead, light up the grass with Reveal, and keep the Emissary out of reach of what you cannot see.'
      ]
    },
    briefing: ['Get the Queen\'s Emissary to the gold hexes at the far side. Bombardiers hide in the fog: scout ahead and use Reveal.'],
    // The Long Grass: a long, wide S-shaped trail running left to right, with a pond in each bend. Sorlorg's
    // Bombardiers (B) spread through it, two Marauders (R) on guard, and
    // Scouts (S) as spotters: with fog on, the enemy only fires at what its
    // own units can see, and a Bombardier sees only 2 of its 3 hexes of range.
    // Your nest is at the left end, the goal column (G) at the right.
    map: {
      layout: [
        '                               . . .',
        '                              . . . T',
        '                           . . . . . . T',
        '                          . . . . . R . .',
        '                         T B . B . . . . .',
        '                          . . . . . . . .',
        '                         . . . . . . T . .',
        '                        . . . S ~ ~ . . . .',
        '                       . . T T . . . S . X G',
        '.                     . . . R . . . . . . K G',
        ' .                   . . . . . . . . . . . G',
        '. .                 T R . . . . . . . B . . G',
        ' . .               T . . . T . . . . . . X G',
        '. . .             . . . T . .         . . . G',
        ' . . .           . . . S . T           T T G',
        '. . . .         . . . . B .             T . G',
        ' 1 . . . . . . T . . . . .               . G',
        '. . . . . T . T B . T . .                 K G',
        ' . w a . . T . . . . . .                   G',
        '. . m . s . . . T . T T                     G',
        ' . . . . . . . T ~ . .',
        '  . . e . . . . . . .',
        '   . a . . . R S . .',
        '    m . . . . . . .',
        '   . . . . . . ~ . .',
        '    . . s . . . . T',
        '     . . . . . . .',
        '        . . . .',
        '         . . .'
      ],
      legend: { e: 'emissary', s: 'scout', m: 'soldier', a: 'spitter', w: 'healer', B: 'bombardier', R: 'soldier', S: 'scout', X: 'bomber', K: 'scout' }
    },
    player: {
      hero: 'vexxara',
      queenTier: 'broodQueen',
      queenUpgrades: false,
      // A fixed force: no hatching. The stockpile is for Upgrades.
      resources: { food: 40, minerals: 30 },
      roster: [],
      units: []
    },
    enemy: {
      hero: 'sorlorg',
      queenTier: null, // Sorlorg herself is not here - only her hidden guns
      behavior: 'ai',
      aiDifficulty: 'medium',
      holdPosition: true,
      // X and K: the hunter-killer team, asleep at the far end until midEvent
      hunterMarkers: ['X', 'K'],
      unitMix: {},
      resources: { food: 0, minerals: 0 },
      units: []
    },
    // When the Emissary passes the middle of the map: Sorlorg loses patience
    // and wakes her hunter-killer team (2 Acid Bombers, 2 Scouts), who go
    // straight for the Emissary
    midEvent: {
      escortId: 'camp_player1_e1',
      cutscene: {
        portrait: 'hero_black.png',
        lines: [
          { hero: 'sorlorg', text: 'Halfway? My guns were meant to finish this in the grass.' },
          { hero: 'sorlorg', text: 'Fine. I kept something back for exactly this. Hunters - the crowned one. Nothing else matters.' },
          'At the far end of the trail, two Acid Bombers and two Scouts wake - and every one of them is coming for the Emissary.'
        ]
      }
    },
    // Pop-up at the start: the Brood Queen's Reveal
    uiTips: [
      { target: 'queenReveal', title: 'Reveal', text: 'Your Brood Queen can push a pheromone pulse into the fog. Select her, press Reveal, then click any hex: it and the six around it are uncovered for this turn. It costs 20 energy.' }
    ],
    // Plays after a win, between the score screen and leaving the level
    outro: {
      portrait: 'hero_black.png',
      lines: [
        { hero: 'sorlorg', text: 'So the little heir can see in the dark after all. No matter. The mound is not the end of the grass.' },
        'The Emissary reaches the Throne Mound. The colony smells the old queen\'s mark - and, for the first time, kneels to Vexxara.',
        'But the Bombardiers were Sorlorg\'s, and Sorlorg was not among them. Her hunting grounds lie further on, deeper in the fog.'
      ]
    },
    objectives: [
      { type: 'reachHex', unitId: 'camp_player1_e1', at: 'goal', text: 'Bring the Emissary to the gold hexes' },
      { type: 'protect', unitId: 'camp_player1_e1', text: 'Keep the Emissary alive' },
      { type: 'protect', unitId: PLAYER_QUEEN_ID, text: 'Keep the Queen alive' }
    ]
  }
];

export function getLevel(id) {
  return LEVELS.find(l => l.id === id) || null;
}
