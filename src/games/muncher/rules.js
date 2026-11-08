// Muncher: the rules (pure: no page, no clock; the server runs the same code).
import { makeRng, needRng, randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';

// ---------- Muncher ----------
// A maze of 9 by 7 cells, dealt from a few layouts (LAYOUTS: '#' a wall, 'C' the muncher's start, 'G' a spook's start,
// '.' an open cell; a dot sits on every other open cell, chequer-wise). Each player's maze is their own: the dots they have eaten stay eaten for them, the other
// player eats from a full maze of the same layout (mini.ate[p]: the cells eaten, sorted). A move is one run, played
// on the player's phone in real time: Start puts the muncher at its start and the spooks at theirs, a swipe (an arrow
// key, a tap on a side) turns the muncher, and the run ends when a spook touches it, when the time is up, when the
// target is reached, or when the maze is empty. The run is worked out in fixed steps of integer arithmetic (MUN.hz
// steps a second, positions in MUN.U units a cell), so the same inputs give the same run everywhere: the phone sends
// its inputs (the direction wanted, at the step it changed) with the result, and the server plays them through again
// and takes the result only when it is the same (munCheck). The spooks move by a seeded rng (the square's seed, the
// player and the run's number), so they are the same on every phone and on the server. The computer plays through
// the same steps with a hand of its own (munPilot), and every phone replays any run it did not play from its inputs.
// The first player to have eaten `target` dots takes the square.
export const MUN = { w: 9, h: 7, hz: 30, U: 600, hit: 330, hold: 700, won: 600, maxSecs: 60, replayMax: 30000 };   // hit: a spook this close (max norm, in units) catches the muncher; hold: the end of a run shows this long (ms); replayMax: a longer run replays faster, in this long
export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // up, right, down, left
export const OPP = d => (d < 0 ? -1 : (d + 2) % 4);
// The layouts: every open cell reachable from every other; the muncher starts at the bottom, the spooks in the middle.
export const LAYOUTS = [
  ['.........', '.##.#.##.', '.#.....#.', '...#G#...', '.#..G..#.', '.##.#.##.', '....C....'],
  ['....#....', '.##.#.##.', '.........', '.#.#G#.#.', '....G....', '.##.#.##.', '....C....'],
  ['.........', '.#.###.#.', '.#.....#.', '...#G#...', '.#..G..#.', '.#.###.#.', '....C....'],
  ['....#....', '.#.....#.', '.#.###.#.', '...#G#...', '.#.#G#.#.', '.#.....#.', '....C....'],
];
const LAY_MEMO = [];
// A layout parsed: open[cell] (1: a cell the muncher and the spooks may enter), dots (the cells that hold a dot),
// start (the muncher's cell), ghosts (the spooks' start cells, in order).
export function munLayout(k) {
  const i = Number.isInteger(k) && k >= 0 && k < LAYOUTS.length ? k : 0;
  if (LAY_MEMO[i]) return LAY_MEMO[i];
  const rows = LAYOUTS[i], open = new Uint8Array(MUN.w * MUN.h), dots = [], ghosts = [];
  let start = [4, 6];
  for (let y = 0; y < MUN.h; y++) for (let x = 0; x < MUN.w; x++) {
    const ch = rows[y][x], c = y * MUN.w + x;
    if (ch === '#') continue;
    open[c] = 1;
    if (ch === 'C') start = [x, y];
    else if (ch === 'G') ghosts.push([x, y]);
    else if ((x + y) % 2 === 0) dots.push(c);                     // a dot on every other open cell (a chequer): each one is a step or two away, so a run's worth is in the way it goes
  }
  return (LAY_MEMO[i] = { k: i, open, dots, start, ghosts });
}
export const cellAt = (x, y) => (x < 0 || y < 0 || x >= MUN.w || y >= MUN.h ? -1 : y * MUN.w + x);
export const openAt = (L, x, y) => { const c = cellAt(x, y); return c >= 0 && L.open[c] === 1; };
// A square's settings (core/tune.js): the target (never past the maze's dots), the spooks, the speeds, the times.
export function munCfg(mini) {
  const t = tune(mini), L = munLayout(mini.lay);
  const n = (v, lo, hi, d) => { const x = Number(v); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };
  return {
    target: Math.min(L.dots.length, Math.max(1, Math.round(n(t.target, 1, 99, 18)))),
    ghosts: Math.min(L.ghosts.length, Math.max(1, Math.round(n(t.ghosts, 1, 2, 2)))),
    speed: n(t.speed, 0.5, 10, 3.5), ghostSpeed: n(t.ghostSpeed, 0.5, 10, 3.8),
    chase: n(t.chase, 0, 100, 90) / 100, grace: n(t.grace, 0, 10, 1), runSecs: n(t.runSecs, 2, MUN.maxSecs, 7),
    aiReact: n(t.aiReact, 50, 1000, 200), aiAvoid: Math.round(n(t.aiAvoid, 0, 6, 2)), aiLapse: n(t.aiLapse, 0, 100, 20) / 100,
  };
}
export const munAte = (mini, p) => (mini && mini.ate && Array.isArray(mini.ate[p]) ? mini.ate[p] : []);   // (an empty list does not survive the database)
export const munScore = (mini, p) => munAte(mini, p).length;
export const munTarget = mini => munCfg(mini).target;
const munTries = (mini, p) => (mini && mini.tries && Number.isInteger(mini.tries[p]) ? mini.tries[p] : 0);
export function create(type, rng) {
  rng = needRng(rng);
  return { type, lay: randInt(rng, LAYOUTS.length), seed: randInt(rng, 1e9), ate: { X: [], O: [] }, tries: { X: 0, O: 0 }, last: null };
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
// A fresh run for player p: the muncher at its start, the spooks at theirs, the player's dots as they stand.
export function munStart(mini, p) {
  const L = munLayout(mini.lay), cfg = munCfg(mini), U = MUN.U;
  const dots = new Uint8Array(MUN.w * MUN.h);
  for (const c of L.dots) dots[c] = 1;
  for (const c of munAte(mini, p)) if (c >= 0 && c < dots.length) dots[c] = 0;
  let left = 0;
  for (let c = 0; c < dots.length; c++) left += dots[c];
  const gh = L.ghosts.slice(0, cfg.ghosts).map(([x, y]) => ({ x, y, d: -1, f: 0 }));
  return {
    type: 'muncher', p, L, cfg, v: Math.round(cfg.speed * U / MUN.hz), gv: Math.round(cfg.ghostSpeed * U / MUN.hz), cap: Math.round(cfg.runSecs * MUN.hz), graceN: Math.round(cfg.grace * MUN.hz),
    score0: munScore(mini, p), target: cfg.target, n: 0, dots, left, ch: { x: L.start[0], y: L.start[1], d: -1, f: 0 }, gh, want: -1, log: [], ate: [], end: null,
    rng: makeRng(`mun:${mini.seed}:${p}:${munTries(mini, p)}`), last: null, eaten: 0, bfsN: -1, bfs: null,
  };
}
// The direction wanted from this step on (logged when it changes).
export function munInput(sim, dir) {
  if (!(dir >= 0 && dir < 4) || dir === sim.want || sim.end) return;
  sim.want = dir; sim.log.push([sim.n, dir]);
}
// Where a mover is, in units.
export const munPos = m => (m.d < 0 ? [m.x * MUN.U, m.y * MUN.U] : [m.x * MUN.U + DIRS[m.d][0] * m.f, m.y * MUN.U + DIRS[m.d][1] * m.f]);
// Shortest distances over the open cells from a cell (a breadth-first walk; -1: unreachable); `block` keeps cells out.
export function munDist(L, from, block) {
  const d = new Int16Array(MUN.w * MUN.h).fill(-1), q = [from];
  if (from < 0 || !L.open[from]) return d;
  d[from] = 0;
  for (let h = 0; h < q.length; h++) {
    const c = q[h], x = c % MUN.w, y = (c - x) / MUN.w;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy, nc = cellAt(nx, ny);
      if (nc < 0 || !L.open[nc] || d[nc] >= 0 || (block && block[nc])) continue;
      d[nc] = d[c] + 1; q.push(nc);
    }
  }
  return d;
}
const chaseDist = sim => { if (sim.bfsN !== sim.n) { sim.bfs = munDist(sim.L, cellAt(sim.ch.x, sim.ch.y), null); sim.bfsN = sim.n; } return sim.bfs; };
// A mover goes v units along its direction, turning at the cells' centres by `pick` (the direction from a centre, or
// -1 to stand); `onCentre` is told of each centre it reaches.
function advance(m, v, pick, onCentre) {
  let left = v;
  for (let guard = 0; left > 0 && guard < 8; guard++) {
    if (m.d < 0) { const nd = pick(m, true); if (nd < 0) return; m.d = nd; }
    const room = MUN.U - m.f;
    if (left < room) { m.f += left; return; }
    left -= room; m.f = 0;
    m.x += DIRS[m.d][0]; m.y += DIRS[m.d][1];
    if (onCentre) onCentre(m);
    const nd = pick(m, false);
    if (nd < 0) { m.d = -1; return; }
    m.d = nd;
  }
}
// One step of a run: the muncher (its wanted direction taken at the next centre, or at once when it is back the way it
// came), then the spooks (still for the grace, then roaming: at a junction, towards the muncher `chase` of the time,
// else any way but back), then a touch ends the run. `last` says what happened this step (for the drawing and sounds).
export function munStep(sim) {
  if (sim.end) return;
  const L = sim.L, ch = sim.ch;
  sim.last = null; sim.eaten = 0;
  if (ch.d >= 0 && ch.f > 0 && sim.want === OPP(ch.d)) { ch.x += DIRS[ch.d][0]; ch.y += DIRS[ch.d][1]; ch.d = sim.want; ch.f = MUN.U - ch.f; }   // (back the way it came: at once, from where it is)
  const pickCh = (m, standing) => {
    const w = sim.want;
    if (w >= 0 && openAt(L, m.x + DIRS[w][0], m.y + DIRS[w][1])) return w;
    if (!standing && m.d >= 0 && openAt(L, m.x + DIRS[m.d][0], m.y + DIRS[m.d][1])) return m.d;
    return -1;
  };
  advance(ch, sim.v, pickCh, m => {
    const c = cellAt(m.x, m.y);
    if (c >= 0 && sim.dots[c]) { sim.dots[c] = 0; sim.left--; sim.ate.push(c); sim.eaten++; sim.last = 'eat'; }
  });
  if (sim.score0 + sim.ate.length >= sim.target) { sim.end = 'win'; sim.n++; return; }
  if (sim.left <= 0) { sim.end = 'clear'; sim.n++; return; }
  if (sim.n >= sim.graceN) {
    sim.gh.forEach((g, gi) => {
      const pickG = m => {
        const opts = [];
        for (let d = 0; d < 4; d++) if (d !== OPP(m.d) && openAt(L, m.x + DIRS[d][0], m.y + DIRS[d][1])) opts.push(d);
        if (!opts.length) return OPP(m.d) >= 0 && openAt(L, m.x + DIRS[OPP(m.d)][0], m.y + DIRS[OPP(m.d)][1]) ? OPP(m.d) : -1;   // (a dead end: back out)
        if (sim.rng() < sim.cfg.chase) {
          let dist = chaseDist(sim);
          if (gi === 1 && ch.d >= 0) {                              // the second spook heads for where the muncher is going (two cells on), not where it is
            const tx = ch.x + DIRS[ch.d][0] * 2, ty = ch.y + DIRS[ch.d][1] * 2;
            if (openAt(L, tx, ty)) dist = munDist(L, cellAt(tx, ty), null);
          }
          let bestD = -1, bestV = Infinity;
          for (const d of opts) { const v = dist[cellAt(m.x + DIRS[d][0], m.y + DIRS[d][1])]; const w = v < 0 ? 999 : v; if (w < bestV) { bestV = w; bestD = d; } }
          return bestD;
        }
        return opts[randInt(sim.rng, opts.length)];
      };
      advance(g, sim.gv, pickG, null);
    });
  }
  const [px, py] = munPos(ch);
  for (const g of sim.gh) { const [gx, gy] = munPos(g); if (Math.abs(gx - px) < MUN.hit && Math.abs(gy - py) < MUN.hit) { sim.end = 'caught'; sim.last = 'caught'; break; } }
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
// The run as a move: its inputs, its length, what it ate and how it ended ('out': sent before it ended).
export const munMove = sim => ({ log: munLog(sim.log), steps: sim.n, ate: sim.ate.length, end: sim.end || 'out' });
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
  if (sim.n !== steps || String(m.end) !== end || Number(m.ate) !== sim.ate.length) return { why: 'replay' };   // (ended sooner, or not as said)
  return { why: null, sim };
}
export function apply(mini, p, m, rng, idx) {   // one run: checked (played through again), then its dots kept; a timed-out one ('auto') changes nothing
  const from = munScore(mini, p), target = munTarget(mini);
  if (!mini.ate) mini.ate = { X: [], O: [] };
  if (!mini.tries) mini.tries = { X: 0, O: 0 };
  let to = from, last;
  if (m === 'auto') last = { by: p, auto: true, from, to };
  else {
    const c = munCheck(mini, p, m);
    if (c.why) return { ok: false, reason: c.why };
    const set = new Set(munAte(mini, p));
    for (const cell of c.sim.ate) set.add(cell);
    mini.ate[p] = [...set].sort((a, b) => a - b);
    to = mini.ate[p].length;
    last = { by: p, from, to, log: m.log, steps: c.sim.n, end: c.sim.end || 'out', try: munTries(mini, p), ate: c.sim.ate.slice() };
  }
  mini.tries[p] = munTries(mini, p) + 1;
  mini.last = last;
  if (to >= target) return { ok: true, outcome: 'win', note: 'target' };
  return { ok: true, outcome: 'continue', note: last.auto ? 'out' : to > from ? 'ate' : 'none' };
}
export function publicView(mini) {   // nothing is hidden: the maze, each player's dots and runs
  return { type: 'muncher', lay: mini.lay, seed: mini.seed, ate: { X: munAte(mini, 'X').slice(), O: munAte(mini, 'O').slice() }, tries: { X: munTries(mini, 'X'), O: munTries(mini, 'O') }, last: mini.last ? JSON.parse(JSON.stringify(mini.last)) : null };
}
export function randomMove(mini, p, rng, from, empties) {
  return munPilot(mini, p, needRng(rng), { kind: 'random' }).move;   // a careless run: any way at every junction
}
// The page's view says which moves are this phone's own (their run played here live: the result alone): flashMs
// then leaves the run out. The server never sets it, so its clock counts the other phone's replay.
export const MUN_VIEW = { own: null };
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last;
  flash.mun = Object.assign({ type: 'muncher', target: munTarget(mini), lay: mini.lay, seed: mini.seed, at: { X: munScore(mini, 'X'), O: munScore(mini, 'O') } }, JSON.parse(JSON.stringify(l)));
}
export function flashMs(f, winLen, won) {
  const g = f.mun, own = MUN_VIEW.own && MUN_VIEW.own(f);
  return (g && !g.auto && !f.timeout && !own ? munMs(g) : 0) + MUN.hold + (won ? MUN.won : 0);   // someone else's run plays through first, then the result (the phone that played it skips that)
}

// ---- the computer's hand ----
// A pilot plays a run through the same steps, deciding a direction every `react` ms: towards the nearest dot by the
// shortest way round the cells within `avoid` of a spook (and, with `predict`, of where it is heading); with no safe
// way, away from the nearest spook; now and then (`lapse`) it forgets the spooks for a moment. 'random' turns any way.
export const MUN_HANDS = {
  random: { kind: 'random' },
  normal: { kind: 'plan', react: 200, avoid: 2, lapse: 0.2, predict: false, explore: 0 },
  hard: { kind: 'plan', react: 33, avoid: 2, lapse: 0, predict: true, explore: 0.1 },
};
export function munHand(mini, level) {
  const cfg = munCfg(mini);
  if (level === 'hard') return MUN_HANDS.hard;
  return Object.assign({}, MUN_HANDS.normal, { react: cfg.aiReact, avoid: cfg.aiAvoid, lapse: cfg.aiLapse });
}
function planDir(sim, hand, rng) {
  const L = sim.L, ch = sim.ch;
  const here = cellAt(ch.x, ch.y), ahead = ch.d >= 0 && ch.f > 0 ? cellAt(ch.x + DIRS[ch.d][0], ch.y + DIRS[ch.d][1]) : here;
  const from = ahead >= 0 && L.open[ahead] ? ahead : here;
  const careless = hand.lapse > 0 && rng() < hand.lapse;
  let danger = null;
  if (!careless && hand.avoid > 0) {
    danger = new Uint8Array(MUN.w * MUN.h);
    for (const g of sim.gh) {
      const cells = [cellAt(g.x, g.y)];
      if (hand.predict && g.d >= 0) cells.push(cellAt(g.x + DIRS[g.d][0], g.y + DIRS[g.d][1]));
      for (const c of cells) { if (c < 0 || !L.open[c]) continue; const d = munDist(L, c, null); for (let k = 0; k < d.length; k++) if (d[k] >= 0 && d[k] <= hand.avoid) danger[k] = 1; }
    }
    danger[from] = 0;
  }
  const dist = munDist(L, from, danger);
  let goal = -1, best = Infinity, second = -1;
  for (let c = 0; c < dist.length; c++) if (sim.dots[c] && dist[c] >= 0) { if (dist[c] < best) { second = goal; best = dist[c]; goal = c; } else if (second < 0 || dist[c] < dist[second]) second = c; }
  if (goal >= 0 && hand.explore > 0 && second >= 0 && rng() < hand.explore) goal = second;
  if (hand.goal >= 0 && sim.dots[hand.goal] && dist[hand.goal] >= 0 && dist[hand.goal] <= best + 2) goal = hand.goal;   // (the dot it was heading for, while it is still a safe way off: no dithering between two)
  hand.goal = goal;
  if (goal >= 0) {                                                // the first step of the shortest safe way to it
    let c = goal;
    while (dist[c] > 1) { const x = c % MUN.w, y = (c - x) / MUN.w; for (const [dx, dy] of DIRS) { const nc = cellAt(x + dx, y + dy); if (nc >= 0 && dist[nc] === dist[c] - 1) { c = nc; break; } } }
    const fx = from % MUN.w, fy = (from - fx) / MUN.w, cx = c % MUN.w, cy = (c - cx) / MUN.w;
    const dir = DIRS.findIndex(([dx, dy]) => fx + dx === cx && fy + dy === cy);
    if (dir >= 0) return dir;
  }
  // no safe way to a dot: the neighbour farthest from the nearest spook
  const far = sim.gh.map(g => munDist(L, cellAt(g.x, g.y), null));
  const safety = c => far.reduce((m, d) => Math.min(m, d[c] < 0 ? 99 : d[c]), 99);
  const fx = from % MUN.w, fy = (from - fx) / MUN.w;
  let bestD = -1, bestS = safety(from);
  for (let d = 0; d < 4; d++) { const nc = cellAt(fx + DIRS[d][0], fy + DIRS[d][1]); if (nc < 0 || !L.open[nc]) continue; const s = safety(nc); if (s > bestS) { bestS = s; bestD = d; } }
  return bestD;
}
// The computer's run (or a careless one): the move and the run as played. `until`: ms the pilot may still spend (null: no clock).
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
  for (let t = 0; t < tries; t++) {
    if (t > 0 && typeof until === 'function' && until() <= 0) break;
    const r = munPilot(mini, p, makeRng('munai:' + rng()), hand);
    if (!best || r.move.ate > best.move.ate || (r.move.ate === best.move.ate && r.move.steps < best.move.steps)) best = r;
  }
  return best;
}
// Super Chaos: each player's dots and runs are their own (the default fork and merge keep them apart).
