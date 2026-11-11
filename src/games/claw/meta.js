// Claw Machine: its names, its "?" explainer, its icon, its release default and its settings (November 2026).
import { AGAIN_TUNE } from '../../core/tune.js';

export const info = { name: 'Claw Machine', hint: 'The claw sweeps by itself. Drop it on a prize. First to 3 prizes wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.10.0';   // the oldest client version that has this game (core/client.js)
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const explainer = { name: 'Claw Machine', play: 'One machine for you both. The claw sweeps by itself and swings as it goes. Tap Drop to grab the prize under it: the better it is centred, the better the grip. A prize can still slip on the way to the chute.{goAgain}', win: 'Win {goal} prizes.' };
// {goAgain} in the explainer: the text below while "Go again on success" is on (AGAIN_TUNE), the other while off (ui/explainer.js fillTune).
export const goAgainText = { on: ' Win one? Go again.', off: '' };
// Its settings (the admin's Mini-game Settings; core/tune.js): read with clawCfg(mini). The shared case (100 units wide)
// holds `prizes` prizes; the carriage sweeps at `speed` case units a second and the claw hangs from it as a pendulum
// (`swing`: its stiffness, higher swings faster and lags less; `damp`: how soon a swing dies down, % of critical); the
// grip falls from `gripMax` dead centre to `gripEdge` at a prize's edge (the square of the offset); a slip on the way is
// `slip` plus `slipPoor` at the edge, times the prize's weight. The computer's timing error (one standard deviation, ms)
// by level. Tuned by tests/sim/claw.sim.js (November 2026, the shared machine): Normal v Normal 4.45 turns each (the
// winner 4.7), the first mover 57%; Hard v Hard 3.9, 59.6%; Easy 6.0; grip 85 gave Hard v Hard 61%.
export const TUNE = [
  AGAIN_TUNE,
  { k: 'goal', label: 'Prizes to win', def: 3, min: 1, max: 5, step: 1, group: 'Rules' },
  { k: 'prizes', label: 'Prizes in the case', def: 6, min: 4, max: 7, step: 1, group: 'Board' },
  { k: 'speed', label: 'Claw sweep speed (case units a second; the case is 100 wide)', def: 34, min: 10, max: 80, step: 1, group: 'Rules' },
  { k: 'swing', label: 'Claw swing stiffness (higher: lags less)', def: 55, min: 10, max: 200, step: 5, group: 'Rules' },
  { k: 'damp', label: 'Claw swing damping (%)', def: 22, min: 0, max: 100, step: 1, group: 'Rules' },
  { k: 'gripMax', label: 'Grip when dead centre (%)', def: 75, min: 30, max: 100, step: 1, group: 'Rules' },
  { k: 'gripEdge', label: 'Grip at the prize\'s edge (%)', def: 15, min: 0, max: 100, step: 1, group: 'Rules' },
  { k: 'slip', label: 'Slip on the way, a good grip (%)', def: 20, min: 0, max: 60, step: 1, group: 'Rules' },
  { k: 'slipPoor', label: 'Slip, added at the edge (%)', def: 34, min: 0, max: 80, step: 1, group: 'Rules' },
  { k: 'aiMs', label: 'Computer timing error, Normal (ms)', def: 70, min: 0, max: 400, step: 5, group: 'Computer' },
  { k: 'aiMsHard', label: 'Computer timing error, Hard (ms)', def: 40, min: 0, max: 400, step: 5, group: 'Computer' },
  { k: 'aiMsEasy', label: 'Computer timing error, Easy (ms)', def: 140, min: 0, max: 600, step: 5, group: 'Computer' },
];
// The icon: a claw on its cable over a ball.
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3h16M12 3v6"/><path d="M12 9c-2.6 0-4 1.6-4 3.4l1.6 2M12 9c2.6 0 4 1.6 4 3.4l-1.6 2"/><circle cx="12" cy="18.5" r="3"/></svg>';
