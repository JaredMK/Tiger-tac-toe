// Block Drop: its names, its "?" explainer, its icon, its release default and its settings.

export const info = { name: 'Block Drop', hint: 'Drop pieces to fill rows. A full row clears. First to 4 rows wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.25.0';   // the oldest client version that has this game (core/client.js)
export const category = 'brain';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const explainer = { name: 'Block Drop', play: 'You get {pieces} pieces a turn. Tap a column to line the piece up, turn it if you like, then drop it. A full row clears and counts. If a piece will not fit, your board is cleared and you lose a row.{junkText}', win: 'First to clear {lines} rows.{evenText}' };
export const explainVars = v => ({ evenText: v.even !== 'off' ? ' If the first player gets there first, the other player gets their turn to answer: whoever used fewer pieces wins.' : '', junkText: v.junk === 'on' ? ' Clear two rows or more with one piece and the other player gets junk rows.' : '' });
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6v6H9zM3 15h6v6H3zM9 15h6v6H9zM15 15h6v6h-6z"/><path d="M12 10.500v2.500"/></svg>';
// Its settings (the admin's Games page; core/tune.js): the pieces a turn, the rows to win, the board's size, equal
// turns (rules.js: on, the second player always gets as many turns as the first), and junk rows (two or more rows cleared by one piece send one fewer to the other player's board).
export const TUNE = [
  { k: 'pieces', label: 'Pieces a turn', def: 3, min: 1, max: 6, step: 1, group: 'Rules' },
  { k: 'lines', label: 'Rows to take the square', def: 4, min: 1, max: 10, step: 1, group: 'Rules' },
  { k: 'cols', label: 'Board width', def: 6, min: 4, max: 8, step: 1, group: 'Board' },
  { k: 'rows', label: 'Board height', def: 8, min: 5, max: 10, step: 1, group: 'Board' },
  { k: 'even', label: 'Equal turns (the other player answers; fewer pieces wins)', def: 'on', opts: ['on', 'off'], group: 'Rules' },
  { k: 'junk', label: 'Junk rows sent to the other player', def: 'off', opts: ['off', 'on'], group: 'Rules' },
];
