// Hangman: its names, its "?" explainer, its icon and its release default.
import { MODE_TUNE } from '../../core/race.js';

export const info = { name: 'Hangman',      hint: 'Right letter: go again. Last letter wins' };
export const release = 'released';   // the default (the admin's dashboard can change it)
export const minVersion = '1.0.0';   // the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Hangman', play: 'Guess a letter. Got one right? Go again.', win: 'Reveal the last letter.' };
export const raceExplainer = { name: 'Hangman', play: 'Guess a letter. Got one right? Go again. Your letters are yours alone: you see only which blanks the other player has filled and how many letters they got wrong.', win: 'Reveal the last letter first.' };   // Race mode (core/race.js)
export const scExplainer = { name: 'Hangman', play: "Guess a letter. Got one right? Go again.", win: 'Reveal the last letter.' };   // in Super Chaos
// Its settings (the admin's Mini-game Settings; core/tune.js): the mode, dealt into each square; the rest read through tune(mini).
export const TUNE = [
  MODE_TUNE,
  { k: 'minLen', label: 'Shortest word (letters)', def: 5, min: 5, max: 7, step: 1, group: 'Rules' },
  { k: 'maxLen', label: 'Longest word (letters)', def: 7, min: 5, max: 7, step: 1, group: 'Rules' },
  { k: 'miss', label: 'Computer random letter rate (%)', def: 0, min: 0, max: 60, step: 1, group: 'Computer' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 21h8M8 21V3h9v4"/><circle cx="17" cy="10" r="2.5"/><path d="M17 12.5v5"/></svg>';
