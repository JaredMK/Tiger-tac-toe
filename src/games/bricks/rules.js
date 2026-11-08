// Brick Break: the rules (pure: no page, no clock; the server runs the same code).
// A square deals one wall of bricks (rows x columns) and each player keeps their own copy of it: a go is one ball,
// served onto the player's paddle; the ball bounces off the sides, the top, the paddle and the bricks, and every brick
// it hits breaks and stays broken for that player. The ball past the paddle (or the go's time up) ends the go. The
// first to clear their whole wall wins the square. A go is worked out here in fixed steps of plain arithmetic, so the
// same inputs give the same go everywhere: the phone sends where the finger put the paddle, step by step (the log),
// with the result, and the server plays the inputs through again and takes the result only when it is the same.
// The serve's angle comes from the square's seed and the go's number, so every phone and the server serve alike.
import { courseSeed, gaussOf, makeRng } from '../../core/random.js';
import { tune, tuneLive } from '../../core/tune.js';
import { fingLog, fingRecorder, fingUnlog } from '../shared/finger.js';

// The field is w wide and h high (units; y up, the floor at 0). The paddle's top is at padY; the ball's radius r; the
// paddle slides at up to pv units a second towards the finger; a go begins with the ball riding the paddle for grace
// seconds, then it is served at an angle between serve[0] and serve[1] degrees off straight up, left or right. The
// bricks hang from top, each bh high. maxAng: the widest angle off straight up a paddle hit sends the ball; cap: how
// much faster the ball may get. step: the simulation step; every: the finger is read every 2 steps; q: the finger's
// place is kept to 1/50 of a unit; replayMax: a longer go replays faster, in this long (ms); slackSteps: a go may
// run this many steps past its time, for the step the time ran out on.
export const BRK = { w: 10, h: 14, step: 1 / 120, every: 2, q: 50, r: 0.22, padY: 1.2, padH: 0.3, pv: 26, grace: 0.7, serve: [15, 40], bh: 0.6, top: 13.1, maxAng: 60, cap: 1.6, replayMax: 30000, slackSteps: 4, end: { miss: 650, clear: 700, out: 400 } };
const DEG = Math.PI / 180;
export const brkCfg = mini => tune(mini);
export const brkClampX = (x, half) => Math.max(half, Math.min(BRK.w - half, x));
export const brkGrid = cfg => ({ rows: cfg.rows, cols: cfg.cols, n: cfg.rows * cfg.cols, bw: BRK.w / cfg.cols });
export const brkSpeed = (cfg, t) => cfg.speed * Math.min(BRK.cap, 1 + (cfg.speedUp / 100) * t);
export const brkTotal = mini => mini.wall.X.length;                                   // bricks in a wall
export const brkLeft = (mini, p) => mini.wall[p].reduce((s, b) => s + (b ? 1 : 0), 0);   // standing, for p
export const brkBroken = (mini, p) => brkTotal(mini) - brkLeft(mini, p);
export const brkMaxSteps = cfg => Math.round(cfg.runSecs / BRK.step) + BRK.slackSteps;
// The serve of p's next go: its angle (radians, signed), the same on every phone and the server.
export function brkServe(mini, p, k) {
  const rng = makeRng(`brk:${mini.seed[p]}:${p}:${k == null ? mini.tries[p] : k}`);
  const a = (BRK.serve[0] + (BRK.serve[1] - BRK.serve[0]) * rng()) * DEG;
  return rng() < 0.5 ? -a : a;
}
// A go from p's wall as it stands: the ball on the paddle in the middle, the serve to come.
export function brkStart(mini, p) {
  const cfg = brkCfg(mini), g = brkGrid(cfg), wall = mini.wall[p].slice();
  const half = cfg.paddle / 2;
  return { type: 'bricks', p, cfg, rows: g.rows, cols: g.cols, bw: g.bw, wall, left: wall.reduce((s, b) => s + (b ? 1 : 0), 0), half, px: BRK.w / 2, tx: BRK.w / 2, x: BRK.w / 2, y: BRK.padY + BRK.r, vx: 0, vy: 0, flying: false, ang: brkServe(mini, p), t: 0, n: 0, broke: [], end: null, last: null, hit: null, pads: 0 };
}
// One step: the paddle slides towards the finger, the ball flies, bounces and breaks. sim.last names what happened this
// step ('serve', 'wall', 'top', 'pad', 'brick'), sim.hit the brick just broken.
export function brkStep(sim, tx) {
  if (sim.end) return sim;
  const h = BRK.step, W = BRK.w, H = BRK.h, r = BRK.r, cfg = sim.cfg;
  if (tx != null) sim.tx = brkClampX(tx, sim.half);
  const d = sim.tx - sim.px, m = BRK.pv * h;
  sim.px = brkClampX(sim.px + (d > m ? m : d < -m ? -m : d), sim.half);
  sim.n += 1; sim.t = sim.n * h; sim.last = null; sim.hit = null;
  if (!sim.flying) {                                              // riding the paddle until the serve
    sim.x = sim.px; sim.y = BRK.padY + r;
    if (sim.t >= BRK.grace - 1e-9) { const s = brkSpeed(cfg, sim.t); sim.flying = true; sim.vx = s * Math.sin(sim.ang); sim.vy = s * Math.cos(sim.ang); sim.last = 'serve'; }
    return sim;
  }
  const s = brkSpeed(cfg, sim.t), cur = Math.sqrt(sim.vx * sim.vx + sim.vy * sim.vy);
  if (cur > 0) { sim.vx *= s / cur; sim.vy *= s / cur; }           // (the ball keeps its speed, gaining a little with time)
  const x0 = sim.x, y0 = sim.y;
  sim.x += sim.vx * h; sim.y += sim.vy * h;
  if (sim.x < r) { sim.x = r; sim.vx = Math.abs(sim.vx); sim.last = 'wall'; }
  else if (sim.x > W - r) { sim.x = W - r; sim.vx = -Math.abs(sim.vx); sim.last = 'wall'; }
  if (sim.y > H - r) { sim.y = H - r; sim.vy = -Math.abs(sim.vy); sim.last = 'top'; }
  if (sim.vy < 0 && y0 - r >= BRK.padY - 1e-9 && sim.y - r < BRK.padY) {   // the ball's bottom crosses the paddle's top this step
    const u0 = (y0 - r - BRK.padY) / Math.max(1e-9, y0 - sim.y), xc = x0 + (sim.x - x0) * u0;   // where it crosses
    if (Math.abs(xc - sim.px) <= sim.half + r) {
      const u = Math.max(-1, Math.min(1, (xc - sim.px) / (sim.half + r))), a = u * BRK.maxAng * DEG;   // the edge sends it wide, the middle straight up
      sim.vx = s * Math.sin(a); sim.vy = s * Math.cos(a); sim.y = BRK.padY + r; sim.x = xc; sim.last = 'pad'; sim.pads += 1;
    }
  }
  const bottom = BRK.top - sim.rows * BRK.bh;
  if (sim.y + r > bottom && sim.y - r < BRK.top) {              // among the bricks: the one it is deepest into breaks, and it bounces off it
    const bw = sim.bw, bh = BRK.bh, j0 = Math.floor(sim.x / bw), i0 = Math.floor((BRK.top - sim.y) / bh);
    let best = null;
    for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) {
      if (i < 0 || i >= sim.rows || j < 0 || j >= sim.cols) continue;
      const k = i * sim.cols + j;
      if (!sim.wall[k]) continue;
      const bx0 = j * bw, by1 = BRK.top - i * bh, by0 = by1 - bh;
      const cx = Math.max(bx0, Math.min(bx0 + bw, sim.x)), cy = Math.max(by0, Math.min(by1, sim.y)), dx = sim.x - cx, dy = sim.y - cy, dd = dx * dx + dy * dy;
      if (dd < r * r && (!best || dd < best.dd)) best = { k, dd, i, j, bx0, by0, by1 };
    }
    if (best) {
      const ndx = (sim.x - (best.bx0 + bw / 2)) / (bw / 2), ndy = (sim.y - (best.by0 + bh / 2)) / (bh / 2);
      if (Math.abs(ndx) > Math.abs(ndy)) { const sg = ndx < 0 ? -1 : 1; sim.vx = sg * Math.abs(sim.vx); sim.x = best.bx0 + bw / 2 + sg * (bw / 2 + r); }   // in from the side: out the way it came
      else { const sg = ndy < 0 ? -1 : 1; sim.vy = sg * Math.abs(sim.vy); sim.y = best.by0 + bh / 2 + sg * (bh / 2 + r); }
      if (sim.x < r) sim.x = r; else if (sim.x > W - r) sim.x = W - r;
      sim.wall[best.k] = 0; sim.left -= 1; sim.broke.push(best.k); sim.last = 'brick'; sim.hit = best.k;
      if (sim.left <= 0) { sim.end = 'clear'; return sim; }
    }
  }
  if (Math.abs(sim.vy) < s * 0.18) sim.vy = (sim.vy < 0 ? -1 : 1) * s * 0.18;   // (never a ball skimming level for ever)
  if (sim.y + r < BRK.padY - 0.6) sim.end = 'miss';
  else if (sim.t >= cfg.runSecs - 1e-9) sim.end = 'out';
  return sim;
}
export const brkResult = sim => ({ n: sim.broke.length, end: sim.end || 'out', steps: sim.n });
// The inputs: [step, finger x] pairs, written small (finger.js fingLog); the recorder notes the finger as it changes.
export const brkLog = fingLog;
export const brkUnlog = (str, steps) => fingUnlog(str, steps, Math.ceil(BRK.w * BRK.q));
export const brkRecorder = fingRecorder;
// A go played through from its inputs (the phone's, the computer's): the same steps the phone took.
export function brkReplay(mini, p, log, steps) {
  const sim = brkStart(mini, p);
  let k = 0;
  while (sim.n < steps && !sim.end) {
    let tx = null;
    if (k < log.length && log[k][0] === sim.n) tx = log[k++][1] / BRK.q;
    brkStep(sim, tx);
  }
  return sim;
}
// A go as sent, played through again: { why } (refused: 'bad', 'replay') or { why: null, sim }.
export function brkCheck(mini, p, m) {
  if (!m || typeof m !== 'object' || m.fing) return { why: 'bad' };
  const steps = Number(m.steps), cfg = brkCfg(mini);
  if (!Number.isInteger(steps) || steps < 1 || steps > brkMaxSteps(cfg)) return { why: 'bad' };
  const log = brkUnlog(m.log, steps);
  if (!log) return { why: 'bad' };
  const sim = brkReplay(mini, p, log, steps), end = sim.end || 'out';
  if (sim.n !== steps || String(m.end) !== end || Number(m.n) !== sim.broke.length) return { why: 'replay' };   // (ended sooner, or not as said)
  return { why: null, sim };
}
// How long a go lasted, and how long it takes to play through on another phone (as it was, or faster past replayMax), ms.
export const brkRaw = b => (!b || b.auto ? 0 : Math.round(Number(b.steps || 0) * BRK.step * 1000));
export const brkMs = b => Math.min(brkRaw(b), BRK.replayMax);

export function create(type, rng) {
  const t = tuneLive(type), n = t.rows * t.cols;
  return { type, seed: courseSeed(rng), wall: { X: Array(n).fill(1), O: Array(n).fill(1) }, tries: { X: 0, O: 0 }, last: null };   // seed: the serves; wall: each player's own, 1 standing, 0 broken; tries: goes taken
}
// One go: checked (played through again), then its bricks come off the player's wall; a timed-out one ('auto')
// changes nothing. The wall cleared wins the square.
export function apply(mini, p, m, rng, idx) {
  const from = brkBroken(mini, p);
  let last;
  if (m === 'auto') last = { by: p, auto: true, from, to: from, try: mini.tries[p] };
  else {
    const c = brkCheck(mini, p, m);
    if (c.why) return { ok: false, reason: c.why };
    for (const k of c.sim.broke) mini.wall[p][k] = 0;
    last = { by: p, from, to: brkBroken(mini, p), log: m.log, steps: Number(m.steps), end: c.sim.end || 'out', broke: c.sim.broke.slice(), pads: c.sim.pads, try: mini.tries[p] };
  }
  mini.tries[p] += 1;
  mini.last = last;
  if (brkLeft(mini, p) === 0) return { ok: true, outcome: 'win', note: 'clear' };
  return { ok: true, outcome: 'continue', note: last.auto ? 'out' : last.to > last.from ? 'up' : 'none' };
}
export function publicView(mini) {
  const c = JSON.parse(JSON.stringify(mini)); if (c.last) delete c.last.log; return c;   // (the inputs ride the move's entry, not the square)
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  flash.brk = Object.assign({ total: brkTotal(mini), at: { X: brkBroken(mini, 'X'), O: brkBroken(mini, 'O') } }, JSON.parse(JSON.stringify(mini.last)));
}
export function flashMs(f, winLen, won) {
  return (f.brk && !f.timeout && !f.brk.auto ? brkMs(f.brk) + (BRK.end[f.brk.end] || 0) : 0) + 500 + (won ? 600 : 0);   // someone else's go plays through first, then its end, then the result (the phone that played it skips to the result)
}
// A careless go (Easy's slips; the tests' random play): an unsteady hand.
export function randomMove(mini, p, rng) {
  return brkAi(mini, p, rng, brkHand(mini, 'easy')).move;
}

// ---------- the computer: an autopilot on the paddle ----------
// Normal's hand sees the ball react seconds late, aims a little off (aim: the spread, in units) and now and then
// misjudges a return altogether (lapse); Hard reacts faster, aims truer, never lapses, and tilts the paddle to send
// the ball at the fullest column; Easy is slower and wider still.
export function brkHand(mini, level) {
  const t = brkCfg(mini), react = [t.aiReact0 / 1000, t.aiReact1 / 1000], aim = t.aiAim / 100, lapse = t.aiLapse / 100;
  if (level === 'hard') return { react: [react[0] * 0.4, react[1] * 0.4], aim: aim * 0.3, lapse: 0, steer: true };
  if (level === 'easy') return { react: [react[0] * 1.5, react[1] * 1.5], aim: aim * 2, lapse: Math.min(1, lapse * 2.5), steer: false };
  return { react, aim, lapse, steer: false };
}
// Where the ball comes down to the paddle's height, flying on as it is (the sides folding it back).
export function brkLanding(sim) {
  if (!sim.flying || sim.vy >= 0) return null;
  const r = BRK.r, dt = (sim.y - (BRK.padY + r)) / -sim.vy, span = BRK.w - 2 * r;
  let x = sim.x - r + sim.vx * dt;
  x = ((x % (2 * span)) + 2 * span) % (2 * span);
  if (x > span) x = 2 * span - x;
  return { x: x + r, dt };
}
// The column with most bricks standing (the nearest of them to x), its middle.
function brkFullest(sim, x) {
  let best = null;
  for (let j = 0; j < sim.cols; j++) {
    let n = 0; for (let i = 0; i < sim.rows; i++) n += sim.wall[i * sim.cols + j] ? 1 : 0;
    const cx = (j + 0.5) * sim.bw;
    if (!best || n > best.n || (n === best.n && Math.abs(cx - x) < Math.abs(best.cx - x))) best = { n, cx };
  }
  return best ? best.cx : BRK.w / 2;
}
// The hand's plan for the paddle this moment: under the landing (judged with this flight's error), tilted to steer;
// the ball on its way up: under the ball.
function brkPlan(sim, hand, rng, memo) {
  if (!sim.flying) return BRK.w / 2;
  const land = brkLanding(sim);
  if (!land) return sim.x;
  if (memo.flight !== sim.pads) {                                 // a new flight down: judged afresh
    memo.flight = sim.pads;
    memo.err = gaussOf(rng) * hand.aim;
    memo.slip = rng() < hand.lapse ? (rng() < 0.5 ? -1 : 1) * (sim.half + BRK.r + 0.5 + rng()) : 0;   // a lapse: the paddle a good way off
    memo.u = hand.steer ? null : (rng() - 0.5) * 0.5;
  }
  let u = memo.u;
  if (u == null) { const dx = brkFullest(sim, land.x) - land.x; u = Math.max(-0.8, Math.min(0.8, Math.atan2(dx, BRK.top - BRK.padY) / (BRK.maxAng * DEG))); }   // (the angle that would carry it to that column, by the paddle's offset)
  return land.x - u * (sim.half + BRK.r) + memo.err + memo.slip;
}
// The computer's go: the move (its inputs, its result), played through.
export function brkAi(mini, p, rng, hand) {
  hand = hand || brkHand(mini, 'normal');
  const sim = brkStart(mini, p), rec = brkRecorder(), memo = { flight: -1, err: 0, slip: 0, u: 0 }, lag = Math.round((hand.react[0] + (hand.react[1] - hand.react[0]) * rng()) / BRK.step), queue = [];
  let aim = sim.px;
  while (!sim.end) {
    if (sim.n % BRK.every === 0) queue.push([sim.n + lag, brkClampX(brkPlan(sim, hand, rng, memo), sim.half)]);
    while (queue.length && queue[0][0] <= sim.n) aim = queue.shift()[1];
    brkStep(sim, rec.at(sim.n, aim));
  }
  const r = brkResult(sim);
  return { move: { log: brkLog(rec.pairs), steps: r.steps, n: r.n, end: r.end }, sim };
}
