import { getAllowedSplashRotations } from './combatSystem';

// Splash shapes may only lean back toward the Bombardier, never reach past
// the target: 3 shapes for most targets, 2 for one in a straight line.
test('a Bombardier splash only allows the shapes that lean toward her', () => {
  const me = { q: 0, r: 0 };
  expect(getAllowedSplashRotations(me, { q: 2, r: -1 })).toHaveLength(3);
  expect(getAllowedSplashRotations(me, { q: 3, r: -1 })).toHaveLength(3);
  expect(getAllowedSplashRotations(me, { q: 2, r: 0 })).toHaveLength(2);
  expect(getAllowedSplashRotations(me, { q: 0, r: -3 })).toHaveLength(2);
});
