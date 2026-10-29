// Animations: each one started by the event that causes it, exactly once; bursts and count-ups.
import { ANIM, playMs } from '../core/timer.js';
import { ATT, ATT_TYPES, attMs } from '../games/shared/attention.js';
import { FINGER_TYPES, fingMs } from '../games/shared/finger.js';
import { bullsAim } from '../games/bullseye/rules.js';
import { bullsPre } from '../games/bullseye/view.js';
import { BUST } from '../games/bus/rules.js';
import { busPre } from '../games/bus/view.js';
import { echoAim } from '../games/echo/rules.js';
import { echoPre } from '../games/echo/view.js';
import { ODD } from '../games/oddone/rules.js';
import { oddPre } from '../games/oddone/view.js';
import { TRIVIA } from '../games/trivia/rules.js';
import { triviaPre } from '../games/trivia/view.js';
import { SND } from '../audio/sound.js';
import { haptic } from '../net/platform.js';
import { REDUCED, WAAPI, app, state } from './app.js';
import { attPre } from './attention.js';
import { shownSq } from './chaos.js';
import { BOARD_BURST } from './board.js';
import { fingPre } from './finger.js';
import { runPre } from './runner.js';
import { hopToken } from './track.js';
import { rlMarker } from '../games/rl/view.js';

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
 * (playFlash), a claim landing on the board, the glow on a square about to be played, a Find the Pair card
 * turned up or the cards turning back, a Codebreaker peg placed, a note popping up, the pause card, a new
 * screen coming into view. Rendering never starts anything: it draws the state as it is, and then
 * anchorFx sets every animation on the page to the point its event has reached. A re-render in the middle
 * of one (a room update, someone's presence, the clock) carries on from where it was, and one after the
 * end just draws the end state, so nothing ever plays twice or starts over. */
export const fx = {};                                   // kind -> { key, at }: the latest event of each kind, at performance.now()
export function startFx(kind, key, at) { fx[kind] = { key, at: at == null ? performance.now() : at }; }
export function fxAt(kind, key) { const e = fx[kind]; return e && e.key === key ? e.at : null; }
// kind: 'm' a move's own animations (timed in the move's time: playFlash keeps the move's event drifting at its
// rate); 'rt' real time (a game's own timing: an attention round, Echo's pattern, a bar counting down, the
// Skip button's moment); none: the game's pace (ANIM.speed).
export const fxAttr = (at, kind) => (at == null ? '' : ` data-fx="${at}"${kind ? ` data-fxk="${kind}"` : ''}`);   // an element whose animations (and everything inside) belong to that event
export function anchorFx() {
  if (!WAAPI || typeof app.getAnimations !== 'function') return;
  // the animations' own clock (the frame's time, same origin as performance.now()): measured on it, one
  // already running where it should be reads the same, however late in the frame this redraw is
  const tl = document.timeline && document.timeline.currentTime, now = typeof tl === 'number' ? tl : performance.now();
  const css = a => !(typeof CSSTransition !== 'undefined' && a instanceof CSSTransition);   // (a transition just follows its style)
  const S = ANIM.speed, mr = (fx.move && fx.move.rate) || 1;
  // Each animation is set once, by the event of its nearest [data-fx] element (or, with none, the screen's
  // entry). (Setting everything by the entry first and then each event's own finished, and so lost, any
  // animation the entry's clock had already run past: Echo's first flashes, after the square had been open
  // a while, never showed.) Each plays at its host's rate: the game's pace (ANIM.speed: every figure in the
  // stylesheet is a base one), a move's own rate, or real time; a loop that never ends (a glow, a bob, Bullseye's
  // sweep) always in real time.
  for (const a of app.getAnimations({ subtree: true })) {
    if (!css(a)) continue;
    const el = a.effect && a.effect.target, host = el && el.closest ? el.closest('[data-fx]') : null;
    const at = host ? Number(host.dataset.fx) : fx.enter ? fx.enter.at : null;
    if (at == null) continue;
    const kind = host ? host.dataset.fxk : '', timing = a.effect && a.effect.getTiming ? a.effect.getTiming() : {};
    const rate = kind === 'rt' || timing.iterations === Infinity ? 1 : kind === 'm' ? mr : S;
    const t = Math.max(0, now - at) * (kind === 'm' ? 1 : rate);    // (a move's host carries its drifted time already)
    if (a.playbackRate === rate && a.currentTime != null && a.currentTime > 0 && Math.abs(a.currentTime - t) < 60) continue;   // already where its event has it (one running on, untouched): left alone; one just made (at 0) is always set, or a redraw early in its event would start it over
    try { a.playbackRate = rate; a.currentTime = t; } catch (e) { /* (a finished one with no effect left) */ }
  }
}
// ----- energy, in Speed (the player's Animation setting): a screen shake, confetti, a pop under the finger (each
// from its own event, once; never from a render). ANIM.fx (the admin's Speed effects intensity, 0 to 2) scales them
// all; 0, or reduced motion, turns them off; Normal has none.
// Short by design: none of it holds anything up. -----
const FX_ON = () => !REDUCED && WAAPI && ANIM.mode === 'speed' && ANIM.fx > 0;   // (Speed, the player's Animation setting, only: Normal is the game as designed)
// The whole screen jolts (a claim, a sink, a bust, a knock, a win): power 1 a claim, 1.6 the match, 0.6 a lesser hit.
export function shake(power = 1) {
  if (!FX_ON()) return;
  const a = Math.min(14, 6 * power * ANIM.fx), k = n => `${(a * n).toFixed(1)}px`;
  try { app.animate([{ translate: '0 0' }, { translate: `${k(-1)} ${k(0.4)}` }, { translate: `${k(0.8)} ${k(-0.6)}` }, { translate: `${k(-0.5)} ${k(0.3)}` }, { translate: `${k(0.25)} 0` }, { translate: '0 0' }], { duration: 240, easing: 'ease-out' }); } catch (e) { /* (no individual transforms: no shake) */ }
}
// A quick spray of confetti from a point (an element's middle, else the screen's), in the players' colours.
const CONF = ['var(--x)', 'var(--o)', 'var(--sky, #58a8cf)', 'var(--paper, #fff8e8)', '#4e9d3a'];
export function confetti(n = 24, from) {
  if (!FX_ON()) return;
  const count = Math.round(n * ANIM.fx);
  if (!count) return;
  const r = from && from.getBoundingClientRect ? from.getBoundingClientRect() : null;
  const x0 = r ? r.left + r.width / 2 : innerWidth / 2, y0 = r ? r.top + r.height / 2 : innerHeight * 0.4;
  const box = document.createElement('div');
  box.className = 'confetti'; box.setAttribute('aria-hidden', 'true');
  document.body.appendChild(box);
  let left = count;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i'), ang = Math.random() * Math.PI * 2, d = 60 + Math.random() * 140 * Math.min(1.5, ANIM.fx), rot = (Math.random() - 0.5) * 720;
    p.style.left = x0 + 'px'; p.style.top = y0 + 'px'; p.style.background = CONF[i % CONF.length];
    box.appendChild(p);
    const dx = Math.cos(ang) * d, dy = Math.sin(ang) * d * 0.8;
    const an = p.animate([{ transform: 'translate(-50%, -50%) scale(.4)', opacity: 1 }, { transform: `translate(calc(-50% + ${(dx * 0.85).toFixed(0)}px), calc(-50% + ${(dy * 0.85 - 30).toFixed(0)}px)) rotate(${(rot * 0.7).toFixed(0)}deg) scale(1)`, opacity: 1, offset: 0.55 }, { transform: `translate(calc(-50% + ${dx.toFixed(0)}px), calc(-50% + ${(dy + 70).toFixed(0)}px)) rotate(${rot.toFixed(0)}deg) scale(.8)`, opacity: 0 }], { duration: 650 + Math.random() * 250, easing: 'cubic-bezier(.2, .8, .4, 1)' });
    an.onfinish = an.oncancel = () => { if (--left <= 0) box.remove(); };
  }
}
// A press: the control squashes and springs back under the finger (its own `scale`, so its transforms are untouched).
export function tapPop(el) {
  if (!FX_ON() || !el || !el.animate) return;
  const s = 0.08 * Math.min(1.5, ANIM.fx);
  try { el.animate([{ scale: '1' }, { scale: `${1 - s}` }, { scale: `${1 + s * 0.5}` }, { scale: '1' }], { duration: 170, easing: 'ease-out' }); } catch (e) { /* (no individual transforms) */ }
}
// A move's big moment, as its result lands: how hard the screen shakes (null: none). A square won shakes on the
// board as it stamps in (stampFx); in the square, a hit (a sink, a bust, a knock, a strike) jolts it.
export function momentPower(f) {
  if (!f || f.timeout) return null;
  if (f.note === 'bust' || f.note === 'sunk') return 1;
  if (f.kind === 'claim' || f.kind === 'match') return null;      // (its jolt comes with the stamp on the board)
  if (f.bumped || (f.scr && f.scr.knocked && f.scr.knocked.length)) return 0.8;
  if (f.note === 'strike') return 0.8;
  if (f.hit || (f.craps && /lose|out/.test(String(f.craps.result)))) return 0.5;
  return null;
}
// How long the move's animation takes. The result toast or card waits this long, and so does any tap.
export function animMs(f) { return REDUCED ? 0 : playMs(f, hexLen(f)) + runPre(f) - (f.type === 'bus' ? BUST.pre - busPre(f) : 0) - (f.type === 'bullseye' && f.bull ? bullsAim(f.bull).fly - bullsPre(f) : 0) - (f.type === 'echo' && f.echo && !f.timeout ? echoAim(f.echo).end - echoPre(f) : 0) - (f.type === 'oddone' && f.odd && !f.timeout ? ODD.show + ODD.pause - oddPre(f) : 0) - (ATT_TYPES.includes(f.type) && f.att && !f.timeout ? attMs(f.type, f.att.round) + ATT.pause - attPre(f) : 0) - (FINGER_TYPES.includes(f.type) && f.fing && !f.timeout ? fingMs(f.fing) - fingPre(f) : 0) - (f.type === 'trivia' && f.trivia ? (f.trivia.fresh ? TRIVIA.flip : 0) + TRIVIA.pause - triviaPre(f) : 0); }   // (your own Ride the Bus guess skips the moment it is shown)
export function hexLen(f) { const sq = shownSq(f.square); return sq && sq.mini.winCells ? sq.mini.winCells.length : 4; }
// The JS-driven bits of the animations: numbers that count up or down, and the candy token's hops.
export function animate() {
  if (!state.flash) return;
  for (const el of app.querySelectorAll('.cnt[data-from]')) {
    const host = el.closest('[data-fx]'), mv = host && host.dataset.fxk === 'm', at = host ? Number(host.dataset.fx) : performance.now();   // counted from the move, wherever a redraw finds it
    const clock = mv ? () => performance.now() - (fx.move ? fx.move.at : at) : () => (performance.now() - at) * ANIM.speed;   // (the move's time: its drifting event; else the game's pace)
    countTo(el, Number(el.dataset.from), Number('to' in el.dataset ? el.dataset.to : el.textContent), Number(el.dataset.ms) || 400, Number(el.dataset.delay) || 0, clock);
  }
  hopToken();
  rlMarker();
}
function countTo(el, from, to, ms, delay, clock) {
  const ease = () => { const k = Math.min(1, Math.max(0, (clock() - delay) / ms)); return [k, Math.round(from + (to - from) * (1 - Math.pow(1 - k, 2)))]; };
  if (REDUCED || from === to || ease()[0] >= 1) { el.textContent = to; return; }
  el.textContent = ease()[1];
  const step = () => {
    if (!el.isConnected) return;                                   // re-rendered meanwhile: the new one carries on
    const [k, v] = ease();
    el.textContent = v;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
// Back on the board after a move: a square just won stamps in now, once (the event its stamp belongs to).
export function stampFx(elapsed) {                                   // elapsed: the stamp began this long ago (a sequence joined part way: quietly)
  if (state.screen !== 'board' || state.stamp == null || state.stampId == null || fxAt('stamp', state.stampId) != null) return;
  startFx('stamp', state.stampId, elapsed ? performance.now() - elapsed : undefined);
  if (elapsed > 200) return;
  SND.play('stamp'); SND.play('burst', { at: BOARD_BURST[0] / 1000 / ANIM.speed }); SND.play('burst', { at: BOARD_BURST[1] / 1000 / ANIM.speed });
  haptic('claim');                                                   // (the app: one buzz with the stamp)
  const sq = app.querySelector(`.board .sq:nth-child(${state.stamp + 1})`);
  setTimeout(() => { shake(state.winner ? 1.3 : 1); confetti(state.winner ? 40 : 18, sq && sq.isConnected ? sq : null); }, 120 / ANIM.speed);   // (as the mark lands)
}
