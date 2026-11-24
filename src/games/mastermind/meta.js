// Codebreaker: its names, its "?" explainer, its icon and its release default.
import { MODE_TUNE } from '../../core/race.js';

export const info = { name: 'Codebreaker',   hint: 'Crack the hidden 4-colour code' };
export const release = 'released';   // the default (the admin's dashboard can change it)
export const minVersion = '1.7.0';   // (1.7.0: the first version with its rules as they are now, December 2026 audit; was 1.0.0); the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'brain';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Codebreaker', play: 'Guess the 4-colour code. Black marker means right colour and spot; white marker means right colour, wrong spot.', win: 'Crack the code.' };
export const raceExplainer = { name: 'Codebreaker', play: "Each of you has your own hidden 4-colour code. Black marker means right colour and spot; white marker means right colour, wrong spot. The other player's guesses show under yours.", win: 'Crack your code first.' };   // Race mode (core/race.js)
export const scExplainer = { name: 'Codebreaker', play: "Guess the 4-colour code. Black marker means right colour and spot; white marker means right colour, wrong spot.", win: 'Crack the code.' };   // in Super Chaos
// Its settings (the admin's Mini-game Settings; core/tune.js): read through tune(mini).
export const TUNE = [
  MODE_TUNE,
  { k: 'colors', label: 'Colours to choose from', def: 6, min: 4, max: 6, step: 1, group: 'Rules' },
  { k: 'aiHeedEasy', label: "Easy: how much of the feedback it uses (% of the earlier rows it keeps in mind; it guesses any code that fits those)", def: 70, min: 0, max: 100, step: 5, group: 'Computer: Easy' },
  { k: 'aiSplitNormal', label: 'Normal: how often it picks the code that rules out the most (% of guesses; else any code that still fits)', def: 50, min: 0, max: 100, step: 5, group: 'Computer: Normal' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="8" r="3"/><circle cx="12" cy="8" r="3"/><circle cx="19" cy="8" r="3"/><circle cx="8.5" cy="17" r="2.2"/><circle cx="15.5" cy="17" r="2.2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/mastermind): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Crack the hidden four-colour code. The markers tell you how close each guess is.';
export const luckSkill = 4;
export const format = 'shared';
