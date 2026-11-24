// Star Swarm: its names, its "?" explainer, its icon, its release default and its settings.

export const info = { name: 'Star Swarm',   hint: 'Drag to fly and blast the swarm. Reach the target first' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.14.0';   // (1.14.0: the first version with its rules as they are now, December 2026 audit; was 1.5.0); the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const turnSecs = 60;   // an online turn's time in this game (core/timer.js turnSecs): 60 seconds, against the match's 30
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = false;   // Super Chaos: never dealt there (a run is a real-time attempt of its own)
export const explainer = { name: 'Star Swarm', play: 'Drag to fly; your ship fires by itself. Jellies score 1, darts 2, saucers 3. One hit ends your turn; your points stay.', win: 'Score {target} first.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 13.5l-4.5 7h9z" fill="currentColor" fill-opacity=".35"/><path d="M12 13.5V10"/><circle cx="7" cy="4.5" r="1.9" fill="currentColor"/><circle cx="12" cy="3.5" r="1.9" fill="currentColor"/><circle cx="17" cy="4.5" r="1.9" fill="currentColor"/></svg>';
// Its settings (the admin's Mini-game Settings; core/tune.js; every one read by the square as it was dealt: rules.js
// tune(mini)): the target, the waves (how often enemies come at the start and after the ramp, how fast, the saucers'
// bolts), the ship's fire, the run's time cap, and the computer's hand (Normal's; Hard's is fixed: rules.js SW_HAND).
// Tuned by tests/sim/swarm.sim.js (November 2026): a near-flat danger from the start (0.45 s to 0.35 s between enemies, 3.4 to 4.1
// units/s over a 5 s ramp, in a sky 11 wide and 12 tall) and 100 points: the winner takes about 5.5 runs of about 8 s, the first mover wins about 58%; a run
// scores about 16 at Normal, about 37 at Hard (600 squares).
export const TUNE = [
  { k: 'target', label: 'Points to win (jellies 1, darts 2, saucers 3)', def: 100, min: 5, max: 300, step: 1, group: 'Rules' },
  { k: 'spawn0', label: 'Seconds between enemies at the start', def: 0.45, min: 0.3, max: 4, step: 0.05, group: 'Board' },
  { k: 'spawn1', label: 'Seconds between enemies after the ramp', def: 0.35, min: 0.2, max: 4, step: 0.05, group: 'Board' },
  { k: 'ramp', label: 'Ramp: seconds until full difficulty', def: 5, min: 5, max: 90, step: 1, group: 'Board' },
  { k: 'v0', label: 'Enemy speed at the start (units/s)', def: 3.4, min: 0.5, max: 8, step: 0.1, group: 'Board' },
  { k: 'v1', label: 'Enemy speed after the ramp (units/s)', def: 4.1, min: 0.5, max: 8, step: 0.1, group: 'Board' },
  { k: 'fireGap', label: 'Seconds between a saucer\'s bolts', def: 1.1, min: 0.5, max: 5, step: 0.1, group: 'Board' },
  { k: 'shotRate', label: 'Ship shots a second', def: 3, min: 1, max: 8, step: 0.5, group: 'Rules' },
  { k: 'maxSecs', label: 'Attempt time limit (s)', def: 40, min: 10, max: 50, step: 1, group: 'Timing' },
  { k: 'aiReact0', label: "Normal: reaction, fastest (ms)", def: 260, min: 0, max: 800, step: 10, group: 'Computer: Normal' },
  { k: 'aiReact1', label: "Normal: reaction, slowest (ms)", def: 360, min: 0, max: 800, step: 10, group: 'Computer: Normal' },
  { k: 'aiAim', label: "Normal: aim spread (cm)", def: 60, min: 0, max: 300, step: 5, group: 'Computer: Normal' },
  { k: 'aiLapse', label: "Normal: misses a threat (%)", def: 20, min: 0, max: 100, step: 1, group: 'Computer: Normal' },
  { k: 'aiReact0Easy', label: "Easy: reaction, fastest (ms)", def: 330, min: 0, max: 800, step: 10, group: 'Computer: Easy' },
  { k: 'aiReact1Easy', label: "Easy: reaction, slowest (ms)", def: 450, min: 0, max: 800, step: 10, group: 'Computer: Easy' },
  { k: 'aiAimEasy', label: "Easy: aim spread (cm)", def: 80, min: 0, max: 300, step: 5, group: 'Computer: Easy' },
  { k: 'aiLapseEasy', label: "Easy: misses a threat (%)", def: 28, min: 0, max: 100, step: 1, group: 'Computer: Easy' },
  { k: 'aiReact0Hard', label: "Hard: reaction, fastest (ms)", def: 170, min: 0, max: 800, step: 10, group: 'Computer: Hard' },
  { k: 'aiReact1Hard', label: "Hard: reaction, slowest (ms)", def: 260, min: 0, max: 800, step: 10, group: 'Computer: Hard' },
  { k: 'aiAimHard', label: "Hard: aim spread (cm)", def: 40, min: 0, max: 300, step: 5, group: 'Computer: Hard' },
  { k: 'aiLapseHard', label: "Hard: misses a threat (%)", def: 11, min: 0, max: 100, step: 1, group: 'Computer: Hard' },
];
export const realTime = true;   // its move plays back in real time (a run): never sped up past the replay's own speed (core/timer.js moveRate)
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/swarm): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Drag to fly while your ship fires by itself. Blast jellies, darts and saucers. Score the target first.';
export const luckSkill = 4;
export const format = 'race';
