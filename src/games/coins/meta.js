// Coin Flip: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Coin Flip',    hint: "Flip up to 3 coins that aren't yours. All five the same wins" };
export const release = 'released';   // the default (the admin's dashboard can change it)
export const category = 'luck';   // the game's kind, an icon in the Advanced checklist: 'luck', 'skill' or 'brain'
export const target = 'shared';   // the header's icon: 'shared' (one board for both), 'own' (each player's own progress) or 'course' (one course for both, each their own distance)
export const explainer = { name: 'Coin Flip', play: "Flip up to {flips} coins that aren't yours.", win: 'All {n} coins show your side.' };   // ({flips}, {n}: its settings, TUNE below)
// Its settings (the admin's Mini-game Settings; core/tune.js): the coins are dealt with them, a flip turns up to flips.
export const TUNE = [
  { k: 'n', label: 'Coins (half each side, one mystery)', def: 5, opts: [3, 5, 7], group: 'Board' },
  { k: 'flips', label: 'Most coins turned a flip', def: 3, min: 1, max: 4, step: 1, group: 'Rules' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/></svg>';
