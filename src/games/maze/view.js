// Maze Runner: the screen, the miniature, the move's words and sounds.
// The maze is a canvas the size of its box: fog over every cell no runner has passed, a paper floor and inked walls
// where one has, the flag in its corner (on show from the start: the runners know where they are heading), the door
// in the opposite corner, the runners as discs in their colours. Over it, an arrow button on each cell the mover's
// runner can dash towards (placed by the frame loop, where the camera has them). A dash plays cell by cell
// (MAZE.step each), the fog lifting as the runner passes; a dead end bumps it (a burst), the flag waves.
// The camera (MAZEV): a maze whose cells would come out under MAZEV.min px in its box is not shrunk: the box shows a
// window of it at that size, following the runner (eased, a touch wider while it dashes), never past the maze's edge,
// with a pointer at the box's edge towards the flag while the flag is out of sight. A maze that fits is shown whole.
// Separate mazes: the big one is the mover's, and each tally carries a little map of its player's maze as far as they
// have seen it; shared: one maze, both runners; one runner: one maze, the runner drawn in the colour of whoever moves it.
import { DIRS, MAZE, mazeGeo, mazeSeen, mazeStep, mazeWays } from './rules.js';
import { N, mv } from '../../ui/app.js';
import { fxAt } from '../../ui/fx.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { runColours } from '../../ui/runner.js';
import { stage } from '../../ui/stage.js';
import { tok } from '../../ui/tok.js';

export const ownLine = true;
export const hold = f => (f.kind === 'again' ? 0 : null);         // a dash to a fork: the next pick at once
export const MAZEV = { min: 34, dash: 0.88, ease: 0.16 };         // the smallest cell shown (CSS px); the camera's zoom while dashing; its easing a frame
let src = null, cam = null;
const xy = (w, c) => [c % w, Math.floor(c / w)];
// The camera for a box W by H: the cell size and the maze's offset, the runner (fx, fy, in cells) as near the middle
// as the maze's edges allow. Pure: the tests hold it.
export function mazeCam(g, W, H, fx, fy, z = 1) {
  const fit = Math.min(W / g.w, H / g.h);
  if (fit >= MAZEV.min) return { u: fit, ox: (W - g.w * fit) / 2, oy: (H - g.h * fit) / 2, fit: true };
  const u = Math.max(fit, MAZEV.min * z), axis = (box, cells, f) => (cells * u <= box ? (box - cells * u) / 2 : Math.min(0, Math.max(box - cells * u, box / 2 - (f + 0.5) * u)));
  return { u, ox: axis(W, g.w, fx), oy: axis(H, g.h, fy), fit: false };
}
// A little map of a maze as far as it has been seen (a tally's, the miniature's): seen cells light, the flag, the runners.
function mapSvg(mini, who, cls) {
  const g = mazeGeo(mini), seen = mazeSeen(mini, who[0]);
  let out = `<rect class="mzmf" width="${g.w}" height="${g.h}" rx=".35"/>`;
  seen.forEach((v, c) => { if (v >= 0) { const [x, y] = xy(g.w, c); out += `<rect class="mzms" x="${x + 0.06}" y="${y + 0.06}" width=".88" height=".88" rx=".14"/>`; } });
  const [fx, fy] = xy(g.w, g.flag); out += `<rect class="mzmg" x="${fx + 0.14}" y="${fy + 0.14}" width=".72" height=".72" rx=".12"/>`;
  who.forEach((p, k) => { const [x, y] = xy(g.w, mini.at[p]); out += `<circle class="mzmt ${mini.one ? 'one' : p}" cx="${x + 0.5 + (who.length > 1 ? (k ? 0.17 : -0.17) : 0)}" cy="${y + 0.5}" r=".34"/>`; });
  return `<svg class="mzmap${cls ? ' ' + cls : ''}" viewBox="-0.1 -0.1 ${g.w + 0.2} ${g.h + 0.2}" aria-hidden="true">${out}</svg>`;
}
const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V6M6 11l6-6 6 6" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const WORDS = { n: 'up', e: 'right', s: 'down', w: 'left' };
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const G = mazeGeo(mini), s = a && a.mz ? a.mz : null, o = { view, locked, turn };
  const who = s ? a.by : (view || d) && mini.last ? mini.last.by : turn;                        // whose maze is the big one (separate), and who moves the runner
  const tal = p => arcTally(p, o, mini.sep ? mapSvg(mini, [p], 'sm') : tok(p));
  const end = s ? s.path.length * MAZE.step : 0;
  const say = s ? (s.end === 'dead' ? ['Dead end!', 'no'] : s.end === 'flag' ? ['The flag!', 'ok'] : null) : d && mini.last && mini.last.end === 'dead' ? ['Dead end!', 'no'] : null;
  const line = say ? `<p ${s ? lateAt('mzline ' + say[1], end) : `class="mzline ${say[1]}"`} role="status">${say[0]}</p>` : '<p class="mzline"></p>';
  // the arrows (never while a dash plays: they are placed where the runner stands once it has)
  const btns = s || view || locked || (mini.sep && who !== turn) ? '' : mazeWays(mini, turn).map(dir => { const [bx, by] = xy(G.w, mazeStep(G.w, mini.at[turn], dir)); return `<button class="mzgo ${dir} ${turn}" data-act="move" ${mv(dir)} data-cx="${bx}" data-cy="${by}" aria-label="Dash ${WORDS[dir]}">${ARROW}</button>`; }).join('');
  const key = `${state0(mini)}:${mini.sep ? who : 'one'}`;
  if (!cam || cam.key !== key) cam = { key, fx: null, fy: null, z: 1 };
  src = { mini, a: s ? a : null, who };
  go();
  return `<div class="g-mz pc-${who}${mini.sep ? ' sep' : ''}${mini.one ? ' one' : ''}"><div class="ctals">${tal('X')}${tal('O')}</div><div class="mzbox"><div class="mzsq"><canvas class="mzcv" aria-label="The maze"></canvas>${btns}</div></div>${line}</div>`;
}
const state0 = mini => `${mini.w}x${mini.h || mini.w}:${mini.start}:${mini.flag}`;
export function heldSub(mini, turn, f, a) { return f ? '' : `<b class="${turn}">${N(turn)}</b> runs on`; }

// ---- the drawing ----
const go = stage('canvas.mzcv', (c, W, H, now) => {
  if (!src) return false;
  const { mini, a, who } = src, G = mazeGeo(mini), w = G.w, P = runColours();
  const seen = mazeSeen(mini, who), s = a ? a.mz : null, at = s ? fxAt('move', a) : null, t = s ? (at == null ? Infinity : now - at) : 0;
  const k = s ? Math.max(0, Math.min(s.path.length, t / MAZE.step)) : 0, hid = new Set(s ? s.fresh.filter(cc => s.path.indexOf(cc) + 1 > k + 0.4) : []);
  const known = cc => seen[cc] >= 0 && !hid.has(cc);
  // where each runner is drawn this frame (the one dashing along its path)
  const runners = mini.sep || mini.one ? [mini.one ? (s ? a.by : who) : who] : ['X', 'O'];
  const pos = {}, dashing = !!s && k < s.path.length;
  for (const p of runners) {
    let [x, y] = xy(w, mini.at[p]);
    if (s && (a.by === p || mini.one)) { const pts = [s.from].concat(s.path), i = Math.min(pts.length - 2, Math.floor(k)), fr = Math.min(1, k - i), [x0, y0] = xy(w, pts[i]), [x1, y1] = xy(w, pts[i + 1]); x = x0 + (x1 - x0) * fr; y = y0 + (y1 - y0) * fr; }
    pos[p] = [x, y];
  }
  // the camera: on the runner that moves (the dasher, else the mover's), eased; a touch wider while dashing
  const focus = pos[s ? (mini.one ? runners[0] : a.by) : mini.one ? runners[0] : who] || pos[runners[0]];
  if (!Number.isFinite(cam.fx) || !Number.isFinite(cam.fy)) { cam.fx = focus[0]; cam.fy = focus[1]; }
  const e = MAZEV.ease; cam.fx += (focus[0] - cam.fx) * e; cam.fy += (focus[1] - cam.fy) * e; cam.z += ((dashing ? MAZEV.dash : 1) - cam.z) * e;
  const V = mazeCam(G, W, H, cam.fx, cam.fy, cam.z);
  const u = V.u, ox = V.ox, oy = V.oy, X = x => ox + x * u, Y = y => oy + y * u;
  const moving = !V.fit && (Math.abs(focus[0] - cam.fx) + Math.abs(focus[1] - cam.fy) > 0.01 || Math.abs((dashing ? MAZEV.dash : 1) - cam.z) > 0.004);
  c.clearRect(0, 0, W, H);
  c.fillStyle = '#3b3550'; c.fillRect(0, 0, W, H);
  c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = Math.max(1, u * 0.05);
  const step = u * 0.34, sh = ((ox + oy) % step + step) % step;
  for (let q = -H - step + sh; q < W; q += step) { c.beginPath(); c.moveTo(q, 0); c.lineTo(q + H, H); c.stroke(); }
  const vis = (x, y) => X(x + 1) >= 0 && X(x) <= W && Y(y + 1) >= 0 && Y(y) <= H;
  for (let cc = 0; cc < G.n; cc++) if (known(cc)) { const [x, y] = xy(w, cc); if (vis(x, y)) { c.fillStyle = P.paper; c.fillRect(X(x) - 0.5, Y(y) - 0.5, u + 1, u + 1); } }
  // the flag (always on show) and the door
  const [fx, fy] = xy(w, G.flag), [sx, sy] = xy(w, G.start), wave = s && s.end === 'flag' && k >= s.path.length ? Math.sin((t - s.path.length * MAZE.step) / 70) * 0.12 : 0;
  if (!known(G.flag)) { c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(X(fx), Y(fy), u, u); }
  c.save(); c.translate(X(fx + 0.36), Y(fy + 0.84)); c.strokeStyle = P.ink; c.lineWidth = u * 0.07; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -u * 0.66); c.stroke();
  c.rotate(wave); for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? '#fff' : P.ink; c.fillRect(i * u * 0.14 + u * 0.03, -u * 0.66 + j * u * 0.15, u * 0.14, u * 0.15); }
  c.strokeRect(u * 0.03, -u * 0.66, u * 0.42, u * 0.3); c.restore();
  c.fillStyle = '#8d6e63'; c.strokeStyle = P.ink; c.lineWidth = u * 0.05; c.beginPath(); c.roundRect(X(sx + 0.3), Y(sy + 0.62), u * 0.4, u * 0.38, [u * 0.2, u * 0.2, 0, 0]); c.fill(); c.stroke();
  // the walls of every cell seen: its closed sides
  c.strokeStyle = P.ink; c.lineWidth = Math.max(3, u * 0.11); c.lineCap = 'round';
  c.beginPath();
  for (let cc = 0; cc < G.n; cc++) if (known(cc)) {
    const [x, y] = xy(w, cc), m = seen[cc]; if (!vis(x, y)) continue;
    if (!(m & 1)) { c.moveTo(X(x), Y(y)); c.lineTo(X(x + 1), Y(y)); }
    if (!(m & 2)) { c.moveTo(X(x + 1), Y(y)); c.lineTo(X(x + 1), Y(y + 1)); }
    if (!(m & 4)) { c.moveTo(X(x), Y(y + 1)); c.lineTo(X(x + 1), Y(y + 1)); }
    if (!(m & 8)) { c.moveTo(X(x), Y(y)); c.lineTo(X(x), Y(y + 1)); }
  }
  c.stroke();
  // the runners
  for (const p of runners) {
    const [x, y] = pos[p]; let bump = 0;
    if (s && (a.by === p || mini.one) && s.end === 'dead' && k >= s.path.length) bump = Math.max(0, 1 - (t - s.path.length * MAZE.step) / MAZE.bonk);
    const off = !mini.sep && !mini.one && mini.at.X === mini.at.O && !(s && a.by === p) ? (p === 'X' ? -0.16 : 0.16) : 0, cx = X(x + 0.5 + off) + (bump ? Math.sin(bump * 18) * u * 0.06 : 0), cy = Y(y + 0.5), r = u * 0.3;
    if (bump > 0) { c.save(); c.translate(cx, cy); c.fillStyle = '#ffd23f'; c.strokeStyle = P.ink; c.lineWidth = u * 0.03; c.beginPath(); for (let q = 0; q < 16; q++) { const rr = (q % 2 ? 0.34 : 0.56) * u * (1.2 - bump * 0.3), an = q * Math.PI / 8; c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } c.closePath(); c.fill(); c.stroke(); c.restore(); }
    c.fillStyle = p === 'O' ? P.O : P.X; c.strokeStyle = P.ink; c.lineWidth = u * 0.06; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill(); c.stroke();
    c.strokeStyle = p === 'O' ? P.ink : '#fff'; c.lineWidth = u * 0.08; c.beginPath();
    if (p === 'X') { c.moveTo(cx - r * 0.42, cy - r * 0.42); c.lineTo(cx + r * 0.42, cy + r * 0.42); c.moveTo(cx + r * 0.42, cy - r * 0.42); c.lineTo(cx - r * 0.42, cy + r * 0.42); } else c.arc(cx, cy, r * 0.42, 0, 7);
    c.stroke();
  }
  // the flag out of sight (the camera's window): a pointer at the box's edge towards it
  if (X(fx + 1) < 0 || X(fx) > W || Y(fy + 1) < 0 || Y(fy) > H) {
    const tx = X(fx + 0.5) - W / 2, ty = Y(fy + 0.5) - H / 2, m = 20, sc = Math.min((W / 2 - m) / Math.max(1e-6, Math.abs(tx)), (H / 2 - m) / Math.max(1e-6, Math.abs(ty))), px = W / 2 + tx * sc, py = H / 2 + ty * sc, an = Math.atan2(ty, tx);
    c.save(); c.translate(px, py); c.fillStyle = '#ffd23f'; c.strokeStyle = P.ink; c.lineWidth = 2.5;
    c.save(); c.rotate(an); c.beginPath(); c.moveTo(20, 0); c.lineTo(8, -8); c.lineTo(8, 8); c.closePath(); c.fill(); c.stroke(); c.restore();
    c.beginPath(); c.arc(0, 0, 13, 0, 7); c.fill(); c.stroke();
    c.lineWidth = 1.8; c.beginPath(); c.moveTo(-4, 7); c.lineTo(-4, -7); c.stroke();
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? '#fff' : P.ink; c.fillRect(-4 + i * 3, -7 + j * 3, 3, 3); }
    c.restore();
  }
  // where the arrows sit: placed on the page where the camera has them this frame
  const box = c.canvas.parentElement;
  if (box) {
    for (const b of box.querySelectorAll('.mzgo')) { b.style.left = `${(X(+b.dataset.cx + 0.5)).toFixed(1)}px`; b.style.top = `${(Y(+b.dataset.cy + 0.5)).toFixed(1)}px`; b.style.width = `${u.toFixed(1)}px`; b.style.visibility = 'visible'; }
  }
  return moving || (!!s && t < s.path.length * MAZE.step + Math.max(MAZE.bonk, MAZE.flag) + 100);
});
// The miniature: the maze as far as it has been seen, the flag and the runners (a map each, side by side under its
// player's mark, when each has their own).
export function miniature(mini, final) {
  const lab = `Maze Runner: ${mini.sep ? 'a maze each' : mini.one ? 'one maze, one runner' : 'one maze'}`;
  if (!mini.sep) return `<div class="tmz one" aria-label="${lab}">${mapSvg(mini, mini.one ? ['X'] : ['X', 'O'])}</div>`;
  return `<div class="tmz" aria-label="${lab}">${['X', 'O'].map(p => `<div class="tmzc"><b class="${p}">${p}</b>${mapSvg(mini, [p])}</div>`).join('')}</div>`;
}
export function moveText(f, who) { const s = f.mz; return !s ? `${who} ran` : s.end === 'dead' ? `${who} ran into a dead end` : s.end === 'flag' ? `${who} reached the flag` : `${who} ran to a fork`; }
// A patter of steps as the runner dashes (a tick a cell), then where it ends: a bump at a dead end, a chime at the flag,
// a soft pop at a fork.
export function sounds(f, add, won, mini, last) {
  const s = f.mz; if (!s) return;
  for (let k = 0; k < Math.min(12, s.path.length); k++) add('mzStep', Math.round(k * MAZE.step), 0.9 + (k % 2) * 0.12);
  const end = s.path.length * MAZE.step;
  if (s.end === 'dead') add('mzBonk', end); else if (s.end === 'flag') { add('ding', end); add('sparkle', end + 140); } else add('pop', end);
}
