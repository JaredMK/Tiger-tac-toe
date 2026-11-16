// (harness from win-returns.test.mjs) Winning a square always brings the phone back to the main board (November 2026): for every mini-game, against the
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
{ const w = globalThis.window; globalThis.window = new Proxy(w, { get: (t, k) => (k === 'matchMedia' ? () => ({ matches: false, addEventListener() {}, addListener() {} }) : w[k]) }); }   // (no reduced motion: the moves' animations take their real time here)
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

// The other side's turn played back condensed (December 2026, net/room.js applyMatch, core/timer.js TURN_REPLAY): a
// turn of many actions (Risky Spins: spins, then the bank), not watched live, plays back as one glow and zoom and its
// actions at the speed that fits the whole turn into about 4 s; this phone's match clock does not run while it plays and
// starts at its end (the 'go' call, core/records.js applyOnlineGo), never at the server's fallback.
test('online: the other side\'s whole Risky Spins turn plays back condensed, about 4 s, and this phone\'s clock starts at its end', async () => {
  let done = 0;
  for (let seed = 1; seed < 60 && done < 3; seed++) {
    const S = onlineMatch('wheels', seed, 'm5+5');
    if (!S) continue;
    const gos = []; const call0 = (name, d) => { if (name === 'move' && d.kind === 'go') { gos.push(T); return S.server('X', r => E.applyOnlineGo(r, 'X', Date.now())); } return Promise.resolve({ ok: true }); };
    C.setCall(call0);
    advance(4000); await flush();                                       // (the side reveal, the first look)
    for (const m of ['low', 'bank']) if (S.rec.state.turn === 'X') { S.server('X', r => E.applyOnlineMove(r, 'X', 0, m, lcg(seed), {})); advance(200); await flush(); }   // (this phone's turn first: a spin and a bank, as the record has them)
    await until(() => !state.flash && !state.done && !RP.repActive() && !R.presenting() && state.turn === 'O', 15000);
    if (S.rec.state.turn !== 'O') { R.stopListening(); continue; }
    const i = 4; let n = 0;
    S.server('O', r => E.applyOnlineOpen(r, 'O', i)); advance(200); await flush();   // (the square opened, as the phone does for a game with time of its own: the turn held to it)
    const seq0 = state.online.shownSeq;
    for (; n < 6 && S.rec.state.turn === 'O'; n++) {                    // O spins, a moment apart; this phone is not watching
      const m = n < 3 ? 'low' : 'bank';
      S.server('O', r => E.applyOnlineMove(r, 'O', i, m, lcg(seed * 7 + n), {}));
      advance(200); await flush();
      if (m === 'bank' || S.rec.state.turn !== 'O') break;
      advance(1300); await flush();
      assert.equal(state.online.shownSeq, seq0, 'nothing of their turn played back while it is under way');
    }
    if (S.rec.state.turn !== 'X' || S.rec.state.winner) continue;
    const t0 = T - 200, actions = (S.rec.state.recent || []).filter(e => e.by === 'O').length;
    assert.equal(S.rec.state.timer.deadline, null, 'the clock waits for the playback');
    const back = () => !state.flash && !state.done && !state.spot && !RP.repActive() && !R.presenting() && state.screen === 'board' && state.turn === 'X';
    let sawSpot = 0, lastSpot = false;
    const ok = await until(back, 20000, () => { if (state.spot && !lastSpot) sawSpot++; lastSpot = !!state.spot; });
    const took = T - t0;
    assert.ok(ok, 'the turn played back and the board came back');
    assert.ok(took <= 4800, `the whole turn (${actions} actions) played back in ${took} ms`);
    assert.ok(sawSpot <= 1, `one glow for the turn (${sawSpot})`);
    await until(() => gos.length > 0, 1000);
    assert.equal(gos.length, 1, 'one go at the end');
    await until(() => S.rec.state.timer.deadline != null, 1000);
    const tm = S.rec.state.timer, began = tm.deadline - tm.bank.X;
    assert.ok(Math.abs(began - (1.7e12 + gos[0])) < 400, 'the clock starts at the playback\'s end');
    done++;
    advance(30000); await flush(); R.stopListening();
  }
  assert.ok(done >= 1, 'a turn of several actions was played back');
});
// Watching their turn (net/live.js watch): every Risky Spins spin plays in the square as it lands, and once the turn is
// over nothing of it is played back again.
test('online: a watched Risky Spins turn plays each spin as it lands and is not replayed after', async () => {
  const L = await import('../../src/net/live.js');
  let done = 0;
  for (let seed = 1; seed < 40 && done < 2; seed++) {
    const S = onlineMatch('wheels', seed, 'm5+5');
    if (!S) continue;
    C.setCall((name, d) => (name === 'move' && d.kind === 'go' ? S.server('X', r => E.applyOnlineGo(r, 'X', Date.now())) : Promise.resolve({ ok: true })));
    advance(4000); await flush();
    for (const m of ['low', 'bank']) if (S.rec.state.turn === 'X') { S.server('X', r => E.applyOnlineMove(r, 'X', 0, m, lcg(seed), {})); advance(200); await flush(); }
    await until(() => !state.flash && !state.done && !RP.repActive() && !R.presenting() && state.turn === 'O', 15000);
    if (S.rec.state.turn !== 'O') { R.stopListening(); continue; }
    const i = 4;
    S.server('O', r => E.applyOnlineOpen(r, 'O', i)); advance(200); await flush();
    L.setWatch({ sq: i }); state.screen = 'mini'; state.zoom = i; render();
    let spins = 0, banked = false;
    for (let n = 0; n < 4 && S.rec.state.turn === 'O'; n++) {
      const m = n < 3 ? 'low' : 'bank', seq = S.rec.state.seq;
      S.server('O', r => E.applyOnlineMove(r, 'O', i, m, lcg(seed * 7 + n), {}));
      advance(200); await flush();
      assert.ok(await until(() => state.online.shownSeq >= seq + 1 && !state.flash && !RP.repActive(), 8000), `the action played as it landed (${m})`);
      if (m === 'bank') banked = true; else spins++;
    }
    L.setWatch(null);
    if (!banked || S.rec.state.winner) { R.stopListening(); continue; }
    const seqEnd = state.online.shownSeq;
    let spot = false;
    await until(() => state.turn === 'X' && !state.flash && !R.presenting(), 4000, () => { if (state.spot) spot = true; });
    assert.equal(spot, false, 'no glow: the watched turn is not replayed');
    assert.equal(state.online.shownSeq, seqEnd);
    done++;
    advance(30000); await flush(); R.stopListening();
  }
  assert.ok(done >= 1, 'a watched turn of spins and a bank');
});
