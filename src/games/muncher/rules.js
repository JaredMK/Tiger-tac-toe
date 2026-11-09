// Muncher: the rules (pure: no page, no clock; the server runs the same code).
import { makeRng, needRng, randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';

// ---------- Muncher ----------
// A maze of 13 by 15 cells (version 2, November 2026; a square dealt before, with no `v`, keeps its 9 by 7 maze and
// plays on under these rules), dealt from a few symmetric layouts (LAYOUTS: '#' a wall, '.' an open cell with a dot,
// 'o' a power pellet, '=' a tunnel cell (open, no dot; the row's two ends join: a mover out of one side comes in at
// the other, the spooks slower there), 'P' the pen (the spooks' home, closed to the muncher), 'D' its door, 'C' the
// muncher's start). Each player's maze is their own: the dots they have eaten stay eaten for them (mini.ate[p]), the
// spooks they have eaten count for them (mini.gh[p], `ghostDots` dots each), and the other player eats from a full
// maze of the same layout. A move is one run, played on the player's phone in real time: Start puts the muncher at
// its start and the spooks in the pen, a swipe (an arrow key, a tap on a side) says which way to turn, taken at the
// next cell where it opens (a turn pressed early is kept; one pressed just before the corner cuts it), and the run
// ends when a spook touches it, when the time is up, when the target is reached, or when the maze is empty. The
// four spooks have their ways (SPOOKS): the chaser takes the shortest path to the muncher, the ambusher heads for a
// few cells ahead of it, the patroller keeps to its corner and gives chase when the muncher comes near, the wanderer
// turns any way at a junction; they alternate scatter (each to its own corner) and chase on a timetable, reverse at
// each change and never otherwise, and never step into a cell another spook is in or about to enter when they have
// a choice. A power pellet frightens them (slow, fleeing, blue) for a while; a frightened spook touched is eaten and
// goes home as a pair of eyes, waits in the pen and comes out again. The run is worked out in fixed steps of integer
// arithmetic (MUN.hz steps a second, positions in MUN.U units a cell), so the same inputs give the same run
// everywhere: the phone sends its inputs (the direction wanted, at the step it changed) with the result, and the
// server plays them through again and takes the result only when it is the same (munCheck). The spooks move by the
// rules and a seeded rng (the square's seed, the player and the run's number), so they are the same on every phone
// and on the server. The computer plays through the same steps with a hand of its own (munPilot), and every phone
// replays any run it did not play from its inputs. The first player to `target` dots takes the square.
export const MUN = { w: 13, h: 15, hz: 60, U: 600, hit: 320, corner: 220, eyes: 1.5, hold: 700, won: 600, maxSecs: 60, replayMax: 30000 };   // hit: a spook this close (in units) touches the muncher; corner: a turn pressed this close before a cell's centre cuts the corner; eyes: an eaten spook's speed (times the spooks'); hold: the end of a run shows this long (ms); replayMax: a longer run replays faster, in this long
export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // up, right, down, left
export const OPP = d => (d < 0 ? -1 : (d + 2) % 4);
export const SPOOKS = ['chaser', 'ambusher', 'patroller', 'wanderer'];   // in the order they leave the pen; each scatters to its own corner (top right, top left, bottom left, bottom right)
// The layouts (13 by 15, mirror-symmetric): every open cell reachable from every other, no dead ends, the pen in the
// middle with its door opening upwards, a tunnel row through the pen's row, a pellet in each corner.
export const LAYOUTS = [
  ['#############', '#o.........o#', '#.##.#.#.##.#', '#...........#', '#.##.....##.#', '#...#...#...#', '###.##D##.###', '==..#PPP#..==', '###.#####.###', '#...#...#...#', '#.##.....##.#', '#...........#', '#.##.###.##.#', '#o....C....o#', '#############'],
  ['#############', '#o....#....o#', '#.#.#...#.#.#', '#...........#', '###.#...#.###', '#...#...#...#', '#.#.##D##.#.#', '=.#.#PPP#.#.=', '#.#.#####.#.#', '#...#...#...#', '###.#...#.###', '#...........#', '#.##.###.##.#', '#o....C....o#', '#############'],
  ['#############', '#o.........o#', '#.###.#.###.#', '#.###...###.#', '#...........#', '#.#.##.##.#.#', '#.#.......#.#', '=.##.#D#.##.=', '#.##.PPP.##.#', '#.##.###.##.#', '#...........#', '#.###.#.###.#', '#.###...###.#', '#o....C....o#', '#############'],
  ['#############', '#o.........o#', '#.#.##.##.#.#', '#.#.......#.#', '#.###.#.###.#', '#...........#', '###.##D##.###', '==..#PPP#..==', '#.#.#####.#.#', '#.#.......#.#', '#.###...###.#', '#.....#.....#', '#.##.....##.#', '#o....C....o#', '#############'],
];
// The first mazes (version 1: 9 by 7, two spooks, no pellets or tunnels): a square dealt with one plays on with it.
export const LAYOUTS_V1 = [
  ['.........', '.##.#.##.', '.#.....#.', '...#G#...', '.#..G..#.', '.##.#.##.', '....C....'],
  ['....#....', '.##.#.##.', '.........', '.#.#G#.#.', '....G....', '.##.#.##.', '....C....'],
  ['.........', '.#.###.#.', '.#.....#.', '...#G#...', '.#..G..#.', '.#.###.#.', '....C....'],
  ['....#....', '.#.....#.', '.#.###.#.', '...#G#...', '.#.#G#.#.', '.#.....#.', '....C....'],
];
export const munVer = mini => (mini && mini.v >= 2 ? 2 : 1);
const LAY_MEMO = { 1: [], 2: [] };
// A layout parsed: w, h; open[cell] (1: the muncher may go there), gopen[cell] (the spooks may: the open cells, the
// pen and its door); dots (the cells that hold a dot, pellets among them), pellets; tunnel[cell] (slow for a spook)
// and wrap[row] (the row's ends join); start (the muncher's cell); pen { cells, centre, door, exit } or null;
// ghosts (where each spook begins: the chaser at the pen's exit, the others in the pen; v1: the G cells); corners
// (each spook's scatter corner: the open cell nearest the top right, top left, bottom left, bottom right).
export function munLayout(k, v) {
  const ver = v >= 2 ? 2 : 1, rows0 = ver === 2 ? LAYOUTS : LAYOUTS_V1;
  const i = Number.isInteger(k) && k >= 0 && k < rows0.length ? k : 0;
  if (LAY_MEMO[ver][i]) return LAY_MEMO[ver][i];
  const rows = rows0[i], w = rows[0].length, h = rows.length, N = w * h;
  const open = new Uint8Array(N), gopen = new Uint8Array(N), tunnel = new Uint8Array(N), wrap = new Uint8Array(h), dots = [], pellets = [], ghosts = [], pen = [];
  let start = [Math.floor(w / 2), h - 2], door = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = rows[y][x], c = y * w + x;
    if (ch === '#') continue;
    gopen[c] = 1;
    if (ch === 'P') { pen.push(c); continue; }
    if (ch === 'D') { door = c; continue; }
    open[c] = 1;
    if (ch === 'C') start = [x, y];
    else if (ch === 'G') ghosts.push([x, y]);
    else if (ch === '=') { tunnel[c] = 1; if (x === 0 || x === w - 1) wrap[y] = 1; }
    else if (ch === 'o') { dots.push(c); pellets.push(c); }
    else if (ver === 2 || (x + y) % 2 === 0) dots.push(c);              // (v1: a dot on every other open cell)
  }
  const L = { k: i, v: ver, w, h, open, gopen, tunnel, wrap, dots, pellets, start, pen: null, ghosts, corners: [], dmemo: [] };
  if (pen.length && door >= 0) {
    const dx = door % w, dy = (door - dx) / w, centre = pen[Math.floor(pen.length / 2)];
    let exit = -1;
    for (const [ex, ey] of DIRS) { const c = cellAt(L, dx + ex, dy + ey); if (c >= 0 && open[c]) { exit = c; break; } }
    L.pen = { cells: pen, centre, door, exit };
    L.ghosts = [[exit % w, (exit - exit % w) / w], ...pen.map(c => [c % w, (c - c % w) / w])];
  }
  const cs = [[w - 1, 0], [0, 0], [0, h - 1], [w - 1, h - 1]];
  L.corners = cs.map(([cx, cy]) => { let best = -1, bv = Infinity; for (let c = 0; c < N; c++) { if (!open[c] || tunnel[c]) continue; const x = c % w, y = (c - x) / w, v = Math.abs(x - cx) + Math.abs(y - cy); if (v < bv) { bv = v; best = c; } } return best; });
  return (LAY_MEMO[ver][i] = L);
}
export const layoutOf = mini => munLayout(mini && mini.lay, munVer(mini));
// A cell by its coordinates (-1 outside the maze; a tunnel row's ends join).
export const cellAt = (L, x, y) => {
  if (y < 0 || y >= L.h) return -1;
  if (x < 0 || x >= L.w) { if (!L.wrap[y]) return -1; x = ((x % L.w) + L.w) % L.w; }
  return y * L.w + x;
};
export const openAt = (L, x, y, g) => { const c = cellAt(L, x, y); return c >= 0 && (g ? L.gopen : L.open)[c] === 1; };
// A square's settings (core/tune.js): the target (never past the maze's dots), the speeds, the phases, the times.
export function munCfg(mini) {
  const t = tune(mini), L = layoutOf(mini);
  const n = (v, lo, hi, d) => { const x = Number(v); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };
  return {
    target: Math.min(L.dots.length, Math.max(1, Math.round(n(t.target, 1, 200, 75)))),
    speed: n(t.speed, 1, 10, 3.5), ghostSpeed: n(t.ghostSpeed, 1, 10, 3.9), frightSpeed: n(t.frightSpeed, 10, 100, 50) / 100, tunnelSpeed: n(t.tunnelSpeed, 10, 100, 45) / 100,
    scatterSecs: n(t.scatterSecs, 0.5, 30, 1), chaseSecs: n(t.chaseSecs, 0.5, 60, 7), frightSecs: n(t.frightSecs, 0.5, 20, 4), penSecs: n(t.penSecs, 0, 10, 1.5),
    grace: n(t.grace, 0, 10, 0), release: n(t.release, 0, 5, 0.5), ambush: Math.round(n(t.ambush, 0, 8, 4)), near: Math.round(n(t.near, 0, 20, 5)),
    pellets: Math.round(n(t.pellets, 0, 4, 4)), ghostDots: Math.round(n(t.ghostDots, 0, 30, 12)), runSecs: n(t.runSecs, 2, MUN.maxSecs, 7),
    aiReact: n(t.aiReact, 50, 1000, 200), aiAvoid: Math.round(n(t.aiAvoid, 0, 6, 2)), aiLapse: n(t.aiLapse, 0, 100, 10) / 100,
  };
}
export const munAte = (mini, p) => (mini && mini.ate && Array.isArray(mini.ate[p]) ? mini.ate[p] : []);   // (an empty list does not survive the database)
export const munGh = (mini, p) => (mini && mini.gh && Number.isInteger(mini.gh[p]) ? mini.gh[p] : 0);   // the spooks this player has eaten
export const munScore = (mini, p) => munAte(mini, p).length + munGh(mini, p) * munCfg(mini).ghostDots;
export const munTarget = mini => munCfg(mini).target;
// Where a player's next run begins: where their last one ended (the time up, the target), or the start after a spook
// caught them (and for the first run). The spooks begin every run in the pen.
export const munCell = (mini, p) => { const L = layoutOf(mini), c = mini && mini.at ? mini.at[p] : null; return Number.isInteger(c) && c >= 0 && c < L.open.length && L.open[c] ? c : L.start[1] * L.w + L.start[0]; };
const munTries = (mini, p) => (mini && mini.tries && Number.isInteger(mini.tries[p]) ? mini.tries[p] : 0);
// The pellets this square has (its `pellets` setting of the layout's four, in an order from its seed).
export function munPellets(mini) {
  const L = layoutOf(mini), n = Math.min(L.pellets.length, munCfg(mini).pellets);
  if (n >= L.pellets.length) return L.pellets.slice();
  const rng = makeRng('munpel:' + mini.seed), pool = L.pellets.slice(), out = [];
  while (out.length < n && pool.length) out.push(pool.splice(randInt(rng, pool.length), 1)[0]);
  return out.sort((a, b) => a - b);
}
export function create(type, rng) {
  rng = needRng(rng);
  return { type, v: 2, lay: randInt(rng, LAYOUTS.length), seed: randInt(rng, 1e9), ate: { X: [], O: [] }, gh: { X: 0, O: 0 }, tries: { X: 0, O: 0 }, last: null };
}

// ---- a run, step by step ----
// The inputs: [step, dir] pairs (the direction wanted changed at that step), written as base-36 step gaps and the direction.
export function munLog(pairs) { let s = 0; return pairs.map(([k, v]) => { const d = k - s; s = k; return d.toString(36) + ':' + v; }).join(','); }
export function munUnlog(str, maxSteps) {
  if (typeof str !== 'string' || str.length > 40000) return null;
  if (!str) return [];
  const out = [];
  let s = 0;
  for (const part of str.split(',')) {
    const m = /^([0-9a-z]{1,6}):([0-3])$/.exec(part);
    if (!m) return null;
    s += parseInt(m[1], 36);
    if (s > maxSteps || (out.length && s <= out[out.length - 1][0])) return null;
    out.push([s, Number(m[2])]);
  }
  return out;
}
const secs = (s, hz) => Math.max(1, Math.round(s * hz));
// A fresh run for player p: the muncher at its start, the spooks in the pen (the chaser at its exit), the player's
// dots as they stand, the first scatter under way.
export function munStart(mini, p) {
  const L = layoutOf(mini), cfg = munCfg(mini), U = MUN.U, hz = MUN.hz;
  const dots = new Uint8Array(L.w * L.h), pel = new Uint8Array(L.w * L.h);
  for (const c of L.dots) dots[c] = 1;
  for (const c of munPellets(mini)) pel[c] = 1;
  for (const c of munAte(mini, p)) if (c >= 0 && c < dots.length) { dots[c] = 0; pel[c] = 0; }
  let left = 0;
  for (let c = 0; c < dots.length; c++) left += dots[c];
  const graceN = Math.round(cfg.grace * hz), relN = Math.round(cfg.release * hz);
  const gh = L.ghosts.slice(0, SPOOKS.length).map(([x, y], i) => ({ x, y, d: -1, f: 0, i, mode: 'pen', fr: false, rev: false, wait: graceN + i * relN, home: L.pen ? L.pen.centre : y * L.w + x }));
  const gv = Math.round(cfg.ghostSpeed * U / hz), c0 = munCell(mini, p);
  return {
    type: 'muncher', p, L, cfg, v: Math.round(cfg.speed * U / hz), gv, fv: Math.max(1, Math.round(gv * cfg.frightSpeed)), tv: Math.max(1, Math.round(gv * cfg.tunnelSpeed)), ev: Math.round(gv * MUN.eyes),
    cap: Math.round(cfg.runSecs * hz), scatN: secs(cfg.scatterSecs, hz), chaseN: secs(cfg.chaseSecs, hz), frN: secs(cfg.frightSecs, hz), penN: Math.round(cfg.penSecs * hz), ghostDots: cfg.ghostDots,
    score0: munScore(mini, p), target: cfg.target, n: 0, dots, pel, left, ch: { x: c0 % L.w, y: (c0 - c0 % L.w) / L.w, d: -1, f: 0, face: 3 }, gh, c0, want: -1, log: [], ate: [], got: 0, end: null,
    phase: 'scatter', phN: secs(cfg.scatterSecs, hz), fr: 0, rng: makeRng(`mun:${mini.seed}:${p}:${munTries(mini, p)}`), last: null, eaten: 0, evs: [], bites: 0, dist: null, distN: -1,
  };
}
export const munSimScore = sim => sim.score0 + sim.ate.length + sim.got * sim.ghostDots;
// The direction wanted from this step on (logged when it changes).
export function munInput(sim, dir) {
  if (!(dir >= 0 && dir < 4) || dir === sim.want || sim.end) return;
  sim.want = dir; sim.log.push([sim.n, dir]);
}
// Where a mover is, in units (a mover going out of a tunnel's end is past the maze's edge until it comes in at the other).
export const munPos = m => (m.d < 0 ? [m.x * MUN.U, m.y * MUN.U] : [m.x * MUN.U + DIRS[m.d][0] * m.f, m.y * MUN.U + DIRS[m.d][1] * m.f]);
// Shortest distances over the cells from a cell (a breadth-first walk; -1: unreachable): the muncher's cells, or
// with `g` the spooks' (the pen too); `block` keeps cells out. Without a block, memoised on the layout.
export function munDist(L, from, block, g) {
  const key = from * 2 + (g ? 1 : 0), op = g ? L.gopen : L.open;
  if (!block && L.dmemo[key]) return L.dmemo[key];
  const d = new Int16Array(L.w * L.h).fill(-1), q = [from];
  if (from < 0 || !op[from]) return d;
  d[from] = 0;
  for (let h = 0; h < q.length; h++) {
    const c = q[h], x = c % L.w, y = (c - x) / L.w;
    for (const [dx, dy] of DIRS) {
      const nc = cellAt(L, x + dx, y + dy);
      if (nc < 0 || !op[nc] || d[nc] >= 0 || (block && block[nc])) continue;
      d[nc] = d[c] + 1; q.push(nc);
    }
  }
  if (!block) L.dmemo[key] = d;
  return d;
}
// A mover's cell moved one along its direction (a tunnel's end joins the other).
function stepCell(L, m) { const c = cellAt(L, m.x + DIRS[m.d][0], m.y + DIRS[m.d][1]); m.x = c % L.w; m.y = (c - m.x) / L.w; }
// A mover goes v units along its direction, turning at the cells' centres by `pick` (the direction from a centre, or
// -1 to stand); `onCentre` is told of each centre it reaches; `pre` may turn it before a centre (the muncher's cornering).
function advance(L, m, v, pick, onCentre, pre) {
  let left = v;
  for (let guard = 0; left > 0 && guard < 8; guard++) {
    if (m.d < 0) { const nd = pick(m, true); if (nd < 0) return; m.d = nd; m.face = nd; }
    if (pre && pre(m)) { if (onCentre) onCentre(m); continue; }
    const room = MUN.U - m.f;
    if (left < room) { m.f += left; return; }
    left -= room; m.f = 0;
    stepCell(L, m);
    if (onCentre) onCentre(m);
    const nd = pick(m, false);
    if (nd < 0) { m.d = -1; return; }
    m.d = nd; m.face = nd;
  }
}
const perp = (a, b) => a >= 0 && b >= 0 && a !== b && a !== OPP(b);
// One step of a run: the phase clock (fright holds it), the muncher (its wanted direction taken at the next centre
// where it opens, at once when it is back the way it came, a little early at a corner), its dots and pellets, then
// the spooks (each by its mode and its way), then a touch (a frightened spook eaten, else the run's end). `last`
// says the step's main event (for the drawing and sounds: 'eat', 'pellet', 'ghost', 'caught'), `evs` all of them.
export function munStep(sim) {
  if (sim.end) return;
  const L = sim.L, ch = sim.ch, U = MUN.U;
  sim.last = null; sim.eaten = 0; sim.evs.length = 0;
  if (sim.fr > 0) { sim.fr--; if (sim.fr === 0) for (const g of sim.gh) g.fr = false; }
  else if (--sim.phN <= 0) { sim.phase = sim.phase === 'scatter' ? 'chase' : 'scatter'; sim.phN = sim.phase === 'scatter' ? sim.scatN : sim.chaseN; for (const g of sim.gh) if (g.mode === 'out') g.rev = true; }
  // the muncher
  if (ch.d >= 0 && ch.f > 0 && sim.want === OPP(ch.d)) { stepCell(L, ch); ch.d = sim.want; ch.face = ch.d; ch.f = U - ch.f; }   // (back the way it came: at once, from where it is)
  const pickCh = (m, standing) => {
    const w = sim.want;
    if (w >= 0 && openAt(L, m.x + DIRS[w][0], m.y + DIRS[w][1])) return w;
    if (!standing && m.d >= 0 && openAt(L, m.x + DIRS[m.d][0], m.y + DIRS[m.d][1])) return m.d;
    return -1;
  };
  const preCh = m => {                                               // cornering: a turn wanted just before the centre, open from the next cell, is taken there now
    const w = sim.want;
    if (!perp(w, m.d) || m.f === 0 || U - m.f > MUN.corner) return false;
    const nx = m.x + DIRS[m.d][0], ny = m.y + DIRS[m.d][1];
    if (!openAt(L, nx, ny) || !openAt(L, nx + DIRS[w][0], ny + DIRS[w][1])) return false;
    stepCell(L, m); m.f = 0; m.d = w; m.face = w;
    return true;
  };
  const eat = m => {
    const c = cellAt(L, m.x, m.y);
    if (c < 0 || !sim.dots[c]) return;
    sim.dots[c] = 0; sim.left--; sim.ate.push(c); sim.eaten++; sim.bites++;
    if (sim.pel[c]) {                                              // a power pellet: the spooks out are frightened and turn tail
      sim.pel[c] = 0; sim.fr = sim.frN; sim.evs.push('pellet'); sim.last = 'pellet';
      for (const g of sim.gh) if (g.mode === 'out' || g.mode === 'leave') { g.fr = true; if (g.mode === 'out') g.rev = true; }
    } else { sim.evs.push('eat'); if (!sim.last) sim.last = 'eat'; }
  };
  advance(L, ch, sim.v, pickCh, eat, preCh);
  if (munSimScore(sim) >= sim.target) { sim.end = 'win'; sim.n++; return; }
  if (sim.left <= 0) { sim.end = 'clear'; sim.n++; return; }
  // the spooks
  const here = cellAt(L, ch.x, ch.y);
  const targetOf = g => {
    if (sim.phase === 'scatter') return L.corners[g.i];
    if (g.i === 0) return here;
    if (g.i === 1) {                                               // the ambusher: a few cells ahead of the muncher, as far as the way is open
      let x = ch.x, y = ch.y, c = here;
      if (ch.d >= 0) for (let k = 0; k < sim.cfg.ambush; k++) { const nc = cellAt(L, x + DIRS[ch.d][0], y + DIRS[ch.d][1]); if (nc < 0 || !L.open[nc]) break; c = nc; x = nc % L.w; y = (nc - x) / L.w; }
      return c;
    }
    if (g.i === 2) { const d = munDist(L, here, null)[cellAt(L, g.x, g.y)]; return d >= 0 && d <= sim.cfg.near ? here : L.corners[g.i]; }
    return -1;                                                      // the wanderer
  };
  const pickOut = g => {
    const back = OPP(g.d), fright = g.fr && sim.fr > 0;
    let opts = [];
    for (let d = 0; d < 4; d++) if (d !== back && openAt(L, g.x + DIRS[d][0], g.y + DIRS[d][1])) opts.push(d);
    if (!opts.length) return back >= 0 && openAt(L, g.x + DIRS[back][0], g.y + DIRS[back][1]) ? back : -1;   // (a dead end: back out)
    if (fright) return opts[randInt(sim.rng, opts.length)];
    if (opts.length > 1) {                                          // never into a cell another spook is in or about to enter, given a choice
      const taken = new Set();
      for (const o of sim.gh) if (o !== g && (o.mode === 'out' || o.mode === 'leave')) { taken.add(cellAt(L, o.x, o.y)); if (o.d >= 0) taken.add(cellAt(L, o.x + DIRS[o.d][0], o.y + DIRS[o.d][1])); }
      const free = opts.filter(d => !taken.has(cellAt(L, g.x + DIRS[d][0], g.y + DIRS[d][1])));
      if (free.length) opts = free;
    }
    const T = targetOf(g);
    if (T < 0) return opts[randInt(sim.rng, opts.length)];
    const dist = munDist(L, T, null);
    let ties = [], bv = Infinity;
    for (const d of opts) { const c = cellAt(L, g.x + DIRS[d][0], g.y + DIRS[d][1]), v = dist[c] < 0 ? 999 : dist[c]; if (v < bv) { bv = v; ties = [d]; } else if (v === bv) ties.push(d); }
    return ties.length > 1 && sim.phase === 'scatter' ? ties[randInt(sim.rng, ties.length)] : ties[0];   // (two ways as short while scattering: either, by the seed, so the spooks out of the pen spread instead of filing up one corridor; in the chase the first in order: up, right, down, left)
  };
  const pickTo = T => g => {                                        // towards a cell through the pen's door (eyes going home, a spook leaving)
    const c0 = cellAt(L, g.x, g.y);
    if (c0 === T) return -1;
    const dist = munDist(L, T, null, true);
    let best = -1, bv = Infinity;
    for (let d = 0; d < 4; d++) { const c = cellAt(L, g.x + DIRS[d][0], g.y + DIRS[d][1]); if (c < 0 || !L.gopen[c]) continue; const v = dist[c] < 0 ? 999 : dist[c]; if (v < bv) { bv = v; best = d; } }
    return best;
  };
  for (const g of sim.gh) {
    if (g.mode === 'pen') { if (--g.wait <= 0) { g.mode = L.pen ? 'leave' : 'out'; g.d = -1; } continue; }
    if (g.mode === 'leave') {
      if (g.f === 0 && cellAt(L, g.x, g.y) === L.pen.exit) { g.mode = 'out'; g.d = -1; }
      else { advance(L, g, sim.gv, pickTo(L.pen.exit), null); continue; }
    }
    if (g.mode === 'eyes') {
      if (g.f === 0 && cellAt(L, g.x, g.y) === g.home) { g.mode = 'pen'; g.d = -1; g.wait = sim.penN; continue; }
      advance(L, g, sim.ev, pickTo(g.home), null); continue;
    }
    if (g.rev) {                                                    // a phase change or a pellet: back the way it came, at once
      g.rev = false;
      if (g.d >= 0) { if (g.f > 0) { stepCell(L, g); g.d = OPP(g.d); g.f = U - g.f; } else if (openAt(L, g.x + DIRS[OPP(g.d)][0], g.y + DIRS[OPP(g.d)][1])) g.d = OPP(g.d); }
    }
    const sp = g.fr && sim.fr > 0 ? sim.fv : L.tunnel[cellAt(L, g.x, g.y)] ? sim.tv : sim.gv;
    advance(L, g, sp, pickOut, null);
  }
  // a touch
  const [px, py] = munPos(ch), span = L.w * U;
  for (const g of sim.gh) {
    if (g.mode !== 'out' && g.mode !== 'leave') continue;
    const [gx, gy] = munPos(g);
    let dx = Math.abs(gx - px); dx = Math.min(dx, span - dx);
    if (dx * dx + (gy - py) * (gy - py) >= MUN.hit * MUN.hit) continue;
    if (g.fr && sim.fr > 0) { g.mode = 'eyes'; g.fr = false; g.d = -1; g.f = 0; sim.got++; sim.evs.push('ghost'); sim.last = 'ghost'; if (munSimScore(sim) >= sim.target) { sim.end = 'win'; break; } continue; }
    sim.end = 'caught'; sim.last = 'caught'; sim.evs.push('caught'); break;
  }
  sim.n++;
  if (!sim.end && sim.n >= sim.cap) sim.end = 'time';
}
// A run played through from its inputs (the phone's, the computer's): the same steps the phone took.
export function munReplay(mini, p, log, steps) {
  const sim = munStart(mini, p);
  let k = 0;
  while (sim.n < steps && !sim.end) {
    while (k < log.length && log[k][0] <= sim.n) { if (log[k][0] === sim.n) munInput(sim, log[k][1]); k++; }
    munStep(sim);
  }
  return sim;
}
// The run as a move: its inputs, its length, what it ate (dots, spooks) and how it ended ('out': sent before it ended).
export const munMove = sim => ({ log: munLog(sim.log), steps: sim.n, ate: sim.ate.length, gh: sim.got, end: sim.end || 'out' });
export const munMs = g => (!g || g.auto ? 0 : Math.min(Math.round(Number(g.steps) * 1000 / MUN.hz), MUN.replayMax));   // how long a run takes to play through (as it was, or faster past replayMax)
export const munRawMs = g => (!g || g.auto ? 0 : Math.round(Number(g.steps) * 1000 / MUN.hz));
// A phone's run, checked: its inputs played through again here. Returns { why } or { why: null, sim }.
export function munCheck(mini, p, m) {
  if (!m || typeof m !== 'object') return { why: 'bad' };
  if (typeof m.log !== 'string') return { why: 'log' };   // (a run without its inputs is refused: the server plays them through again)
  const steps = Number(m.steps), cap = Math.round(munCfg(mini).runSecs * MUN.hz);
  if (!Number.isInteger(steps) || steps < 1 || steps > cap) return { why: 'bad' };
  const log = munUnlog(m.log, steps);
  if (!log) return { why: 'bad' };
  const sim = munReplay(mini, p, log, steps), end = sim.end || 'out';
  if (sim.n !== steps || String(m.end) !== end || Number(m.ate) !== sim.ate.length || (m.gh == null ? 0 : Number(m.gh)) !== sim.got) return { why: 'replay' };   // (ended sooner, or not as said)
  return { why: null, sim };
}
export function apply(mini, p, m, rng, idx) {   // one run: checked (played through again), then its dots and spooks kept; a timed-out one ('auto') changes nothing
  const from = munScore(mini, p), target = munTarget(mini);
  if (!mini.ate) mini.ate = { X: [], O: [] };
  if (!mini.gh) mini.gh = { X: 0, O: 0 };
  if (!mini.tries) mini.tries = { X: 0, O: 0 };
  if (!mini.at) mini.at = { X: null, O: null };
  let to = from, last;
  if (m === 'auto') last = { by: p, auto: true, from, to };
  else {
    const c = munCheck(mini, p, m);
    if (c.why) return { ok: false, reason: c.why };
    const set = new Set(munAte(mini, p));
    for (const cell of c.sim.ate) set.add(cell);
    mini.ate[p] = [...set].sort((a, b) => a - b);
    mini.gh[p] = munGh(mini, p) + c.sim.got;
    to = munScore(mini, p);
    const cell0 = c.sim.c0, cell1 = c.sim.end === 'caught' ? null : cellAt(c.sim.L, c.sim.ch.x, c.sim.ch.y);
    mini.at[p] = cell1;
    last = { by: p, from, to, log: m.log, steps: c.sim.n, end: c.sim.end || 'out', try: munTries(mini, p), ate: c.sim.ate.slice(), gh: c.sim.got, cell0, cell1 };
  }
  mini.tries[p] = munTries(mini, p) + 1;
  mini.last = last;
  if (to >= target) return { ok: true, outcome: 'win', note: 'target' };
  return { ok: true, outcome: 'continue', note: last.auto ? 'out' : to > from ? 'ate' : 'none' };
}
export function publicView(mini) {   // nothing is hidden: the maze, each player's dots and spooks, the runs
  const out = { type: 'muncher', lay: mini.lay, seed: mini.seed, ate: { X: munAte(mini, 'X').slice(), O: munAte(mini, 'O').slice() }, gh: { X: munGh(mini, 'X'), O: munGh(mini, 'O') }, tries: { X: munTries(mini, 'X'), O: munTries(mini, 'O') }, at: { X: mini.at && Number.isInteger(mini.at.X) ? mini.at.X : null, O: mini.at && Number.isInteger(mini.at.O) ? mini.at.O : null }, last: mini.last ? JSON.parse(JSON.stringify(mini.last)) : null };
  if (mini.v != null) out.v = mini.v;
  return out;
}
export function randomMove(mini, p, rng, from, empties) {
  return munPilot(mini, p, needRng(rng), { kind: 'random' }).move;   // a careless run: any way at every junction
}
// The page's view says which moves are this phone's own (their run played here live: the result alone): flashMs
// then leaves the run out. The server never sets it, so its clock counts the other phone's replay.
export const MUN_VIEW = { own: null };
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last;
  flash.mun = Object.assign({ type: 'muncher', target: munTarget(mini), lay: mini.lay, seed: mini.seed, v: munVer(mini), at: { X: munScore(mini, 'X'), O: munScore(mini, 'O') } }, JSON.parse(JSON.stringify(l)));
}
export function flashMs(f, winLen, won) {
  const g = f.mun, own = MUN_VIEW.own && MUN_VIEW.own(f);
  return (g && !g.auto && !f.timeout && !own ? munMs(g) : 0) + MUN.hold + (won ? MUN.won : 0);   // someone else's run plays through first, then the result (the phone that played it skips that)
}

// ---- the computer's hand ----
// A pilot plays a run through the same steps, deciding a direction every `react` ms: towards the nearest dot by the
// shortest way round the cells within `avoid` of a spook (and, with `predict`, of where it is heading); a pellet
// first when a spook is close (`pellet`); after a frightened spook worth the trip (`hunt`); with no safe way, away
// from the nearest spook; now and then (`lapse`) it forgets the spooks for a moment. 'random' turns any way.
export const MUN_HANDS = {
  random: { kind: 'random' },
  normal: { kind: 'plan', react: 200, avoid: 2, lapse: 0.2, predict: false, explore: 0, pellet: 2, hunt: 4 },
  hard: { kind: 'plan', react: 33, avoid: 2, lapse: 0, predict: true, explore: 0.1, pellet: 3, hunt: 6 },
};
export function munHand(mini, level) {
  const cfg = munCfg(mini);
  if (level === 'hard') return MUN_HANDS.hard;
  return Object.assign({}, MUN_HANDS.normal, { react: cfg.aiReact, avoid: cfg.aiAvoid, lapse: cfg.aiLapse });
}
const danger_ = (sim, hand) => {
  const L = sim.L, danger = new Uint8Array(L.w * L.h);
  for (const g of sim.gh) {
    if ((g.mode !== 'out' && g.mode !== 'leave') || (g.fr && sim.fr > 0)) continue;
    const cells = [cellAt(L, g.x, g.y)];
    if (hand.predict && g.d >= 0) cells.push(cellAt(L, g.x + DIRS[g.d][0], g.y + DIRS[g.d][1]));
    for (const c of cells) { if (c < 0 || !L.open[c]) continue; const d = munDist(L, c, null); for (let k = 0; k < d.length; k++) if (d[k] >= 0 && d[k] <= hand.avoid) danger[k] = 1; }
  }
  return danger;
};
const firstStep = (L, dist, from, goal) => {                        // the direction of the first step of the shortest way from `from` to `goal` (by dist, from `from`)
  let c = goal;
  while (dist[c] > 1) { const x = c % L.w, y = (c - x) / L.w; let nxt = -1; for (const [dx, dy] of DIRS) { const nc = cellAt(L, x + dx, y + dy); if (nc >= 0 && dist[nc] === dist[c] - 1) { nxt = nc; break; } } if (nxt < 0) return -1; c = nxt; }
  const fx = from % L.w, fy = (from - fx) / L.w, cx = c % L.w, cy = (c - cx) / L.w;
  return DIRS.findIndex(([dx, dy]) => cellAt(L, fx + dx, fy + dy) === cellAt(L, cx, cy));
};
function planDir(sim, hand, rng) {
  const L = sim.L, ch = sim.ch;
  const here = cellAt(L, ch.x, ch.y), ahead = ch.d >= 0 && ch.f > 0 ? cellAt(L, ch.x + DIRS[ch.d][0], ch.y + DIRS[ch.d][1]) : here;
  const from = ahead >= 0 && L.open[ahead] ? ahead : here;
  const careless = hand.lapse > 0 && rng() < hand.lapse;
  const d0 = careless || hand.avoid <= 0 ? null : danger_(sim, hand);
  if (from !== here && sim.dots[from] && !(d0 && d0[from])) return ch.d;   // a dot just ahead, safe: on to it (never a turn away from a dot about to be eaten: it dithered between two)
  // the dots in reach by a safe way: the spooks kept `avoid` cells off, then nearer when nothing is in reach that way
  let dist = null, goal = -1, best = Infinity, second = -1;
  for (let avoid = careless ? 0 : hand.avoid; avoid >= 0 && goal < 0; avoid--) {
    const danger = avoid === hand.avoid ? d0 : avoid > 0 ? danger_(sim, Object.assign({}, hand, { avoid })) : null;
    if (danger) danger[from] = 0;
    dist = munDist(L, from, danger);
    for (let c = 0; c < dist.length; c++) if (sim.dots[c] && dist[c] > 0) { if (dist[c] < best) { second = goal; best = dist[c]; goal = c; } else if (second < 0 || dist[c] < dist[second]) second = c; }
  }
  if (hand.hunt > 0) {                                                // a frightened spook near enough, with time to reach it: after it
    let hg = -1, hb = Infinity;
    for (const g of sim.gh) { if (g.mode !== 'out' || !g.fr || sim.fr < MUN.hz * 0.8) continue; const c = cellAt(L, g.x, g.y), d = dist[c]; if (d > 0 && d <= hand.hunt && d < hb) { hb = d; hg = c; } }
    if (hg >= 0) { const dir = firstStep(L, dist, from, hg); if (dir >= 0) return dir; }
  }
  if (hand.pellet > 0 && sim.fr === 0) {                              // a pellet near, with a spook closing in: the pellet first
    let threat = 99, pg = -1, pb = Infinity;
    for (const g of sim.gh) { if (g.mode !== 'out') continue; const d = munDist(L, cellAt(L, g.x, g.y), null)[from]; if (d >= 0 && d < threat) threat = d; }
    if (threat <= hand.pellet + 1) for (let c = 0; c < dist.length; c++) if (sim.pel[c] && sim.dots[c] && dist[c] > 0 && dist[c] <= hand.pellet && dist[c] < pb) { pb = dist[c]; pg = c; }
    if (pg >= 0) { const dir = firstStep(L, dist, from, pg); if (dir >= 0) return dir; }
  }
  if (goal >= 0 && hand.explore > 0 && second >= 0 && rng() < hand.explore) goal = second;
  if (hand.goal >= 0 && sim.dots[hand.goal] && dist[hand.goal] > 0 && dist[hand.goal] <= best + 2) goal = hand.goal;   // (the dot it was heading for, while it is still a safe way off: no dithering between two)
  hand.goal = goal;
  if (goal >= 0) { const dir = firstStep(L, dist, from, goal); if (dir >= 0) return dir; }
  // no way to a dot at all: the neighbour farthest from the nearest spook
  const far = sim.gh.filter(g => g.mode === 'out' && !(g.fr && sim.fr > 0)).map(g => munDist(L, cellAt(L, g.x, g.y), null));
  const safety = c => far.reduce((m, d) => Math.min(m, d[c] < 0 ? 99 : d[c]), 99);
  const fx = from % L.w, fy = (from - fx) / L.w;
  let bestD = -1, bestS = safety(from);
  for (let d = 0; d < 4; d++) { const nc = cellAt(L, fx + DIRS[d][0], fy + DIRS[d][1]); if (nc < 0 || !L.open[nc]) continue; const s = safety(nc); if (s > bestS) { bestS = s; bestD = d; } }
  return bestD;
}
// The computer's run (or a careless one): the move and the run as played.
export function munPilot(mini, p, rng, hand) {
  rng = needRng(rng);
  hand = Object.assign({ goal: -1 }, hand);
  const sim = munStart(mini, p), every = hand.kind === 'random' ? 1 : Math.max(1, Math.round(hand.react / 1000 * MUN.hz));
  while (!sim.end) {
    if (hand.kind === 'random') {
      if (sim.ch.d < 0 || sim.ch.f === 0) { const opts = []; for (let d = 0; d < 4; d++) if (openAt(sim.L, sim.ch.x + DIRS[d][0], sim.ch.y + DIRS[d][1])) opts.push(d); if (opts.length) munInput(sim, opts[randInt(rng, opts.length)]); }
    } else if (sim.n % every === 0) {
      const d = planDir(sim, hand, rng);
      if (d >= 0) munInput(sim, d);
    }
    munStep(sim);
  }
  return { move: munMove(sim), sim };
}
// Hard: a few runs tried, the best kept (within the time it has, when it has a clock).
export function munBestOf(mini, p, rng, hand, tries, until) {
  let best = null;
  const cfg = munCfg(mini), worth = r => r.move.ate + r.move.gh * cfg.ghostDots;
  for (let t = 0; t < tries; t++) {
    if (t > 0 && typeof until === 'function' && until() <= 0) break;
    const r = munPilot(mini, p, makeRng('munai:' + rng()), hand);
    if (!best || worth(r) > worth(best) || (worth(r) === worth(best) && r.move.steps < best.move.steps)) best = r;
  }
  return best;
}
// Super Chaos: each player's dots and runs are their own (the default fork and merge keep them apart).
