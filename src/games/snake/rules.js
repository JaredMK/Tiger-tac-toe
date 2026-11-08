// Snake: the rules (pure: no page, no clock; the server runs the same code). Not Snakes and Ladders (id `snakes`).
import { courseSeed, makeRng, randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';
import { fingLog, fingUnlog } from '../shared/finger.js';

// ---------- Snake: one run a turn on a small garden grid, two colours of food ----------
// A move is one run: Start, then the snake sets off from the middle of the grid (three cells long, heading
// right) and moves exactly one cell every tick, as on the old phones (tune: `tick` ms, `speedUp` ms less for
// every food eaten in the run, never under `minTick`). A swipe (a tap, a key) queues a turn, and the turn
// takes effect on the next tick; up to two turns wait in the queue (SNAKE.queue), so two quick taps make a
// U-turn over two ticks. A turn back into the neck (against the last direction queued, or the snake's own
// when none is) is ignored, as is a turn that does not change the direction, and a third while two wait.
// The grid always holds red food (X's) and yellow food (O's), `food` of each; a food eaten makes the snake a
// cell longer and is put back, the same colour, on a free cell (never on the snake or another food). Your
// own colour is a point for you; the other colour is a point for the other player (the snake still grows).
// The wall or its own body ends the run, as does the run's time cap (`runCap`) and the turn's clock (the run
// ends as it stands). The first total at `target` wins the square, and that can be the other player's,
// reached by food you ate (the run ends there, note 'gift'). Each run starts clean (the length, the speed).
// The run is worked out in ticks of plain arithmetic from its inputs alone (each turn as it was queued, at
// the tick it was queued in) and the food comes from the attempt's own seed (the square's seed, the player
// and their attempt number), so the same log gives the same run on every phone and on the server: the move
// goes in as its log, and the server plays it through again (snakeCheck), queue and all, and takes the
// result only when it is the same, tick for tick. The computer plays the same way, with a hand of its own.
// A square dealt before the two colours (no `v`: one apple, golden ones) plays on with this run and keeps
// its scores and its old target (35, or the one it was dealt with: snakeGoal).
export const SNAKE = { n: 11, len: 3, queue: 2, hold: 700, endPause: 850, winPause: 900, oldTarget: 35 };   // n: the grid; len: a fresh snake; queue: the turns that may wait; hold: the result's time after a run; endPause: a crash shows this long before the run goes in
export const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];   // the direction codes: 0 right, 1 down, 2 left, 3 up (the log's values)
export const SNAKE_ENDS = ['wall', 'self', 'top', 'gift', 'out', 'stop'];
const other = p => (p === 'X' ? 'O' : 'X');
export const snakeMaxTicks = cfg => Math.ceil((cfg.runCap * 1000) / cfg.minTick) + 2;
export const snakeGoal = mini => (mini.v >= 2 || (mini.tune && mini.tune.target != null) ? tune(mini).target : SNAKE.oldTarget);
const cell = (sim, x, y) => y * sim.n + x;
// A free cell for a food of colour c (never on the snake or another food), from the attempt's seed.
export function snakePlace(sim, c) {
  const taken = new Set(sim.body.map(([x, y]) => cell(sim, x, y)));
  for (const f of sim.food) if (f) taken.add(cell(sim, f[0], f[1]));
  const free = [];
  for (let k = 0; k < sim.n * sim.n; k++) if (!taken.has(k)) free.push(k);
  if (!free.length) return null;
  const k = free[randInt(sim.rng, free.length)];
  return [k % sim.n, Math.floor(k / sim.n), c];
}
// A fresh run for p: the snake in the middle heading right, the food placed (X's first, then O's), nothing moved yet.
export function snakeStart(mini, p) {
  const cfg = tune(mini), n = SNAKE.n, mid = Math.floor(n / 2), body = [], q = other(p);
  for (let i = 0; i < SNAKE.len; i++) body.push([mid - i, mid]);
  const sim = { type: 'snake', p, cfg, n, body, dir: 0, q: [], food: [], rng: makeRng(`snake2:${mini.seed[p]}:${p}:${mini.tries[p]}`), k: 0, ms: 0, at: [0], got: 0, gave: 0, eaten: 0, from: mini.score[p], ofrom: mini.score[q], goal: snakeGoal(mini), rec: [], end: null, last: null, turned: false };   // q: the turns waiting; got: points for p; gave: points for the other player; eaten: food of both colours
  for (const c of ['X', 'O']) for (let i = 0; i < Math.max(1, cfg.food | 0); i++) { const f = snakePlace(sim, c); if (f) sim.food.push(f); }
  return sim;
}
export const snakeTickMs = sim => Math.max(sim.cfg.minTick, sim.cfg.tick - sim.cfg.speedUp * sim.eaten);
export const snakeHeading = sim => (sim.q.length ? sim.q[sim.q.length - 1] : sim.dir);   // where the snake will be heading once the queue has played
// A turn queued (the swipe, the tap, the key): taken at the next tick. Ignored when it is no turn (the way it
// already heads), straight back into the neck, or the queue is full. The log keeps each turn queued at the
// tick it came in (its key: 2 x tick, +1 for a second one in the same tick). true when queued.
export function snakeQueue(sim, dir) {
  if (sim.end || !(dir >= 0 && dir <= 3) || sim.q.length >= SNAKE.queue) return false;
  const cur = snakeHeading(sim);
  if (dir === cur || (dir + 2) % 4 === cur) return false;
  const last = sim.rec[sim.rec.length - 1], key = 2 * sim.k + (last && last[0] >> 1 === sim.k ? 1 : 0);
  sim.q.push(dir); sim.rec.push([key, dir]);
  return true;
}
export const snakeNext = sim => { const [hx, hy] = sim.body[0], [dx, dy] = DIRS[sim.dir]; return [hx + dx, hy + dy]; };   // the cell the head goes into (once the tick has taken its turn)
export const snakeFoodAt = (sim, x, y) => sim.food.findIndex(f => f && f[0] === x && f[1] === y);
// One tick: the first turn waiting, if any; then a cell forward. Into the wall or the body (the tail cell is
// free unless the snake eats this tick, since the tail moves on) ends the run; a food eaten grows it by a cell,
// scores (p's colour: p; the other: the other player) and is put back elsewhere; a total at the target ends
// the run ('top' for p, 'gift' for the other player); a tick that would pass the run's time cap is not taken
// ('out'). dir, when given, is queued first (the computer's hand, the tests).
export function snakeTick(sim, dir) {
  if (sim.end) return sim;
  if (dir != null) snakeQueue(sim, dir);
  const ms = snakeTickMs(sim);
  sim.last = null; sim.turned = false;
  if (sim.ms + ms > sim.cfg.runCap * 1000 + 1e-9) { sim.end = 'out'; return sim; }
  if (sim.q.length) { const d = sim.q.shift(); sim.turned = d !== sim.dir; sim.dir = d; if (sim.turned) sim.last = 'turn'; }
  const [nx, ny] = snakeNext(sim), fi = snakeFoodAt(sim, nx, ny), eat = fi >= 0;
  sim.k += 1; sim.ms += ms; sim.at.push(sim.ms);
  if (nx < 0 || ny < 0 || nx >= sim.n || ny >= sim.n) { sim.end = 'wall'; return sim; }
  const tail = sim.body.length - 1;
  for (let i = 0; i < sim.body.length; i++) { if (i === tail && !eat) continue; if (sim.body[i][0] === nx && sim.body[i][1] === ny) { sim.end = 'self'; return sim; } }
  sim.body.unshift([nx, ny]);
  if (!eat) { sim.body.pop(); return sim; }
  const c = sim.food[fi][2], own = c === sim.p;
  sim.eaten += 1;
  if (own) sim.got += 1; else sim.gave += 1;
  sim.last = own ? 'eat' : 'gift'; sim.ate = { c, x: nx, y: ny };
  sim.food[fi] = null;
  if (sim.from + sim.got >= sim.goal) { sim.end = 'top'; return sim; }
  if (sim.ofrom + sim.gave >= sim.goal) { sim.end = 'gift'; return sim; }
  sim.food[fi] = snakePlace(sim, c);
  if (!sim.food.some(Boolean)) sim.end = 'top';                    // (a grid with no room left: as good as it gets)
  return sim;
}
// The turns of the log that came in at the sim's tick, queued (from a Map key -> dir or the log's list at j): false if one was refused.
export function snakeFeed(sim, turns) {
  for (const s of [0, 1]) { const key = 2 * sim.k + s; if (turns.has(key) && !snakeQueue(sim, turns.get(key))) return false; }
  return true;
}
// The run played through from its inputs ([key, dir] pairs, in order): the same queue and ticks the phone had.
export function snakeReplay(mini, p, log, ticks) {
  const sim = snakeStart(mini, p);
  let j = 0;
  sim.bad = false;
  while (sim.k < ticks && !sim.end) {
    while (j < log.length && log[j][0] >> 1 === sim.k) { if (!snakeQueue(sim, log[j][1]) || sim.rec[sim.rec.length - 1][0] !== log[j][0]) { sim.bad = true; break; } j++; }
    if (sim.bad) break;
    snakeTick(sim, null);
  }
  sim.j = j;
  return sim;
}
// The result of a run, as a move: its log (the turns that came in before its last tick), its ticks, the
// points it scored for the mover (n) and for the other player (g), and how it ended.
export const snakeResult = sim => ({ log: fingLog(sim.rec.filter(([key]) => key >> 1 < sim.k)), ticks: sim.k, n: sim.got, g: sim.gave, end: sim.end || 'stop' });
// A move checked: played through again from its log, and taken only when it ends just as it says (the same
// tick, the same points both ways, the same end: a crash, a target, the cap, or stopped by the clock). { why } or { sim }.
export function snakeCheck(mini, p, m) {
  if (!m || typeof m !== 'object') return { why: 'bad' };
  const cfg = tune(mini), ticks = Number(m.ticks);
  if (!Number.isInteger(ticks) || ticks < 1 || ticks > snakeMaxTicks(cfg)) return { why: 'bad' };
  if (!SNAKE_ENDS.includes(m.end)) return { why: 'bad' };
  const log = fingUnlog(m.log, 2 * ticks - 1, 3);
  if (!log) return { why: 'bad' };
  const sim = snakeReplay(mini, p, log, ticks);
  if (sim.bad || sim.j !== log.length) return { why: 'bad' };       // (a turn the queue would not take, or at a tick never made)
  if (!sim.end && m.end === 'out') snakeTick(sim, null);           // the cap: the next tick refused, or not
  if (sim.k !== ticks || (sim.end || 'stop') !== m.end || Number(m.n) !== sim.got || Number(m.g || 0) !== sim.gave) return { why: 'replay' };
  return { why: null, sim };
}
// How long a run as sent lasted, in ms (core/verify.js: no longer than the turn has lasted): its ticks played
// through, each at its own length (a tick shrinks with every food of the run); a run that does not play as
// sent (apply refuses it anyway) counts its ticks at the shortest tick.
export function snakeRunMs(mini, p, m) {
  const c = snakeCheck(mini, p, m);
  if (c.sim) return c.sim.ms;
  const ticks = Number(m && m.ticks);
  return Number.isFinite(ticks) && ticks > 0 ? Math.round(ticks * tune(mini).minTick) : 0;
}

// ---------- the computer's hand ----------
// An autopilot: every tick it looks for the shortest way to the nearest food of its own colour, going round
// the other colour's food as round its body (cells the tail will have left by the time it gets there count as
// free), and queues that way; with no way, it keeps to the neighbour with the most room, the other colour's
// food still kept clear, and eats it only when every other way is the end of the run (never when that food
// would win the square for the other player). Hard checks the way ahead leaves it room enough for its whole
// body (never into a pocket). Like a person it misses a turn now and then (snakeErr: a base chance, more for
// every food of the run and the faster it goes), going straight a tick longer, which at a wall, its own body
// or the other colour's food costs it; and after a food, now and then (`aiSlip`), it loses track for a few
// ticks (SNAKE_LAPSE: no turns at all), which often ends the run, as a person's run so often ends.
export function snakeHand(mini, level) {
  const t = tune(mini), hard = level === 'hard', easy = level === 'easy';
  return { err: Math.min(1, (hard ? t.aiErrHard : easy ? t.aiErr * 2 : t.aiErr) / 100), grow: Math.min(1, (hard ? t.aiGrowHard : easy ? t.aiGrow * 1.5 : t.aiGrow) / 100), slip: Math.min(1, (hard ? t.aiSlipHard : easy ? t.aiSlip * 1.5 : t.aiSlip) / 100), safe: hard };
}
// The chance the hand misses a turn this tick: its base, more for every food of the run (a longer, faster snake is harder to steer, as a person finds).
export const snakeErr = (sim, hand) => Math.min(1, (hand.err + hand.grow * sim.eaten) * (sim.cfg.tick / snakeTickMs(sim)));
const BLOCK = 30000;
function freeAfter(sim, foe) {                                       // grid[c]: ticks until the cell is free (0: free now); the other colour's food never (foe)
  const g = new Int16Array(sim.n * sim.n), L = sim.body.length;
  sim.body.forEach(([x, y], i) => { g[cell(sim, x, y)] = L - i; });
  if (foe) for (const f of sim.food) if (f && f[2] !== sim.p) g[cell(sim, f[0], f[1])] = BLOCK;
  return g;
}
function snakeBfs(sim, g, from, goals) {                             // the shortest way from `from` to the nearest of `goals` (a Set; null: the room reachable); dist by cell, -1 unreached
  const n = sim.n, dist = new Int16Array(n * n).fill(-1), q = [from];
  dist[from] = 0;
  let found = -1;
  for (let h = 0; h < q.length; h++) {
    const c = q[h], d = dist[c] + 1, x = c % n, y = Math.floor(c / n);
    if (goals && h > 0 && goals.has(c)) { found = c; break; }
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
      const k = ny * n + nx;
      if (dist[k] >= 0 || g[k] > d) continue;
      dist[k] = d; q.push(k);
    }
  }
  return { dist, reached: q.length, found };
}
function firstStep(sim, dist, goal) {                               // the direction of the first step on the shortest way to goal
  const n = sim.n;
  let c = goal, d = dist[goal];
  if (d < 0) return null;
  while (d > 1) {
    const x = c % n, y = Math.floor(c / n);
    let prev = -1;
    for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue; const k = ny * n + nx; if (dist[k] === d - 1) { prev = k; break; } }
    c = prev; d -= 1;
  }
  const [hx, hy] = sim.body[0], x = c % n, y = Math.floor(c / n);
  return DIRS.findIndex(([dx, dy]) => hx + dx === x && hy + dy === y);
}
function roomVia(sim, g, dir) {                                     // the cells reachable after a step in dir (the body moved on a tick), or -1 if the step itself is fatal (or onto a blocked food)
  const [hx, hy] = sim.body[0], [dx, dy] = DIRS[dir], nx = hx + dx, ny = hy + dy, n = sim.n;
  if (nx < 0 || ny < 0 || nx >= n || ny >= n) return -1;
  const k = ny * n + nx;
  if (g[k] > 1) return -1;
  const g2 = new Int16Array(g.length);
  for (let c = 0; c < g.length; c++) g2[c] = Math.max(0, g[c] - 1);
  g2[k] = sim.body.length;
  return snakeBfs(sim, g2, k, null).reached - 1;
}
export function snakePlan(sim, hand) {                               // the direction the hand wants this tick (null: straight on)
  const g = freeAfter(sim, true), head = cell(sim, sim.body[0][0], sim.body[0][1]);
  const mine = new Set(sim.food.filter(f => f && f[2] === sim.p).map(f => cell(sim, f[0], f[1])));
  let want = null;
  if (mine.size) {
    const { dist, found } = snakeBfs(sim, g, head, mine);
    if (found >= 0) want = firstStep(sim, dist, found);
  }
  if (want != null && hand.safe && roomVia(sim, g, want) < sim.body.length) want = null;   // Hard: not into a pocket too small for it
  if (want == null) {                                              // no way (or not a safe one): the most room, straight on if it is as good
    const dirs = [sim.dir, (sim.dir + 1) % 4, (sim.dir + 3) % 4];
    const most = gg => { let best = -1, bestDir = null; for (const d of dirs) { const r = roomVia(sim, gg, d); if (r > best) { best = r; bestDir = d; } } return [best, bestDir]; };
    let [best, bestDir] = most(g);
    if (best < 0 && sim.ofrom + sim.gave + 1 < sim.goal) [best, bestDir] = most(freeAfter(sim, false));   // (boxed in: the other colour's food rather than the end, unless it wins them the square)
    want = bestDir;
  }
  return want;
}
// The computer's run: the autopilot with its misses, the inputs queued and logged like anyone's.
export const SNAKE_LAPSE = 6;
export function snakeAi(mini, p, rng, hand) {
  hand = hand || snakeHand(mini, 'normal');
  const sim = snakeStart(mini, p), max = snakeMaxTicks(sim.cfg);
  let late = false, lapse = 0;
  while (!sim.end && sim.k < max) {
    let d = lapse > 0 ? null : snakePlan(sim, hand);
    if (lapse > 0) lapse -= 1;
    else if (d != null && d !== sim.dir && !late && rng() < snakeErr(sim, hand)) { d = null; late = true; }   // a turn missed by a tick (the faster, the more often)
    else late = false;
    if (d != null) snakeQueue(sim, d);
    snakeTick(sim, null);
    if ((sim.last === 'eat' || sim.last === 'gift') && hand.slip && rng() < hand.slip) lapse = SNAKE_LAPSE;   // (lost track for a moment)
  }
  return { move: snakeResult(sim), sim };
}
// What a run is worth to its mover: a win is all; a square handed over is nothing; else points for, less points given.
export const snakeWorth = r => (r.sim.end === 'top' ? 1e6 : r.sim.end === 'gift' ? -1e6 : r.sim.got - r.sim.gave);
// Hard: a few runs of its hand while its time lasts (until: the ms it may still spend, a function; null: all of them), the best kept.
export function snakeBestOf(mini, p, rng, hand, tries, until) {
  let best = null;
  for (let t = 0; t < tries; t++) {
    if (t > 0 && typeof until === 'function' && until() <= 0) break;
    const r = snakeAi(mini, p, makeRng('snkai:' + rng()), hand);
    if (!best || snakeWorth(r) > snakeWorth(best) || (snakeWorth(r) === snakeWorth(best) && r.sim.k < best.sim.k)) best = r;
  }
  return best;
}
// The computer's runs still needed, about (the net points Normal gets in one: tests/sim/snake.sim.js).
export const SNAKE_GAIN = 5.4;
export const snakeNeeds = (mini, p) => Math.max(1, (snakeGoal(mini) - mini.score[p]) / SNAKE_GAIN);

// ---------- the replay log (ui/replay.js): the run as the other side sees it ----------
// The mover's phone notes the run as it plays, in chunks every chunkMs ('go' at the first tick, then
// 'k=<ticks so far>|<key>:<dir>,...' with the turns queued since the last chunk, each by its log key, and
// 'end=<ticks>|...' once the run is over), riding the move as its replay log; the other phone plays the run
// through from them at the same pace, a little behind (lagMs, so a chunk is always there before its ticks are
// due). A chunk at k holds every turn queued before tick k (a turn is noted once it is queued). A log that
// is not whole (an older page, a bot's run, too many chunks) is not used: the run then plays from the move's
// own log, in its flash (flashMs).
export const SNAKE_REP = { chunkMs: 900, lagMs: 1000, valMax: 60, act: 'snk' };
const b36 = v => v.toString(36);
export function snakeChunkVals(prefix, turns) {                      // the chunk's values: as few strings as hold the turns (each within the log's width)
  const out = [];
  let cur = prefix + '|';
  for (const [t, d] of turns) {
    const piece = `${b36(t)}:${d},`;
    if ((cur + piece).length > SNAKE_REP.valMax) { out.push(cur.replace(/[,|]$/, '')); cur = prefix + '|'; }
    cur += piece;
  }
  out.push(cur.replace(/[,|]$/, ''));
  return out;
}
export function snakeChunkParse(val) {
  if (val === 'go') return { go: true };
  const m = /^(k|end)=([0-9a-z]{1,4})\|?((?:[0-9a-z]{1,4}:[0-3],?)*)$/.exec(String(val || ''));
  if (!m) return null;
  const turns = m[3] ? m[3].split(',').filter(Boolean).map(s => { const [t, d] = s.split(':'); return [parseInt(t, 36), Number(d)]; }) : [];
  return { k: parseInt(m[2], 36), end: m[1] === 'end', turns };
}
// The computer's run as a mover's phone would have noted it: for the replay's inputs (view.js replay.synth).
export function snakeSynthList(sim) {
  const list = [[0, SNAKE_REP.act, 'go']], rec = sim.rec.filter(([key]) => key >> 1 < sim.k);
  let j = 0;
  const upTo = K => { const turns = []; while (j < rec.length && rec[j][0] >> 1 < K) turns.push(rec[j++]); return turns; };
  const endAt = sim.ms + (sim.end === 'top' || sim.end === 'gift' ? SNAKE.winPause : SNAKE.endPause);
  for (let T = SNAKE_REP.chunkMs; T < endAt; T += SNAKE_REP.chunkMs) {   // (on through the pause at the end too: no gap the log would cut)
    let K = 0; while (K + 1 < sim.at.length && sim.at[K + 1] <= T) K++;
    for (const v of snakeChunkVals(`k=${b36(K)}`, upTo(K))) list.push([T, SNAKE_REP.act, v]);
  }
  for (const v of snakeChunkVals(`end=${b36(sim.k)}`, upTo(sim.k))) list.push([endAt, SNAKE_REP.act, v]);
  return list;
}
// Is a move's replay log a whole run (from 'go' to its end)? Then the other phone has shown it before the move.
export function snakeRepOk(rep) {
  if (!Array.isArray(rep) || rep.length < 2) return false;
  const mine = rep.filter(e => Array.isArray(e) && e[1] === SNAKE_REP.act);
  if (mine.length < 2) return false;
  const first = snakeChunkParse(mine[0][2]), last = snakeChunkParse(mine[mine.length - 1][2]);
  return !!(first && first.go && last && last.end);
}
export const snakeShown = f => !!(f && f.snake && (f.snake.ai || snakeRepOk(f.rep)));   // the run was (or is) shown before the move: the computer's here, or a phone's noted run

// ---------- the square ----------
export function create(type, rng) {
  return { type, v: 2, seed: courseSeed(rng), score: { X: 0, O: 0 }, tries: { X: 0, O: 0 }, last: null };   // v 2: two colours of food; seed: the food's seed (with the player and the attempt's number); score: points so far; tries: runs made
}
// One run: checked (played through again from its log), then its points added, the mover's and the other
// player's; a timed-out player ('auto') adds nothing. A total at the target wins the square: the mover's
// ('top'), or the other player's from food the mover ate ('gift': the square is theirs).
export function apply(mini, p, m, rng, idx) {
  const goal = snakeGoal(mini), q = other(p), from = mini.score[p], ofrom = mini.score[q];
  let to = from, oto = ofrom, last;
  if (m === 'auto') last = { by: p, auto: true, from, to, ofrom, oto, try: mini.tries[p] };
  else {
    const c = snakeCheck(mini, p, m);
    if (c.why) return { ok: false, reason: c.why };
    to = Math.min(goal, from + c.sim.got); oto = Math.min(goal, ofrom + c.sim.gave);
    mini.score[p] = to; mini.score[q] = oto;
    last = { by: p, from, to, ofrom, oto, n: c.sim.got, g: c.sim.gave, eaten: c.sim.eaten, ticks: c.sim.k, end: m.end, ms: c.sim.ms, len: c.sim.body.length, log: m.log, try: mini.tries[p] };
  }
  mini.tries[p] += 1;
  mini.last = last;
  if (to >= goal) return { ok: true, outcome: 'win', note: 'top' };
  if (oto >= goal) return { ok: true, outcome: 'win', winner: q, note: 'gift' };   // (the other colour's food took them to the target: the square is theirs)
  return { ok: true, outcome: 'continue', note: last.auto ? 'out' : to > from ? 'up' : 'none' };
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last;
  flash.snake = Object.assign({ goal: snakeGoal(mini), at: { X: mini.score.X, O: mini.score.O }, ai: !!(m && typeof m === 'object' && m.ai) }, JSON.parse(JSON.stringify(l)));
}
// Someone else's run plays through first (unless it was shown before the move: the replay's inputs), then the result.
export function flashMs(f, winLen, won) {
  const s = f.snake, run = s && !f.timeout && !s.auto && !snakeShown(f) ? Number(s.ms) || 0 : 0;
  return run + SNAKE.hold + (won ? 600 : 0);
}
export function publicView(mini) {
  const c = JSON.parse(JSON.stringify(mini)); if (c.last) delete c.last.log; return c;   // (the log rides the move's flash)
}
export function randomMove(mini, p, rng, from, empties) {
  return 'auto';       // the run ends where it stands: no points from it
}
// Super Chaos: each player runs in their own copy; both in one square, each total takes both runs' points for it
// (a point given in the other's run counts too), and a total at the target wins it (both at once: a reset).
export function scMerge(m, { base, forks, played }) {
  if (played.length < 2) return null;
  const goal = snakeGoal(m), win = { X: false, O: false };
  for (const p of ['X', 'O']) {
    m.score[p] = Math.min(goal, base.score[p] + (forks.X.score[p] - base.score[p]) + (forks.O.score[p] - base.score[p]));
    win[p] = m.score[p] >= goal;
  }
  return { win };
}
