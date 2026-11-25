// Five Letters: its names, its "?" explainer, its icon and its release default.
import { MODE_TUNE } from '../../core/race.js';

export const info = { name: 'Five Letters',       hint: 'Guess the hidden 5-letter word' };
export const release = 'released';   // the default (the admin's dashboard can change it)
export const minVersion = '1.14.0';   // (1.14.0: the first version with its rules as they are now, December 2026 audit; was 1.0.0); the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'brain';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Five Letters', play: "Guess a 5-letter word. Green: right spot. Blue: wrong spot. Grey: not in the word.", win: 'Guess the word. Use up {limit} guesses and you lose the square.' };   // ({limit}: its setting, TUNE below)
export const raceExplainer = { name: 'Five Letters', play: "You each have your own 5-letter word. Green: right spot. Blue: wrong spot. Grey: not in the word.", win: 'Guess your word first. No guess limit.' };   // Race mode (core/race.js, rv 2)
export const scExplainer = { name: 'Five Letters', play: "Guess a 5-letter word.", win: 'Guess the word. Use up {limit} guesses and you lose the square.' };   // in Super Chaos
// Its settings (the admin's Mini-game Settings; core/tune.js): the mode and the guesses each, dealt into each square (mode, limit); the rest read through tune(mini).
export const TUNE = [
  MODE_TUNE,
  { k: 'limit', label: 'Guesses each (Shared mode)', def: 5, min: 2, max: 12, step: 1, group: 'Rules' },
  { k: 'aiHeedEasy', label: "Easy: how much of each earlier guess's colours it keeps in mind (% of the guesses; the rest forgotten)", def: 50, min: 0, max: 100, step: 5, group: 'Computer: Easy' },
  { k: 'aiPoolEasy', label: 'Easy: picks at random among this many of the words with the commonest letters that fit what it remembers', def: 8, min: 1, max: 40, step: 1, group: 'Computer: Easy' },
  { k: 'aiPoolNormal', label: 'Normal: picks at random among this many of the words with the commonest letters that fit every clue', def: 2, min: 1, max: 20, step: 1, group: 'Computer: Normal' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="7" width="6" height="6" rx="1"/><rect x="9" y="7" width="6" height="6" rx="1" opacity=".45"/><rect x="16" y="7" width="6" height="6" rx="1" opacity=".45"/><rect x="2" y="14" width="6" height="6" rx="1" opacity=".45"/><rect x="9" y="14" width="6" height="6" rx="1"/><rect x="16" y="14" width="6" height="6" rx="1" opacity=".45"/></svg>';
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/wordle): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Guess the five-letter word. Green is the right spot, blue the wrong spot. Guess it to win.';
export const luckSkill = 4;
export const format = 'shared';
// The computer's levels (core/tune.js levelTune): Hard takes a moment longer over its guess (feel only).
export const AI_LEVELS = { think: { hard: 250 } };
