// Split It: its names, its "?" explainer, its icon, its release default and its settings.
import { AGAIN_TUNE } from '../../core/tune.js';

export const info = { name: 'Split It', hint: 'Hold to drink. Stop the level on your mark. First to 3 points wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.30.0';   // the oldest client version that has this game (core/client.js)
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const realTime = true;   // its move is one timed hold: replayed as it was made (core/timer.js moveRate)
export const explainer = { name: 'Split It', play: 'Your pint glass has your mark on it. Hold to drink: the glass tips and the level drops. Let go to stop. Stop the level on the middle of your mark: a split scores 1, a perfect split 2. One hold a go, and a fresh pint every time.{goAgain}', win: 'First to {goal} points.' };
// {goAgain} in the explainer: the text below while "Go again on success" is on (AGAIN_TUNE), the other while off (ui/explainer.js fillTune).
export const goAgainText = { on: ' Split it? Go again.', off: '' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.500 3h11l-1.500 18h-8zM7.300 12h9.400M12 8.500v7"/></svg>';
// Its settings (the admin's Games page; core/tune.js): the points to win, how far from the mark's middle still counts
// as a split and as a perfect one (shares of the glass's height, %), how fast the drink goes down (% of the glass a
// second at its steady flow), where on the glass a mark may be, whether a split keeps the turn, and the computer's
// timing.
export const TUNE = [
  { k: 'goal', label: 'Points to win', def: 3, min: 1, max: 8, step: 1, group: 'Rules' },
  { k: 'tol', label: 'Split: how far from the mark\'s middle still counts (% of the glass)', def: 3.5, min: 1, max: 12, step: 0.5, group: 'Rules' },
  { k: 'perfect', label: 'Perfect split: how far off still counts (% of the glass)', def: 1, min: 0.2, max: 6, step: 0.1, group: 'Rules' },
  AGAIN_TUNE,
  { k: 'rate', label: 'Drinking speed (% of the glass a second)', def: 50, min: 15, max: 120, step: 1, group: 'Timing' },
  { k: 'markLo', label: 'The mark\'s lowest place (% of the glass, from its base)', def: 35, min: 30, max: 85, step: 1, group: 'Board' },
  { k: 'markHi', label: 'The mark\'s highest place (% of the glass)', def: 70, min: 30, max: 85, step: 1, group: 'Board' },
  { k: 'aiMs', label: 'Timing error (ms)', def: 120, min: 20, max: 400, step: 5, group: 'Computer: Normal' },
  { k: 'aiMsHard', label: 'Timing error (ms)', def: 90, min: 20, max: 400, step: 5, group: 'Computer: Hard' },
  { k: 'aiMsEasy', label: 'Timing error (ms)', def: 170, min: 20, max: 400, step: 5, group: 'Computer: Easy' },
];
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/pint): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Hold to drink and let go to stop the level on your mark. Score enough splits first.';
export const luckSkill = 5;
export const format = 'race';
