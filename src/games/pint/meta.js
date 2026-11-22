// Split It: a stand-in (a copy of Heads or Tails) until the real game replaces this folder.

export const info = { name: 'Split It', hint: 'Call the flip. First to 3 right calls wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.30.0';   // the oldest client version that has this game (core/client.js)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const explainer = { name: 'Split It', play: 'Call heads or tails, then the coin flips. A right call is a point.{sharedText}', win: 'First to {wins} points.' };
export const explainVars = v => ({ sharedText: v.boards === 'shared' ? ' A wrong call is a point for the other player.' : '' });
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="12" rx="9" ry="9"/><path d="M8.500 9.500v5M11.500 9.500v5M8.500 12h3M14 9.500h3.500M15.750 9.500v5"/></svg>';
// Its settings (the admin's Games page; core/tune.js): the right calls needed, and whether each flip is the caller's
// alone (separate) or counts for both players (shared: a wrong call scores for the other side).
export const TUNE = [
  { k: 'wins', label: 'Right calls to take the square', def: 3, min: 1, max: 7, step: 1, group: 'Rules' },
  { k: 'boards', label: 'Each flip counts for', def: 'separate', opts: ['separate', 'shared'], group: 'Rules' },
];
