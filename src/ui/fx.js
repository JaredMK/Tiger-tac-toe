// Animations: each one started by the event that causes it, exactly once; bursts and count-ups.
import { playMs } from '../core/timer.js';
import { ATT, ATT_TYPES, attMs } from '../games/shared/attention.js';
import { FINGER_TYPES, fingMs } from '../games/shared/finger.js';
import { bullsAim } from '../games/bullseye/rules.js';
import { bullsPre } from '../games/bullseye/view.js';
import { BUST } from '../games/bus/rules.js';
import { busPre } from '../games/bus/view.js';
import { echoAim } from '../games/echo/rules.js';
import { echoPre } from '../games/echo/view.js';
import { lanePre } from '../games/lane/view.js';
import { ODD } from '../games/oddone/rules.js';
import { oddPre } from '../games/oddone/view.js';
import { TRIVIA } from '../games/trivia/rules.js';
import { triviaPre } from '../games/trivia/view.js';
import { SND } from '../audio/sound.js';
import { REDUCED, WAAPI, app, state } from './app.js';
import { attPre } from './attention.js';
import { BOARD_BURST } from './board.js';
import { fingPre } from './finger.js';
import { hopToken } from './track.js';

// A comic-book burst with uneven points, and its word.
export function burstSvg(word, cls, w, h, size) {
  let seed = word.length * 31 + w;
  const r = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const n = 12, pts = [];
  for (let k = 0; k < n * 2; k++) {
    const a = k * Math.PI / n - Math.PI / 2, f = k % 2 === 0 ? 0.88 + r() * 0.12 : 0.62 + r() * 0.08;
    pts.push(`${(w / 2 + Math.cos(a) * (w / 2 - 3) * f).toFixed(1)},${(h / 2 + Math.sin(a) * (h / 2 - 3) * f).toFixed(1)}`);
  }
  size = Math.min(size, w * .72 / (word.length * .62));          // a long word gets a smaller size to stay inside the burst
  return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true"><polygon class="bst ${cls}" points="${pts.join(' ')}"/><text class="bursttxt" x="${w / 2}" y="${(h / 2 + size * .36).toFixed(1)}" font-size="${size.toFixed(1)}" text-anchor="middle">${word}</text></svg>`;
}
// The bursts when a square is won: two words each time, drawn at random from BURSTS, never one that
// was on show the time before. A showing keeps its words and its timing through re-renders, pops out
// about a second after it pops in, and is then taken off the page (so it never stays, even with
// animations turned off).
export const BURSTS = ['POW!', 'BAM!', 'CHAOS!', 'BOOM!', 'KAPOW!', 'WHAM!', 'ZAP!', 'SMASH!', 'CRUNCH!', 'YOINK!', 'SNATCHED!', 'MINE!', 'CLAIMED!', 'GOTCHA!', 'KABLAM!', 'BOP!'];
export const BURST_MS = 1100;                    // in, about a second on show, out
let burstShow = null, burstLast = [], burstTimer = null;
export function burstPick(key) {
  if (!burstShow || burstShow.key !== key) {
    const pool = BURSTS.filter(w => !burstLast.includes(w));
    const a = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    const b = pool[Math.floor(Math.random() * pool.length)];
    burstShow = { key, words: [a, b], at: performance.now() };
    burstLast = burstShow.words;
  }
  return { words: burstShow.words, at: burstShow.at, el: Math.round(performance.now() - burstShow.at) };
}
// After each render: a burst whose time is up leaves the page.
export function sweepBursts() {
  clearTimeout(burstTimer); burstTimer = null;
  const now = performance.now();
  let next = Infinity;
  for (const e of app.querySelectorAll('[data-bend]')) {
    const end = Number(e.dataset.bend);
    if (end <= now) e.remove(); else next = Math.min(next, end);
  }
  if (next < Infinity) burstTimer = setTimeout(sweepBursts, next - now + 20);
}
/* ----- animations: each one started by the event that causes it, exactly once -----
 * An event records when its animation began (startFx): a move made here, by the computer or played back
 * (playFlash), a claim landing on the board, the glow on a square about to be played, a Memory card
 * turned up or the cards turning back, a Mastermind peg placed, a note popping up, the pause card, a new
 * screen coming into view. Rendering never starts anything: it draws the state as it is, and then
 * anchorFx sets every animation on the page to the point its event has reached. A re-render in the middle
 * of one (a room update, someone's presence, the clock) carries on from where it was, and one after the
 * end just draws the end state, so nothing ever plays twice or starts over. */
export const fx = {};                                   // kind -> { key, at }: the latest event of each kind, at performance.now()
export function startFx(kind, key, at) { fx[kind] = { key, at: at == null ? performance.now() : at }; }
export function fxAt(kind, key) { const e = fx[kind]; return e && e.key === key ? e.at : null; }
export const fxAttr = at => (at == null ? '' : ` data-fx="${at}"`);   // an element whose animations (and everything inside) belong to that event
export function anchorFx() {
  if (!WAAPI || typeof app.getAnimations !== 'function') return;
  // the animations' own clock (the frame's time, same origin as performance.now()): measured on it, one
  // already running where it should be reads the same, however late in the frame this redraw is
  const tl = document.timeline && document.timeline.currentTime, now = typeof tl === 'number' ? tl : performance.now();
  const css = a => !(typeof CSSTransition !== 'undefined' && a instanceof CSSTransition);   // (a transition just follows its style)
  // Each animation is set once, by the event of its nearest [data-fx] element (or, with none, the screen's
  // entry). (Setting everything by the entry first and then each event's own finished, and so lost, any
  // animation the entry's clock had already run past: Echo's first flashes, after the square had been open
  // a while, never showed.)
  for (const a of app.getAnimations({ subtree: true })) {
    if (!css(a)) continue;
    const el = a.effect && a.effect.target, host = el && el.closest ? el.closest('[data-fx]') : null;
    const at = host ? Number(host.dataset.fx) : fx.enter ? fx.enter.at : null;
    if (at == null) continue;
    const t = Math.max(0, now - at);
    if (a.currentTime != null && a.currentTime > 0 && Math.abs(a.currentTime - t) < 60) continue;   // already where its event has it (one running on, untouched): left alone; one just made (at 0) is always set, or a redraw early in its event would start it over
    try { a.currentTime = t; } catch (e) { /* (a finished one with no effect left) */ }
  }
}
// How long the move's animation takes. The result toast or card waits this long, and so does any tap.
export function animMs(f) { return REDUCED ? 0 : playMs(f, hexLen(f)) + lanePre(f) - (f.type === 'bus' ? BUST.pre - busPre(f) : 0) - (f.type === 'bullseye' && f.bull ? bullsAim(f.bull).fly - bullsPre(f) : 0) - (f.type === 'echo' && f.echo && !f.timeout ? echoAim(f.echo).end - echoPre(f) : 0) - (f.type === 'oddone' && f.odd && !f.timeout ? ODD.show + ODD.pause - oddPre(f) : 0) - (ATT_TYPES.includes(f.type) && f.att && !f.timeout ? attMs(f.type, f.att.round) + ATT.pause - attPre(f) : 0) - (FINGER_TYPES.includes(f.type) && f.fing && !f.timeout ? fingMs(f.fing) - fingPre(f) : 0) - (f.type === 'trivia' && f.trivia ? (f.trivia.fresh ? TRIVIA.flip : 0) + TRIVIA.pause - triviaPre(f) : 0); }   // (your own Ride the Bus guess skips the moment it is shown)
export function hexLen(f) { const sq = state.squares[f.square]; return sq && sq.mini.winCells ? sq.mini.winCells.length : 4; }
// The JS-driven bits of the animations: numbers that count up or down, and the candy token's hops.
export function animate() {
  if (!state.flash) return;
  for (const el of app.querySelectorAll('.cnt[data-from]')) {
    const host = el.closest('[data-fx]'), at = host ? Number(host.dataset.fx) : performance.now();   // counted from the move, wherever a redraw finds it
    countTo(el, Number(el.dataset.from), Number('to' in el.dataset ? el.dataset.to : el.textContent), Number(el.dataset.ms) || 400, at + (Number(el.dataset.delay) || 0));
  }
  hopToken();
}
function countTo(el, from, to, ms, t0) {
  const ease = now => { const k = Math.min(1, Math.max(0, (now - t0) / ms)); return [k, Math.round(from + (to - from) * (1 - Math.pow(1 - k, 2)))]; };
  if (REDUCED || from === to || ease(performance.now())[0] >= 1) { el.textContent = to; return; }
  el.textContent = ease(performance.now())[1];
  const step = now => {
    if (!el.isConnected) return;                                   // re-rendered meanwhile: the new one carries on
    const [k, v] = ease(now);
    el.textContent = v;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
// Back on the board after a move: a square just won stamps in now, once (the event its stamp belongs to).
export function stampFx() {
  if (state.screen !== 'board' || state.stamp == null || state.stampId == null || fxAt('stamp', state.stampId) != null) return;
  startFx('stamp', state.stampId);
  SND.play('stamp'); SND.play('burst', { at: BOARD_BURST[0] / 1000 }); SND.play('burst', { at: BOARD_BURST[1] / 1000 });
}
