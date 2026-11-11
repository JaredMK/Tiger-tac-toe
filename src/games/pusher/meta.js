// Coin Pusher: its names, its "?" explainer, its icon, its release default and its settings (November 2026).
import { AGAIN_TUNE } from '../../core/tune.js';

export const info = { name: 'Coin Pusher', hint: 'Tap to drop 3 coins as the dropper slides. Coins pushed over the edge score' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.10.0';   // the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const realTime = true;   // its move plays back in real time (the pusher's push): never sped up past the replay's own speed (core/timer.js moveRate)
export const explainer = { name: 'Coin Pusher', play: 'Tap to drop a coin where the dropper is as it slides across the top: {perMove} coins a go. The pusher never stops: each coin over the front edge scores 1, a star coin {starWorth}. Off the sides, they are gone. Your machine keeps its coins for your next go.{goAgain}', win: 'Reach {target} first. The other player then gets one last turn: the higher total wins.' };   // ({perMove}, {target}: its settings, TUNE below)
// {goAgain} in the explainer: the text below while "Go again on success" is on (AGAIN_TUNE), the other while off (ui/explainer.js fillTune).
export const goAgainText = { on: ' A coin over the edge? Go again.', off: '' };
// Its settings (the admin's Mini-game Settings; core/tune.js): read with tune(mini). Tuned by tests/sim/pusher.sim.js
// (November 2026, the timed dropper): see the figures there and in CLAUDE.md.
export const TUNE = [
  AGAIN_TUNE,
  { k: 'target', label: 'Coins to win', def: 12, min: 3, max: 40, step: 1, group: 'Rules' },
  { k: 'perMove', label: 'Coins dropped a move', def: 3, min: 1, max: 5, step: 1, group: 'Rules' },
  { k: 'start', label: 'Coins on a fresh shelf', def: 63, min: 20, max: 80, step: 1, group: 'Board' },
  { k: 'stroke', label: "Pusher's stroke (share of the shelf)", def: 0.2, min: 0.08, max: 0.3, step: 0.01, group: 'Board' },
  { k: 'period', label: "Pusher's cycle (s)", def: 2, min: 1, max: 4, step: 0.25, group: 'Timing' },
  { k: 'dropPeriod', label: "Dropper's sweep there and back (s)", def: 2.4, min: 1, max: 5, step: 0.1, group: 'Timing' },
  { k: 'maxSecs', label: 'Attempt time limit (s, from the first coin)', def: 8, min: 3, max: 20, step: 1, group: 'Timing' },
  { k: 'settle', label: 'Pushing time after the last coin (s)', def: 3, min: 1, max: 6, step: 0.5, group: 'Timing' },
  { k: 'friction', label: 'Coins keep of their speed (%)', def: 30, min: 0, max: 90, step: 5, group: 'Board' },
  { k: 'starPct', label: 'Star coins (% of coins)', def: 10, min: 0, max: 50, step: 1, group: 'Rules' },
  { k: 'starWorth', label: 'A star coin is worth', def: 3, min: 1, max: 10, step: 1, group: 'Rules' },
  { k: 'aiErr', label: 'Computer timing error, Normal (ms)', def: 110, min: 0, max: 600, step: 10, group: 'Computer' },
  { k: 'aiErrHard', label: 'Computer timing error, Hard (ms)', def: 50, min: 0, max: 600, step: 10, group: 'Computer' },
  { k: 'aiErrEasy', label: 'Computer timing error, Easy (ms)', def: 300, min: 0, max: 900, step: 10, group: 'Computer' },
  { k: 'aiTries', label: 'Hard: columns tried', def: 14, min: 4, max: 40, step: 1, group: 'Computer' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3" width="17" height="18" rx="2.5"/><path d="M3.5 8.5h17"/><circle cx="9" cy="14" r="2.2"/><circle cx="15" cy="15.5" r="2.2"/><path d="M8 5.7h8"/></svg>';
