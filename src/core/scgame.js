// A Super Chaos match from Find Match, run by the server (functions/index.js): the one truth of the match
// lives here, every secret with it, and every random draw is the server's. Each phone sends its moves as
// requests (a step at a time: a hit, a roll, a guess), sees its own square as the server answers, and gets
// the round's recap once both moves are in (or the deadline passes: a side not in misses the round), each phone
// playing it from its start (the last mover's after its own result) as a friend room's does (net/chaos.js,
// ui/chaos.js); the next round begins once both phones are through it.
//
// The record (g): full, the match as core/chaos.js keeps a friend room's (sc.round, deadline, moves, recap,
// and every square with its secrets), and prog, each side's way through the round: the square it is in, that
// square as its steps left it, the steps, a move still going on (lock). A side's own copy of the round is
// rebuilt from the two whenever it moves (scSideState), so chaosPlay runs on it exactly as a phone's would.
// What the phones get: the public state (scPublicState: secrets hidden, the other side's move kept back until
// the recap shows it) and each side's own node (scSideView: its move once in, or its progress, for a reload).
import { playMove } from './board.js';
import { SC_ONLINE, chaosResolveOnline, chaosTimeout, scCpu, scMoveOf } from './chaos.js';
import { fullState, hideMini, matchRecord, newOnlineMatch, scReady } from './records.js';
import { needRng } from './random.js';
import { playMs } from './timer.js';
import { other } from './util.js';
import { PHYS_TYPES } from '../games/shared/physics.js';
import { ATT_TYPES, attStart } from '../games/shared/attention.js';
import { onlineCheck } from './verify.js';

export const SC_GAME = { recapMaxMs: 90000, leadHoldMs: 300 };   // a recap neither phone gets through (both gone): the next round begun by the sweep this long after its start; the last mover's phone starts the recap this long after its own result's animation
const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const prog0 = () => ({ square: null, mini: null, start: null, steps: [], moved: null, lock: null, me: null });

// A new match: the released Super Chaos games (setup.games), the first round timed from now (server time)
// plus a grace for both phones to show the players.
export function newScGame(setup, rng, id, now, graceMs) {
  const rec = newOnlineMatch(Object.assign({}, setup, { timer: 0, chaos: true }), rng, id, now);
  if (!rec) return null;
  const full = fullState(rec);
  full.sc.deadline = now + (graceMs || 0) + full.sc.limit * 1000; full.sc.began = now;   // (began: a run or an attempt is no longer than the round has lasted, core/verify.js)
  return { full, prog: { X: prog0(), O: prog0() } };
}
// A side's own copy of the round, as its phone plays it in a friend room: the board as the round left it,
// its own square as its steps left it, its move so far.
export function scSideState(g, side) {
  const f = g.full, p = g.prog[side] || prog0();
  const st = {
    id: f.id, games: f.games, squares: clone(f.squares), turn: side, lock: p.lock == null ? null : p.lock, winner: f.winner || null, flash: null, done: p.me ? { kind: 'move' } : null, timer: null,
    moves: f.moves || 0, draft: '', pick: null, sel: [], lastSquare: f.lastSquare, lastBy: f.lastBy, sqlog: [], online: { me: side }, cpu: null, cpuLevel: null,
    sc: { round: f.sc.round, limit: f.sc.limit, online: true, deadline: f.sc.deadline, me: p.me ? clone(p.me) : null, moved: p.moved, start: clone(p.start), steps: clone(p.steps || []), recap: null, base: null, last: clone(f.sc.last) },
  };
  if (p.square != null && p.mini) st.squares[p.square].mini = clone(p.mini);
  return st;
}
const progOf = st => { const sc = st.sc, i = sc.moved; return { square: i, mini: i != null ? clone(st.squares[i].mini) : null, start: clone(sc.start), steps: clone(sc.steps || []), moved: i, lock: st.lock == null ? null : st.lock, me: sc.me ? clone(sc.me) : null }; };
const hidden = (m, k, f) => { const h = clone(m); hideMini(h, k, f); return h; };
// Both moves in: the round settles (core/chaos.js chaosResolveOnline: the recap with its shared start); the
// sides' progress starts over.
function scSettle(g, rng, now, lead) {
  const rc = chaosResolveOnline(g.full, rng, now, lead);
  if (!rc) return false;
  g.prog = { X: prog0(), O: prog0() };
  return true;
}
const bump = f => { f.seq = (f.seq || 0) + 1; };
const live = f => (f.winner ? { ok: false, reason: 'over' } : f.sc.deadline == null ? { ok: false, reason: 'recap' } : null);

// A step of a side's move (its square, the move: what its phone would hand playMove): refused as the phone
// would refuse it, or made on its copy of the round. What the phone shows: the move's flash, its square as the
// step left it (hidden), whether the move goes on (lock) or is in (me). The move in: the round settles once
// the other side's is too (resolved), its shared start after this move's own animation.
export function applyScMove(g, side, i, m, rng, now, opts) {
  const f = g.full, no = live(f);
  if (no) return no;
  if (side !== 'X' && side !== 'O') return { ok: false, reason: 'bad' };
  if (f.sc.moves && f.sc.moves[side]) return { ok: false, reason: 'moved' };
  if (!Number.isInteger(i) || i < 0 || i > 8) return { ok: false, reason: 'bad' };
  rng = needRng(rng);
  const st = scSideState(g, side);
  if ((st.lock != null && st.lock !== i) || (st.sc.moved != null && st.sc.moved !== i)) return { ok: false, reason: 'locked' };   // (held to another square: as chaosPlay refuses it, before anything else is asked of the move)
  const chk = onlineCheck(st.squares[i].mini, side, m, now, f.sc.began != null ? f.sc.began : f.sc.deadline - f.sc.limit * 1000 - 6000);   // what the server holds a phone's move to (a timeout is never a phone's, a run or an attempt its inputs within the time, an answer after Start and in time)
  if (chk && chk.why) return { ok: false, reason: chk.why };
  if (chk && chk.move !== undefined) m = chk.move;
  const r = playMove(st, i, m, rng, { rep: opts && opts.rep });
  if (!r.ok) return { ok: false, reason: r.reason || 'bad' };
  g.prog[side] = progOf(st);
  const out = { ok: true, flash: clone(r.flash), lock: st.lock == null ? null : st.lock, moved: st.sc.moved, me: st.sc.me ? clone(st.sc.me) : null, mini: hidden(st.squares[i].mini, i, f), resolved: false };
  if (st.sc.me) {
    f.sc.moves = Object.assign({}, f.sc.moves, { [side]: Object.assign(scMoveOf(st, side), { at: now }) });
    out.resolved = scSettle(g, rng, now, { [side]: playMs(r.flash, 4) + SC_GAME.leadHoldMs });
  }
  bump(f);
  return out;
}
// Start (an attention or finger game, security review F3): the side is held to the square and its round or attempt
// is timed from now (server time: core/verify.js holds the answer or the attempt to it); an attention game's round,
// the server's until now, goes back to the phone with it. The stamp goes on the match itself (the side's own copy of
// the round is rebuilt from it at every step); a Start again (a reload) is the same round on the same clock.
export function applyScStart(g, side, i, now) {
  const f = g.full, no = live(f);
  if (no) return no;
  if (side !== 'X' && side !== 'O') return { ok: false, reason: 'bad' };
  if (f.sc.moves && f.sc.moves[side]) return { ok: false, reason: 'moved' };
  if (!Number.isInteger(i) || i < 0 || i > 8) return { ok: false, reason: 'bad' };
  const st = scSideState(g, side);
  if (st.sc.me || (st.sc.moved != null && st.sc.moved !== i)) return { ok: false, reason: 'moved' };
  const m0 = st.squares[i].mini;
  if (m0.started && m0.started[side] != null && f.sc.began != null && m0.started[side] < f.sc.began) m0.started[side] = null;   // (a stamp left from an earlier round: this round's Start is a new one, on its own clock)
  const r = attStart(st, i, side, now);
  if (!r.ok) return r;
  const started = clone(st.squares[i].mini.started), p = g.prog[side] || prog0();
  f.squares[i].mini.started = started;
  if (p.square === i && p.mini) p.mini.started = clone(started);
  g.prog[side] = Object.assign(p, { lock: i });
  bump(f);
  return { ok: true, round: ATT_TYPES.includes(st.squares[i].mini.type) ? clone(st.squares[i].mini.round[side]) : null };
}
// The deadline is past its grace: a side not in misses the round (nothing is played for it; a move still under
// way ends as it stands: chaosTimeout), and the round settles.
export function applyScTimeout(g, now, rng) {
  const f = g.full, no = live(f);
  if (no) return no;
  if (now < f.sc.deadline + SC_ONLINE.graceMs) return { ok: false, reason: 'early' };
  rng = needRng(rng);
  f.sc.moves = Object.assign({}, f.sc.moves);
  const out = { ok: true, timed: [] };
  for (const side of ['X', 'O']) if (!f.sc.moves[side]) { f.sc.moves[side] = scTimeoutOf(g, side, rng, now); out.timed.push(side); }
  if (!scSettle(g, rng, now, null)) return { ok: false, reason: 'bad' };
  bump(f);
  return out;
}
function scTimeoutOf(g, side, rng, now) {
  const st = scSideState(g, side), r = chaosTimeout(st, rng);
  if (!r.ok || r.missed || !st.sc.me) return { round: g.full.sc.round, side, square: null, missed: true };
  g.prog[side] = progOf(st);
  return Object.assign(scMoveOf(st, side), { at: now, timeout: true });
}
// A bot's move for the round: the computer's own Super Chaos play (core/chaos.js scCpu: its square and the
// game's tactics, played through to the move's end) at the admin's level, from the board as the round began.
export function applyScBot(g, side, rng, level, now) {
  const f = g.full, no = live(f);
  if (no) return no;
  if (f.sc.moves && f.sc.moves[side]) return { ok: false, reason: 'moved' };
  rng = needRng(rng);
  const st = scSideState(g, side);
  st.cpuLevel = level || 'normal'; st.sc.base = f.squares.map(q => clone(q.mini));
  const m = scCpu(st, rng, undefined, side);
  if (!m) return { ok: false, reason: 'none' };
  f.sc.moves = Object.assign({}, f.sc.moves, { [side]: Object.assign({ round: f.sc.round, side, square: m.square, out: m.out, win: !!m.win, mini: m.mini, start: m.start, steps: m.steps, at: now }, m.gives ? { gives: m.gives } : {}) });
  const resolved = scSettle(g, rng, now, null);
  bump(f);
  return { ok: true, square: m.square, type: m.mini.type, resolved };
}
// The recap is over on a phone (sides: who is through it; a bot is at once): the next round begins, timed
// from now, once both are through, or one has waited SC_ONLINE.readyWaitMs for the other; with no side (the
// sweep), once that wait is over, or the recap has been left too long (both phones gone). Once.
export function applyScBegin(g, now, sides) {
  const f = g.full;
  if (f.winner) return { ok: false, reason: 'over' };
  if (f.sc.deadline != null) return { ok: false, reason: 'begun' };
  let r = { ok: false, reason: 'waiting' };
  for (const sd of [].concat(sides || [null])) { const x = scReady(f.sc, now, sd); if (x.ok) r = x; if (f.sc.deadline != null) break; }
  if (f.sc.deadline == null && !sides && now >= (f.sc.recap && f.sc.recap.at || 0) + SC_GAME.recapMaxMs) { f.sc.deadline = now + f.sc.limit * 1000; f.sc.began = now; f.sc.ready = null; r = { ok: true, begun: true }; }
  if (!r.ok) return r;
  bump(f);
  return { ok: true, begun: f.sc.deadline != null };
}
// A side gives the match up (leaving it through the menu): the other side wins.
export function applyScResign(g, side) {
  const f = g.full;
  if (f.winner) return { ok: false, reason: 'over' };
  if (side !== 'X' && side !== 'O') return { ok: false, reason: 'bad' };
  f.winner = other(side); f.winLine = null; f.winReason = 'resign'; f.resigned = side;
  f.sc.deadline = null; f.sc.recap = null; f.sc.moves = {};
  g.prog = { X: prog0(), O: prog0() };
  bump(f);
  return { ok: true };
}
// When the sweep must look at the match: the deadline past its grace (a side not in misses the round), a phone through the recap waited long enough for the other, a recap nobody
// began the next round after, 1 once it is over (its result still to record).
export function scDue(g) {
  const f = g.full;
  if (f.winner) return 1;
  if (f.sc.deadline != null) return f.sc.deadline + SC_ONLINE.graceMs;
  const gone = (f.sc.recap && f.sc.recap.at || 0) + SC_GAME.recapMaxMs, at = Object.values(f.sc.ready || {});
  return at.length ? Math.min(gone, Math.min(...at) + SC_ONLINE.readyWaitMs) : gone;
}
// The match as both phones may see it: every square hidden as the record hides it; the moves in shown only as
// in or not (the other side's move waits for the recap); the recap's squares and steps hidden too (a physics
// recording stays: the phones replay the shot from it).
const hideAll = (m, k, f) => { if (m && !PHYS_TYPES.includes(m.type)) hideMini(m, k, f); };
export function scPublicState(g) {
  const f = g.full, st = matchRecord(f).state, sc = st.sc;
  sc.moves = { X: !!(f.sc.moves && f.sc.moves.X), O: !!(f.sc.moves && f.sc.moves.O) };
  delete sc.base; delete sc.me; delete sc.cpu;
  const rc = sc.recap;
  if (rc) {
    for (const mv of [rc.mv && rc.mv.X, rc.mv && rc.mv.O, rc.cpu]) if (mv) { hideAll(mv.start, mv.square, f); (mv.steps || []).forEach(x => hideAll(x.after, mv.square, f)); }
    for (const key of ['view', 'pre', 'mine']) for (const k of Object.keys(rc[key] || {})) hideAll(rc[key][k], Number(k), f);
  }
  return st;
}
// A side's own node: its move once in (its square as it left it, hidden as its phone shows it), or its way
// through a move still going on, for its phone after a reload.
export function scSideView(g, side) {
  const f = g.full, p = g.prog[side], mv = f.sc.moves && f.sc.moves[side];
  const out = { round: f.sc.round, me: null, prog: null };
  if (mv && mv.square != null && mv.mini) out.me = Object.assign({ square: mv.square, out: mv.out || 'none', win: !!mv.win, mini: hidden(mv.mini, mv.square, f) }, mv.gives ? { gives: mv.gives } : {});
  else if (p && p.square != null && p.mini) out.prog = { square: p.square, lock: p.lock, moved: p.moved, mini: hidden(p.mini, p.square, f) };
  return out;
}
// The final state with every hidden value revealed, for the history and the review board.
export function scFinal(g, names) {
  const f = g.full, keep = {};
  for (const k of ['id', 'squares', 'winner', 'winLine', 'winReason', 'resigned', 'counts', 'moves', 'games', 'lastSquare', 'lastBy']) if (f[k] !== undefined) keep[k] = clone(f[k]);
  keep.names = names;
  return keep;
}
