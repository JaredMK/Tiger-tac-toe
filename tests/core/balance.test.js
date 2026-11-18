'use strict';
// Balance tooling (December 2026): settings versions on squares and matches, the time and first mover of a square, the
// squares on a match's row (functions/statsRules.js factEnd) and a game's numbers by version from them (src/admin/metrics.js
// gameStats); a game's version card (src/admin/balance.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const S = require('../../functions/statsRules.js');

let B, X;
test.before(async () => { B = await import('../../src/admin/balance.js'); X = await import('../../src/admin/metrics.js'); });

const tttWin = () => {   // a match whose square 0 is tic-tac-toe, X to win it in three moves
  const st = E.newMatch(E.makeRng(7), { games: ['ttt'], vs: 'cpu' });
  st.turn = 'X'; st.cpu = null;
  return st;
};
const play = (st, i, m, at) => { const r = E.playMove(st, i, m, E.makeRng(1), { at }); assert.ok(r.ok, JSON.stringify(r)); E.endFlash(st); E.leaveSquare && E.leaveSquare(st); return r; };

test('settings versions: a square is dealt under its game\'s version and keeps it; none set is version 1', () => {
  E.setTuneVersions({ ttt: 3 });
  const a = E.newMini('ttt', E.makeRng(2)), b = E.newMini('c4', E.makeRng(2));
  assert.equal(a.sv, 3); assert.equal(E.miniVersion(a), 3);
  assert.equal(b.sv, undefined, 'version 1: nothing stamped'); assert.equal(E.miniVersion(b), 1);
  E.setTuneVersions(null);
  assert.equal(E.tuneVersion('ttt'), 1);
  assert.equal(E.miniVersion(a), 3, 'the square keeps the version it was dealt under');
});

test('a finished square records its version, its first mover and the time spent in it', () => {
  E.setTuneVersions({ ttt: 2 });
  const st = tttWin();
  E.setTuneVersions(null);
  const t0 = 1_000_000;
  // X plays square 0 at t0, O plays square 0, X ... (time from the move before, anywhere on the board)
  const order = [[0, 0, 'X'], [0, 3, 'O'], [0, 1, 'X'], [0, 4, 'O'], [0, 2, 'X']];
  let at = t0;
  for (const [i, m] of order) { at += 5000; play(st, i, m, at); }
  const e = st.sqlog.find(x => x.t === 'ttt' && x.end === 'won');
  assert.ok(e, 'the square won');
  assert.equal(e.v, 2); assert.equal(e.f, 'X'); assert.equal(e.w, 'X');
  assert.equal(e.ms, 4 * 5000, 'four gaps of 5 s after the first move (no move before the first)');
  const m = E.matchStats(st);
  assert.deepEqual(m.squares.find(x => x.end === 'won'), { t: 'ttt', end: 'won', w: 'X', X: 3, O: 2, v: 2, f: 'X', ms: 20000 });
  assert.equal(m.sv.ttt, 2, 'the match carries every game\'s version on its board');
});

test('a gap longer than two minutes counts as two minutes; a reset square starts over', () => {
  const st = tttWin();
  play(st, 0, 0, 1000); play(st, 0, 3, 1000 + 10 * 60000);
  assert.equal(st.squares[0].ms, E.SQ_GAP_MS);
  assert.equal(st.lastAt, 1000 + 10 * 60000, 'kept on the match (and its online record)');
  const back = E.fullState(E.matchRecord(Object.assign(st, { id: 'm', seq: 0, recent: [] })));
  assert.equal(back.lastAt, st.lastAt); assert.equal(back.squares[0].ms, E.SQ_GAP_MS); assert.equal(back.squares[0].f, 'X');
});

test('tuneChanges: what a save changed, old and new as the game would deal them', () => {
  const ch = E.tuneChanges('pig', {}, { target: 40 });
  const f = E.tuneFields('pig').find(x => x.k === 'target');
  if (f) assert.deepEqual(ch.target, { from: f.def, to: 40 });
  assert.deepEqual(E.tuneChanges('pig', { target: 40 }, { target: 40 }), {});
});

test('server: a finished match\'s row keeps every square with its version, first mover and time; the numbers by version come from the rows', () => {
  const t = Date.parse('2026-11-17T15:00:00Z');
  const sum = S.checkEnd({ squares: [
    { t: 'ttt', end: 'won', w: 'X', X: 3, O: 2, v: 2, f: 'X', ms: 20000 },
    { t: 'c4', end: 'won', w: 'O', X: 5, O: 5, f: 'X', ms: 95000 },
    { t: 'pig', end: 'draw', X: 1, O: 1 },
    { t: 'hilo', end: 'open', X: 2, O: 1 },
  ], winner: 'X', reason: 'line' }, E.TYPES);
  assert.equal(sum.squares[1].v, 1, 'no version: 1');
  const sq = JSON.parse(S.factEnd(sum, 7 * 60000, t).sq);
  assert.deepEqual(sq[0], { t: 'ttt', v: 2, end: 'won', w: 'X', X: 3, O: 2, f: 'X', ms: 20000 });
  assert.deepEqual(sq[1], { t: 'c4', end: 'won', w: 'O', X: 5, O: 5, f: 'X', ms: 95000 }, 'version 1 is not written');
  assert.deepEqual(sq.slice(2).map(e => e.end), ['draw', 'open']);
});

test('a game\'s numbers (the admin\'s metrics layer): percentiles of the winner\'s moves, the flags, first mover, by settings version, my matches left out', () => {
  const t = Date.now() - 3600000, h = 'ab'.repeat(10), matches = { d: {} };
  const add = (id, list, o) => { matches.d[id] = Object.assign(S.factStart('cpu', t, [{ h, pl: 'web' }], o), S.factEnd({ winner: 'X', reason: (o && o.reason) || 'line', squares: list }, 60000, t + 60000)); };
  const won = (moves, v, f, ms) => ({ t: 'ttt', end: 'won', w: 'X', X: moves, O: moves - 1, v, f, ms });
  add('a', [won(4, 1, 'X', 10000), won(5, 1, 'O', 20000), won(4, 1, 'X'), { t: 'ttt', end: 'open', X: 1, O: 0, v: 1 }]);
  add('b', [won(6, 2, 'X', 30000), won(8, 2, 'O', 45000), won(7, 2, 'O', 60000), { t: 'ttt', end: 'draw', X: 2, O: 2, v: 2 }]);
  add('mine', Array.from({ length: 40 }, () => won(2, 2, 'X', 5000)), { own: true });
  add('quit', [won(9, 2, 'X', 1000)], { reason: 'resign' });
  const M = X.build({ matches, devices: { [h]: { first: t, last: t, p: 'web' } }, logs: {}, users: {} }, Date.now());
  const g = X.gameStats(X.scope(M, { range: '7', version: 'current' }), 'ttt', { ttt: 2 });
  assert.deepEqual([g.version, g.current, g.n], [2, 2, 3], 'the current version; mine and the abandoned match\'s squares left out');
  assert.deepEqual([g.moves.p25, g.moves.med, g.moves.p75], [6, 7, 8]); assert.deepEqual([g.secs.med], [45]);
  assert.ok(g.flags.includes('slow') && g.flags.includes('small'), 'a median above 6 moves; under 30 squares');
  assert.equal(g.firstMover, 1 / 3); assert.equal(g.draw, 1); assert.equal(g.resetRate, 1 / 4);
  assert.deepEqual(g.byVersion.map(r => [r.v, r.n, r.moves.med]), [[2, 3, 7], [1, 3, 4]], 'each version side by side');
  assert.equal(X.gameStats(X.scope(M, { range: '7', version: 'previous' }), 'ttt', { ttt: 2 }).n, 3);
  assert.equal(X.gameStats(X.scope(M, { range: '7', version: 'all' }), 'ttt', { ttt: 2 }).n, 6);
  assert.equal(X.gameStats(X.scope(M, { range: '7', version: 'current', mine: true }), 'ttt', { ttt: 2 }).n, 43, 'with my devices');
  assert.equal(X.quant([3, 5, 5, 9], 0.5), 5); assert.equal(X.quant([3, 5, 5, 9], 0.25), 3); assert.equal(X.quant([], 0.5), null);
});

test('a game\'s version card: its log, newest first', () => {
  const html = B.versionCard('pig', { pig: 3 }, { pig: { v2: { at: Date.parse('2026-11-01'), by: 'a@b', ch: { target: { from: 50, to: 40 } } }, v3: { at: Date.parse('2026-11-10'), ch: {}, note: 'Reset to defaults' } } }, k => (k === 'target' ? 'Target' : k));
  assert.match(html, /Settings version 3/);
  assert.ok(html.indexOf('v3') < html.indexOf('v2'));
  assert.match(html, /Target: 50 → 40/); assert.match(html, /Reset to defaults/);
});
