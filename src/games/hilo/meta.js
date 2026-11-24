// Higher/Lower: its names, its "?" explainer, its icon and its release default.
import { MODE_TUNE } from '../../core/race.js';

export const info = { name: 'Higher/Lower', hint: 'Guess the number from 1 to 30 in 5 guesses' };
export const release = 'released';   // the default (the admin's dashboard can change it)
export const minVersion = '1.14.0';   // (1.14.0: the first version with its rules as they are now, December 2026 audit; was 1.0.0); the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Higher/Lower', play: "Guess a number from 1 to {hi}. You'll be told higher or lower.", win: 'Guess it. Use up {limit} guesses and you lose the square.' };   // ({hi}, {limit}: its settings, TUNE below)
export const raceExplainer = { name: 'Higher/Lower', play: "You each have your own number from 1 to {hi}. Guess yours: you'll be told higher or lower. You can watch the other player close in on theirs.", win: 'Guess your number first. No guess limit.' };   // Race mode (core/race.js, rv 2)
export const scExplainer = { name: 'Higher/Lower', play: "Guess a number from 1 to {hi}. You'll be told higher or lower.", win: 'Guess it. Use up {limit} guesses and you lose the square.' };   // in Super Chaos
// Its settings (the admin's Mini-game Settings; core/tune.js): dealt into each square (top, limit).
export const TUNE = [
  MODE_TUNE,
  { k: 'hi', label: 'Highest number', def: 30, min: 10, max: 99, step: 1, group: 'Rules' },
  { k: 'limit', label: 'Guesses each (Shared mode)', def: 5, min: 2, max: 12, step: 1, group: 'Rules' },
  { k: 'aiSpreadEasy', label: 'Easy: the guesses it weighs, the middle part of what is left (% of the range; 0 = just the middle)', def: 0, min: 0, max: 100, step: 5, group: 'Computer: Easy' },
  { k: 'aiSharpEasy', label: 'Easy: how often it takes the one with the best odds among those (%; else any of them)', def: 0, min: 0, max: 100, step: 5, group: 'Computer: Easy' },
  { k: 'aiRaceEasy', label: 'Easy, Race mode: how far from the middle it may guess (% of the range; 0 = always the middle, the fastest)', def: 100, min: 0, max: 100, step: 5, group: 'Computer: Easy' },
  { k: 'aiSpreadNormal', label: 'Normal: the guesses it weighs, the middle part of what is left (% of the range; 0 = just the middle)', def: 100, min: 0, max: 100, step: 5, group: 'Computer: Normal' },
  { k: 'aiSharpNormal', label: 'Normal: how often it takes the one with the best odds among those (%; else any of them)', def: 0, min: 0, max: 100, step: 5, group: 'Computer: Normal' },
  { k: 'aiRaceNormal', label: 'Normal, Race mode: how far from the middle it may guess (% of the range; 0 = always the middle, the fastest)', def: 40, min: 0, max: 100, step: 5, group: 'Computer: Normal' },
  { k: 'aiSpreadHard', label: 'Hard: the guesses it weighs, the middle part of what is left (% of the range; 0 = just the middle)', def: 100, min: 0, max: 100, step: 5, group: 'Computer: Hard' },
  { k: 'aiSharpHard', label: 'Hard: how often it takes the one with the best odds among those (%; else any of them)', def: 100, min: 0, max: 100, step: 5, group: 'Computer: Hard' },
  { k: 'aiRaceHard', label: 'Hard, Race mode: how far from the middle it may guess (% of the range; 0 = always the middle, the fastest)', def: 0, min: 0, max: 100, step: 5, group: 'Computer: Hard' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m6 10 6-6 6 6M6 14l6 6 6-6"/></svg>';
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/hilo): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Guess the number and hear higher or lower. Find it before your guesses run out.';
export const luckSkill = 3;
export const format = 'shared';
