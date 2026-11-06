// A drawn square's Draw stamp and shuffle, played through the page's own flows on a clock of the test's own (every
// timer, performance.now and Date.now): against the computer (the player's draw, and the computer's, after its
// replay), and online from the server's record (this phone's own move, and the other player's, after its replay). Each
// time the stamp starts once, from the move's event, back on the board after the zoom-out, before the new game is
// anyone's to play: nothing that comes next (the computer's square lit up and its zoom, the next move played back from
// the record) starts until it is over. Rendered in Node with the browser's names stubbed (no page needed).
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
// Moves the clock on in small steps until `ok` holds (each step a look: `each`); fails after `max` ms.
function until(ok, max, each, what) {
  for (let n = 0; n < max / 10; n++) { if (ok()) return; advance(10, each); }
  assert.fail(`never: ${what}`);
}

const require = createRequire(import.meta.url);
const E = require('../engine.js');
const { state, setLastView } = await import('../../src/ui/app.js');
const { ANIM, setAnimMode, setAnimSpeed } = await import('../../src/core/timer.js');
const { ZOOM, zoomMs, fxAt, drawLeft } = await import('../../src/ui/fx.js');
const { renderBoard, DRAW_MS } = await import('../../src/ui/board.js');
const { dismissFlash, scheduleCpu } = await import('../../src/ui/turns.js');
const { SND } = await import('../../src/audio/sound.js');
const R = await import('../../src/net/room.js');

ZOOM.off = false;                                    // (Node has no reduced-motion answer: the zoom as a phone has it)
setAnimSpeed(1);
const plays = [];
const play0 = SND.play;
SND.play = function (n, o) { plays.push(n); return play0.call(this, n, o); };
const stamps = () => plays.filter(n => n === 'stamp').length;
const FULL = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X'];           // a Tic-Tac-Toe one move (cell 8) from a full board with no line
const OWN = [null, 'X', 'O', 'O', 'X', 'X', 'X', 'O', 'O'];        // every other square won, no line: square 0 is the only one to play
const stampOn = () => /class="drawst"/.test(renderBoard());

// Watches the board from the move on: when its Draw stamp first started (its event), how many times it was started,
// and that nothing else showed over its square or took the board away while it played.
function watch() {
  const w = { id: null, at: null, starts: 0, cut: null };
  w.look = () => {
    const id = state.drawStamp != null ? state.drawId : null, at = id != null ? fxAt('draw', id) : null;
    if (at != null && (at !== w.at || id !== w.id)) { w.starts++; w.id = id; w.at = at; }
    if (w.at != null && w.cut == null && T < w.at + DRAW_MS / ANIM.speed) {
      if (state.screen !== 'board') w.cut = `the board left (${state.screen}) ${Math.round(T - w.at)} ms into it`;
      else if (state.spot && state.spot.square === 0) w.cut = `a glow over its square ${Math.round(T - w.at)} ms into it`;
      else if (state.drawStamp !== 0) w.cut = `cleared ${Math.round(T - w.at)} ms into it`;
    }
  };
  return w;
}

function cpuMatch(cpu, turn, id) {   // (turn: whose move it is)
  const rng = E.makeRng('draw-flow-' + id);
  Object.assign(state, E.newMatch(rng, { games: ['ttt', 'c4', 'hilo'] }), { screen: 'board', zoom: null, online: null, sc: null, flash: null, done: null, spot: null, stamp: null, drawStamp: null });
  state.id = id; state.cpu = cpu; state.cpuLevel = 'normal';
  state.squares.forEach((sq, i) => { sq.mini = E.newMini('ttt', E.makeRng('q' + i)); sq.owner = OWN[i]; });
  FULL.forEach((p, k) => { state.squares[0].mini.cells[k] = p; });
  state.turn = turn;
  setLastView('board:null');
}

for (const mode of ['normal', 'speed']) {
  test(`against the computer (${mode}): the player's draw stamps in on the board, once, and the computer's turn waits for it`, () => {
    setAnimMode(mode);
    cpuMatch('O', 'X', 'cpu-me-' + mode);
    state.screen = 'mini'; state.zoom = 0;
    const r = E.playMove(state, 0, 8, E.makeRng('m'));
    assert.equal(r.flash.kind, 'draw');
    setLastView('mini:0');
    const s0 = stamps(), w = watch();
    dismissFlash();                                                  // the result over: back to the board (core/board.js leaveSquare), the computer's turn
    assert.equal(state.screen, 'board'); assert.equal(state.drawStamp, 0);
    w.look();
    assert.equal(w.starts, 1, 'its event started as the board came back');
    assert.ok(Math.abs(w.at - (T + zoomMs())) < 2, 'timed from the zoom-out landing');
    assert.ok(stampOn(), 'the stamp on the board');
    until(() => state.spot, 5000, w.look, "the computer's square lit up");
    assert.equal(w.cut, null, w.cut);
    assert.ok(T >= w.at + DRAW_MS / ANIM.speed - 1, `the computer's glow only once the stamp and shuffle are over (${Math.round(T - w.at)} ms)`);
    assert.equal(w.starts, 1, 'started once');
    assert.equal(stamps() - s0, 1, 'its sound once');
    until(() => state.flash, 5000, w.look, "the computer's move");
    assert.equal(w.starts, 1);
    advance(10000);                                                  // (its move over: the player's turn, nothing left running)
  });
}

test("against the computer: the computer's draw stamps in after its replay, back on the board, once", () => {
  setAnimMode('normal');
  cpuMatch('X', 'X', 'cpu-it');                                      // (the computer to move)
  const s0 = stamps(), w = watch();
  scheduleCpu();                                                     // its turn: thought, its square lit up, the zoom, its replay
  until(() => state.flash, 8000, () => { w.look(); assert.equal(w.starts, 0, 'nothing before its move'); }, "the computer's move");
  assert.equal(state.flash.kind, 'draw'); assert.equal(state.screen, 'mini');
  until(() => state.screen === 'board', 5000, w.look, 'back on the board');
  w.look();
  assert.equal(w.starts, 1, 'started as the board came back, after the replay');
  assert.ok(stampOn());
  advance(DRAW_MS + zoomMs() + 50, w.look);
  assert.equal(w.cut, null, w.cut);
  assert.equal(w.starts, 1, 'started once'); assert.equal(stamps() - s0, 1, 'its sound once');
  assert.equal(drawLeft(), 0); assert.ok(!stampOn(), 'over: the new game alone');
});

// Online: the server's record (core/records.js), as the listener hands it over (net/room.js applyMatch).
function onlineMatch(me, id) {
  let seed = 9;
  const rng = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const games = Object.fromEntries(E.TYPES.map(g => [g, ['ttt', 'c4', 'hilo'].includes(g)]));
  const rec = E.newOnlineMatch({ names: { X: 'Ann', O: 'Bo' }, games, timer: 0 }, rng, id);
  rec.state.squares[0].mini = E.newMini('ttt', E.makeRng('o'));
  FULL.forEach((p, k) => { rec.state.squares[0].mini.cells[k] = p; });
  rec.state.turn = 'X';
  const st0 = JSON.parse(JSON.stringify(rec.state));
  const r = E.applyOnlineMove(rec, 'X', 0, 8, rng, {});              // the server plays X's move: the square drawn, a new game dealt
  assert.equal(r.ok, true); assert.equal(r.entries[0].kind, 'draw');
  Object.assign(state, JSON.parse(JSON.stringify(st0)), { cpu: null, sc: null, flash: null, done: null, spot: null, stamp: null, drawStamp: null });
  state.screen = me === 'X' ? 'mini' : 'board'; state.zoom = me === 'X' ? 0 : null;   // (the mover in the square, the other phone on the board)
  state.online = { kind: 'mm', me, game: 'g-' + id, matchId: st0.id, shownSeq: st0.seq || 0 };
  setLastView(state.screen + ':' + state.zoom);
  return { st: r.rec.state, pub: { state: JSON.stringify(r.rec.state) } };
}
for (const [me, who] of [['X', "this phone's own move"], ['O', "the other player's move, after its replay"]]) {
  test(`online, from the record: ${who} draws the square; its Draw stamp on the board once; the next playback waits for it`, () => {
    setAnimMode('normal');
    const m = onlineMatch(me, 'on-' + me), s0 = stamps(), w = watch();
    R.applyMatch({ match: m.pub });
    if (me === 'O') assert.ok(state.spot && state.spot.square === 0, 'the square lit up first');
    until(() => state.flash, 5000, () => { w.look(); assert.equal(w.starts, 0, 'nothing before the move'); }, 'the move played');
    assert.equal(state.flash.kind, 'draw'); assert.ok(state.flash.drawn, 'the old game rides the entry');
    until(() => state.screen === 'board' && !state.flash, 5000, w.look, 'back on the board');
    w.look();
    assert.equal(w.starts, 1, 'started as the board came back');
    assert.equal(state.drawStamp, 0); assert.ok(stampOn());
    assert.ok(R.presenting(), 'still presenting: the next move from the record waits');
    R.applyMatch({ match: m.pub });                                  // the record again (a clock or presence write): nothing restarts
    w.look(); assert.equal(w.starts, 1);
    until(() => !R.presenting(), 3000, w.look, 'the stamp over');
    assert.ok(T >= w.at + DRAW_MS / ANIM.speed - 1, 'held until the stamp and shuffle are over');
    assert.equal(w.cut, null, w.cut);
    assert.equal(w.starts, 1, 'started once'); assert.equal(stamps() - s0, 1, 'its sound once');
  });
}
