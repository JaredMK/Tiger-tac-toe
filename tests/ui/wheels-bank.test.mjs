// Risky Spins: the winning Bank (the bank that reaches the target) fills the score gauge to the final total first,
// eased as any bank's (the bar and the points together, timed from the move), and only then does the win show (the
// header's "Won by", ui/mini.js flashLine, from the end of the move's animation: rules.js flashMs). The same screen
// plays the mover's own bank, the computer's and an online opponent's replay (their recorded flash); Speed runs the
// whole move at one rate, so the order holds there too. Rendered in Node with the browser's names stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const V = await import('../../src/games/wheels/view.js');
const R = await import('../../src/games/wheels/rules.js');
const { flashLine } = await import('../../src/ui/mini.js');
const { state } = await import('../../src/ui/app.js');
state.setup = Object.assign({}, state.setup, { names: { X: 'Xena', O: 'Olaf' } });

// A match with a Risky Spins square where X has 26 and a pot of 7 in their turn: Bank wins the square.
function winningBank() {
  const st = E.newMatch(E.makeRng('wb'), { names: { X: 'Xena', O: 'Olaf' } });
  const sq = st.squares[4];
  sq.mini = E.newMini('wheels', E.makeRng('wb-sq')); sq.owner = null;
  Object.assign(sq.mini, { pts: { X: 26, O: 12 }, turn: { by: 'X', pot: 7, n: 2 } });
  st.turn = 'X'; st.lock = 4;
  const r = E.playMove(st, 4, 'bank', E.makeRng('wb-mv'));
  assert.equal(r.ok, true, r.reason);
  return { st, sq, f: r.flash };
}
const screenOf = (sq, f, view) => V.screen(sq, f, null, sq.mini, false, true, f, null, () => false, () => -1, true, view || 'X', '');
const tally = (html, p) => { const at = html.indexOf(`ctal ${p}`); assert.ok(at >= 0, `the ${p} tally`); return html.slice(at, html.indexOf('</small>', at)); };

test('Risky Spins: the winning Bank fills the gauge and counts the points up to the final total, as any bank does', () => {
  const { sq, f } = winningBank();
  assert.equal(f.kind, 'claim'); assert.equal(f.wheel.kind, 'bank'); assert.equal(sq.owner, 'X'); assert.equal(sq.mini.pts.X, 33);
  const x = tally(screenOf(sq, f), 'X');
  assert.match(x, /<i class="grow" style="--w0:86\.7%;--w1:100\.0%;--t:250ms;--d:500ms">/, 'the gauge: from 26 of 30 to full, as the pot lands, over the fill');
  assert.match(x, /<b class="cnt" data-from="26" data-delay="250" data-ms="500">33<\/b>\/30/, 'the points count from 26 to 33 with it');
  assert.doesNotMatch(tally(screenOf(sq, f), 'O'), /grow|cnt/, 'the other tally stands still');
  assert.doesNotMatch(screenOf(sq, f), /Won by/, 'the game never says the win itself (the header does, after)');
  // a bank that does not win: the same gauge, the same timing
  const m = E.newMini('wheels', E.makeRng('wb-plain')); Object.assign(m, { pts: { X: 4, O: 0 }, turn: { by: 'X', pot: 7, n: 2 } });
  const st = E.newMatch(E.makeRng('wb2'), {}); st.squares[0].mini = m; st.turn = 'X'; st.lock = 0;
  const r = E.playMove(st, 0, 'bank', E.makeRng('x'));
  assert.equal(r.flash.kind, 'move');
  assert.match(tally(screenOf(st.squares[0], r.flash), 'X'), /<i class="grow" style="--w0:13\.3%;--w1:36\.7%;--t:250ms;--d:500ms">.*data-from="4" data-delay="250" data-ms="500">11</s);
});

test('Risky Spins: the win shows only once the gauge has filled; the move\'s time covers it all (Normal and Speed)', () => {
  const { f } = winningBank();
  const gauge = R.WHEELT.bank + R.WHEELT.fill, won = E.playMs(f, 4), plain = E.playMs(Object.assign({}, f, { kind: 'move' }), 4);
  assert.ok(plain >= gauge + 200, `a bank's own time (${plain} ms) holds the full gauge (${gauge} ms) a moment`);
  assert.ok(won >= gauge + 500, `the win (${won} ms) comes well after the gauge is full (${gauge} ms)`);
  assert.equal(won - plain, R.WHEELT.won);
  assert.match(flashLine(f), /Won by/, 'then the header says it (from the end of the move\'s animation)');
  // Speed: the move runs at one rate (core/timer.js moveRate; its CSS animations and counts by the move's own clock),
  // so the gauge and the win keep their order and their proportions
  const rates = {};
  for (const mode of ['normal', 'speed']) {
    E.setAnimMode(mode);
    const rate = rates[mode] = E.moveRate('wheels', 1);
    assert.ok(gauge / rate < won / rate - 400 / rate, `${mode}: the gauge full at ${Math.round(gauge / rate)} ms, the win at ${Math.round(won / rate)} ms`);
  }
  E.setAnimMode('normal');
  assert.ok(rates.speed > rates.normal, 'Speed: the whole move faster, gauge and win alike (not a real-time game)');
});

test('Risky Spins: an opponent\'s (or the computer\'s) winning Bank replays the same way on the other phone', () => {
  const { sq, f } = winningBank();
  const o = tally(screenOf(sq, f, 'O'), 'X');   // (the viewer is O: X's bank replaying)
  assert.match(o, /<i class="grow" style="--w0:86\.7%;--w1:100\.0%;--t:250ms;--d:500ms">/);
  assert.match(o, /data-from="26" data-delay="250" data-ms="500">33</);
  // the square's last result is the viewer's own, the replay's is X's bank: the gauge is the replay's
  const shown = JSON.parse(JSON.stringify(sq.mini)); shown.last = { by: 'O', kind: 'bust', w: 'high', v: -1, seg: 0, at: 0.05, from: 0, pot: 4 };
  assert.match(tally(V.screen({ owner: null, mini: shown }, f, null, shown, false, true, f, null, () => false, () => -1, false, 'O', ''), 'X'), /data-from="26"[^>]*>33</);
});

// The table draws the wheels the square has: two for a square dealt now (the safe one and the risky one), three for one dealt
// before November 2026 and still in a match (view.js wheelTable, styles.css .rwrow.n2 / .n3).
test('Risky Spins: a two-wheel square draws two wheels, an old three-wheel square draws its three', () => {
  const count = html => (html.match(/<button class="rwheel /g) || []).length;
  const two = E.newMini('wheels', E.makeRng('two-wheels')), sq2 = { owner: null, mini: two };
  const h2 = V.screen(sq2, null, null, two, false, false, null, null, () => false, () => -1, false, 'X', '');
  assert.equal(count(h2), 2); assert.match(h2, /class="rwrow n2"/);
  assert.match(h2, /class="rwheel high"/); assert.match(h2, /class="rwheel low"/); assert.doesNotMatch(h2, /rwheel mid/);
  assert.equal((h2.match(/data-act="move"/g) || []).length, 3, 'two wheels and Bank');
  const three = JSON.parse(JSON.stringify(two));
  three.wheels.mid = [5, 6, -1, 4, 7, 5, 6, 4, -1, 5]; three.rest = { high: 0, mid: 0, low: 0 };
  const h3 = V.screen({ owner: null, mini: three }, null, null, three, false, false, null, null, () => false, () => -1, false, 'X', '');
  assert.equal(count(h3), 3); assert.match(h3, /class="rwrow n3"/); assert.match(h3, /class="rwheel mid"/);
  assert.match(h3, /The blue wheel/, 'the medium wheel keeps its look');
  // the opponent's spin of either kind of square highlights the wheel it spun
  const flash = { wheel: { kind: 'spin', w: 'low', v: 3, seg: 1, at: 0.15, from: 0, pot: 3, pts: { X: 0, O: 0 }, target: 30, py: true }, by: 'O' };
  assert.match(V.screen({ owner: null, mini: two }, flash, null, two, false, true, flash, null, () => false, () => -1, false, 'X', ''), /class="rwheel low spun"/);
});
