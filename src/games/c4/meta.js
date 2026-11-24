// Four in a Row: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Four in a Row',    hint: 'Pieces drop. Four in a row wins' };
export const release = 'released';   // the default (the admin's dashboard can change it)
export const minVersion = '1.0.0';   // the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'brain';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const explainer = { name: 'Four in a Row', play: 'Drop a piece into a column.', win: '{k} in a row, any direction.' };   // ({k}: its setting, TUNE below)
// Its settings (the admin's Mini-game Settings; core/tune.js): read through tune(mini).
export const TUNE = [
  { k: 'k', label: 'Pieces in a row to win', def: 4, min: 3, max: 5, step: 1, group: 'Rules' },
  { k: 'aiDepthEasy', label: 'Easy: how many moves ahead it looks', def: 3, min: 1, max: 4, step: 1, group: 'Computer: Easy' },
  { k: 'aiBlockEasy', label: "Easy: how often it notices the other side's four coming and blocks it (%)", def: 90, min: 0, max: 100, step: 5, group: 'Computer: Easy' },
  { k: 'aiPoolEasy', label: 'Easy: picks at random among this many of the columns that look best', def: 1, min: 1, max: 7, step: 1, group: 'Computer: Easy' },
  { k: 'depth', label: 'Normal: how many moves ahead it looks', def: 5, min: 1, max: 6, step: 1, group: 'Computer: Normal' },
  { k: 'aiNodesHard', label: 'Hard: how hard it thinks (thousands of positions a move, within its time on a phone)', def: 45, min: 1, max: 200, step: 1, group: 'Computer: Hard' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="19" r="3"/><circle cx="12" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><path d="M12 2v9M8.5 8 12 11.5 15.5 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/c4): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Drop pieces into the columns. Line up four in a row, any direction, to win.';
export const luckSkill = 5;
export const format = 'shared';
// The computer's levels (core/tune.js levelTune): Easy and Hard now and then play a column that looks fine but is not
// their best (ai.js worse): without it Hard, searching far deeper than Normal, would win nearly every square.
export const AI_LEVELS = { miss: { easy: 6, hard: 4 }, think: { hard: 250 } };
