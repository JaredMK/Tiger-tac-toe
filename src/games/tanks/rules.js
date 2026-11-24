// Tank Duel: the rules (pure: no page, no clock; the server runs the same code).
// One field for both players, 100 columns across (TANK.w), its ground a height map: one whole-number height a column
// (`h`, a string, a character a column: tankHeights / tankPack). X's tank stands in the left third and O's in the
// right third (`at[p]`, a column; a tank always stands on the ground of its column), each with `hp[p]` health. A wind
// blows across the field, one whole number for the square (`wind`, positive to the right), always on show.
// A move is the whole turn, `{ d, a, p }`: drive `d` columns first (a signed whole number, at most `fuel` either way:
// the tank stops at a step too steep to climb, at the field's edge and before the other tank: tankDrive), then fire at
// the angle `a` (whole degrees, 0 flat to the right, 90 straight up, 180 flat to the left) with the power `p` (a whole
// number, TANK.pmin to TANK.pmax: that share of the full `speed`). The shell flies in fixed steps (TANK.hz a second) of
// plain arithmetic alone (+, -, *, / and sqrt; the angle through dsin/dcos below, never Math.sin: the same to the last
// bit on every phone and the server, as Pinball's ball), pulled down by `gravity` and pushed sideways by the wind, until
// it meets a tank (a direct hit), the ground, or leaves the field at a side (tankFly). Where it lands it blows a round
// bite of radius `crater` out of the ground (tankCarve; the tanks settle onto the ground under them) and every tank
// within `blast` of it is damaged by how near its hull is (tankDamage: a direct hit `hitDmg`, a blast beside the hull
// `splash` per cent of that, falling off to nothing at the blast's edge; the shooter's own tank too). A tank at no
// health is knocked out: the other player takes the square; both at once is a draw (the square resets). "Go again on
// success" (off by default): a direct hit on the other tank keeps the turn.
// Nothing is hidden and nothing in a move is drawn by chance: the move shows at once online (net/moves.js predictable).
// `sh[p]` is p's last shot (its column and ground, angle, power, steps flown and the other tank's column then): the
// trail the view keeps on the field, and what the Hard computer ranges in by. `last` the move just made, with the
// ground as it was (`h0`): the view plays the drive, the flight, the blast and the damage from it.
import { needRng, randInt } from '../../core/random.js';
import { goAgain, tune, tuneLive } from '../../core/tune.js';
import { other } from '../../core/util.js';

// (w: the columns; top: the field's height as drawn; r, cy: a tank's hull, a circle this big, its middle this far above
// the ground; len: the barrel, from the hull's middle to where the shell starts; edge: the nearest a tank comes to a
// side; gap: the nearest the two tanks come; cap: the most steps a shell may fly; hmax: the tallest ground a column holds;
// windK: a point of wind's push, field units a second each second.)
export const TANK = { w: 100, top: 72, hz: 120, r: 3.4, cy: 2, len: 6, edge: 4, gap: 10, pmin: 10, pmax: 100, cap: 3600, hmax: 63, windK: 1 };
// The move's moments (ms; a base figure each): a column driven, the barrel swinging to its angle, the shell's flight
// (its real time over `rate`, never past `flyMax`), the blast, the damage's numbers rising, the result's hold.
export const TANKT = { col: 120, aim: 260, rate: 1.5, flyMin: 420, flyMax: 2600, boom: 520, dmg: 700, hold: 500 };
export const TANK_DEF = { health: 100, hitDmg: 40, splash: 70, blast: 9, crater: 5, fuel: 6, climb: 3, windMin: 0, windMax: 8, gravity: 30, speed: 60, hills: 100,
  aiAng: 3.5, aiPow: 5, aiAngHard: 3.5, aiPowHard: 5, aiAngEasy: 5, aiPowEasy: 7, aiRange: 85 };
export function tankCfg(mini) {
  const t = Object.assign({}, TANK_DEF, tune(mini));
  return { health: t.health, hitDmg: t.hitDmg, splash: t.splash, blast: t.blast, crater: t.crater, fuel: t.fuel, climb: t.climb, gravity: t.gravity, speed: t.speed, lo: Math.min(t.windMin, t.windMax), hi: Math.max(t.windMin, t.windMax), hills: t.hills,
    ai: { easy: [t.aiAngEasy, t.aiPowEasy], normal: [t.aiAng, t.aiPow], hard: [t.aiAngHard, t.aiPowHard] }, range: t.aiRange, t };
}
// Sine and cosine by arithmetic alone (the same to the last bit on every engine; shared/physics-sim.js keeps the same
// pair inside its factory): the angle brought within a quarter turn, then the series.
export const dsin = a0 => {
  const TAU = 6.283185307179586, PI = 3.141592653589793;
  let a = a0 - TAU * Math.floor((a0 + PI) / TAU);
  if (a > PI / 2) a = PI - a; else if (a < -PI / 2) a = -PI - a;
  const x = a * a;
  return a * (1 - x / 6 * (1 - x / 20 * (1 - x / 42 * (1 - x / 72 * (1 - x / 110 * (1 - x / 156 * (1 - x / 210)))))));
};
export const dcos = a => dsin(a + 1.5707963267948966);
const DEG = 0.017453292519943295, r1 = v => Math.round(v * 10) / 10 + 0;

// ---- the ground: a character a column ----
const A64 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_', IDX = {}; for (let k = 0; k < 64; k++) IDX[A64[k]] = k;
export const tankPack = H => { let s = ''; for (let i = 0; i < H.length; i++) s += A64[H[i] < 0 ? 0 : H[i] > TANK.hmax ? TANK.hmax : H[i] | 0]; return s; };
export function tankHeights(s) { const n = TANK.w, H = new Array(n), str = typeof s === 'string' ? s : ''; for (let i = 0; i < n; i++) H[i] = IDX[str[i]] || 0; return H; }
// The deal's hills: three waves from the rng (a long one, a middling one, a ripple), turned round half the time, so
// neither side is favoured; then each tank's column, the ground tilted until the two stand within TILT of each
// other's height, a level pad under each tank, and no step anywhere steeper than a tank climbs (2 a column at most:
// `ease`, worked outwards from each pad, so a tank can always drive off the spot it was dealt).
const TILT = 4;
function ease(H, x, o, lim) {
  const pad = i => Math.abs(i - x) <= 2 || Math.abs(i - o) <= 2, to = (i, j) => { if (!pad(i)) H[i] = Math.max(H[j] - lim, Math.min(H[j] + lim, H[i])); };
  for (let pass = 0; pass < 6; pass++) {
    for (let i = x - 3; i >= 0; i--) to(i, i + 1);
    for (let i = x + 3; i < o - 2; i++) to(i, i - 1);
    for (let i = o - 3; i > x + 2; i--) to(i, i + 1);
    for (let i = o + 3; i < H.length; i++) to(i, i - 1);
    let ok = true; for (let i = 1; i < H.length && ok; i++) ok = Math.abs(H[i] - H[i - 1]) <= lim;
    if (ok) break;
  }
}
function deal(c, r) {
  const W = TANK.w, k = c.hills / 100, TAU = 6.283185307179586, base = 20 + 6 * r();
  const waves = [[0.6 + 0.8 * r(), 5 + 6 * r(), r()], [1.8 + 1.4 * r(), 2 + 3 * r(), r()], [4 + 3 * r(), 0.5 + r(), r()]];
  let H = []; for (let i = 0; i < W; i++) { let v = base; for (const [f, a, ph] of waves) v += a * k * dsin(TAU * (f * i / W + ph)); H.push(v); }
  if (r() < 0.5) H.reverse();
  const x = 10 + randInt(r, 16), o = W - 1 - (10 + randInt(r, 16)), diff = H[o] - H[x], over = diff - Math.max(-TILT, Math.min(TILT, diff)), mid = (x + o) / 2;
  H = H.map((v, i) => Math.max(4, Math.min(46, Math.round(v - over * (i - mid) / (o - x)))));
  for (const at of [x, o]) for (let d = -2; d <= 2; d++) H[at + d] = H[at];
  ease(H, x, o, Math.max(1, Math.min(2, c.climb)));
  return { H, x, o };
}
export function create(type, rng) {
  const t = Object.assign({}, TANK_DEF, tuneLive(type)), r = needRng(rng), lo = Math.min(t.windMin, t.windMax), hi = Math.max(t.windMin, t.windMax);
  const g = deal(t, r), w = lo + randInt(r, hi - lo + 1), wind = (w ? w * (r() < 0.5 ? -1 : 1) : 0) + 0;
  return { type, v: 1, h: tankPack(g.H), at: { X: g.x, O: g.o }, hp: { X: t.health, O: t.health }, wind, n: { X: 0, O: 0 }, sh: {}, last: null };
}

// ---- the drive ----
// Where a tank at `from` ends after driving `d` columns (H the ground, `oc` the other tank's column): column by
// column, stopping before a step up of more than `climb`, the field's edge, or the other tank.
export function tankDrive(H, c, from, d, oc) {
  const s = d < 0 ? -1 : 1; let at = from;
  for (let k = Math.abs(d); k > 0; k--) { const nx = at + s; if (nx < TANK.edge || nx > TANK.w - 1 - TANK.edge || Math.abs(nx - oc) < TANK.gap || H[nx] - H[at] > c.climb) break; at = nx; }
  return at;
}
// ---- the shot ----
// A shell fired from the tank on column `col` (its ground `gy`) at angle `a` and power `p`, over the ground H in the
// wind, the tanks at `tk` ({ X: [column, ground], O: ... }): { hit: 'X' | 'O' (a direct hit), 'ground' or 'out', x, y
// where, n the steps flown }. With `path`, every `every`th step's place is pushed onto it ([x, y]).
export function tankFly(H, c, wind, col, gy, a, p, tk, path, every) {
  const W = TANK.w, dt = 1 / TANK.hz, ca = dcos(a * DEG), sa = dsin(a * DEG), v = c.speed * p / 100, ax = wind * TANK.windK * dt, ay = c.gravity * dt, rr = TANK.r * TANK.r;
  const xX = tk.X[0], yX = tk.X[1] + TANK.cy, xO = tk.O[0], yO = tk.O[1] + TANK.cy, ev = every || 1;
  let x = col + TANK.len * ca, y = gy + TANK.cy + TANK.len * sa, vx = v * ca, vy = v * sa, n = 0;
  for (; n <= TANK.cap; n++) {
    if (path && n % ev === 0) path.push([x, y]);
    if (x < -0.5 || x >= W - 0.5) return { hit: 'out', x, y, n };
    let dx = x - xX, dy = y - yX; if (dx * dx + dy * dy <= rr) return { hit: 'X', x, y, n };
    dx = x - xO; dy = y - yO; if (dx * dx + dy * dy <= rr) return { hit: 'O', x, y, n };
    if (y <= H[Math.floor(x + 0.5)]) return { hit: 'ground', x, y, n };
    vx += ax; vy -= ay; x += vx * dt; y += vy * dt;
  }
  return { hit: 'out', x, y, n: TANK.cap };
}
// The trail of a shot already made (sh[p], or a move's own): its places every `every`th step, n steps long.
export function tankTrail(c, wind, col, gy, a, p, n, every) {
  const dt = 1 / TANK.hz, ca = dcos(a * DEG), sa = dsin(a * DEG), v = c.speed * p / 100, ax = wind * TANK.windK * dt, ay = c.gravity * dt, out = [], ev = every || 1;
  let x = col + TANK.len * ca, y = gy + TANK.cy + TANK.len * sa, vx = v * ca, vy = v * sa;
  for (let k = 0; k <= n; k++) { if (k % ev === 0 || k === n) out.push([x, y]); vx += ax; vy -= ay; x += vx * dt; y += vy * dt; }
  return out;
}
// The ground after a blast at (x, y): a round bite of radius R out of it. A column under the bite's top is cut down to
// the bite's floor; one that stood over the bite (a cliff beside it) drops by the bite's height there.
export function tankCarve(H, x, y, R) {
  const out = H.slice();
  for (let i = Math.max(0, Math.ceil(x - R)); i <= Math.min(H.length - 1, Math.floor(x + R)); i++) {
    const dx = i - x, b2 = R * R - dx * dx; if (b2 <= 0) continue;
    const b = Math.sqrt(b2), bot = y - b, top = y + b;
    if (H[i] <= bot) continue;
    out[i] = Math.max(0, H[i] <= top ? Math.round(bot) : H[i] - Math.round(2 * b));
    if (out[i] > H[i]) out[i] = H[i];
  }
  return out;
}
// What a blast at (x, y) does to a tank on `col` whose ground is `gy`: by how far its hull is from it.
export function tankDamage(c, x, y, col, gy) {
  const dx = x - col, dy = y - (gy + TANK.cy), near = Math.max(0, Math.sqrt(dx * dx + dy * dy) - TANK.r);
  return near >= c.blast ? 0 : Math.max(0, Math.round(c.hitDmg * c.splash / 100 * (1 - near / c.blast)));
}
// A whole turn worked out without making it (the rules' own, and the computer's and the view's): where the drive
// ends, the flight, the ground after, each tank's damage.
export function tankTry(c, H, wind, at, p, m) {
  const o = other(p), to = tankDrive(H, c, at[p], m.d, at[o]), tk = { [p]: [to, H[to]], [o]: [at[o], H[at[o]]] };
  const f = tankFly(H, c, wind, to, H[to], m.a, m.p, tk), x = r1(f.x), y = r1(f.y), dmg = { X: 0, O: 0 };
  let H2 = H;
  if (f.hit !== 'out') { for (const q of ['X', 'O']) dmg[q] = f.hit === q ? c.hitDmg : tankDamage(c, x, y, tk[q][0], tk[q][1]); H2 = tankCarve(H, x, y, c.crater); }
  return { to, hit: f.hit, x, y, n: f.n, dmg, H2 };
}
export const tankOk = (m, c) => !!m && typeof m === 'object' && !Array.isArray(m) && Object.keys(m).length === 3 && Number.isInteger(m.d) && Number.isInteger(m.a) && Number.isInteger(m.p)
  && Math.abs(m.d) <= c.fuel && m.a >= 0 && m.a <= 180 && m.p >= TANK.pmin && m.p <= TANK.pmax;
export function apply(mini, p, m, rng, idx) {
  const c = tankCfg(mini);
  if (!tankOk(m, c)) return { ok: false, reason: 'bad' };
  if (!(mini.hp.X > 0 && mini.hp.O > 0)) return { ok: false, reason: 'over' };
  const o = other(p), H = tankHeights(mini.h), from = mini.at[p], t = tankTry(c, H, mini.wind, mini.at, p, m), hp0 = [mini.hp.X, mini.hp.O];
  mini.at[p] = t.to;
  const h0 = mini.h; mini.h = tankPack(t.H2);
  for (const q of ['X', 'O']) mini.hp[q] = Math.max(0, mini.hp[q] - t.dmg[q]);
  if (!mini.sh) mini.sh = {};
  mini.sh[p] = [t.to, H[t.to], m.a, m.p, t.n, mini.at[o]];
  mini.n[p]++;
  mini.last = { by: p, d: m.d, from, to: t.to, a: m.a, p: m.p, hit: t.hit, x: t.x, y: t.y, n: t.n, dmg: [t.dmg.X, t.dmg.O], hp0, h0 };
  const outO = mini.hp[o] <= 0, outP = mini.hp[p] <= 0;
  if (outO && outP) return { ok: true, outcome: 'draw', note: 'tie' };
  if (outO) return { ok: true, outcome: 'win', note: 'won' };
  if (outP) return { ok: true, outcome: 'win', winner: o, note: 'gift' };
  if (t.hit === o && goAgain(mini)) return { ok: true, outcome: 'continue', again: true, note: 'hit' };
  return { ok: true, outcome: 'continue', note: t.hit === o ? 'hit' : t.dmg[o] > 0 ? 'near' : 'miss' };
}
// A timeout: nothing (a move is the whole turn: one not made is simply missed).
export function timeoutClose(mini, p) { return null; }
export function publicView(mini) { return JSON.parse(JSON.stringify(mini)); }
export function randomMove(mini, p, rng, from, empties) {        // (the tests' stand-in: a drive, and a lob towards the other tank)
  const r = needRng(rng), c = tankCfg(mini), el = 25 + randInt(r, 61), right = mini.at[other(p)] > mini.at[p];
  return { d: randInt(r, 2 * c.fuel + 1) - c.fuel, a: right ? el : 180 - el, p: 30 + randInt(r, 71) };
}
export function moveFlash(m, p, range, bjFrom, mini, flash) { flash.tk = Object.assign(JSON.parse(JSON.stringify(mini.last)), { wind: mini.wind, oc: mini.at[other(p)] }); }
// The move's moments (ms from the move): the drive, the barrel's swing, the shot (`fire`), the blast (`land`), its end.
export function tankTimes(s) {
  const T = TANKT, drive = Math.abs(s.to - s.from) * T.col, fire = drive + T.aim, fly = Math.max(T.flyMin, Math.min(T.flyMax, s.n / TANK.hz * 1000 / T.rate)), land = fire + fly;
  return { drive, fire, fly, land, end: land + (s.hit === 'out' ? 200 : T.boom + T.dmg) + T.hold };
}
export function flashMs(f, winLen, won) { return f.tk ? tankTimes(f.tk).end + (won ? 500 : 0) : 0; }
