// Hangman: its names, its "?" explainer, its icon and its release default.
import { AGAIN_TUNE } from '../../core/tune.js';
import { MODE_TUNE } from '../../core/race.js';

export const info = { name: 'Hangman',      hint: 'Right letter: go again. Last letter wins' };
export const release = 'released';   // the default (the admin's dashboard can change it)
export const minVersion = '1.14.0';   // (1.14.0: the first version with its rules as they are now, December 2026 audit; was 1.0.0); the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Hangman', play: 'Guess a letter.{goAgain}', win: 'Reveal the last letter.' };
export const raceExplainer = { name: 'Hangman', play: "You each have your own word, the same length. Guess a letter.{goAgain} You can see the other player's word fill in.", win: 'Reveal the last letter of your word first.' };   // Race mode (core/race.js, rv 2)
export const scExplainer = { name: 'Hangman', play: "Guess a letter. Got one right? Go again.", win: 'Reveal the last letter.' };   // in Super Chaos
// Its settings (the admin's Mini-game Settings; core/tune.js): the mode, dealt into each square; the rest read through tune(mini).
// {goAgain} in the explainer: the text below while "Go again on success" is on (AGAIN_TUNE), the other while off (ui/explainer.js fillTune).
export const goAgainText = { on: ' Got one right? Go again.', off: '' };
export const TUNE = [
  AGAIN_TUNE,
  MODE_TUNE,
  { k: 'minLen', label: 'Shortest word (letters)', def: 5, min: 5, max: 7, step: 1, group: 'Rules' },
  { k: 'maxLen', label: 'Longest word (letters)', def: 7, min: 5, max: 7, step: 1, group: 'Rules' },
  { k: 'aiPoolEasy', label: 'Easy: picks at random among this many of the most common letters (E, T, A, O...) it has not tried', def: 6, min: 1, max: 12, step: 1, group: 'Computer: Easy' },
  { k: 'aiListEasy', label: 'Easy: how often it thinks about which words fit instead (% of guesses)', def: 10, min: 0, max: 100, step: 5, group: 'Computer: Easy' },
  { k: 'aiPoolNormal', label: 'Normal: picks at random among this many of the letters in the most words that fit (1 = always the likeliest)', def: 1, min: 1, max: 6, step: 1, group: 'Computer: Normal' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 21h8M8 21V3h9v4"/><circle cx="17" cy="10" r="2.5"/><path d="M17 12.5v5"/></svg>';
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/hangman): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Guess a letter at a time. Reveal the last letter of the word to win.';
export const luckSkill = 3;
export const format = 'shared';
