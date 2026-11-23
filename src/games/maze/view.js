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
// The win (the dash that reaches the flag): a beat on the flag, then the camera draws back to the whole maze as the fog
// lifts off it in a ripple out from the flag (a ring running ahead of it, each cell fading in: the rules' `rev`, the cells
// still in fog), then the winner's runner does its victory dance on the flag (two hops with its arms pumping, a spin, a
// pose on a burst with sparkles: MAZE.dance), and stands there arms up from then on (a finished square's review shows the
// maze whole with the winner on the flag). All of it timed from the move (rules.js MAZE, mazeRevealAt, mazeDanceAt).
// Energy (November 2026, a square with a `cap`): a meter under the maze, its own row (none at all for a square with no
// limit, so nothing shifts within a square): a bolt and a pip a square in the colour of the player on the move, each
// pip emptying as the runner steps into a square (timed from the move), live and in replays; out of it, the meter
// shakes, the runner sags and puffs on the cell where it stopped, and "Out of energy!" fills the result line (MAZE.tired).
import { DIRS, MAZE, mazeDanceAt, mazeGeo, mazeLeft, mazeRevealAt, mazeSeen, mazeStep, mazeWays } from './rules.js';
import { N, REDUCED, mv } from '../../ui/app.js';
import { fxAt } from '../../ui/fx.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { runColours } from '../../ui/runner.js';
import { stage } from '../../ui/stage.js';
import { tok } from '../../ui/tok.js';

export const ownLine = true;
export const hold = f => (f.kind === 'again' ? 0 : null);         // a dash to a fork: the next pick at once
export const MAZEV = { min: 34, dash: 0.88, ease: 0.16, fog: '#c9cfdf', dots: 'rgba(70, 80, 120, .28)' };         // the smallest cell shown (CSS px); the camera's zoom while dashing; its easing a frame
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
// The walls' width at cell size u (the ink) and the white outline round them (added to it): the outer wall's outline is
// the revealed maze's edge.
export const mazeWall = u => Math.max(u >= MAZEV.min ? 4 : 3, u * 0.14);
export const mazeHalo = u => Math.max(3, u * 0.08);
// Where the fog lies under camera V (u, ox, oy): the maze's cells grown by half the outlined outer wall, its corners
// rounded as the wall's round ends are, so the hidden maze and the revealed one are the same size. Pure: the tests hold it.
export function mazeFogRect(g, V) {
  const e = (mazeWall(V.u) + mazeHalo(V.u)) / 2;
  return { x: V.ox - e, y: V.oy - e, w: g.w * V.u + 2 * e, h: g.h * V.u + 2 * e, r: e };
}
// A little map of a maze as far as it has been seen (a tally's, the miniature's): seen cells light, the flag, the runners.
function mapSvg(mini, who, cls, skip) {                          // skip: cells not to show yet (a reveal still to play)
  const g = mazeGeo(mini), seen = mazeSeen(mini, who[0]);
  let out = `<rect class="mzmf" width="${g.w}" height="${g.h}" rx=".35"/>`;
  seen.forEach((v, c) => { if (v >= 0 && !(skip && skip.has(c))) { const [x, y] = xy(g.w, c); out += `<rect class="mzms" x="${x + 0.06}" y="${y + 0.06}" width=".88" height=".88" rx=".14"/>`; } });
  const [fx, fy] = xy(g.w, g.flag); out += `<rect class="mzmg" x="${fx + 0.14}" y="${fy + 0.14}" width=".72" height=".72" rx=".12"/>`;
  who.forEach((p, k) => { const [x, y] = xy(g.w, mini.at[p]); out += `<circle class="mzmt ${mini.one ? 'one' : p}" cx="${x + 0.5 + (who.length > 1 ? (k ? 0.17 : -0.17) : 0)}" cy="${y + 0.5}" r=".34"/>`; });
  return `<svg class="mzmap${cls ? ' ' + cls : ''}" viewBox="-0.1 -0.1 ${g.w + 0.2} ${g.h + 0.2}" aria-hidden="true">${out}</svg>`;
}
const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V6M6 11l6-6 6 6" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const WORDS = { n: 'up', e: 'right', s: 'down', w: 'left' };
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const G = mazeGeo(mini), s = a && a.mz ? a.mz : null, o = { view, locked, turn };
  const who = s ? a.by : (view || d) && mini.last ? mini.last.by : turn;                        // whose maze is the big one (separate), and who moves the runner
  const skip = s && s.rev ? new Set(s.rev) : null;                  // (the winner's map fills in once the move has played: the canvas shows the reveal)
  const tal = p => arcTally(p, o, mini.sep ? mapSvg(mini, [p], 'sm', s && a.by === p ? skip : null) : tok(p));
  const end = s ? s.path.length * MAZE.step : 0;
  const SAY = { dead: ['Dead end!', 'no'], tired: ['Out of energy!', 'no'], flag: ['The flag!', 'ok'] };
  const say = s ? SAY[s.end] || null : d && mini.last && (mini.last.end === 'dead' || mini.last.end === 'tired') ? SAY[mini.last.end] : null;
  const line = say ? `<p ${s ? lateAt('mzline ' + say[1], end) : `class="mzline ${say[1]}"`} role="status">${say[0]}</p>` : '<p class="mzline"></p>';
  // the arrows (never while a dash plays: they are placed where the runner stands once it has)
  const btns = s || view || locked || (mini.last && mini.last.end === 'flag') || (mini.sep && who !== turn) ? '' : mazeWays(mini, turn).map(dir => { const [bx, by] = xy(G.w, mazeStep(G.w, mini.at[turn], dir)); return `<button class="mzgo ${dir} ${turn}" data-act="move" ${mv(dir)} data-cx="${bx}" data-cy="${by}" aria-label="Dash ${WORDS[dir]}">${ARROW}</button>`; }).join('');
  const key = `${state0(mini)}:${mini.sep ? who : 'one'}`;
  if (!cam || cam.key !== key) cam = { key, fx: null, fy: null, z: 1 };
  src = { mini, a: s ? a : null, who };
  go();
  return `<div class="g-mz pc-${who}${mini.sep ? ' sep' : ''}${mini.one ? ' one' : ''}"><div class="ctals">${tal('X')}${tal('O')}</div><div class="mzbox"><div class="mzsq"><canvas class="mzcv" aria-label="The maze"></canvas>${btns}</div></div>${meter(mini, s ? a.by : turn, s)}${line}</div>`;
}
const BOLT = '<svg viewBox="0 0 20 24" aria-hidden="true"><path d="M12 1 3 14h6l-2 9 10-14h-6l2-8z" fill="#ffd23f" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>';
// The energy meter: the mover's energy this turn, a pip a square; during a dash (s, its flash: `left` the energy it set
// off with) the pips it spends empty one by one as the runner steps into each square, the meter shaking once it is out.
export function meter(mini, p, s) {
  const cap = s ? s.cap : mini.cap;
  if (!cap) return '';
  const left = s ? s.left : Math.min(cap, mazeLeft(mini, p)), spent = s ? Math.min(left, s.path.length) : 0, now = left - spent;
  let pips = '';
  for (let i = 0; i < cap; i++) {
    const j = left - 1 - i;                                         // (the step that spends this pip: the last pip first)
    pips += i < now ? '<i class="mzp"></i>' : i < left ? `<i class="mzp e sp" style="--t:${Math.round((j + 0.35) * MAZE.step)}ms"></i>` : '<i class="mzp e"></i>';
  }
  const out = s && s.end === 'tired';
  return `<div class="mzen ${p}${cap > 20 ? ' many' : ''}${out ? ' out' : ''}"${out ? ` style="--t:${Math.round(s.path.length * MAZE.step)}ms"` : ''} role="img" aria-label="Energy: ${now} of ${cap} squares"><i class="mzbolt">${BOLT}</i><span class="mzpips">${pips}</span></div>`;
}
const state0 = mini => `${mini.w}x${mini.h || mini.w}:${mini.start}:${mini.flag}`;
export function heldSub(mini, turn, f, a) { return f ? '' : `<b class="${turn}">${N(turn)}</b> runs on`; }

// ---- the drawing ----
const go = stage('canvas.mzcv', (c, W, H, now) => {
  if (!src) return false;
  const { mini, a, who } = src, G = mazeGeo(mini), w = G.w, P = runColours();
  const seen = mazeSeen(mini, who), s = a ? a.mz : null, at = s ? fxAt('move', a) : null, t = s ? (at == null ? Infinity : now - at) : 0;
  const k = s ? Math.max(0, Math.min(s.path.length, t / MAZE.step)) : 0, hid = new Set(s ? s.fresh.filter(cc => s.path.indexOf(cc) + 1 > k + 0.4) : []);
  // the win: time since the dash landed on the flag (tw), the reveal's ripple (each fogged cell's moment, by its distance
  // from the flag), the camera drawn back to the whole maze; a won square seen afterwards: all of it done
  const win = s ? s.end === 'flag' : !!(mini.last && mini.last.end === 'flag'), land = s ? s.path.length * MAZE.step : 0, tw = s ? t - land : Infinity;
  const [fx0, fy0] = xy(w, G.flag), far = Math.hypot(Math.max(fx0, w - 1 - fx0), Math.max(fy0, G.h - 1 - fy0)) || 1, R0 = mazeRevealAt();
  const revAt = new Map(s && s.rev ? s.rev.map(cc => { const [x, y] = xy(w, cc); return [cc, REDUCED ? R0 : R0 + Math.hypot(x - fx0, y - fy0) / far * MAZE.reveal]; }) : []);
  const alpha = cc => { if (seen[cc] < 0 || hid.has(cc)) return 0; const r = revAt.get(cc); return r == null ? 1 : REDUCED ? (tw >= r ? 1 : 0) : Math.max(0, Math.min(1, (tw - r) / MAZE.fade)); };
  const known = cc => alpha(cc) > 0;
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
  const V0 = mazeCam(G, W, H, cam.fx, cam.fy, cam.z), fit = Math.min(W / G.w, H / G.h);
  const wb = !win || V0.fit ? 0 : !s ? 1 : REDUCED ? (tw >= R0 ? 1 : 0) : ease(Math.max(0, Math.min(1, (tw - R0) / MAZE.cam)));   // the whole maze in view: drawn back to it at the reveal
  const V = wb ? { u: V0.u + (fit - V0.u) * wb, ox: V0.ox + ((W - G.w * fit) / 2 - V0.ox) * wb, oy: V0.oy + ((H - G.h * fit) / 2 - V0.oy) * wb, fit: wb >= 1 } : V0;
  const u = V.u, ox = V.ox, oy = V.oy, X = x => ox + x * u, Y = y => oy + y * u;
  const moving = !V.fit && !wb && (Math.abs(focus[0] - cam.fx) + Math.abs(focus[1] - cam.fy) > 0.01 || Math.abs((dashing ? MAZEV.dash : 1) - cam.z) > 0.004);
  c.clearRect(0, 0, W, H);
  // the fog: a light cool grey with a halftone of dots (never the walls' black, never the floor's cream), over exactly the
  // maze's own bounds (its cells and its outer wall, as the revealed maze stands): the room the box leaves round a maze
  // that fits shows the page, as it does once the maze is revealed
  const F = mazeFogRect(G, V);
  c.save(); c.beginPath(); c.roundRect(F.x, F.y, F.w, F.h, F.r); c.clip();
  c.fillStyle = MAZEV.fog; c.fillRect(F.x, F.y, F.w, F.h);
  c.fillStyle = MAZEV.dots; const step = Math.max(6, u * 0.25), dr = Math.max(1, step * 0.17), sx0 = ((ox % step) + step) % step, sy0 = ((oy % step) + step) % step;
  for (let y = sy0 - step, row = 0; y < H + step; y += step, row++) { c.beginPath(); for (let x = sx0 - step + (row % 2 ? step / 2 : 0); x < W + step; x += step) { c.moveTo(x + dr, y); c.arc(x, y, dr, 0, 7); } c.fill(); }
  c.restore();
  const vis = (x, y) => X(x + 1) >= 0 && X(x) <= W && Y(y + 1) >= 0 && Y(y) <= H;
  c.fillStyle = P.paper;
  for (let cc = 0; cc < G.n; cc++) { const al = alpha(cc); if (al > 0) { const [x, y] = xy(w, cc); if (vis(x, y)) { c.globalAlpha = al; c.fillRect(X(x) - 0.5, Y(y) - 0.5, u + 1, u + 1); } } }
  c.globalAlpha = 1;
  // the flag (always on show) and the door
  const [fx, fy] = xy(w, G.flag), [sx, sy] = xy(w, G.start), wave = s && s.end === 'flag' && k >= s.path.length ? Math.sin((t - s.path.length * MAZE.step) / 70) * 0.12 : 0;
  if (!known(G.flag)) { c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(X(fx), Y(fy), u, u); }
  c.save(); c.translate(X(fx + 0.36), Y(fy + 0.84)); c.strokeStyle = P.ink; c.lineWidth = u * 0.07; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -u * 0.66); c.stroke();
  c.rotate(wave); for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? '#fff' : P.ink; c.fillRect(i * u * 0.14 + u * 0.03, -u * 0.66 + j * u * 0.15, u * 0.14, u * 0.15); }
  c.strokeRect(u * 0.03, -u * 0.66, u * 0.42, u * 0.3); c.restore();
  c.fillStyle = '#8d6e63'; c.strokeStyle = P.ink; c.lineWidth = u * 0.05; c.beginPath(); c.roundRect(X(sx + 0.3), Y(sy + 0.62), u * 0.4, u * 0.38, [u * 0.2, u * 0.2, 0, 0]); c.fill(); c.stroke();
  // the walls of every cell seen: its closed sides (the cells fading in as the fog lifts: each at its own strength)
  const wl = mazeWall(u); c.lineCap = 'round';           // bold black, outlined in white, so a wall found stands out from the fog and the floor
  const walls = (cc, x, y) => {
    const m = seen[cc];
    if (!(m & 1)) { c.moveTo(X(x), Y(y)); c.lineTo(X(x + 1), Y(y)); }
    if (!(m & 2)) { c.moveTo(X(x + 1), Y(y)); c.lineTo(X(x + 1), Y(y + 1)); }
    if (!(m & 4)) { c.moveTo(X(x), Y(y + 1)); c.lineTo(X(x + 1), Y(y + 1)); }
    if (!(m & 8)) { c.moveTo(X(x), Y(y)); c.lineTo(X(x), Y(y + 1)); }
  };
  const ink = () => { c.strokeStyle = '#fff'; c.lineWidth = wl + mazeHalo(u); c.stroke(); c.strokeStyle = P.ink; c.lineWidth = wl; c.stroke(); };
  const part = [];
  c.beginPath();
  for (let cc = 0; cc < G.n; cc++) { const al = alpha(cc); if (al <= 0) continue; const [x, y] = xy(w, cc); if (!vis(x, y)) continue; if (al < 1) part.push([cc, x, y, al]); else walls(cc, x, y); }
  ink();
  for (const [cc, x, y, al] of part) { c.globalAlpha = al; c.beginPath(); walls(cc, x, y); ink(); }
  c.globalAlpha = 1;
  // the reveal's ripple: a ring running out from the flag just ahead of the fog lifting
  const rp = s && s.rev && s.rev.length && !REDUCED ? (tw - R0) / MAZE.reveal : -1;
  if (rp > 0 && rp < 1.15) {
    const rr = (rp * far + 0.5) * u, fade = Math.min(1, (1.15 - rp) / 0.3);
    c.save(); c.globalAlpha = fade; c.beginPath(); c.arc(X(fx0 + 0.5), Y(fy0 + 0.5), rr, 0, 7);
    c.strokeStyle = P.ink; c.lineWidth = Math.max(5, u * 0.22); c.stroke(); c.strokeStyle = '#ffd23f'; c.lineWidth = Math.max(3, u * 0.13); c.stroke(); c.restore();
  }
  // the runners (the winner on the flag: its dance, then its pose)
  for (const p of runners) {
    const [x, y] = pos[p]; let bump = 0;
    if (win && (mini.one || p === (s ? a.by : mini.last.by)) && (!s || tw >= mazeDanceAt())) { dancer(c, W, H, X(x + 0.5), Y(y + 0.5), u, p, P, s && !REDUCED ? tw - mazeDanceAt() : Infinity); continue; }
    if (s && (a.by === p || mini.one) && s.end === 'dead' && k >= s.path.length) bump = Math.max(0, 1 - (t - s.path.length * MAZE.step) / MAZE.bonk);
    const tq = s && (a.by === p || mini.one) && s.end === 'tired' && k >= s.path.length ? Math.min(1, (t - s.path.length * MAZE.step) / MAZE.tired) : -1;   // out of energy: the sag and the puffs
    const off = !mini.sep && !mini.one && mini.at.X === mini.at.O && !(s && a.by === p) ? (p === 'X' ? -0.16 : 0.16) : 0, cx = X(x + 0.5 + off) + (bump ? Math.sin(bump * 18) * u * 0.06 : 0), cy = Y(y + 0.5), r = u * 0.3;
    if (bump > 0) { c.save(); c.translate(cx, cy); c.fillStyle = '#ffd23f'; c.strokeStyle = P.ink; c.lineWidth = u * 0.03; c.beginPath(); for (let q = 0; q < 16; q++) { const rr = (q % 2 ? 0.34 : 0.56) * u * (1.2 - bump * 0.3), an = q * Math.PI / 8; c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } c.closePath(); c.fill(); c.stroke(); c.restore(); }
    const sag = tq < 0 ? 0 : REDUCED ? 1 : ease(Math.min(1, tq * 3)) * (1 - 0.3 * seg(tq, 0.75, 1));
    if (tq >= 0 && !REDUCED) puffs(c, cx, cy, r, tq, P);
    c.save(); c.translate(cx, cy + r * 0.22 * sag); c.scale(1 + 0.14 * sag, 1 - 0.22 * sag);
    c.fillStyle = p === 'O' ? P.O : P.X; c.strokeStyle = P.ink; c.lineWidth = u * 0.06; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill(); c.stroke();
    c.strokeStyle = p === 'O' ? P.ink : '#fff'; c.lineWidth = u * 0.08; c.beginPath();
    if (p === 'X') { c.moveTo(-r * 0.42, -r * 0.42); c.lineTo(r * 0.42, r * 0.42); c.moveTo(r * 0.42, -r * 0.42); c.lineTo(-r * 0.42, r * 0.42); } else c.arc(0, 0, r * 0.42, 0, 7);
    c.stroke(); c.restore();
  }
  // the flag out of sight (the camera's window): a pointer at the box's edge towards it
  if (wb < 0.5 && (X(fx + 1) < 0 || X(fx) > W || Y(fy + 1) < 0 || Y(fy) > H)) {
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
  return moving || (!!s && t < land + (win ? mazeDanceAt() + MAZE.dance : Math.max(MAZE.bonk, MAZE.flag, MAZE.tired)) + 100);
});
const ease = v => (v < 0.5 ? 2 * v * v : 1 - 2 * (1 - v) * (1 - v));
// Out of energy (q 0 to 1 through MAZE.tired): three puffs of breath rising off the runner and fading, a drop of sweat.
function puffs(c, cx, cy, r, q, P) {
  c.save(); c.strokeStyle = P.ink; c.lineWidth = Math.max(1.5, r * 0.12);
  for (let i = 0; i < 3; i++) {
    const k = seg(q, i * 0.12, 0.6 + i * 0.12); if (k <= 0 || k >= 1) continue;
    const px = cx + (i - 1) * r * 0.8 + (i - 1) * r * 0.6 * k, py = cy - r * (1.15 + 1.3 * k), pr = r * (0.3 + 0.32 * k);
    c.globalAlpha = 1 - k; c.fillStyle = '#fff'; c.beginPath(); c.arc(px, py, pr, 0, 7); c.fill(); c.stroke();
  }
  const dk = seg(q, 0.1, 0.9);
  if (dk > 0 && dk < 1) { const dx = cx + r * 0.95, dy = cy - r * 0.55 + r * 0.8 * dk; c.globalAlpha = 1 - dk * 0.6; c.fillStyle = '#7cc8ff'; c.beginPath(); c.moveTo(dx, dy - r * 0.32); c.quadraticCurveTo(dx + r * 0.2, dy, dx, dy + r * 0.08); c.quadraticCurveTo(dx - r * 0.2, dy, dx, dy - r * 0.32); c.fill(); c.stroke(); }
  c.restore();
}
const seg = (d, a, b) => Math.max(0, Math.min(1, (d - a) / (b - a)));
// The winner's victory dance, `d` ms into it (Infinity: its pose, kept): two hops (a squash, up with the arms pumping, a
// squash on landing), a spin (the disc turning on its upright axis), then the pose: a little jump to arms up on a burst
// with sparkles. Drawn at the cell's middle (cx, cy) in cell size u, in the runner's colour, a size that reads on a whole
// maze however small its cells (it grows as it starts: the star of the moment), kept inside the box W by H with room
// for its hops and its arms (the flag is in a corner).
function dancer(c, W, H, cx0, cy0, u0, p, P, d) {
  const M = MAZE, done = d >= M.dance, r0 = u0 * 0.3, big = Math.max(r0 * 1.25, Math.min(W, H) * 0.06), kept = Math.max(r0 * 1.15, Math.min(W, H) * 0.04);
  const r = done ? kept : d < M.pose ? r0 + (big - r0) * ease(seg(d, 0, M.hop1 + 80)) : big + (kept - big) * ease(seg(d, M.pose + (M.dance - M.pose) * 0.55, M.dance)), u = r / 0.3;   // (grows for the dance, settles to the pose it keeps)
  const cx = Math.max(r * 2.6, Math.min(W - r * 2.6, cx0)), cy = Math.max(r * 3.3, Math.min(H - r * 1.4, cy0));
  let y = 0, sx = 1, sy = 1, turn = 0, arm = done ? 1 : 0.2, burst = 0;
  const hop = (h0, len) => { const k = (d - h0) / len; if (k < 0 || k > 1) return false;
    if (k < 0.18) { sx = 1 + 0.18 * (k / 0.18); sy = 1 - 0.2 * (k / 0.18); arm = 0.3; }
    else if (k < 0.82) { const q = (k - 0.18) / 0.64; y = -Math.sin(Math.PI * q) * u * 0.55; sx = 0.92; sy = 1.1; arm = 0.3 + 0.7 * Math.sin(Math.PI * q); }
    else { const q = (k - 0.82) / 0.18; sx = 1.16 - 0.16 * q; sy = 0.8 + 0.2 * q; arm = 0.3; }
    return true; };
  if (!done) {
    if (!hop(M.hop1, M.hop2 - M.hop1 - 20) && !hop(M.hop2, M.spin - M.hop2 - 20)) {
      if (d >= M.spin && d < M.pose) { const q = ease(seg(d, M.spin, M.pose - 20)); turn = q * Math.PI * 2; y = -Math.sin(Math.PI * q) * u * 0.22; arm = 0.6; }
      else if (d >= M.pose) { const q = seg(d, M.pose, M.dance); y = -Math.sin(Math.PI * Math.min(1, q * 2.2)) * u * 0.25; sy = q < 0.12 ? 0.84 : 1 + 0.08 * Math.sin(Math.PI * Math.min(1, q * 2.2)); sx = 2 - sy; arm = 1; burst = q; }
    }
  }
  if (burst > 0 || done) {                                         // the pose's burst: a comic star behind, sparkles flying out (once), a small star kept after
    const g = done ? 0.75 : 0.5 + 0.5 * ease(Math.min(1, burst * 3)) - 0.25 * ease(seg(burst, 0.55, 1)), n = 14;
    c.save(); c.translate(cx, cy + y); c.fillStyle = '#ffd23f'; c.strokeStyle = P.ink; c.lineWidth = Math.max(2, u * 0.05); c.beginPath();
    for (let q = 0; q < 2 * n; q++) { const rr = (q % 2 ? 0.55 : 0.95) * u * g, an = q * Math.PI / n + (done ? 0 : burst * 0.6); c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); }
    c.closePath(); c.fill(); c.stroke();
    if (!done) for (let q = 0; q < 6; q++) { const an = q * Math.PI / 3 + 0.4, dd = u * (0.7 + 0.8 * burst), sz = u * 0.12 * (1 - burst * 0.7); const px = Math.cos(an) * dd, py = Math.sin(an) * dd;
      c.beginPath(); c.moveTo(px, py - sz); c.lineTo(px + sz * 0.3, py - sz * 0.3); c.lineTo(px + sz, py); c.lineTo(px + sz * 0.3, py + sz * 0.3); c.lineTo(px, py + sz); c.lineTo(px - sz * 0.3, py + sz * 0.3); c.lineTo(px - sz, py); c.lineTo(px - sz * 0.3, py - sz * 0.3); c.closePath(); c.fillStyle = '#fff'; c.fill(); c.stroke(); }
    c.restore();
  }
  const col = p === 'O' ? P.O : P.X, bx = cx, by = cy + y, cs = Math.cos(turn);
  // the arms: from the disc's sides, up and out as `arm` rises (1: straight up in a V), a hand in the runner's colour
  for (const side of [-1, 1]) {
    const an = -Math.PI / 2 + side * (0.35 + (1 - arm) * 1.5), sx0 = bx + side * r * 0.82 * Math.abs(cs || 0.0001), sy0 = by - r * 0.1, L = r * 1.15;
    const hx = sx0 + Math.cos(an) * L, hy = sy0 + Math.sin(an) * L;
    c.strokeStyle = P.ink; c.lineWidth = Math.max(2.5, u * 0.07); c.lineCap = 'round'; c.beginPath(); c.moveTo(sx0, sy0); c.quadraticCurveTo(sx0 + side * r * 0.5, sy0 - r * 0.15, hx, hy); c.stroke();
    c.fillStyle = col; c.lineWidth = Math.max(1.5, u * 0.04); c.beginPath(); c.arc(hx, hy, Math.max(3, r * 0.26), 0, 7); c.fill(); c.stroke();
  }
  c.save(); c.translate(bx, by); c.scale(sx * (Math.abs(cs) < 0.06 ? 0.06 : Math.abs(cs)), sy);
  c.fillStyle = col; c.strokeStyle = P.ink; c.lineWidth = u * 0.06; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill(); c.stroke();
  c.strokeStyle = p === 'O' ? P.ink : '#fff'; c.lineWidth = u * 0.08; c.beginPath();
  if (p === 'X') { c.moveTo(-r * 0.42, -r * 0.42); c.lineTo(r * 0.42, r * 0.42); c.moveTo(r * 0.42, -r * 0.42); c.lineTo(-r * 0.42, r * 0.42); } else c.arc(0, 0, r * 0.42, 0, 7);
  c.stroke(); c.restore();
}
// The miniature: the maze as far as it has been seen, the flag and the runners (a map each, side by side under its
// player's mark, when each has their own).
export function miniature(mini, final) {
  const lab = `Maze Runner: ${mini.sep ? 'a maze each' : mini.one ? 'one maze, one runner' : 'one maze'}`;
  if (!mini.sep) return `<div class="tmz one" aria-label="${lab}">${mapSvg(mini, mini.one ? ['X'] : ['X', 'O'])}</div>`;
  return `<div class="tmz" aria-label="${lab}">${['X', 'O'].map(p => `<div class="tmzc"><b class="${p}">${p}</b>${mapSvg(mini, [p])}</div>`).join('')}</div>`;
}
export function moveText(f, who) { const s = f.mz; return !s ? `${who} ran` : s.end === 'dead' ? `${who} ran into a dead end` : s.end === 'tired' ? `${who} ran out of energy` : s.end === 'flag' ? `${who} reached the flag` : `${who} ran to a fork`; }
// A patter of steps as the runner dashes (a tick a cell), then where it ends: a bump at a dead end, a chime at the flag,
// a soft pop at a fork.
export function sounds(f, add, won, mini, last) {
  const s = f.mz; if (!s) return;
  for (let k = 0; k < Math.min(12, s.path.length); k++) add('mzStep', Math.round(k * MAZE.step), 0.9 + (k % 2) * 0.12);
  const end = s.path.length * MAZE.step;
  if (s.end === 'dead') add('mzBonk', end);
  else if (s.end === 'tired') add('mzTired', end);
  else if (s.end === 'flag') {                                     // the flag: a ding; the fog lifting (a rising shimmer); the dance's two hops and its spin; the won chime with its pose (wonAt)
    const D = end + mazeDanceAt();
    add('ding', end); add('mzReveal', end + mazeRevealAt());
    add('mzHop', D + MAZE.hop1); add('mzHop', D + MAZE.hop2, 1.12); add('mzSpin', D + MAZE.spin);
  } else add('pop', end);
}
export const wonAt = (f, total) => (f.mz && f.mz.end === 'flag' ? f.mz.path.length * MAZE.step + mazeDanceAt() + MAZE.pose : total - 600);
