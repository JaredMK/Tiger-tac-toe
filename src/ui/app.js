// The page's state and its shared bits: the match state (saved on this phone), the timings, names and
// small helpers every screen uses.
import { leaveSquare, mainResult } from '../core/board.js';
import { newState, normLocal, normSetup, playerName } from '../core/match.js';
import { upgradeMini } from '../core/minis.js';
import { makeRng } from '../core/random.js';
import { PLAY, newTimer } from '../core/timer.js';
import { markCoins } from '../games/coins/rules.js';
import { TYPES } from '../games/index.js';
import { blocked, validCode } from '../net/room.js';
import { reportLocal, trackEnd } from '../net/tracking.js';
import { CPU_ICON } from './art.js';
import { KEY } from './config.js';
import { render } from './render.js';
import { scheduleCpu } from './turns.js';

export const RNG = makeRng(Array.from(crypto.getRandomValues(new Uint32Array(4))).join('.'));   // the page's own randomness, for the engine
// How long a result stays up once its animation has played (a toast for a plain move, a card for a
// claim, a draw or a Risky Rolls bust/bank); then the board comes back on its own and the turn passes.
export const FLASH_MS = PLAY.flash;            // (the timings live in the engine: the turn clock counts them too)
export const MEMORY_MS = 2000;                 // the two flipped cards stay up this long
export const FLIP_MS = PLAY.flip;              // ...then turn back over before the board returns
export const CPU_MS = { think: 700, spot: 1000, zoom: 500, pre: 450, again: 600 };   // the computer: a pause to think, its square lit up on the board, a look at the square, its choice shown, the next bonus move
export const SPOT_MS = PLAY.spot;              // how long the other player's square glows on the board before the zoom
export const TIMER_LABEL = { 0: 'No limit', 30: '30s', 60: '1 min', 180: '3 min' };
export const SPIN_MS = PLAY.spin, HOP_MS = PLAY.hop;   // Candy race: the wheel's spin, then each hop of the token (the Dice race hops the same way)
export const REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
export const WAAPI = typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';
export const app = document.getElementById('app');
export let state = load() || newState(RNG);
export let flashTimer = null, noticeTimer = null, flashReady = 0;   // flashReady: when the result may be tapped away (its animation is over)
export let lastView = null, entering = false;                         // which screen (and square) was last drawn, so the zoom-in plays once
export let cpuTimer = null, cpuPlan = null, holdTimer = null;          // the computer's next step, its chosen move, and Memory's flip-back pause
export let spotTimer = null, menuOpen = false, menuStep = 'main', menuNote = '';   // the pre-zoom glow, the in-game menu, a note for the main menu
export let clockTimer = null;
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const N = p => (cpuPlays(p) ? CPU_ICON : '') + esc(playerName(state, p));   // a player's display name, safe for innerHTML, with the computer icon for a computer
export function cpuPlays(p) { return !state.online && !!state.cpu && state.cpu.includes(p); }
export const pickKey = () => (state.pick == null ? null : `${state.pickSq}:${state.pick}`);   // Memory: the first card turned up, as an event key
export let advOpen = false;                    // the setup screen's Advanced section (the mini-game list)
export const mv = x => `data-m='${JSON.stringify(x)}'`;
export const NAV_SCREENS = ['login', 'username', 'find', 'leaderboard', 'profile', 'profhist', 'hreview', 'hreview-mini', 'howto'];
// Render with another state in place of the live one (a past game), and put the live one back.
export function withView(v, fn) { const live = state; state = v; try { return fn(); } finally { state = live; } }
export function zoomedType() {
  if (state.screen !== 'mini' || state.zoom == null || state.flash || state.done || state.winner || blocked()) return null;
  const sq = state.squares[state.zoom];
  return sq && !sq.owner ? sq.mini.type : null;
}

export function commit() { trackEnd(); reportLocal(); save(); render(); scheduleCpu(); }
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* no storage: just play without resume */ }
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.v === 4 && Array.isArray(s.squares) && s.squares.length === 9 && (s.turn === 'X' || s.turn === 'O') && s.setup) {
      if (s.lock != null && !s.winner) { s.screen = 'mini'; s.zoom = s.lock; }
      else if (s.done && !s.flash && !s.winner) leaveSquare(s);   // a result that was still on show: the board was next anyway
      s.notice = null; s.sel = []; s.stamp = null; s.spot = null;
      if (!s.timer || typeof s.timer !== 'object') s.timer = newTimer(0);
      if (s.setup.timer == null) s.setup.timer = 0;
      if (!s.setup.mode) s.setup.mode = 'two';
      if (!s.setup.human) s.setup.human = 'X';
      if (!['X', 'O', 'XO'].includes(s.cpu)) s.cpu = null;
      normSetup(s.setup);
      if (s.screen === 'review' || s.screen === 'review-mini') s.screen = s.winner ? 'win' : 'board';
      const mm = s.online && s.online.kind === 'mm' && typeof s.online.game === 'string' && /^[-\w]{8,40}$/.test(s.online.game);
      if (!mm && !(s.online && (s.online.role === 'host' || s.online.role === 'guest') && validCode(s.online.code))) s.online = null;
      if (['login', 'username', 'find', 'leaderboard', 'profile', 'profhist', 'hreview', 'hreview-mini', 'howto'].includes(s.screen)) s.screen = mm ? 'board' : 'menu';
      if (s.online) {
        if (s.online.me !== 'X' && s.online.me !== 'O') s.online.me = null;
        if (!Number.isInteger(s.online.shownSeq)) s.online.shownSeq = null;
        if (typeof s.online.matchId !== 'string') s.online.matchId = null;
        s.flash = null; s.done = null; s.spot = null;              // a move cut short by the reload plays back from the room
        if (!['board', 'mini', 'win', 'setup', 'join'].includes(s.screen)) s.screen = mm ? 'board' : s.online.role === 'host' ? 'setup' : 'join';
      }
      for (const sq of s.squares) if (sq.mini.type === 'memory' && !Array.isArray(sq.mini.seen)) sq.mini.seen = [];
      for (const sq of s.squares) upgradeMini(sq.mini);                     // Connect 4 grew from 5 to 7 columns
      if ('dice' in s.setup.games && !('snakes' in s.setup.games)) s.setup.games.snakes = s.setup.games.dice;   // Snakes and Ladders took the Dice race's place in the list
      for (const t of TYPES) if (!(t in s.setup.games)) s.setup.games[t] = true;   // a game added since the save is on by default
      if (!TYPES.some(t => s.setup.games[t])) for (const t of TYPES) s.setup.games[t] = true;   // only games no longer dealt were on (Hexapawn alone): all on again
      normLocal(s.setup);                                         // Play Local's players, from an older Human/Computer-per-side setup
      if (!s.online && !s.winner && s.squares.some(sq => !sq.owner && sq.mini.type === 'coins' && !(sq.mini.marks && sq.mini.marks.by === s.turn))) markCoins(s, s.turn, RNG);   // a match from before the marks
      if (!s.online && !s.winner && !s.flash) {                  // a local match already beyond a line for either side (from before the draw rule): a draw now
        const mr = mainResult(s.squares);
        if (mr && mr.winner === 'draw') Object.assign(s, { winner: 'draw', winLine: null, winReason: 'blocked', counts: mr.counts, lock: null, done: null, screen: 'win', zoom: null });
      }
      return s;
    }
  } catch (e) { /* ignore corrupt saves */ }
  return null;
}

// Setters for the names other modules reassign (an imported name is read-only there).
export function setAdvOpen(v) { advOpen = v; }
export function setClockTimer(v) { clockTimer = v; }
export function setCpuPlan(v) { cpuPlan = v; }
export function setCpuTimer(v) { cpuTimer = v; }
export function setEntering(v) { entering = v; }
export function setFlashReady(v) { flashReady = v; }
export function setFlashTimer(v) { flashTimer = v; }
export function setHoldTimer(v) { holdTimer = v; }
export function setLastView(v) { lastView = v; }
export function setMenuNote(v) { menuNote = v; }
export function setMenuOpen(v) { menuOpen = v; }
export function setMenuStep(v) { menuStep = v; }
export function setNoticeTimer(v) { noticeTimer = v; }
export function setSpotTimer(v) { spotTimer = v; }
