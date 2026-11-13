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
import { REDUCED, WAAPI, app, lastView, state } from './app.js';
import { attPre } from './attention.js';
import { claimHaptic } from './haptics.js';
import { shownSq } from './chaos.js';
import { BOARD_BURST, DRAW_MS, DRAW_SHUFFLE } from './board.js';
import { fingPre } from './finger.js';
import { runPre } from './runner.js';
import { hopToken } from './track.js';
import { rlMarker } from '../games/rl/view.js';
import { render } from './render.js';

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
  // stylesheet is a base one), a move's own rate, or real time; a loop that never ends (a glow, a bob, a
  // sweep) always in real time.
  for (const a of app.getAnimations({ subtree: true })) {
    if (!css(a) || a.id === ZOOM_ID) continue;                       // (the board's zoom into and out of a square keeps its own time: zoomKeep)
    const el = a.effect && a.effect.target, host = el && el.closest ? el.closest('[data-fx]') : null;
    const at = host ? Number(host.dataset.fx) : fx.enter ? fx.enter.at : null;
    if (at == null) continue;
    const kind = host ? host.dataset.fxk : '', timing = a.effect && a.effect.getTiming ? a.effect.getTiming() : {};
    const rate = kind === 'rt' || timing.iterations === Infinity ? 1 : kind === 'm' ? mr : S;
    const dt = now - at, t = (dt < -1 ? dt : Math.max(0, dt)) * (kind === 'm' ? 1 : rate);    // (a move's host carries its drifted time already; an event still to come, a claim's stamp waiting for the zoom-out to land: held before its start)
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
  // Each piece is unseen outside its own animation (opacity 0 in the stylesheet: never a square left at the spray's
  // origin as it waits to start or once it ends) and goes as soon as its flight is over; the box goes with the last,
  // or after its longest flight whatever happens (a hidden page holds animations back).
  let left = count;
  const done = () => { if (box.isConnected) box.remove(); };
  setTimeout(done, 1400);
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i'), ang = Math.random() * Math.PI * 2, d = 60 + Math.random() * 140 * Math.min(1.5, ANIM.fx), rot = (Math.random() - 0.5) * 720;
    p.style.left = x0 + 'px'; p.style.top = y0 + 'px'; p.style.background = CONF[i % CONF.length];
    box.appendChild(p);
    const dx = Math.cos(ang) * d, dy = Math.sin(ang) * d * 0.8;
    const an = p.animate([{ transform: 'translate(-50%, -50%) scale(.4)', opacity: 1 }, { transform: `translate(calc(-50% + ${(dx * 0.85).toFixed(0)}px), calc(-50% + ${(dy * 0.85 - 30).toFixed(0)}px)) rotate(${(rot * 0.7).toFixed(0)}deg) scale(1)`, opacity: 1, offset: 0.55 }, { transform: `translate(calc(-50% + ${dx.toFixed(0)}px), calc(-50% + ${(dy + 70).toFixed(0)}px)) rotate(${rot.toFixed(0)}deg) scale(.8)`, opacity: 0 }], { duration: 650 + Math.random() * 250, easing: 'cubic-bezier(.2, .8, .4, 1)' });
    an.onfinish = an.oncancel = () => { p.remove(); if (--left <= 0) done(); };
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
// A square drawn and reset, back on the board (state.drawStamp, keyed by state.drawId: core/board.js leaveSquare): its
// Draw stamp and the shuffle into the new game start once (ui/board.js draws them), with their sounds: a softer thump
// as the stamp lands, two card slides as the old game flicks away and a card flip as the new one deals in. f: the move
// that drew it (its `drawn`: the old game as it ended, for the tile that flicks away). True when it started now.
export let drawOld = null;                                            // { id, type, mini }: the old game of the latest drawn square
export function drawFx(f) {
  if (state.screen !== 'board' || state.drawStamp == null || state.drawId == null || fxAt('draw', state.drawId) != null) return false;
  drawOld = f && f.square === state.drawStamp && f.type ? { id: state.drawId, type: f.type, mini: f.drawn || null } : null;
  const z = zoomLeft();                                               // (back from the square: the stamp waits for the zoom-out to land in its square)
  startFx('draw', state.drawId, performance.now() + z);
  const s = 1000 * ANIM.speed, zs = z / 1000;
  SND.play('stamp', { vol: 0.6, at: zs });
  SND.play('cardSlide', { at: zs + DRAW_SHUFFLE[0] / s }); SND.play('cardSlide', { at: zs + (DRAW_SHUFFLE[0] + 90) / s, rate: 1.12 }); SND.play('cardFlip', { at: zs + DRAW_SHUFFLE[1] / s });
  return true;
}
// How long until a drawn square's Draw stamp and shuffle are over on the board (ms; 0 when none is playing, or it is
// over). The computer's next turn waits for it (ui/turns.js scheduleCpu: its square lit up would cover the stamp, its
// zoom into a square would take the board away mid-shuffle), as an online phone's next playback does (net/room.js).
export function drawLeft() {
  const at = state.drawStamp != null && state.drawId != null ? fxAt('draw', state.drawId) : null;
  return at == null ? 0 : Math.max(0, at + DRAW_MS / ANIM.speed - performance.now());
}
export function stampFx(elapsed) {                                   // elapsed: the stamp began this long ago (a sequence joined part way: quietly)
  if (state.screen !== 'board' || state.stamp == null || state.stampId == null || fxAt('stamp', state.stampId) != null) return;
  const z = elapsed ? 0 : zoomLeft();                                 // back from the square: the stamp starts once the zoom-out has landed in it (never under the shrinking view)
  startFx('stamp', state.stampId, elapsed ? performance.now() - elapsed : performance.now() + z);
  if (elapsed > 200) return;
  const zs = z / 1000;
  SND.play('stamp', { at: zs }); SND.play('burst', { at: zs + BOARD_BURST[0] / 1000 / ANIM.speed }); SND.play('burst', { at: zs + BOARD_BURST[1] / 1000 / ANIM.speed });
  const owner = state.squares[state.stamp] && state.squares[state.stamp].owner, i = state.stamp;
  if (z > 0) setTimeout(() => claimHaptic(owner), z); else claimHaptic(owner);   // (one buzz with the stamp: claimed, or lost to the other side: ui/haptics.js)
  setTimeout(() => { const sq = app.querySelector(`.board .sq:nth-child(${i + 1})`); shake(state.winner ? 1.3 : 1); confetti(state.winner ? 40 : 18, sq && sq.isConnected ? sq : null); }, z + 120 / ANIM.speed);   // (as the mark lands)
  return true;                                                       // (stamped now, with its sound and buzz: turns.js turnAlert waits for it)
}

/* ----- the zoom between the main board and a square (a shared-element "FLIP" transition) -----
 * Into a square: the tapped square's tile lifts off the board and grows into the game's area while the full view,
 * already laid out at its final size, grows out of that square to fill the screen and fades in over the tile; the
 * board behind fades and sinks back a little. Out of a square: the reverse, the full view shrinking into its exact
 * square on the board as the board fades back in; a claim's stamp (and a draw's) starts once it has landed (stampFx,
 * drawFx: zoomLeft). The same for the computer's and the other phone's moves (they open and leave squares the same
 * way). One event per screen change (render.js), started once: transforms and opacity only, on the new screen's
 * element (its layout, its canvases, measured once at full size: a transform changes no layout) and on two visual
 * stand-ins outside #app (pointer-events none): the screen that is going (the very element, moved, so a canvas keeps
 * its picture and its animations carry on from where they were) and a copy of the square's tile. A re-render in the
 * middle (the clock, a room update) puts the animation back on the redrawn element at the same point (zoomKeep):
 * nothing restarts. Input is never held: the new screen takes taps at once (the stand-ins take none). 300 ms in
 * Normal, 180 ms in Speed (at the admin's Animation speed 1); none with reduced motion. */
export const ZOOM = { normal: 300, speed: 180, ease: 'cubic-bezier(.4, 0, .2, 1)', off: null };   // off: null, by the device (reduced motion, no Web Animations); true or false to force it (the tests)
export const ZOOM_ID = 'ttc-zoom';
// The zoom's length in ms: 0 when there is none (reduced motion, no Web Animations, the page out of sight).
export function zoomMs() {
  if ((ZOOM.off == null ? REDUCED || !WAAPI : ZOOM.off) || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return 0;
  return (ANIM.mode === 'speed' ? ZOOM.speed : ZOOM.normal) / (ANIM.admin || 1);
}
let zoom = null;                                   // the zoom under way: { dir: 'in' | 'out', i, t0, end, D, main, sq, ghost, tile, timer }
export const zoomNow = () => zoom;
const PAIRS = { board: 'mini', review: 'review-mini' };   // a board and the square opened from it
function zoomPair(prev, view) {
  const [ps, pz] = String(prev || '').split(':'), [vs, vz] = String(view || '').split(':');
  if (PAIRS[ps] === vs && pz === 'null' && /^\d$/.test(vz)) return { dir: 'in', i: Number(vz) };
  if (PAIRS[vs] === ps && vz === 'null' && /^\d$/.test(pz)) return { dir: 'out', i: Number(pz) };
  return null;
}
// How long until the board is back in place (ms): the zoom-out under way, or the one the next render starts (a move's
// result over, the screen just set back to the board: lastView is still the square). 0 when there is none.
export function zoomLeft() {
  if (zoom && zoom.dir === 'out') return Math.max(0, zoom.end - performance.now());
  if (state.sc || !lastView) return 0;
  const p = zoomPair(lastView, state.screen + ':' + state.zoom);
  return p && p.dir === 'out' ? zoomMs() : 0;
}
// Either way, how much of the zoom under way is left (the computer acts once its square is open: turns.js).
export const zoomBusy = () => (zoom ? Math.max(0, zoom.end - performance.now()) : 0);
const rectOf = e => { const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; };
const sqSquare = g => { const s = Math.min(g.width, g.height); return { left: g.left + (g.width - s) / 2, top: g.top + (g.height - s) / 2, width: s, height: s }; };   // the game's area: its middle square, where the tile lands
const good = r => r && r.width > 1 && r.height > 1 && Number.isFinite(r.left + r.top);
// A transform (origin 0 0, at an element whose top left is o) that lays rect a over rect b, scaled alike both ways.
function mapTf(a, b, o) {
  const s = b.width / a.width, dx = b.left - o.left - s * (a.left - o.left), dy = b.top - o.top - s * (a.top - o.top);
  return `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) scale(${s.toFixed(4)})`;
}
// The CSS animations of an element and everything in it, as they stand (to carry them on once it has moved).
const cssAnims = root => (root.getAnimations ? root.getAnimations({ subtree: true }) : []).filter(a => a.animationName && a.effect && a.effect.target);
const animKey = a => [a.effect.target, a.effect.pseudoElement || '', a.animationName];
function animSnap(root) { return cssAnims(root).map(a => ({ k: animKey(a), c: a.currentTime, r: a.playbackRate, p: a.playState === 'paused' })); }
function animCarry(root, snap) {
  for (const a of cssAnims(root)) {
    const k = animKey(a), m = snap.find(x => x.k[0] === k[0] && x.k[1] === k[1] && x.k[2] === k[2]);
    try {
      if (m && m.c != null) { a.playbackRate = m.r; a.currentTime = m.c; if (m.p) a.pause(); }
      else if (!m && a.effect.getTiming().iterations !== Infinity) a.finish();   // (over before the move: a moved element would start it again)
    } catch (e) { /* (an effect gone meanwhile) */ }
  }
}
// The animations on the live elements (the new screen, and out of a square its square, kept hidden until the
// stand-in lands on it): put back after a re-render replaced the element, at the same point of the zoom.
function zoomOn(el, kf) {
  if (!el || !el.animate) return;
  if (el.getAnimations && el.getAnimations().some(a => a.id === ZOOM_ID)) return;
  const a = el.animate(kf, { duration: zoom.D, easing: ZOOM.ease, fill: 'backwards' });
  a.id = ZOOM_ID; a.startTime = zoom.t0;
}
function zoomEnd(z, landed) {
  if (!z || zoom !== z) return;
  zoom = null;
  clearTimeout(z.timer);
  for (const e of [z.ghost, z.tile]) if (e && e.parentNode) e.remove();
  for (const e of [z.liveMain, z.liveSq]) if (e && e.getAnimations) for (const a of e.getAnimations()) if (a.id === ZOOM_ID) a.cancel();   // (cut short: the new screen as it is meant to be)
  const m = app.querySelector(':scope > main.scr');
  if (landed && z.dir === 'in' && m && m.querySelector('canvas')) render();   // (a canvas drawn while the screen was scaled: drawn once more at its exact size)
}
export function zoomCancel() { if (zoom) zoomEnd(zoom); }
// Before a new screen goes in (render.js): what the zoom needs of the screen that is going. Null: no zoom.
export function zoomPrep(prev, view) {
  zoomCancel();                                                   // (another screen change part way through: the first one is over)
  try {
    const p = zoomPair(prev, view), D = p && !state.sc ? zoomMs() : 0;
    if (!p || !D) return null;
    const old = app.querySelector(':scope > main.scr');
    if (!old) return null;
    const cs = getComputedStyle(old);
    const o = { dir: p.dir, i: p.i, D, old, oldRect: rectOf(old), pad: cs.padding, rxh: getComputedStyle(app).getPropertyValue('--rxh'), snap: animSnap(old) };
    if (p.dir === 'in') {
      const sq = old.querySelectorAll('.board > .sq')[p.i];
      if (!sq) return null;
      o.oldSq = sq; o.R = rectOf(sq);
      if (!good(o.R)) return null;
    } else {
      const g = old.querySelector('.gwrap');
      if (!g) return null;
      o.T = sqSquare(rectOf(g));
      if (!good(o.T)) return null;
    }
    return good(o.oldRect) ? o : null;
  } catch (e) { return null; }
}
// The stand-in for the screen that is going: the element itself, fixed where it was, out of #app (so nothing on the
// page finds it: no paint loop, no anchorFx), its own look kept (the reactions' room, its padding), carrying on.
function ghostOf(o, over) {
  const g = document.createElement('div');
  g.className = 'zghost' + (over ? ' over' : '');
  g.setAttribute('aria-hidden', 'true');
  const r = o.oldRect;
  g.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;--rxh:${o.rxh || '0px'}`;
  o.old.style.padding = o.pad;
  g.appendChild(o.old);
  document.body.appendChild(g);
  animCarry(o.old, o.snap);
  return g;
}
// A copy of a square's tile, fixed over the square (a visual only: no taps). `start`: its animations held at their
// start (out of a square: the square as the view lands in it, a fresh stamp not yet begun); else at their end.
function tileOf(sqEl, R, start) {
  const t = sqEl.cloneNode(true);
  t.classList.remove('spot', 'spot-X', 'spot-O');
  for (const e of t.querySelectorAll('.spot-lab')) e.remove();
  t.classList.add('ztile');
  t.removeAttribute('data-act'); t.removeAttribute('data-fx'); t.setAttribute('aria-hidden', 'true'); t.tabIndex = -1;
  t.style.cssText = `left:${R.left}px;top:${R.top}px;width:${R.width}px;height:${R.height}px`;
  document.body.appendChild(t);
  for (const a of t.getAnimations ? t.getAnimations({ subtree: true }) : []) {
    try { if (start) { a.pause(); a.currentTime = 0; } else if (a.effect && a.effect.getTiming().iterations === Infinity) a.cancel(); else a.finish(); } catch (e) { /* (none to hold) */ }
  }
  return t;
}
// After the new screen went in (render.js): start the zoom; on any other render, keep the one under way on the
// redrawn elements.
export function zoomRun(o) {
  if (!o) { zoomKeep(); return; }
  try {
    const main = app.querySelector(':scope > main.scr'), tl = document.timeline && document.timeline.currentTime;
    const t0 = typeof tl === 'number' ? tl : performance.now();
    if (!main) { o.old.remove(); return; }
    const z = { dir: o.dir, i: o.i, D: o.D, t0, end: t0 + o.D };
    if (o.dir === 'in') {
      const g = main.querySelector('.gwrap'), T = g ? sqSquare(rectOf(g)) : null, M = rectOf(main);
      if (!good(T) || !good(M)) { o.old.remove(); return; }
      const R = o.R, from = mapTf(T, R, M);
      zoom = z;
      z.mainKf = [{ transformOrigin: '0 0', transform: from, opacity: 0 }, { transformOrigin: '0 0', opacity: 1, offset: 0.55 }, { transformOrigin: '0 0', transform: 'none', opacity: 1 }];
      const tile = tileOf(o.oldSq, R, false);                        // (before the square leaves its board)
      o.oldSq.style.visibility = 'hidden';                          // the tile has lifted off it
      z.ghost = ghostOf(o, false);
      const go = `${(R.left + R.width / 2 - o.oldRect.left).toFixed(1)}px ${(R.top + R.height / 2 - o.oldRect.top).toFixed(1)}px`;
      z.ghost.animate([{ transformOrigin: go, transform: 'none', opacity: 1 }, { transformOrigin: go, transform: 'scale(.94)', opacity: 0 }], { duration: o.D, easing: ZOOM.ease, fill: 'both' }).startTime = t0;
      z.tile = tile;
      zoomLines(R, o.D, t0);                                            // (Comic Chaos: speed lines out from the square)
      const ta = tile.animate([{ transformOrigin: '0 0', transform: 'none', opacity: 1 }, { transformOrigin: '0 0', opacity: 1, offset: 0.3 }, { transformOrigin: '0 0', opacity: 0, offset: 0.8 }, { transformOrigin: '0 0', transform: mapTf(R, T, R), opacity: 0 }], { duration: o.D, easing: ZOOM.ease, fill: 'both' });
      ta.startTime = t0; ta.onfinish = () => zoomEnd(z, true);
    } else {
      const sqEl = main.querySelectorAll('.board > .sq')[o.i], R = sqEl ? rectOf(sqEl) : null;
      if (!good(R)) { o.old.remove(); return; }
      const T = o.T;
      zoom = z;
      const so = `${(R.left + R.width / 2 - rectOf(main).left).toFixed(1)}px ${(R.top + R.height / 2 - rectOf(main).top).toFixed(1)}px`;   // (the board grows back about the square's middle: the square stays where the view lands)
      z.mainKf = [{ transformOrigin: so, transform: 'scale(.94)', opacity: 0 }, { transformOrigin: so, opacity: 1, offset: 0.6 }, { transformOrigin: so, transform: 'none', opacity: 1 }];
      z.sqKf = [{ opacity: 0 }, { opacity: 0 }];                     // the square itself shows once the view has landed on it
      z.ghost = ghostOf(o, true);
      const tile = tileOf(sqEl, R, true);                            // (after it: over the view that shrinks into it)
      z.ghost.animate([{ transformOrigin: '0 0', transform: 'none', opacity: 1 }, { transformOrigin: '0 0', opacity: 1, offset: 0.4 }, { transformOrigin: '0 0', opacity: 0, offset: 0.9 }, { transformOrigin: '0 0', transform: mapTf(T, R, o.oldRect), opacity: 0 }], { duration: o.D, easing: ZOOM.ease, fill: 'both' }).startTime = t0;
      z.tile = tile;
      const ta = tile.animate([{ transformOrigin: '0 0', transform: mapTf(R, T, R), opacity: 0 }, { transformOrigin: '0 0', opacity: 0, offset: 0.3 }, { transformOrigin: '0 0', opacity: 1, offset: 0.75 }, { transformOrigin: '0 0', transform: 'none', opacity: 1 }], { duration: o.D, easing: ZOOM.ease, fill: 'both' });
      ta.startTime = t0; ta.onfinish = () => zoomEnd(z, true);
    }
    z.timer = setTimeout(() => zoomEnd(z, true), o.D + 400);               // (whatever happens: a page out of sight holds animations back)
    zoomKeep();
  } catch (e) { zoomCancel(); if (o.old && o.old.parentNode && !o.old.closest('#app')) o.old.remove(); }
}
/* ----- Comic Chaos's screen changes (December 2026): a panel slide between the menus' screens, a burst wipe into a
 * match and into its results. From the screen change itself (render.js, once: a redraw of the same screen never plays
 * it again, it only keeps the slide on the redrawn screen, swapKeep), transforms and opacity only (Web Animations), the
 * new screen in place and taking taps at once, the screen that goes a stand-in outside #app taking none. None where the
 * zoom plays (the board and a square), with reduced motion or with the page out of sight; Speed shortens both. */
export const SWAP = { slide: 300, slideSpeed: 180, wipe: 560, wipeSpeed: 340, ease: 'cubic-bezier(.3, 0, .2, 1)' };
const GAME_SCR = ['board', 'mini', 'review', 'review-mini'];
let swapPath = [], swap = null;                       // the screens come through since the menu (back or on?), the slide under way
const swapMs = k => { const z = zoomMs(); if (!z) return 0; const sp = ANIM.mode === 'speed'; return (k === 'wipe' ? (sp ? SWAP.wipeSpeed : SWAP.wipe) : (sp ? SWAP.slideSpeed : SWAP.slide)) / (ANIM.admin || 1); };
// Which change it is: 'wipe' into a match (from the menus) or into the results (from the match), 'slide' between two of
// the menus' screens (on: further in, back: a screen come through before), else none.
export function swapKind(prev, view) {
  const ps = String(prev || '').split(':')[0], vs = String(view || '').split(':')[0];
  if (!ps || ps === vs || ps === 'undefined') return null;
  if (vs === 'win' && GAME_SCR.includes(ps)) return { kind: 'wipe' };
  if ((vs === 'board' || vs === 'mini') && !GAME_SCR.includes(ps)) return { kind: 'wipe' };   // (a match from the menus, or a rematch; the finished match's review: none)
  if (GAME_SCR.includes(vs) || GAME_SCR.includes(ps)) return null;
  const back = vs === 'menu' || swapPath.includes(vs);
  return { kind: 'slide', back };
}
function swapTrack(view) {
  const vs = String(view || '').split(':')[0];
  if (vs === 'menu' || GAME_SCR.includes(vs)) { swapPath = []; return; }
  const i = swapPath.indexOf(vs);
  if (i >= 0) swapPath.length = i + 1; else swapPath.push(vs);
}
// Before the new screen goes in: what the change needs of the screen that is going (its elements, its page's look).
export function swapPrep(prev, view) {
  swapCancel();
  try {
    const k = swapKind(prev, view);
    swapTrack(view);
    const D = k && swapMs(k.kind);
    if (!k || !D) return null;
    const r = app.getBoundingClientRect(), cs = getComputedStyle(app);
    const o = Object.assign({}, k, { D, rect: { left: r.left, top: r.top, width: r.width, height: r.height }, bg: cs.background, pad: cs.padding });
    if (!good(o.rect)) return null;
    if (k.kind === 'slide') { o.old = app.querySelector(':scope > main.scr'); if (!o.old) return null; o.oldRect = rectOf(o.old); o.snap = animSnap(o.old); }
    else { o.olds = [...app.children].filter(e => !e.classList.contains('explain')); o.snap = animSnap(app); }
    return o;
  } catch (e) { return null; }
}
function swapEnd(w) {
  if (!w || swap !== w) return;
  swap = null; clearTimeout(w.timer);
  for (const e of [w.ghost, w.burst]) if (e && e.parentNode) e.remove();
  if (w.live && w.live.getAnimations) for (const a of w.live.getAnimations()) if (a.id === SWAP_ID) a.cancel();
}
export function swapCancel() { if (swap) swapEnd(swap); }
const SWAP_ID = 'ttc-swap';
// The burst of the wipe: twenty spikes, yellow with a red heart and an ink edge (decoration: no taps).
function burstEl(cx, cy, R) {
  const n = 20, pts = (ro, ri) => Array.from({ length: n * 2 }, (_, i) => { const a = (i / (n * 2)) * Math.PI * 2, rr = i % 2 ? ri : ro; return `${(Math.cos(a) * rr).toFixed(1)},${(Math.sin(a) * rr).toFixed(1)}`; }).join(' ');
  const el = document.createElement('div');
  el.className = 'ccwipe'; el.setAttribute('aria-hidden', 'true');
  el.style.cssText = `left:${cx.toFixed(1)}px;top:${cy.toFixed(1)}px;width:${(R * 2).toFixed(0)}px;height:${(R * 2).toFixed(0)}px;margin:${(-R).toFixed(0)}px 0 0 ${(-R).toFixed(0)}px`;
  el.innerHTML = `<svg viewBox="-100 -100 200 200"><polygon points="${pts(100, 74)}" fill="#f6c21b" stroke="#161210" stroke-width="3" stroke-linejoin="round"/><polygon points="${pts(62, 44)}" fill="#e5432a" stroke="#161210" stroke-width="2.5" stroke-linejoin="round"/></svg>`;
  document.body.appendChild(el);
  return el;
}
// After the new screen went in: the change starts (or, on a redraw part way through, carries on on the new elements).
export function swapRun(o) {
  if (!o) { swapKeep(); return; }
  try {
    const tl = document.timeline && document.timeline.currentTime, t0 = typeof tl === 'number' ? tl : performance.now();
    const w = { kind: o.kind, D: o.D, t0, end: t0 + o.D };
    const g = document.createElement('div');
    g.className = 'zghost ccghost'; g.setAttribute('aria-hidden', 'true');
    const r = o.kind === 'slide' ? o.oldRect : o.rect;
    g.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
    if (o.kind === 'slide') { g.appendChild(o.old); }
    else { g.style.background = o.bg; g.style.padding = o.pad; g.classList.add('full'); for (const e of o.olds) g.appendChild(e); }
    document.body.appendChild(g);
    animCarry(g, o.snap);
    w.ghost = g; swap = w;
    if (o.kind === 'slide') {
      const dx = o.back ? 1 : -1;
      g.animate([{ transform: 'none', opacity: 1 }, { transform: `translateX(${dx * 38}%) skewX(${dx * 6}deg)`, opacity: 0 }], { duration: o.D, easing: SWAP.ease, fill: 'both' }).startTime = t0;
      w.kf = [{ transform: `translateX(${-dx * 70}%) skewX(${-dx * 7}deg)`, opacity: 0 }, { opacity: 1, offset: .45 }, { transform: 'none', opacity: 1 }];
    } else {
      const R = Math.hypot(o.rect.width, o.rect.height) * .82, cx = o.rect.left + o.rect.width / 2, cy = o.rect.top + o.rect.height * .46;
      w.burst = burstEl(cx, cy, R);
      w.burst.animate([{ transform: 'scale(.02) rotate(-40deg)', opacity: 1 }, { transform: 'scale(1) rotate(0deg)', opacity: 1, offset: .5 }, { transform: 'scale(1.25) rotate(8deg)', opacity: 0 }], { duration: o.D, easing: 'cubic-bezier(.5, 0, .3, 1)', fill: 'both' }).startTime = t0;
      g.animate([{ opacity: 1 }, { opacity: 1, offset: .49 }, { opacity: 0, offset: .5 }, { opacity: 0 }], { duration: o.D, fill: 'both' }).startTime = t0;
    }
    w.timer = setTimeout(() => swapEnd(w), o.D + 400);
    const last = g.getAnimations ? g.getAnimations() : [];
    if (last[0]) last[0].onfinish = () => swapEnd(w);
    swapKeep();
  } catch (e) { swapCancel(); }
}
function swapKeep() {
  const w = swap;
  if (!w || !w.kf) return;
  if (performance.now() > w.end + 50) return;
  const main = app.querySelector(':scope > main.scr');
  if (!main || !main.animate) return;
  w.live = main;
  if (main.getAnimations && main.getAnimations().some(a => a.id === SWAP_ID)) return;
  const a = main.animate(w.kf, { duration: w.D, easing: SWAP.ease, fill: 'backwards' });
  a.id = SWAP_ID; a.startTime = w.t0;
}
// Speed lines out from the square being opened, over the zoom in (comic.css .zlines): outside #app, no taps, gone at its end.
function zoomLines(R, D, t0) {
  if (REDUCED || !R) return;
  try {
    const el = document.createElement('i');
    el.className = 'zlines'; el.setAttribute('aria-hidden', 'true');
    el.style.left = `${(R.left + R.width / 2).toFixed(1)}px`; el.style.top = `${(R.top + R.height / 2).toFixed(1)}px`;
    document.body.appendChild(el);
    const gone = () => { if (el.parentNode) el.remove(); };
    const a = el.animate([{ opacity: 0, transform: 'translate(-50%, -50%) scale(.35)' }, { opacity: .5, offset: .25 }, { opacity: 0, transform: 'translate(-50%, -50%) scale(1.25)' }], { duration: D, easing: 'ease-out', fill: 'both' });
    a.startTime = t0; a.onfinish = a.oncancel = gone;
    setTimeout(gone, D + 500);
  } catch (e) { /* (no lines: the zoom goes on) */ }
}
function zoomKeep() {
  const z = zoom;
  if (!z || !z.mainKf) return;
  if (performance.now() > z.end + 50) return;
  const main = app.querySelector(':scope > main.scr');
  if (!main || (z.dir === 'in' ? !main.classList.contains('mini') : !main.classList.contains('board-scr'))) { zoomEnd(z); return; }
  z.liveMain = main; zoomOn(main, z.mainKf);
  if (z.sqKf) { z.liveSq = main.querySelectorAll('.board > .sq')[z.i]; zoomOn(z.liveSq, z.sqKf); }
}
