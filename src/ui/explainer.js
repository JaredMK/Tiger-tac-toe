// The "?" explainer pop-up and How to Play (each game's meta.js: explainer).
import { PHYS_TYPES } from '../games/shared/physics.js';
import { GAMES } from '../games/index.js';
import { testBadge, visibleTypes } from '../net/releases.js';
import { app } from './app.js';
import { CHEV, ICONS } from './art.js';
import { fxAt, fxAttr, startFx } from './fx.js';
import { scheduleCpu } from './turns.js';

/* ----- explainers: the rules in short, from the "?" in a mini-game, the game list, or How to Play ----- */
const RULES_CORE = [
  'Tic-tac-toe, where every square is its own mini-game. Win the mini-game to claim the square. Get three squares in a row to win.',
  'On your turn, make one move in any square. Every game keeps going until someone wins it.',
  'Once neither player can get three in a row any more, the match ends in a draw.',
];
export const EXPLAIN = Object.fromEntries(Object.keys(GAMES).map(t => [t, GAMES[t].meta.explainer]));
export let explainT = null;                          // the mini-game whose explainer is open
export const qBtn = (t, cls) => `<button class="qbtn${cls ? ' ' + cls : ''}" data-act="explain" data-t="${t}" aria-label="How to play ${EXPLAIN[t].name}">${cls === 'sm' ? '<i>?</i>' : '?'}</button>`;   // the small one: a 26px sticker in a 40px tap target
export function renderExplain() {
  const x = explainT && EXPLAIN[explainT];
  if (!x) return '';
  return `<div class="explain" data-act="explain-close" role="dialog" aria-modal="true" aria-label="How to play ${x.name}"${fxAttr(fxAt('explain', explainT))}><div class="excard">
    <h2>${ICONS[explainT]}<span>${x.name}</span></h2>
    <p class="exline play"><b>Play</b><span>${x.play}</span></p>
    <p class="exline win"><b>Win</b><span>${x.win}</span></p>
    <small>Tap anywhere to close</small></div></div>`;
}
// Opened and closed in place: the screen underneath is not drawn again (no scroll jump, no move used).
export function openExplain(t) {
  if (!EXPLAIN[t]) return;
  closeExplain(true);
  explainT = t;
  startFx('explain', t);
  app.insertAdjacentHTML('beforeend', renderExplain());
  scheduleCpu();
}
export function closeExplain(quiet) {
  const el = app.querySelector('.explain');
  if (el) el.remove();
  if (!explainT) return;
  explainT = null;
  if (!quiet) scheduleCpu();
}
export function renderHowTo() {
  return `<main class="scr setup howto-scr">
    <div class="bar"><button class="back" data-act="menu" aria-label="Back to the main menu">${CHEV}Menu</button>
      <div class="ttl"><b>How to Play</b></div></div>
    <div class="setup-box" data-keep-scroll="howto">
      <div class="rulecard">${RULES_CORE.map(t => `<p>${t}</p>`).join('')}</div>
      <div class="games-h"><span>Mini-games</span><small>Tap one for its rules</small></div>
      <div class="games howlist">${visibleTypes().map(t => `<button class="chk how" data-act="explain" data-t="${t}" aria-label="How to play ${EXPLAIN[t].name}">${ICONS[t]}<span>${EXPLAIN[t].name}</span>${testBadge(t)}<i class="qbtn sm" aria-hidden="true">?</i></button>`).join('')}</div>
      ${visibleTypes().includes('trivia') || visibleTypes().some(t => PHYS_TYPES.includes(t) || t === 'pinball') ? `<div class="games-h"><span>Credits</span></div><div class="rulecard credits">${visibleTypes().includes('trivia') ? '<p>Trivia questions from the <a href="https://opentdb.com" target="_blank" rel="noopener noreferrer">Open Trivia Database</a>, opentdb.com, <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>.</p>' : ''}${visibleTypes().some(t => PHYS_TYPES.includes(t) || t === 'pinball') ? '<p>Mini Golf, Pool, Bowling and Pinball run on <a href="https://brm.io/matter-js" target="_blank" rel="noopener noreferrer">Matter.js</a> (MIT licence).</p>' : ''}</div>` : ''}
    </div></main>`;
}
