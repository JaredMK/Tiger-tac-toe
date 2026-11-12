// Flood, Seating and Shelves (the November 2026 polish, round 2). Flood: the blob dyed in a ripple, each wave of grabbed
// cells joining at its moment under its player's token, the counts running on with the waves, the cells a colour would
// grab named for its button's press, the last grab ringed, a win's ripple. Seating: the room with its door, the mover's
// token from their chip, the customer's walk from the door (ui/cardfly.js), the seat kept for a customer ringed, the +1
// and the count at its moment, the winner's tables hopping. Shelves: blocks with drawn marks, the mover's from their
// chip, the grey one dropping in, the shelf's tag and the count as the block lands. The controls are what they were:
// the same buttons, moves and order. Rendered in Node with the browser's names stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const flood = await import('../../src/games/flood/view.js');
const seating = await import('../../src/games/seating/view.js');
const shelves = await import('../../src/games/shelves/view.js');
const FR = await import('../../src/games/flood/rules.js');
const SR = await import('../../src/games/seating/rules.js');
const HR = await import('../../src/games/shelves/rules.js');
const { PLACE_MS } = await import('../../src/games/shared/placement.js');
const H = await import('../../src/ui/haptics.js');
const { SFX } = await import('../../src/audio/sound.js');

const draw = (view, mini, o = {}) => view.screen({ owner: o.owner || null, mini }, o.a || null, null, mini, !!o.view, !!o.locked, o.a || null, null, () => false, () => -1, !!o.fresh, o.turn || 'X', '');
const sounds = (view, f, mini) => { const out = []; view.sounds(f, (n, ms, rate) => out.push([n, ms, rate]), f.kind === 'claim', mini, null); return out; };
const count = (html, re) => (html.match(re) || []).length;
// a move through the engine, and its flash as the page would hold it
const move = (mini, p, m, rng) => { const r = E.applyMove(mini, p, m, rng), f = { type: mini.type, kind: r.outcome === 'win' ? 'claim' : 'move', by: p, note: r.note, winner: r.winner }; E.rulesOf(mini.type).moveFlash(m, p, null, null, mini, f); return { r, f }; };

test('flood: the same five colour buttons, the blob\'s own off; a press names the cells that colour would grab', () => {
  const rng = E.makeRng('fl'), mini = E.newMini('flood', rng), blob = mini.colors[0];
  const html = draw(flood, mini);
  assert.equal(count(html, /<button class="fsw fc\d[^"]*"[^>]* data-act="move"/g), 5);
  for (let c = 0; c < 5; c++) assert.match(html, new RegExp(`<button class="fsw fc${c}${c === blob ? ' isblob' : ''}"[^>]* data-act="move" data-m='${c}'[^>]*${c === blob ? ' disabled' : ''}>`), `colour ${c}`);
  assert.equal(count(html, / disabled/g), 1, 'only the blob\'s colour is off on the mover\'s phone');
  assert.equal(count(draw(flood, mini, { locked: true }), /<button[^>]* disabled/g), 5, 'all off while it is not this phone\'s move');
  for (let c = 0; c < 5; c++) { if (c === blob) continue; assert.equal(count(html, new RegExp(`class="flc[^"]* w${c}"`, 'g')), FR.floodGain(mini, c), `the cells colour ${c} would grab`); }
  assert.doesNotMatch(draw(flood, mini, { locked: true }), /class="flc[^"]* w\d/, 'no preview off the move');
  assert.match(html, /class="g-arc g-fl tX"/); assert.equal(count(html, /class="flc[^"]* start/g), 1);
});

test('flood: the dye ripples out from the start, each wave joins at its moment with its token, the count runs with the waves', () => {
  const rng = E.makeRng('fl2'), mini = E.newMini('flood', rng);
  let best = -1, gain = -1; for (let c = 0; c < 5; c++) if (c !== mini.colors[0] && FR.floodGain(mini, c) > gain) { gain = FR.floodGain(mini, c); best = c; }
  move(mini, 'X', best, rng);
  let b2 = -1, g2 = -1; for (let c = 0; c < 5; c++) if (c !== mini.colors[0] && FR.floodGain(mini, c) > g2) { g2 = FR.floodGain(mini, c); b2 = c; }
  const { f } = move(mini, 'O', b2, rng), T = flood.floodTimes(f.flood);
  assert.ok(g2 > 0); assert.equal(T.end, FR.flashMs(f, 0, false), 'the move\'s time is the rules\'');
  const live = draw(flood, mini, { a: f, locked: true, turn: 'O' });
  assert.equal(count(live, /class="flc[^"]* grab/g), g2, 'every grabbed cell joins');
  f.flood.waves.forEach((w, k) => assert.equal(count(live, new RegExp(`grab[^"]*" style="[^"]*--t:${T.wave0 + k * T.step}ms`, 'g')), w.length, `wave ${k} at its moment`));
  assert.equal(count(live, /class="flc[^"]* recolor/g), 1 + gain, 'the blob as it was takes the dye');
  const dye = [...live.matchAll(/recolor[^"]*" style="[^"]*--t:(\d+)ms/g)].map(m => Number(m[1]));
  assert.equal(Math.min(...dye), 0, 'from the start cell'); assert.ok(Math.max(...dye) + 200 <= T.wave0 + 40, 'dyed before the first wave joins');
  assert.equal(count(live, /class="fltok O"/g), g2); assert.equal(count(live, /class="fltok X"/g), gain);
  assert.match(live, new RegExp(`<b class="cnt" data-from="0" data-delay="${T.wave0}"[^>]*>${g2}</b>`), 'the mover\'s count runs on from the first wave');
  assert.doesNotMatch(live, / last/, 'no ring while the move plays');
  const idle = draw(flood, mini);
  assert.equal(count(idle, /class="flc[^"]* last/g), g2, 'the cells grabbed last, ringed'); assert.doesNotMatch(idle, /grab|recolor|class="cnt"/, 'nothing plays without a move');
  assert.doesNotMatch(draw(flood, mini, { view: true, owner: 'X' }), / last|<button/, 'a finished square: the grid alone');
  const s = sounds(flood, f, mini);
  assert.deepEqual(s[0], ['splash', 0, undefined]); assert.equal(s.filter(x => x[0] === 'plop').length, Math.min(8, f.flood.waves.length));
  assert.ok(s.every(x => SFX[x[0]]), 'every sound exists'); assert.ok(H.RESULT_SOUNDS.has('plop'), 'the last wave carries the result\'s buzz');
});

test('flood: a win ripples through the winner\'s tokens once the waves are in; the miniature shows the grid and a bar each', () => {
  const rng = E.makeRng('fl3'), mini = E.newMini('flood', rng); let p = 'X', last = null;
  for (let n = 0; n < 80 && !(last && last.r.outcome === 'win'); n++) { let best = -1, g = -1; for (let c = 0; c < 5; c++) if (c !== mini.colors[0] && FR.floodGain(mini, c) > g) { g = FR.floodGain(mini, c); best = c; } last = move(mini, p, best, rng); if (last.r.outcome !== 'win') p = p === 'X' ? 'O' : 'X'; }
  assert.equal(last.r.outcome, 'win');
  const T = flood.floodTimes(last.f.flood), live = draw(flood, mini, { a: last.f, locked: true, fresh: true, turn: p });
  assert.equal(count(live, /class="flc[^"]* won"/g), mini.score[p]); assert.ok(count(live, /class="flc[^"]* lost"/g) > 0);
  const w = [...live.matchAll(/--w:(\d+)ms/g)].map(m => Number(m[1]));
  assert.ok(Math.min(...w) >= T.end, 'after the move\'s own animation'); assert.ok(Math.max(...w) + 420 <= FR.flashMs(last.f, 0, true), 'inside the won move\'s time');
  const m = flood.miniature(mini);
  assert.equal(count(m, /<i class="own [XO]"/g), mini.score.X + mini.score.O); assert.match(m, /class="tflbars"/); assert.doesNotMatch(m.replace(/aria-label="[^"]*"/g, ''), />[^<]+</, 'a picture, no text');
});

test('seating: the same seat buttons in the same order; free tables open, a seat kept for a customer ringed for its player', () => {
  const rng = E.makeRng('se'), mini = E.newMini('seating', rng), n = mini.who.length;
  const html = draw(seating, mini);
  const ms = [...html.matchAll(/<button class="sts[^"]*"[^>]* data-act="move" data-m='(\d+)'/g)].map(m => Number(m[1]));
  assert.deepEqual(ms, Array.from({ length: n }, (_, i) => i), 'a button a seat, in seat order');
  assert.equal(count(html, /<button[^>]* disabled/g), 0); assert.equal(count(html, /class="sgh X"/g), n, 'the mover\'s token under the finger on every seat that can be taken');
  assert.match(html, /class="g-arc g-seat tX open"/); assert.match(html, /data-anchor="sdoor"/, 'the door the customers walk from');
  assert.match(html, /Next customer:/);
  move(mini, 'X', 0, rng);
  const after = draw(seating, mini, { turn: 'O' });
  if (!mini.who[1]) { assert.match(after, /class="stbl wX[^"]*"/); assert.equal(count(after, /class="sts wait"/g), 1, 'the seat across from X waits'); assert.doesNotMatch(draw(seating, mini, { view: true, owner: 'X' }), /sts wait/, 'not in a finished square'); }
  assert.match(after, /<button class="sts X[^"]*"[^>]* data-m='0'[^>]* disabled/);
  assert.equal(count(draw(seating, mini, { locked: true, turn: 'O' }), /<button class="sts[^"]*"[^>]*(?<! disabled)>/g), 0, 'no seat takes a tap off the move');
  assert.doesNotMatch(draw(seating, mini, { locked: true, turn: 'O' }), /class="sgh/);
});

test('seating: the mover\'s token comes from their chip, the customer walks from the door at their moment, the +1 and the count land together', () => {
  let got = null;
  for (let k = 0; k < 300 && !got; k++) {   // a move that scores
    const rng = E.makeRng('sc' + k), mini = E.newMini('seating', rng); let p = 'X';
    for (let n = 0; n < 12; n++) { const ms = SR.seatMoves(mini.who); if (!ms.length) break; const m = ms[Math.floor(rng() * ms.length)], x = move(mini, p, m, rng); if (x.r.outcome !== 'continue') break; if (x.f.seat.scorer) { got = { mini, f: x.f, m, p }; break; } p = p === 'X' ? 'O' : 'X'; }
  }
  assert.ok(got, 'a scoring move found');
  const { mini, f, m, p } = got, s = f.seat, t = SR.seatTimes(s);
  const live = draw(seating, mini, { a: f, locked: true, turn: p });
  assert.match(live, new RegExp(`<button class="sts ${p} pop"[^>]* data-m='${m}'[^>]*><b data-cf="stal:${p}" data-cfat="0">`), 'the mover\'s token flies from their chip');
  assert.match(live, new RegExp(`<button class="sts Z walk" style="[^"]*--t:${t.walk}ms"[^>]* data-m='${s.z}'[^>]*><span class="sguest"[^>]* data-cf="sdoor" data-cfat="${t.walk}" data-cfd="${SR.SEATT.walkMs}">`), 'the customer walks from the door');
  assert.match(live, new RegExp(`class="spop ${s.scorer}" style="--t:${t.pop}ms"`)); assert.match(live, new RegExp(`class="sscore bump" style="--t:${t.pop}ms"[^>]*><b class="cnt" data-from="${mini.score[s.scorer] - 1}" data-delay="${t.pop}">${mini.score[s.scorer]}</b>`), 'the count turns as the +1 pops');
  assert.match(live, /class="stbl sc [XO][^"]* got mv"/); assert.doesNotMatch(live, / last/);
  const idle = draw(seating, mini, { turn: p === 'X' ? 'O' : 'X' });
  assert.equal(count(idle, /class="sts[^"]* last"/g), 2, 'the seat taken last and its customer\'s, ringed'); assert.doesNotMatch(idle, /data-cf=|spop|class="cnt"/, 'nothing plays without a move');
  const snd = sounds(seating, f, mini);
  assert.deepEqual(snd[0], ['mark', 0, undefined]); assert.equal(snd.filter(x => x[0] === 'hop').length, 4, 'four footfalls'); assert.ok(snd.some(x => x[0] === 'ding' && x[1] === t.pop));
  assert.ok(snd.every(x => SFX[x[0]] && x[1] <= t.end), 'every sound exists and falls inside the move');
  const mn = seating.miniature(mini);
  assert.match(mn, /class="tsf"/); assert.equal(count(mn, /class="tsd/g), mini.who.length);
});

test('shelves: the same spot buttons in order; blocks carry drawn marks; the mover\'s block comes from their chip and the grey one drops after it', () => {
  const rng = E.makeRng('sh'), mini = E.newMini('shelves', rng), n = mini.cells.length;
  const html = draw(shelves, mini);
  const ms = [...html.matchAll(/<button class="shs[^"]*"[^>]* data-act="move" data-m='(\d+)'/g)].map(m => Number(m[1]));
  assert.deepEqual(ms, Array.from({ length: n }, (_, i) => i), 'a button a spot, in order');
  assert.equal(count(html, /<button[^>]* disabled/g), 0); assert.equal(count(html, /class="shgh X"/g), n);
  assert.equal(count(draw(shelves, mini, { locked: true }), /<button[^>]* disabled/g), n);
  const { f } = move(mini, 'X', 4, rng), g = f.shelf.grey;
  const live = draw(shelves, mini, { a: f, locked: true });
  assert.match(live, /<button class="shs X pop"[^>]* data-m='4'[^>]* disabled><span class="shb X" data-cf="shtal:X" data-cfat="0"><svg class="shmk X"/, 'the block flies from the mover\'s chip');
  assert.match(live, new RegExp(`<button class="shs G drop" style="--t:${PLACE_MS.mark}ms"[^>]* data-m='${g}'[^>]*><span class="shb G"></span>`), 'the grey block drops once theirs is down');
  assert.match(live, /data-anchor="shtal:X"/); assert.match(live, new RegExp(`class="shsc bump"[^>]*><b class="cnt" data-from="0" data-delay="${PLACE_MS.mark - 60}"[^>]*>1</b><small>/7</small>`), 'on one shelf now: the count turns as the block lands');
  assert.equal(count(live, /<i class="on X fillin"/g), 1, 'that shelf\'s tag fills in'); assert.doesNotMatch(live, /<b>[XO]<\/b>/, 'no letter marks');
  assert.match(live, /<b class="X">[^<]*<\/b> (is|are) on 1 shelf/);
  const idle = draw(shelves, mini, { turn: 'O' });
  assert.equal(count(idle, /class="shs [XG] last"/g), 2, 'the block placed last and its grey one, ringed'); assert.doesNotMatch(idle, /data-cf=|fillin|class="cnt"|pop|drop/);
  const snd = sounds(shelves, f, mini);
  assert.deepEqual(snd.map(x => x[0]), ['pieceSlide', 'c4drop', 'point', 'thud']); assert.ok(snd.every(x => SFX[x[0]] && x[1] < HR.flashMs(f, 0, false)));
  const { f: f2 } = move(mini, 'O', 3, rng);   // the same shelf as X's: O is new on it; then X again on a shelf it is on: no rising note
  const free = mini.cells.map((c, i) => (c ? -1 : i)).filter(i => i >= 3 && i < 6);
  if (free.length) { const { f: f3 } = move(mini, 'X', free[0], rng); assert.ok(!sounds(shelves, f3, mini).some(x => x[0] === 'point'), 'a second block on a shelf: no new shelf'); assert.doesNotMatch(draw(shelves, mini, { a: f3, locked: true }), /class="cnt"/); }
  assert.ok(f2.shelf);
  const mn = shelves.miniature(mini);
  assert.equal(count(mn, /<u class="[XO]?"><\/u>/g), 14, 'two tags a shelf'); assert.doesNotMatch(mn.replace(/aria-label="[^"]*"/g, ''), />[^<]+</, 'a picture, no text');
});

test('shelves and seating: a win\'s payoff starts once the move has played and ends inside the won move\'s time', () => {
  const rng = E.makeRng('shw'), mini = E.newMini('shelves', rng); let p = 'X', last = null;
  for (let n = 0; n < 40; n++) { const e = mini.cells.map((c, i) => (c ? -1 : i)).filter(i => i >= 0); last = move(mini, p, e[Math.floor(rng() * e.length)], rng); if (last.r.outcome !== 'continue') break; p = p === 'X' ? 'O' : 'X'; }
  if (last.r.outcome === 'win') {
    const live = draw(shelves, mini, { a: last.f, locked: true, fresh: true, turn: p }), w = [...live.matchAll(/--w:(\d+)ms/g)].map(m => Number(m[1]));
    assert.equal(count(live, new RegExp(`<i class="on ${last.r.winner}[^"]* won"`, 'g')), HR.shelfOn(mini.cells, last.r.winner));
    assert.ok(Math.min(...w) >= HR.flashMs(last.f, 0, false)); assert.ok(Math.max(...w) + 420 <= HR.flashMs(last.f, 0, true) + 1);
  }
  const r2 = E.makeRng('sew'), sm = E.newMini('seating', r2); let q = 'X', l2 = null;
  for (let n = 0; n < 60; n++) { const ms = SR.seatMoves(sm.who); if (!ms.length) break; l2 = move(sm, q, ms[Math.floor(r2() * ms.length)], r2); if (l2.r.outcome !== 'continue') break; q = q === 'X' ? 'O' : 'X'; }
  if (l2.r.outcome === 'win') {
    const live = draw(seating, sm, { a: l2.f, locked: true, fresh: true, turn: q }), w = [...live.matchAll(/--w:(\d+)ms/g)].map(m => Number(m[1]));
    assert.equal(count(live, /class="stbl sc [XO][^"]* won"/g), sm.score[l2.r.winner]);
    if (w.length) { assert.ok(Math.min(...w) >= SR.seatTimes(l2.f.seat).end); assert.ok(Math.max(...w) + 420 <= SR.flashMs(l2.f, 0, true) + 1); }
  }
});
