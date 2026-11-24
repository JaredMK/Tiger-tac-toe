// Letter Hive: its names, its "?" explainer, its icon, its release default and its settings.
import { AGAIN_TUNE } from '../../core/tune.js';

export const info = { name: 'Letter Hive', hint: 'New letters every turn: make words with them, always with the centre one. First to the target wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.31.0';   // (1.31.0: new letters every turn, drawn at Go!, v 2) the oldest client version that has this game (core/client.js)
export const category = 'brain';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const realTime = true;   // its move is a timed burst (core/timer.js moveRate)
export const turnSecs = 60;   // an online turn's seconds here: the burst and the time to begin it (core/timer.js turnSecs)
export const explainer = { name: 'Letter Hive', play: 'Each turn deals seven new letters, hidden until you tap Go!, then a burst of {secs} seconds. Tap the letters to make words of 4 letters or more, always with the centre letter; a letter can be used again. A 4-letter word scores {four}, a longer word its length, and a word with all seven letters {bonus} more. A word either player has already found scores nothing.{goAgain}', win: 'First to {target} points.' };
// {goAgain} in the explainer: the text below while "Go again on success" is on (AGAIN_TUNE), the other while off (ui/explainer.js fillTune).
export const goAgainText = { on: ' All seven letters in a word? Go again.', off: '' };
// The icon: a little hive of three cells, a letter's strokes in the middle one.
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.500 3.500h5l2.500 4.250-2.500 4.250h-5L7 7.750z"/><path d="M4.500 12h5l2.500 4.250L9.500 20.500h-5L2 16.250z"/><path d="M14.500 12h5l2.500 4.250-2.500 4.250h-5L12 16.250z"/><path d="M10.750 9.500 12 6l1.250 3.500M11.150 8.500h1.700"/></svg>';
// Its settings (the admin's Games page; core/tune.js): read with hiveCfg(mini). The burst's length and the target;
// what a 4-letter word and a full-hive word are worth (a longer word is always its length); and the computer's hand:
// the words it finds in a burst by level (never more than a person could enter in the time) and its lean to short
// words (how likely a word is beside one a letter shorter: 100 no lean, 50 half as likely a letter) and to everyday
// ones (the puzzles mark them: how likely an unusual word is beside one), with Hard's chance of going for a
// full-hive word. Tuned by tests/sim/hive.sim.js (23 November 2026, new letters every turn, drawn at Go!): 40 points
// with Normal's 1 to 4 words a burst: 5.5 bursts each (median 5.5), the winner's 5.8, the first mover 58.5% over 4,000
// squares (35 points: 4.8, 59%; 45: 6.2, 58%; 50: 6.9, 57.5%). Every burst now has fresh letters, so none is worth more
// for the words the other player has left: a Normal burst is worth about 7 points all square long (with one set of
// letters, 7 at first and 8 to 9 later). The target tops out at 50: every puzzle holds 4 times that in points
// (scripts/make-hive-puzzles.js TOTAL), so a burst on new letters never runs short.
export const TUNE = [
  AGAIN_TUNE,
  { k: 'secs', label: 'Burst length (s)', def: 20, min: 8, max: 45, step: 1, group: 'Timing' },
  { k: 'target', label: 'Points to take the square', def: 40, min: 10, max: 50, step: 1, group: 'Rules' },
  { k: 'four', label: 'A 4-letter word scores', def: 1, min: 1, max: 4, step: 1, group: 'Rules' },
  { k: 'bonus', label: 'All seven letters in a word: extra points', def: 7, min: 0, max: 15, step: 1, group: 'Rules' },
  { k: 'aiRare', label: 'An unusual word is this likely beside an everyday one (%)', def: 20, min: 0, max: 100, step: 5, group: 'Computer' },
  { k: 'aiMin', label: 'Words a burst, at least', def: 1, min: 0, max: 12, step: 1, group: 'Computer: Normal' },
  { k: 'aiMax', label: 'Words a burst, at most', def: 4, min: 0, max: 12, step: 1, group: 'Computer: Normal' },
  { k: 'aiShort', label: 'How likely a word one letter longer is, against one shorter (%)', def: 45, min: 5, max: 150, step: 5, group: 'Computer: Normal' },
  { k: 'aiMinHard', label: 'Words a burst, at least', def: 2, min: 0, max: 12, step: 1, group: 'Computer: Hard' },
  { k: 'aiMaxHard', label: 'Words a burst, at most', def: 5, min: 0, max: 12, step: 1, group: 'Computer: Hard' },
  { k: 'aiShortHard', label: 'How likely a word one letter longer is, against one shorter (%)', def: 45, min: 5, max: 150, step: 5, group: 'Computer: Hard' },
  { k: 'aiFullHard', label: 'Goes for a full-hive word (% of bursts)', def: 0, min: 0, max: 100, step: 5, group: 'Computer: Hard' },
  { k: 'aiMinEasy', label: 'Words a burst, at least', def: 1, min: 0, max: 12, step: 1, group: 'Computer: Easy' },
  { k: 'aiMaxEasy', label: 'Words a burst, at most', def: 3, min: 0, max: 12, step: 1, group: 'Computer: Easy' },
  { k: 'aiShortEasy', label: 'How likely a word one letter longer is, against one shorter (%)', def: 35, min: 5, max: 150, step: 5, group: 'Computer: Easy' },
];
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/hive): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Tap letters to make words with the centre letter. Longer words score more. Reach the target first.';
export const luckSkill = 4;
export const format = 'race';
