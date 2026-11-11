// Word Tiles: its names, its "?" explainer, its icon, its release default and its settings (November 2026).
import { AGAIN_TUNE } from '../../core/tune.js';

export const info = { name: 'Word Tiles', hint: 'Lay a word from your tiles on your own board. First to the target' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.10.0';   // the oldest client version that has this game (core/client.js)
export const category = 'brain';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const explainer = { name: 'Word Tiles', play: 'Make one word on your own board from your tiles, in a row or a column. The first goes through the centre; the rest join on. Tinted squares count extra. No word? Swap your tiles.{goAgain}', win: 'First to {target} points.' };   // ({target}: its setting, TUNE below)
// The premium squares, one line each, under Play and Win in the "?" (ui/explainer.js: explainerList).
export const explainerList = { dl: 'Double letter: that tile counts twice.', tl: 'Triple letter: that tile counts three times.', dw: 'Double word: the whole word counts twice (the centre too).', tw: 'Triple word: the whole word counts three times.', all: 'All seven tiles in one word: bonus points.' };
// {goAgain} in the explainer: the text below while "Go again on success" is on (AGAIN_TUNE), the other while off (ui/explainer.js fillTune).
export const goAgainText = { on: ' Played a word? Go again.', off: '' };
// Its settings (the admin's Mini-game Settings; core/tune.js): read with tune(mini). Tuned by tests/sim/wtiles.sim.js.
export const TUNE = [
  AGAIN_TUNE,
  { k: 'target', label: 'Points to win', def: 100, min: 15, max: 150, step: 5, group: 'Rules' },
  { k: 'rack', label: 'Tiles on a rack', def: 7, min: 4, max: 7, step: 1, group: 'Rules' },
  { k: 'bonus', label: 'All seven tiles in one word: extra points', def: 15, min: 0, max: 50, step: 1, group: 'Rules' },
  { k: 'aiSee', label: 'Computer (Normal): share of the words it sees (%)', def: 3, min: 1, max: 100, step: 1, group: 'Computer' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"><rect x="2.5" y="8" width="6" height="6" rx="1.2"/><rect x="9" y="8" width="6" height="6" rx="1.2"/><rect x="15.5" y="8" width="6" height="6" rx="1.2"/><path d="M5.5 10v2.5M12 10.2h-1.2v2.3H12M18.5 10v2.5" stroke-linecap="round"/></svg>';
