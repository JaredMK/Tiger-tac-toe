// Hook-a-Duck: its names, its "?" explainer, its icon, its release default and its settings (November 2026).
import { AGAIN_TUNE } from '../../core/tune.js';

export const info = { name: 'Hook-a-Duck', hint: 'Hook a duck from your pond. Its bottom shows its value. First to the target wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.10.0';   // the oldest client version that has this game (core/client.js)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const explainer = { name: 'Hook-a-Duck', play: 'Tap a duck in your pond to hook it. Its bottom shows 1 to 5 points, or a boot worth nothing. An empty pond fills up again.{goAgain}', win: 'First to {target} points.' };
// {goAgain} in the explainer: the text below while "Go again on success" is on (AGAIN_TUNE), the other while off (ui/explainer.js fillTune).
export const goAgainText = { on: ' Points? Hook again.', off: '' };
// Its settings (the admin's Mini-game Settings; core/tune.js): read with duckCfg(mini). The pond's size and its mix of
// values (ducks worth 1 to 5 and boots worth 0; a mix short of the pond's size is filled with boots), and the points to
// win. Tuned by tests/sim/duck.sim.js (November 2026): a pond of 12 (one each of 1 to 4, three 5s, five boots) and 12 to
// win: 4.8 turns each, the winner's 5.1, the first mover 57.7% (a steadier mix, two each of 1 to 3, one 4, one 5 and two
// boots in a pond of 10, made the race too even: the first mover won 62%; the boots and 5s are what give the second a chance).
export const TUNE = [
  AGAIN_TUNE,
  { k: 'target', label: 'Points to win', def: 12, min: 4, max: 30, step: 1, group: 'Rules' },
  { k: 'ducks', label: 'Ducks in a pond', def: 12, min: 4, max: 12, step: 1, group: 'Rules' },
  { k: 'v1', label: 'Ducks worth 1', def: 1, min: 0, max: 12, step: 1, group: 'Rules' },
  { k: 'v2', label: 'Ducks worth 2', def: 1, min: 0, max: 12, step: 1, group: 'Rules' },
  { k: 'v3', label: 'Ducks worth 3', def: 1, min: 0, max: 12, step: 1, group: 'Rules' },
  { k: 'v4', label: 'Ducks worth 4', def: 1, min: 0, max: 12, step: 1, group: 'Rules' },
  { k: 'v5', label: 'Ducks worth 5', def: 3, min: 0, max: 12, step: 1, group: 'Rules' },
  { k: 'boots', label: 'Boots (worth 0)', def: 5, min: 0, max: 12, step: 1, group: 'Rules' },
];
// The icon: a little duck on a ripple, a hook above it.
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15.5c0 2.6 2.4 4.5 6.5 4.5H15c2.8 0 4.6-1.6 4.6-3.8 0-1.4-.8-2.4-2.2-2.9-.4-1.8-1.8-3.1-3.7-3.1-2 0-3.5 1.5-3.5 3.4v.4H6.2c-1.3 0-2.2.6-2.2 1.5z"/><path d="M13.7 12.4h.01M17.4 13.3l2.4-.6M12.8 2v4.3a1.6 1.6 0 0 0 3.2 0"/></svg>';
