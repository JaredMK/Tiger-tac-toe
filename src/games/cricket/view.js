// Darts Cricket: the screen, the miniature, the move's words and sounds, and this phone's two taps.
// The board is a canvas: a ring of wedges round the bullseye, the numbers in play in their own colours with the
// number in each (the mover's marks as pips by it; a closed number greyed with a tick), the dead wedges dark, the
// outer band that counts twice lighter. The throw is Bullseye's: a line sweeps across and a tap stops it, a second
// sweeps up and down and a tap stops it (bullseye/rules.js bullsWave; real time whatever the Animation setting; a tap
// anywhere on the board or the Stop button), and the dart lands where they cross. Someone else's throw shows their
// two stops first, each run straight to where it was made (CRK.ax, CRK.ay), then the dart.
import { bullsWave } from '../bullseye/rules.js';
import { CRK, cricketCfg, cricketMs, cricketWedge } from './rules.js';
import { SND, ownPress } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { haptic } from '../../net/platform.js';
import { blocked } from '../../net/room.js';
import { app, state } from '../../ui/app.js';
import { fxAt } from '../../ui/fx.js';
import { pressTaken, pressTime, pressTook } from '../../ui/press.js';
import { ownMove } from '../../ui/haptics.js';
import { arcTally, lateAt, pips } from '../../ui/progress.js';
import { runColours, runInputAt } from '../../ui/runner.js';
import { stage } from '../../ui/stage.js';
import { thumbArt } from '../../ui/thumbs.js';
import { barRows, ptsTally } from '../../ui/tok.js';
import { flashAnimating, skipFlash } from '../../ui/turns.js';

export const ownLine = true;
export const replay = { synth: () => [] };                         // the move is its two stops: shown from the flash
let aim = null, src = null, hooked = false, skipped = null;       // aim: this phone's throw under way: { sq, p, n, phase 0-2, t0, x }
const WCOL = ['#5aa9e6', '#7bd389', '#b08be8', '#f29e4c', '#58c4c4'];
const lineAt = (c, t) => CRK.lo + (CRK.hi - CRK.lo) * bullsWave(t, c.sweep);
const r1 = v => Math.round(v * 10) / 10;
// A stop at `at`: the moment of the press itself (ui/press.js pressTime: the finger's own moment, never when the page got to it).
function stop(at = performance.now()) {
  const sq = state.squares && state.squares[state.zoom], m = sq && sq.mini;
  if (!aim || !m || m.type !== 'cricket' || aim.sq !== state.zoom || aim.phase > 1 || state.flash || state.done || blocked() || !src || !src.mine) return false;
  const c = cricketCfg(m), now = Math.max(at, aim.t0), v = r1(lineAt(c, now - aim.t0)), ph = aim.phase;
  SND.play('mark', { rate: 1 + ph * 0.12 }); haptic('tap');
  if (ph === 0) { aim.x = v; aim.phase = 1; aim.t0 = now; }
  else { const mv = { x: aim.x / 100, y: v / 100 }; aim.y = v; aim.phase = 2; if (state.online) SND.play('dartThrow'); attemptMove(mv); }   // (the move may redraw at once and drop the aim: nothing of it is read after)
  go();
  return true;
}
function hook() {
  if (hooked || !app || typeof app.addEventListener !== 'function') return;
  hooked = true;
  // the board or the Stop button, on the press itself (a click comes only once the finger lifts); Space or Enter on the button
  app.addEventListener('pointerdown', e => {
    if (state.screen !== 'mini' || !runInputAt(e.target) || !(e.target.closest && e.target.closest('.ckfield.live, .ckbtn:not(:disabled)'))) return;
    if (e.target.closest('.ckbtn')) pressTook('ck-stop');                    // (the button's press is its tap, taken or not: its click does nothing)
    if (stop(pressTime(e))) { e.preventDefault(); ownPress(); }
  }, { passive: false });
  app.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat && e.target.closest && e.target.closest('.ckbtn')) { e.preventDefault(); pressTook('ck-stop'); if (stop(pressTime(e))) ownPress(); } });
}
export const actions = { 'ck-stop': (el, e) => { if (pressTaken('ck-stop')) return; ownPress(); stop(pressTime(e)); } };   // (the click after a press already taken does nothing; any other click, a stop)
const ease = u => (u <= 0 ? 0 : u >= 1 ? 1 : 1 - (1 - u) * (1 - u));
function drawDart(c, u, x, y, col, P, k) {                        // k: 0 in the hand (large, low) .. 1 stuck in the board
  const s = (2.6 - 1.6 * k) * u;
  c.save(); c.translate(x * u, y * u); c.rotate(-0.7); c.strokeStyle = P.ink; c.lineWidth = u * 0.5; c.lineJoin = 'round';
  c.fillStyle = '#c9c9d4'; c.beginPath(); c.moveTo(0, 0); c.lineTo(s * 0.5, -s * 0.28); c.lineTo(s * 2.2, -s * 0.28); c.lineTo(s * 2.2, s * 0.28); c.lineTo(s * 0.5, s * 0.28); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = col; c.beginPath(); c.moveTo(s * 2.2, 0); c.lineTo(s * 3.4, -s * 0.9); c.lineTo(s * 3.9, -s * 0.9); c.lineTo(s * 3.2, 0); c.lineTo(s * 3.9, s * 0.9); c.lineTo(s * 3.4, s * 0.9); c.closePath(); c.fill(); c.stroke();
  c.restore();
}
const go = stage('canvas.ckcv', (c, W, H, now) => {
  if (!src) return false;
  const { mini, a, by } = src, P = runColours(), u = W / 100, cfg = cricketCfg(mini), col = by === 'O' ? P.O : P.X, n = mini.nums.length, [cx, cy] = CRK.c;
  const s = a ? a.ck : null, at = s ? fxAt('move', a) : null, own = !!(s && src.own), pre = CRK.ax + CRK.ay, t = s ? (at == null ? Infinity : now - at) + (own ? pre : 0) : 0, land = pre + CRK.fly;
  const marks = s && t < land ? src.before : mini.marks[by];
  c.clearRect(0, 0, W, H); c.fillStyle = '#d7c4a3'; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(22,18,16,.2)'; c.beginPath(); c.arc((cx + 1) * u, (cy + 1.6) * u, (CRK.R + 3.5) * u, 0, 7); c.fill();
  c.fillStyle = '#2b2b33'; c.strokeStyle = P.ink; c.lineWidth = 0.9 * u; c.beginPath(); c.arc(cx * u, cy * u, (CRK.R + 3.5) * u, 0, 7); c.fill(); c.stroke();
  for (let k = 0; k < n * 2; k++) {
    const w = cricketWedge(mini, k), a0 = w.mid - w.half, a1 = w.mid + w.half, live = w.num >= 0, closed = live && marks[w.num] >= cfg.hits;
    const wedge = (r0, r1, fill) => { c.fillStyle = fill; c.beginPath(); c.arc(cx * u, cy * u, r1 * u, a0, a1); c.arc(cx * u, cy * u, r0 * u, a1, a0, true); c.closePath(); c.fill(); c.strokeStyle = P.ink; c.lineWidth = 0.5 * u; c.stroke(); };
    const base = !live ? '#4a4a55' : closed ? '#b9b9c2' : WCOL[w.num % WCOL.length];
    wedge(cfg.bull, CRK.R - cfg.band, base);
    if (cfg.band > 0) { wedge(CRK.R - cfg.band, CRK.R, base); if (live && !closed) { c.fillStyle = 'rgba(255,255,255,.38)'; c.beginPath(); c.arc(cx * u, cy * u, CRK.R * u, a0, a1); c.arc(cx * u, cy * u, (CRK.R - cfg.band) * u, a1, a0, true); c.closePath(); c.fill(); } }
    if (live) {
      const rr = (cfg.bull + CRK.R - cfg.band) / 2, tx = (cx + Math.cos(w.mid) * rr) * u, ty = (cy + Math.sin(w.mid) * rr) * u;
      c.font = `400 ${Math.round(Math.max(14, 9 * u))}px Bangers, "Arial Black", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = closed ? 'rgba(22,18,16,.45)' : P.ink; c.fillText(closed ? '✓' : String(mini.nums[w.num]), tx, ty - 1.5 * u);
      for (let h = 0; h < cfg.hits; h++) { const px = tx + (h - (cfg.hits - 1) / 2) * 4.2 * u, py = ty + 5.2 * u; c.fillStyle = h < marks[w.num] ? col : 'rgba(255,255,255,.75)'; c.strokeStyle = P.ink; c.lineWidth = 0.45 * u; c.beginPath(); c.arc(px, py, 1.5 * u, 0, 7); c.fill(); c.stroke(); }
    }
  }
  const bullDone = marks[n] >= cfg.hits;
  c.fillStyle = bullDone ? '#b9b9c2' : '#fff'; c.strokeStyle = P.ink; c.lineWidth = 0.7 * u; c.beginPath(); c.arc(cx * u, cy * u, cfg.bull * u, 0, 7); c.fill(); c.stroke();
  if (cfg.heart > 0) { c.fillStyle = bullDone ? '#8f8f99' : '#e5432a'; c.beginPath(); c.arc(cx * u, cy * u, cfg.heart * u, 0, 7); c.fill(); c.stroke(); }
  for (let h = 0; h < cfg.hits; h++) { c.fillStyle = h < marks[n] ? col : 'rgba(255,255,255,.85)'; c.strokeStyle = P.ink; c.lineWidth = 0.45 * u; c.beginPath(); c.arc((cx + (h - (cfg.hits - 1) / 2) * 4.2) * u, (cy + cfg.bull + 3.2) * u, 1.5 * u, 0, 7); c.fill(); c.stroke(); }
  const line = (x0, y0, x1, y1, w, dash) => { c.save(); c.strokeStyle = P.ink; c.lineWidth = w * u; if (dash) c.setLineDash([u * 2, u * 1.6]); c.beginPath(); c.moveTo(x0 * u, y0 * u); c.lineTo(x1 * u, y1 * u); c.stroke(); c.restore(); };
  let more = false;
  if (s) {
    const fade = t < land ? 1 : Math.max(0, 1 - (t - land) / 300);
    if (fade > 0) { c.save(); c.globalAlpha = fade; const x = own ? s.x : CRK.lo + (s.x - CRK.lo) * ease(t / CRK.ax), y = own ? s.y : CRK.lo + (s.y - CRK.lo) * ease((t - CRK.ax) / CRK.ay); line(x, 0, x, 100, 0.7, t >= CRK.ax); if (t >= CRK.ax) line(0, y, 100, y, 0.7, t >= pre); c.restore(); }
    if (t >= pre) { const k = ease((t - pre) / CRK.fly); drawDart(c, u, 50 + (s.x - 50) * k, 106 + (s.y - 106) * k - Math.sin(k * Math.PI) * 10, col, P, k); }
    if (t >= land && t < land + 420) { const k2 = (t - land) / 420; c.save(); c.globalAlpha = 1 - k2; if (s.add || s.sc) { c.translate(s.x * u, s.y * u); c.fillStyle = '#ffd23f'; c.strokeStyle = P.ink; c.lineWidth = 0.5 * u; c.beginPath(); for (let q = 0; q < 16; q++) { const rr = (q % 2 ? 3 : 7) * u * (0.5 + k2), an = q * Math.PI / 8; c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } c.closePath(); c.fill(); c.stroke(); } else { c.strokeStyle = P.ink; c.lineWidth = 0.6 * u; c.beginPath(); c.arc(s.x * u, s.y * u, (2 + k2 * 5) * u, 0, 7); c.stroke(); } c.restore(); }
    more = t < land + 450;
  } else if (aim && src.mine && aim.sq === src.zoom) {
    const tt = now - aim.t0;
    if (aim.phase === 0) line(lineAt(cfg, tt), 0, lineAt(cfg, tt), 100, 0.9);
    else { line(aim.x, 0, aim.x, 100, 0.7, true); line(0, aim.phase === 1 ? lineAt(cfg, tt) : aim.y, 100, aim.phase === 1 ? lineAt(cfg, tt) : aim.y, aim.phase === 1 ? 0.9 : 0.7, aim.phase !== 1); }
    more = true;
  } else if (src.rest && src.rest.by === by) drawDart(c, u, src.rest.x, src.rest.y, col, P, 1);
  return more;
});
const sum = (mini, c, p) => mini.marks[p].reduce((x, v) => x + Math.min(c.hits, v), 0);
function words(mini, l) {
  const n = mini.nums.length;
  if (l.t === -2) return 'Off the board';
  if (l.t === -1) return 'Dead wedge';
  const name = l.t === n ? 'Bullseye' : String(mini.nums[l.t]);
  if (l.closed) return `${name} closed!`;
  if (l.add) return `${name}${l.add > 1 ? ' ×2' : ''}!`;
  return l.sc ? `${name}: +${l.sc}` : `${name}: closed already`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  hook();
  const c = cricketCfg(mini), s = a && a.ck ? a.ck : null, own = !!s && ownMove(a), o = { view, locked, turn }, total = (mini.nums.length + 1) * c.hits;
  const by = s ? a.by : (view || d) && mini.last ? mini.last.by : turn, mine = !view && !locked && !s && !d;
  if (mine && !(aim && aim.sq === state.zoom && aim.p === turn && aim.n === mini.n[turn])) aim = { sq: state.zoom, p: turn, n: mini.n[turn], phase: 0, t0: performance.now() };
  if (!mine && aim && s) aim = null;
  if (s && own && skipped !== a && flashAnimating()) { skipped = a; setTimeout(() => { if (state.flash === a) skipFlash(); }, CRK.fly + CRK.stick + CRK.hold); }
  const land = (own ? 0 : CRK.ax + CRK.ay) + CRK.fly, ok = l => !!(l.add || l.sc);
  const tal = p => (total > 10 && !c.scoring ? ptsTally(p, o, total, sum(mini, c, p), s && s.add && a.by === p ? sum(mini, c, p) - s.add : null, land)   // (more marks than pips have room for: a gauge)
    : arcTally(p, o, `<span class="wtal ckmarks">${total > 10 ? `<b class="ckpts">${sum(mini, c, p)}/${total}</b>` : pips(p, sum(mini, c, p), total, !!(s && s.add && a.by === p), land)}${c.scoring ? `<b class="ckpts" aria-label="${mini.pts[p]} points">${mini.pts[p]}</b>` : ''}</span>`));
  const l = s || ((view || d) && mini.last ? mini.last : null);
  const line = l ? `<p ${s ? lateAt('ckline ' + (ok(l) ? 'ok' : 'no'), land) : `class="ckline ${ok(l) ? 'ok' : 'no'}"`} role="status">${words(mini, l)}</p>` : '<p class="ckline"></p>';
  const before = s ? s.marks.map((v, t) => (t === s.t ? v - s.add : v)) : null;
  src = { mini, a: s ? a : null, by, own, mine, zoom: state.zoom, rest: !s && l ? l : null, before };
  const btn = view ? '' : `<button class="big ${turn} ckbtn" data-act="ck-stop"${mine && (!aim || aim.phase < 2) ? '' : ' disabled'}>Stop</button>`;
  go();
  return `<div class="g-ck pc-${by}"><div class="ctals two">${tal('X')}${tal('O')}</div><div class="ckbox"><div class="ckfield${mine ? ' live' : ''}"><canvas class="ckcv" aria-label="The board: ${mini.nums.join(', ')} and the bullseye"></canvas></div></div>${line}${btn}</div>`;
}
// The miniature: the board (its numbers' wedges in colour, the dead ones dark, the bullseye), beside each player's marks as a bar.
export function miniature(mini, final) {
  const c = cricketCfg(mini), n = mini.nums.length, total = (n + 1) * c.hits, P = (r, an) => `${(30 + Math.cos(an) * r).toFixed(1)} ${(30 + Math.sin(an) * r).toFixed(1)}`;
  const wedges = Array.from({ length: n * 2 }, (_, k) => { const w = cricketWedge(mini, k); return `<path d="M30 30L${P(26, w.mid - w.half)}A26 26 0 0 1 ${P(26, w.mid + w.half)}Z" fill="${w.num < 0 ? '#4a4a55' : WCOL[w.num % WCOL.length]}"/>`; }).join('');
  const art = `<svg class="tck" viewBox="0 0 60 60"><circle class="tckr" cx="30" cy="30" r="28.500"/><g class="tckw">${wedges}</g><circle class="tckb" cx="30" cy="30" r="7"/><circle class="tckh" cx="30" cy="30" r="3.200"/></svg>`;
  return thumbArt(art, barRows({ X: sum(mini, c, 'X'), O: sum(mini, c, 'O') }, total), 'tckw2', `Darts Cricket: X ${sum(mini, c, 'X')}, O ${sum(mini, c, 'O')} of ${total} marks`);
}
export function moveText(f, who) { const l = f.ck; return l && (l.add || l.sc) ? `${who} hit a number` : `${who} missed`; }
// Someone else's throw: Bullseye's tick at each of their two stops, then the dart's whoosh and where it lands: its
// thunk and quiver, a sparkle for a number closed, a thud for nothing. A throw made here had its ticks as it was aimed.
export function sounds(f, add, won, mini, last) {
  const l = f.ck; if (!l) return;
  const own = ownMove(f), pre = own ? 0 : CRK.ax + CRK.ay;
  if (!own) { add('mark', CRK.ax, 1); add('mark', pre, 1.12); }
  if (!(own && state.online)) add('dartThrow', pre);
  if (l.add || l.sc) { add('dartHit', pre + CRK.fly); add('dartQuiver', pre + CRK.fly + 40); if (l.closed) add('sparkle', pre + CRK.fly + 140); } else add('thud', pre + CRK.fly);
}
