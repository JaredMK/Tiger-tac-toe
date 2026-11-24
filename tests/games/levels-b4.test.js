'use strict';
// The computer's three levels really differ (the AI levels pass, batch 4): for each game, its per-level settings
// (meta.js TUNE, groups Computer: Easy / Normal / Hard) do not all have the same defaults, and on a few seeded
// positions the three levels' moves are not all the same. The win rates themselves are measured by
// tests/sim/levels.js (300 squares a pairing), never here.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));

const GAMES = ['twist', 'mancala', 'walls', 'target', 'heads', 'proll', 'marble', 'shuffle', 'toss', 'cricket', 'slice', 'rhythm', 'rally', 'blocks', 'numbers', 'trail', 'keydrop', 'pint', 'gems', 'castle', 'tanks', 'jigsaw', 'hive', 'barrel', 'doors'];
// Pure luck: every level plays alike (heads: a fair coin, no call better than the other); only the thinking time differs.
const LUCK = ['heads'];
const SEEDS = { walls: 3, castle: 3, tanks: 4 };                     // (their searches and physics are slow: fewer positions)
const lvKey = f => f.group && /^Computer: /.test(f.group);
function moveAt(t, seed, level, steps) {
  const rng = E.makeRng(`${t}:${seed}`), m = E.newMini(t, rng); let p = 'X';
  for (let k = 0; k < steps; k++) {                                  // (a few moves in, the same for every level: Normal's)
    const b = E.localBest(E.publicMini(m, p), p, E.makeRng(`${t}:${seed}:${k}`), {}, { level: 'normal', diff: 'normal', until: null, value: 1, behind: 0 });
    let mv = b.move; if (mv && mv.fing) mv = E.fingAi(m, p, rng, mv.level);
    const r = E.applyMove(m, p, mv, rng); if (!r.ok || r.outcome !== 'continue') return null;
    if (!r.again) p = p === 'X' ? 'O' : 'X';
  }
  const b = E.localBest(E.publicMini(m, p), p, E.makeRng(`${t}:${seed}:pick`), {}, { level, diff: level, until: null, value: 1, behind: 0 });
  return JSON.stringify(b.move);
}
for (const t of GAMES) {
  test(`${t}: its three computer levels differ`, () => {
    const by = {};
    for (const f of E.tuneFields(t).filter(lvKey)) { const lv = f.group.slice(10).toLowerCase(), base = f.k.replace(/(Easy|Normal|Hard)$/, ''); (by[base] = by[base] || {})[lv] = f.def; }
    const differ = Object.values(by).filter(v => new Set([v.easy, v.normal, v.hard].map(String)).size > 1);
    if (LUCK.includes(t)) return;
    assert.ok(differ.length || E.tuneFields(t).some(f => lvKey(f) && !/(Easy|Normal|Hard)$/.test(f.k)), `${t}: some per-level setting differs by level`);
    const seen = { easy: new Set(), normal: new Set(), hard: new Set() }, all = [];
    for (let s = 0; s < (SEEDS[t] || 12); s++) for (const steps of [0, 3, 6]) { const row = ['easy', 'normal', 'hard'].map(l => moveAt(t, s, l, steps)); if (row[0] == null) continue; all.push(row); }
    assert.ok(all.some(r => r[0] !== r[1]), `${t}: Easy and Normal choose differently somewhere`);
    assert.ok(all.some(r => r[1] !== r[2]), `${t}: Normal and Hard choose differently somewhere`);
  });
}
