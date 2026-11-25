// The computer player on the main board: what a square is worth, what a move changes, its move; and the
// dispatch to each game's tactics (its ai.js: needs, best).
import { LINES } from './board.js';
import { applyMove, canMove, publicMini, randomLegalMove } from './minis.js';
import { makeRng, needRng, randInt } from './random.js';
import { other, PRACTICE_SQ } from './util.js';
import { fingPlay } from '../games/shared/finger.js';
import { ECHO, echoSeq } from '../games/echo/rules.js';
import { aiOf, metaOf, slipMode } from '../games/index.js';
import { aiMiss } from './tune.js';
import { aiWeights, levelCfg, levelOf } from './aiw.js';
import { mc2Pick } from './mc2.js';

/* ===================== Computer player =====================
 * The computer plays fairly: every decision starts from publicMini(), which holds only what a
 * person looking at the screen could know. The hidden word, number, ship, treasure, face-down
 * cards and future dice or coin results never reach the code below.
 *
 * Each turn it scores the best local move in every open square:
 *   score = (value of the square on the main board) x (how much the move shifts the chance of claiming it)
 * and plays the highest. A move that claims a match-winning square is taken at once.
 *
 * One engine, three levels (aiw.js levelCfg; docs/ai.md): a level is how hard it searches the rest of the match for
 * its square (mc2.js: playouts of the match; none: the scores above decide), how often
 * it plays a square with its strongest tactics (its ai.js reads ctx.level and ctx.until, the ms it may spend) rather
 * than the plain ones, how often it makes a careless move, and its appetite for risk. A decision is kept inside
 * opts.budget ms when the caller passes a clock (opts.clock; the page runs it in a worker); without one, the
 * searches do a fixed amount of work.
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
// Tempo play (Hard): a square it leads safely can wait while it invests elsewhere; it comes back to finish it as
// soon as the lead is no longer safe. Safe: the other side needs more than `margin` moves beyond what the computer
// needs there (config/ai margin: the admin's Bot Settings, 2 by default); in a game of luck, little chance
// (under SAFE.risk) that the other side's next move there catches it up (the game's ai.js catchRisk where it has
// one, Risky Rolls exactly; else its chance of the race); the other side threatens no match win elsewhere; and the
// square is not needed now to block a line or complete one of the computer's own.
export const SAFE = { risk: 0.1 };
export const MUST = { needs: 1.5 };                               // a match threat: the other side needs this many turns or fewer in a square that completes their line (cpuMove)
export function safeLead(squares, i, pm, me, value, margin) {
  if (!(value < AI.block)) return false;                         // (a block, or the computer's own line: now)
  const o = other(me), a = needsOf(pm, me), b = needsOf(pm, o);
  if (!(a < Infinity) || !(b - a > margin)) return false;         // (the lead is only that far; at the margin it comes back)
  for (const line of LINES) {                                    // the other side one square from the match elsewhere: no time for tempo
    const own = line.map(k => squares[k].owner);
    if (own.filter(x => x === o).length === 2 && line.some(k => !squares[k].owner && k !== i)) return false;
  }
  if (metaOf(pm.type).category === 'luck') {
    const g = aiOf(pm.type), risk = g.catchRisk ? g.catchRisk(pm, me) : raceChance(Math.max(0.5, b - 1), a);
    if (!(risk < SAFE.risk)) return false;
  }
  return true;
}
// A game's tactics for the side to play: { move, q, win, ... } (its ai.js best), with the level's mistakes in this game
// applied (aiSlip). Every computer move goes through here (cpuMove, the page's physics shots worked out ahead, the
// simulations), so the page, the server's bots and the sims make the same mistakes from the same rng.
export function localBest(pm, me, rng, style, ctx) { return aiSlip(pm, me, rng, ctx, localPlain(pm, me, rng, style, ctx)); }
export function localPlain(pm, me, rng, style, ctx) {
  const game = aiOf(pm.type);
  if (game.best) return game.best(pm, me, rng, style, ctx);
  throw new Error('no tactics for ' + pm.type);
}
// The level's mistake in a game (its settings' aiMiss<Level>, core/tune.js; the level is the match's difficulty,
// ctx.diff, else the tactics' ctx.level): with that chance its move is replaced by a deliberately weaker one, the game's
// own ai.js worse(pm, side, rng, ctx) where it has one (ctx.best: the move it would have played; null: keep it), else
// any legal move (rules.js randomMove on the public view). Nothing for a game whose move is a run or attempt without a
// `worse` (games/index.js slipMode), a finger game's attempt still to be made (move.fing) or Echo's plan. The chance is
// rolled only when it is above 0, so a game left at 0 plays (and draws from its rng) exactly as before. The tactics'
// own figures (q, win, after) are kept: the computer chose its square believing in the better move, then fumbled it.
export function aiSlip(pm, me, rng, ctx, local) {
  if (!local || local.move == null || (local.move && (local.move.fing || local.move.echo))) return local;
  const level = levelOf((ctx && (ctx.diff || ctx.level)) || 'normal'), p = aiMiss(pm, level);
  if (!(p > 0)) return local;
  rng = needRng(rng);
  if (!(rng() < p)) return local;
  const mode = slipMode(pm.type);
  let m = null;
  try {
    if (mode === 'own') m = aiOf(pm.type).worse(pm, me, rng, Object.assign({}, ctx, { best: local.move }));
    else if (mode === 'random') m = randomLegalMove(pm, me, rng);
    if (m != null && !slipLegal(pm, me, m, rng)) m = null;
  } catch (e) { m = null; }                                       // (a view without what the random mover needs: keep the move)
  return m == null ? local : Object.assign({}, local, { move: m, slip: true });
}
// A weaker move is played only if the rules take it: tried on a copy of the public view (its own rng, drawn from the
// computer's). Where the rules need what the view leaves out (a hidden deck, word or answer) the try fails and the
// better move stands: such a game gives its own `worse`, which the rules always take.
function slipLegal(pm, me, m, rng) {
  if (slipMode(pm.type) === 'own') return true;
  try { const r = applyMove(JSON.parse(JSON.stringify(pm)), me, JSON.parse(JSON.stringify(m)), makeRng(String(rng()))); return !!(r && r.ok); }
  catch (e) { return false; }
}

// ---- the match: what a square is worth, what a move changes ----
// A playing style (the matchmaking bots' personalities; the computer opponent plays STYLE0): attack and
// defend weigh the lines still open for itself and for the other side, defend also how hard it blocks a
// line about to be completed; mistake is the chance of a careless move (any legal move in any open
// square); rollRisk adds to the score it banks at in Risky Rolls (bolder above zero, warier below).
export const STYLE0 = { attack: 1, defend: 1, mistake: 0, rollRisk: 0 };
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
// The tactics' answers kept between decisions (cpuMove): by the square's public position, the side, the level, the
// style and how the square stands on the board (a match point, a block or neither; ahead or behind in squares).
const LOCAL = new Map(), LOCAL_MAX = 96;
export const localForget = () => LOCAL.clear();
function localKey(state, i, me, st) {
  const v = squareValue(state.squares, i, me, st), owned = p => state.squares.filter(s => s.owner === p).length;
  return `${me}|${v >= AI.win ? 2 : v >= AI.block ? 1 : 0}|${Math.sign(owned(other(me)) - owned(me))}|${st.rollRisk || 0}|${JSON.stringify(publicMini(state.squares[i].mini, me))}`;
}
// The computer's move for the side to play: { square, move, score }. During a bonus move the square is fixed.
// opts: level ('easy' | 'normal' | 'hard'; else the match's state.cpuLevel, else normal), clock (a function
// giving ms, for the time budget), budget (ms), pre ({ square: local } tactics worked out by the caller, e.g.
// the physics games' outside the worker), noFing (leave a finger game's attempt to the caller: fingPlay).
// Hot Potato on the main board (its rules: a bomb the holder tosses back, ticking after every turn): the square where
// `me` holds a live bomb and may toss it now, or null.
function bombHeld(state, me, open) {
  for (const i of open) { const m = state.squares[i].mini; if (m && m.type === 'hot-potato' && m.holder === me && !m.boom) return i; }
  return null;
}
// A move that wins the match outright this turn: a square that completes one of `me`'s lines, won by one move for sure
// (the move worked out on copies of the square under eight draws of chance: won under every one). Null when none.
function outrightWin(state, me, open, rng) {
  const SEEDS = 8;
  for (const i of open) {
    const sq = state.squares[i];
    if (!sq.mini || sq.mini.type === 'hot-potato') continue;
    if (!LINES.some(l => l.includes(i) && l.every(k => k === i || state.squares[k].owner === me))) continue;
    let b = null;
    try { b = localBest(publicMini(sq.mini, me), me, makeRng(`hp-win:${i}`), Object.assign({}, STYLE0), { value: 1, behind: 0, level: 'hard', until: null }); } catch (e) { b = null; }
    const m = b && b.move;
    if (m == null) continue;
    let sure = true;
    for (let k = 0; k < SEEDS && sure; k++) {
      const copy = JSON.parse(JSON.stringify(sq.mini)), r = applyMove(copy, me, m, makeRng(`hp-win:${i}:${k}`));
      sure = !!(r && r.ok && r.outcome === 'win' && (r.winner || me) === me);
    }
    if (sure) return { square: i, move: m, score: Infinity, value: 1, gain: 1, bomb: false };
  }
  return null;
}
export function cpuMove(state, rng, style, opts) {
  rng = needRng(rng); opts = opts || {};
  const level = levelOf(opts.level || state.cpuLevel), w = aiWeights(), L = levelCfg(level, w), search = L.search > 0;
  const st = Object.assign({}, STYLE0, { attack: search ? w.attack : 1, defend: search ? w.defend : 1, rollRisk: L.risk, mistake: L.mistake }, style || {});
  const me = state.turn;
  const open = state.lock != null ? [state.lock] : (state.only != null || state.practice) ? [state.only != null ? state.only : PRACTICE_SQ].filter(i => !state.squares[i].owner && canMove(state.squares[i].mini, me))   // (the admin's test play: its one square; a practice match: the centre)
    : state.squares.map((s, i) => (s.owner || !canMove(s.mini, me) ? -1 : i)).filter(i => i >= 0);   // not a square where it is stuck
  if (!open.length) return null;
  const hot = bombHeld(state, me, open);                          // holding a bomb (Hot Potato): toss it at once, unless the match can be won outright this turn
  if (hot != null) { const win = outrightWin(state, me, open, rng); return win || { square: hot, move: 'toss', score: 0, value: 0, gain: 0, bomb: true }; }
  if (st.mistake > 0 && open.length && rng() < st.mistake) {      // a careless move: anything legal, anywhere open
    const i = open[randInt(rng, open.length)], m = randomLegalMove(state.squares[i].mini, me, rng);
    if (m != null) return { square: i, move: m, score: 0, value: 0, gain: 0, careless: true };
  }
  const timed = search || L.sharp > 0;                           // (a level that searches keeps to the clock; the plain one decides at once)
  const clock = timed ? (typeof opts.clock === 'function' ? opts.clock : AI_CLOCK.now) : null, budget = opts.budget || w.budget, t0 = clock ? clock() : 0;
  // Each square is played with the strongest tactics as often as the level is sharp, else the plain ones (Easy: its own).
  const plain = level === 'easy' ? 'easy' : 'normal', how = open.map(() => (L.sharp >= 1 || (L.sharp > 0 && rng() < L.sharp) ? 'hard' : plain));
  // What the tactics said of a square stands until the square changes (the same public position, side, tactics and
  // standing on the board): kept from decision to decision (LOCAL), so a turn's search time goes to the squares that
  // did change, and the playouts get the rest. (The plain tactics are quick and vary their play: asked every time.)
  const keys = open.map((i, k) => (how[k] === 'hard' && !opts.fresh ? localKey(state, i, me, st) : null));   // (opts.fresh: nothing kept or reused: a decision that must depend on its rng alone, Super Chaos's shadow play)
  const fresh = open.filter((i, k) => !(opts.pre || {})[i] && !(keys[k] && LOCAL.has(keys[k]))).length;
  const share = clock ? budget * 0.6 / Math.max(1, fresh) : 0;    // each square still to search gets its share; the playouts the rest
  const pre = opts.pre || {}, done = () => (opts.noFing ? best : fingPlay(state, best, me, rng));
  let best = null;
  const cands = [];
  const owned = p => state.squares.filter(s => s.owner === p).length, behind = owned(other(me)) - owned(me);
  open.forEach((i, k) => {
    if (best && best.score === Infinity) return;
    const real = squareValue(state.squares, i, me, st);
    const at = clock ? clock() : 0, until = clock ? () => Math.max(0, at + share - clock()) : null;
    const key = keys[k], kept = key && !pre[i] ? LOCAL.get(key) : null;
    const pm = kept ? kept.pm : publicMini(state.squares[i].mini, me);   // (only what a person at the screen could know; the kept view is the same position, with what its tactics worked out about it)
    const lctx = { value: real, behind, level: how[k], diff: level, until };
    let local = pre[i] || (kept ? Object.assign({}, kept.local) : localPlain(pm, me, rng, st, lctx));
    if (key && !pre[i] && !kept) { if (LOCAL.size >= LOCAL_MAX) LOCAL.delete(LOCAL.keys().next().value); LOCAL.set(key, { pm, local: Object.assign({}, local) }); }
    if (!pre[i]) local = aiSlip(pm, me, rng, lctx, local);          // (the kept answer is the plain one: its mistakes are rolled afresh every decision; pre[i] has had its own, localBest)
    const value = state.lock != null ? 1 : real;
    if (pm.type === 'echo' && local.move && local.move.echo) local.move = cpuEcho(state.squares[i].mini, me, local.move, rng);
    if (value >= AI.win && (local.win || local.q >= 1)) { best = { square: i, move: local.move, score: Infinity, value, gain: 1 }; return; }
    const gain = moveGain(pm, me, local);
    const score = value * Math.max(gain, 0.01) * catchUp(needsOf(pm, me), needsOf(pm, other(me)), value);
    const safe = search && state.lock == null && safeLead(state.squares, i, pm, me, real, w.margin);   // (tempo play: this one can wait)
    cands.push({ square: i, pm, local, value, gain, score, close: search && !safe && closeTo(pm, me, local, real), safe });
    if (!best || score > best.score) best = { square: i, move: local.move, score, value, gain };
  });
  if (best && best.score === Infinity) return done();
  // The other side one move from the match in a square (it completes their line and they need a turn or less
  // there): only the squares that stop it, or that win the match for the computer, are considered. Never left to
  // the playouts' judgement.
  const o = other(me), must = state.lock == null ? cands.filter(c => c.value >= AI.block && (c.value >= AI.win || needsOf(c.pm, o) <= MUST.needs)) : [];
  let pool = cands;
  if (must.some(c => c.value < AI.win) && must.length < cands.length) {
    pool = must; best = null;
    for (const c of pool) if (!best || c.score > best.score) best = { square: c.square, move: c.local.move, score: c.score, value: c.value, gain: c.gain };
  }
  if (search && pool.length > 1) best = mc2Pick(state, me, pool, rng, { playouts: L.search, explore: w.explore, fresh: w.fresh, prog: w.prog, drop: w.drop, close: 1, safe: 1 }, st, clock ? () => Math.max(0, t0 + budget - clock()) : null);
  return done();
}
