// Mancala Race: its names, its "?" explainer, its icon, its release default and its settings.

export const info = { name: 'Mancala Race', hint: 'Sow seeds round the board into your bank. First to bank enough wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.24.0';   // the oldest client version that has this game (core/client.js)
export const category = 'brain';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const explainer = { name: 'Mancala Race', play: 'Pick one of your pits. Its seeds are sown one by one round the board: along your side, into your bank, then along the other side.{extraText}{captureText}', win: 'First to bank {target} seeds wins. Nothing left to sow on your turn: whoever has banked more takes the square.' };
export const explainVars = v => ({ extraText: v.extra === 'off' ? '' : ' Last seed in your bank: go again.', captureText: v.capture === 'off' ? '' : ' Last seed in an empty pit of yours: bank it with the seeds opposite.' });
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="6"/><circle cx="8" cy="12" r="1.900"/><circle cx="12.700" cy="12" r="1.900"/><path d="M17.500 9.500v5"/></svg>';
// Its settings (the admin's Games page; core/tune.js): the pits a side, the seeds each starts with, the seeds to bank,
// and the two classic extras: go again when the last seed reaches your bank, and the capture.
export const TUNE = [
  { k: 'target', label: 'Seeds to bank to take the square', def: 10, min: 3, max: 30, step: 1, group: 'Rules' },
  { k: 'extra', label: 'Last seed in your bank: go again', def: 'on', opts: ['on', 'off'], group: 'Rules' },
  { k: 'capture', label: 'Last seed in an empty pit of yours: bank it and the seeds opposite', def: 'on', opts: ['on', 'off'], group: 'Rules' },
  { k: 'cross', label: 'Seeds past your bank go on along the other side', def: 'on', opts: ['on', 'off'], group: 'Rules' },
  { k: 'pits', label: 'Pits a side', def: 6, min: 3, max: 6, step: 1, group: 'Board' },
  { k: 'seeds', label: 'Seeds in each pit at the start (on average)', def: 3, min: 2, max: 6, step: 1, group: 'Board' },
  { k: 'mix', label: 'Uneven pits at the start (the same on both sides)', def: 'on', opts: ['on', 'off'], group: 'Board' },
];
