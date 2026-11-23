// Door Drop: the screen, the miniature, the move's words and sounds.
// The tower is a canvas the size of its box, seen from the front in cross-section: a roof, the floors one under the
// other (each a wall of wooden doors over a floor slab, a little plaque with its number), the ground floor at the
// bottom (pavement, daylight through an open way out, a flag). The camera shows about two and a half floors and
// follows the runner down (DOORSV). Over the canvas, a button on each door of the mover's floor still worth trying
// (placed by the frame loop where the camera has it). Doors keep their marks: a dead end boarded up with a red cross, the
// way down left ajar with a green arrow inside. A move (rules.js DOORS): the runner walks to the door, it swings open,
// the runner steps into the dark (the tower dims, the door rattles), then either another door of the floor bangs open
// and the runner tumbles out (a dead end: the door tried is boarded up as the runner pops out), or the floor gives way
// under the door and the runner drops to the floor below (the camera following), landing with a squash; onto the
// ground, a hop of joy and stars. Separate towers: the big tower is the mover's, and each tally carries a little map
// of its player's tower (their floor, their marks: on show, as every move is); shared: one tower, both runners.
import { DOORS, doorX, doorsDeadMs, doorsDownMs, doorsIn, doorsMoves, doorsTried } from './rules.js';
import { N, mv } from '../../ui/app.js';
import { fxAt } from '../../ui/fx.js';
import { arcTally, lateAt, pips } from '../../ui/progress.js';
import { runColours } from '../../ui/runner.js';
import { stage } from '../../ui/stage.js';
import { pipRows, thumbArt, tokSvg } from '../../ui/thumbs.js';

export const ownLine = true;
export const hold = f => (f.kind === 'again' ? 0 : null);         // a way down with Go again on: the next pick at once
// The drawing's figures: floors in view, the camera's easing a frame, the colours (wood, a dead end's boards, the way
// down's green, the walls by floor).
export const DOORSV = { vis: 2.35, ease: 0.14, wood: '#b9773e', woodD: '#8a5326', board: '#c9c2b3', walls: ['#f3dfc1', '#e9d6f0', '#d8e8f3', '#f6e3b4', '#dcefd8', '#f4d4cc'], ground: '#cfe7b8' };
let src = null, cam = null;
// A little map of a tower (a tally's, the miniature's): a row a floor, a block a door coloured by its mark, the
// runners as dots, the ground under it.
function mapSvg(mini, p, cls, all) {
  const tr = mini.sep ? mini.tried[p] : mini.tried, F = mini.f, who = all ? ['X', 'O'] : [p], RH = 3, R0 = 2.2, G = R0 + F * RH;
  let out = `<path class="ddmr" d="M-.2 ${R0}L5 .2L10.2 ${R0}Z"/><rect class="ddmf" x="0" y="${R0}" width="10" height="${F * RH + 1.6}"/>`;
  for (let r = 0; r < F; r++) {
    const k = mini.d[r], w = 9 / k;
    for (let i = 0; i < k; i++) out += `<rect class="ddmd s${tr[r][i] || 0}" x="${(0.5 + i * w + w * 0.14).toFixed(2)}" y="${(R0 + r * RH + 0.5).toFixed(2)}" width="${(w * 0.72).toFixed(2)}" height="2.3" rx=".35"/>`;
  }
  out += `<rect class="ddmg" x="0" y="${G}" width="10" height="1.6"/>`;
  who.forEach((q, n) => { const fl = Math.min(F, mini.at[q]), y = fl >= F ? G + 0.4 : R0 + fl * RH + 1.9, x = 0.5 + 9 * mini.pos[q] / 100 + (all && mini.at.X === mini.at.O && Math.abs(mini.pos.X - mini.pos.O) < 20 ? (n ? 0.9 : -0.9) : 0); out += tokSvg(q, x.toFixed(2), y.toFixed(2), 1.2); });
  return `<svg class="ddmap${cls ? ' ' + cls : ''}" viewBox="-0.6 -0.2 11.2 ${(G + 2).toFixed(1)}" aria-hidden="true">${out}</svg>`;
}
const WORD = ['Dead end!', 'Down a floor!', 'Ground floor!'];
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const s = a && a.dd ? a.dd : null, o = { view, locked, turn };
  const who = s ? a.by : (view || d) && mini.last ? mini.last.by : turn;                        // whose tower is the big one (separate)
  const tal = p => arcTally(p, o, mini.sep ? mapSvg(mini, p, 'sm') : pips(p, Math.min(mini.at[p], mini.f), mini.f, !!(s && s.down && a.by === p), doorsDownMs()));
  const k = s ? (s.down ? (s.r + 1 >= mini.f ? 2 : 1) : 0) : -1;
  const say = s ? [WORD[k], k ? 'ok' : 'no', s.down ? doorsIn() + DOORS.dark + DOORS.drop : doorsIn() + DOORS.dark + DOORS.out] : null;
  const line = say ? `<p ${lateAt('ddline ' + say[1], say[2])} role="status">${say[0]}</p>` : '<p class="ddline"></p>';
  const btns = s || view || locked || mini.at[turn] >= mini.f || (mini.sep && who !== turn) ? '' : doorsMoves(mini, turn).map(i => `<button class="ddgo ${turn}" data-act="move" ${mv(i)} data-r="${mini.at[turn]}" data-i="${i}" aria-label="Door ${i + 1}"></button>`).join('');
  const key = `${mini.f}:${mini.d.join('')}:${mini.sep ? who : 'one'}`;
  if (!cam || cam.key !== key) cam = { key, y: null };
  src = { mini, a: s ? a : null, who };
  go();
  return `<div class="g-dd pc-${who}${mini.sep ? ' sep' : ''}"><div class="ctals two">${tal('X')}${tal('O')}</div><div class="ddbox"><div class="ddsq"><canvas class="ddcv" aria-label="The tower"></canvas>${btns}</div></div>${line}</div>`;
}
export function heldSub(mini, turn, f, a) { return f ? '' : `<b class="${turn}">${N(turn)}</b> picks again`; }

// ---- the drawing ----
const ease = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const clamp01 = x => Math.max(0, Math.min(1, x));
// Where the mover is at moment t of their move (floors, from the top: y in floors to their feet; x in hundredths), how
// big, how seen, and what the doors are doing.
export function doorsPose(s, t, F) {
  const T = DOORS, tin = doorsIn(), tD = tin + T.dark, xi = s.ix, xo = s.ox;
  const P = { x: s.from, y: s.r + 1, sc: 1, al: 1, sq: 0, bob: 0, open: 0, openOut: 0, dim: 0, shake: 0, hole: 0, mark: false, jump: 0 };
  if (t < T.walk) { const u = t / T.walk; P.x = s.from + (xi - s.from) * ease(u); P.bob = Math.abs(Math.sin(u * Math.PI * 3)); return P; }
  P.x = xi;
  if (t < tin) { const u = (t - T.walk) / T.open; P.open = ease(Math.min(1, u * 1.6)); P.sc = 1 - 0.3 * clamp01(u * 1.4 - 0.4); P.al = 1 - clamp01(u * 1.6 - 0.6); return P; }
  if (t < tD) { const u = (t - tin) / T.dark; P.al = 0; P.open = 1 - ease(clamp01(u * 2.5)); P.dim = Math.sin(Math.PI * u); P.shake = Math.sin(u * 40) * clamp01(u * 3 - 0.8) * (1 - u); return P; }
  P.mark = true;
  if (!s.down) {
    P.x = xo; const u = (t - tD) / T.out, v = (t - tD - T.out) / T.pop;
    if (t < tD + T.out) { P.openOut = ease(u); P.al = 0; return P; }
    P.openOut = 1 - ease(clamp01(v * 1.4)); P.al = 1;
    const vv = clamp01(v); P.y = s.r + 1 - 0.28 * Math.sin(Math.PI * vv); P.sc = 0.7 + 0.3 * ease(vv * 1.4) + 0.12 * Math.sin(Math.PI * clamp01(vv * 1.6)); P.sq = vv > 0.8 ? Math.sin((vv - 0.8) / 0.2 * Math.PI) : 0; P.spin = (1 - ease(vv)) * Math.PI * 2;
    return P;
  }
  const u = (t - tD) / T.drop, v = (t - tD - T.drop) / T.land;
  P.hole = 1;
  if (t < tD + T.drop) { const uu = clamp01(u); P.y = s.r + 1 + uu * uu; P.al = uu < 0.12 ? uu / 0.12 : 1; P.sc = 0.85 + 0.15 * uu; return P; }
  P.y = s.r + 2; P.hole = 1 - clamp01(v); P.sq = v < 1 ? Math.sin(clamp01(v) * Math.PI) : 0;
  if (s.r + 1 >= F) { const w = (t - tD - T.drop - T.land) / DOORS.win; if (w > 0) P.jump = w < 1 ? Math.abs(Math.sin(w * Math.PI * 2)) : 0; }
  return P;
}
function door(c, P, x, y, w, h, st, open, lw) {               // a door whose foot is at (x, y), its middle x; st 0 untried, 1 a dead end, 2 the way down
  const l = x - w / 2, top = y - h;
  c.fillStyle = P.ink; c.beginPath(); c.roundRect(l - lw * 1.2, top - lw * 1.2, w + lw * 2.4, h + lw * 1.2, [w * 0.18, w * 0.18, 0, 0]); c.fill();   // the frame
  c.fillStyle = '#1b1426'; c.beginPath(); c.roundRect(l, top, w, h, [w * 0.14, w * 0.14, 0, 0]); c.fill();                                       // the dark behind it
  const op = st === 2 ? Math.max(open, 0.62) : open;
  if (st === 2) {                                                // the way down: a green arrow in the dark
    c.strokeStyle = P.green; c.lineWidth = Math.max(2.5, w * 0.13); c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
    c.moveTo(x + w * 0.12, top + h * 0.25); c.lineTo(x + w * 0.12, top + h * 0.72); c.moveTo(x - w * 0.06, top + h * 0.56); c.lineTo(x + w * 0.12, top + h * 0.74); c.lineTo(x + w * 0.3, top + h * 0.56); c.stroke();
  }
  const pw = w * (1 - 0.82 * op);                                // the panel, swung about its hinge on the left
  if (pw > 0.5) {
    c.fillStyle = st === 1 ? DOORSV.board : DOORSV.wood; c.strokeStyle = P.ink; c.lineWidth = lw;
    c.beginPath(); c.roundRect(l, top, pw, h, [w * 0.14, op > 0.1 ? 2 : w * 0.14, 0, 0]); c.fill(); c.stroke();
    if (op < 0.5 && st !== 1) {                                  // its panels and knob
      c.strokeStyle = DOORSV.woodD; c.lineWidth = Math.max(1.2, lw * 0.6);
      c.strokeRect(l + pw * 0.18, top + h * 0.12, pw * 0.64, h * 0.3); c.strokeRect(l + pw * 0.18, top + h * 0.52, pw * 0.64, h * 0.34);
      c.fillStyle = '#ffd23f'; c.strokeStyle = P.ink; c.lineWidth = Math.max(1, lw * 0.5); c.beginPath(); c.arc(l + pw * 0.82, top + h * 0.5, Math.max(2, w * 0.07), 0, 7); c.fill(); c.stroke();
    }
    if (st === 1) {                                              // boarded up: two planks across and a red cross
      c.fillStyle = '#a98c6a'; c.strokeStyle = P.ink; c.lineWidth = Math.max(1, lw * 0.6);
      for (const yy of [0.28, 0.66]) { c.save(); c.translate(x, top + h * yy); c.rotate(yy < 0.5 ? -0.16 : 0.14); c.beginPath(); c.rect(-w * 0.62, -h * 0.06, w * 1.24, h * 0.12); c.fill(); c.stroke(); c.restore(); }
      c.strokeStyle = P.X; c.lineWidth = Math.max(3, w * 0.12); c.lineCap = 'round'; c.beginPath();
      c.moveTo(x - w * 0.26, top + h * 0.34); c.lineTo(x + w * 0.26, top + h * 0.7); c.moveTo(x + w * 0.26, top + h * 0.34); c.lineTo(x - w * 0.26, top + h * 0.7); c.stroke();
    }
  }
}
function runner(c, P, p, x, y, r, o) {                            // a runner whose feet are at (x, y): a disc with the drawn mark, on little feet
  c.save(); c.globalAlpha = o.al == null ? 1 : o.al; c.translate(x, y);
  const sc = o.sc == null ? 1 : o.sc, sq = o.sq || 0; c.scale(sc * (1 + 0.22 * sq), sc * (1 - 0.22 * sq));
  c.fillStyle = P.ink; for (const fx of [-0.42, 0.42]) { c.beginPath(); c.ellipse(fx * r, -r * 0.12, r * 0.3, r * 0.17, 0, 0, 7); c.fill(); }
  c.translate(0, -r * 1.12); if (o.spin) c.rotate(o.spin);
  c.fillStyle = p === 'O' ? P.O : P.X; c.strokeStyle = P.ink; c.lineWidth = Math.max(2, r * 0.16); c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill(); c.stroke();
  c.strokeStyle = p === 'O' ? P.ink : '#fff'; c.lineWidth = Math.max(2.4, r * 0.2); c.lineCap = 'round'; c.beginPath();
  if (p === 'X') { c.moveTo(-r * 0.42, -r * 0.42); c.lineTo(r * 0.42, r * 0.42); c.moveTo(r * 0.42, -r * 0.42); c.lineTo(-r * 0.42, r * 0.42); } else c.arc(0, 0, r * 0.42, 0, 7);
  c.stroke(); c.restore();
}
function star(c, P, x, y, r, rot) { c.save(); c.translate(x, y); c.rotate(rot); c.fillStyle = '#ffd23f'; c.strokeStyle = P.ink; c.lineWidth = Math.max(1.5, r * 0.18); c.beginPath(); for (let q = 0; q < 10; q++) { const rr = q % 2 ? r * 0.45 : r, an = q * Math.PI / 5 - Math.PI / 2; c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } c.closePath(); c.fill(); c.stroke(); c.restore(); }
const go = stage('canvas.ddcv', (c, W, H, now) => {
  if (!src) return false;
  const { mini, a, who } = src, P = runColours(), F = mini.f, s0 = a ? a.dd : null;
  const at = s0 ? fxAt('move', a) : null, t = s0 ? (at == null ? Infinity : now - at) : 0;
  const s = s0 ? Object.assign({}, s0, { ix: doorX(mini.d[s0.r], s0.i), ox: s0.down ? 0 : doorX(mini.d[s0.r], s0.out) }) : null;
  const total = s ? (s.down ? doorsDownMs() + (s.r + 1 >= F ? DOORS.win : 0) : doorsDeadMs()) : 0;
  const pose = s ? doorsPose(s, Math.min(t, total), F) : null;
  const tr = doorsTried(mini, who), runners = mini.sep ? [who] : ['X', 'O'];
  const FH = Math.min(H / DOORSV.vis, W * 0.62), pad = Math.max(10, W * 0.05), CW = W - 2 * pad, lw = Math.max(2, FH * 0.025);
  const X = x => pad + CW * x / 100;
  // the camera: on the runner of the move (else the big tower's), its feet a little under the middle, eased
  const foc = pose ? pose.y : Math.min(F, mini.at[who]) + 1;
  const want = Math.max(-0.45 * FH, Math.min((F + 1) * FH - H, foc * FH - H * 0.62));
  if (cam.y == null || !Number.isFinite(cam.y)) cam.y = want;
  cam.y += (want - cam.y) * DOORSV.ease; const moving = Math.abs(want - cam.y) > 0.3;
  const Y = y => y * FH - cam.y;
  c.clearRect(0, 0, W, H);
  c.fillStyle = '#9fd3f0'; c.fillRect(0, 0, W, H);                // the sky round the tower
  // the roof
  c.fillStyle = '#c0533a'; c.strokeStyle = P.ink; c.lineWidth = lw * 1.4; c.beginPath(); c.moveTo(pad * 0.2, Y(0)); c.lineTo(W / 2, Y(0) - FH * 0.42); c.lineTo(W - pad * 0.2, Y(0)); c.closePath(); c.fill(); c.stroke();
  const dh = FH * 0.6;
  for (let r = 0; r <= F; r++) {
    const top = Y(r), bot = Y(r + 1); if (bot < -2 || top > H + 2) continue;
    c.fillStyle = r === F ? DOORSV.ground : DOORSV.walls[r % DOORSV.walls.length]; c.fillRect(pad * 0.5, top, W - pad, FH);
    c.strokeStyle = 'rgba(80,50,30,.12)'; c.lineWidth = 1;     // faint courses of brick
    for (let yy = top + FH * 0.2; yy < bot - 2; yy += FH * 0.2) { c.beginPath(); c.moveTo(pad * 0.5, yy); c.lineTo(W - pad * 0.5, yy); c.stroke(); }
    if (r === F) {                                               // the ground floor: the way out in daylight, a flag beside it
      const ex = W / 2, ew = Math.min(CW * 0.32, FH * 0.5);
      c.fillStyle = '#fff6c9'; c.strokeStyle = P.ink; c.lineWidth = lw; c.beginPath(); c.roundRect(ex - ew / 2, bot - dh, ew, dh, [ew * 0.5, ew * 0.5, 0, 0]); c.fill(); c.stroke();
      c.fillStyle = '#7cc46a'; c.fillRect(ex - ew / 2 + lw / 2, bot - dh * 0.22, ew - lw, dh * 0.22 - lw / 2);
      const fx = ex + ew * 0.08, fy = bot - dh - lw * 0.5; c.strokeStyle = P.ink; c.lineWidth = lw; c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx, fy - dh * 0.5); c.stroke();
      const fl = dh * 0.3, wv = pose && pose.jump ? Math.sin(now / 80) * 0.15 : 0;
      c.save(); c.translate(fx, fy - dh * 0.5); c.rotate(wv); for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? '#fff' : P.ink; c.fillRect(i * fl / 3, j * fl * 0.32, fl / 3, fl * 0.32); } c.strokeRect(0, 0, fl, fl * 0.64); c.restore();
    } else {
      // the floor's plaque: how many floors above the ground
      const pl = Math.max(14, FH * 0.17); c.fillStyle = '#fff'; c.strokeStyle = P.ink; c.lineWidth = Math.max(1.5, lw * 0.7); c.beginPath(); c.roundRect(pad * 0.5 + 4, top + 4, pl * 1.2, pl, 4); c.fill(); c.stroke();
      c.fillStyle = P.ink; c.font = `400 ${Math.round(pl * 0.8)}px 'Luckiest Guy', 'Arial Black', sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(F - r), pad * 0.5 + 4 + pl * 0.6, top + 4 + pl * 0.55);
      const k = mini.d[r], dw = Math.min(CW / k * 0.66, dh * 0.62);
      for (let i = 0; i < k; i++) {
        let st = tr[r][i], op = 0, x = X(doorX(k, i));
        if (s && s.r === r && i === s.i) { if (!pose.mark) st = 0; op = pose.open; x += pose.shake * dw * 0.06; }
        if (s && s.r === r && !s.down && i === s.out) op = pose.openOut;
        door(c, P, x, bot - lw, dw, dh, st, op, lw);
      }
    }
    // the slab under the floor (a hole under the way down while the runner drops through)
    c.fillStyle = '#7a5a3c'; c.strokeStyle = P.ink; c.lineWidth = lw;
    c.fillRect(pad * 0.5, bot - lw, W - pad, Math.max(4, FH * 0.07)); c.strokeRect(pad * 0.5, bot - lw, W - pad, Math.max(4, FH * 0.07));
    if (s && s.down && s.r === r && pose.hole > 0) { const hw = Math.min(CW / mini.d[r] * 0.66, dh * 0.62) * 0.9 * pose.hole; c.fillStyle = '#1b1426'; c.beginPath(); c.ellipse(X(s.ix), bot - lw + FH * 0.035, hw / 2, FH * 0.05, 0, 0, 7); c.fill(); }
  }
  if (Y(F + 1) < H) { c.fillStyle = '#8bbf6a'; c.fillRect(0, Y(F + 1) + Math.max(4, FH * 0.07), W, H); }   // the ground outside, under the tower
  // the tower's sides
  c.strokeStyle = P.ink; c.lineWidth = lw * 1.4; c.beginPath(); c.moveTo(pad * 0.5, Y(0)); c.lineTo(pad * 0.5, Y(F + 1)); c.moveTo(W - pad * 0.5, Y(0)); c.lineTo(W - pad * 0.5, Y(F + 1)); c.stroke();
  // the dark: the tower dims while the runner is inside
  if (pose && pose.dim > 0) { c.fillStyle = `rgba(20,12,30,${(0.32 * pose.dim).toFixed(3)})`; c.fillRect(0, 0, W, H); }
  // the runners
  const rr = Math.min(FH * 0.13, CW / 12);
  const same = !mini.sep && mini.at.X === mini.at.O && Math.abs(mini.pos.X - mini.pos.O) < 14;
  for (const p of runners) {
    if (s && a.by === p) {
      const yy = Y(pose.y) - lw - pose.bob * rr * 0.25 - pose.jump * FH * 0.22;
      runner(c, P, p, X(pose.x), yy, rr, pose);
      if (pose.mark && !s.down && t < doorsDeadMs() + 200) { const v = clamp01((t - doorsIn() - DOORS.dark - DOORS.out) / DOORS.pop); if (v > 0 && v < 1) for (let q = 0; q < 5; q++) { const an = q * 1.26 + 0.3, d = rr * (1.4 + 1.6 * v); star(c, P, X(pose.x) + Math.cos(an) * d, Y(pose.y) - rr - Math.sin(an) * d * 0.7, rr * 0.5 * (1 - 0.6 * v), v * 3); } }
      if (pose.jump > 0) for (let q = 0; q < 4; q++) star(c, P, X(pose.x) + Math.cos(now / 300 + q * 1.57) * rr * 2.4, yy - rr * 1.2 + Math.sin(now / 300 + q * 1.57) * rr * 1.2, rr * 0.36, now / 200);
    } else {
      const fl = Math.min(F, mini.at[p]), off = same ? (p === 'X' ? -rr * 1.1 : rr * 1.1) : 0;
      runner(c, P, p, X(mini.pos[p]) + off, Y(fl + 1) - lw, rr, {});
    }
  }
  // where the door buttons sit: placed on the page where the camera has their doors this frame
  const box = c.canvas.parentElement;
  if (box) for (const b of box.querySelectorAll('.ddgo')) {
    const r = +b.dataset.r, k = mini.d[r], dw = Math.min(CW / k * 0.66, dh * 0.62);
    b.style.left = `${(X(doorX(k, +b.dataset.i)) - dw / 2 - lw).toFixed(1)}px`; b.style.top = `${(Y(r + 1) - lw - dh - lw).toFixed(1)}px`;
    b.style.width = `${(dw + 2 * lw).toFixed(1)}px`; b.style.height = `${(dh + lw).toFixed(1)}px`; b.style.visibility = 'visible';
  }
  return moving || (!!s && t < total + 120);
});
// The miniature: the tower (a map each, side by side, when each has their own) beside each player's floors gone down.
export function miniature(mini, final) {
  const art = mini.sep ? `<span class="tdd2">${mapSvg(mini, 'X', 'X')}${mapSvg(mini, 'O', 'O')}</span>` : `<span class="tdd1">${mapSvg(mini, 'X', '', true)}</span>`;
  return thumbArt(art, pipRows({ X: Math.min(mini.f, mini.at.X), O: Math.min(mini.f, mini.at.O) }, mini.f), 'tddw', `Door Drop: X ${mini.at.X} and O ${mini.at.O} of ${mini.f} floors down`);
}
export function moveText(f, who) { const s = f.dd; return !s ? `${who} tried a door` : s.down ? `${who} found the way down` : `${who} hit a dead end`; }
// The footsteps to the door, its creak, a rumble in the dark; then a dead end: the other door banging open and the
// runner popping out with a bonk; or the way down: a falling whistle and the landing's thump; the ground: a fanfare.
export function sounds(f, add, won, mini, last) {
  const s = f.dd; if (!s) return;
  for (let k = 0; k < 3; k++) add('ddStep', Math.round(k * DOORS.walk / 3), 0.92 + (k % 2) * 0.14);
  add('ddCreak', DOORS.walk); add('ddDark', doorsIn());
  const tD = doorsIn() + DOORS.dark;
  if (!s.down) { add('ddCreak', tD, 1.25); add('ddBonk', tD + DOORS.out); return; }
  add('ddFall', tD); add('ddLand', tD + DOORS.drop);
  if (won) { add('ding', tD + DOORS.drop + DOORS.land); add('sparkle', tD + DOORS.drop + DOORS.land + 160); }
}
export const wonAt = (f, total) => (f.dd && f.dd.down ? doorsIn() + DOORS.dark + DOORS.drop + DOORS.land : total - 600);
