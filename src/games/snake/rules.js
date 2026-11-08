// Snake: the rules (pure: no page, no clock; the server runs the same code). Not Snakes and Ladders (id `snakes`).
import { courseSeed, makeRng, randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';
import { fingLog, fingUnlog } from '../shared/finger.js';

// ---------- Snake: one run a turn on a small garden grid ----------
// A move is one run: Start, then the snake sets off from the middle of the grid (three cells long, heading
// right) and moves a cell every tick (tune: `tick` ms, `speedUp` ms less for every apple eaten in the run,
// never under `minTick`); a swipe turns it; an apple eaten makes it a cell longer and puts the next apple
// on a free cell; the wall or its own body ends the run, as does the run's time cap (`runCap`), and the
// turn's clock running out (the run ends as it stands). Every apple of the run goes on the player's total;
// the first total at `target` wins the square. Each run starts clean (the length, the speed), so a player's
// total is the one thing that carries over. The run is worked out in ticks of plain arithmetic from its
// inputs alone (the turns, each at its tick) and the apples come from the attempt's own seed (the square's
// seed, the player and their attempt number), so the same log gives the same run on every phone and on the
// server: the move goes in as its log, and the server plays it through again (snakeCheck) and takes the
// result only when it is the same, tick for tick. The computer plays the same way, with a hand of its own
// (snakeAi: an autopilot that paths to the apple and misses a turn now and then, as a person does).
export const SNAKE = { n: 11, len: 3, hold: 700, endPause: 850, winPause: 900 };   // n: the grid; len: a fresh snake; hold: the result's time after a run; endPause: a crash shows this long before the run goes in
export const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];   // the direction codes: 0 right, 1 down, 2 left, 3 up (the log's values)
export const snakeMaxTicks = cfg => Math.ceil((cfg.runCap * 1000) / cfg.minTick) + 2;
const cell = (sim, x, y) => y * sim.n + x;
export function snakePlace(sim) {                                  // the next apple: a free cell, from the attempt's seed; now and then a golden one (worth more: tune gold, goldWorth)
  const taken = new Set(sim.body.map(([x, y]) => cell(sim, x, y))), free = [];
  for (let c = 0; c < sim.n * sim.n; c++) if (!taken.has(c)) free.push(c);
  if (!free.length) return null;
  const c = free[randInt(sim.rng, free.length)], gold = sim.rng() < sim.cfg.gold / 100;
  return [c % sim.n, Math.floor(c / sim.n), gold ? 1 : 0];
}
// A fresh run for p: the snake in the middle heading right, the first apple placed, nothing moved yet.
export function snakeStart(mini, p) {
  const cfg = tune(mini), n = SNAKE.n, mid = Math.floor(n / 2), body = [];
  for (let i = 0; i < SNAKE.len; i++) body.push([mid - i, mid]);
  const sim = { type: 'snake', p, cfg, n, body, dir: 0, apple: null, rng: makeRng(`snake:${mini.seed[p]}:${p}:${mini.tries[p]}`), k: 0, ms: 0, at: [0], ate: 0, eaten: 0, from: mini.score[p], goal: cfg.target, rec: [], end: null, last: null, turned: false };   // ate: the apples' worth so far (a golden one counts goldWorth); eaten: how many
  sim.apple = snakePlace(sim);
  return sim;
}
export const snakeTickMs = sim => Math.max(sim.cfg.minTick, sim.cfg.tick - sim.cfg.speedUp * sim.eaten);
export const snakeNext = sim => { const [hx, hy] = sim.body[0], [dx, dy] = DIRS[sim.dir]; return [hx + dx, hy + dy]; };   // the cell the head goes into next
export const snakeEats = sim => { const [x, y] = snakeNext(sim); return !!sim.apple && sim.apple[0] === x && sim.apple[1] === y; };
// One tick: the turn, if one came and it is not straight back; then a cell forward. Into the wall or the
// body (the tail cell is free unless the snake eats this tick, since the tail moves on) ends the run; the
// apple eaten grows it by a cell and places the next one; the total at the target wins the run ('top');
// a tick that would pass the run's time cap is not taken ('out').
export function snakeTick(sim, dir) {
  if (sim.end) return sim;
  const ms = snakeTickMs(sim);
  sim.last = null; sim.turned = false;
  if (sim.ms + ms > sim.cfg.runCap * 1000 + 1e-9) { sim.end = 'out'; return sim; }
  if (dir != null && dir !== sim.dir && (dir + 2) % 4 !== sim.dir) { sim.dir = dir; sim.rec.push([sim.k, dir]); sim.turned = true; sim.last = 'turn'; }
  const eat = snakeEats(sim), [nx, ny] = snakeNext(sim);
  sim.k += 1; sim.ms += ms; sim.at.push(sim.ms);
  if (nx < 0 || ny < 0 || nx >= sim.n || ny >= sim.n) { sim.end = 'wall'; return sim; }
  const tail = sim.body.length - 1;
  for (let i = 0; i < sim.body.length; i++) { if (i === tail && !eat) continue; if (sim.body[i][0] === nx && sim.body[i][1] === ny) { sim.end = 'self'; return sim; } }
  sim.body.unshift([nx, ny]);
  if (eat) {
    sim.eaten += 1; sim.ate += sim.apple[2] ? sim.cfg.goldWorth : 1; sim.last = sim.apple[2] ? 'gold' : 'eat';
    if (sim.from + sim.ate >= sim.goal) { sim.apple = null; sim.end = 'top'; return sim; }
    sim.apple = snakePlace(sim);
    if (!sim.apple) sim.end = 'top';
  } else sim.body.pop();
  return sim;
}
// The run played through from its inputs ([tick, dir] pairs): the same ticks the phone took.
export function snakeReplay(mini, p, log, ticks) {
  const sim = snakeStart(mini, p);
  let j = 0;
  while (sim.k < ticks && !sim.end) {
    let d = null;
    if (j < log.length && log[j][0] === sim.k) d = log[j++][1];
    snakeTick(sim, d);
  }
  sim.j = j;
  return sim;
}
// The result of a run, as a move: its log, its ticks, the apples' worth (n) and how it ended.
export const snakeResult = sim => ({ log: fingLog(sim.rec), ticks: sim.k, n: sim.ate, end: sim.end || 'stop' });
// A move checked: played through again from its log, and taken only when it ends just as it says (the same
// tick, the same apples, the same end: a crash, the target, the cap, or stopped by the clock). { why } or { sim }.
export function snakeCheck(mini, p, m) {
  if (!m || typeof m !== 'object') return { why: 'bad' };
  const cfg = tune(mini), ticks = Number(m.ticks);
  if (!Number.isInteger(ticks) || ticks < 1 || ticks > snakeMaxTicks(cfg)) return { why: 'bad' };
  if (!['wall', 'self', 'top', 'out', 'stop'].includes(m.end)) return { why: 'bad' };
  const log = fingUnlog(m.log, ticks, 3);
  if (!log) return { why: 'bad' };
  const sim = snakeReplay(mini, p, log, ticks);
  if (sim.j !== log.length) return { why: 'bad' };                 // (a turn at a tick never made)
  if (!sim.end && m.end === 'out') snakeTick(sim, null);           // the cap: the next tick refused, or not
  if (sim.k !== ticks || (sim.end || 'stop') !== m.end || Number(m.n) !== sim.ate) return { why: 'replay' };
  return { why: null, sim };
}
// How long a run as sent lasted, in ms (core/verify.js: no longer than the turn has lasted): its ticks played
// through, each at its own length (a tick shrinks with every apple of the run); a run that does not play as
// sent (apply refuses it anyway) counts its ticks at the shortest tick.
export function snakeRunMs(mini, p, m) {
  const c = snakeCheck(mini, p, m);
  if (c.sim) return c.sim.ms;
  const ticks = Number(m && m.ticks);
  return Number.isFinite(ticks) && ticks > 0 ? Math.round(ticks * tune(mini).minTick) : 0;
}

// ---------- the computer's hand ----------
// An autopilot: every tick it looks for the shortest way to the apple (cells the tail will have left by the
// time it gets there count as free), and goes that way; with no way, it keeps to the neighbour with the most
// room. Hard checks the way ahead leaves it room enough for its whole body (never into a pocket). Like a
// person it misses a turn now and then (snakeErr: a base chance, more for every apple of the run and the
// faster it goes), going straight a tick longer, which at a wall or its own body is the end of the run.
export function snakeHand(mini, level) {
  const t = tune(mini), hard = level === 'hard', easy = level === 'easy';
  return { err: Math.min(1, (hard ? t.aiErrHard : easy ? t.aiErr * 2 : t.aiErr) / 100), grow: Math.min(1, (hard ? t.aiGrowHard : easy ? t.aiGrow * 1.5 : t.aiGrow) / 100), safe: hard };
}
// The chance the hand misses a turn this tick: its base, more for every apple of the run (a longer, faster snake is harder to steer, as a person finds).
export const snakeErr = (sim, hand) => Math.min(1, (hand.err + hand.grow * sim.eaten) * (sim.cfg.tick / snakeTickMs(sim)));
function freeAfter(sim) {                                           // grid[c]: ticks until the cell is free (0: free now)
  const g = new Int16Array(sim.n * sim.n), L = sim.body.length;
  sim.body.forEach(([x, y], i) => { g[cell(sim, x, y)] = L - i; });
  return g;
}
function snakeBfs(sim, g, from, goal) {                               // the shortest way from `from` to `goal` (or the room reachable: goal null); dist by cell, -1 unreached
  const n = sim.n, dist = new Int16Array(n * n).fill(-1), q = [from];
  dist[from] = 0;
  for (let h = 0; h < q.length; h++) {
    const c = q[h], d = dist[c] + 1, x = c % n, y = Math.floor(c / n);
    if (c === goal) break;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
      const k = ny * n + nx;
      if (dist[k] >= 0 || g[k] > d) continue;
      dist[k] = d; q.push(k);
    }
  }
  return { dist, reached: q.length };
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
function roomVia(sim, g, dir) {                                     // the cells reachable after a step in dir (the body moved on a tick), or -1 if the step itself is fatal
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
  const g = freeAfter(sim), head = cell(sim, sim.body[0][0], sim.body[0][1]);
  let want = null;
  if (sim.apple) {
    const goal = cell(sim, sim.apple[0], sim.apple[1]), { dist } = snakeBfs(sim, g, head, goal);
    if (dist[goal] > 0) want = firstStep(sim, dist, goal);
  }
  if (want != null && hand.safe && roomVia(sim, g, want) < sim.body.length) want = null;   // Hard: not into a pocket too small for it
  if (want == null) {                                              // no way (or not a safe one): the most room, straight on if it is as good
    let best = -1, bestDir = null;
    for (const d of [sim.dir, (sim.dir + 1) % 4, (sim.dir + 3) % 4]) { const r = roomVia(sim, g, d); if (r > best) { best = r; bestDir = d; } }
    want = bestDir;
  }
  return want;
}
// The computer's run: the autopilot with its misses, the inputs logged like anyone's.
export function snakeAi(mini, p, rng, hand) {
  hand = hand || snakeHand(mini, 'normal');
  const sim = snakeStart(mini, p), max = snakeMaxTicks(sim.cfg);
  let late = false;
  while (!sim.end && sim.k < max) {
    let d = snakePlan(sim, hand);
    if (d != null && d !== sim.dir && !late && rng() < snakeErr(sim, hand)) { d = null; late = true; }   // a turn missed by a tick (the faster, the more often)
    else late = false;
    snakeTick(sim, d);
  }
  return { move: snakeResult(sim), sim };
}
// The computer's runs still needed, about (what it gets in one, from its hand: tests/sim/snake.sim.js).
export const SNAKE_GAIN = 7.8;
export const snakeNeeds = (mini, p) => Math.max(1, (tune(mini).target - mini.score[p]) / SNAKE_GAIN);

// ---------- the replay log (ui/replay.js): the run as the other side sees it ----------
// The mover's phone notes the run as it plays, in chunks every chunkMs ('go' at the first tick, then
// 'k=<ticks so far>|<tick>:<dir>,...' with the turns since the last chunk, and 'end=<ticks>|...' once the
// run is over), riding the move as its replay log; the other phone plays the run through from them at the
// same pace, a little behind (lagMs, so a chunk is always there before its ticks are due). A log that is
// not whole (an older page, a bot's run, too many chunks) is not used: the run then plays from the move's
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
  const list = [[0, SNAKE_REP.act, 'go']];
  let j = 0;
  const upTo = K => { const turns = []; while (j < sim.rec.length && sim.rec[j][0] < K) turns.push(sim.rec[j++]); return turns; };
  const endAt = sim.ms + (sim.end === 'top' ? SNAKE.winPause : SNAKE.endPause);
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
  return { type, seed: courseSeed(rng), score: { X: 0, O: 0 }, tries: { X: 0, O: 0 }, last: null };   // seed: the apples' seed (with the player and the attempt's number); score: apples so far; tries: runs made
}
// One run: checked (played through again from its log), then its apples added; a timed-out player ('auto') adds nothing.
export function apply(mini, p, m, rng, idx) {
  const cfg = tune(mini), from = mini.score[p];
  let to = from, last;
  if (m === 'auto') last = { by: p, auto: true, from, to, try: mini.tries[p] };
  else {
    const c = snakeCheck(mini, p, m);
    if (c.why) return { ok: false, reason: c.why };
    to = Math.min(cfg.target, from + c.sim.ate); mini.score[p] = to;
    last = { by: p, from, to, n: c.sim.ate, eaten: c.sim.eaten, ticks: c.sim.k, end: m.end, ms: c.sim.ms, len: c.sim.body.length, log: m.log, try: mini.tries[p] };
  }
  mini.tries[p] += 1;
  mini.last = last;
  if (to >= cfg.target) return { ok: true, outcome: 'win', note: 'top' };
  return { ok: true, outcome: 'continue', note: last.auto ? 'out' : to > from ? 'up' : 'none' };
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last;
  flash.snake = Object.assign({ goal: tune(mini).target, at: { X: mini.score.X, O: mini.score.O }, ai: !!(m && typeof m === 'object' && m.ai) }, JSON.parse(JSON.stringify(l)));
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
  return 'auto';       // the run ends where it stands: no apples from it
}
