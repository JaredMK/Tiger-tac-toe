// Echo: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Echo',         hint: 'Play the pattern once, then tap it back. Beat all four' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.0.0';   // the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const turnSecs = 60;   // an online turn's time in this game (core/timer.js turnSecs): 60 seconds, against the match's 30
export const category = 'brain';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Echo', play: 'Tap Play pattern to watch it once, then tap it back.', win: 'Beat all four patterns.' };   // ({start}, {add}: its settings, TUNE below)
export const icon = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2" opacity=".55"/><rect x="3" y="13" width="8" height="8" rx="2" opacity=".55"/><rect x="13" y="13" width="8" height="8" rx="2" opacity=".3"/></svg>';
// Its settings (the admin's Mini-game Settings; core/tune.js): the lengths dealt into each square (its pattern's length).
export const TUNE = [
  { k: 'start', label: 'First pattern (steps)', def: 4, min: 3, max: 6, step: 1, group: 'Rules' },
  { k: 'add', label: 'Steps added each pattern', def: 2, min: 1, max: 3, step: 1, group: 'Rules' },
  { k: 'step', label: 'Pattern pace (ms a step)', def: 450, min: 350, max: 700, step: 50, group: 'Timing' },
  { k: 'ai1', label: 'Computer beats pattern 1 (%)', def: 95, min: 10, max: 100, step: 5, group: 'Computer' },
  { k: 'ai2', label: 'Computer beats pattern 2 (%)', def: 85, min: 10, max: 100, step: 5, group: 'Computer' },
  { k: 'ai3', label: 'Computer beats pattern 3 (%)', def: 70, min: 10, max: 100, step: 5, group: 'Computer' },
  { k: 'ai4', label: 'Computer beats pattern 4 (%)', def: 55, min: 10, max: 100, step: 5, group: 'Computer' },
];
export const realTime = true;   // its move plays back in real time (a run, a recording, a timed round): never sped up past the replay's own speed (core/timer.js moveRate)
