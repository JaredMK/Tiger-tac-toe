// Winning a square always brings the phone back to the main board (November 2026): for every mini-game, against the
// computer, on one phone (Same phone) and online (a friend match: the server's record as the listener hands it over),
// a square claimed by this phone's move or by the other side's (the computer's, the opponent's replay) ends with the
// board on show, the square owned, nothing left on show (no result, no glow, no replay) and the next turn free, within
// a few seconds of the move. Played through the page's own flows on a clock of the test's own (every timer,
// performance.now and Date.now), the browser's names stubbed (no page needed).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
// The test's clock: timers run only as it is moved on (advance), in order, with the time at each one's moment.
let T = 1e6, nid = 1;
const timers = [];
globalThis.setTimeout = (fn, ms, ...a) => { const id = nid++; timers.push({ id, at: T + Math.max(0, Number(ms) || 0), fn, a }); return id; };
globalThis.clearTimeout = id => { const k = timers.findIndex(x => x.id === id); if (k >= 0) timers.splice(k, 1); };
globalThis.setInterval = () => 0; globalThis.clearInterval = () => {};
performance.now = () => T;
Date.now = () => 1.7e12 + T;
function advance(ms, each) {
  const end = T + ms;
  for (;;) {
    let k = -1;
    for (let j = 0; j < timers.length; j++) if (timers[j].at <= end && (k < 0 || timers[j].at < timers[k].at)) k = j;
    if (k < 0) break;
    const t = timers.splice(k, 1)[0];
    T = Math.max(T, t.at);
    t.fn(...t.a);
    if (each) each();
  }
  T = end;
}
// Moves the clock on in small steps until `ok` holds; false after `max` ms.
const flush = async () => { for (let k = 0; k < 4; k++) await new Promise(r => setImmediate(r)); };   // (the promises in flight: a call's answer, dbMove's await)
async function until(ok, max, each) { for (let n = 0; n < max / 20; n++) { if (ok()) return true; advance(20, each); await flush(); } return ok(); }

const require = createRequire(import.meta.url);
const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const bank = n => ({ questions: Array.from({ length: n }, (_, i) => ({ id: 'q' + i, cat: 'Test', q: `Question ${i}?`, a: 'Right ' + i, wrong: ['Wrong a' + i, 'Wrong b' + i, 'Wrong c' + i] })) });
const { state, setLastView } = await import('../../src/ui/app.js');     // (first: the page's own deal on load has no physics game in it)
const G = await import('../../src/games/index.js');
for (const t of G.TYPES) G.GAMES[t].view = await import(`../../src/games/${t}/view.js`);
const E = await import('../../src/core/engine.js');
const { makePhysics } = require('../../src/games/shared/physics-sim.js');
E.setPhysics(makePhysics(require('matter-js')));
E.setTriviaBank(bank(40));
E.setAiWeights({ normalSearch: 0, normalSharp: 0, hardSearch: 0, hardSharp: 0 });   // the flows are what is held here, not the computer's strength: its plain choices, no match search (minutes otherwise)
const { ZOOM } = await import('../../src/ui/fx.js');
const { scheduleCpu } = await import('../../src/ui/turns.js');
const M = await import('../../src/net/moves.js');
const R = await import('../../src/net/room.js');
const C = await import('../../src/net/connect.js');
const MM = await import('../../src/net/matchmaking.js');
const RP = await import('../../src/ui/replay.js');
const P = await import('../../src/ui/physics.js');
const { render } = await import('../../src/ui/render.js');
const K = await import('../../src/ui/clock.js');
const { devErrors } = await import('../../src/net/tracking.js');
ZOOM.off = false;                                                       // (Node has no reduced-motion answer: the zoom as a phone has it)
// Shared first, every game; then the race games again in Race mode (core/race.js), where a claimed square's drawing
// once threw (Higher/Lower, November 2026) and the board never came back.
const PASSES = [{ race: false, label: '' }, { race: true, label: ' (Race mode)' }];

const SETTLE_MS = 12000;                                                // a claim's end (its hold, the zoom-out, the stamp) is over well within this
const ALL = G.TYPES.filter(t => !G.OLD_TYPES.includes(t) && !G.SC_ONLY.includes(t));
let types = ALL;
function setPass(pass) { for (const t of E.RACE_TYPES) E.setTune(t, { mode: pass.race ? 'race' : 'shared' }); types = pass.race ? ALL.filter(t => E.RACE_TYPES.includes(t)) : ALL; }
const needsStart = t => E.ATT_TYPES.includes(t) || E.FINGER_TYPES.includes(t);
// The square and the move for the player on the move (a legal move at random, after Start where the game needs one).
function pickMove(st, p, rng, full) {
  const i = st.lock != null ? st.lock : st.squares.findIndex(q => !q.owner);
  if (i < 0) return null;
  const mini = (full || st).squares[i].mini;
  let m = mini.race ? null : E.randomLegalMove(mini, p, rng), at = i;   // (a race square: the computer's own choice, as random guesses at a target of one's own may never find it, with no cap)
  if (m == null || m === 'auto') {                                 // a staged game (a question to turn up, a round to start) or a race: the computer's own choice for this player
    let plan = null;
    try { plan = E.cpuMove(Object.assign({}, full || st, { turn: p }), rng, null, { level: 'normal', clock: () => performance.now() }); } catch (e) { plan = null; }
    if (plan && plan.move != null && plan.move !== 'auto' && (st.lock == null || plan.square === st.lock)) { m = plan.move; at = plan.square; }
  }
  return m == null || m === 'auto' ? null : { i: at, m };
}
// What the board must look like once a claim has settled.
function settled(i, who) {
  const sq = state.squares[i];
  return state.screen === 'board' && state.zoom == null && !state.flash && !state.done && !state.spot && !RP.repActive() && !P.physPendOn() && (sq.owner === who || !!state.winner);
}
const where = () => `screen=${state.screen} zoom=${state.zoom} flash=${state.flash ? state.flash.kind + '/' + state.flash.type : null} done=${!!state.done} spot=${!!state.spot} rep=${RP.repActive()} phys=${P.physPendOn()} turn=${state.turn} lock=${state.lock} winner=${state.winner} timers=${timers.length}`;

// ---- against the computer (this phone X, the computer O): the player's own claims and the computer's ----
function cpuMatch(type, seed, cpu) {
  const rng = E.makeRng(seed);
  state.online = null; state.sc = null; state.practice = null;
  Object.assign(state, E.newMatch(rng, { games: [type] }), { screen: 'board', zoom: null, flash: null, done: null, spot: null, stamp: null, drawStamp: null, winner: null, stats: null });
  state.cpu = cpu ? 'O' : null; state.cpuLevel = 'normal'; state.setup.names = { X: 'Ann', O: cpu ? 'Computer' : 'Bo' };
  setLastView('board:null');
  return rng;
}
async function playUntilClaim(mode, type, seed) {
  const rng = cpuMatch(type, seed, mode === 'cpu'), moves = lcg(7);
  for (let k = 0; k < 160 && !state.winner; k++) {
    const owned = state.squares.map(q => q.owner);
    if (state.turn === 'X' || mode === 'same') {
      const p = state.turn, mv = pickMove(state, p, moves);
      if (!mv) return { skipped: 'no move' };
      state.screen = 'mini'; state.zoom = mv.i; state.draft = ''; state.sel = []; render(); advance(400); await flush();   // (the zoom into the square)
      if (needsStart(type)) { E.attStart(state, mv.i, p, Date.now()); render(); }
      const m2 = needsStart(type) ? E.randomLegalMove(state.squares[mv.i].mini, p, moves) : mv.m;
      const r = M.attemptMove(m2);
      if (!r || !r.ok) return { skipped: `move refused (${r && r.reason})` };
      if (state.squares[mv.i].owner && !owned[mv.i]) return { claimed: mv.i, by: state.squares[mv.i].owner, own: true };   // (claimed as the move was made, by the mover or handed to the other side: the end plays from here)
      const claimedNow = state.squares.findIndex((q, j) => q.owner && !owned[j]);
      if (claimedNow >= 0) return { claimed: claimedNow, by: state.squares[claimedNow].owner, own: true };
      const again = () => state.lock != null && state.turn === p && !state.flash && !state.done;   // (a move that keeps the turn: the next goes from the same square)
      if (!await until(() => again() || (!state.flash && !state.done && state.screen === 'board'), SETTLE_MS)) return { stuck: `after ${p}'s move: ${where()}` };
    } else {
      scheduleCpu();
      const ok = await until(() => (state.turn === 'X' && !state.flash && !state.done && !state.spot && state.screen === 'board') || !!state.winner || state.squares.some((q, j) => q.owner && !owned[j]), 30000);
      if (!ok) return { stuck: `the computer's move never came back: ${where()}` };
      const j = state.squares.findIndex((q, jj) => q.owner && !owned[jj]);
      if (j >= 0) return { claimed: j, by: state.squares[j].owner, own: false };
    }
  }
  return { skipped: 'no claim in 160 moves' };
}

for (const pass of PASSES) for (const mode of ['cpu', 'same']) {
  test(`${mode === 'cpu' ? 'against the computer' : 'Same phone'}${pass.label}: winning a square comes back to the board, every mini-game`, async () => {
    setPass(pass);
    const bad = [], skipped = [], checked = [];
    for (const type of types) {
      if (mode === 'same' && G.NO_SAME_PHONE.includes(type)) continue;
      const errs0 = devErrors.length;
      const r = await playUntilClaim(mode, type, `${mode}-${type}`);
      if (r.skipped) { skipped.push(`${type}: ${r.skipped}`); continue; }
      if (r.stuck) { bad.push(`${type}: ${r.stuck}`); continue; }
      const ok = await until(() => settled(r.claimed, r.by), SETTLE_MS);
      if (!ok) bad.push(`${type}: a square won by ${r.by}${r.own ? ' (this phone)' : ' (the computer)'} never came back to the board: ${where()}`);
      else checked.push(type);
      if (devErrors.length > errs0) bad.push(`${type}: ${devErrors.slice(errs0).join(' | ')}`);
      advance(30000); await flush();                                // (everything left of the match runs out)
    }
    assert.deepEqual(bad, [], 'every claim settles on the board');
    assert.ok(checked.includes('hilo') && (pass.race || checked.includes('ttt')), `hilo checked (skipped: ${skipped.join('; ')})`);
    assert.ok(checked.length >= types.length - (pass.race ? 2 : 12), `games checked: ${checked.length} of ${types.length} (skipped: ${skipped.join('; ')})`);
  });
}

// ---- online (a friend match: this phone X, the other player O on the server): this phone's claims and the replayed ones ----
// The server here is the engine on the record, as the move function runs it (core/records.js applyOnlineMove): a call's
// answer and the record's arrival (net/matchmaking.js onGameValue) come in either order, as they do live.
function onlineMatch(type, seed, timer) {
  const rng = lcg(seed), games = Object.fromEntries(G.TYPES.map(g => [g, g === type]));
  let rec = E.newOnlineMatch({ names: { X: 'Ann', O: 'Bo' }, games, timer: timer || 0 }, rng, 'm-' + type, Date.now());
  if (!rec || !rec.state.squares.every(q => q.mini.type === type)) return null;
  rec = JSON.parse(JSON.stringify(rec));
  E.armClock(rec.state, [], Date.now());
  const pub = () => ({ players: { X: { name: 'Ann' }, O: { name: 'Bo' } }, state: JSON.stringify(rec.state), timer: timer || 0, mode: 'friend', status: 'playing' });
  state.online = { kind: 'mm', game: 'g-' + type, me: 'X', joined: true, matchId: null, shownSeq: null, room: 'ABCDE', code: 'ABCDE', role: 'host', introFor: 'g-' + type };
  Object.assign(state, { sc: null, cpu: null, practice: null, flash: null, done: null, spot: null, winner: null, stats: null, lock: null, stamp: null, drawStamp: null, screen: 'board', zoom: null });
  state.setup.names = { X: 'Ann', O: 'Bo' };
  R.setPresentingSeq(null); R.setMoveWait(null); R.setPendingRoom(null); M.setPredicted(null); RP.repStop(); P.physDrop(true);
  setLastView('board:null');
  let flip = false;
  const server = (side, fn) => {                                   // a call to the server: the record changed, then the answer and the record in either order
    const r = fn(rec);
    if (!r || !r.ok) return Promise.resolve({ ok: false, reason: r && r.reason });
    if (r.entries && (r.rec.state.turn !== rec.state.turn || r.rec.state.winner)) E.armClock(r.rec.state, r.entries, Date.now()); else if (r.entries && r.entries.length) E.holdClock(r.rec.state, r.entries);
    rec = JSON.parse(JSON.stringify(r.rec));
    flip = !flip;
    return new Promise(ok => { if (flip) { setTimeout(() => MM.onGameValue(pub()), 60); setTimeout(() => ok({ ok: true }), 140); } else { setTimeout(() => ok({ ok: true }), 60); setTimeout(() => MM.onGameValue(pub()), 140); } });
  };
  C.setCall((name, d) => {
    if (name !== 'move') return Promise.resolve({ ok: true });
    if (d.kind === 'start') return server('X', r => E.applyOnlineStart(r, 'X', d.square, Date.now()));
    if (d.kind === 'open') return server('X', r => E.applyOnlineOpen(r, 'X', d.square));
    if (d.kind === 'pick') return server('X', r => E.applyOnlinePick(r, 'X', d.square, d.card));
    if (d.kind === 'reveal') return server('X', r => E.applyOnlineReveal(r, 'X', d.square));
    return server('X', r => E.applyOnlineMove(r, 'X', d.square, d.move, lcg(5), { rep: d.rep }));
  });
  MM.onGameValue(pub());
  return { get rec() { return rec; }, pub, server };
}
C.setFb({ fns: {}, uid: 'u-x', fnM: {}, db: {}, m: new Proxy({}, { get: () => () => Promise.resolve({ val: () => null }) }) });
C.setConnected(true);
async function playOnlineUntilClaim(type, seed, timer) {
  const S = onlineMatch(type, seed, timer);
  if (!S) return { skipped: 'not dealt' };
  const moves = lcg(11);
  for (let k = 0; k < 160 && !S.rec.state.winner; k++) {
    const st = S.rec.state, owned = st.squares.map(q => q.owner), full = E.fullState(S.rec);
    if (st.turn === 'X') {
      if (!await until(() => state.turn === 'X' && !state.flash && !state.done && !state.spot && !RP.repActive() && !R.moveWait && (state.screen === 'board' || state.screen === 'mini'), SETTLE_MS)) return { stuck: `never free to move: ${where()}` };
      const mv = pickMove(st, 'X', moves, full);
      if (!mv) return { skipped: 'no move' };
      if (state.screen !== 'mini' || state.zoom !== mv.i) { state.screen = 'mini'; state.zoom = mv.i; state.draft = ''; state.sel = []; render(); advance(400); await flush(); }
      if (needsStart(type)) { let done = false; M.dbStart(mv.i).then(() => { done = true; }); if (!await until(() => done, 2000)) return { stuck: 'Start never answered' }; }
      const m2 = needsStart(type) ? E.randomLegalMove(E.fullState(S.rec).squares[mv.i].mini, 'X', moves) : mv.m;
      if (m2 == null) return { skipped: 'no move after Start' };
      M.attemptMove(m2);
      if (!await until(() => S.rec.state.seq > st.seq || !R.moveWait, 3000)) return { stuck: `the move never reached the server: ${where()}` };
      if (S.rec.state.seq === st.seq) return { skipped: `move refused` };
      const j = S.rec.state.squares.findIndex((q, jj) => q.owner && !owned[jj]);
      if (j >= 0) return { claimed: j, by: S.rec.state.squares[j].owner, own: true };
      if (!await until(() => (state.turn !== 'X' || state.lock != null) && !R.moveWait && !state.flash, SETTLE_MS)) return { stuck: `after this phone's move: ${where()}` };
    } else {
      if (needsStart(type)) { const r0 = E.applyOnlineStart(S.rec, 'O', st.lock != null ? st.lock : st.squares.findIndex(q => !q.owner), Date.now()); if (r0.ok) S.server('O', () => r0); advance(200); await flush(); }
      const st2 = S.rec.state, mv = pickMove(st2, 'O', moves, E.fullState(S.rec));
      if (!mv) return { skipped: 'no move for O' };
      const seqO = S.rec.state.seq;
      let ans = null; S.server('O', r => E.applyOnlineMove(r, 'O', mv.i, mv.m, lcg(9), {})).then(a => { ans = a; });   // (answered on the test's clock)
      advance(200); await flush();
      if (!ans) return { stuck: 'O\'s move never answered' };
      if (!ans.ok) return { skipped: `O's move refused (${ans.reason}: ${JSON.stringify(mv.m).slice(0, 40)})` };
      if (S.rec.state.seq === seqO) return { stuck: 'O\'s move did not take' };
      const j = S.rec.state.squares.findIndex((q, jj) => q.owner && !owned[jj]);
      if (j >= 0) return { claimed: j, by: S.rec.state.squares[j].owner, own: false };
      const back = () => !state.flash && !state.done && !state.spot && !RP.repActive() && !R.presenting() && (state.turn === 'X' ? state.screen === 'board' : state.lock != null && state.turn === 'O');   // (their move played back: the board, or their bonus move from the same square)
      if (!await until(back, 30000)) return { stuck: `the other player's move never played back: ${where()}` };
    }
  }
  return { skipped: 'no claim in 160 moves' };
}
for (const pass of PASSES) for (const timer of (pass.race ? ['m5+5'] : [0, 'm5+5'])) {
  test(`online (a friend match, timer ${timer || 'none'})${pass.label}: winning a square comes back to the board, every mini-game, this phone's claims and the replayed ones`, async () => {
    setPass(pass);
    const bad = [], skipped = [], checked = [], theirs = [];
    for (const type of types) {
      const errs0 = devErrors.length;
      const r = await playOnlineUntilClaim(type, 100 + types.indexOf(type), timer);
      if (r.skipped) { skipped.push(`${type}: ${r.skipped}`); continue; }
      if (r.stuck) { bad.push(`${type}: ${r.stuck}`); continue; }
      const ok = await until(() => settled(r.claimed, r.by), SETTLE_MS * 2);
      if (!ok) bad.push(`${type}: a square won by ${r.by}${r.own ? ' (this phone)' : ' (the other phone)'} never came back to the board: ${where()}`);
      else { checked.push(type); if (!r.own) theirs.push(type); }
      if (devErrors.length > errs0) bad.push(`${type}: ${devErrors.slice(errs0).join(' | ')}`);
      advance(30000); await flush();
      R.stopListening();
    }
    assert.deepEqual(bad, [], 'every claim settles on the board');
    assert.ok(checked.includes('hilo'), `hilo checked (skipped: ${skipped.join('; ')})`);
    assert.ok(checked.length >= types.length - (pass.race ? 2 : 12), `games checked: ${checked.length} of ${types.length} (skipped: ${skipped.join('; ')})`);
  });
}
