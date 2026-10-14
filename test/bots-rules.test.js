'use strict';
// The matchmaking bots' make-up (functions/bots.js) and the computer player's style knobs (engine.js),
// and the empty-queue alert's rules. Plain `node --test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const B = require('../functions/bots.js');
const R = require('../functions/serverRules.js');

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const ttt = cells => ({ type: 'ttt', cells, last: null });

test('the five bots: each its own style and pace, tunable in one place; usernames made up like anyone\'s, none written in the (public) code', () => {
  assert.equal(B.BOTS.length, 5);
  for (const b of B.BOTS) {
    assert.equal(b.username, undefined, `${b.key}: no username in the code`);
    assert.ok(B.PACES[b.pace], `${b.key}: a known pace`);
    assert.ok(b.about && b.style && ['attack', 'defend', 'mistake', 'rollRisk'].every(k => typeof b.style[k] === 'number'));
  }
  assert.equal(new Set(B.BOTS.map(b => JSON.stringify(b.style))).size, 5, 'five different styles');
  assert.equal(new Set(B.BOTS.map(b => b.pace)).size, 5, 'five different paces');
  const rng = lcg(11), int = n => Math.floor(rng() * n);
  const names = Array.from({ length: 3000 }, () => B.randomName(int));
  const ok = names.filter(n => R.usernameProblem(n) === null);
  assert.ok(ok.length > 2900, `nearly all within the username rules (${ok.length}): the rest are skipped`);
  assert.ok(names.every(n => !/bot|cpu|computer|\bai\b/i.test(n)), 'nothing gives them away');
  assert.ok(new Set(names.map(n => n.toLowerCase())).size > 1500, 'plenty of different names');
  assert.ok(names.some(n => /\d/.test(n)) && names.some(n => /_/.test(n)) && names.some(n => /^[A-Z]/.test(n)) && names.some(n => !/[\d_]/.test(n)), 'the usual variety: digits, underscores, capitals, plain');
});

test('bot pacing: ordinary moves 1.5 to 5 s, each bot in its own window; word games 3 to 8 s; follow-ups 1 to 2.5 s; never past 8 s', () => {
  const rng = lcg(5), mean = a => a.reduce((s, x) => s + x, 0) / a.length;
  for (const b of B.BOTS) {
    const xs = Array.from({ length: 3000 }, () => B.thinkMs(b, 'turn', rng, 'ttt'));
    assert.ok(xs.every(x => x >= 1500 && x <= 5000), `${b.pace}: an ordinary move 1.5 to 5 s`);
    assert.ok(new Set(xs.map(x => Math.round(x / 100))).size > 15, `${b.pace}: varied, not a fixed delay`);
    for (const type of ['wordle', 'hangman', 'mastermind']) {
      const ws = Array.from({ length: 1500 }, () => B.thinkMs(b, 'turn', rng, type));
      assert.ok(ws.every(x => x >= 3000 && x <= 8000), `${b.pace}: ${type} 3 to 8 s`);
    }
    const again = Array.from({ length: 1500 }, () => B.thinkMs(b, 'again', rng, 'risky'));
    assert.ok(again.every(x => x >= 1000 && x <= 2500), `${b.pace}: a follow-up in the same turn 1 to 2.5 s`);
    assert.ok(mean(again) < mean(xs), `${b.pace}: a follow-up comes quicker than a move`);
  }
  const slow = B.byKey('b4'), quick = B.byKey('b1');
  const avg = bot => { const r = lcg(9); let s = 0; for (let k = 0; k < 4000; k++) s += B.thinkMs(bot, 'turn', r, 'ttt'); return s / 4000; };
  assert.ok(avg(slow) > avg(quick), 'the slow, careful one takes longer than the quick one');
  assert.equal(B.MAX_THINK_MS, 8000, 'never past 8 s');
  const second = Array.from({ length: 500 }, () => B.thinkMs(quick, 'second', rng, 'memory'));
  assert.ok(second.every(x => x >= 1000 && x <= 2600), 'Memory\'s second card a moment after the first');
});

test('bot wait and settings: the wait drawn inside the window; settings clamped to sane values; both off by default', () => {
  const cfg = B.botConfig({});
  assert.deepEqual(cfg, { enabled: false, waitMin: 40, waitMax: 70, countInRecords: true });
  const rng = lcg(3), ws = Array.from({ length: 1000 }, () => B.waitMs(cfg, rng));
  assert.ok(ws.every(w => w >= 40000 && w <= 70000));
  assert.ok(Math.max(...ws) - Math.min(...ws) > 25000, 'spread over the window');
  assert.deepEqual(B.botConfig({ bots: { enabled: true, waitMin: 2, waitMax: 9999, countInRecords: false } }), { enabled: true, waitMin: 5, waitMax: 600, countInRecords: false });
  assert.equal(B.botConfig({ bots: { waitMin: 90, waitMax: 30 } }).waitMax, 90, 'the top of the window never below the bottom');
  const a = B.alertConfig({});
  assert.equal(a.enabled, false); assert.equal(a.after, 5); assert.equal(a.cooldownMin, 30); assert.equal(a.gapMin, 3); assert.equal(a.dailyCap, 20);
  assert.equal(B.alertConfig({ alerts: { site: 'http://evil.example' } }).site, B.DEFAULTS.alerts.site, 'only an https link');
});

test('phone numbers for Twilio: a 10-digit US number gets +1; international ones are kept; anything else refused', () => {
  assert.equal(B.e164('212-555-0142'), '+12125550142');
  assert.equal(B.e164('(212) 555 0142'), '+12125550142');
  assert.equal(B.e164('1 212 555 0142'), '+12125550142');
  assert.equal(B.e164('+44 7700 900123'), '+447700900123');
  for (const bad of ['', '12345', 'call me', '+0123']) assert.equal(B.e164(bad), null, bad);
});

test('the alert limits: one per player per cooldown, a gap between alerts, a daily cap; players past their cooldown forgotten', () => {
  const cfg = B.alertConfig({ alerts: { cooldownMin: 30, gapMin: 3, dailyCap: 3 } }), t0 = Date.UTC(2026, 9, 13, 12);
  let st = null;
  const go = (uid, t) => { const d = B.alertAllowed(st, uid, t, cfg); if (d.ok) st = d.next; return d.ok ? 'sent' : d.why; };
  assert.equal(go('a', t0), 'sent');
  assert.equal(go('a', t0 + 60000), 'player cooldown', 're-queueing a minute later');
  assert.equal(go('b', t0 + 60000), 'too soon after the last alert');
  assert.equal(go('b', t0 + 4 * 60000), 'sent');
  assert.equal(go('a', t0 + 20 * 60000), 'player cooldown', 'still within 30 minutes');
  assert.equal(go('a', t0 + 31 * 60000), 'sent', 'after the cooldown');
  assert.equal(go('c', t0 + 40 * 60000), 'daily cap', 'three today already');
  assert.equal(go('c', t0 + 13 * 3600000), 'sent', 'a new day (UTC)');
  assert.deepEqual(Object.keys(st.by), ['c'], 'players past their cooldown are forgotten');
});

test('the computer\'s style knobs: the standard computer unchanged; careless moves stay legal; Risky Rolls risk', () => {
  for (let k = 0; k < 20; k++) {                              // the standard style is the computer as it plays everywhere else
    const a = E.newMatch(lcg(k)), b = JSON.parse(JSON.stringify(a));
    assert.deepEqual(E.cpuMove(a, lcg(100 + k)), E.cpuMove(b, lcg(100 + k), E.STYLE0));
  }
  const st = E.newMatch(lcg(2));                              // a careless move: anything legal, in any open square
  for (let k = 0; k < 40; k++) {
    const m = E.cpuMove(st, lcg(200 + k), { mistake: 1 });
    assert.equal(m.careless, true);
    assert.equal(E.playMove(JSON.parse(JSON.stringify(st)), m.square, m.move, lcg(k)).ok, true, 'a legal move');
  }
  assert.ok(!E.cpuMove(st, lcg(7), { mistake: 0 }).careless);
  // Risky Rolls with 10 at risk and level scores: the standard computer banks, a bolder style rolls on; at 7 a warier one banks
  const pig = pot => ({ type: 'pig', bank: { X: 0, O: 0 }, turn: { by: 'X', rolls: [4, 6], pot } });
  assert.equal(E.localBest(pig(10), 'X', lcg(1)).move, 'bank');
  assert.equal(E.localBest(pig(10), 'X', lcg(1), { rollRisk: 4 }).move, 'roll');
  assert.equal(E.localBest(pig(7), 'X', lcg(1)).move, 'roll');
  assert.equal(E.localBest(pig(7), 'X', lcg(1), { rollRisk: -3 }).move, 'bank');
});

test('the computer\'s style knobs: a win always first; the defensive bot weighs the other side\'s lines more, the aggressive one its own', () => {
  const board = owners => owners.map(o => ({ owner: o, mini: ttt(Array(9).fill(null)) }));
  const st = E.newMatch(lcg(3));
  st.squares = board(['O', 'O', null, null, null, null, 'X', null, 'X']);   // O threatens the top row at 2, X the bottom row at 7
  st.turn = 'X';
  for (const b of B.BOTS.filter(x => !x.style.mistake)) assert.equal(E.cpuMove(st, lcg(5), b.style).square, 7, `${b.key} takes the win`);
  // X holds 6, O holds 2: square 3 builds X's left column, square 5 blocks O's right column
  const sq = board([null, null, 'O', null, null, null, 'X', null, null]);
  const v = (style, i) => E.squareValue(sq, i, 'X', Object.assign({}, E.STYLE0, style));
  const atk = B.byKey('b1').style, def = B.byKey('b2').style;
  assert.ok(v(atk, 3) > v(atk, 5), 'the aggressive bot builds its own line');
  assert.ok(v(def, 5) > v(def, 3), 'the defensive bot gets in the other side\'s way');
  assert.equal(E.squareValue(sq, 4, 'X'), v({}, 4), 'no style: the standard weights');
});
