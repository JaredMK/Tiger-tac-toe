// War: the computer's play.
import { tune } from '../../core/tune.js';

// One move only: Flip (the round flips itself out). A flip wins the round about half the time (the higher of
// two cards from a shuffled deck: 24 of 51 against, 24 for, 3 ties that go to war and split the same way),
// so needs is the rounds still needed over that chance; q is the chance this one flip takes the square (the
// last round needed, or a war worth the two still needed).
export const WAR_WIN = 0.5, WAR_TIE = 3 / 51;
// The flips still needed for k more rounds, exactly: a flip loses half the time, wins a plain round 24 in 51 and a
// war (worth warWorth) half of 3 in 51: E(k) = (1 + 24/51 E(k - 1) + 1.5/51 E(k - warWorth)) / (1 - 1/2).
export function warFlips(k, worth) {
  const E = [0];
  for (let j = 1; j <= k; j++) E[j] = (1 + (WAR_WIN - WAR_TIE * WAR_WIN) * E[j - 1] + WAR_TIE * WAR_WIN * E[Math.max(0, j - Math.max(1, worth || 1))]) / (1 - WAR_WIN);
  return E[Math.max(0, k)];
}
export function needs(pm, p) {
  const c = tune(pm), k = Math.max(0, c.goal - pm.wins[p]);
  return Math.max(1, warFlips(k, c.warWorth));
}
export function best(pm, me, rng, style, ctx) {   // (Hard: the same, there is nothing to choose)
  const c = tune(pm), k = Math.max(1, c.goal - pm.wins[me]);
  const q = k <= 1 ? WAR_WIN : k <= c.warWorth ? WAR_TIE * WAR_WIN : 0;
  return { move: 'flip', q };
}
