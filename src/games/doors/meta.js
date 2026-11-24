// Door Drop: its names, its "?" explainer, its icon, its release default and its settings.
import { AGAIN_TUNE } from '../../core/tune.js';

export const info = { name: 'Door Drop', hint: 'Pick a door on each floor. One leads down. First to the ground wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.35.0';   // the oldest client version that has this game (core/client.js)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const explainer = { name: 'Door Drop', play: 'Start on the top floor and pick a door. One door on each floor drops you to the floor below. The rest are dead ends: you come out of another dead end on the same floor. Doors always lead to the same place. Nothing is marked: every door looks the same, tried or not, so remember where you went.{towerText}{goAgain}', win: 'First to the ground floor wins.' };
// {towerText}: the towers' sentence by the setting; {goAgain}: its sentence only while "Go again on success" is on.
export const explainVars = v => ({ towerText: v.towers === 'shared' ? ' One tower for both. Watch where your rival goes.' : ' You each have a tower, built the same. Watch where your rival goes.' });
export const goAgainText = { on: ' Found the way down? Pick again.', off: '' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V4h14v17"/><path d="M9.5 21v-6h5v6"/><path d="M8 7.5h2.5v3H8zM13.5 7.5H16v3h-2.5z"/><path d="M12 13.5v-2"/></svg>';
// Its settings (the admin's Games page; core/tune.js): the floors with doors, how many doors every floor has (one the
// way down, the rest dead ends linked to each other), one tower each or one for both, Go again on success, and how
// much the computer forgets of the doors it has seen tried (nothing is marked: its levels differ by memory).
export const TUNE = [
  { k: 'floors', label: 'Floors with doors (above the ground)', def: 3, min: 1, max: 8, step: 1, group: 'Board' },
  { k: 'doors', label: 'Doors per floor (one leads down, the rest are dead ends linked to each other)', def: 4, min: 3, max: 6, step: 1, group: 'Board' },
  { k: 'towers', label: 'Towers (separate: one each, built the same; shared: one for both)', def: 'separate', opts: ['separate', 'shared'], group: 'Rules' },
  AGAIN_TUNE,
  { k: 'forget', label: 'Chance to forget a door it has seen tried, each pick (%)', def: 30, min: 0, max: 100, step: 1, group: 'Computer: Normal' },
  { k: 'forgetHard', label: 'Chance to forget a door it has seen tried, each pick (%)', def: 0, min: 0, max: 100, step: 1, group: 'Computer: Hard' },
  { k: 'forgetEasy', label: 'Chance to forget a door it has seen tried, each pick (%)', def: 70, min: 0, max: 100, step: 1, group: 'Computer: Easy' },
];
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/doors): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Pick a door on each floor: one drops you down. Nothing is marked, so remember! First to the ground wins.';
export const luckSkill = 3;
export const format = 'race';
