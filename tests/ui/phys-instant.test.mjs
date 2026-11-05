// Physics shots online start at once (Mini Golf, Pool, Bowling): the mover's phone runs the shot with the same
// simulation on the same square as the server (net/moves.js shotPredict) and plays its motion while the server plays
// it for real; the server's record then takes the move over (ui/physics.js physJoin): the same recording, nothing
// changes; a different one, the motion here eases at its end to the server's final places (physSettle); a refused
// shot is taken back (physDrop). The page's Matter.js is the very file the site serves (matter.min.js), the server's
// the functions' own package, each with its own simulation. Rendered in Node with the browser's names stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const { makePhysics } = require('../../src/games/shared/physics-sim.js');
const fnMatter = fs.existsSync(new URL('../../functions/node_modules/matter-js', import.meta.url)) ? '../../functions/node_modules/matter-js' : 'matter-js';
const SERVER = makePhysics(require(fnMatter));                               // functions/index.js: makePhysics(require('matter-js'))
const PAGE = makePhysics(require('matter-js/build/matter.min.js'));          // ui/physics.js: the site's own copy (build-site.js stages it)
const C = await import('../../src/net/connect.js');
const M = await import('../../src/net/moves.js');
const R = await import('../../src/net/room.js');
const P = await import('../../src/ui/physics.js');
const { state } = await import('../../src/ui/app.js');

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const clone = v => JSON.parse(JSON.stringify(v));
const asServer = () => E.setPhysics(SERVER), asPage = () => E.setPhysics(PAGE);
const wire = rec => ({ state: JSON.parse(JSON.stringify(rec.state)), secrets: JSON.parse(JSON.stringify(rec.secrets || {})) });   // (the database's JSON both ways)
asServer();
function match(type, seed) {                                                  // an online match of nine squares of one game, as the server deals it
  const games = Object.fromEntries(E.TYPES.map(g => [g, g === type]));
  const rec = E.newOnlineMatch({ names: { X: 'Ann', O: 'Bo' }, games, timer: 0 }, lcg(seed), 'm-' + type);
  assert.ok(rec && rec.state.squares.every(q => q.mini.type === type), `${type}: a match of ${type}`);
  return rec;
}
// A shot for the player on the move: the computer's best, or (every other one) anything at all.
function shotFor(rec, rng, k) {
  const st = rec.state, i = st.lock != null ? st.lock : st.squares.findIndex(q => !q.owner), mini = st.squares[i].mini;
  const m = k % 2 ? E.physShot({ aim: mini.type === 'bowling' ? (rng() - 0.5) * 0.3 : (rng() - 0.5) * 6.2, power: 0.25 + rng() * 0.75 }) : E.physAi(clone(mini), st.turn, rng).move;
  return { i, m, side: st.turn };
}

for (const [type, shots] of [['golf', 14], ['pool', 16], ['bowling', 10]]) {
  test(`${type}: the phone's own simulation of a shot is the server's, frame for frame (the same inputs, the same square, the page's Matter.js)`, () => {
    let rec = match(type, 7), diffs = 0;
    const rng = lcg(11);
    for (let k = 0; k < shots && !rec.state.winner; k++) {
      const { i, m, side } = shotFor(rec, rng, k);
      asPage();
      for (let j = 0; j < k % 3; j++) PAGE.run(type, rec.state.squares[i].mini, type === 'golf' ? side : 'X', { aim: 0.1 * j, power: 0.5 });   // (other runs first: the engine's own counters move on, as they do on a phone)
      const pub = M.shotPredict(E.parseMatch({ state: JSON.stringify(rec.state) }), side, i, m);   // the phone: the public record, as the listener has it
      asServer();
      const r = E.applyOnlineMove(rec, side, i, m, lcg(100 + k), {});        // the server: its own record, with the secrets
      assert.equal(r.ok, true, `${type}: shot ${k} played (${r.reason})`);
      const srv = r.entries[0].phys;
      assert.ok(pub && pub.phys && pub.phys.rec, `${type}: shot ${k} simulated on the phone`);
      if (!P.physSame(pub.phys, srv)) diffs++;
      assert.deepEqual(pub.phys, srv, `${type}: shot ${k} the same recording, events and result on both`);
      rec = wire(r.rec);
    }
    assert.equal(diffs, 0);
  });
}

test('a phone whose result differs: its motion plays to its end, then eases to the server\'s final places; everything else is the server\'s', () => {
  asServer();
  const rec = match('pool', 3), i = 4, mini = rec.state.squares[i].mini, side = rec.state.turn;
  const local = E.applyOnlineMove(rec, side, i, { aim: 0.02, power: 0.9 }, lcg(1)).entries[0].phys;
  const server = E.applyOnlineMove(rec, side, i, { aim: -0.3, power: 0.7 }, lcg(1)).entries[0].phys;   // (a different outcome, as a device whose maths was off would see it)
  assert.ok(!P.physSame(local, server));
  const s = P.physSettle(local, server);
  const L = local.rec, S = server.rec, at = (rec, fr, id) => { const k = rec.ids.indexOf(id); return fr[2 * k] == null ? null : [fr[2 * k], fr[2 * k + 1]]; };
  assert.deepEqual(s.rec.frames.slice(0, L.frames.length), L.frames, 'the motion shown here, as it was (the same ids, the same order)');
  assert.deepEqual(s.rec.frames[s.rec.frames.length - 1], S.frames[S.frames.length - 1], 'it ends exactly where the server\'s does');
  const n = s.rec.frames.length - L.frames.length;
  assert.ok(n / s.rec.fps * 1000 >= 250 && n / s.rec.fps * 1000 <= 400, `the settling is short (${Math.round(n / s.rec.fps * 1000)} ms)`);
  assert.equal(s.ms, Math.round(s.rec.frames.length / s.rec.fps * 1000), 'the move lasts as long as the frames: the result comes once it has settled');
  assert.ok(s.settle > 0);
  for (const id of S.ids) {                                                   // every ball on both tables moves steadily from local's place to the server's
    const a = at(L, L.frames[L.frames.length - 1], id), b = at(S, S.frames[S.frames.length - 1], id);
    if (!a || !b) continue;
    let last = Infinity;
    for (const fr of s.rec.frames.slice(L.frames.length)) { const p = at(s.rec, fr, id), d = Math.hypot(p[0] - b[0], p[1] - b[1]); assert.ok(d <= last + 1e-9, `${id} closes in`); last = d; }
    assert.equal(last, 0);
  }
  assert.deepEqual(s.events, local.events, 'the sounds heard came from the motion shown');
  for (const k of ['pocketed', 'scratch', 'own', 'theirs', 'black', 'cue', 'by', 'aim', 'power']) assert.deepEqual(s[k], server[k], `${k}: the server's`);
  const same = P.physSettle(server, server);
  assert.deepEqual(same.rec, server.rec, 'nothing to settle when both agree');
  assert.equal(same.settle, undefined);
});

// ---- the whole flow on the page: the shot sent, played at once, then the server's answer ----
let answer = null;
const sent = [];
C.setFb({ fns: {}, uid: 'u1', fnM: {}, db: {}, m: new Proxy({}, { get: () => () => Promise.resolve(stub()) }) });   // (a stand-in SDK: every database call answers, with nothing)
C.setConnected(true);
C.setCall((name, data) => { if (name !== 'move') return Promise.resolve({ ok: true }); sent.push(clone(data)); return new Promise(ok => { answer = ok; }); });
const settle = async () => { for (let k = 0; k < 20; k++) await new Promise(r => setTimeout(r, 0)); };
function onPage(rec, side, i) {                                               // this phone in the match: the record as the listener gave it, the square zoomed
  asPage();
  state.online = { kind: 'mm', game: 'g1', me: side, joined: true, matchId: rec.state.id, shownSeq: rec.state.seq, room: null, code: null };
  state.sc = null; state.cpu = null; state.flash = null; state.done = null; state.spot = null; state.winner = null;
  R.takeFields(clone(rec.state));
  state.screen = 'mini'; state.zoom = i;
  R.setRoom({ kind: 'mm', status: 'playing', match: { state: JSON.stringify(rec.state) }, players: {} });
  R.setMoveWait(null);
}

test('online: the shot moves at once, before the server answers; refused, it is taken back and the table is as it was', async () => {
  asServer();
  const rec = match('golf', 5), i = 4, side = rec.state.turn, before = clone(rec.state.squares);
  onPage(rec, side, i);
  const m = E.physShot({ aim: 0.05, power: 0.6 });
  const going = M.dbMove(i, m, null);
  const pd = P.physPendOn();
  assert.ok(pd && pd.sq === i && pd.p === side, 'the shot is playing here, the server not yet heard from');
  assert.equal(sent.length, 1, 'and it went to the server');
  asServer();
  assert.deepEqual(pd.ph, E.applyOnlineMove(rec, side, i, m, lcg(1)).entries[0].phys, 'the motion is the server\'s own');
  assert.equal(state.flash, null, 'no result shown: that is the server\'s');
  assert.deepEqual(state.squares, before, 'the square as the record has it');
  answer({ ok: false, reason: 'turn' });
  await going; await settle();
  assert.equal(P.physPendOn(), null, 'refused: the shot is gone');
  assert.equal(state.flash, null);
  assert.deepEqual(state.squares, before, 'the table as it was before the shot');
  sent.length = 0;
});

test('online: the server\'s record takes the shot over where its motion has got to: the same, nothing changes; different, it settles to the server\'s', async () => {
  for (const diverge of [false, true]) {
    asServer();
    const rec = match('bowling', 9), i = 2, side = rec.state.turn;
    onPage(rec, side, i);
    const m = E.physShot({ aim: 0.01, power: 0.85 });
    const going = M.dbMove(i, m, null);
    const pd = P.physPendOn();
    assert.ok(pd, 'the roll plays at once');
    asServer();
    const r = E.applyOnlineMove(rec, side, i, diverge ? E.physShot({ aim: 0.09, power: 0.5 }) : m, lcg(2), {});   // (diverge: the server's simulation came out otherwise)
    const srv = r.entries[0];
    asPage();
    R.applyMatch({ match: { state: JSON.stringify(r.rec.state) } });          // the listener: the server's record
    assert.equal(P.physPendOn(), null, 'taken over');
    const f = state.flash;
    assert.ok(f && f.phys, 'the move\'s result is up, from the server\'s record');
    assert.equal(f.phys.knocked, srv.phys.knocked, 'the pins counted are the server\'s');
    assert.deepEqual(state.squares[i], r.rec.state.squares[i], 'the square is the server\'s');
    if (!diverge) assert.deepEqual(f.phys, srv.phys, 'the same recording: played on as it was');
    else {
      assert.deepEqual(f.phys.rec.frames.slice(0, pd.ph.rec.frames.length), pd.ph.rec.frames, 'the motion shown here plays on to its end');
      assert.deepEqual(f.phys.rec.frames[f.phys.rec.frames.length - 1], srv.phys.rec.frames[srv.phys.rec.frames.length - 1], 'then settles where the server left the pins');
    }
    answer({ ok: true, seq: r.rec.state.seq });
    await going; await settle();
    assert.equal(state.squares[i].mini.pins[side], srv.after.mini.pins[side], 'the score is the server\'s');
    state.flash = null; state.done = null; sent.length = 0;
  }
});
