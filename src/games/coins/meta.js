// Coin Flip: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Coin Flip',    hint: "Flip up to 3 coins that aren't yours. All five the same wins" };
export const release = 'released';   // the default (the admin's dashboard can change it)
export const minVersion = '1.14.0';   // (1.14.0: the first version with its rules as they are now, December 2026 audit; was 1.0.0); the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const explainer = { name: 'Coin Flip', play: "Flip up to {flips} coins that aren't yours.", win: 'All {n} coins show your side.' };   // ({flips}, {n}: its settings, TUNE below)
// Its settings (the admin's Mini-game Settings; core/tune.js): the coins are dealt with them, a flip turns up to flips.
export const TUNE = [
  { k: 'n', label: 'Coins (half each side, one mystery)', def: 5, opts: [3, 5, 7], group: 'Board' },
  { k: 'flips', label: 'Most coins turned a flip', def: 3, min: 1, max: 4, step: 1, group: 'Rules' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/></svg>';
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/coins): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Flip the coins that aren\'t yours. Win when every coin shows your side.';
export const luckSkill = 1;
export const format = 'shared';
