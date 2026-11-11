// Coin Pusher: its names, its "?" explainer, its icon, its release default and its settings (November 2026).
import { AGAIN_TUNE } from '../../core/tune.js';

export const info = { name: 'Coin Pusher', hint: 'Drop 3 coins along the top. The pusher shoves coins over the edge' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.10.0';   // the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const realTime = true;   // its move plays back in real time (the pusher's push): never sped up past the replay's own speed (core/timer.js moveRate)
export const explainer = { name: 'Coin Pusher', play: 'Tap {perMove} spots along the top, then Drop. The pusher shoves the coins forward: the ones over the front edge are yours. Off the sides, they are gone. Your machine keeps its coins for your next go.{goAgain}', win: 'First to {target} coins.' };   // ({perMove}, {target}: its settings, TUNE below)
// {goAgain} in the explainer: the text below while "Go again on success" is on (AGAIN_TUNE), the other while off (ui/explainer.js fillTune).
export const goAgainText = { on: ' A coin over the edge? Go again.', off: '' };
// Its settings (the admin's Mini-game Settings; core/tune.js): read with tune(mini). Tuned by tests/sim/pusher.sim.js
// (November 2026): 63 coins on a fresh shelf, a stroke of 0.2 of the shelf every 2 s for 4 s a move, 12 to win.
export const TUNE = [
  AGAIN_TUNE,
  { k: 'target', label: 'Coins to win', def: 12, min: 3, max: 40, step: 1, group: 'Rules' },
  { k: 'perMove', label: 'Coins dropped a move', def: 3, min: 1, max: 5, step: 1, group: 'Rules' },
  { k: 'start', label: 'Coins on a fresh shelf', def: 63, min: 20, max: 80, step: 1, group: 'Board' },
  { k: 'stroke', label: "Pusher's stroke (share of the shelf)", def: 0.2, min: 0.08, max: 0.3, step: 0.01, group: 'Board' },
  { k: 'period', label: "Pusher's cycle (s)", def: 2, min: 1, max: 4, step: 0.25, group: 'Timing' },
  { k: 'secs', label: 'Pushing time a move (s)', def: 4, min: 2, max: 8, step: 0.5, group: 'Timing' },
  { k: 'friction', label: 'Coins keep of their speed (%)', def: 30, min: 0, max: 90, step: 5, group: 'Board' },
  { k: 'jitter', label: 'Drop scatter (share of the width)', def: 0.015, min: 0, max: 0.06, step: 0.005, group: 'Rules' },
  { k: 'aiTries', label: 'Hard: drops tried', def: 14, min: 4, max: 40, step: 1, group: 'Computer' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3" width="17" height="18" rx="2.5"/><path d="M3.5 8.5h17"/><circle cx="9" cy="14" r="2.2"/><circle cx="15" cy="15.5" r="2.2"/><path d="M8 5.7h8"/></svg>';
