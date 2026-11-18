'use strict';
// Balance tooling (December 2026): settings versions on squares and matches, the time and first mover of a square, the
// server's balance counters (functions/statsRules.js balanceUpdates) and the Balance report's sums and percentiles
// (src/admin/balance.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const S = require('../../functions/statsRules.js');

let B;
test.before(async () => { B = await import('../../src/admin/balance.js'); });

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

test('server: a finished match files every square under its version, day and admin segment; the match length too', () => {
  const t = Date.parse('2026-11-17T15:00:00Z');
  const sum = S.checkEnd({ squares: [
    { t: 'ttt', end: 'won', w: 'X', X: 3, O: 2, v: 2, f: 'X', ms: 20000 },
    { t: 'c4', end: 'won', w: 'O', X: 5, O: 5, f: 'X', ms: 95000 },
    { t: 'pig', end: 'draw', X: 1, O: 1 },
    { t: 'hilo', end: 'open', X: 2, O: 1 },
  ], winner: 'X', reason: 'line' }, E.TYPES);
  assert.equal(sum.squares[1].v, 1, 'no version: 1');
  const up = S.balanceUpdates('cpu', sum, 7 * 60000, t, { admin: false, timer: 'none' });
  const d = '2026-11-17';
  assert.equal(up[`bal/sq/ttt/v2/${d}/p/n`], 1); assert.equal(up[`bal/sq/ttt/v2/${d}/p/won`], 1);
  assert.equal(up[`bal/sq/ttt/v2/${d}/p/wm/m3`], 1); assert.equal(up[`bal/sq/ttt/v2/${d}/p/fd`], 1); assert.equal(up[`bal/sq/ttt/v2/${d}/p/fm`], 1);
  assert.equal(up[`bal/sq/ttt/v2/${d}/p/t/s20`], 1); assert.equal(up[`bal/sq/ttt/v2/${d}/p/tsum`], 20);
  assert.equal(up[`bal/sq/c4/v1/${d}/p/fm`], undefined, 'O won, X moved first'); assert.equal(up[`bal/sq/c4/v1/${d}/p/t/s120`], 1);
  assert.equal(up[`bal/sq/pig/v1/${d}/p/draw`], 1); assert.equal(up[`bal/sq/hilo/v1/${d}/p/open`], 1);
  assert.equal(up[`bal/ml/${d}/p/cpu/none/fin/n`], 1); assert.equal(up[`bal/ml/${d}/p/cpu/none/fin/turns/t20`], 1); assert.equal(up[`bal/ml/${d}/p/cpu/none/fin/mi/m7`], 1);
  const adm = S.balanceUpdates('match', sum, null, t, { admin: true, timer: 'm5+5' });
  assert.equal(adm[`bal/ml/${d}/a/match/m5+5/fin/n`], 1, 'an admin\'s match apart'); assert.equal(adm[`bal/ml/${d}/a/match/m5+5/fin/mn`], undefined, 'no time: no minutes');
  const ab = S.balanceUpdates('friend', Object.assign({}, sum, { reason: 'resign' }), 60000, t, { timer: 't30' });
  assert.equal(ab[`bal/ml/${d}/p/friend/t30/ab/n`], 1);
  assert.ok(!Object.keys(ab).some(k => k.startsWith('bal/sq/')), 'an abandoned match\'s squares are not counted');
  assert.deepEqual(S.balanceUpdates('chaos', sum, 1, t, {}), {}, 'Super Chaos left out');
  for (const k of Object.keys(up)) assert.ok(!/\/\d+(\/|$)/.test(k.replace(/^bal\/(sq|ml)\/[^/]+\/v\d+\/\d{4}-\d\d-\d\d/, '').replace(/\d{4}-\d\d-\d\d/, '')) || /m5\+5/.test(k), 'no bare number keys (the database would make arrays): ' + k);
});

test('report: quantiles from the histograms, the filters, the flags and the version comparison', () => {
  assert.equal(B.quantile({ m3: 1, m5: 2, m9: 1 }, 0.5, true), 5);
  assert.equal(B.quantile({ m3: 1, m5: 2, m9: 1 }, 0.25, true), 3);
  assert.equal(B.quantile({ m3: 1, m5: 2, m9: 1 }, 0.75, true), 5);
  assert.equal(B.quantile({}, 0.5, true), null);
  assert.equal(B.quantile({ s20: 2 }, 0.5, false, B.SQ_SECS), 17.5, 'placed linearly inside the 15-20 s bucket');
  const day = c => ({ p: c, a: { n: 50, won: 50, wm: { m2: 50 } } });
  const stats = { bal: { sq: { ttt: {
    v1: { '2026-11-10': day({ n: 10, won: 8, open: 2, wm: { m4: 4, m5: 4 }, fd: 8, fm: 5 }) },
    v2: { '2026-11-16': day({ n: 20, won: 18, draw: 1, open: 1, wm: { m6: 9, m8: 9 }, fd: 18, fm: 9, tn: 2, tsum: 70, t: { s30: 1, s45: 1 } }), '2026-11-17': day({ n: 5, won: 5, wm: { m7: 5 } }) },
  } }, ml: { '2026-11-17': { p: { cpu: { none: { fin: { n: 4, tsum: 120, turns: { t30: 3, t40: 1 }, mn: 4, msum: 2400, mi: { m10: 3, m12: 1 } } } } } } } }, mini: { cpu: { ttt: { played: 100, won: 80, winMoves: 360, open: 10 } } } };
  const rep = B.balanceReport(stats, { versions: { ttt: 2 }, types: ['ttt'], names: { ttt: 'Tic-tac-toe' } });
  const g = rep.games[0];
  assert.equal(g.version, 2); assert.equal(g.n, 25, 'the current version, players only');
  assert.equal(g.moves.med, 7); assert.ok(g.flags.includes('slow')); assert.ok(g.flags.includes('small'));
  assert.equal(g.firstMover, 0.5);
  const withAdmin = B.balanceReport(stats, { versions: { ttt: 2 }, types: ['ttt'] }, { admin: true });
  assert.equal(withAdmin.games[0].n, 125, 'an admin\'s matches only when asked');
  const dated = B.balanceReport(stats, { versions: { ttt: 2 }, types: ['ttt'] }, { from: '2026-11-17', to: '2026-11-17' });
  assert.equal(dated.games[0].n, 5, 'the date range');
  assert.equal(B.balanceReport(stats, { versions: { ttt: 2 }, types: ['ttt'] }, { version: 'all' }).games[0].n, 35);
  const c = g.compare;
  assert.equal(c.cur, 2); assert.equal(c.prev, 1); assert.equal(c.before.n, 10); assert.equal(c.before.moves.med, 4);
  assert.equal(c.legacy.n, 100, 'version 1\'s older totals'); assert.equal(c.legacy.movesMean, 4.5);
  const fin = rep.matches.find(m => m.mode === 'cpu' && m.timer === 'none' && m.end === 'fin');
  assert.equal(fin.n, 4); assert.ok(fin.turns.med > 25 && fin.turns.med <= 30); assert.equal(fin.mins.mean, 10);
  assert.ok(rep.matches.some(m => m.mode === 'vs Computer' && m.timer === 'group'), 'grouped by mode');
  const html = B.balanceHtml(rep);
  assert.match(html, /data-balexport="1">Export JSON</); assert.match(html, /Leave out my devices and matches an admin played in/); assert.match(html, /bflag slow/);
  assert.ok(JSON.parse(JSON.stringify(rep)), 'the export is plain JSON');
});

test('a game\'s version card: its log, newest first', () => {
  const html = B.versionCard('pig', { pig: 3 }, { pig: { v2: { at: Date.parse('2026-11-01'), by: 'a@b', ch: { target: { from: 50, to: 40 } } }, v3: { at: Date.parse('2026-11-10'), ch: {}, note: 'Reset to defaults' } } }, k => (k === 'target' ? 'Target' : k));
  assert.match(html, /Settings version 3/);
  assert.ok(html.indexOf('v3') < html.indexOf('v2'));
  assert.match(html, /Target: 50 → 40/); assert.match(html, /Reset to defaults/);
});
