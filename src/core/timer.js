// The turn timer and the playback timings: one deadline a turn (armClock), how long a move's animation
// takes on a phone (playMs). An online match's clock is one of two kinds, written as one code (timerSpec):
//   a time per turn ('t30', 't60'; a game that needs more takes its own, turnSecs; two turns missed in a row lose),
//   a match clock, chess style ('m5+2': 5 minutes a player, plus 2 seconds for every move made; only the player on
//   the move's clock runs, from when they can act; at zero they lose), or none ('off').
// The match clock keeps each player's time left (bank, ms). A turn's deadline is its start plus the mover's bank,
// so everything built on the deadline (the server's sweep, a run's length, the phones' countdowns) holds for both.
import { metaOf, rulesOf } from '../games/index.js';
import { DIE_MORE } from './config.js';
export { DIE_MORE };                                              // (the dice's longer tumble: core/config.js)

export const TIMER_OPTIONS = [0, 30];   // seconds per turn in a friend game: no limit or 30 seconds (Find Match is always 30 seconds)
// A time per turn from an older room or setup (1 or 3 minutes) becomes 30 seconds; anything else, no limit.
export function normTimer(v) { return TIMER_OPTIONS.includes(v) ? v : [60, 180].includes(v) ? 30 : 0; }
export const TURN_SECS = [30, 60], CLOCK_MINS = [3, 5, 10], CLOCK_INCS = [0, 2, 5];
// A timer's code from anything: a code already ('off', 't30', 't60', 'm3+0' ... 'm10+5'), or an older number of
// seconds a turn (normTimer: no limit, or 30 s). Anything else: 'off'.
export function timerSpec(v) {
  if (typeof v === 'number') { const n = normTimer(v); return n ? 't' + n : 'off'; }
  if (typeof v !== 'string') return 'off';
  let m = /^t(\d+)$/.exec(v);
  if (m && TURN_SECS.includes(Number(m[1]))) return v;
  m = /^m(\d+)\+(\d+)$/.exec(v);
  return m && CLOCK_MINS.includes(Number(m[1])) && CLOCK_INCS.includes(Number(m[2])) ? v : 'off';
}
export function specParts(v) {
  const s = timerSpec(v);
  if (s[0] === 't') return { kind: 'turn', secs: Number(s.slice(1)) };
  if (s[0] === 'm') { const [a, b] = s.slice(1).split('+').map(Number); return { kind: 'match', mins: a, inc: b }; }
  return { kind: 'off' };
}
// A setup's clock: its code (setup.clock), or an older room's seconds a turn (setup.timer).
export const setupSpec = s => (s && s.clock != null ? timerSpec(s.clock) : timerSpec(Number(s && s.timer) || 0));
// A timer's seconds a turn (0: none, or a match clock): what an older client reads as the match's timer.
export const turnSecsOf = v => { const p = specParts(v); return p.kind === 'turn' ? p.secs : 0; };
export const timerKind = v => specParts(v).kind;                // 'off' | 'turn' | 'match'
export function timerLabel(v) {
  const p = specParts(v);
  return p.kind === 'turn' ? `${p.secs}s/turn` : p.kind === 'match' ? `${p.mins} min each${p.inc ? ` + ${p.inc}s/move` : ''}` : 'No limit';   // ("30s/turn", "5 min each + 5s/move")
}
// Every code there is, in order (the admin's Timer setting and an admin host's lobby offer them all).
export const TIMER_SPECS = ['off', ...TURN_SECS.map(s => 't' + s), ...CLOCK_MINS.flatMap(m => CLOCK_INCS.map(i => `m${m}+${i}`))];
// What players choose from (November 2026): a match clock of 3, 5 or 10 minutes each, +5 s after every move, or no
// limit; 5 minutes by default. A time per turn and the other increments are the admin's alone (testing).
export const PLAYER_TIMERS = ['off', 'm3+5', 'm5+5', 'm10+5'];
export const TIMER_DEFAULT = 'm5+5';
export function newTimer(v) {
  if (typeof v === 'number' || v == null) {                       // (a bare number: that many seconds a turn, as before codes)
    const n = Number(v) || 0, t = { limit: n, deadline: null, for: null, pausedAt: null, timeouts: { X: 0, O: 0 }, streak: { X: 0, O: 0 } };
    if (n) t.spec = 't' + n;
    return t;
  }
  const p = specParts(v), t = { limit: p.kind === 'turn' ? p.secs : 0, deadline: null, for: null, pausedAt: null, timeouts: { X: 0, O: 0 }, streak: { X: 0, O: 0 } };
  if (p.kind === 'match') Object.assign(t, { kind: 'match', spec: timerSpec(v), inc: p.inc, bank: { X: p.mins * 60000, O: p.mins * 60000 } });
  else if (p.kind === 'turn') t.spec = timerSpec(v);
  return t;
}
// Whether a match has a clock at all (a time per turn, or a match clock).
export const clockOn = t => !!t && (t.kind === 'match' ? !!t.bank : !!t.limit);
export const matchClock = t => !!t && t.kind === 'match' && !!t.bank;
// A turn's time: the match's limit, or more for a game that needs it (its meta.js turnSecs: the runners, Sky Hop,
// Scoop Stack, Pinball, Echo, Snapshot, Risky Rolls take 60 seconds). The turn takes the game's time once the
// player opens its square, which holds the turn there (turnOpen); secs: the time this turn has (null: the limit).
export function turnSecs(type) { const s = metaOf(type).turnSecs; return Number.isFinite(s) && s > 0 ? s : null; }
export function turnLimit(t) { return !t ? 0 : matchClock(t) ? Math.max(0, (t.bank[t.for] || 0) / 1000) : t.secs || t.limit; }   // (a match clock: the time the player on the move has left)
// The player on the move opens square i: a game with time of its own gives the turn that time, counted from the
// turn's start, and holds the turn to the square (as Start does); false if nothing changes. Once a turn.
export function turnOpen(st, i) {
  const t = st.timer, sq = st.squares && st.squares[i];
  if (!t || !t.limit || matchClock(t) || st.winner || !sq || sq.owner || t.secs || t.for !== st.turn) return false;   // (a match clock: no time of a game's own, the player's bank is what they have)
  if (st.lock != null) return false;                              // (already held: by a move or a Start, the turn's time stays)
  const s = turnSecs(sq.mini.type);
  if (!s || s <= t.limit) return false;
  if (t.deadline != null) t.deadline += (s - t.limit) * 1000;
  t.secs = s; st.lock = i; st.lockBy = 'open';
  return true;
}

// ---------- playback: how long a settled move takes to play on a phone ----------
// The turn clock allows for it, so the next player gets the full time once the move has played out.
// The phones and the server use the same figures (Normal: the server never knows a player's Animation choice).
export const PLAY = {
  spot: 600,                                                              // the square glows on the board before the zoom
  flash: { move: 600, again: 350, claim: 800, draw: 1100, match: 900, card: 900 },   // the result stays up this long once its animation is over (a win: the game's own winning moment; the square's stamp follows on the board)
  flip: 500,                                                              // Find the Pair's cards turn back over
  die: 600 + DIE_MORE, spin: 1000, hop: 130,                                          // a die's tumble, the candy wheel's spin, each hop of a token
  spin3: 700, slide: 750, knock: 650,                                     // Bump's 1-2-3 spinner; a ladder climb or a snake slide; a piece knocked Home
};
// The pace. ANIM.admin: the admin's Animation speed (config/anim/speed: 0.5 to 2, default 1), for everyone: every
// move's animation, its result's hold, the board's glow and the computer's pauses, and the server's turn clock and
// bots. ANIM.mode: this player's own Animation setting, 'normal' (the game as designed) or 'speed' (ui/pace.js:
// on this screen only, never the rules, the timers or what the other player sees): everything plays ANIM.fast
// times as fast again (config/anim/fast: 1 to 4, default 2), with ANIM.fx the punch of its effects (config/anim/fx:
// 0 to 2, default 1: the shake, the confetti, the pops). ANIM.speed is the pace on this screen. The waits that
// are the game itself never change (Find the Pair's two cards up, the attention games' times, Echo's pattern,
// a run or a physics recording: realTime below).
export const ANIM = { speed: 1, admin: 1, fast: 2, fx: 1, mode: 'normal' };
const pace = () => { ANIM.speed = ANIM.admin * (ANIM.mode === 'speed' ? ANIM.fast : 1); };
const num = (v, lo, hi, d) => { const x = v == null || v === '' ? NaN : Number(v); return Number.isFinite(x) && x >= lo && x <= hi ? x : d; };
export function setAnimSpeed(v) { ANIM.admin = num(v, 0.5, 2, 1); pace(); }
export function setAnimFast(v) { ANIM.fast = num(v, 1, 4, 2); pace(); }
export function setAnimFx(v) { ANIM.fx = num(v, 0, 2, 1); }
export function setAnimMode(m) { ANIM.mode = m === 'speed' ? 'speed' : 'normal'; pace(); }
export const speedMode = () => ANIM.mode === 'speed';
// An opponent's or the computer's move plays back this fast: as it was made (Normal), 1.5x (Speed).
export const REPLAY_SPEED = 1.5;
export const replaySpeed = () => (speedMode() ? REPLAY_SPEED : 1);
// The rate a move's animation and result play at. Normal: the replay's own speed times the admin's (as ever).
// Speed: the faster of the replay's speed and the pace, except a game whose move is a recording in real time
// (meta.js realTime: the runs, the physics shots, Sky Hop, Scoop Stack, Pinball, the timed rounds), which plays
// at the replay's speed (1 for the mover's own). rs: the replay's speed (1: not a replay).
export function moveRate(type, rs) {
  const r = (rs || 1) * ANIM.admin;
  if (!speedMode()) return r;
  if (metaOf(type).realTime) return (rs || 1) > 1 ? Math.max(r, ANIM.speed) : r;   // (a real-time game: the mover's own attempt was live, as it happened; someone else's replayed at the pace like any move, December 2026: it once crept along at 1.5x in Speed)
  return Math.max(r, ANIM.speed);
}
// The rate a result's hold plays at: in Speed never slower than its pace (a run's result reads as fast as any).
export function holdRate(type, rs) { return speedMode() ? Math.max(moveRate(type, rs), ANIM.speed) : moveRate(type, rs); }
// ONE TIMING FUNCTION for the page (December 2026): every duration put on screen is a base figure (the game as designed:
// Normal at the admin's Animation speed 1) and goes through here, so the player's Normal | Speed and the admin's two
// multipliers (config/anim speed and fast) reach all of it. kind:
//   'ui'   the interface's own moments: transitions, the zoom, the computer's pauses, the board's glow and stamps, the
//          side reveal, a step's slide (the pace: ANIM.speed);
//   'move' a move's animation and its sounds (moveRate: its game's, a replay's speed);
//   'hold' a result left on show once its animation has played (holdRate);
//   'real' a game's own clock (an attention round, Echo's pattern, a run or a shot as it is played, a countdown, a
//          note to read): never changed.
export function durRate(kind, type, rs) { return kind === 'real' ? 1 : kind === 'move' ? moveRate(type, rs) : kind === 'hold' ? holdRate(type, rs) : ANIM.speed; }
export const dur = (ms, kind, type, rs) => (ms > 0 ? ms / durRate(kind || 'ui', type, rs) : 0);
// The animation of one move. winLen: how many cells a Hex win lights up.
export function playMs(f, winLen) {
  const won = f.kind === 'claim' || f.kind === 'match';
  const game = rulesOf(f.type);
  if (game.flashMs) return game.flashMs(f, winLen, won);
  return 500;
}
// The whole playback of settled moves on the other phone: the glow, the move, its result. The server's reckoning,
// at the game's own pace (Normal: a phone in Speed is through sooner, and starts its clock then).
export function replayMs(entries) {
  return (entries || []).reduce((ms, e) => {
    const win = e.after && e.after.mini && e.after.mini.winCells ? e.after.mini.winCells.length : 4;
    return ms + (PLAY.spot + playMs(e, win) + (PLAY.flash[e.kind] || 800) + (e.type === 'memory' && e.kind === 'move' ? PLAY.flip : 0)) / ANIM.admin;
  }, 0);
}
// After moves are settled: the turn clock is set for whoever is on the move. With nothing to play back (the
// match's first turn, a turn missed) it starts at once, at `now` (server time). Otherwise it starts when that
// player's phone has played the move back (or skipped it: startClock), and at the latest once the playback
// would be over (startBy, with a little slack), so a phone that is away still has a turn that runs out.
export const CLOCK = { startSlackMs: 3000 };
// A match clock first settles the turn that ends: the time it took comes off the mover's bank, and a move made
// (the turn passing on with the time not run out) adds the increment.
export function armClock(st, entries, now) {
  const t = st.timer;
  if (!clockOn(t)) return;
  if (matchClock(t)) settleClock(t, now, st.winReason !== 'clock');
  if (st.winner) { t.deadline = null; t.for = null; t.startBy = null; t.secs = null; return; }
  t.for = st.turn; t.secs = null;
  if (entries && entries.length) { t.deadline = null; t.startBy = now + replayMs(entries) + CLOCK.startSlackMs; }
  else { t.deadline = now + turnLimit(t) * 1000; t.startBy = null; }
}
// The turn that ends (t.for's): its time used comes off their bank (from when it began, its deadline less the bank;
// not begun yet: from when it would have, startBy), and the increment goes on for a move made in time.
export function settleClock(t, now, inc) {
  const p = t.for;
  if (!matchClock(t) || (p !== 'X' && p !== 'O')) return;
  const start = t.deadline != null ? t.deadline - t.bank[p] : t.startBy != null ? t.startBy : now;
  t.bank[p] = Math.max(0, Math.round(t.bank[p] - Math.max(0, now - start)));
  if (inc && t.bank[p] > 0) t.bank[p] += (t.inc || 0) * 1000;
}
// A move that keeps the turn (a Risky Rolls roll, a Sea Battle hit, a letter found): a match clock stands still while
// it plays out (its replay's length), so the player's time runs only while they can act.
export function holdClock(st, entries) {
  const t = st.timer;
  if (!matchClock(t) || st.winner || t.deadline == null || !entries || !entries.length) return false;
  t.deadline += replayMs(entries);
  return true;
}
// Each player's time left now (ms), as both phones show it: the player on the move's counts down from their
// turn's start (not begun: their full bank), the other's stands. null without a match clock.
export function clockLeft(t, now) {
  if (!matchClock(t)) return null;
  const out = { X: t.bank.X, O: t.bank.O }, p = t.for;
  if (p === 'X' || p === 'O') {
    const dl = clockDeadline(t);
    if (dl != null && (t.deadline != null || now >= t.startBy)) out[p] = Math.max(0, Math.min(t.bank[p], dl - now));
  }
  return out;
}
// The player on the move has seen the move before theirs play out (or skipped it): their clock starts now.
// Once a turn: a deadline set stays (one deadline a turn).
export function startClock(st, side, now) {
  const t = st.timer;
  if (!clockOn(t) || st.winner || t.for !== side || t.deadline != null) return false;
  t.deadline = Math.min(now, t.startBy != null ? t.startBy : now) + turnLimit(t) * 1000; t.startBy = null;
  return true;
}
// The turn's deadline: the one set, or the latest it can be (its start not reported yet); null with no clock.
// When the turn began (its deadline less its time): a run or an attempt is no longer than that (core/verify.js).
export function turnBegan(t) { const dl = clockDeadline(t); return dl == null ? null : dl - turnLimit(t) * 1000; }
export function clockDeadline(t) {
  if (!clockOn(t) || (matchClock(t) && t.for !== 'X' && t.for !== 'O')) return null;
  return t.deadline != null ? t.deadline : t.startBy != null ? t.startBy + turnLimit(t) * 1000 : null;
}
