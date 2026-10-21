// The computer player on the main board: what a square is worth, what a move changes, its move; and the
// dispatch to each game's tactics (its ai.js: needs, best).
import { LINES } from './board.js';
import { canMove, publicMini, randomLegalMove } from './minis.js';
import { needRng, randInt } from './random.js';
import { other } from './util.js';
import { fingPlay } from '../games/shared/finger.js';
import { ECHO, echoSeq } from '../games/echo/rules.js';
import { aiOf } from '../games/index.js';

/* ===================== Computer player =====================
 * The computer plays fairly: every decision starts from publicMini(), which holds only what a
 * person looking at the screen could know. The hidden word, number, ship, treasure, face-down
 * cards and future dice or coin results never reach the code below.
 *
 * Each turn it scores the best local move in every open square:
 *   score = (value of the square on the main board) x (how much the move shifts the chance of claiming it)
 * and plays the highest. A move that claims a match-winning square is taken at once.
 */
export const AI = { win: 1000, block: 600 };
export function needsOf(pm, p) {
  const game = aiOf(pm.type);
  if (game.needs) return game.needs(pm, p);
  return Infinity;
}
// Chance that the side needing `a` more moves claims the square before the side needing `b`.
export function winChance(a, b) {
  if (a <= 0) return 1;
  if (b <= 0) return 0;
  if (a === Infinity && b === Infinity) return 0.5;        // a dead square: it will draw and reset
  if (a === Infinity) return 0;
  if (b === Infinity) return 1;
  return b / (a + b);
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
export function cpuMove(state, rng, style) {
  rng = needRng(rng);
  const st = Object.assign({}, STYLE0, style || {});
  const me = state.turn;
  const open = state.lock != null ? [state.lock] : state.only != null ? [state.only].filter(i => !state.squares[i].owner && canMove(state.squares[i].mini, me))   // (the admin's test play: its one square)
    : state.squares.map((s, i) => (s.owner || !canMove(s.mini, me) ? -1 : i)).filter(i => i >= 0);   // not a square where it is stuck
  if (!open.length) return null;
  if (st.mistake > 0 && open.length && rng() < st.mistake) {      // a careless move: anything legal, anywhere open
    const i = open[randInt(rng, open.length)], m = randomLegalMove(state.squares[i].mini, me, rng);
    if (m != null) return { square: i, move: m, score: 0, value: 0, gain: 0, careless: true };
  }
  let best = null;
  const owned = p => state.squares.filter(s => s.owner === p).length, behind = owned(other(me)) - owned(me);
  for (const i of open) {
    const pm = publicMini(state.squares[i].mini);
    const real = squareValue(state.squares, i, me, st);
    const local = localBest(pm, me, rng, st, { value: real, behind });
    const value = state.lock != null ? 1 : real;
    if (pm.type === 'echo' && local.move && local.move.echo) local.move = cpuEcho(state.squares[i].mini, me, local.move, rng);
    if (value >= AI.win && (local.win || local.q >= 1)) return fingPlay(state, { square: i, move: local.move, score: Infinity, value, gain: 1 }, me, rng);
    const gain = moveGain(pm, me, local);
    const score = value * Math.max(gain, 0.01);
    if (!best || score > best.score) best = { square: i, move: local.move, score, value, gain };
  }
  return fingPlay(state, best, me, rng);
}
