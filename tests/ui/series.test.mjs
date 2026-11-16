// Rematch as a best-of-3 (ui/series.js, CL-23): a local series counted once per match by player one and the other
// (whatever sides they draw), carried by a rematch, decided at 2 and started afresh; the results screen's badge, the
// Decider at 1–1; a friend room's series from the room by account; the head-to-head line.
import test from 'node:test';
import assert from 'node:assert/strict';
const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const S = await import('../../src/ui/series.js');
const { state } = await import('../../src/ui/app.js');
const { renderWin } = await import('../../src/ui/screens/win.js');
const end = (w, human, moves) => { Object.assign(state, { online: null, practice: null, cpu: human === 'X' ? 'O' : 'X', winner: w, winReason: 'line', winLine: [0, 4, 8], moves, screen: 'win' }); state.setup.human = human; state.setup.names = { X: 'X', O: 'O' }; };

test('a local series: counted once by player, whatever side they drew; Decider at 1–1; decided at 2, then afresh', () => {
  state.series = S.freshSeries();
  state.squares.forEach(q => { q.owner = null; });
  end('X', 'X', 11); S.seriesRecord(state); S.seriesRecord(state);
  assert.deepEqual([state.series.a, state.series.b, state.series.n], [1, 0, 1], 'counted once');
  assert.match(renderWin(), /Best of 3 · 1–0/);
  state.series = S.nextSeries(state.series);
  end('X', 'O', 13); S.seriesRecord(state);                     // the player drew O; the computer (X) won
  assert.deepEqual([state.series.a, state.series.b], [1, 1]);
  assert.match(renderWin(), /Decider!/);
  state.series = S.nextSeries(state.series);
  end('O', 'O', 9); S.seriesRecord(state);
  assert.ok(S.seriesOver(state.series));
  assert.match(renderWin(), /You win the series 2–1/);
  assert.match(renderWin(), /new series/);
  assert.deepEqual(S.nextSeries(state.series), S.freshSeries(), 'the Rematch after a decided series starts a new one');
});
test('a friend room: by account, from the room; the head-to-head line', () => {
  const v = S.seriesView({ online: { me: 'X' } }, { series: { n: 2, u1: 1, u2: 1 } }, 'u1', 'u2');
  assert.deepEqual([v.me, v.them, v.over], [1, 1, false]);
  assert.equal(S.seriesView({ online: { me: 'X' } }, { series: null }, 'u1', 'u2'), null);
  assert.equal(S.h2hLine('Sam', { wins: 7, losses: 4 }), 'You lead Sam 7–4');
  assert.equal(S.h2hLine('Sam', { wins: 7, losses: 9 }), 'Sam leads 9–7');
  assert.equal(S.h2hLine('Sam', { wins: 3, losses: 3 }), 'You and Sam: 3–3');
  assert.equal(S.h2hLine('Sam', null), '');
});
test('a shut-out (CL-40): Rematch leads, an encouraging line, and in the first matches the computer goes back to Easy', async () => {
  const { shutOut } = await import('../../src/ui/screens/win.js');
  state.squares.forEach(q => { q.owner = null; });
  for (const i of [0, 4, 8]) state.squares[i].owner = 'O';
  end('O', 'X', 15); state.setup.vsCpu = { pick: 'random', level: 'hard' }; state.series = S.freshSeries();
  assert.ok(shutOut());
  const html = renderWin();
  assert.match(html, /Tough one!/);
  assert.match(html, /data-act="rematch"/);
  assert.equal(state.setup.vsCpu.level, 'easy');
  state.squares[1].owner = 'X';
  assert.ok(!shutOut(), 'a square of their own: no shut-out');
  state.squares.forEach(q => { q.owner = null; });
});
