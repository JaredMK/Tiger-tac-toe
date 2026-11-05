// The zoom between the main board and a square (ui/fx.js): 300 ms in Normal, 180 ms in Speed (at the admin's
// Animation speed 1), none with reduced motion; back from a square, a claim's stamp and a draw's Draw stamp start
// only once the zoom-out has landed (their event is set that far ahead, their sounds with it), and asking again (a
// re-render) never moves them. Rendered in Node with the browser's names stubbed (no page needed); the zoom itself is
// checked in a browser (every game, the canvas sizes, the frames).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const { state, setLastView } = await import('../../src/ui/app.js');
const { ANIM, setAnimMode, setAnimSpeed } = await import('../../src/core/timer.js');
const { ZOOM, zoomMs, zoomLeft, fxAt, stampFx, drawFx } = await import('../../src/ui/fx.js');
const { renderBoard } = await import('../../src/ui/board.js');
const fs = await import('node:fs');

ZOOM.off = false;                                   // (Node has no reduced-motion answer: the zoom as a phone has it)
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 25, `${msg}: ${a} vs ${b}`);

test('the zoom lasts 300 ms in Normal and 180 ms in Speed; none with reduced motion', () => {
  setAnimSpeed(1); setAnimMode('normal');
  assert.equal(zoomMs(), 300);
  setAnimMode('speed');
  assert.equal(zoomMs(), 180, 'Speed: not scaled again by its own multiplier');
  assert.equal(ANIM.speed, 2);
  setAnimSpeed(2); setAnimMode('normal');
  assert.equal(zoomMs(), 150, "the admin's Animation speed paces it like the rest of the game");
  setAnimSpeed(1);
  ZOOM.off = true; assert.equal(zoomMs(), 0, 'reduced motion: none'); ZOOM.off = false;
});

// Square 0 one move from X's line (claim) or from a full board with no line (draw); the move played, the result over.
let n = 0;
function backFrom(kind) {
  const rng = E.makeRng('zoom-' + kind);
  Object.assign(state, E.newMatch(rng, { games: ['ttt', 'c4', 'hilo'] }), { screen: 'mini', zoom: 0, online: null, cpu: null, sc: null });
  state.id = `z${kind}${++n}`;                     // (each its own events)
  state.squares[0].mini = E.newMini('ttt', rng);
  const cells = kind === 'claim' ? ['X', 'X', null, 'O', 'O'] : ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X'];
  cells.forEach((p, k) => { state.squares[0].mini.cells[k] = p; });
  state.turn = 'X';
  const r = E.playMove(state, 0, kind === 'claim' ? 2 : 8, rng);
  assert.equal(r.ok, true);
  setLastView('mini:0');                            // (the square was the last screen drawn)
  E.endFlash(state);                                // the result over: the board is next (core/board.js leaveSquare)
  assert.equal(state.screen, 'board');
}

test('back from a square: the claim stamp starts once the zoom-out has landed (Normal and Speed), once', () => {
  for (const mode of ['normal', 'speed']) {
    setAnimMode(mode);
    backFrom('claim');
    const D = zoomMs(), t = performance.now();
    assert.equal(zoomLeft(), D, 'the zoom-out the next render starts');
    assert.equal(stampFx(), true);
    near(fxAt('stamp', state.stampId), t + D, `${mode}: the stamp's event is the landing`);
    const at = fxAt('stamp', state.stampId);
    const html = renderBoard();
    assert.match(html, new RegExp(`class="own-ov stamp" data-fx="${at}"`), 'drawn as stamping, held before its start until then');
    assert.equal(stampFx(), undefined, 'asked again (a re-render): nothing restarts');
    assert.equal(fxAt('stamp', state.stampId), at);
    assert.equal(renderBoard(), html);
  }
  setAnimMode('normal');
});

test("back from a drawn square: its Draw stamp waits for the zoom-out too", () => {
  backFrom('draw');
  const t = performance.now();
  assert.equal(drawFx(null), true);
  near(fxAt('draw', state.drawId), t + 300, 'the Draw stamp starts as the view lands');
  assert.equal(drawFx(null), false, 'once');
});

test('no zoom pending: a stamp starts at once (a square left another way, reduced motion)', () => {
  backFrom('claim');
  setLastView('board:null');                        // (already drawn on the board)
  assert.equal(zoomLeft(), 0);
  const t = performance.now();
  stampFx();
  near(fxAt('stamp', state.stampId), t, 'now');
  backFrom('claim');
  ZOOM.off = true;
  assert.equal(zoomLeft(), 0, 'reduced motion: none to wait for');
  ZOOM.off = false;
});

test('the old zoom effects are gone, the computer waits for the zoom into its square, the next playback for the zoom out', () => {
  const css = fs.readFileSync(new URL('../../src/ui/styles.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /\bzoomin\b|zoominx|zoomout|\.zout\b|\.mini\.enter/, 'no second zoom stacked on the new one');
  assert.match(css, /\.zghost \{[^}]*pointer-events: none/, 'the stand-ins never take a tap');
  const turns = fs.readFileSync(new URL('../../src/ui/turns.js', import.meta.url), 'utf8');
  assert.match(turns, /Math\.max\(CPU_MS\.zoom, zoomBusy\(\)\)/);
  const room = fs.readFileSync(new URL('../../src/net/room.js', import.meta.url), 'utf8');
  assert.match(room, /Math\.max\(stampLeft\(\), zoomLeft\(\)\)/);
});
