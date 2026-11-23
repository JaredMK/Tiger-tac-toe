// Backgammon Lite: its names, its "?" explainer, its icon, its release default and its settings.
import { AGAIN_TUNE } from '../../core/tune.js';

export const info = { name: 'Backgammon Lite', hint: 'Roll and race your 3 pieces off the far end' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.23.0';   // (1.23.0: v 4, every point hittable, the last too, and a die reaching the last point exactly lands there; 1.19.0: the bar, a hit piece waiting off the board and coming back in first; 1.12.0: the turn sent whole, { steps }) the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = false;   // never in Super Chaos (one shared track: the pieces meet)
export const explainer = { name: 'Backgammon Lite', play: 'Your 3 pieces start on your first point. Roll two dice. Each die moves a piece that many points; a double moves four times. Land on a lone enemy piece to knock it onto the bar. A piece on the bar must come back in before any other piece moves: it enters on the point the die shows, counted from its own start, unless two or more enemy pieces hold that point. No way in? The turn ends. Two of your pieces on a point block it. Once all your pieces are in your home zone, the last {home} points, any roll that takes it past the last point bears a piece off.{goAgain}', win: 'Move all 3 of your pieces off first.' };
// {goAgain} in the explainer: the text below while "Go again on success" is on (AGAIN_TUNE), the other while off (ui/explainer.js fillTune).
export const goAgainText = { on: ' Move a piece off? Roll again.', off: '' };
// Its settings (the admin's Mini-game Settings; core/tune.js): read with tune(mini). The track's length is dealt into
// the square (mini.n). Tuned by tests/sim/bglite.sim.js (reworked November 2026: 8 points, a home zone of the last 3,
// the opener's first roll one die; Normal against Normal about 4.5 turns a player, the winner 4.7, the first mover
// about 49%; Hard against Hard 4.2, 49%).
export const TUNE = [
  AGAIN_TUNE,
  { k: 'len', label: 'Track length (points)', def: 10, min: 5, max: 16, step: 1, group: 'Board' },   // (December 2026: 10 with the home zone of 6; 8 gave the first mover 59-61%: tests/sim/bglite.sim.js)
  { k: 'home', label: 'Home zone (the last points of the track)', def: 6, min: 1, max: 16, step: 1, group: 'Board' },   // (December 2026: 6, was 3; never more than the track: rules.js bglHome)
  { k: 'aiHit', label: 'Computer: worth of a hit (points of race)', def: 6, min: 0, max: 15, step: 0.5, group: 'Computer' },
  { k: 'aiBlot', label: 'Computer: risk of a lone piece (points)', def: 4, min: 0, max: 15, step: 0.5, group: 'Computer' },
  { k: 'aiBlock', label: 'Computer: worth of a block (points)', def: 2, min: 0, max: 10, step: 0.5, group: 'Computer' },
  { k: 'miss', label: 'Computer mistake rate (%)', def: 0, min: 0, max: 100, step: 5, group: 'Computer' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4.5h18v15H3z"/><path d="M5 4.5l2 7 2-7M11 4.5l2 7 2-7M15 19.5l2-7 2 7M9 19.5l2-7 2 7"/><circle cx="7" cy="16.5" r="1.6" fill="currentColor"/><circle cx="17" cy="7.5" r="1.6"/></svg>';
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/bglite): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Race three pieces round the track by dice, knocking lone ones off. Bear all three off first.';
export const luckSkill = 2;
export const format = 'shared';
