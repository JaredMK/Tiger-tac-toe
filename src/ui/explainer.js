// The "?" explainer pop-up and How to Play (each game's meta.js: explainer).
import { pigConfig, pigGoal } from '../games/pig/rules.js';
import { wheelsConfig } from '../games/wheels/rules.js';
import { tune, tuneLive } from '../core/tune.js';
import { PHYS_TYPES } from '../games/shared/physics.js';
import { GAMES, SC_ONLY } from '../games/index.js';
import { SUPER_CHAOS_ENABLED } from '../core/config.js';
import { privacyUrl } from '../net/platform.js';
import { testBadge, visibleTypes } from '../net/releases.js';
import { app, state } from './app.js';
import { CHEV, ICONS } from './art.js';
import { fxAt, fxAttr, startFx } from './fx.js';
import { chaosSetup } from './screens/setup.js';
import { scheduleCpu } from './turns.js';

/* ----- explainers: the rules in short, from the "?" in a mini-game, the game list, or How to Play ----- */
const RULES_CORE = [
  'Tic-tac-toe, where every square is its own mini-game. Win the mini-game to claim the square. Get three squares in a row to win.',
  'On your turn, make one move in any square.',
  'Once neither player can get three in a row any more, the match ends in a draw.',
];
export const EXPLAIN = Object.fromEntries(Object.keys(GAMES).map(t => [t, GAMES[t].meta.explainer]));
// Super Chaos: the mode's own explainer (its switch on the setup screen), and a game's Super Chaos rules where they differ.
const SC_EXPLAIN = { name: 'Super Chaos', play: "Both players move at the same time. Each round, pick any square and make one move. When you're both done (or time runs out), you'll see what your opponent did. If both players win the same square in the same round, it resets. Run out of time and you miss the round; miss two in a row and you lose.", win: 'Three in a row wins.' };   // (against the computer and online alike)
// The Mode selector's "?": the two modes, one plain line each.
const MODE_EXPLAIN = { name: 'Mode', lines: [['Super Chaos', 'X and O move at the same time.'], ['Classic', 'X goes first, then you take turns.']] };
const SC_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linejoin="round"><path d="M13.5 2 5 13.5h6L9.5 22 19 9.5h-6z"/></svg>';
const scNow = () => !!(state.sc && ['board', 'mini'].includes(state.screen)) || (state.screen === 'setup' && chaosSetup());
export function explainOf(t) {
  if (t === 'superchaos') return SC_EXPLAIN;
  if (t === 'mode') return MODE_EXPLAIN;
  return fillTune(t, (scNow() && GAMES[t] && GAMES[t].meta.scExplainer) || EXPLAIN[t]);
}
// A setting in the text ({k}: meta.js TUNE, or a game's own config named in its EXPLAIN_KEYS): the square's own
// value when it is open, else the one dealt now.
const CFG_KEYS = { pig: (mini) => ({ target: mini ? pigGoal(mini) : pigConfig().target }), wheels: (mini) => ({ target: mini ? mini.target : wheelsConfig().target }) };   // Risky Rolls' target (config/pig), Risky Spins' (config/wheels)
function fillTune(t, x) {
  if (!x || !x.play || !/\{\w+\}/.test(x.play + x.win)) return x;
  const sq = state.screen === 'mini' && state.squares && state.squares[state.zoom], open = sq && sq.mini && sq.mini.type === t ? sq.mini : null;
  const v = Object.assign({}, CFG_KEYS[t] ? CFG_KEYS[t](open) : {}, open ? tune(open) : tuneLive(t));
  const f = s => s.replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? String(v[k]) : m));
  return { name: x.name, play: f(x.play), win: f(x.win) };
}
export let explainT = null;                          // the mini-game whose explainer is open
export const qBtn = (t, cls) => `<button class="qbtn${cls ? ' ' + cls : ''}" data-act="explain" data-t="${t}" aria-label="How to play ${explainOf(t).name}">${cls === 'sm' ? '<i>?</i>' : '?'}</button>`;   // the small one: a 26px sticker in a 40px tap target
const CAT_LABEL = { luck: 'More luck', skill: 'More skill', brain: 'More brain' };   // a game's kind (meta.js category), at the top of its "?"
export function renderExplain() {
  const x = explainT && explainOf(explainT);
  if (!x) return '';
  return `<div class="explain" data-act="explain-close" role="dialog" aria-modal="true" aria-label="How to play ${x.name}"${fxAttr(fxAt('explain', explainT))}><div class="excard">
    <p class="excat">${GAMES[explainT] && CAT_LABEL[GAMES[explainT].meta.category] || '&nbsp;'}</p>
    <h2>${explainT === 'superchaos' || explainT === 'mode' ? SC_ICON : ICONS[explainT]}<span>${x.name}</span></h2>
    ${x.lines ? x.lines.map(([k, v]) => `<p class="exline wide"><b>${k}</b><span>${v}</span></p>`).join('') : `<p class="exline play"><b>Play</b><span>${x.play}</span></p>
    <p class="exline win"><b>Win</b><span>${x.win}</span></p>`}
    <small>Tap anywhere to close</small></div></div>`;
}
// Opened and closed in place: the screen underneath is not drawn again (no scroll jump, no move used).
export function openExplain(t) {
  if (!explainOf(t)) return;
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
      ${SUPER_CHAOS_ENABLED ? `<div class="games-h"><span>Modes</span><small>Tap for its rules</small></div>
      <div class="games howlist"><button class="chk how" data-act="explain" data-t="superchaos" aria-label="How to play Super Chaos">${SC_ICON}<span>Super Chaos</span><i class="qbtn sm" aria-hidden="true">?</i></button></div>` : ''}
      <div class="games-h"><span>Mini-games</span><small>Tap one for its rules</small></div>
      <div class="games howlist">${visibleTypes().filter(t => SUPER_CHAOS_ENABLED || !SC_ONLY.includes(t)).map(t => `<button class="chk how" data-act="explain" data-t="${t}" aria-label="How to play ${EXPLAIN[t].name}">${ICONS[t]}<span>${EXPLAIN[t].name}</span>${testBadge(t)}<i class="qbtn sm" aria-hidden="true">?</i></button>`).join('')}</div>
      <div class="games-h"><span>Credits</span></div><div class="rulecard credits">${visibleTypes().includes('trivia') ? '<p>Trivia questions from the <a href="https://opentdb.com" target="_blank" rel="noopener noreferrer">Open Trivia Database</a>, opentdb.com, <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>.</p>' : ''}${visibleTypes().some(t => PHYS_TYPES.includes(t) || t === 'pinball') ? '<p>Mini Golf, Pool, Bowling and Pinball run on <a href="https://brm.io/matter-js" target="_blank" rel="noopener noreferrer">Matter.js</a> (MIT licence).</p>' : ''}<p class="priv">What the game keeps about you, and how to delete your account: <a href="${privacyUrl()}" target="_blank" rel="noopener noreferrer">Privacy policy</a></p></div>
    </div></main>`;
}
