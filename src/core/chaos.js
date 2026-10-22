// Super Chaos: simultaneous play, in rounds (phase 1: against the computer). Each round both players choose
// any unclaimed square and make one move there (the game's normal move: one run, one hand, one guess...),
// at the same time; neither waits for the other. The round ends when both have made their move (or the
// round's time runs out: nothing is played for a player not in, who misses the round; a second miss in a row
// loses the match). Then the results resolve together: a square both won
// this round resets with a new random Super Chaos game; both completing three in a row is a draw; any
// other claim stands. Both may play in the same square in the same round.
//
// How a round runs here: state.squares is the human's view (the board at the round's start, plus their own
// move as they make it: playMove sends their move to chaosPlay). The computer's move is made at the round's
// start on its own copy of the board (scCpu), without seeing the human's choice, and kept apart (sc.cpu)
// until the recap. At the round's end chaosResolve merges each square played (each game's scMerge hook for
// what the two moves share: a guess history, a board, a question), then applies claims and resets.
//
// The games' hooks (rules.js): scCreate (a Super Chaos square, where it differs), scRound (a draw at each
// round's start that both players' moves there share: the Roulette spin), scFork (a square as one
// player sees it), scApply (a move made differently), scAfter (a move's result as its player sees it until the
// round ends), scMerge (both moves together; it may return win, reset, replay, or resolve: a result settled only now,
// such as a Bump knock or a Clash Grid collision, for the recap to play). A game without them keeps each player's progress apart already.
import { LINES, playMove, timeoutClose } from './board.js';
import { cpuMove } from './ai.js';
import { dealable, pickReset, startMatch } from './match.js';
import { applyMove, canMove, newMini, randomLegalMove, withTune } from './minis.js';
import { needRng } from './random.js';
import { repMove, repNorm } from './replay.js';
import { other } from './util.js';
import { RUN_TYPES, runLog } from '../games/shared/runner.js';
import { triviaDeal } from '../games/trivia/rules.js';
import { GAMES, TYPES, rulesOf } from '../games/index.js';

export const SC = { roundS: 60 };   // the round's time, in seconds
export const SC_ONLINE = { leadMs: 1000, graceMs: 2500, readyWaitMs: 30000 };   // an online round settled on the record: its recap starts this long ahead (server time; the last mover's phone later, after its own result); a phone that has not sent its move this long past the deadline has missed the round; a phone through its recap waits at most this long for the other's before the next round begins
// The games dealt in Super Chaos (meta.js: superChaos).
export const scTypes = () => TYPES.filter(t => GAMES[t].meta.superChaos);
export const isChaos = st => !!(st && st.sc);
const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const isPer = v => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).sort().join() === 'O,X';   // a value each player has their own of
export const scHuman = st => (st.online && st.online.me ? st.online.me : st.cpu && st.cpu.length === 1 ? other(st.cpu) : 'X');   // (a friend room: this phone's side)

// A new Super Chaos square of a type: the game's own Super Chaos form where it has one; a Trivia question
// dealt face up (both see it from the start).
export function scSquareMini(state, sq, type, rng) {
  const g = rulesOf(type);
  sq.mini = g.scCreate ? withTune(g.scCreate(type, rng)) : newMini(type, rng);
  if (type === 'trivia') { triviaDeal(state, sq, rng); sq.mini.shown = true; }
  return sq.mini;
}
// A round begins: each open square's draw for the round (scRound), on the board both players' moves start from.
export function scRoundStart(squares, rng) {
  for (const sq of squares) if (!sq.owner) { const g = rulesOf(sq.mini.type); if (g.scRound) g.scRound(sq.mini, rng); }
}
const project = (mini, p) => { const g = rulesOf(mini.type); if (g.scFork) g.scFork(mini, p); return mini; };

// A Super Chaos match from the setup screen: the ticked Super Chaos games only, the computer on one side.
export function startChaos(state, rng) {
  rng = needRng(rng);
  if (!startMatch(state, rng, scTypes())) return false;
  if (!state.cpu || state.cpu.length !== 1) { state.screen = 'setup'; return false; }   // (phase 1: against the computer only)
  for (const sq of state.squares) scSquareMini(state, sq, sq.mini.type, rng);
  state.turn = scHuman(state);
  state.sc = { round: 1, limit: SC.roundS, base: null, me: null, moved: null, cpu: null, recap: null, last: null };   // (last: the square each player played in the last round resolved, for the board's badges)
  scBegin(state, rng);
  return true;
}
// A Super Chaos match in a friend room: both players are people, each on their own phone. The record (the
// room's match on the database) is the one truth of each round: its number, its deadline in server time, and
// each move as it is sent in (moves). The second move in settles the round there (chaosResolveOnline), as does
// the deadline (applyChaosDeadline: a side not in has missed the round). The recap carries a shared
// start (at, server time, a moment ahead; the last mover's phone starts it once its own result has played,
// lead): each phone plays its sequence from there, and the next round begins on the record (its deadline;
// applyChaosBegin) once both phones are through it (or one has waited too long for the other).
export function startChaosOnline(state, rng, now) {
  rng = needRng(rng);
  for (const sq of state.squares) scSquareMini(state, sq, sq.mini.type, rng);
  scRoundStart(state.squares, rng);
  state.sc = { round: 1, limit: SC.roundS, online: true, deadline: (now || 0) + SC.roundS * 1000, moves: {}, recap: null, last: null };
  return true;
}
// A player's move as the record keeps it: where, its result, the square before it and each step (the other
// phone replays it), and the square as it left it.
export function scMoveOf(state, side) {
  const sc = state.sc, me = sc.me;
  if (!me) return null;
  return Object.assign({ round: sc.round, side, square: me.square, out: me.out, win: !!me.win, mini: clone(state.squares[me.square].mini), start: sc.start || null, steps: sc.steps || [] }, me.gives ? { gives: me.gives } : {});
}
// Both moves are on the record: the round is settled there, with X's move in X's place and O's as the
// "other" one (the computer's, in a match against it). The recap keeps both moves (mv) so each phone replays
// the other's; the next round starts on the record once both phones are through the recap. A side that
// missed the round ({ square: null, missed: true }) has no move in it (two misses in a row lose: chaosResolve).
export function chaosResolveOnline(full, rng, now, lead) {   // lead: { [side]: ms } the last mover's own result still on show (that phone starts the recap this much later)
  rng = needRng(rng);
  const sc = full.sc, mv = sc.moves || {};
  if (!mv.X || !mv.O) return null;
  const has = p => mv[p].square != null && !!mv[p].mini;
  const missed = ['X', 'O'].filter(p => !has(p) && mv[p].missed);
  const hum = has('X') || !has('O') ? 'X' : 'O', oth = other(hum), H = mv[hum], T = mv[oth];   // (one who had no move to make takes the other's place)
  full.cpu = oth; full.online = null;
  sc.recap = null;
  sc.base = full.squares.map(sq => clone(sq.mini));
  if (has(hum)) {
    const sq = full.squares[H.square];
    sq.mini = clone(H.mini); if (!sq.mv) sq.mv = { X: 0, O: 0 }; sq.mv[hum] += 1;
    sc.me = Object.assign({ square: H.square, out: H.out, win: !!H.win }, H.gives ? { gives: H.gives } : {});
    sc.missed = null;
  } else { sc.me = null; sc.missed = sc.round; }
  sc.cpu = has(oth) ? Object.assign({ side: oth, square: T.square, mini: clone(T.mini), start: T.start, out: T.out, win: !!T.win, steps: T.steps || [] }, T.gives ? { gives: T.gives } : {}) : null;
  const rc = chaosResolve(full, rng, missed);
  full.cpu = null;
  if (!rc) return null;
  const mvOf = m => (m && m.square != null && m.mini ? { square: m.square, steps: m.steps || [], start: m.start || null, type: m.mini.type, auto: !!m.auto } : null);
  rc.mv = { X: mvOf(mv.X), O: mvOf(mv.O) };
  full.moves = (full.moves || 0) + ['X', 'O'].filter(has).length;
  rc.at = (now || 0) + SC_ONLINE.leadMs;                         // the recap's start (server time); the last mover's phone adds its lead
  const ld = {};
  for (const p of ['X', 'O']) if (lead && lead[p] > 0) ld[p] = Math.round(lead[p]);
  if (Object.keys(ld).length) rc.lead = ld;
  sc.recap = rc;
  if (!full.winner) { sc.round += 1; scRoundStart(full.squares, rng); }
  sc.deadline = null;                                            // (the next round's: set once both phones are through the recap, applyChaosBegin)
  sc.ready = null;
  sc.moves = {}; sc.me = null; sc.cpu = null; sc.base = null; sc.moved = null; sc.missed = null;
  return rc;
}
// A round begins: every square as the human sees it, the board kept as it stands (base), the computer's move.
export function scBegin(state, rng) {
  const sc = state.sc, me = scHuman(state);
  if (!sc.online) scRoundStart(state.squares, rng);
  for (const sq of state.squares) if (!sq.owner) project(sq.mini, me);
  sc.base = state.squares.map(sq => clone(sq.mini));
  sc.me = null; sc.moved = null; sc.start = null; sc.steps = null;
  state.turn = me; state.lock = null; state.done = null; state.flash = null;
  sc.cpu = state.winner || sc.online || state.solo ? null : scCpu(state, rng, state.only != null ? { square: state.only } : undefined);   // (a friend room: the other player's move comes from their phone; the admin's test play: its one square, or no computer at all)
}

// The computer's move for this round, on its own copy of the board as it stood when the round began: the
// usual choice of square and the game's own tactics, played through to the end of the move (a Hangman
// letter that hits guesses on, a Risky Rolls turn rolls on until it banks). Kept hidden until the recap.
export function scCpu(state, rng, force, side) {   // force: { square, moves } to play instead (the tests; no moves: its own moves in that square); side: the player to move for (a bot in a match the server runs), else the computer
  rng = needRng(rng);
  const sc = state.sc, cpu = side || state.cpu;
  const sh = {
    squares: state.squares.map((sq, i) => ({ owner: sq.owner, mini: project(clone(sc.base[i]), cpu), mv: { X: 0, O: 0 } })),
    turn: cpu, lock: null, winner: null, flash: null, done: null, timer: null, games: state.games, setup: state.setup, cpuLevel: state.cpuLevel,
    sqlog: [], moves: 0, sc: { round: sc.round, me: null, moved: null, cpu: null, recap: null, shadow: true },
  };
  const steps = [];
  let start = null;
  if (force && !force.moves) sh.lock = force.square;
  const next = k => (force && force.moves ? (k < force.moves.length ? { square: force.square, move: force.moves[k] } : null) : cpuMove(sh, rng));
  let plan = next(0);
  for (let guard = 0; plan && guard < 80 && !sh.sc.me; guard++) {
    if (!start) start = clone(sh.squares[plan.square].mini);                       // the square as the computer found it (the recap's replay starts there)
    let r = playMove(sh, plan.square, plan.move, rng);
    if (!r.ok) {                                                   // never expected: a random legal move there instead
      const m = randomLegalMove(sh.squares[plan.square].mini, cpu, rng);
      r = playMove(sh, plan.square, m, rng);
      if (!r.ok) break;
    }
    const f = Object.assign({}, r.flash); delete f.drawn;
    steps.push(Object.assign(clone(f), { after: clone(sh.squares[plan.square].mini) }));   // (after: the square as the step left it, for the recap's replay of the move)
    sh.flash = null; sh.done = null;
    if (!sh.sc.me) plan = next(guard + 1);
  }
  if (!sh.sc.me) return null;
  const i = sh.sc.me.square;
  return Object.assign({ side: cpu, square: i, mini: sh.squares[i].mini, start, out: sh.sc.me.out, win: sh.sc.me.win, steps }, sh.sc.me.gives ? { gives: sh.sc.me.gives } : {});
}

// A move in a Super Chaos round (playMove hands it here): the player's own square, as they see it. One
// move a round: a move that goes on (a hit, a point standing) keeps the player in that square until it
// ends; then the move is in (sc.me) and nothing more is played until the next round. A square won here is
// only claimed at the round's end.
export function chaosPlay(state, i, m, rng, opts) {
  rng = needRng(rng); opts = opts || {};
  const sc = state.sc;
  if (state.winner) return { ok: false, reason: 'over' };
  if (state.flash) return { ok: false, reason: 'busy' };
  if (state.done) return { ok: false, reason: 'done' };
  if (sc.me || sc.recap) return { ok: false, reason: 'moved' };                       // one move a round
  if ((state.lock != null && state.lock !== i) || (sc.moved != null && sc.moved !== i)) return { ok: false, reason: 'locked' };
  const sq = state.squares[i];
  if (!sq) return { ok: false, reason: 'bad' };
  if (sq.owner) return { ok: false, reason: 'claimed' };
  const p = state.turn, mini = sq.mini, game = rulesOf(mini.type);
  if (!canMove(mini, p)) return { ok: false, reason: 'stuck' };
  const range = mini.type === 'hilo' ? [mini.lo, mini.hi] : null;
  const bjFrom = mini.type === 'bj' && mini.hand ? mini.hand.cards.length : 0;
  const before = game.scAfter ? clone(mini) : null;
  if (sc.moved == null) sc.start = clone(mini);                                       // (the square as the move found it, and each step below: a friend room's replay of it)
  const res = game.scApply ? game.scApply(mini, p, m, rng) : applyMove(mini, p, m, rng);
  if (!res.ok) return res;
  if (game.scAfter) game.scAfter(mini, before, p, res);
  if (!sq.mv) sq.mv = { X: 0, O: 0 };
  if (sc.moved == null) sq.mv[p] += 1;                                                // a round's move counts once, however many steps it takes
  sc.moved = i;
  const win = res.outcome === 'win' && (res.winner || p) === p;
  const gives = res.outcome === 'win' && !win ? res.winner : null;                     // a move that hands the square to the other player (Higher/Lower's 5th guess missing)
  const again = !!res.again && !opts.noAgain && res.outcome === 'continue';
  const flash = { kind: win || gives ? 'claim' : again ? 'again' : 'move', by: p, next: p, square: i, type: mini.type, note: res.note || null, pass: null, timeout: !!opts.forced, sc: sc.round };
  if (res.waits) flash.waits = true;                                                    // a move settled only at the round's end (a Mini Golf shot, a Bump spin): the player waits for it in the square
  if (game.moveFlash) game.moveFlash(m, p, range, bjFrom, mini, flash);
  const sm = repMove(m), rep = repNorm(opts.rep);
  if (sm !== undefined) flash.m = sm;
  if (rep) flash.rep = rep;
  if (win) { flash.winner = p; mini.winCells = res.cells || null; }
  if (gives) flash.winner = gives;
  if (again) state.lock = i;
  else { state.lock = null; sc.me = Object.assign({ square: i, out: res.outcome, win }, gives ? { gives } : {}); state.done = flash; }
  state.draft = ''; state.pick = null; state.sel = [];
  state.moves += 1; state.lastSquare = i; state.lastBy = p;
  state.flash = flash;
  if (sc.online) sc.steps = (sc.steps || []).concat(Object.assign(clone(flash), { after: clone(mini) }));
  return { ok: true, flash };
}

// The round's time ran out before this player's move was in. Nothing is played for them: a round with no
// move made is missed (sc.missed; two in a row lose the match: chaosResolve). A move already under way ends as
// it stands (core/board.js timeoutClose: a Risky Rolls bank, a Blackjack stand, a round or an attempt begun
// counted as failed; else nothing more is played there) and is in, as far as it got.
export function chaosTimeout(state, rng) {
  rng = needRng(rng);
  const sc = state.sc, p = state.turn;
  if (!sc || state.winner || state.flash || state.done || sc.me || sc.recap) return { ok: false, reason: 'busy' };
  const held = state.lock != null ? state.lock : sc.moved;
  if (held == null) { sc.missed = sc.round; return { ok: true, missed: true }; }
  const m = timeoutClose(state.squares[held].mini, p);
  if (m != null) {
    const r = playMove(state, held, m, rng, { forced: true, noAgain: true });
    if (r.ok) return { ok: true, square: held, move: m, closed: true };
  }
  state.lock = null; state.done = null;
  sc.me = { square: held, out: 'continue', win: false };
  return { ok: true, square: held, ended: true };
}

// Both moves are in: the round resolves. Each square played merges the two moves (or takes the one), then
// claims and resets apply together, then the match's result. The recap (sc.recap) says what happened, for
// the screen: the computer's square and move, the squares claimed and reset, a Mini Golf replay.
export function chaosResolve(state, rng, missed) {   // missed: the sides that made no move this round (the round's time ran out)
  rng = needRng(rng);
  const sc = state.sc, me = scHuman(state), cpu = other(me);
  if (!sc || state.winner || sc.recap) return null;
  if (!sc.me && sc.missed !== sc.round) return null;
  if (!missed) missed = sc.me ? [] : [me];
  const moves = {};
  if (sc.me) moves[me] = sc.me;
  if (sc.cpu) moves[cpu] = sc.cpu;
  const recap = { round: sc.round, me: sc.me ? sc.me.square : null, missed: missed.slice(), cpu: sc.cpu ? { square: sc.cpu.square, steps: sc.cpu.steps, start: sc.cpu.start, type: sc.cpu.mini.type } : null, view: {}, pre: {}, mine: {}, resolve: [], claims: [], resets: [], replay: null, result: null, lastBefore: clone(sc.last || null) };   // (mine: each square as this player saw it before the round settled; lastBefore: the badges before it)
  const squares = [...new Set(Object.values(moves).map(x => x.square))];
  const wins = [];
  for (const i of squares) {
    const sq = state.squares[i], base = sc.base[i], forks = {}, own = { X: false, O: false };
    recap.mine[i] = clone(sq.mini);                             // (the board shows it so until the other player's move has been replayed)
    for (const p of ['X', 'O']) if (moves[p] && moves[p].square === i) { forks[p] = p === me ? sq.mini : moves[p].mini; own[p] = own[p] || !!moves[p].win; if (moves[p].gives) own[moves[p].gives] = true; }   // (a square handed over is the other player's win)
    const played = ['X', 'O'].filter(p => forks[p]);           // (X's first in a shared history)
    let m;
    if (played.length === 1) m = clone(forks[played[0]]);
    else {
      m = clone(base);
      for (const p of played) for (const k of Object.keys(m)) if (isPer(m[k]) && forks[p][k] && typeof forks[p][k] === 'object' && p in forks[p][k]) m[k][p] = clone(forks[p][k][p]);
      if ('last' in m) m.last = clone(forks[cpu].last === undefined ? forks[me].last : forks[cpu].last);   // (the computer's: the move the recap shows)
    }
    delete m.winCells;
    const game = rulesOf(m.type);
    const out = (game.scMerge && game.scMerge(m, { base, forks, played, wins: own, me, cpu, rng })) || {};
    const win = out.win || own;
    const winners = ['X', 'O'].filter(p => win[p]);
    if (sq.mv == null) sq.mv = { X: 0, O: 0 };
    if (forks[cpu]) sq.mv[cpu] += 1;
    if (out.replay) recap.replay = { square: i, type: m.type, last: clone(m.last), win: winners.slice() };
    if (out.resolve) {                                          // settled only now, with both moves known (a Bump knock, a Clash Grid collision): the recap plays it
      recap.pre[i] = project(clone(out.resolve.pre), me);
      recap.resolve.push({ square: i, type: m.type, joint: !!out.resolve.joint, whole: !!out.resolve.whole, flash: Object.assign({ kind: 'move', by: me, next: me, square: i, type: m.type, note: 'resolve', pass: null, timeout: false, sc: recap.round, recap: true, scr: true }, out.resolve.flash) });
    }
    const drew = played.some(p => moves[p].out === 'draw');
    project(m, me);
    recap.view[i] = clone(m);                                   // the square once both moves are in, before its claim or reset
    if (winners.length === 1 && !out.reset && !drew) {
      const w = winners[0];
      if (forks[w] && forks[w].winCells && !m.winCells) m.winCells = forks[w].winCells;
      sq.mini = m; wins.push([i, w]);
      recap.view[i] = clone(m);
    } else if (winners.length === 2 || out.reset || drew) {      // both won it (or a Hangman word only the two finished together): a new game
      state.sqlog.push(Object.assign({ t: m.type, end: 'draw', w: null, X: sq.mv.X, O: sq.mv.O }, RUN_TYPES.includes(m.type) ? runLog(m) : {}));
      sq.mv = { X: 0, O: 0 };
      const pool = scPool(state);
      scSquareMini(state, sq, pickReset(state, pool, rng, i), rng);
      project(sq.mini, me);
      recap.resets.push({ square: i, from: m.type, to: sq.mini.type, why: winners.length === 2 ? 'both' : out.note || 'draw' });
    } else {
      sq.mini = m;
      if (out.deal && m.type === 'trivia') { triviaDeal(state, sq, rng); sq.mini.shown = true; }
    }
  }
  for (const [i, w] of wins) {
    const sq = state.squares[i];
    sq.owner = w;
    state.sqlog.push(Object.assign({ t: sq.mini.type, end: 'won', w, X: sq.mv.X, O: sq.mv.O }, RUN_TYPES.includes(sq.mini.type) ? runLog(sq.mini) : {}));
    recap.claims.push({ square: i, by: w });
  }
  const miss = Object.assign({ X: 0, O: 0 }, sc.miss);           // rounds missed in a row, each side: a second in a row loses the match
  for (const p of ['X', 'O']) miss[p] = missed.includes(p) ? miss[p] + 1 : 0;
  sc.miss = miss;
  let mr = scMainResult(state.squares);
  const out = ['X', 'O'].filter(p => miss[p] >= 2);
  if (!mr && out.length) mr = out.length === 2 ? { winner: 'draw', line: null, reason: 'timeout', lost: 'XO' } : { winner: other(out[0]), line: null, reason: 'timeout', lost: out[0] };
  if (mr) { state.winner = mr.winner; state.winLine = mr.line; state.winReason = mr.reason; state.counts = mr.counts || null; recap.result = mr; if (mr.lost && mr.lost.length === 1) state.resigned = mr.lost; }
  state.lock = null; state.done = null; state.flash = null;
  const lastOf = p => (sc.last && sc.last[p] != null ? sc.last[p] : null);
  if (recap.cpu || sc.me) { state.lastSquare = recap.cpu ? recap.cpu.square : sc.me.square; state.lastBy = recap.cpu ? cpu : me; }
  sc.last = { [me]: sc.me ? sc.me.square : lastOf(me), [cpu]: recap.cpu ? recap.cpu.square : lastOf(cpu) };   // each player's square this round (one who did not move keeps their last)
  sc.recap = recap;
  return recap;
}
// The order a phone plays a settled round in, before its results (ui/chaos.js times each part): this player's own
// outcome first, where it is settled only now (their Mini Golf shot; what both moves settle in their square, both
// moves together when both played there); then the other player's move (their square lit, then its replay, or
// their Mini Golf shot), none when both played one square and its joint result has shown it; then what their move
// settles in their square. mine: the square this player played; opp: the other's move ({ square, steps }) or null.
export function scRecapOrder(rc, mine, opp) {
  const out = [], res = rc.resolve || [], golf = rc.replay;
  if (golf && golf.square === mine) out.push({ kind: 'replay', square: mine, own: true });
  res.forEach((it, k) => { if (it.square === mine) out.push({ kind: 'resolve', k, square: mine, own: true }); });
  const joint = !!opp && opp.square === mine && out.some(o => o.kind === 'replay' || res[o.k].joint);
  if (!joint) {
    out.push({ kind: 'spot', square: opp ? opp.square : null });
    if (opp && golf && golf.square === opp.square && opp.square !== mine) out.push({ kind: 'replay', square: opp.square });
    else if (opp && res.some(it => it.square === opp.square && it.whole)) { /* their move is settled whole at the round's end (Bump's spin): its part below is the replay */ }
    else if (opp && opp.steps && opp.steps.length) out.push({ kind: 'popup', square: opp.square });
  }
  res.forEach((it, k) => { if (it.square !== mine) out.push({ kind: 'resolve', k, square: it.square }); });
  return out;
}
// The recap has been shown: the next round (unless the match is over).
export function chaosNext(state, rng) {
  const sc = state.sc;
  if (!sc || !sc.recap) return false;
  sc.recap = null;
  if (state.winner) { sc.cpu = null; return true; }
  sc.round += 1;
  scBegin(state, rng);
  return true;
}
// The games a reset may deal: this match's Super Chaos games that can be dealt now.
export function scPool(state) {
  const sct = scTypes(), dealt = (state.games || []).filter(t => sct.includes(t) && dealable(t, true));
  return dealt.length ? dealt : sct.filter(t => dealable(t, true));
}
// The match's result after a round: a line for one player wins; a line for each (completed in the same round)
// is a draw; and, as ever, a board where neither can make a line any more is a draw.
export function scMainResult(squares) {
  const line = p => LINES.find(l => l.every(k => squares[k].owner === p)) || null;
  const x = line('X'), o = line('O');
  const counts = () => ({ X: squares.filter(s => s.owner === 'X').length, O: squares.filter(s => s.owner === 'O').length });
  if (x && o) return { winner: 'draw', line: null, lines: [x, o], reason: 'both', counts: counts() };
  if (x || o) return { winner: x ? 'X' : 'O', line: x || o, reason: 'line' };
  const open = p => LINES.some(l => l.every(k => squares[k].owner !== other(p)));
  if (!open('X') && !open('O')) return { winner: 'draw', line: null, reason: 'blocked', counts: counts() };
  return null;
}
