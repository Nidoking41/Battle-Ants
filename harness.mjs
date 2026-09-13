// Headless AI-vs-passive-player simulator. Usage: node harness.bundle.mjs [difficulty] [turns]
import { createInitialGameState, endTurn } from './src/gameState.js';
import { executeAITurn } from './src/aiController.js';

const difficulty = process.argv[2] || 'medium';
const maxTurns = +(process.argv[3] || 60);
const quiet = !process.env.VERBOSE;
if (quiet) { console.log = () => {}; console.warn = () => {}; }
const out = (...a) => process.stdout.write(a.join(' ') + '\n');

let state = createInitialGameState({ mapSize: 'medium', player2Hero: null });
let attacks = 0, moves = 0, hills = 0, errors = 0;
const start = Date.now();
for (let t = 0; t < maxTurns * 2; t++) {
  if (state.gameOver) break;
  if (state.currentPlayer === 'player1' && process.env.VS) {
    const res = await executeAITurn(state, 'player1', process.env.VS);
    state = res.gameState;
  }
  if (state.currentPlayer === 'player2') {
    const res = await executeAITurn(state, 'player2', difficulty);
    attacks += res.combatActions.length; moves += res.movements.length;
    state = res.gameState;
    // sanity: ghost ants
    for (const [id, a] of Object.entries(state.ants)) {
      if (!a || !a.id || !a.position) { errors++; out(`GHOST ANT under key ${id}: ${JSON.stringify(a)}`); }
    }
  }
  state = endTurn(state).gameState;
  if (state.turn % 10 === 0 && state.currentPlayer === 'player1') {
    const mine = Object.values(state.ants).filter(a => a.owner === 'player2');
    const p1 = Object.values(state.ants).filter(a => a.owner === 'player1');
    const ah = Object.values(state.anthills || {}).filter(h => h.owner === 'player2');
    const q1 = p1.find(a => a.type === 'queen');
    out(`turn ${state.turn}: AI units=${mine.length} [${mine.map(a=>a.type[0]).join('')}] anthills=${ah.length} res=${JSON.stringify(state.players.player2.resources)} | P1 units=${p1.length} queenHP=${q1?.health}`);
  }
}
out(`done: turn ${state.turn} gameOver=${state.gameOver} winner=${state.winner} moves=${moves} attacks=${attacks} ghosts=${errors} (${Date.now()-start}ms)`);
