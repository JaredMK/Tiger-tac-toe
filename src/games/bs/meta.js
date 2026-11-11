// Sea Battle: its names, its "?" explainer, its icon and its release default.
import { AGAIN_TUNE } from '../../core/tune.js';
import { MODE_TUNE } from '../../core/race.js';

export const info = { name: 'Sea Battle',   hint: 'Sink the hidden ship. A hit fires again' };
export const release = 'released';   // the default (the admin's dashboard can change it)
export const minVersion = '1.0.0';   // the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Sea Battle', play: "The hidden ship is {shipLen} long. Fire at a square.{goAgain}", win: 'Sink the ship.' };
export const raceExplainer = { name: 'Sea Battle', play: "Each of you has your own ship, {shipLen} long, hidden in your own sea. Fire at a square.{goAgain} The other player's shots show on their sea.", win: 'Sink your ship first.' };   // Race mode (core/race.js)
export const scExplainer = { name: 'Sea Battle', play: 'Fire at a square. Hit? Fire again.', win: 'Hit its last square. If you both do in the same round, the square resets.' };   // in Super Chaos ({scN}, {scLen}: its settings, TUNE below)
// Its settings (the admin's Mini-game Settings; core/tune.js): dealt into each square (n, len). {shipLen} in the explainers: the ship's length in words (ui/explainer.js CFG_KEYS: the open square's, else the setting's).
export const shipWords = len => (len === 'Random' ? '1 to 4 squares' : `${len} square${Number(len) === 1 ? '' : 's'}`);
// {goAgain} in the explainer: the text below while "Go again on success" is on (AGAIN_TUNE), the other while off (ui/explainer.js fillTune).
export const goAgainText = { on: ' Hit? Fire again.', off: '' };
export const TUNE = [
  AGAIN_TUNE,
  MODE_TUNE,
  { k: 'n', label: 'Sea size (cells across)', def: 4, opts: [4, 5], group: 'Board' },
  { k: 'len', label: 'Ship length (cells; Random: 1 to 4 each square)', def: 3, opts: [1, 2, 3, 4, 'Random'], group: 'Rules' },
  { k: 'scN', label: 'Super Chaos sea size (cells across)', def: 5, opts: [4, 5], group: 'Board' },
  { k: 'scLen', label: 'Super Chaos ship (cells)', def: 3, min: 2, max: 4, step: 1, group: 'Rules' },
  { k: 'miss', label: 'Computer mistake rate (%)', def: 0, min: 0, max: 60, step: 5, group: 'Computer' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.5"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/></svg>';
