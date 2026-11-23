'use strict';
// Door Drop (December 2026): its rules, settings and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/doors/rules.js');
const M = require('../../src/games/doors/meta.js');

const wrong = (m, r) => (m.good[r] + 1) % m.d[r];

test('doors: Admin only, luck, 1.35.0; the deal: floors of doors, one way down each, hidden; plain JSON', () => {
  assert.deepEqual([M.release, M.category, M.minVersion, M.placeholder], ['admin', 'luck', '1.35.0', false]);
  assert.deepEqual(E.tuneFields('doors').map(f => f.k), ['floors', 'doors', 'towers', 'again', 'forget', 'forgetHard', 'forgetEasy']);
  assert.deepEqual(E.tuneFields('doors').map(f => f.group), ['Board', 'Board', 'Rules', 'Rules', 'Computer', 'Computer', 'Computer']);
  assert.deepEqual(['forget', 'forgetHard', 'forgetEasy'].map(k => E.tuneFields('doors').find(f => f.k === k).def), [10, 0, 40]);
  const D = E.tuneFields('doors').find(f => f.k === 'doors'); assert.deepEqual([D.def, D.min, D.max], [4, 3, 6]);
  for (const set of [null, { floors: 8, doors: 6 }, { towers: 'shared' }, { floors: 1, doors: 3 }, { doors: 5 }]) {
    E.setTune('doors', set);
    try {
      for (let g = 0; g < 40; g++) {
        const m = E.newMini('doors', E.makeRng('d' + g));
        assert.equal(m.v, 3); assert.equal(m.d.length, m.f); m.d.forEach((k, r) => { assert.equal(k, (set && set.doors) || 4); assert.ok(m.good[r] >= 0 && m.good[r] < k); });
        assert.equal(m.sep, !set || set.towers !== 'shared');
        assert.deepEqual(JSON.parse(JSON.stringify(m)), m);
        const pub = E.publicMini(m); assert.ok(!('good' in pub) && !('link' in pub), 'never public'); assert.ok(!/good|link/.test(JSON.stringify(pub)));
        assert.deepEqual(R.secret(m), { good: m.good, link: m.link }); const c = JSON.parse(JSON.stringify(m)); R.hide(c); assert.ok(!('good' in c) && !('link' in c));
      }
    } finally { E.setTune('doors', null); }
  }
  const d = E.newMini('doors', E.makeRng('def')); assert.deepEqual([d.f, d.d.join(','), d.sep], [3, '4,4,4', true], 'the defaults: 3 floors of 4 doors, a tower each');
});

// The owner's rules for the doors (November 2026), over thousands of towers: every allowed number of floors and of
// doors a floor, both kinds of tower.
test('doors: the links: thousands of towers, every floors and doors setting, both tower modes: one way down a floor, the dead ends linked to each other for good', () => {
  let towers = 0;
  for (const towers_ of ['separate', 'shared']) for (let floors = 1; floors <= 8; floors++) for (let doors = 3; doors <= 6; doors++) {
    E.setTune('doors', { floors, doors, towers: towers_ });
    try {
      for (let g = 0; g < 70; g++) {
        const m = E.newMini('doors', E.makeRng(`t${towers_}${floors}${doors}:${g}`)); towers++;
        assert.equal(m.f, floors); assert.equal(m.d.length, floors);
        for (let r = 0; r < floors; r++) {
          assert.equal(m.d[r], doors, 'exactly the set number of doors on every floor');
          const down = m.link[r].map((v, i) => (v === -1 ? i : -1)).filter(i => i >= 0);
          assert.deepEqual(down, [m.good[r]], 'exactly one way down, the one door with no link');
          const dead = m.link[r].map((v, i) => i).filter(i => i !== m.good[r]);
          assert.equal(dead.length, doors - 1);
          for (const i of dead) { const o = m.link[r][i]; assert.ok(Number.isInteger(o) && o >= 0 && o < doors, 'out of a door of the same floor'); assert.notEqual(o, i, 'never out of itself'); assert.notEqual(o, m.good[r], 'never out of the way down'); assert.ok(dead.includes(o), 'out of another dead end'); }
          assert.equal(new Set(dead.map(i => m.link[r][i])).size, dead.length, 'each dead end comes out of a door of its own');
        }
        // played: every door of a floor, by either player, at any time, with any rng for the move
        if (g % 3) continue;                                    // (a third of them played, 1,500 towers)
        const frozen = JSON.stringify(m);
        for (const r of new Set([g % floors, floors - 1])) for (let i = 0; i < doors; i++) for (const p of ['X', 'O']) {   // (a floor of each tower, and its last)
          const outs = new Set();
          for (const seed of ['a', 'b', 'c']) {
            const t = JSON.parse(frozen); t.at[p] = r;
            if (seed === 'c') { const q = p === 'X' ? 'O' : 'X', j = (i + 1) % doors; t.at[q] = r; E.applyMove(t, q, j, E.makeRng('other' + g)); t.at[p] = Math.min(t.at[p], r); if (t.at[p] !== r) t.at[p] = r; if (R.doorsTried(t, p)[r][i] === 1) continue; }   // (the other player has already tried a door of this floor)
            const res = E.applyMove(t, p, i, E.makeRng(seed + g + r + i));
            assert.ok(res.ok, JSON.stringify(res));
            if (i === m.good[r]) { assert.equal(t.last.down, true); assert.equal(t.at[p], r + 1, 'the way down leads down a floor, nowhere else'); assert.ok(!('out' in t.last)); outs.add('down'); }
            else { assert.equal(t.last.down, false); assert.equal(t.at[p], r, 'a dead end: the same floor'); assert.equal(t.last.out, m.link[r][i]); assert.equal(t.pos[p], R.doorX(doors, m.link[r][i])); assert.equal(t.seen[r][i], m.link[r][i], 'the link used is on show from then on'); outs.add(t.last.out); }
            assert.deepEqual([t.good, t.link], [m.good, m.link], 'the tower never changes');
            const pub = E.publicMini(t), txt = JSON.stringify(pub);
            assert.ok(!/good|link/.test(txt));
            for (let rr = 0; rr < floors; rr++) for (let k = 0; k < doors; k++) {   // only the links that have been used are public
              const used = t.sep ? t.tried.X[rr][k] === 1 || t.tried.O[rr][k] === 1 : t.tried[rr][k] === 1;
              assert.equal(pub.seen[rr][k], used ? m.link[rr][k] : -1);
            }
          }
          assert.ok(outs.size <= 1, 'the same door, the same place: whoever goes in, whenever, whatever the move\'s rng');
        }
      }
    } finally { E.setTune('doors', null); }
  }
  assert.ok(towers >= 4000, `${towers} towers`);
});

test('doors: a whole square played at random: a dead end always sends its runner out of the door it is linked to, the way down is never a way out', () => {
  for (let g = 0; g < 300; g++) {
    const rng = E.makeRng('play' + g); E.setTune('doors', { floors: 1 + (g % 5), doors: 3 + (g % 4), towers: g % 2 ? 'shared' : 'separate' });
    try {
      const m = E.newMini('doors', rng), good = m.good.slice(), link = JSON.stringify(m.link), came = {};
      let p = 'X', won = false;
      for (let k = 0; k < 400 && !won; k++) {
        const r = m.at[p], i = E.randomLegalMove(m, p, rng), res = E.applyMove(m, p, i, rng);
        assert.ok(res.ok);
        if (i === good[r]) assert.equal(m.at[p], r + 1);
        else { const key = r + ':' + i; assert.notEqual(m.last.out, good[r]); assert.notEqual(m.last.out, i); if (key in came) assert.equal(came[key], m.last.out, 'the same way out as before'); came[key] = m.last.out; assert.equal(m.at[p], r); }
        won = res.outcome === 'win'; p = p === 'X' ? 'O' : 'X';
      }
      assert.ok(won); assert.deepEqual(m.good, good); assert.equal(JSON.stringify(m.link), link);
    } finally { E.setTune('doors', null); }
  }
});

test('doors: v 2: a dead end is marked, sends the runner out of its linked door and ends the turn; it cannot be tried again; a square from before the links plays on', () => {
  const m = E.newMini('doors', E.makeRng('a')), w = wrong(m, 0); m.v = 2;   // (a square dealt before v 3 keeps its rule)
  for (let k = 0; k < 20; k++) {
    const t = JSON.parse(JSON.stringify(m)), r = E.applyMove(t, 'X', w, E.makeRng('x' + k));
    assert.deepEqual([r.ok, r.outcome, r.note, !!r.again, t.at.X, t.tried.X[0][w], t.tried.O[0][w]], [true, 'continue', 'dead', false, 0, 1, 0]);
    assert.equal(t.last.out, m.link[0][w], 'out of the door it is linked to');
    assert.equal(t.pos.X, R.doorX(t.d[0], t.last.out)); assert.equal(t.last.from, 50);
    assert.equal(E.applyMove(t, 'X', w, E.makeRng('y')).reason, 'tried');
    assert.ok(!R.doorsMoves(t, 'X').includes(w)); assert.ok(R.doorsMoves(t, 'O').includes(w), 'a tower each: the other\'s own marks');
    assert.ok(R.doorsMoves(t, 'X').includes(t.last.out), 'the door it came out of is not marked: nobody has gone in at it');
    assert.deepEqual(R.doorsExits(t, 0).map((v, i) => (v ? i : -1)).filter(i => i >= 0), [t.last.out], 'but it is known for a way out');
    const o = E.applyMove(t, 'O', w, E.makeRng('z' + k)); assert.equal(t.last.out, m.link[0][w], 'the same for the other player in their tower');
    assert.ok(o.ok);
  }
  assert.equal(E.applyMove(m, 'X', 9, E.makeRng('x')).ok, false);
  const hidden = JSON.parse(JSON.stringify(m)); R.hide(hidden);
  assert.equal(E.applyMove(hidden, 'X', 0, E.makeRng('x')).reason, 'secret', 'a phone without the layout cannot judge a door');
  // a square dealt before the links (v 1): no links, a floor of two doors even: its way out drawn with the move
  const old = { type: 'doors', v: 1, sep: true, f: 2, d: [2, 5], good: [1, 3], tried: { X: [[0, 0], [0, 0, 0, 0, 0]], O: [[0, 0], [0, 0, 0, 0, 0]] }, at: { X: 0, O: 0 }, pos: { X: 50, O: 50 }, last: null };
  assert.equal(R.stale, undefined, 'played on, never dealt again');
  const r1 = E.applyMove(old, 'X', 0, E.makeRng('o')); assert.deepEqual([r1.ok, r1.note, old.last.out, old.tried.X[0][0]], [true, 'dead', 1, 1]);
  assert.ok(!('seen' in old) && !('seen' in E.publicMini(old)));
  assert.ok(E.applyMove(old, 'X', 1, E.makeRng('o')).ok); assert.equal(old.at.X, 1);
  assert.ok(E.localBest(E.publicMini(old), 'X', E.makeRng('q'), {}, { level: 'normal' }).move >= 0);
  assert.ok(E.applyMove(old, 'X', 3, E.makeRng('o')).outcome === 'win');
});

test('doors: the way down drops a floor and ends the turn (Go again on success: keeps it); the last floor wins', () => {
  for (const again of ['off', 'on']) {
    E.setTune('doors', { again });
    try {
      const m = E.newMini('doors', E.makeRng('b')); let r;
      for (let k = 0; k < m.f; k++) {
        r = E.applyMove(m, 'O', m.good[k], E.makeRng('x'));
        assert.equal(m.at.O, k + 1); assert.equal(m.tried.O[k][m.good[k]], 2); assert.equal(m.pos.O, R.doorX(m.d[k], m.good[k]));
        if (k < m.f - 1) { assert.equal(r.note, 'down'); assert.equal(!!r.again, again === 'on'); }
      }
      assert.deepEqual([r.outcome, r.note], ['win', 'ground']);
    } finally { E.setTune('doors', null); }
  }
  for (let g = 0; g < 40; g++) {                                 // any play ends: one side picking at random alone
    const rng = E.makeRng('solo' + g), t = E.newMini('doors', rng); let won = false;
    for (let k = 0; k < 100 && !won; k++) won = E.applyMove(t, 'X', E.randomLegalMove(t, 'X', rng), rng).outcome === 'win';
    assert.ok(won);
  }
});

test('doors: identical towers in the race; a shared tower marks every door for both (v 2: refused for both)', () => {
  const m = E.newMini('doors', E.makeRng('s'));
  assert.ok(Array.isArray(m.good) && m.good.length === m.f, 'one layout: the same way down in both towers');
  E.setTune('doors', { towers: 'shared' });
  try {
    const t = E.newMini('doors', E.makeRng('s')), w = wrong(t, 0); t.v = 2;
    E.applyMove(t, 'X', w, E.makeRng('x'));
    assert.equal(t.tried[0][w], 1); assert.equal(E.applyMove(t, 'O', w, E.makeRng('x')).reason, 'tried', 'marked for both');
    E.applyMove(t, 'O', t.good[0], E.makeRng('x')); assert.deepEqual(R.doorsKnown(t, 'X', 0)[t.good[0]], 2);
  } finally { E.setTune('doors', null); }
});

test('doors: v 2: the computer takes a known way down, never a dead end; Normal and Hard read the other tower, Easy its own', () => {
  const m = E.newMini('doors', E.makeRng('c')), g = m.good[0], w = wrong(m, 0); m.v = 2;
  m.tried.O[0][g] = 2;                                          // O found the way down on its tower
  for (const level of ['normal', 'hard']) for (let k = 0; k < 10; k++) assert.equal(E.localBest(E.publicMini(m), 'X', E.makeRng(level + k), {}, { level }).move, g);
  let other = 0; for (let k = 0; k < 40; k++) if (E.localBest(E.publicMini(m), 'X', E.makeRng('e' + k), {}, { level: 'easy' }).move !== g) other++;
  assert.ok(other > 0, 'Easy does not look across');
  m.tried.O[0][g] = 0; m.tried.X[0][w] = 1;
  for (const level of ['easy', 'normal', 'hard']) for (let k = 0; k < 20; k++) assert.notEqual(E.localBest(E.publicMini(m), 'X', E.makeRng(level + k), {}, { level }).move, w);
  assert.equal(R.timeoutClose(m, 'X'), null);
  // a door a runner came out of is a dead end to anyone who thinks about it: Normal and Hard leave it, Easy does not think
  const t = E.newMini('doors', E.makeRng('c2')), w2 = wrong(t, 0); t.v = 2;
  E.applyMove(t, 'O', w2, E.makeRng('x')); const out = t.last.out, left = [0, 1, 2, 3].filter(i => i !== w2 && i !== out);
  for (const level of ['normal', 'hard']) for (let k = 0; k < 30; k++) assert.ok(left.includes(E.localBest(E.publicMini(t), 'X', E.makeRng(level + k), {}, { level }).move), 'one of the two doors still in doubt');
  let easyOut = 0; for (let k = 0; k < 60; k++) if (E.localBest(E.publicMini(t), 'X', E.makeRng('e' + k), {}, { level: 'easy' }).move === out) easyOut++;
  assert.ok(easyOut > 0);
});

test('doors: in a match: the flash, a timeout mid-turn plays nothing, the square\'s log entry carries its type', () => {
  E.setTune('doors', { again: 'on', floors: 2 });
  try {
    const st = E.newMatch(E.makeRng('i'), { games: ['doors'] }), p = st.turn, q = st.squares[4].mini;
    assert.ok(E.playMove(st, 4, q.good[0], E.makeRng('e')).ok);
    assert.deepEqual(st.flash.dd, { r: 0, i: q.good[0], down: true, out: -1, from: 50 }); assert.equal(E.playMs(st.flash), R.doorsPre() + R.doorsDownMs(), 'a turn\'s first pick: the camera\'s intro counted'); E.endFlash(st);
    assert.equal(st.lock, 4, 'Go again on: held to the square');
    st.timer.deadline = 1; const t = E.timeoutMove(st, E.makeRng('t'));
    assert.ok(t.ok); assert.notEqual(st.turn, p); assert.equal(q.at[p], 1, 'the floor reached is kept');
    st.turn = p; st.lock = null;
    const w = E.playMove(st, 4, q.good[1], E.makeRng('z'));
    assert.ok(w.ok); assert.equal(st.flash.kind, 'claim');
    assert.equal(st.flash.dd.c, 1, 'a pick straight after a way down, Go again on: the same turn going on'); assert.equal(E.playMs(st.flash), R.doorsDownMs() + R.DOORS.win, 'no intro again');
    const e = st.sqlog[st.sqlog.length - 1]; assert.deepEqual([e.t, e.end, e.w], ['doors', 'won', p], 'the square\'s log carries its type');
    assert.equal(E.matchStats(st).squares[0].t, 'doors');
  } finally { E.setTune('doors', null); }
});

test('doors: online: the record keeps the ways down off the public state, every entry and the move\'s flash; a move goes through the server\'s rules', () => {
  const games = Object.fromEntries(E.TYPES.map(g => [g, g === 'doors']));
  let rec = E.newOnlineMatch({ names: { X: 'A', O: 'B' }, games, timer: 30 }, E.makeRng('on'), 'dd');
  const pub = () => JSON.stringify(rec.state);
  assert.ok(!/"good"|"link"/.test(pub()), 'never public'); assert.ok(rec.secrets && /good/.test(JSON.stringify(rec.secrets)) && /link/.test(JSON.stringify(rec.secrets)));
  for (let k = 0; k < 8; k++) {
    const p = rec.state.turn, sq = rec.state.squares.findIndex(s => !s.owner), mini = E.fullState(rec).squares[sq].mini;
    const mv = E.applyOnlineMove(rec, p, sq, R.doorsMoves(mini, p)[0], E.makeRng('m' + k));
    assert.ok(mv.ok, JSON.stringify(mv)); rec = mv.rec;
    assert.ok(!/good|link/.test(JSON.stringify(mv.entries)) && !/"good"|"link"/.test(pub()), 'nor in an entry or the record\'s state');
    const full = E.fullState(rec).squares[sq].mini, shown = rec.state.squares[sq].mini;
    if (!rec.state.squares[sq].owner) for (let r = 0; r < full.f; r++) for (let i = 0; i < full.d[r]; i++) assert.equal(shown.seen[r][i], full.tried.X[r][i] === 1 || full.tried.O[r][i] === 1 ? full.link[r][i] : -1, 'a link is public only once it has been used');
    assert.ok(mv.entries[0].dd && typeof mv.entries[0].dd.down === 'boolean');
  }
  assert.equal(E.applyOnlineMove(rec, rec.state.turn, 0, 'auto', E.makeRng('a')).ok, false, 'no automatic move from a phone');
});

// No memory aids (v 3, November 2026): nothing is marked on screen, so nothing tried is refused either.
test('doors: v 3: a door tried before can be picked again: a dead end sends its runner out of the same linked door, no progress, the turn ends; both tower modes', () => {
  for (const towers of ['separate', 'shared']) {
    E.setTune('doors', { towers });
    try {
      for (let g = 0; g < 30; g++) {
        const m = E.newMini('doors', E.makeRng(towers + g)), w = wrong(m, 0), out = m.link[0][w];
        assert.equal(m.v, 3); assert.ok(R.doorsOpenAll(m));
        const r1 = E.applyMove(m, 'X', w, E.makeRng('a' + g)); assert.deepEqual([r1.ok, r1.note, m.last.out, m.at.X], [true, 'dead', out, 0]);
        assert.deepEqual(R.doorsMoves(m, 'X'), [0, 1, 2, 3], 'every door of the floor, the one tried too');
        const r2 = E.applyMove(m, 'X', w, E.makeRng('b' + g));
        assert.deepEqual([r2.ok, r2.outcome, r2.note, !!r2.again, m.last.out, m.at.X, m.pos.X], [true, 'continue', 'dead', false, out, 0, R.doorX(4, out)], 'the same fixed exit again, no progress');
        assert.equal(R.doorsTried(m, 'X')[0][w], 1, 'still on the record');
        const r3 = E.applyMove(m, 'O', w, E.makeRng('c' + g)); assert.ok(r3.ok); assert.equal(m.last.out, out, 'the other player too');
        E.applyMove(m, 'X', m.good[0], E.makeRng('d')); assert.equal(m.at.X, 1);
        if (towers === 'shared') { const r4 = E.applyMove(m, 'O', m.good[0], E.makeRng('e')); assert.ok(r4.ok); assert.equal(m.at.O, 1, 'a way down another took is a door like any other'); }
      }
    } finally { E.setTune('doors', null); }
  }
  const t = E.newMini('doors', E.makeRng('rand')); let won = false;   // a square played at random to its end
  for (let k = 0; k < 200 && !won; k++) won = E.applyMove(t, 'X', E.randomLegalMove(t, 'X', E.makeRng('r' + k)), E.makeRng('s' + k)).outcome === 'win';
  assert.ok(won);
});

test('doors: v 3: the computer remembers by level: Hard everything it saw, Normal most, Easy much less; never the way down unseen', () => {
  const m = E.newMini('doors', E.makeRng('mem')), g = m.good[0], dead = [0, 1, 2, 3].filter(i => i !== g);
  const pick = (pm, level, n, seed) => { const c = {}; for (let k = 0; k < n; k++) { const v = E.localBest(E.publicMini(pm), 'X', E.makeRng(seed + level + k), {}, { level }).move; c[v] = (c[v] || 0) + 1; } return c; };
  // O found the way down on its tower (separate towers: on show)
  const a = JSON.parse(JSON.stringify(m)); E.applyMove(a, 'O', g, E.makeRng('o'));
  const took = lv => (pick(a, lv, 400, 'w')[g] || 0) / 400;
  assert.equal(took('hard'), 1, 'Hard never forgets a way down it saw');
  assert.ok(took('normal') > 0.9 && took('normal') < 1, `Normal mostly remembers it: ${took('normal')}`);
  assert.ok(took('easy') < 0.75 && took('easy') > 0.4, `Easy often forgets it: ${took('easy')}`);
  // X tried a dead end itself: Hard never tries it again; Normal now and then; Easy often
  const b = JSON.parse(JSON.stringify(m)), w = dead[0]; E.applyMove(b, 'X', w, E.makeRng('x')); const out = b.last.out;
  const again = lv => { const c = pick(b, lv, 600, 'd'); return ((c[w] || 0) + (c[out] || 0)) / 600; };
  assert.equal(again('hard'), 0);
  assert.ok(again('normal') > 0 && again('normal') < 0.12, `Normal: ${again('normal')}`);
  assert.ok(again('easy') > again('normal') + 0.1, `Easy: ${again('easy')}`);
  // nothing seen: no level knows the way down (a uniform pick among all four)
  for (const lv of ['easy', 'normal', 'hard']) { const c = pick(m, lv, 800, 'u'); assert.ok((c[g] || 0) / 800 > 0.18 && (c[g] || 0) / 800 < 0.32, `${lv}: ${c[g]}`); }
  // the settings: forgetting off everywhere makes every level as Hard; 100% forgets everything
  E.setTune('doors', { forget: 0, forgetEasy: 0 });
  try { const c = E.newMini('doors', E.makeRng('mem')); E.applyMove(c, 'O', c.good[0], E.makeRng('o')); for (const lv of ['easy', 'normal']) assert.equal(pick(c, lv, 100, 'z')[c.good[0]], 100); } finally { E.setTune('doors', null); }
  E.setTune('doors', { forgetHard: 100 });
  try { const c = E.newMini('doors', E.makeRng('mem')); E.applyMove(c, 'O', c.good[0], E.makeRng('o')); const n = pick(c, 'hard', 400, 'y')[c.good[0]] || 0; assert.ok(n < 160, `${n}`); } finally { E.setTune('doors', null); }
});
