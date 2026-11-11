// War: the computer's play.
import { goAgain, tune } from '../../core/tune.js';

// One move only: Flip (a round won goes again, a round lost ends the turn) (the round flips itself out). A flip wins the round about half the time (the higher of
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
// A hot streak (November 2026): a round won keeps the turn, so a turn flips until a round is lost. needs: the turns still
// needed: the turn that finishes it and one for every flip lost on the way (half the flips needed).
export function needs(pm, p) {
  const c = tune(pm), k = Math.max(0, c.goal - pm.wins[p]);
  if (!goAgain(pm)) return Math.max(1, warFlips(k, c.warWorth));   // ("Go again on success" off: a flip a turn)
  return Math.max(1, 1 + (1 - WAR_WIN) * warFlips(k, c.warWorth));
}
export function best(pm, me, rng, style, ctx) {   // (Hard: the same, there is nothing to choose)
  const c = tune(pm), k = Math.max(1, c.goal - pm.wins[me]);
  if (!goAgain(pm)) return { move: 'flip', q: k <= 1 ? WAR_WIN : k <= c.warWorth ? WAR_WIN * WAR_TIE : 0 };   // (one flip a turn: only the last round needed takes it now)
  return { move: 'flip', q: WAR_WIN ** k };   // q: the chance this turn takes the square: every round still needed won in a row (a war's double worth ignored)
}
