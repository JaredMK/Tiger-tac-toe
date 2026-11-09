// A tap never just dies online. A move the phone cannot send at that moment (the move before still on its way, the other
// side on the move, the line down) says so: the error sound and a short note (net/moves.js tapHeld). And a result or a
// glow left on show with no timer to end it (a timer chain broken in the background, a view's exception) is cleared by
// the clock's watchdog after STUCK_MS, so the board's taps work again (ui/clock.js stuckWatch). Rendered in Node with the
// browser's names stubbed.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1.7e12 });
Object.defineProperty(globalThis, 'performance', { value: { now: () => Date.now() - 1.7e12 + 1e5 }, configurable: true, writable: true });
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const A = await import('../../src/ui/app.js');
const { state } = A;
const { SND } = await import('../../src/audio/sound.js');
const C = await import('../../src/net/connect.js');
const R = await import('../../src/net/room.js');
const M = await import('../../src/net/moves.js');
const K = await import('../../src/ui/clock.js');
const { render } = await import('../../src/ui/render.js');

const played = [];
SND.play = (name, o) => { played.push(name); return o; };
C.setFb({ fns: {}, uid: 'u-x', fnM: {}, db: {}, m: new Proxy({}, { get: () => () => Promise.resolve({ val: () => null }) }) });
C.setConnected(true);
C.setCall(() => Promise.resolve({ ok: true }));

function online(turn) {
  const rec = E.newOnlineMatch({ names: { X: 'Ann', O: 'Bo' }, games: { ttt: true }, timer: 0 }, E.makeRng('tap'), 'm-tap');
  rec.state.turn = turn;
  state.online = { kind: 'mm', game: 'g-tap', me: 'X', joined: true, matchId: 'm-tap', shownSeq: rec.state.seq, room: 'ABCDE', code: 'ABCDE', role: 'host', introFor: 'g-tap' };
  state.setup.names = { X: 'Ann', O: 'Bo' };
  const pub = { players: { X: { name: 'Ann' }, O: { name: 'Bo' } }, state: JSON.stringify(rec.state), timer: 0, mode: 'friend', status: 'playing' };
  R.setRoom({ kind: 'mm', status: 'playing', players: pub.players, match: { state: pub.state }, setup: { timer: 0 }, pub });
  R.takeFields(rec.state);
  Object.assign(state, { sc: null, cpu: null, flash: null, done: null, spot: null, winner: null, lock: null, screen: 'mini', zoom: 0, notice: null });
  R.setMoveWait(null); R.setPresentingSeq(null);
  clearTimeout(A.flashTimer); A.setFlashTimer(null);               // (a result timer from the case before; the live binding, not a copy)
  played.length = 0;
}

test('a tap the phone cannot send says so: the other side on the move, the line down, the move before still on its way', async () => {
  online('O');                                                       // the other side's turn (the phone's board a step behind: the control still enabled)
  assert.equal(await M.dbMove(0, 4, null), false);
  assert.equal(state.notice, 'Waiting for Bo');
  assert.deepEqual(played, ['error']);
  online('X'); C.setConnected(false); mock.timers.tick(500);
  assert.equal(await M.dbMove(0, 4, null), false);
  assert.equal(state.notice, 'No connection'); C.setConnected(true);
  online('X'); R.setMoveWait(Date.now());
  mock.timers.tick(500);
  assert.equal(await M.dbMove(0, 4, null), false);
  assert.equal(state.notice, 'Still sending your last move…');
  R.setMoveWait(null);
  online('X');                                                       // and a tap the phone can send goes: no note, the move shown here at once (an instant move)
  const p = M.dbMove(0, 4, null);
  assert.equal(state.notice, null);
  assert.equal(state.squares[0].mini.cells[4], 'X', 'the mark shows at once');
  await p;
});

test('a result left on show with no timer to end it is cleared by the watchdog after STUCK_MS, and a glow with no timer too', () => {
  online('X');
  state.flash = { kind: 'move', type: 'ttt', by: 'O', square: 0, next: 'X' }; state.screen = 'mini'; state.zoom = 0;   // (as if its timer never fired)
  K.tick();
  mock.timers.tick(K.STUCK_MS - 500); K.tick();
  assert.ok(state.flash, 'not yet: within the grace');
  mock.timers.tick(1000); K.tick();
  assert.equal(state.flash, null, 'the result cleared as its timer would have');
  assert.equal(state.screen, 'board', 'back on the board, where taps work again');
  online('X');
  state.spot = { square: 2, by: 'O', label: 'Bo plays here' }; state.screen = 'board';
  K.tick(); mock.timers.tick(K.STUCK_MS + 500); K.tick();
  assert.equal(state.spot, null, 'the glow cleared');
  render();
});
