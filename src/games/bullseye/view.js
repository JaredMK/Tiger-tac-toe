// Bullseye: the screen, the miniature, the move's words and sounds, and the inputs.
import { BULLS, BULLT, bullsConfig, bullsFlick, bullsGeom, bullsPlan, bullsPoint, setBullsConfig } from './rules.js';
import { tune } from '../../core/tune.js';
import { SND, ownPress } from '../../audio/sound.js';
import { FIREBASE_CONFIG, configured } from '../../net/connect.js';
import { attemptMove } from '../../net/moves.js';
import { blocked, moveWait } from '../../net/room.js';
import { N, REDUCED, app, cpuPlays, state, waitLine } from '../../ui/app.js';
import { KEY } from '../../ui/config.js';
import { fxAt } from '../../ui/fx.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { repNote } from '../../ui/replay.js';
import { runCanvas, runColours } from '../../ui/runner.js';

// Bullseye (November 2026): the dartboard on its wall, drawn on a canvas (rules.js bullsGeom: the wall face on, the
// floor under it, the dart in the hand at this end, big and near). A flick up from anywhere on the game area throws
// it (bullsFlick: the swipe's angle is the throw's, straight along the line the finger drew; the finger's speed over
// its last 80 ms sets how high up the wall it goes), the dart leaving the hand on the same frame. The throw plays
// from the move's event (fxAt('move'): never from a redraw): the dart flies a shallow arc, shrinking as it goes away
// towards the wall and turning to point at it, its shadow on the wall closing in and darkening as it nears; it
// sticks with a thunk and quivers, a ring bursting from where it hit (a bullseye: a gold star burst, the bull
// flashing), and the thrower's points count on at that moment. Every dart thrown stays where it landed, its flights
// in its player's colour. Someone else's throw shows their flick first (bullsPre: a finger's streak from the hand).
// Online, this phone's own dart leaves the hand at once and drifts out along its aim until the server's record
// lands (its landing is the server's draw: CLAUDE.md, moves whose result the server draws); the flight goes on from
// there. The result's words go in the reserved line under the wall, never over it.
const HAND = BULLS.hand, AT = BULLS.at, LAUNCH_MS = 220, POP_MS = 260, RING_MS = 380, WOB = { ms: BULLT.stick, a: 0.3, per: 85 };
const LEN = 22, DEPTH = 0.7;                   // the dart's length in the hand (wall units), and how much smaller it is at the wall: 1 / (1 + DEPTH)
export const bullsWord = g => (g.zone === 'bull' ? `BULLSEYE! +${g.pts}` : g.zone === 'mid' ? `Inner ring +${g.pts}` : g.zone === 'board' ? `Outer ring +${g.pts}` : 'Missed');
let drag = null;                               // the swipe under way: { id, x0, y0, pts: [[ms, x, y]...], area }
let launch = null;                             // this phone's throw let go online, before the server's record: { sq, p, at, aim, power }
let bullRep = null;                            // someone else's flick replayed by the shared system's inputs stage (ui/replay.js): { sq, p, aim, power, at }
let src = null;                                // what the last render drew: { mini, f, turn, view, zoom, mine, pend, done }
let raf = 0, lastF = null, popAt = 0;
const cfgOf = mini => (mini && mini.v === 2 && mini.cfg && mini.cfg.mid ? mini.cfg : bullsConfig());   // (a square from before the rework, not yet thrown at: the board of the day)
const dartsOf = mini => (mini && mini.v === 2 && Array.isArray(mini.darts) ? mini.darts : []);
const flashOf = a => (a && a.bull && Number.isFinite(a.bull.aim) ? a.bull : null);   // (a throw from before the rework, in an old record: nothing to play)
// Someone else's throw (the computer's, the other phone's): their flick shows first, BULLT.pre ms (none for a flick the
// shared replay already pressed here, bullRep; none for this phone's own, which it just made).
export function bullsPre(f) {
  if (!f || f.type !== 'bullseye' || !flashOf(f) || f.timeout || REDUCED) return 0;
  const other = state.online ? f.by !== state.online.me : cpuPlays(f.by);
  if (!other) return 0;
  if (bullRep && bullRep.sq === f.square && bullRep.p === f.by) return 0;
  return BULLT.pre;
}
function bullsTable(mini, a, o) {
  const g = flashOf(a), l = mini.last && mini.last.zone ? mini.last : null, turn = o.turn, goal = tune(mini).goal;
  const pre = g ? bullsPre(a) : 0, P = g ? bullsPlan(pre) : null, still = REDUCED;
  const score = p => {                                           // the points: the thrower's count on as the dart lands, not before
    const now = Math.min(goal, (g ? g.total : mini.pts)[p] || 0), was = g && a.by === p ? Math.min(goal, Math.max(0, now - g.pts)) : now;
    return was !== now && !still ? `<span class="ppts"><span class="tu" style="--u:${P.hit}ms">${was}</span><span class="tf" style="--f:${P.hit}ms">${now}</span></span>` : `<span class="ppts"><span>${now}</span></span>`;
  };
  const tal = p => arcTally(p, o, `<span class="plkpts">${score(p)}<small>/${goal}</small></span>`);
  const pend = !g && launchOn(o.zoom), mine = !o.view && !g && !o.locked && !o.done && !pend;
  const res = g ? `<p ${lateAt('arcres ' + (g.pts ? 'ok' : 'no'), still ? null : P.hit)} role="status">${bullsWord(g)}</p>`
    : o.done && l ? `<p class="arcres ${l.pts ? 'ok' : 'no'}">${bullsWord(l)}</p>`
    : o.view ? `<p class="arcnote">${l ? `<b class="${l.by}">${N(l.by)}</b>: ${bullsWord(l)}` : ''}</p>`
    : `<p class="arcnote">${mine || pend ? '' : waitLine(turn)}</p>`;
  src = { mini, f: g ? a : null, turn, view: o.view, zoom: o.zoom, mine, pend, done: o.done };
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="bulls${mine ? ' live' : ''}" data-bulls="area"><canvas class="bdcv" data-bulls="cv" aria-label="The dartboard: ${N('X')} ${mini.pts.X}, ${N('O')} ${mini.pts.O} of ${goal}"></canvas>${res}</div></div>`;   // (no aim guides: the dart and the board, nothing else)
}
const launchOn = zoom => !!launch && launch.sq === zoom && performance.now() - launch.at < 8000 && (!!moveWait || performance.now() - launch.at < 700);
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = bullsTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d });
  schedulePaint();
  return g;
}
export function moveText(f, who) {
  const g = flashOf(f);
  return g ? `${who} threw: ${g.zone === 'bull' ? `a bullseye, +${g.pts}` : g.pts ? `the ${g.zone === 'mid' ? 'inner' : 'outer'} ring, +${g.pts}` : 'off the board'}` : `${who} threw`;
}
// The throw's sounds at its moments: the flick's whoosh (this phone's own online throw played its own at the flick:
// none here), then the dart in the board: the bullseye's deep thunk and its ring, a ring's thunk, or the wall's dull
// knock; and the quiver after it.
export function sounds(f, add, won, mini, last) {
  const g = flashOf(f), pre = bullsPre(f);
  if (!(state.online && state.online.me && f.by === state.online.me)) add('dartThrow', pre);
  if (!g) return;
  const P = bullsPlan(pre);
  add(g.zone === 'bull' ? 'dartBull' : g.pts ? 'dartHit' : 'dartMiss', P.hit);
  add('dartQuiver', P.hit + 40);
  if (g.zone === 'bull') add('sparkle', P.hit + 140);
}

// ---- the flick ----
// The throw a swipe makes (rules.js bullsFlick): its direction from first touch to release, its speed over the last
// 80 ms (the oldest sample kept is the last one at least 80 ms back), both in CSS pixels.
function bullsRead(d, x, y, now) {
  let b = d.pts[0];
  for (const p of d.pts) if (now - p[0] >= 80) b = p; else break;
  const v = Math.hypot(x - b[1], y - b[2]) / Math.max(16, now - b[0]);
  const mini = state.squares && state.squares[state.zoom] ? state.squares[state.zoom].mini : null;
  return bullsFlick(x - d.x0, d.y0 - y, v, tune(mini));
}
function bullsRelease(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag; drag = null;
  const r = bullsRead(d, e.clientX, e.clientY, performance.now());
  if (!r || state.screen !== 'mini' || state.flash || blocked()) { schedulePaint(); return; }   // too short, or sideways: not a throw (the dart stays in the hand, straight again)
  repNote('dart', `aim=${r.aim}|power=${r.power}`);
  launch = { sq: state.zoom, p: state.turn, at: performance.now(), aim: r.aim, power: r.power };
  if (state.online) SND.play('dartThrow');                        // (the whoosh at the flick itself: the server's record, and the flight's sounds, come after)
  attemptMove({ aim: r.aim, power: r.power });
  if (!state.online) launch = null;                               // (here, the move played at once: the flight is the flash's, from this same frame)
  bullsPaint(performance.now());                                  // the dart leaves on this frame
}

// ---- someone else's flick through the shared replay (ui/replay.js: its inputs stage, when it presses them) ----
// The log's one input: the flick, `aim=..|power=..`; the computer's is made from its move.
const FLICK = /^aim=(-?[\d.]+)\|power=(-?[\d.]+)$/;
function replayInput(act, val, r) {
  const m = act === 'dart' ? FLICK.exec(val || '') : null;
  if (!m) return false;
  bullRep = { sq: r.sq, p: r.by, aim: Number(m[1]), power: Number(m[2]), at: performance.now() };
  schedulePaint();
  return true;
}
const replaySynth = m => (m && typeof m === 'object' && Number.isFinite(m.aim) ? [[0, 'dart', `aim=${m.aim}|power=${m.power}`]] : null);
export const replay = { input: replayInput, synth: replaySynth };

// ---- the drawing ----
function schedulePaint() { if (raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(bullsPaint); }
const lerp = (a, b, u) => a + (b - a) * u, clamp01 = u => Math.max(0, Math.min(1, u)), ease = u => u * u * (3 - 2 * u);
const unit = (x, y) => { const n = Math.hypot(x, y) || 1; return [x / n, y / n]; };
// The way a dart in the wall points (from its flights to its tip): up, leaning a little away from the hand's side.
export const stuckDir = (x, y) => unit((x - HAND[0]) * 0.5, y - HAND[1]);
// The dart t ms into the move (P: the plan, with its pre), from `start` ([x, y, w]: the hand, or where this phone's own
// online throw drifted to): { x, y (its tip, wall units), w (0 in the hand to 1 at the wall), dir (the way it points),
// wob (its quiver, radians), stuck }.
export function dartAt(g, P, t, start) {
  const s = start || [HAND[0], HAND[1], 0];
  if (t < P.pre) return { x: s[0], y: s[1], w: s[2], dir: unit(g.x - s[0], g.y - s[1]) };
  const end = stuckDir(g.x, g.y);
  if (t >= P.hit) {
    const dt = t - P.hit, wob = dt < WOB.ms ? WOB.a * Math.sin(dt / WOB.per * Math.PI * 2) * Math.pow(1 - dt / WOB.ms, 2) : 0;
    return { x: g.x, y: g.y, w: 1, dir: end, wob, stuck: true };
  }
  const u = (t - P.pre) / BULLT.fly, dx = g.x - s[0], dy = g.y - s[1], arc = 0.16 * Math.hypot(dx, dy);
  const tan = unit(dx, dy + arc * 4 * (2 * u - 1)), k = ease(clamp01((u - 0.6) / 0.4));   // along its path, turning in to how it will stick over the last of the flight
  return { x: s[0] + dx * u, y: s[1] + dy * u - arc * 4 * u * (1 - u), w: lerp(s[2], 1, u), dir: unit(lerp(tan[0], end[0], k), lerp(tan[1], end[1], k)) };
}
// This phone's own online throw before the record: the dart out of the hand along its aim, drifting on slowly.
function launchPos(l, dt) {
  const [tx, ty] = bullsPoint(l.aim, l.power), u = clamp01(dt / LAUNCH_MS), w = 0.14 * Math.sin(Math.PI / 2 * u) + Math.min(0.1, Math.max(0, dt - LAUNCH_MS) * 0.00006);
  return [lerp(HAND[0], tx, w), lerp(HAND[1], ty, w) - 3 * u, w];
}
const dartLen = w => LEN / (1 + DEPTH * w);                      // its length as drawn (wall units) at that depth
// A dart: its tip at (X, Y) pixels, pointing along dir, L pixels long: the point, the barrel, the shaft and the flights
// in its player's colour. shade: a flat shadow of it instead.
function drawDart(c, X, Y, dir, L, col, ink, shade, alpha) {
  c.save();
  c.translate(X, Y); c.rotate(Math.atan2(-dir[1], -dir[0]) - Math.PI / 2);   // (its own y runs from the tip back to the flights)
  if (alpha != null) c.globalAlpha = alpha;
  const lw = Math.max(1.1, L * 0.035), bw = L * 0.12;
  c.lineCap = 'round'; c.lineJoin = 'round';
  const flights = () => { c.beginPath(); c.moveTo(0, L * 0.6); c.lineTo(L * 0.19, L * 0.8); c.lineTo(L * 0.16, L); c.lineTo(0, L * 0.9); c.lineTo(-L * 0.16, L); c.lineTo(-L * 0.19, L * 0.8); c.closePath(); };
  const barrel = () => { c.beginPath(); c.moveTo(-bw * 0.3, L * 0.17); c.lineTo(bw * 0.3, L * 0.17); c.lineTo(bw / 2, L * 0.24); c.lineTo(bw / 2, L * 0.46); c.lineTo(bw * 0.25, L * 0.52); c.lineTo(-bw * 0.25, L * 0.52); c.lineTo(-bw / 2, L * 0.46); c.lineTo(-bw / 2, L * 0.24); c.closePath(); };
  if (shade) {
    c.fillStyle = c.strokeStyle = '#000';
    c.lineWidth = Math.max(1, L * 0.04); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, L * 0.8); c.stroke();
    barrel(); c.fill(); flights(); c.fill();
    c.restore(); return;
  }
  c.strokeStyle = ink; c.lineWidth = Math.max(1.6, L * 0.05) + lw; c.beginPath(); c.moveTo(0, L * 0.02); c.lineTo(0, L * 0.2); c.stroke();   // the point, outlined
  c.strokeStyle = '#c9d0d8'; c.lineWidth = Math.max(1.2, L * 0.04); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, L * 0.2); c.stroke();
  c.strokeStyle = ink; c.lineWidth = Math.max(1.6, L * 0.055); c.beginPath(); c.moveTo(0, L * 0.5); c.lineTo(0, L * 0.8); c.stroke();   // the shaft
  barrel();
  const gr = c.createLinearGradient(-bw / 2, 0, bw / 2, 0); gr.addColorStop(0, '#8b949f'); gr.addColorStop(0.4, '#eef1f5'); gr.addColorStop(1, '#727b86');
  c.fillStyle = gr; c.fill(); c.lineWidth = lw; c.strokeStyle = ink; c.stroke();
  if (L > 34) { c.lineWidth = Math.max(1, lw * 0.7); c.strokeStyle = 'rgba(0,0,0,.45)'; for (const y of [0.29, 0.35, 0.41]) { c.beginPath(); c.moveTo(-bw * 0.42, L * y); c.lineTo(bw * 0.42, L * y); c.stroke(); } }   // the grip, near
  flights(); c.fillStyle = col; c.fill(); c.lineWidth = lw; c.strokeStyle = ink; c.stroke();
  c.fillStyle = 'rgba(255,255,255,.28)'; c.beginPath(); c.moveTo(0, L * 0.62); c.lineTo(-L * 0.17, L * 0.8); c.lineTo(-L * 0.145, L * 0.97); c.lineTo(0, L * 0.9); c.closePath(); c.fill();   // the flights' lit side
  c.lineWidth = Math.max(1, lw * 0.8); c.strokeStyle = ink; c.beginPath(); c.moveTo(0, L * 0.62); c.lineTo(0, L * 0.92); c.stroke();
  c.restore();
}
// The wall, the floor under it and the board with its three rings (cfg: their radii).
function drawScene(c, G, cfg, Pal, glow) {
  const X = x => G.ox + x * G.k, Y = y => G.oy + y * G.k, k = G.k, fy = Y(BULLS.wall);
  const wall = c.createLinearGradient(0, 0, 0, fy); wall.addColorStop(0, '#4b7d8a'); wall.addColorStop(1, '#386270');
  c.fillStyle = wall; c.fillRect(0, 0, G.W, fy);
  const lamp = c.createRadialGradient(X(AT[0]), Y(AT[1] - 6), cfg.board * k * 0.6, X(AT[0]), Y(AT[1]), cfg.board * k * 3.2);   // a lamp over the board
  lamp.addColorStop(0, 'rgba(255,244,214,.34)'); lamp.addColorStop(1, 'rgba(255,244,214,0)');
  c.fillStyle = lamp; c.fillRect(0, 0, G.W, fy);
  c.fillStyle = '#7a5230'; c.fillRect(0, fy, G.W, G.H - fy);                                 // the floor: boards running away to the wall
  c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = Math.max(1, 0.35 * k);
  for (let i = -9; i <= 9; i++) { c.beginPath(); c.moveTo(X(50 + i * 9), fy); c.lineTo(X(50 + i * 17), G.H + 2); c.stroke(); }
  const fl = c.createLinearGradient(0, fy, 0, G.H); fl.addColorStop(0, 'rgba(0,0,0,.32)'); fl.addColorStop(0.5, 'rgba(0,0,0,0)');
  c.fillStyle = fl; c.fillRect(0, fy, G.W, G.H - fy);
  c.fillStyle = '#2f2118'; c.fillRect(0, fy - 3.4 * k, G.W, 3.4 * k);                        // the skirting board
  c.fillStyle = Pal.ink; c.fillRect(0, fy - 3.4 * k - 1, G.W, 2); c.fillRect(0, fy - 1, G.W, 2);
  const cx = X(AT[0]), cy = Y(AT[1]), R = cfg.board * k, M = cfg.mid * k, B = cfg.bull * k, S = R * 1.08;
  c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.arc(cx + 1.8 * k, cy + 2.8 * k, S, 0, Math.PI * 2); c.fill();   // the board's shadow on the wall
  c.beginPath(); c.arc(cx, cy, S, 0, Math.PI * 2); c.fillStyle = '#231d1a'; c.fill(); c.lineWidth = Math.max(2, 0.7 * k); c.strokeStyle = Pal.ink; c.stroke();
  const wedge = (r0, r1, a0, a1) => { c.beginPath(); c.arc(cx, cy, r1, a0, a1); c.arc(cx, cy, r0, a1, a0, true); c.closePath(); };
  const W12 = Math.PI / 6, off = -Math.PI / 2 - W12 / 2;
  for (let i = 0; i < 12; i++) {
    const a0 = off + i * W12, a1 = a0 + W12;
    wedge(M, R, a0, a1); c.fillStyle = i % 2 ? '#2d2825' : '#f1e3b8'; c.fill();                 // the outer ring: cream and charcoal
    wedge(B, M, a0, a1); c.fillStyle = i % 2 ? '#3f9a50' : '#2f7d40'; c.fill();                 // the inner ring: two greens
  }
  c.beginPath(); c.arc(cx, cy, B, 0, Math.PI * 2); c.fillStyle = glow > 0 ? `rgb(${Math.round(229 + 26 * glow)},${Math.round(67 + 180 * glow)},${Math.round(42 + 170 * glow)})` : Pal.X; c.fill();   // the bullseye (flashing as it is hit)
  c.strokeStyle = 'rgba(226,229,235,.92)'; c.lineWidth = Math.max(1, 0.32 * k);             // the wires
  for (let i = 0; i < 12; i++) { const a = off + i * W12; c.beginPath(); c.moveTo(cx + Math.cos(a) * B, cy + Math.sin(a) * B); c.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); c.stroke(); }
  for (const r of [B, M, R]) { c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke(); }
  const sh = c.createRadialGradient(cx - R * 0.45, cy - R * 0.55, R * 0.1, cx, cy, S);       // the board's roundness: lit from the top left
  sh.addColorStop(0, 'rgba(255,255,255,.2)'); sh.addColorStop(0.55, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.26)');
  c.beginPath(); c.arc(cx, cy, S, 0, Math.PI * 2); c.fillStyle = sh; c.fill();
}
// Where the dart hit: a ring bursting out of it (u: 0 to 1); a bullseye's is gold, with rays.
function drawBurst(c, G, g, u, Pal) {
  const X = G.ox + g.x * G.k, Y = G.oy + g.y * G.k, k = G.k, bull = g.zone === 'bull', e = 1 - Math.pow(1 - u, 2);
  c.save(); c.globalAlpha = 1 - u;
  c.lineWidth = Math.max(1.5, (bull ? 1.1 : 0.7) * k * (1 - u * 0.6)); c.strokeStyle = bull ? '#ffd54a' : g.pts ? '#fff' : 'rgba(30,24,20,.7)';
  c.beginPath(); c.arc(X, Y, (bull ? 5 + 24 * e : 2.5 + (g.pts ? 11 : 6) * e) * k, 0, Math.PI * 2); c.stroke();
  if (bull) {
    c.lineCap = 'round'; c.lineWidth = Math.max(2, 0.9 * k);
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 + 0.3, r0 = (8 + 16 * e) * k, r1 = (13 + 27 * e) * k; c.beginPath(); c.moveTo(X + Math.cos(a) * r0, Y + Math.sin(a) * r0); c.lineTo(X + Math.cos(a) * r1, Y + Math.sin(a) * r1); c.stroke(); }
  } else if (!g.pts) {
    c.fillStyle = 'rgba(240,232,214,.8)';                                                    // off the board: a puff of plaster
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.55; c.beginPath(); c.arc(X + Math.cos(a) * 8 * e * k, Y + Math.sin(a) * 8 * e * k + 5 * u * u * k, Math.max(1, 1.1 * k * (1 - u)), 0, Math.PI * 2); c.fill(); }
  }
  c.restore();
}
// The streak of a flick from the hand: a finger's trail along the throw's direction, as long as the throw is hard (u: 0 to 1 of it).
function drawFlick(c, G, aim, power, u, col) {
  const [tx, ty] = bullsPoint(aim, power), d = unit(tx - HAND[0], ty - HAND[1]), k = G.k, len = (12 + 22 * power) * k * ease(u);
  const X0 = G.ox + HAND[0] * k, Y0 = G.oy + (HAND[1] + 8) * k, ex = X0 + d[0] * len, ey = Y0 + d[1] * len;
  c.save(); c.lineCap = 'round';
  const grad = c.createLinearGradient(X0, Y0, ex, ey); grad.addColorStop(0, 'rgba(255,255,255,0)'); grad.addColorStop(1, col);
  c.globalAlpha = 0.8 * (1 - Math.max(0, u - 0.7) / 0.3);
  c.beginPath(); c.moveTo(X0, Y0); c.lineTo(ex, ey); c.lineWidth = 7; c.strokeStyle = grad; c.stroke();
  c.beginPath(); c.arc(ex, ey, 9, 0, Math.PI * 2); c.fillStyle = col; c.fill(); c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,.85)'; c.stroke();
  c.restore();
}
// One frame of the wall as it is now (from the last render's state and the move's clock); true when another is wanted.
function bullsFrame(c, G, now) {
  const Pal = runColours(), mini = src.mini, f = src.f, g = f ? f.bull : null, col = { X: Pal.X, O: Pal.O }, cfg = cfgOf(mini), k = G.k;
  const at = f ? fxAt('move', f) : null, t = at == null ? null : now - at, pre = f ? bullsPre(f) : 0, P = g ? bullsPlan(pre) : null;
  const X = x => G.ox + x * k, Y = y => G.oy + y * k;
  let more = false, fly = null, flyBy = null;
  const hitT = g && t != null && !REDUCED ? t - P.hit : null;
  c.clearRect(0, 0, G.W, G.H);
  drawScene(c, G, cfg, Pal, g && g.zone === 'bull' && hitT != null && hitT >= 0 && hitT < 420 ? Math.abs(Math.sin(hitT / 420 * Math.PI * 2)) * (1 - hitT / 420) : 0);
  const all = dartsOf(mini), first = (mini.n || all.length) - all.length + 1;   // (each dart's number: the flash's own is the one in flight)
  const stuck = (p, x, y, wob) => {                              // a dart in the wall, its shadow beside it
    const d = stuckDir(x, y), L = dartLen(1) * k, dir = wob ? [d[0] * Math.cos(wob) - d[1] * Math.sin(wob), d[0] * Math.sin(wob) + d[1] * Math.cos(wob)] : d;
    drawDart(c, X(x) + 1.1 * k, Y(y) + 1.7 * k, dir, L, null, null, true, 0.26);
    drawDart(c, X(x), Y(y), dir, L, col[p], Pal.ink);
  };
  all.forEach(([p, x, y], i) => { if (!g || first + i < g.k) stuck(p, x, y); });
  if (g && (REDUCED || t == null)) stuck(f.by, g.x, g.y);                                    // (reduced motion, or the result held: the throw's end)
  else if (g) {
    const start = launch && launch.sq === src.zoom && launch.p === f.by && at - launch.at < 8000 && at > launch.at ? launchPos(launch, at - launch.at) : null;
    fly = dartAt(g, P, t, start); fly.start = start; flyBy = f.by;
    more = t < P.end + 80;
  } else if (src.pend && launch) {
    const p = launchPos(launch, now - launch.at), [tx, ty] = bullsPoint(launch.aim, launch.power);
    fly = { x: p[0], y: p[1], w: p[2], dir: unit(tx - HAND[0], ty - HAND[1]) }; flyBy = launch.p; more = true;
  } else if (!src.view && !src.done) {
    const pop = popAt && now - popAt < POP_MS ? Math.sin(Math.PI * (now - popAt) / POP_MS) * 0.12 : 0;   // back in the hand: a small pop
    let dir = [0, -1];
    if (drag && src.mine && drag.pts.length > 1) {                 // the finger on its way: the dart in the hand turns to point where the swipe points (the throw's own line: bullsFlick)
      const q = drag.pts[drag.pts.length - 1], dx = q[1] - drag.x0, dy = drag.y0 - q[2];
      if (dy >= 8 && Math.abs(dx) <= dy * 1.8) { const th = Math.max(-BULLS.angle, Math.min(BULLS.angle, Math.atan2(dx * (tune(mini).angleGain || 1), dy))); dir = [Math.sin(th), -Math.cos(th)]; }
    }
    fly = { x: HAND[0], y: HAND[1], w: 0, dir, pop }; flyBy = src.turn; more = pop > 0;
  }
  if (fly && fly.stuck) stuck(flyBy, fly.x, fly.y, fly.wob);
  else if (fly) {
    const L = dartLen(fly.w) * k * (1 + (fly.pop || 0)), far = 1 - fly.w;
    if (fly.w > 0.12) drawDart(c, X(fly.x) + (1.1 + 5 * far) * k, Y(fly.y) + (1.7 + 8 * far) * k, fly.dir, L * (1 - 0.25 * far), null, null, true, 0.08 + 0.18 * fly.w * fly.w);   // its shadow on the wall: nearer and darker as it comes in
    if (g && t != null && t > P.pre && t < P.hit) for (const [back, al] of [[52, 0.1], [26, 0.22]]) {   // in flight: two faint darts behind it, where it just was
      const q = dartAt(g, P, Math.max(P.pre, t - back), fly.start);
      drawDart(c, X(q.x), Y(q.y), q.dir, dartLen(q.w) * k, col[flyBy], Pal.ink, false, al);
    }
    drawDart(c, X(fly.x), Y(fly.y), fly.dir, L, col[flyBy], Pal.ink);
  }
  if (g && hitT != null && hitT >= 0 && hitT < RING_MS) drawBurst(c, G, g, hitT / RING_MS, Pal);
  if (g && t != null && pre && t < pre) drawFlick(c, G, g.aim, g.power, clamp01(t / (pre * 0.85)), col[f.by]);   // someone else's flick, before their dart flies
  else if (!g && bullRep && bullRep.sq === src.zoom && now - bullRep.at < 4000) { drawFlick(c, G, bullRep.aim, bullRep.power, clamp01((now - bullRep.at) / (BULLT.pre * 0.85)), col[bullRep.p]); more = more || now - bullRep.at < BULLT.pre; }
  return more;
}
// After every render of the square (and every frame while a throw plays): the wall as it is now.
export function bullsPaint(now) {
  raf = 0;
  const cv = app.querySelector('canvas[data-bulls="cv"]');
  if (!cv || typeof cv.getContext !== 'function' || !src) return;
  const f = src.f;
  if (f) { lastF = f; popAt = 0; }
  else if (lastF) { lastF = null; if (src.mine && !REDUCED) popAt = now; }   // the result cleared, a dart back in the hand
  if (f && launch && launch.p === f.by && launch.sq === src.zoom) launch.flown = true;   // (the flight took over from the drift)
  else if (!f && launch && (launch.flown || now - launch.at > 8000)) launch = null;
  if (bullRep && f && f.by === bullRep.p && f.square === bullRep.sq) bullRep.flown = true;   // (the flick the shared replay pressed: its throw is playing, no streak before it)
  else if (bullRep && !f && (bullRep.flown || now - bullRep.at > 6000 || bullRep.sq !== src.zoom)) bullRep = null;
  const { c, W, H } = runCanvas(cv);
  if (W < 2 || H < 2) return;
  if (bullsFrame(c, bullsGeom(W, H), now)) raf = requestAnimationFrame(bullsPaint);
}

// ---- the miniature ----
// The board itself, small (its surround, the two rings, the bullseye), with the darts in it as dots in their
// players' colours, and beside it each player's points (the goal in the label: a "/7" beside them would be too small).
export function miniature(mini, final) {
  const c = cfgOf(mini), pts = mini.pts || { X: 0, O: 0 }, goal = tune(mini).goal, s = 24 / c.board;
  const dots = dartsOf(mini).filter(([, x, y]) => Math.hypot(x - AT[0], y - AT[1]) <= c.board * 1.25).map(([p, x, y]) => `<circle class="tbd ${p}" cx="${(30 + (x - AT[0]) * s).toFixed(1)}" cy="${(30 + (y - AT[1]) * s).toFixed(1)}" r="3.4"/>`).join('');
  return `<div class="tbull" aria-label="Bullseye: X ${pts.X}, O ${pts.O} of ${goal} points"><svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="28" class="tbs"/><circle cx="30" cy="30" r="24" class="tbo"/><circle cx="30" cy="30" r="${(c.mid * s).toFixed(1)}" class="tbb"/><circle cx="30" cy="30" r="${Math.max(3.5, c.bull * s).toFixed(1)}" class="tbu"/>${dots}</svg>`
    + `<div class="tbpts">${['X', 'O'].map(p => `<div class="tr ${p}"><b class="${p}">${p}</b><span>${Math.min(goal, pts[p])}</span></div>`).join('')}</div></div>`;
}
// The board's rings (config/bulls, the admin's dashboard): fetched at every start and kept for the next visit.
const BULLS_KEY = KEY + '.bullscfg';
export function fetchBullsConfig() {
  try { const v = JSON.parse(localStorage.getItem(BULLS_KEY) || 'null'); if (v && typeof v === 'object') setBullsConfig(v); } catch (e) { /* none kept */ }
  if (!configured()) return;
  const hook = window.TTT_FIREBASE, c = (hook && hook.config) || FIREBASE_CONFIG;
  const url = hook && hook.emulator ? `http://${hook.emulator.host}:${hook.emulator.port}/config/bulls.json?ns=${c.projectId}-default-rtdb` : `${c.databaseURL}/config/bulls.json`;
  try {
    fetch(url).then(r => (r.ok ? r.json() : null)).then(v => {
      if (!v || typeof v !== 'object') return;
      setBullsConfig(v);
      try { localStorage.setItem(BULLS_KEY, JSON.stringify(v)); } catch (e) { /* no storage: read again next visit */ }
    }).catch(() => {});
  } catch (e) { /* offline: as last known */ }
}

// Its listeners: main.js calls this once, in the page's original order of listeners.
export function init() {
  // Bullseye: a flick up from anywhere on the game area (the wall and the line under it), not only the dart. The
  // swipe's direction aims, its speed sets the height; while it is under way the dart in the hand turns to point
  // along it, and nothing else is drawn (no aim line, no target). Letting go throws at once, as does the finger leaving the wall's top; a short or sideways swipe is nothing.
  app.addEventListener('pointerdown', e => {
    const area = e.target.closest && e.target.closest('.bulls.live[data-bulls="area"]');
    if (!area || drag || state.screen !== 'mini' || state.flash || state.done || blocked() || launchOn(state.zoom)) return;
    ownPress();
    const now = performance.now();
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, area, pts: [[now, e.clientX, e.clientY]] };
    try { area.setPointerCapture(e.pointerId); } catch (err) { /* no capture: the move and up still reach the page */ }
    e.preventDefault();
  });
  app.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag, now = performance.now();
    d.pts.push([now, e.clientX, e.clientY]);
    while (d.pts.length > 2 && now - d.pts[1][0] > 160) d.pts.shift();   // (the oldest sample kept is the last one at least 80 ms back: bullsRead)
    schedulePaint();                                                   // (the dart in the hand turns with the finger)
    const cv = d.area.querySelector('canvas'), r = cv && cv.getBoundingClientRect ? cv.getBoundingClientRect() : null;
    if (r && (e.clientY < r.top || e.clientX < r.left - 8 || e.clientX > r.right + 8)) bullsRelease(e);   // the finger leaves the wall: the throw goes
  });
  app.addEventListener('pointerup', bullsRelease);
  app.addEventListener('pointercancel', e => { if (drag && e.pointerId === drag.id) { drag = null; schedulePaint(); } });
}
