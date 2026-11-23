// Rhythm Tap: its names, its "?" explainer, its icon, its release default and its settings.

export const info = { name: 'Rhythm Tap', hint: 'Tap each note as it reaches the line, on the beat. First to 60 wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.25.0';   // the oldest client version that has this game (core/client.js)
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const realTime = true;   // its move is a timed round (core/timer.js moveRate)
export const explainer = { name: 'Rhythm Tap', play: 'A turn is one round of {secs} seconds. Notes come down three lanes to the beat. Tap a lane as its note reaches the line: right on the beat is Perfect, 2 points; close is Good, 1 point.{livesText}', win: 'First to {target} points.' };
export const explainVars = v => ({ livesText: v.lives > 0 ? ` Miss ${v.lives} notes and the round ends.` : '' });
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17.500V5l10-2v12.500"/><circle cx="6.500" cy="17.500" r="2.500"/><circle cx="16.500" cy="15.500" r="2.500"/></svg>';
// Its settings (the admin's Games page; core/tune.js): the round's length, the target, the tempo, the timing window
// (a tap this many ms either side of the beat still counts; the nearest 40% of it is a Perfect), the misses that end a
// round, how often a note falls between two beats, and the computer's hand: its timing error and the share of the
// notes it lets go by, by level.
export const TUNE = [
  { k: 'secs', label: 'Round length (s)', def: 10, min: 5, max: 20, step: 1, group: 'Rules' },
  { k: 'target', label: 'Points to take the square', def: 60, min: 8, max: 200, step: 1, group: 'Rules' },
  { k: 'lives', label: 'Misses that end the round (0: never)', def: 2, min: 0, max: 8, step: 1, group: 'Rules' },
  { k: 'tempo', label: 'Tempo (beats a minute)', def: 100, min: 60, max: 160, step: 2, group: 'Timing' },
  { k: 'window', label: 'Timing window (ms either side of the beat)', def: 150, min: 60, max: 300, step: 5, group: 'Timing' },
  { k: 'dense', label: 'Notes between beats (% of beats)', def: 25, min: 0, max: 80, step: 5, group: 'Board' },
  { k: 'aiMs', label: 'Normal computer: timing error (ms)', def: 75, min: 0, max: 250, step: 1, group: 'Computer' },
  { k: 'aiMiss', label: 'Normal computer: notes let go by (%)', def: 20, min: 0, max: 60, step: 1, group: 'Computer' },
  { k: 'aiMsHard', label: 'Hard computer: timing error (ms)', def: 45, min: 0, max: 250, step: 1, group: 'Computer' },
  { k: 'aiMissHard', label: 'Hard computer: notes let go by (%)', def: 7, min: 0, max: 60, step: 1, group: 'Computer' },
  { k: 'aiMsEasy', label: 'Easy computer: timing error (ms)', def: 105, min: 0, max: 250, step: 1, group: 'Computer' },
  { k: 'aiMissEasy', label: 'Easy computer: notes let go by (%)', def: 26, min: 0, max: 60, step: 1, group: 'Computer' },
];
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/rhythm): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Tap the lanes as the notes reach the line, right on the beat. Score the target first.';
export const luckSkill = 5;
export const format = 'race';
