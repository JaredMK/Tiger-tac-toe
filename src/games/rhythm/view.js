// Rhythm Tap: the screen, the miniature, the move's words and sounds, and this phone's round.
// The stage is a canvas: three lanes in their own colours (never a player's), notes coming down them to the line near
// the foot, a pad under each lane. This phone's round is live from Go (ui/round.js): a kick on every beat and a tick
// between (synthesised, scheduled a little ahead from the round's own clock: no recorded music), two beats counted in,
// then the notes; a tap on a lane plays the note at the line in that lane, each with its own pitch, so a round played
// well is a tune: PERFECT or GOOD pops over the lane, a note let past is a MISS and a life gone (the hearts at the top).
// Anyone else's round is never streamed: its result is laid out, its Perfects, Goods and misses counted, then the points.
import { RHYTHM, rhythmCfg, rhythmChart, rhythmJudge, rhythmScore, rhythmShowMs } from './rules.js';
import { SND, ownPress } from '../../audio/sound.js';
import { haptic } from '../../net/platform.js';
import { app, state } from '../../ui/app.js';
import { fxAt } from '../../ui/fx.js';
import { ownMove } from '../../ui/haptics.js';
import { lateAt } from '../../ui/progress.js';
import { makeRound } from '../../ui/round.js';
import { drawTimeBar, runColours, runInputAt } from '../../ui/runner.js';
import { stage } from '../../ui/stage.js';
import { thumbArt } from '../../ui/thumbs.js';
import { barRows, ptsTally } from '../../ui/tok.js';
import { flashAnimating, skipFlash } from '../../ui/turns.js';

export const ownLine = true;
export const replay = { synth: () => [] };                         // the move is a round's result: shown from the flash
let src = null, hooked = false, skipped = null;
const LANE = ['#4aa3e8', '#5ccf7a', '#b07be8'], GEO = { w: 100, h: 120, x0: 8, lw: 28, line: 97, top: 10 };
const rate = tone => Math.pow(2, RHYTHM.scale[tone] / 12);
const round = makeRound('rhythm', {
  mine: () => !!src && src.mine,
  begin: (mini, p) => { const c = rhythmCfg(mini), notes = rhythmChart(mini, p); return { c, notes, d: notes.map(() => undefined), res: [], pops: [], miss: 0, pts: 0, out: null, sched: -1, press: [0, 0, 0] }; },
  step(L, ms) {
    // the beat, scheduled a little ahead of the round's own clock; the notes let past; the round's end
    const T = L.c.secs * 1000, half = L.c.beat / 2;
    for (let k = L.sched + 1; k * half <= ms + 180 && k * half <= T && L.out == null; k++) { L.sched = k; SND.play(k % 2 ? 'rtHat' : 'rtKick', { at: Math.max(0, (k * half - ms) / 1000), rate: k < RHYTHM.count * 2 && k % 2 === 0 ? 1.5 : 1 }); }
    L.notes.forEach((n, i) => { if (L.d[i] === undefined && L.out == null && ms > n.t + L.c.win) judge(L, i, null, ms); });
    return !(L.out != null ? ms > L.out + RHYTHM.out : ms > T);
  },
  move: L => ({ d: L.d.map(v => (v === undefined ? null : v)) }),
  go: () => go(),
});
function judge(L, i, dt, ms) {
  const j = rhythmJudge(L.c, dt); L.d[i] = dt; L.res[i] = j; L.pops.push({ lane: L.notes[i].lane, j, t: ms });
  if (j === 'miss') { L.miss++; SND.play('rtMiss'); haptic('error'); if (L.c.lives > 0 && L.miss >= L.c.lives) L.out = ms; }
  else { L.pts += j === 'perfect' ? RHYTHM.pp : RHYTHM.gp; SND.play('rtNote', { rate: rate(L.notes[i].tone), vol: j === 'perfect' ? 1 : 0.6 }); haptic(j === 'perfect' ? 'medium' : 'tap'); }
}
function tap(lane) {
  const L = round.live; if (!L || L.out != null) return;
  const ms = performance.now() - L.t0; L.press[lane] = ms;
  const i = L.notes.findIndex((n, k) => L.d[k] === undefined && n.lane === lane && Math.abs(ms - n.t) <= L.c.win);
  if (i >= 0) judge(L, i, Math.round(ms - L.notes[i].t), ms); else SND.play('rtTick');
}
function hook() {
  if (hooked || !app || typeof app.addEventListener !== 'function') return;
  hooked = true;
  app.addEventListener('pointerdown', e => {
    if (!round.live || state.screen !== 'mini' || !runInputAt(e.target) || !e.target.closest) return;
    const f = e.target.closest('.rtfield'); if (!f) return;
    const b = f.getBoundingClientRect(), x = (e.clientX - b.left) / b.width * GEO.w;
    tap(Math.max(0, Math.min(RHYTHM.lanes - 1, Math.floor((x - GEO.x0) / GEO.lw)))); e.preventDefault(); ownPress();
  }, { passive: false });
}
export const actions = { 'rt-go': () => { ownPress(); if (!round.live) round.start(); } };

// ---- the drawing ----
function lanes(c, W, H, u, P, press, now) {
  c.fillStyle = '#231b3a'; c.fillRect(0, 0, W, H);
  for (let k = 0; k < RHYTHM.lanes; k++) {
    const x = (GEO.x0 + k * GEO.lw) * u;
    c.fillStyle = k % 2 ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.1)'; c.fillRect(x, 0, GEO.lw * u, H);
    const down = press && now != null && now - press[k] < 130;
    c.fillStyle = LANE[k]; c.strokeStyle = P.ink; c.lineWidth = 0.8 * u; c.beginPath(); c.roundRect(x + 2 * u, (GEO.line + 6 + (down ? 1.2 : 0)) * u, (GEO.lw - 4) * u, 12 * u, 3 * u); c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.roundRect(x + 4 * u, (GEO.line + 7.5 + (down ? 1.2 : 0)) * u, (GEO.lw - 8) * u, 3 * u, 1.5 * u); c.fill();
  }
  c.strokeStyle = '#fff'; c.lineWidth = 1.1 * u; c.beginPath(); c.moveTo(GEO.x0 * u, GEO.line * u); c.lineTo((GEO.x0 + RHYTHM.lanes * GEO.lw) * u, GEO.line * u); c.stroke();
}
function gem(c, u, lane, y, P, alpha, glow) {
  const x = (GEO.x0 + lane * GEO.lw + GEO.lw / 2) * u;
  c.save(); c.globalAlpha = alpha == null ? 1 : alpha;
  if (glow) { c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.roundRect(x - 12.5 * u, (y - 5.5) * u, 25 * u, 11 * u, 5 * u); c.fill(); }
  c.fillStyle = LANE[lane]; c.strokeStyle = P.ink; c.lineWidth = 0.8 * u; c.beginPath(); c.roundRect(x - 10.5 * u, (y - 3.8) * u, 21 * u, 7.6 * u, 3.6 * u); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.roundRect(x - 8 * u, (y - 2.6) * u, 16 * u, 2 * u, 1 * u); c.fill();
  c.restore();
}
function word(c, u, x, y, txt, fill, P, size, alpha) {
  c.save(); c.globalAlpha = alpha == null ? 1 : alpha; c.font = `400 ${Math.round(size * u)}px Bangers, "Arial Black", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.lineWidth = 1.8 * u; c.strokeStyle = P.ink; c.fillStyle = fill; c.strokeText(txt, x * u, y * u); c.fillText(txt, x * u, y * u); c.restore();
}
const JCOL = { perfect: '#ffd23f', good: '#fff', miss: '#ff8a75' }, JWORD = { perfect: 'PERFECT', good: 'GOOD', miss: 'MISS' };
const go = stage('canvas.rtcv', (c, W, H, now) => {
  round.tick(now);
  if (!src) return false;
  const P = runColours(), u = W / GEO.w, L = round.live && round.on(src.zoom) ? round.live : null;
  c.clearRect(0, 0, W, H);
  if (L) {
    const ms = now - L.t0, T = L.c.secs * 1000;
    lanes(c, W, H, u, P, L.press, ms);
    const pulse = 1 - ((ms % L.c.beat) / L.c.beat); c.fillStyle = `rgba(255,255,255,${0.1 * pulse * pulse})`; c.fillRect(0, 0, W, H);
    L.notes.forEach((n, i) => { const y = GEO.line - (n.t - ms) / RHYTHM.fall * (GEO.line - GEO.top); if (y < -6 || y > GEO.h + 6) return; if (L.d[i] === undefined) gem(c, u, n.lane, y, P, 1, Math.abs(n.t - ms) <= L.c.win); else if (L.res[i] === 'miss') gem(c, u, n.lane, y, P, 0.3); });
    L.pops = L.pops.filter(q => ms - q.t < 520);
    L.pops.forEach(q => { const k = (ms - q.t) / 520; word(c, u, GEO.x0 + q.lane * GEO.lw + GEO.lw / 2, GEO.line - 10 - k * 9, JWORD[q.j], JCOL[q.j], P, q.j === 'perfect' ? 6.4 : 6, 1 - k * k); });
    if (ms < RHYTHM.count * L.c.beat) word(c, u, 50, 52, String(RHYTHM.count - Math.floor(ms / L.c.beat)), '#fff', P, 26, 0.9);
    if (L.out != null) word(c, u, 50, 52, 'OUT!', '#ff8a75', P, 20, 1);
    for (let k = 0; k < L.c.lives; k++) { c.fillStyle = k < L.c.lives - L.miss ? '#ff5d73' : 'rgba(255,255,255,.2)'; c.strokeStyle = P.ink; c.lineWidth = 0.5 * u; const hx = (8 + k * 7) * u, hy = 9 * u, s = 2.6 * u; c.beginPath(); c.moveTo(hx, hy + s); c.bezierCurveTo(hx - s * 2, hy - s * 0.4, hx - s * 0.6, hy - s * 1.6, hx, hy - s * 0.4); c.bezierCurveTo(hx + s * 0.6, hy - s * 1.6, hx + s * 2, hy - s * 0.4, hx, hy + s); c.fill(); c.stroke(); }
    word(c, u, 88, 9.5, String(L.pts), '#fff', P, 9, 1);
    drawTimeBar(c, W, H, 1 - ms / T, P);
    return true;
  }
  lanes(c, W, H, u, P, null, null);
  const l = src.show;
  if (l) {                                                        // a result on show: Perfects, Goods and misses, counted
    const at = src.a ? fxAt('move', src.a) : null, t = src.a ? (at == null ? Infinity : now - at) : Infinity;
    c.fillStyle = 'rgba(20,14,36,.72)'; c.fillRect(0, 0, W, H);
    [['perfect', l.perf], ['good', l.good], ['miss', l.miss]].forEach(([j, n], k) => { const due = RHYTHM.pre + k * RHYTHM.show; if (t < due) return; const pop = Math.min(1, (t - due) / 160), y = 30 + k * 22; word(c, u, 36, y, JWORD[j], JCOL[j], P, 9 * (0.7 + 0.3 * pop), 1); word(c, u, 78, y, '×' + n, '#fff', P, 11 * (0.7 + 0.3 * pop), 1); });
    if (l.out && t >= RHYTHM.pre + 3 * RHYTHM.show) word(c, u, 50, 98, 'OUT!', '#ff8a75', P, 12, 1);
    return t < rhythmShowMs() + 300;
  }
  [[0, 40], [1, 62], [2, 26], [0, 78]].forEach(([k, y]) => gem(c, u, k, y, P, 0.85));
  return false;
});
const words = l => (l.out ? `Out! +${l.pts}` : `${l.perf} perfect! +${l.pts}`);
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  hook();
  const c = rhythmCfg(mini), s = a && a.rt ? a.rt : null, own = !!s && ownMove(a), o = { view, locked, turn }, on = round.on(state.zoom);
  if (s && own && skipped !== a && flashAnimating()) { skipped = a; setTimeout(() => { if (state.flash === a) skipFlash(); }, 0); }   // (a round played here was heard live: straight to its result)
  const rest = !s && (view || d) && mini.last ? mini.last : null, l = s || rest, by = s ? a.by : rest ? rest.by : turn, mine = !view && !s && !locked && !d, end = s && !own ? rhythmShowMs() : 0;
  const tal = p => ptsTally(p, o, c.target, mini.score[p], s && !own && a.by === p ? s.from : null, end);
  const line = s && !own ? `<p ${lateAt('rtline ' + (s.pts ? 'ok' : 'no'), end)} role="status">${words(s)}</p>` : `<p class="rtline${l && !on ? (l.pts ? ' ok' : ' no') : ''}">${l && !on ? words(l) : ''}</p>`;
  src = { mini, a: s && !own ? a : null, show: on ? null : l, by, mine, zoom: state.zoom };
  const btn = view ? '' : `<button class="big ${turn} rtbtn" data-act="rt-go"${mine && !on ? '' : ' disabled'}>${on ? 'Tap the lanes!' : 'Go'}</button>`;
  go();
  return `<div class="g-rt pc-${by}"><div class="ctals two">${tal('X')}${tal('O')}</div><div class="rtbox"><div class="rtfield${on ? ' live' : ''}"><canvas class="rtcv" aria-label="Three lanes of notes"></canvas></div></div>${line}${btn}</div>`;
}
// The miniature: the three lanes with a note in each, over each player's points as a bar.
export function miniature(mini, final) {
  const c = rhythmCfg(mini);
  const art = `<svg class="trt" viewBox="0 0 60 44"><rect class="trtb" x="2" y="2" width="56" height="40" rx="5"/>${[0, 1, 2].map(k => `<rect x="${7 + k * 16}" y="${[10, 22, 6][k]}" width="14" height="7" rx="3.500" fill="${LANE[k]}" class="trtn"/>`).join('')}<path class="trtl" d="M5 35h50"/></svg>`;
  return thumbArt(art, barRows(mini.score, c.target), 'trtw col', `Rhythm Tap: X ${mini.score.X}, O ${mini.score.O} of ${c.target} points`);
}
export function moveText(f, who) { const s = f.rt; return !s ? `${who} played a round` : `${who} scored ${s.pts}${s.out ? ' and went out' : ''}`; }
// Someone else's round, as its result is laid out: a note for the Perfects, a softer one for the Goods, a dull one for
// the misses, then a chime for points or a thud for none. A round played here was heard live.
export function sounds(f, add, won, mini, last) {
  const s = f.rt; if (!s || ownMove(f)) return;
  add('rtNote', RHYTHM.pre, rate(4)); add('rtNote', RHYTHM.pre + RHYTHM.show, rate(2)); add('rtMiss', RHYTHM.pre + 2 * RHYTHM.show);
  add(s.pts ? 'ding' : 'thud', rhythmShowMs());
}
