// The computer player on the main board: what a square is worth, what a move changes, its move; and the
// dispatch to each game's tactics (its ai.js: needs, best).
import { LINES } from './board.js';
import { canMove, publicMini, randomLegalMove } from './minis.js';
import { needRng, randInt } from './random.js';
import { other } from './util.js';
import { fingPlay } from '../games/shared/finger.js';
import { ECHO, echoSeq } from '../games/echo/rules.js';
import { aiOf } from '../games/index.js';
import { LEVELS, aiWeights, levelOf } from './aiw.js';
import { mcPick } from './mc.js';

/* ===================== Computer player =====================
 * The computer plays fairly: every decision starts from publicMini(), which holds only what a
 * person looking at the screen could know. The hidden word, number, ship, treasure, face-down
 * cards and future dice or coin results never reach the code below.
 *
 * Each turn it scores the best local move in every open square:
 *   score = (value of the square on the main board) x (how much the move shifts the chance of claiming it)
 * and plays the highest. A move that claims a match-winning square is taken at once.
 *
 * Three levels (aiw.js): Normal is that computer; Easy is the same one, careless now and then (EASY); Hard
 * chooses its square by Monte Carlo playouts of the rest of the match (mc.js) and, inside the squares, by
 * search where a game has one (its ai.js reads ctx.level and ctx.until, the ms it may spend). A decision is
 * kept inside opts.budget ms when the caller passes a clock (opts.clock; the page runs it in a worker);
 * without one, the searches do a fixed amount of work.
 */
export const AI = { win: 1000, block: 600 };
export function needsOf(pm, p) {
  const game = aiOf(pm.type);
  if (game.needs) return game.needs(pm, p);
  return Infinity;
}
// Chance that the side needing `a` more moves claims the square before the side needing `b` (the even split the
// moves' gains are weighed with).
export function winChance(a, b) {
  if (a <= 0) return 1;
  if (b <= 0) return 0;
  if (a === Infinity && b === Infinity) return 0.5;        // a dead square: it will draw and reset
  if (a === Infinity) return 0;
  if (b === Infinity) return 1;
  return b / (a + b);
}
// The same chance as a race really goes, for judging a square hopeless (catchUp): b^k / (a^k + b^k). b / (a + b)
// is far too even there: four turns behind in Risky Rolls it gave 27% where the exact odds (pig/ai.js pigRace)
// are 3.6%; RACE_K 2 halves its error against them.
export const RACE_K = 2;
export function raceChance(a, b) {
  if (!(a > 0) || !(b > 0) || a === Infinity || b === Infinity) return winChance(a, b);
  const x = Math.pow(a, RACE_K), y = Math.pow(b, RACE_K);
  return y / (x + y);
}
// A square the other side is well ahead in: when it leads by CATCH.lead moves or more and the computer's
// chance of catching up (its chance of the square after its move, raceChance) is under CATCH.odds, the square counts
// CATCH.factor of its worth, so the computer builds a lead elsewhere. Not when the square would win the other
// side the match (its worth includes the block) and the computer can still stop it (a chance of CATCH.stop or more).
export const CATCH = { lead: 2, odds: 0.15, stop: 0.05, factor: 0.2 };
export function catchUp(a, b, value) {
  if (!(a > b) || !(a - b >= CATCH.lead)) return 1;              // only where the other side is ahead: never a square it leads or is level in (Infinity - Infinity: a dead square, not a race)
  const chance = raceChance(Math.max(0.5, a - 1), b);
  if (chance >= CATCH.odds) return 1;
  if (value >= AI.block && chance >= CATCH.stop) return 1;
  return CATCH.factor;
}
// A square it is close to winning (Hard): this move takes it more often than not (q), or it needs at most
// CLOSE.near more moves there and the other side needs more; and it matters on the main board (a line still
// open through it: worth CLOSE.value or more). Hard plays it ahead of anything else (mc.js mcPick), but for a
// block of the other side's match: left alone, the other side catches up there.
export const CLOSE = { q: 0.5, near: 1.5, value: 1.5 };
export function closeTo(pm, me, local, value) {
  if (!(value >= CLOSE.value)) return false;
  const a = needsOf(pm, me), b = needsOf(pm, other(me));
  return (local.q || 0) >= CLOSE.q || (a <= CLOSE.near && a < b);
}
export function localBest(pm, me, rng, style, ctx) {
  const game = aiOf(pm.type);
  if (game.best) return game.best(pm, me, rng, style, ctx);
  throw new Error('no tactics for ' + pm.type);
}

// ---- the match: what a square is worth, what a move changes ----
// A playing style (the matchmaking bots' personalities; the computer opponent plays STYLE0): attack and
// defend weigh the lines still open for itself and for the other side, defend also how hard it blocks a
// line about to be completed; mistake is the chance of a careless move (any legal move in any open
// square); rollRisk adds to the score it banks at in Risky Rolls (bolder above zero, warier below).
export const STYLE0 = { attack: 1, defend: 1, mistake: 0, rollRisk: 0 };
export const EASY = { mistake: 0.3 };                            // Easy: a careless move this often (any legal move, anywhere open)
export const BUDGET_MS = 300;                                    // Hard: a decision's time, with a clock
export const AI_CLOCK = { now: null };                           // the clock, set once by the page or the server (null: the tests, deterministic)
export function squareValue(squares, i, me, style) {
  const s = style || STYLE0;
  const o = other(me);
  let v = 0.5, win = false, block = false;                 // every square counts a little
  for (const line of LINES) {
    if (!line.includes(i)) continue;
    const rest = line.filter(k => k !== i).map(k => squares[k].owner);
    const mine = rest.filter(x => x === me).length, theirs = rest.filter(x => x === o).length;
    if (mine === 2) win = true;
    if (theirs === 2) block = true;
    if (!theirs) v += s.attack * [1, 3, 0][mine];            // a line still open for me, better with my square on it
    if (!mine) v += s.defend * [1, 3, 0][theirs];            // a line still open for them, worth blocking
  }
  if (win) return AI.win;
  if (block) return AI.block * Math.min(1, s.defend) + v;
  return v;
}
// How much the local move shifts the chance of claiming the square (negative when it hands the other side more).
export function moveGain(pm, me, local) {
  const o = other(me);
  const a = needsOf(pm, me), b = needsOf(pm, o), before = winChance(a, b);
  if (local.after) return (local.win ? 1 : winChance(needsOf(local.after, me), needsOf(local.after, o))) - before;
  const q = local.q || 0, qLose = local.qLose || 0;            // qLose: the chance the move hands the square to the other side
  if (local.stay) return q * (1 - before) - qLose * before;      // stay: a move that fails leaves the square as it was (Risky Rolls going for the target: a bust)
  const after = winChance(Math.max(0.5, a - 1), local.shared ? Math.max(0.5, b - 1) : b);
  return q * (1 - before) - qLose * before + (1 - q - qLose) * (after - before);
}
// Echo: the computer's attempt as taps, from its decision to pass or to slip (at a random step).
export function cpuEcho(mini, me, plan, rng) {
  const seq = echoSeq(mini, me, mini.level[me]);
  if (plan.echo === 'pass') return seq.slice();
  const at = Math.min(seq.length - 1, Math.floor(plan.at * seq.length));
  let wrong = randInt(needRng(rng), ECHO.pads - 1); if (wrong >= seq[at]) wrong++;
  return seq.slice(0, at).concat(wrong);
}
// The computer's move for the side to play: { square, move, score }. During a bonus move the square is fixed.
// opts: level ('easy' | 'normal' | 'hard'; else the match's state.cpuLevel, else normal), clock (a function
// giving ms, for the time budget), budget (ms), pre ({ square: local } tactics worked out by the caller, e.g.
// the physics games' outside the worker), noFing (leave a finger game's attempt to the caller: fingPlay).
export function cpuMove(state, rng, style, opts) {
  rng = needRng(rng); opts = opts || {};
  const level = levelOf(opts.level || state.cpuLevel), hard = level === 'hard', w = hard ? aiWeights() : null;
  const st = Object.assign({}, STYLE0, hard ? { attack: w.attack, defend: w.defend, rollRisk: w.rollRisk } : null, level === 'easy' ? EASY : null, style || {});
  const me = state.turn;
  const open = state.lock != null ? [state.lock] : state.only != null ? [state.only].filter(i => !state.squares[i].owner && canMove(state.squares[i].mini, me))   // (the admin's test play: its one square)
    : state.squares.map((s, i) => (s.owner || !canMove(s.mini, me) ? -1 : i)).filter(i => i >= 0);   // not a square where it is stuck
  if (!open.length) return null;
  if (st.mistake > 0 && open.length && rng() < st.mistake) {      // a careless move: anything legal, anywhere open
    const i = open[randInt(rng, open.length)], m = randomLegalMove(state.squares[i].mini, me, rng);
    if (m != null) return { square: i, move: m, score: 0, value: 0, gain: 0, careless: true };
  }
  const clock = hard ? (typeof opts.clock === 'function' ? opts.clock : AI_CLOCK.now) : null, budget = opts.budget || BUDGET_MS, t0 = clock ? clock() : 0;
  const share = clock ? budget * 0.6 / open.length : 0;           // each square's search gets its share; the playouts the rest
  const pre = opts.pre || {}, done = () => (opts.noFing ? best : fingPlay(state, best, me, rng));
  let best = null;
  const cands = [];
  const owned = p => state.squares.filter(s => s.owner === p).length, behind = owned(other(me)) - owned(me);
  for (const i of open) {
    const pm = publicMini(state.squares[i].mini);
    const real = squareValue(state.squares, i, me, st);
    const at = clock ? clock() : 0, until = clock ? () => Math.max(0, at + share - clock()) : null;
    const local = pre[i] || localBest(pm, me, rng, st, { value: real, behind, level, until });
    const value = state.lock != null ? 1 : real;
    if (pm.type === 'echo' && local.move && local.move.echo) local.move = cpuEcho(state.squares[i].mini, me, local.move, rng);
    if (value >= AI.win && (local.win || local.q >= 1)) { best = { square: i, move: local.move, score: Infinity, value, gain: 1 }; return done(); }
    const gain = moveGain(pm, me, local);
    const score = value * Math.max(gain, 0.01) * catchUp(needsOf(pm, me), needsOf(pm, other(me)), value);
    cands.push({ square: i, pm, local, value, gain, score, close: hard && closeTo(pm, me, local, real) });
    if (!best || score > best.score) best = { square: i, move: local.move, score, value, gain };
  }
  if (hard && cands.length > 1) best = mcPick(state, me, cands, rng, w, st, clock ? () => Math.max(0, t0 + budget - clock()) : null);
  return done();
}
