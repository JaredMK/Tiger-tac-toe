// Gem Swap: its names, its "?" explainer, its icon, its release default and its settings (December 2026).
import { AGAIN_TUNE } from '../../core/tune.js';

export const info = { name: 'Gem Swap', hint: 'Swap two gems to line up three or more. Every gem that bursts is a point' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.30.0';   // the oldest client version that has this game (core/client.js)
export const category = 'brain';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const explainer = { name: 'Gem Swap', play: 'Swap two gems side by side to line up three or more of a kind. They burst, new gems drop in, and anything that lines up then bursts too. Every gem burst is a point.{goAgain}', win: 'First to {target} points.{evenText}' };
// {goAgain} in the explainer: the text below while "Go again on success" is on (AGAIN_TUNE), nothing while off; its
// number is the square's own (explainVars: ui/explainer.js fillTune fills a text once, so the words are made here).
export const goAgainText = { on: ' Burst a big bunch with one swap and you go again.', off: '' };
export const explainVars = v => ({ goAgain: v.again === 'on' ? ` Burst ${v.againAt} or more with one swap and you go again.` : '', evenText: v.even === 'on' ? ' If the first to move gets there first, the other player gets one turn to answer: the higher score wins.' : '' });
// The icon: a cut gem (a crown and a pavilion) with a sparkle.
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4.500h10l4 5-9 10.500-9-10.500z"/><path d="M3 9.500h18M9.500 9.500 12 20l2.500-10.500M7 4.500l2.500 5 2.500-5 2.500 5 2.500-5"/></svg>';
// Its settings (the admin's Games page; core/tune.js): read with gemsCfg(mini); the board's size and the kinds of gem
// are taken as a square is dealt and stay with it (mini.n, mini.kinds). Chosen by tests/sim/gems.sim.js: see its header.
export const AI_LEVELS = { think: { normal: 150, hard: 300 } };
export const TUNE = [
  AGAIN_TUNE,
  { k: 'againAt', label: 'Go again: gems burst by one swap', def: 6, min: 4, max: 20, step: 1, group: 'Rules' },
  { k: 'target', label: 'Points to win', def: 32, min: 6, max: 80, step: 1, group: 'Rules' },
  { k: 'even', label: 'Equal turns (the other player answers; the higher score wins)', def: 'on', opts: ['off', 'on'], group: 'Rules' },   // (on by default, December 2026: first to the target outright gave the first mover 60-61%; with the answer, 48%)
  { k: 'size', label: 'Board size (a side)', def: 7, min: 5, max: 8, step: 1, group: 'Board' },
  { k: 'kinds', label: 'Kinds of gem', def: 6, min: 4, max: 6, step: 1, group: 'Board' },
  { k: 'aiEasy', label: 'Swaps taken at random rather than the best (%)', def: 65, min: 0, max: 100, step: 5, group: 'Computer: Easy' },
  { k: 'aiNormal', label: 'Swaps taken at random rather than the best (%)', def: 30, min: 0, max: 100, step: 5, group: 'Computer: Normal' },
  { k: 'aiHard', label: 'How much it weighs the best swap it would leave you (%)', def: 60, min: 0, max: 100, step: 5, group: 'Computer: Hard' },
];
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/gems): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Swap two gems to line up three or more. Every gem burst is a point. Reach the target first.';
export const luckSkill = 3;
export const format = 'shared';
