// Bullseye: the screen, the miniature, the move's words and sounds, and the inputs.
import { r3 } from '../../core/util.js';
import { BULLS, BULLT, bullsAim, bullsConfig, bullsGeom, bullsPeriod, bullsPeriodY, bullsPlan, bullsPoint, bullsWave, setBullsConfig } from './rules.js';
import { tune } from '../../core/tune.js';
import { SND, ownPress } from '../../audio/sound.js';
import { FIREBASE_CONFIG, configured } from '../../net/connect.js';
import { attemptMove } from '../../net/moves.js';
import { haptic } from '../../net/platform.js';
import { blocked, moveWait } from '../../net/room.js';
import { N, REDUCED, app, cpuPlays, state, waitLine } from '../../ui/app.js';
import { KEY } from '../../ui/config.js';
import { fx, fxAt } from '../../ui/fx.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { render } from '../../ui/render.js';
import { runCanvas, runColours } from '../../ui/runner.js';

// Bullseye (the dartboard on its wall, drawn on a canvas: rules.js bullsGeom, the wall face on, the floor under it,
// the dart in the hand at this end, big and near; the aim is two taps again, November 2026): a vertical line sweeps
// left and right across the wall, a tap stops it (the first), then a horizontal line sweeps up and down, a tap
// stops it (the second, or the Stop / Throw! button under the wall); the dart flies to where they cross and lands
// there, exactly. The sweeps are the game's own timing, in real time from the square opening and from the first
// tap (bullsWave: back and forth, a period each way, the thrower's own: it shortens with every scoring throw of
// theirs, rules.js); a tap reads where the line is that instant, from the same clock the drawing uses. The throw
// plays from the move's event (fxAt('move'): never from a redraw): the lines fade, the dart flies a shallow arc,
// shrinking as it goes away towards the wall and turning to point at it, its shadow on the wall closing in and
// darkening as it nears; it sticks with a thunk and quivers, a ring bursting from where it hit (a bullseye: a gold
// star burst, the bull flashing), and the thrower's points count on at that moment. Every dart thrown stays where
// it landed, its flights in its player's colour. Someone else's throw shows their two taps first (bullsPre: their
// lines sweep from the edges and stop where they stopped, bullsAim, the button reading Stop then Throw!).
// Online, this phone's own dart leaves the hand at once and drifts out along its aim until the server's record
// lands (where it lands is known: the lines' crossing; the points are the server's); the flight goes on from
// there. The result's words go in the reserved line under the wall, never over it.
const HAND = BULLS.hand, AT = BULLS.at, LAUNCH_MS = 220, POP_MS = 260, RING_MS = 380, WOB = { ms: BULLT.stick, a: 0.3, per: 85 };
const LEN = 22, DEPTH = 0.7;                   // the dart's length in the hand (wall units), and how much smaller it is at the wall: 1 / (1 + DEPTH)
export const bullsWord = g => (g.zone === 'bull' ? `BULLSEYE! +${g.pts}` : g.zone === 'mid' ? `Inner ring +${g.pts}` : g.zone === 'board' ? `Outer ring +${g.pts}` : 'Missed');
let aim = null;                                // this phone's two taps: { key, t0 (the first line began), stage (1: the sideways line sweeps, 2: the up-down one, 3: thrown), x (where the first stopped), t1 (the second began), y }
let launch = null;                             // this phone's throw let go online, before the server's record: { sq, p, at, fx, fy }
let src = null;                                // what the last render drew: { mini, f, turn, view, zoom, mine, pend, done, key, per, perY }
let raf = 0, lastF = null, popAt = 0;
const cfgOf = mini => (mini && mini.v === 3 && mini.cfg && mini.cfg.mid ? mini.cfg : bullsConfig());   // (a square from before, not yet thrown at: the board of the day)
const dartsOf = mini => (mini && mini.v === 3 && Array.isArray(mini.darts) ? mini.darts : []);
const flashOf = a => (a && a.bull && Number.isFinite(a.bull.fx) ? a.bull : null);   // (a throw from before, in an old record: nothing to play)
// Someone else's throw (the computer's, the other phone's): their two taps show first (rules.js bullsAim: the
// lines sweep and stop as they did), then the dart flies (none for this phone's own, which it just made).
export function bullsPre(f) {
  if (!f || f.type !== 'bullseye' || !flashOf(f) || REDUCED) return 0;
  const other = f.timeout || (state.online ? f.by !== state.online.me : cpuPlays(f.by));
  return other ? bullsAim(f.bull).fly : 0;
}
const launchOn = zoom => !!launch && launch.sq === zoom && performance.now() - launch.at < 8000 && (!!moveWait || performance.now() - launch.at < 700);
function bullsTable(mini, a, o) {
  const g = flashOf(a), l = mini.last && mini.last.zone ? mini.last : null, turn = o.turn, goal = tune(mini).goal;
  const pre = g ? bullsPre(a) : 0, P = g ? bullsPlan(pre) : null, A = pre ? bullsAim(g) : null, still = REDUCED;
  const score = p => {                                           // the points: the thrower's count on as the dart lands, not before
    const now = Math.min(goal, (g ? g.total : mini.pts)[p] || 0), was = g && a.by === p ? Math.min(goal, Math.max(0, now - g.pts)) : now;
    return was !== now && !still ? `<span class="ppts"><span class="tu" style="--u:${P.hit}ms">${was}</span><span class="tf" style="--f:${P.hit}ms">${now}</span></span>` : `<span class="ppts"><span>${now}</span></span>`;
  };
  const tal = p => arcTally(p, o, `<span class="plkpts">${score(p)}<small>/${goal}</small></span>`);
  const pend = !g && launchOn(o.zoom), mine = !o.view && !g && !o.locked && !o.done && !pend;
  const key = `${o.zoom}:${mini.n || 0}:${turn}`;
  if (aim && (aim.key !== key || (!mine && !pend))) aim = null;     // (the square left, or the turn gone on: a new pair of lines next time)
  const per = Math.round(bullsPeriod(cfgOf(mini), (mini.speed && mini.speed[turn]) || 1));
  const res = g ? `<p ${lateAt('arcres ' + (g.pts ? 'ok' : 'no'), still ? null : P.hit)} role="status">${bullsWord(g)}</p>`
    : o.done && l ? `<p class="arcres ${l.pts ? 'ok' : 'no'}">${bullsWord(l)}</p>`
    : o.view ? `<p class="arcnote">${l ? `<b class="${l.by}">${N(l.by)}</b>: ${bullsWord(l)}` : ''}</p>`
    : `<p class="arcnote">${mine || pend ? '' : waitLine(turn)}</p>`;
  src = { mini, f: g ? a : null, turn, view: o.view, zoom: o.zoom, mine, pend, done: o.done, key, per, perY: bullsPeriodY(per) };
  const step2 = (aim && aim.key === key && aim.stage >= 2) || pend;
  const label = A ? `<span class="bswap"><span class="tu" style="--u:${A.t1}ms">Stop</span><span class="tf" style="--f:${A.t1}ms">Throw!</span></span>` : step2 ? 'Throw!' : 'Stop';   // someone else's throw: the button as theirs read
  const btn = o.view ? '' : `<div class="cbtns one"><button class="big ${g ? a.by : turn}" data-act="bulls"${mine ? '' : ' disabled'}>${label}</button></div>`;
  return `<div class="g-arc${mine ? ' bl-live' : ''}"><div class="ctals">${tal('X')}${tal('O')}</div><div class="bulls${mine ? ' live' : ''}" data-bulls="area"><canvas class="bdcv" data-bulls="cv" aria-label="The dartboard: ${N('X')} ${mini.pts.X}, ${N('O')} ${mini.pts.O} of ${goal}"></canvas>${res}</div>${btn}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = bullsTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d });
  schedulePaint();
  return g;
}
export function moveText(f, who) {
  const g = flashOf(f);
  return g ? `${who} threw: ${g.zone === 'bull' ? `a bullseye, +${g.pts}` : g.pts ? `the ${g.zone === 'mid' ? 'inner' : 'outer'} ring, +${g.pts}` : 'off the board'}` : `${who} threw`;
}
// The throw's sounds at its moments: someone else's two taps (a tick as each line stops), the dart's whoosh (this
// phone's own online throw played its own at the second tap: none here), then the dart in the board: the
// bullseye's deep thunk and its ring, a ring's thunk, or the wall's dull knock; and the quiver after it.
export function sounds(f, add, won, mini, last) {
  const g = flashOf(f), pre = bullsPre(f);
  if (!g) return;
  if (pre) { const A = bullsAim(g); add('mark', A.t1); add('mark', A.t2); }
  if (!(state.online && state.online.me && f.by === state.online.me)) add('dartThrow', pre);
  const P = bullsPlan(pre);
  add(g.zone === 'bull' ? 'dartBull' : g.pts ? 'dartHit' : 'dartMiss', P.hit);
  add('dartQuiver', P.hit + 40);
  if (g.zone === 'bull') add('sparkle', P.hit + 140);
}

// ---- the two taps ----
// Where the lines are this instant (the first still sweeping, or stopped, and the second sweeping): wall fractions, from this
// phone's own clock (the one the drawing reads): the sideways line from the square opening (or the moment it was
// first drawn, when the opening is long past), the up-down one from the first tap.
function bullsLines(now) {
  if (!aim || !src || aim.key !== src.key) return null;
  if (aim.stage === 1) return { x: bullsWave(now - aim.t0, src.per), y: null };
  return { x: aim.x, y: aim.stage === 2 ? bullsWave(now - aim.t1, src.perY) : aim.y };
}
// A tap (the press itself, on the wall, the button or anywhere on the game area): the first stops the sideways line, the second the up-down one and throws.
function bullsTap() {
  const sq = state.squares && state.squares[state.zoom];
  if (!sq || sq.mini.type !== 'bullseye' || sq.owner || state.flash || state.done || blocked() || !src || !src.mine) return false;
  const now = performance.now();
  if (!aim || aim.key !== src.key) aim = { key: src.key, t0: now, stage: 1 };
  if (aim.stage === 1) {
    aim.x = r3(bullsWave(now - aim.t0, src.per)); aim.stage = 2; aim.t1 = now;
    SND.play('mark'); haptic('tap');
    render();                                                      // (the button reads Throw! now)
    return true;
  }
  if (aim.stage !== 2) return false;
  aim.y = r3(bullsWave(now - aim.t1, src.perY)); aim.stage = 3;
  const move = { x: aim.x, y: aim.y };
  launch = { sq: state.zoom, p: state.turn, at: now, fx: move.x, fy: move.y };
  if (state.online) SND.play('dartThrow');                         // (the whoosh at the tap itself: the server's record, and the flight's sounds, come after)
  attemptMove(move);
  if (!state.online) launch = null;                                // (here, the move played at once: the flight is the flash's, from this same frame)
  bullsPaint(now);                                                 // the dart leaves on this frame
  return true;
}

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
  const [tx, ty] = bullsPoint(l.fx, l.fy), u = clamp01(dt / LAUNCH_MS), w = 0.14 * Math.sin(Math.PI / 2 * u) + Math.min(0.1, Math.max(0, dt - LAUNCH_MS) * 0.00006);
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
// The two aiming lines on the wall (ln: x, y wall fractions, null: not yet; setX, setY: stopped; col: the thrower's
// colour; al: its opacity): a sweeping one solid, a stopped one dashed, a ring where they cross.
function drawLines(c, G, ln, col, Pal, al) {
  const k = G.k, X = x => G.ox + x * k, Y = y => G.oy + y * k, wx = ln.x == null ? null : X(ln.x * BULLS.w), wy = ln.y == null ? null : Y(ln.y * BULLS.wall), top = Y(0), bot = Y(BULLS.wall), left = X(0), right = X(BULLS.w);
  const line = (x0, y0, x1, y1, set) => {
    c.save(); c.lineCap = 'round'; c.globalAlpha = al * (set ? 0.85 : 1);
    if (set) c.setLineDash([k * 2.4, k * 1.5]);
    c.strokeStyle = Pal.ink; c.lineWidth = Math.max(3.4, 1.05 * k) + 2.2; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    c.strokeStyle = col; c.lineWidth = Math.max(3.4, 1.05 * k); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    c.setLineDash([]); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = Math.max(1, 0.3 * k); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    c.restore();
  };
  if (wx != null) line(wx, top, wx, bot, ln.setX);
  if (wy != null) line(left, wy, right, wy, ln.setY);
  if (wx != null && wy != null) {                                  // where the dart will land
    c.save(); c.globalAlpha = al;
    c.beginPath(); c.arc(wx, wy, 2.6 * k, 0, Math.PI * 2); c.lineWidth = Math.max(2.6, 0.9 * k) + 2; c.strokeStyle = Pal.ink; c.stroke();
    c.lineWidth = Math.max(2.6, 0.9 * k); c.strokeStyle = '#fff'; c.stroke();
    c.beginPath(); c.arc(wx, wy, Math.max(1.6, 0.55 * k), 0, Math.PI * 2); c.fillStyle = col; c.fill(); c.lineWidth = 1.4; c.strokeStyle = Pal.ink; c.stroke();
    c.restore();
  }
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
  let lines = null, linesBy = null, al = 1;
  if (g && (REDUCED || t == null)) stuck(f.by, g.x, g.y);                                    // (reduced motion, or the result held: the throw's end)
  else if (g) {
    const start = launch && launch.sq === src.zoom && launch.p === f.by && at - launch.at < 8000 && at > launch.at ? launchPos(launch, at - launch.at) : null;
    fly = dartAt(g, P, t, start); fly.start = start; flyBy = f.by;
    more = t < P.end + 80;
    if (t < P.hit) {                                             // the two lines of the throw: swept to their stops (someone else's), held, and fading as the dart flies
      linesBy = f.by;
      if (t < pre) {
        const A = bullsAim(g), hy = t - A.h0;
        lines = t < A.t1 ? { x: Math.min(A.vx.it, t / A.per), y: null }
          : { x: g.fx, y: hy > 0 ? Math.min(A.vy.it, hy / A.perY) : null, setX: true, setY: hy >= A.vy.ms };
      } else { lines = { x: g.fx, y: g.fy, setX: true, setY: true }; al = 1 - clamp01((t - P.pre) / BULLT.fly); }
    }
  } else if (src.pend && launch) {
    const p = launchPos(launch, now - launch.at), [tx, ty] = bullsPoint(launch.fx, launch.fy);
    fly = { x: p[0], y: p[1], w: p[2], dir: unit(tx - HAND[0], ty - HAND[1]) }; flyBy = launch.p; more = true;
    lines = { x: launch.fx, y: launch.fy, setX: true, setY: true }; linesBy = launch.p; al = 1 - clamp01((now - launch.at) / 900);
  } else if (src.mine) {
    const ln = bullsLines(now) || (() => { aim = { key: src.key, t0: (fx.enter && now - fx.enter.at < 600 ? fx.enter.at : now), stage: 1 }; return bullsLines(now); })();
    lines = { x: ln.x, y: ln.y, setX: aim.stage >= 2, setY: aim.stage >= 3 }; linesBy = src.turn; more = true;
    const pop = popAt && now - popAt < POP_MS ? Math.sin(Math.PI * (now - popAt) / POP_MS) * 0.12 : 0;   // back in the hand: a small pop
    const tx = ln.x * BULLS.w, ty = ln.y == null ? 22 : ln.y * BULLS.wall;
    fly = { x: HAND[0], y: HAND[1], w: 0, dir: unit(tx - HAND[0], ty - HAND[1]), pop };          // the dart in the hand points at where the lines now cross
    flyBy = src.turn;
  } else if (!src.view && !src.done) {
    fly = { x: HAND[0], y: HAND[1], w: 0, dir: [0, -1], pop: 0 }; flyBy = src.turn;
  }
  if (lines) drawLines(c, G, lines, col[linesBy], Pal, al);
  if (fly && fly.stuck) stuck(flyBy, fly.x, fly.y, fly.wob);
  else if (fly) {
    const L = dartLen(fly.w) * k * (1 + (fly.pop || 0)), far = 1 - fly.w;
    if (fly.w > 0.12) drawDart(c, X(fly.x) + (1.1 + 5 * far) * k, Y(fly.y) + (1.7 + 8 * far) * k, fly.dir, L * (1 - 0.25 * far), null, null, true, 0.08 + 0.18 * fly.w * fly.w);   // its shadow on the wall: nearer and darker as it comes in
    if (g && t != null && t > P.pre && t < P.hit) for (const [back, al2] of [[52, 0.1], [26, 0.22]]) {   // in flight: two faint darts behind it, where it just was
      const q = dartAt(g, P, Math.max(P.pre, t - back), fly.start);
      drawDart(c, X(q.x), Y(q.y), q.dir, dartLen(q.w) * k, col[flyBy], Pal.ink, false, al2);
    }
    drawDart(c, X(fly.x), Y(fly.y), fly.dir, L, col[flyBy], Pal.ink);
  }
  if (g && hitT != null && hitT >= 0 && hitT < RING_MS) drawBurst(c, G, g, hitT / RING_MS, Pal);
  return more;
}
// After every render of the square (and every frame while the lines sweep or a throw plays): the wall as it is now.
export function bullsPaint(now) {
  raf = 0;
  const cv = app.querySelector('canvas[data-bulls="cv"]');
  if (!cv || typeof cv.getContext !== 'function' || !src) return;
  const f = src.f;
  if (f) { lastF = f; popAt = 0; }
  else if (lastF) { lastF = null; if (src.mine && !REDUCED) popAt = now; }   // the result cleared, a dart back in the hand
  if (f && launch && launch.p === f.by && launch.sq === src.zoom) launch.flown = true;   // (the flight took over from the drift)
  else if (!f && launch && (launch.flown || now - launch.at > 8000)) launch = null;
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

// Its own controls (data-act): the taps come from the press itself (pointerdown, bullsTap); the click after it does nothing.
export const actions = { bulls: () => {} };

// Its listeners: main.js calls this once, in the page's original order of listeners.
export function init() {
  // Bullseye: a tap anywhere on the game area (the wall, the line under it, the button), from the press itself: the
  // first stops the sideways line, the second the up-down one and throws.
  app.addEventListener('pointerdown', e => {
    const t = e.target.closest && e.target.closest('.g-arc.bl-live, button[data-act="bulls"]:not(:disabled)');
    if (!t || state.screen !== 'mini') return;
    e.preventDefault(); ownPress();
    bullsTap();
  });
}
