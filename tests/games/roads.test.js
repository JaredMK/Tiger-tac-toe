'use strict';
// Roads: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

/* ===================================== Roads ===================================== */
const H = (r, c) => r * 3 + c, V = (r, c) => 12 + r * 4 + c;      // a line across from dot (r,c); a line down from it
const segsOf = (p, ks) => { const s = new Array(24).fill(null); for (const k of ks) s[k] = p; return s; };

test('roads: the longest trail, against cases checked by hand', () => {
  assert.equal(E.ROAD_SEGS.length, 24);
  const L = ks => E.roadLongest(segsOf('X', ks), 'X').len;
  assert.equal(L([]), 0);
  assert.equal(L([H(0, 0), H(0, 1), H(0, 2)]), 3, 'a straight row of three');
  assert.equal(L([H(1, 0), H(1, 1), V(1, 1)]), 2, 'a T: three lines at one dot, only two in one trail');
  assert.equal(L([H(0, 0), H(1, 0), V(0, 0), V(0, 1)]), 4, 'a square: all the way round');
  assert.equal(L([H(0, 0), H(1, 0), V(0, 0), V(0, 1), H(1, 1), H(2, 1), V(1, 1), V(1, 2)]), 8, 'two squares meeting at a corner: through the corner twice');
  assert.equal(L([H(1, 0), H(1, 1), V(0, 1), V(1, 1)]), 2, 'a plus: two arms');
  assert.equal(L([H(0, 0), H(0, 1), V(1, 0), V(2, 0), H(3, 0), V(2, 1)]), 4, 'apart: the longer piece (a U of four)');
  assert.equal(L([H(0, 0), H(0, 1), H(3, 0), H(3, 1), V(2, 0), V(2, 1)]), 3, 'a fork at the bottom: one branch only');
  assert.equal(L([H(0, 0), H(1, 0), V(0, 0), V(0, 1), H(0, 1)]), 5, 'a square with a tail: round it and off');
  assert.equal(L([H(0, 0), H(0, 1), H(0, 2), V(0, 3), V(1, 3), V(2, 3), H(3, 2), H(3, 1), H(3, 0), V(2, 0), V(1, 0), V(0, 0)]), 12, 'the whole rim');
  // the lines of the trail, in order, each one joined to the next
  const t = E.roadLongest(segsOf('X', [H(0, 0), H(1, 0), V(0, 0), V(0, 1), H(0, 1)]), 'X');
  for (let k = 1; k < t.segs.length; k++) { const a = E.ROAD_SEGS[t.segs[k - 1]], b = E.ROAD_SEGS[t.segs[k]]; assert.ok(a.some(v => b.includes(v)), 'a joined trail'); }
  // against a brute force over every order of the lines, on random sets
  const brute = ks => { let best = 0; const used = new Set(); const go = (v, n) => { best = Math.max(best, n); for (const k of ks) { if (used.has(k)) continue; const [a, b] = E.ROAD_SEGS[k]; if (v != null && a !== v && b !== v) continue; used.add(k); if (v == null) { go(a, n + 1); go(b, n + 1); } else go(a === v ? b : a, n + 1); used.delete(k); } }; go(null, 0); return best; };
  const rng = lcg(9);
  for (let k = 0; k < 300; k++) {
    const ks = Array.from({ length: 24 }, (_, i) => i).filter(() => rng() < 0.3).slice(0, 8);
    assert.equal(L(ks), brute(ks), `lines ${ks}`);
  }
});

test('roads: a line, then a random open line blocked; once none is open, the longer road wins and a tie resets', () => {
  const m = E.newMini('roads', lcg(1));
  E.applyMove(m, 'X', 0, lcg(2));
  assert.equal(m.segs[0], 'X'); assert.ok(m.last.block != null && m.segs[m.last.block] === 'B' && m.last.block !== 0);
  assert.equal(E.applyMove(m, 'O', 0).ok, false); assert.equal(E.applyMove(m, 'O', m.last.block).ok, false, 'a blocked line is not a move');
  const end = E.newMini('roads', lcg(3));
  end.segs = new Array(24).fill('B'); for (const k of [H(0, 0), H(0, 1), H(0, 2)]) end.segs[k] = 'X'; for (const k of [H(3, 0), H(3, 1)]) end.segs[k] = 'O'; end.segs[V(2, 0)] = null;
  assert.deepEqual(E.applyMove(end, 'O', V(2, 0), lcg(4)), { ok: true, outcome: 'draw', note: 'tie' }, '3 and 3: a tie');
  const win = E.newMini('roads', lcg(5));
  win.segs = new Array(24).fill('B'); for (const k of [H(0, 0), H(0, 1), H(0, 2)]) win.segs[k] = 'X'; win.segs[H(3, 0)] = 'O'; win.segs[V(2, 3)] = null;
  assert.deepEqual(E.applyMove(win, 'O', V(2, 3), lcg(6)), { ok: true, outcome: 'win', note: 'full', winner: 'X', counts: { X: 3, O: 1 } });
});

test('roads: the computer lengthens its own road and takes the line the other player wants most', () => {
  const s = new Array(24).fill(null); s[H(0, 0)] = 'X'; s[H(0, 1)] = 'X';
  const ext = E.roadPick({ type: 'roads', segs: s }, 'X', null);
  assert.ok([H(0, 2), V(0, 0), V(0, 1), V(0, 2)].includes(ext.k) && E.roadLongest(ext.after, 'X').len === 3, 'it lengthens its road');
  const t = new Array(24).fill('B'); t[H(1, 0)] = 'O'; t[H(1, 1)] = 'O'; t[H(1, 2)] = null; t[H(3, 2)] = null;
  assert.equal(E.roadPick({ type: 'roads', segs: t }, 'X', null).k, H(1, 2), 'it cuts off the other player\'s best extension');
});
