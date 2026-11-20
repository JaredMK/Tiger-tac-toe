// Maze Runner: the screen, the miniature, the move's words and sounds.
// The maze is a canvas: fog over every cell no runner has passed, a paper floor and inked walls where one has, the
// flag in its cell at the top (on show from the start: the runners know where they are heading), the door at the
// bottom, the runners as discs in their colours. Over it, an arrow button on each cell the mover's runner can dash
// towards. A dash plays cell by cell (MAZE.step each), the fog lifting as the runner passes; a dead end bumps it
// (a burst), the flag waves. Separate mazes: the big one is the mover's, and each tally carries a little map of its
// player's maze as far as they have seen it; shared: one maze, both runners.
import { DIRS, MAZE, mazeFlag, mazeSeen, mazeStart, mazeStep, mazeWays } from './rules.js';
import { N, mv } from '../../ui/app.js';
import { fxAt } from '../../ui/fx.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { runColours } from '../../ui/runner.js';
import { stage } from '../../ui/stage.js';
import { tok } from '../../ui/tok.js';

export const ownLine = true;
export const hold = f => (f.kind === 'again' ? 0 : null);         // a dash to a fork: the next pick at once
let src = null;
const xy = (w, c) => [c % w, Math.floor(c / w)];
// A little map of a maze as far as it has been seen (a tally's, the miniature's): seen cells light, the flag, the runners.
function mapSvg(mini, who, cls) {
  const w = mini.w, seen = mazeSeen(mini, who[0]), flag = mazeFlag(w);
  let out = `<rect class="mzmf" width="${w}" height="${w}" rx=".35"/>`;
  seen.forEach((v, c) => { if (v >= 0) { const [x, y] = xy(w, c); out += `<rect class="mzms" x="${x + 0.06}" y="${y + 0.06}" width=".88" height=".88" rx=".14"/>`; } });
  const [fx, fy] = xy(w, flag); out += `<rect class="mzmg" x="${fx + 0.14}" y="${fy + 0.14}" width=".72" height=".72" rx=".12"/>`;
  who.forEach((p, k) => { const [x, y] = xy(w, mini.at[p]); out += `<circle class="mzmt ${p}" cx="${x + 0.5 + (who.length > 1 ? (k ? 0.17 : -0.17) : 0)}" cy="${y + 0.5}" r=".34"/>`; });
  return `<svg class="mzmap${cls ? ' ' + cls : ''}" viewBox="-0.1 -0.1 ${w + 0.2} ${w + 0.2}" aria-hidden="true">${out}</svg>`;
}
const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V6M6 11l6-6 6 6" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const WORDS = { n: 'up', e: 'right', s: 'down', w: 'left' };
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const w = mini.w, s = a && a.mz ? a.mz : null, o = { view, locked, turn };
  const who = s ? a.by : (view || d) && mini.last ? mini.last.by : turn;                        // whose maze is the big one (separate)
  const tal = p => arcTally(p, o, mini.sep ? mapSvg(mini, [p], 'sm') : tok(p));
  const end = s ? s.path.length * MAZE.step : 0;
  const say = s ? (s.end === 'dead' ? ['Dead end!', 'no'] : s.end === 'flag' ? ['The flag!', 'ok'] : null) : d && mini.last && mini.last.end === 'dead' ? ['Dead end!', 'no'] : null;
  const line = say ? `<p ${s ? lateAt('mzline ' + say[1], end) : `class="mzline ${say[1]}"`} role="status">${say[0]}</p>` : '<p class="mzline"></p>';
  const [ax, ay] = xy(w, mini.at[turn]);
  const btns = view || locked || (mini.sep && who !== turn) ? '' : mazeWays(mini, turn).map(dir => { const [bx, by] = xy(w, mazeStep(w, mini.at[turn], dir)); return `<button class="mzgo ${dir} ${turn}" data-act="move" ${mv(dir)} style="left:${((bx + 0.5) / w * 100).toFixed(2)}%;top:${((by + 0.5) / w * 100).toFixed(2)}%" aria-label="Dash ${WORDS[dir]}">${ARROW}</button>`; }).join('');
  src = { mini, a: s ? a : null, who, at: [ax, ay] };
  go();
  return `<div class="g-mz pc-${who}${mini.sep ? ' sep' : ''}"><div class="ctals">${tal('X')}${tal('O')}</div><div class="mzbox"><div class="mzsq" style="--w:${w}"><canvas class="mzcv" aria-label="The maze"></canvas>${btns}</div></div>${line}</div>`;
}
export function heldSub(mini, turn, f, a) { return f ? '' : `<b class="${turn}">${N(turn)}</b> runs on`; }

// ---- the drawing ----
const go = stage('canvas.mzcv', (c, W, H, now) => {
  if (!src) return false;
  const { mini, a, who } = src, w = mini.w, P = runColours(), u = W / w, flag = mazeFlag(w), start = mazeStart(w);
  const seen = mazeSeen(mini, who), s = a ? a.mz : null, at = s ? fxAt('move', a) : null, t = s ? (at == null ? Infinity : now - at) : 0;
  const k = s ? Math.min(s.path.length, t / MAZE.step) : 0, hid = new Set(s ? s.fresh.filter(cc => s.path.indexOf(cc) + 1 > k + 0.4) : []);
  const known = cc => seen[cc] >= 0 && !hid.has(cc);
  c.clearRect(0, 0, W, H);
  c.fillStyle = '#3b3550'; c.fillRect(0, 0, W, H);
  c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = Math.max(1, u * 0.05);
  for (let q = -H; q < W; q += u * 0.34) { c.beginPath(); c.moveTo(q, 0); c.lineTo(q + H, H); c.stroke(); }
  for (let cc = 0; cc < w * w; cc++) if (known(cc)) { const [x, y] = xy(w, cc); c.fillStyle = P.paper; c.fillRect(x * u - 0.5, y * u - 0.5, u + 1, u + 1); }
  // the flag (always on show) and the door
  const [fx, fy] = xy(w, flag), [sx, sy] = xy(w, start), wave = s && s.end === 'flag' && k >= s.path.length ? Math.sin((t - s.path.length * MAZE.step) / 70) * 0.12 : 0;
  if (!known(flag)) { c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(fx * u, fy * u, u, u); }
  c.save(); c.translate((fx + 0.36) * u, (fy + 0.84) * u); c.strokeStyle = P.ink; c.lineWidth = u * 0.07; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -u * 0.66); c.stroke();
  c.rotate(wave); for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? '#fff' : P.ink; c.fillRect(i * u * 0.14 + u * 0.03, -u * 0.66 + j * u * 0.15, u * 0.14, u * 0.15); }
  c.strokeRect(u * 0.03, -u * 0.66, u * 0.42, u * 0.3); c.restore();
  c.fillStyle = '#8d6e63'; c.strokeStyle = P.ink; c.lineWidth = u * 0.05; c.beginPath(); c.roundRect((sx + 0.3) * u, (sy + 0.62) * u, u * 0.4, u * 0.38, [u * 0.2, u * 0.2, 0, 0]); c.fill(); c.stroke();
  // the walls of every cell seen: its closed sides, and the frame
  c.strokeStyle = P.ink; c.lineWidth = Math.max(3, u * 0.11); c.lineCap = 'round';
  c.beginPath();
  for (let cc = 0; cc < w * w; cc++) if (known(cc)) {
    const [x, y] = xy(w, cc), m = seen[cc];
    if (!(m & 1)) { c.moveTo(x * u, y * u); c.lineTo((x + 1) * u, y * u); }
    if (!(m & 2)) { c.moveTo((x + 1) * u, y * u); c.lineTo((x + 1) * u, (y + 1) * u); }
    if (!(m & 4)) { c.moveTo(x * u, (y + 1) * u); c.lineTo((x + 1) * u, (y + 1) * u); }
    if (!(m & 8)) { c.moveTo(x * u, y * u); c.lineTo(x * u, (y + 1) * u); }
  }
  c.stroke();
  // the runners (both in a shared maze): the one dashing along its path
  const runners = mini.sep ? [who] : ['X', 'O'];
  for (const p of runners) {
    let [x, y] = xy(w, mini.at[p]), bump = 0;
    if (s && a.by === p) {
      const pts = [s.from].concat(s.path), i = Math.min(pts.length - 2, Math.floor(k)), fr = Math.min(1, k - i), [x0, y0] = xy(w, pts[i]), [x1, y1] = xy(w, pts[i + 1]);
      x = x0 + (x1 - x0) * fr; y = y0 + (y1 - y0) * fr;
      if (s.end === 'dead' && k >= s.path.length) bump = Math.max(0, 1 - (t - s.path.length * MAZE.step) / MAZE.bonk);
    }
    const off = !mini.sep && mini.at.X === mini.at.O && !(s && a.by === p) ? (p === 'X' ? -0.16 : 0.16) : 0, cx = (x + 0.5 + off) * u + (bump ? Math.sin(bump * 18) * u * 0.06 : 0), cy = (y + 0.5) * u, r = u * 0.3;
    if (bump > 0) { c.save(); c.translate(cx, cy); c.fillStyle = '#ffd23f'; c.strokeStyle = P.ink; c.lineWidth = u * 0.03; c.beginPath(); for (let q = 0; q < 16; q++) { const rr = (q % 2 ? 0.34 : 0.56) * u * (1.2 - bump * 0.3), an = q * Math.PI / 8; c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } c.closePath(); c.fill(); c.stroke(); c.restore(); }
    c.fillStyle = p === 'O' ? P.O : P.X; c.strokeStyle = P.ink; c.lineWidth = u * 0.06; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill(); c.stroke();
    c.strokeStyle = p === 'O' ? P.ink : '#fff'; c.lineWidth = u * 0.08; c.beginPath();
    if (p === 'X') { c.moveTo(cx - r * 0.42, cy - r * 0.42); c.lineTo(cx + r * 0.42, cy + r * 0.42); c.moveTo(cx + r * 0.42, cy - r * 0.42); c.lineTo(cx - r * 0.42, cy + r * 0.42); } else c.arc(cx, cy, r * 0.42, 0, 7);
    c.stroke();
  }
  return !!s && t < s.path.length * MAZE.step + Math.max(MAZE.bonk, MAZE.flag) + 100;
});
// The miniature: the maze as far as it has been seen, the flag and the runners (a map each, side by side under its
// player's mark, when each has their own).
export function miniature(mini, final) {
  const lab = `Maze Runner: ${mini.sep ? 'a maze each' : 'one maze'}`;
  if (!mini.sep) return `<div class="tmz one" aria-label="${lab}">${mapSvg(mini, ['X', 'O'])}</div>`;
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
