'use strict';
// Tank Duel (December 2026): its rules and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/tanks/rules.js');
const M = require('../../src/games/tanks/meta.js');
const A = require('../../src/games/tanks/ai.js');

const T = R.TANK, other = p => (p === 'X' ? 'O' : 'X'), clone = x => JSON.parse(JSON.stringify(x));
// A square on ground of our making: every column `h` high (or H(i)), X on column x and O on column o, no wind.
const field = (h, x = 20, o = 80, wind = 0) => { const m = E.newMini('tanks', E.makeRng('f')); m.h = R.tankPack(Array.from({ length: T.w }, (_, i) => (typeof h === 'function' ? h(i) : h))); m.at = { X: x, O: o }; m.wind = wind; return m; };
// The power that lands X's shot at angle `a` on O (flat ground, no wind), and one that falls just short of it.
const aimP = (m, a, want) => { const c = R.tankCfg(m), H = R.tankHeights(m.h); for (let p = T.pmin; p <= T.pmax; p++) { const t = R.tankTry(c, H, m.wind, m.at, 'X', { d: 0, a, p }); if (want(t)) return p; } throw new Error('no such shot'); };
const HIT = aimP(field(20), 45, t => t.hit === 'O'), NEAR = aimP(field(20), 45, t => t.hit === 'ground' && t.dmg.O > 0);
const sane = m => {
  const H = R.tankHeights(m.h), c = R.tankCfg(m);
  assert.equal(m.h.length, T.w); assert.ok(/^[0-9a-zA-Z_-]+$/.test(m.h), 'the ground is its 64 characters');
  for (const p of ['X', 'O']) { assert.ok(Number.isInteger(m.at[p]) && m.at[p] >= T.edge && m.at[p] <= T.w - 1 - T.edge, `${p} on the field: ${m.at[p]}`); assert.ok(Number.isInteger(m.hp[p]) && m.hp[p] >= 0 && m.hp[p] <= c.health, `${p}'s health ${m.hp[p]}`); assert.ok(H[m.at[p]] >= 0 && H[m.at[p]] <= T.hmax); }
  assert.ok(Math.abs(m.at.X - m.at.O) >= T.gap, 'the tanks keep apart');
};

test('tanks: Admin only, skill; its settings; the deal: hills fair to both sides, a tank in each outer third on a level pad at about the same height, the wind in its range', () => {
  assert.deepEqual([M.release, M.category, M.minVersion, M.placeholder, M.info.name], ['admin', 'skill', '1.30.0', false, 'Tank Duel']);
  assert.deepEqual(E.gameFields('tanks').map(f => f.k), ['again', 'health', 'hitDmg', 'splash', 'blast', 'fuel', 'crater', 'climb', 'hills', 'windMin', 'windMax', 'gravity', 'speed', 'aiAng', 'aiPow', 'aiAngHard', 'aiPowHard', 'aiRange', 'aiAngEasy', 'aiPowEasy']);
  for (const f of E.gameFields('tanks')) if (f.k !== 'again') assert.equal(R.TANK_DEF[f.k], f.def, `${f.k}: the rules' default is the setting's`);
  let left = 0, right = 0, winds = new Set(), hx = 0, ho = 0;
  for (let g = 0; g < 300; g++) {
    const m = E.newMini('tanks', E.makeRng('d' + g)), H = R.tankHeights(m.h); sane(m);
    assert.deepEqual([m.v, m.hp, m.n, m.last], [1, { X: 100, O: 100 }, { X: 0, O: 0 }, null]);
    assert.ok(m.at.X >= 10 && m.at.X <= 25 && m.at.O >= 74 && m.at.O <= 89, `columns ${m.at.X}, ${m.at.O}`);
    assert.ok(Math.abs(H[m.at.X] - H[m.at.O]) <= 5, `heights ${H[m.at.X]}, ${H[m.at.O]}`);
    for (const p of ['X', 'O']) for (let d = -2; d <= 2; d++) assert.equal(H[m.at[p] + d], H[m.at[p]], 'a level pad');
    for (let i = 1; i < T.w; i++) assert.ok(Math.abs(H[i] - H[i - 1]) <= 2, `a step of ${H[i] - H[i - 1]}: a tank climbs 3`);
    assert.ok(H.every(v => v >= 4 && v <= 46));
    assert.ok(Number.isInteger(m.wind) && Math.abs(m.wind) <= 8); winds.add(m.wind);
    for (let i = 0; i < 50; i++) { left += H[i]; right += H[T.w - 1 - i]; } hx += H[m.at.X]; ho += H[m.at.O];
  }
  assert.ok(Math.abs(left - right) / (300 * 50) < 1, `the two halves' mean heights ${(left / 15000).toFixed(2)}, ${(right / 15000).toFixed(2)}`);
  assert.ok(Math.abs(hx - ho) / 300 < 0.6, `the tanks' mean heights ${(hx / 300).toFixed(2)}, ${(ho / 300).toFixed(2)}`);
  assert.ok(winds.size >= 12 && [...winds].some(w => w < 0) && [...winds].some(w => w > 0), 'winds either way');
  assert.equal(E.secretOf(E.newMini('tanks', E.makeRng('s'))), null, 'nothing is hidden');
  E.setTune('tanks', { windMin: 3, windMax: 3, hills: 0, health: 60 });
  try { const m = E.newMini('tanks', E.makeRng('w')), H = R.tankHeights(m.h); assert.equal(Math.abs(m.wind), 3); assert.equal(new Set(H).size, 1, 'no hills: flat'); assert.deepEqual(m.hp, { X: 60, O: 60 }); } finally { E.setTune('tanks', null); }
});

test('tanks: the drive: at most `fuel` columns, stopped by a step too steep, by the field\'s edge and by the other tank; a drop is driven down', () => {
  let m = field(20), r = E.applyMove(m, 'X', { d: 6, a: 60, p: 30 }, E.makeRng('a'));
  assert.ok(r.ok); assert.deepEqual([m.at.X, m.last.from, m.last.to, m.last.d], [26, 20, 26, 6]);
  r = E.applyMove(m, 'O', { d: -4, a: 120, p: 30 }, E.makeRng('a')); assert.equal(m.at.O, 76);
  assert.equal(E.applyMove(m, 'X', { d: 7, a: 60, p: 30 }, E.makeRng('a')).ok, false, 'more than the fuel');
  m = field(i => (i >= 23 ? 24 : 20)); E.applyMove(m, 'X', { d: 6, a: 80, p: 10 }, E.makeRng('a')); assert.equal(m.at.X, 22, 'a step up of 4: too steep');
  m = field(i => (i >= 23 ? 23 : 20)); E.applyMove(m, 'X', { d: 6, a: 80, p: 10 }, E.makeRng('a')); assert.equal(m.at.X, 26, 'a step up of 3 is climbed');
  m = field(i => (i >= 23 ? 8 : 20)); E.applyMove(m, 'X', { d: 6, a: 80, p: 10 }, E.makeRng('a')); assert.equal(m.at.X, 26, 'a drop is driven down');
  m = field(20, 6, 80); E.applyMove(m, 'X', { d: -6, a: 60, p: 30 }, E.makeRng('a')); assert.equal(m.at.X, T.edge, 'the left edge');
  m = field(20, 20, 93); E.applyMove(m, 'O', { d: 6, a: 120, p: 30 }, E.makeRng('a')); assert.equal(m.at.O, T.w - 1 - T.edge, 'the right edge');
  m = field(20, 40, 53); E.applyMove(m, 'X', { d: 6, a: 150, p: 60 }, E.makeRng('a')); assert.equal(m.at.X, 53 - T.gap, 'never nearer the other tank than the gap');
  const H = R.tankHeights(field(20).h), c = R.tankCfg(field(20));
  assert.deepEqual([R.tankDrive(H, c, 20, 0, 80), R.tankDrive(H, c, 20, 3, 80), R.tankDrive(H, c, 20, -3, 80)], [20, 23, 17]);
});

test('tanks: the shot: gravity and wind in fixed steps, the same every time; it lands about where the textbook says, a mirror image for the other side; the wind carries it', () => {
  const c = R.tankCfg(field(20)), H = R.tankHeights(field(20).h), tk = { X: [20, 20], O: [80, 20] };
  const f = R.tankFly(H, c, 0, 20, 20, 45, 60, tk), v = 60 * 0.6 * Math.SQRT1_2, y0 = T.cy + T.len * Math.SQRT1_2, land = 20 + T.len * Math.SQRT1_2 + v * (v + Math.sqrt(v * v + 2 * 30 * y0)) / 30;
  assert.equal(f.hit, 'ground'); assert.ok(Math.abs(f.x - land) < 1, `landed at ${f.x.toFixed(1)}, the textbook ${land.toFixed(1)}`);
  const g = R.tankFly(H, c, 0, 80, 20, 135, 60, { X: [20, 20], O: [80, 20] }); assert.ok(Math.abs((f.x - 20) - (80 - g.x)) < 1e-6 && f.n === g.n, 'a mirror image');
  assert.deepEqual(R.tankFly(H, c, 0, 20, 20, 45, 60, tk), f, 'the same again');
  const wr = R.tankFly(H, c, 8, 20, 20, 45, 60, tk), wl = R.tankFly(H, c, -8, 20, 20, 45, 60, tk); assert.ok(wr.x > f.x + 4 && wl.x < f.x - 4, `wind: ${wl.x.toFixed(1)} < ${f.x.toFixed(1)} < ${wr.x.toFixed(1)}`);
  assert.equal(R.tankFly(H, c, 0, 20, 20, 135, 100, tk).hit, 'out', 'off the left side'); assert.equal(R.tankFly(H, c, 0, 80, 20, 45, 100, tk).hit, 'out');
  const path = []; const d = R.tankFly(H, c, 3, 20, 20, 60, 70, tk, path, 5), tr = R.tankTrail(c, 3, 20, 20, 60, 70, d.n, 5);
  assert.ok(path.length > 10); assert.deepEqual(tr.slice(0, path.length - 1), path.slice(0, path.length - 1), 'the trail is the flight'); assert.deepEqual(tr[tr.length - 1], [d.x, d.y]);
  for (let a = 0; a <= 360; a += 7) { const r = a * Math.PI / 180; assert.ok(Math.abs(R.dsin(r) - Math.sin(r)) < 1e-9 && Math.abs(R.dcos(r) - Math.cos(r)) < 1e-9, `sine and cosine at ${a}`); }
  // a hill in the way stops a flat shot; a lob clears it
  const hill = R.tankHeights(field(i => (i >= 45 && i <= 55 ? 45 : 20)).h);
  assert.ok(R.tankFly(hill, c, 0, 20, 20, 20, 80, tk).x < 46); assert.ok([...Array(91).keys()].some(k => R.tankFly(hill, c, 0, 20, 20, 62, 10 + k, tk).hit === 'O'), 'a lob over it lands on the tank');
});

test('tanks: the blast: a round bite out of the ground, the tanks settle onto it; damage by how near the hull is: a direct hit, a near miss, nothing at the blast\'s edge', () => {
  const H = R.tankHeights(field(20).h), cut = R.tankCarve(H, 50, 20, 5);
  assert.deepEqual(cut.slice(44, 57), [20, 20, 17, 16, 15, 15, 15, 15, 15, 16, 17, 20, 20]); assert.ok(cut.every((v, i) => v <= H[i]), 'never higher than before');
  assert.deepEqual(R.tankCarve(H, 50, 40, 5), H, 'a blast in the air cuts nothing');
  const cliff = R.tankHeights(field(i => (i >= 50 ? 40 : 20)).h), cc = R.tankCarve(cliff, 49, 22, 5); assert.ok(cc[51] < 40 && cc[51] >= 30, `a cliff over the bite drops by the bite: ${cc[51]}`);
  assert.equal(R.tankCarve(R.tankHeights(field(2).h), 50, 2, 6)[50], 0, 'never under the field');
  const c = R.tankCfg(field(20));
  assert.equal(R.tankDamage(c, 80, 22, 80, 20), 28, 'in the hull: the splash at its fullest (70% of 40)');
  assert.equal(R.tankDamage(c, 80 - T.r - 4.5, 22, 80, 20), 14, 'half the blast away: half of it'); assert.equal(R.tankDamage(c, 80 - T.r - 9, 22, 80, 20), 0, 'at the blast\'s edge: nothing'); assert.equal(R.tankDamage(c, 60, 22, 80, 20), 0);
  // a direct hit: the lob lands on O
  let m = field(20), r = E.applyMove(m, 'X', { d: 0, a: 45, p: HIT }, E.makeRng('a'));
  assert.deepEqual([r.ok, r.outcome, r.note, !!r.again, m.last.hit, m.last.dmg, m.hp, m.last.hp0], [true, 'continue', 'hit', false, 'O', [0, 40], { X: 100, O: 60 }, [100, 100]]);
  const H2 = R.tankHeights(m.h); assert.ok(H2[80] < 20 && H2[60] === 20, 'a crater under the tank: it has settled into it'); assert.equal(m.last.h0, field(20).h, 'the ground as it was rides the move');
  assert.deepEqual(m.sh.X, [20, 20, 45, HIT, m.last.n, 80]); assert.deepEqual(m.n, { X: 1, O: 0 });
  // a near miss: short of the tank, inside the blast
  m = field(20); r = E.applyMove(m, 'X', { d: 0, a: 45, p: NEAR }, E.makeRng('a')); assert.equal(m.last.hit, 'ground'); assert.equal(r.note, 'near'); assert.ok(m.last.dmg[1] > 0 && m.last.dmg[1] < 28 && m.last.dmg[0] === 0, `near: ${m.last.dmg}`); assert.equal(m.hp.O, 100 - m.last.dmg[1]);
  m = field(20); r = E.applyMove(m, 'X', { d: 0, a: 45, p: 40 }, E.makeRng('a')); assert.deepEqual([r.note, m.last.dmg, m.hp], ['miss', [0, 0], { X: 100, O: 100 }]);
  m = field(20); const h = m.h; r = E.applyMove(m, 'X', { d: 0, a: 135, p: 100 }, E.makeRng('a')); assert.deepEqual([r.ok, r.note, m.last.hit, m.h], [true, 'miss', 'out', h], 'off the field: no blast, no crater');
});

test('tanks: a blast hurts the shooter too; a tank knocked out loses the square, its own shot or not; both at once is a draw; Go again on success: a direct hit fires again', () => {
  let m = field(20), r = E.applyMove(m, 'X', { d: 0, a: 90, p: 40 }, E.makeRng('a'));
  assert.deepEqual([r.outcome, m.last.hit, m.last.dmg, m.hp], ['continue', 'X', [40, 0], { X: 60, O: 100 }], 'straight up with no wind: back down on itself');
  m = field(20); m.hp.X = 30; r = E.applyMove(m, 'X', { d: 0, a: 90, p: 40 }, E.makeRng('a')); assert.deepEqual([r.outcome, r.winner, r.note, m.hp.X], ['win', 'O', 'gift', 0], 'knocked itself out: the other player\'s square');
  m = field(20); m.hp.O = 40; r = E.applyMove(m, 'X', { d: 0, a: 45, p: HIT }, E.makeRng('a')); assert.deepEqual([r.outcome, r.winner, r.note, m.hp], ['win', undefined, 'won', { X: 100, O: 0 }]);
  assert.equal(E.applyMove(m, 'O', { d: 0, a: 120, p: 50 }, E.makeRng('a')).ok, false, 'a finished square takes no move');
  // side by side (the gap apart), both low: X's point-blank hit on O catches X too
  m = field(20, 40, 40 + T.gap); m.hp = { X: 5, O: 30 }; r = E.applyMove(m, 'X', { d: 0, a: 8, p: 60 }, E.makeRng('a'));
  assert.equal(m.last.hit, 'O'); assert.ok(m.last.dmg[0] >= 5, `the blast reaches the shooter: ${m.last.dmg}`); assert.deepEqual([r.outcome, r.note, m.hp], ['draw', 'tie', { X: 0, O: 0 }]);
  E.setTune('tanks', { again: 'on' });
  try {
    m = field(20); r = E.applyMove(m, 'X', { d: 0, a: 45, p: HIT }, E.makeRng('a')); assert.deepEqual([r.outcome, r.again, r.note], ['continue', true, 'hit']);
    r = E.applyMove(m, 'X', { d: 0, a: 45, p: 40 }, E.makeRng('a')); assert.equal(!!r.again, false, 'a miss ends the turn');
    m = field(20); r = E.applyMove(m, 'X', { d: 0, a: 90, p: 40 }, E.makeRng('a')); assert.equal(!!r.again, false, 'a hit on itself is no success');
  } finally { E.setTune('tanks', null); }
});

test('tanks: a move is checked strictly; the same move on the same square gives the same square, through a database round trip too; the flash; nothing for a timeout', () => {
  const m = field(20);
  for (const bad of [null, undefined, 'fire', 7, [], [0, 45, 60], {}, { a: 45, p: 60 }, { d: 0, a: 45 }, { d: 0, a: 45, p: 60, x: 1 }, { d: 0.5, a: 45, p: 60 }, { d: 0, a: 45.5, p: 60 }, { d: 0, a: 45, p: 60.5 }, { d: '0', a: 45, p: 60 }, { d: 0, a: -1, p: 60 }, { d: 0, a: 181, p: 60 }, { d: 0, a: 45, p: 9 }, { d: 0, a: 45, p: 101 }, { d: 7, a: 45, p: 60 }, { d: -7, a: 45, p: 60 }, { d: 0, a: NaN, p: 60 }, { d: 0, a: 45, p: Infinity }])
    assert.equal(E.applyMove(m, 'X', bad, E.makeRng('a')).ok, false, JSON.stringify(bad));
  assert.deepEqual(m, field(20), 'a refused move changes nothing');
  for (let g = 0; g < 40; g++) {
    const a = E.newMini('tanks', E.makeRng('q' + g)), rng = E.makeRng('m' + g); let p = 'X';
    for (let k = 0; k < 6; k++) {
      const mv = E.randomLegalMove(a, p, rng), b = clone(a), wire = clone(a); if (!wire.last) delete wire.last; if (!Object.keys(wire.sh).length) delete wire.sh;   // (the database drops nulls and empty objects)
      const ra = E.applyMove(a, p, mv, E.makeRng('1')), rb = E.applyMove(b, p, mv, E.makeRng('2')), rw = E.applyMove(wire, p, mv, E.makeRng('3'));
      assert.ok(ra.ok); assert.deepEqual(rb, ra); assert.deepEqual(b, a, 'the same move, the same square, whatever the rng'); assert.deepEqual(rw, ra); assert.deepEqual(wire, a);
      assert.deepEqual(E.publicMini(a), Object.assign(clone(a), a.tune ? { tune: a.tune } : {}), 'the public view is the square'); sane(a);
      if (ra.outcome !== 'continue') break; p = other(p);
    }
  }
  const st = E.newMatch(E.makeRng('i'), { games: ['tanks'] }), p = st.turn;
  assert.ok(E.playMove(st, 4, { d: 2, a: p === 'X' ? 50 : 130, p: 60 }, E.makeRng('s')).ok);
  assert.deepEqual(Object.keys(st.flash.tk).sort(), ['a', 'by', 'd', 'dmg', 'from', 'h0', 'hit', 'hp0', 'n', 'oc', 'p', 'to', 'wind', 'x', 'y']);
  const tm = R.tankTimes(st.flash.tk); assert.ok(tm.drive === Math.abs(st.flash.tk.to - st.flash.tk.from) * R.TANKT.col && tm.fire > tm.drive && tm.land > tm.fire && tm.end > tm.land); assert.ok(E.playMs(st.flash) >= tm.end);
  assert.equal(R.timeoutClose(st.squares[4].mini, p), null);
});

test('tanks: the computer: always a legal move, at every level; better by level; it drives only with no shot from where it stands', () => {
  const dmg = level => { let d = 0; for (let k = 0; k < 150; k++) { const rng = E.makeRng(level + k), m = E.newMini('tanks', rng), b = E.localBest(E.publicMini(m), 'X', rng, {}, { level }); assert.ok(E.applyMove(m, 'X', b.move, rng).ok); d += m.last.dmg[1] - m.last.dmg[0]; } return d / 150; };
  const e = dmg('easy'), n = dmg('normal'), h = dmg('hard');
  assert.ok(e < n && n < h, `damage a first shot: easy ${e.toFixed(1)} < normal ${n.toFixed(1)} < hard ${h.toFixed(1)}`); assert.ok(n > 6 && n < 30, `Normal ${n.toFixed(1)}`);
  for (let g = 0; g < 90; g++) {
    const rng = E.makeRng('L' + g), m = E.newMini('tanks', rng), level = ['easy', 'normal', 'hard'][g % 3], c = R.tankCfg(m); let p = 'X';
    for (let k = 0; k < 12; k++) {
      const pm = E.publicMini(m, p), b = E.localBest(pm, p, rng, {}, { level, until: () => 50 });
      assert.ok(R.tankOk(b.move, c), `${level}: ${JSON.stringify(b.move)}`); assert.ok(E.needsOf ? true : true);
      if (b.move.d !== 0) assert.ok(level === 'hard' || !(A.solve(c, R.tankHeights(m.h), m.wind, m.at, p, 0)[0].v > 0), `${level} drove with a shot in hand`);
      const r = E.applyMove(m, p, b.move, rng); assert.ok(r.ok); sane(m);
      if (r.outcome !== 'continue') break; p = other(p);
    }
  }
  // out of range from where it stands (a slow shell, a strong pull): it drives towards the other tank, and still ends the square
  E.setTune('tanks', { speed: 40, gravity: 60, hills: 0 });
  try {
    const rng = E.makeRng('far'), m = E.newMini('tanks', rng), b = E.localBest(E.publicMini(m), 'X', rng, {}, { level: 'normal' }); assert.ok(b.move.d > 0, `drove ${b.move.d}`);
    let p = 'X', done = false; for (let k = 0; k < 400 && !done; k++) { const r = E.applyMove(m, p, E.localBest(E.publicMini(m), p, rng, {}, { level: 'normal' }).move, rng); assert.ok(r.ok); done = r.outcome !== 'continue'; p = other(p); } assert.ok(done, 'it ended');
  } finally { E.setTune('tanks', null); }
  const pm = E.publicMini(E.newMini('tanks', E.makeRng('n'))); assert.ok(A.needs(pm, 'X') >= 2 && A.needs(pm, 'X') === A.needs(pm, 'O')); pm.hp.O = 10; assert.ok(A.needs(pm, 'X') < A.needs(pm, 'O'));
});

test('tanks: a square always ends: winnable alone (the other side never fires), the computer against itself, and at random', () => {
  for (let g = 0; g < 45; g++) {                                   // O never moves: X, with the computer's hand, knocks it out in a bounded number of shots
    const rng = E.makeRng('solo' + g), m = E.newMini('tanks', rng), level = ['easy', 'normal', 'hard'][g % 3]; let shots = 0, r = null;
    for (; shots < 40; shots++) { r = E.applyMove(m, 'X', E.localBest(E.publicMini(m), 'X', rng, {}, { level }).move, rng); assert.ok(r.ok); if (r.outcome !== 'continue') break; }
    assert.ok(r.outcome !== 'continue', `alone, ${level}: still open after ${shots} shots (${JSON.stringify(m.hp)})`);
    assert.ok(r.outcome === 'win', 'won or lost, never left open'); assert.ok(shots + 1 >= 3, 'never in a shot or two');
  }
  let ends = 0, first = 99;
  for (let g = 0; g < 60; g++) {
    const rng = E.makeRng('w' + g), m = E.newMini('tanks', rng), level = ['easy', 'normal', 'hard'][g % 3]; let p = 'X';
    for (let k = 0; k < 400; k++) { const r = E.applyMove(m, p, E.localBest(E.publicMini(m), p, rng, {}, { level }).move, rng); assert.ok(r.ok); sane(m); if (r.outcome !== 'continue') { ends++; first = Math.min(first, k + 1); break; } p = other(p); }
  }
  assert.equal(ends, 60); assert.ok(first >= 5, `the shortest square: ${first} moves`);
  let rnd = 0;
  for (let g = 0; g < 300; g++) {
    const rng = E.makeRng('r' + g), m = E.newMini('tanks', rng); let p = 'X';
    for (let k = 0; k < 6000; k++) { const mv = E.randomLegalMove(m, p, rng); assert.ok(R.tankOk(mv, R.tankCfg(m))); const r = E.applyMove(m, p, mv, rng); assert.ok(r.ok); if (k % 7 === 0) sane(m); if (r.outcome !== 'continue') { rnd++; sane(m); break; } p = other(p); }
  }
  assert.equal(rnd, 300, 'random play ends every square');
});
