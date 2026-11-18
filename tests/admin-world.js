'use strict';
// A small world for the admin dashboard's tests (tests/core/admin-metrics.test.js, tests/ui/admin-pages.test.mjs): the rows
// as the server writes them (functions/statsRules.js factStart, factEnd, factFind) and the device events, a few days of play.
const S0 = require('../functions/statsRules.js');

const NOW = Date.parse('2026-11-18T17:00:00Z');           // noon in New York
const day = k => NOW - k * 86400000;
const H = c => c.repeat(20);
const sq = (t, w, X_, O_, o) => Object.assign({ t, end: w ? 'won' : 'draw', w, X: X_, O: O_ }, o || {});
function world() {
  const sum = (squares, winner, reason) => S0.checkEnd({ squares, winner, reason }, ['ttt', 'c4', 'pig']);
  const fact = (mode, t0, who, o, end) => Object.assign(S0.factStart(mode, t0, who, o), end ? S0.factEnd(end.sum, end.ms, t0 + end.ms) : {});
  const matches = {}, put = (id, r) => { const d = S0.periodKeys(r.t0).d; (matches[d] = matches[d] || {})[id] = r; };
  // a guest on the web (device a): two cpu matches today, one finished, one left 5 hours ago
  put('l_a1', fact('cpu', day(0) - 3600000, [{ h: H('a'), pl: 'web', cv: '1.22.0' }], { timer: 'none' }, { ms: 300000, sum: sum([sq('ttt', 'X', 3, 2, { f: 'X', ms: 20000, v: 2 }), sq('c4', 'O', 5, 6, { f: 'X', ms: 90000 }), sq('pig', null, 2, 2)], 'X', 'line') }));
  put('l_a2', fact('cpu', day(0) - 5 * 3600000, [{ h: H('a'), pl: 'web' }], { timer: 'none' }));
  // an account on iOS (device b, uid u1) against a web guest (device c) in a friend room yesterday: resigned
  put('g1', fact('friend', day(1), [{ s: 'X', u: 'u1', h: H('b'), pl: 'ios', cv: '1.22.0' }, { s: 'O', u: 'anon9', h: H('c'), pl: 'web' }], { timer: 'm5+5', room: 'ABCDE' }, { ms: 120000, sum: sum([sq('ttt', 'O', 2, 3, { f: 'O' })], 'O', 'resign') }));
  // Find Match, u1 against the computer, 3 days ago: finished, the clock ran out
  put('g2', fact('bot', day(3), [{ s: 'X', u: 'u1', h: H('b'), pl: 'ios' }, { s: 'O', u: 'bot1', bot: true }], { timer: 'm5+5' }, { ms: 600000, sum: sum([sq('ttt', 'X', 3, 1, { f: 'X', ms: 30000 })], 'O', 'clock') }));
  // the owner's device (d): a finished cpu match today, marked by the server
  put('l_d1', fact('cpu', day(0) - 7200000, [{ h: H('d'), pl: 'web' }], { own: true }, { ms: 200000, sum: sum([sq('ttt', 'X', 4, 3, { f: 'O', ms: 50000, v: 2 })], 'X', 'line') }));
  const ev = (t, e, o) => Object.assign({ t, ev: e }, o || {});
  const logs = {
    [H('a')]: { o1: ev(day(8), 'open', { p: 'web', b: 'b1' }), f1: ev(day(8) + 1000, 'step', { step: 'tap' }), o2: ev(day(7), 'open', { p: 'web', b: 'b1' }), o3: ev(day(1), 'open', { p: 'web', b: 'b2' }), o4: ev(day(0) - 3700000, 'open', { p: 'web', b: 'b2' }),
      s1: ev(day(0) - 3600000, 'start', { m: 'cpu', g: 'la1' }), e1: ev(day(0) - 3300000, 'finish', { m: 'cpu', g: 'la1' }), x1: ev(day(0) - 3200000, 'error', { msg: 'js: boom', b: 'b2' }), q1: ev(day(0) - 3100000, 'act', { act: 'share' }) },
    [H('b')]: { o1: ev(day(3), 'open', { p: 'ios', cv: '1.22.0', b: 'b2' }), o2: ev(day(1), 'open', { p: 'ios', cv: '1.22.0', b: 'b2' }), q1: ev(day(1), 'act', { act: 'invite', ch: 'copy' }) },
    [H('c')]: { o1: ev(day(1), 'open', { p: 'web', b: 'b2' }), q1: ev(day(1) + 5, 'act', { act: 'invite-join' }) },
    [H('d')]: { o1: ev(day(0) - 7300000, 'open', { p: 'web', b: 'b2' }), x1: ev(day(0) - 7250000, 'error', { msg: 'js: mine', b: 'b2' }) },
  };
  const devices = { [H('a')]: { first: day(8), last: day(0), p: 'web', tag: 'reddit' }, [H('b')]: { first: day(3), last: day(1), p: 'ios', cv: '1.22.0', u: { u1: day(1) } }, [H('c')]: { first: day(1), last: day(1), p: 'web' }, [H('d')]: { first: day(0), last: day(0), p: 'web', u: { boss: day(0) } } };
  const users = { u1: { username: 'sam', joined: day(3), src: 'tiktok', wins: 1, losses: 1, draws: 0 }, boss: { username: 'jarhad', joined: day(200) }, bot1: { username: 'robo' } };
  const finds = { [S0.periodKeys(day(3)).d]: { f1: S0.factFind('bot', 21000, day(3), 'u1', false), f2: S0.factFind('cancel', 8000, day(3), 'u1', false), f3: S0.factFind('people', 4000, day(3), 'boss', true) } };
  const reports = { r1: { at: day(0), h: H('a'), note: 'stuck', where: 'board', p: 'web' }, r2: { at: day(0), h: H('d'), note: 'mine', where: 'menu', p: 'web' } };
  return { matches, finds, devices, logs, users, bots: { bot1: {} }, meta: { dddddddd: { ex: true, nick: 'Mine' } }, reports, seen: { u1: day(1) }, logIndex: { mg1: { n: 12, reported: day(1), note: 'froze' } } };
}
module.exports = { NOW, day, H, world };
