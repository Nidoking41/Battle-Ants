import { createInitialGameState, purchaseUpgrade, endTurn, canAffordUpgrade, upgradeResearchTurns } from './gameState';

function rich() {
  const s = createInitialGameState({ playerCount: 2, mapSize: 'small' });
  Object.values(s.players).forEach(p => { p.resources = { food: 999, minerals: 999 }; });
  return s;
}
const passTurn = s => endTurn(endTurn(s).gameState).gameState; // player1 -> player2 -> player1

describe('upgrade research time', () => {
  test('research times: level 1 instant, level 2 one turn, level 3 two turns, Brood/Swarm Queen upgrades one turn', () => {
    expect(upgradeResearchTurns('meleeAttack', 0)).toBe(0);
    expect(upgradeResearchTurns('meleeAttack', 1)).toBe(1);
    expect(upgradeResearchTurns('meleeAttack', 2)).toBe(2);
    expect(upgradeResearchTurns('burrow', 0)).toBe(1);
    expect(upgradeResearchTurns('connectedTunnels', 0)).toBe(1);
  });

  test('level 1 lands at once, but only one upgrade can be bought per turn', () => {
    let s = rich();
    s = purchaseUpgrade(s, 'meleeAttack');
    expect(s.players.player1.upgrades.meleeAttack).toBe(1);
    const again = purchaseUpgrade(s, 'defense');
    expect(again.players.player1.upgrades.defense || 0).toBe(0);
    s = passTurn(s);
    s = purchaseUpgrade(s, 'defense');
    expect(s.players.player1.upgrades.defense).toBe(1);
  });

  test('level 2 takes one turn and blocks other research meanwhile', () => {
    let s = rich();
    s = purchaseUpgrade(s, 'meleeAttack');           // level 1, instant
    s = passTurn(s);
    s = purchaseUpgrade(s, 'meleeAttack');           // level 2 starts
    expect(s.players.player1.upgrades.meleeAttack).toBe(1);
    expect(s.players.player1.research).toMatchObject({ upgradeId: 'meleeAttack' });
    s = endTurn(s).gameState;                         // player2's turn
    expect(s.players.player1.upgrades.meleeAttack).toBe(1);
    s = endTurn(s).gameState;                         // player1 again: done
    expect(s.players.player1.upgrades.meleeAttack).toBe(2);
    expect(s.players.player1.research).toBeNull();
  });

  test('level 3 takes two turns; nothing else can start until it is done', () => {
    let s = rich();
    s = purchaseUpgrade(s, 'meleeAttack'); s = passTurn(s);
    s = purchaseUpgrade(s, 'meleeAttack'); s = passTurn(s);
    expect(s.players.player1.upgrades.meleeAttack).toBe(2);
    s = purchaseUpgrade(s, 'meleeAttack');           // level 3 starts
    s = passTurn(s);
    expect(s.players.player1.upgrades.meleeAttack).toBe(2);
    expect(canAffordUpgrade(s.players.player1, 'defense', null)).toBe(false);
    s = passTurn(s);
    expect(s.players.player1.upgrades.meleeAttack).toBe(3);
    expect(canAffordUpgrade(s.players.player1, 'defense', null)).toBe(true);
  });
});
