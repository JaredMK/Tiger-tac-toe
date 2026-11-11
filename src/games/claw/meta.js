// Claw Machine: its names, its "?" explainer, its icon, its release default and its settings (November 2026).
import { AGAIN_TUNE } from '../../core/tune.js';

export const info = { name: 'Claw Machine', hint: 'Drag the claw over a prize, tap to drop. First to 3 prizes wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.10.0';   // the oldest client version that has this game (core/client.js)
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const explainer = { name: 'Claw Machine', play: 'Drag to move the claw over a prize, then tap to drop it. The better it is centred, the better the grip. A prize can still slip on the way to the chute.{goAgain}', win: 'Win {goal} prizes.' };
// {goAgain} in the explainer: the text below while "Go again on success" is on (AGAIN_TUNE), the other while off (ui/explainer.js fillTune).
export const goAgainText = { on: ' Win one? Go again.', off: '' };
// Its settings (the admin's Mini-game Settings; core/tune.js): read with clawCfg(mini). The case (100 units wide) holds
// `prizes` prizes; the grip falls from `gripMax` dead centre to `gripEdge` at a prize's edge (the square of the offset);
// a slip on the way is `slip` plus `slipPoor` at the edge (the square of the offset), times the prize's weight. The
// computer's aim error (one standard deviation, case units) by level. Tuned by tests/sim/claw.sim.js (November 2026):
// Normal v Normal 4.75 turns each (the winner 5.0), the first mover 56.5%; Hard v Hard 3.9, 58.7%; a careful finger
// (3 units of error) 4.3, 57.2%. (Grip 92/22 and slip 12 gave 4.0 turns at Normal, Hard 3.3 and 62.7%.)
export const TUNE = [
  AGAIN_TUNE,
  { k: 'goal', label: 'Prizes to win', def: 3, min: 1, max: 5, step: 1, group: 'Rules' },
  { k: 'prizes', label: 'Prizes in the case', def: 6, min: 4, max: 7, step: 1, group: 'Board' },
  { k: 'gripMax', label: 'Grip when dead centre (%)', def: 85, min: 30, max: 100, step: 1, group: 'Rules' },
  { k: 'gripEdge', label: 'Grip at the prize\'s edge (%)', def: 15, min: 0, max: 100, step: 1, group: 'Rules' },
  { k: 'slip', label: 'Slip on the way, a good grip (%)', def: 20, min: 0, max: 60, step: 1, group: 'Rules' },
  { k: 'slipPoor', label: 'Slip, added at the edge (%)', def: 34, min: 0, max: 80, step: 1, group: 'Rules' },
  { k: 'aiAim', label: 'Computer aim error, Normal (case units)', def: 4, min: 0, max: 20, step: 0.2, group: 'Computer' },
  { k: 'aiAimHard', label: 'Computer aim error, Hard (case units)', def: 2.4, min: 0, max: 20, step: 0.2, group: 'Computer' },
  { k: 'aiAimEasy', label: 'Computer aim error, Easy (case units)', def: 8, min: 0, max: 30, step: 0.2, group: 'Computer' },
];
// The icon: a claw on its cable over a ball.
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3h16M12 3v6"/><path d="M12 9c-2.6 0-4 1.6-4 3.4l1.6 2M12 9c2.6 0 4 1.6 4 3.4l-1.6 2"/><circle cx="12" cy="18.5" r="3"/></svg>';
