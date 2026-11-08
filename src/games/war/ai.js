// War: the computer's play.
import { tune } from '../../core/tune.js';

// One move only: Flip (the round flips itself out). A flip wins the round about half the time (the higher of
// two cards from a shuffled deck: 24 of 51 against, 24 for, 3 ties that go to war and split the same way),
// so needs is the rounds still needed over that chance; q is the chance this one flip takes the square (the
// last round needed, or a war worth the two still needed).
export const WAR_WIN = 0.5, WAR_TIE = 3 / 51;
export function needs(pm, p) {
  const k = Math.max(0, tune(pm).goal - pm.wins[p]);
  return Math.max(1, k / WAR_WIN);
}
export function best(pm, me, rng, style, ctx) {   // (Hard: the same, there is nothing to choose)
  const c = tune(pm), k = Math.max(1, c.goal - pm.wins[me]);
  const q = k <= 1 ? WAR_WIN : k <= c.warWorth ? WAR_TIE * WAR_WIN : 0;
  return { move: 'flip', q };
}
