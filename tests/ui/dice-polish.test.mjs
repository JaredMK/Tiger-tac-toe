// The dice games' look (the polish sweep, November 2026): the shared 3-D die (src/ui/dice.js) and Krabs' round as its
// view plays it (src/games/craps/view.js): every die, total, ring, marker, word and sound from the move being played,
// at the moments the round's own times give. Rendered in Node with the browser's names stubbed (no page needed).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const { GAMES } = await import('../../src/games/index.js');
const { die3d, DIE_BOUNCE } = await import('../../src/ui/dice.js');
const KV = await import('../../src/games/craps/view.js');
const { state } = await import('../../src/ui/app.js');
state.setup = Object.assign({}, state.setup, { names: { X: 'Xena', O: 'Olaf' } });

const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const clone = v => JSON.parse(JSON.stringify(v));
const die = n => (n - 1) / 6 + 0.01, dice = (...pairs) => seq(...pairs.flatMap(([a, b]) => [die(a), die(b)]));
function play(mini, p, rng) {
  const m = clone(mini), res = E.applyMove(m, p, 'roll', rng);
  assert.equal(res.ok, true);
  const flash = { kind: 'move', by: p, next: p, square: 0, type: 'craps', note: res.note || null, pass: null, timeout: false };
  GAMES.craps.rules.moveFlash('roll', p, null, 0, m, flash);
  return { mini: m, flash };
}
const screen = (shown, flash, turn) => KV.screen({ owner: null, mini: shown }, flash, null, shown, false, !!flash, flash, null, false, () => -1, false, turn, '');
const pips = html => (html.match(/<circle /g) || []).length;

test('the shared die: a cube with the number towards the player and every other face a real one; an octahedron likewise', () => {
  for (let n = 1; n <= 6; n++) {
    const h = die3d(n), faces = [...h.matchAll(/<i class="d3f d3([a-g])">(.*?)<\/i>/g)].map(m => [m[1], pips(m[2])]);
    assert.deepEqual(faces.map(f => f[0]), ['a', 'b', 'c', 'd', 'e', 'g']);
    assert.equal(faces[0][1], n, 'the front face'); assert.equal(faces[1][1], 7 - n, 'the one behind it');
    assert.deepEqual(faces.map(f => f[1]).sort(), [1, 2, 3, 4, 5, 6], 'each number once');
    assert.equal(faces[2][1] + faces[3][1], 7); assert.equal(faces[4][1] + faces[5][1], 7);
  }
  for (let n = 1; n <= 8; n++) {
    const h = die3d(n, { sides: 8 }), nums = [...h.matchAll(/<text[^>]*>(\d)<\/text>/g)].map(m => Number(m[1]));
    assert.equal(nums[0], n); assert.deepEqual(nums.slice().sort(), [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.match(h, new RegExp(`<i class="d3t u k0 on"><svg[^>]*><path[^>]*/><text[^>]*>${n}</text>`));
  }
  assert.match(die3d(null), /<i class="d3f d3a"><b class="d3q">\?<\/b><\/i>/); assert.match(die3d(null, { sides: 8 }), />\?<\/text>/);
  // at rest: nothing timed; thrown: its length and its start, and which way it comes
  assert.doesNotMatch(die3d(4), /roll|style=/);
  assert.match(die3d(4, { roll: 560, t: 900, v: 1 }), /^<span class="d3 d3cube roll v1" style="--dur:560ms;--t:900ms" aria-hidden="true">/);
  assert.match(die3d(4, { roll: 560 }), /style="--dur:560ms"/);
  assert.match(die3d(2, { label: 'Die: 2' }), /role="img" aria-label="Die: 2"/);
  assert.ok(DIE_BOUNCE > 0.3 && DIE_BOUNCE < 0.6);
});

test('Krabs: a round plays roll by roll from the move: the strip turns to the number set as the marker lands, each pair is thrown in at its time with its total, the result comes as the last pair lands', () => {
  const T = E.CRAPS, m0 = E.newMini('craps', E.makeRng('k')), x = play(m0, 'X', dice([1, 1])), o = play(x.mini, 'O', dice([2, 4], [5, 3], [3, 3]));
  assert.deepEqual([x.mini.last.result, o.flash.craps.point, o.flash.craps.result], ['lose', 6, 'win']);
  const tim = E.crapsTimes(o.flash.craps.rolls, 6, null), land = k => tim.at[k] + T.land;
  const html = screen(x.mini, o.flash, 'O');   // on X's phone: the square as X left it (X's own round its last), O's round playing
  // the strip: the first roll's colours until the marker has landed, then 6 wins and 7 is out
  const swap = tim.puck + KV.KRABS_T.swap;
  assert.match(html, new RegExp(`<div class="kcells tu" style="--u:${swap}ms"><i class="o">2<svg`)); assert.match(html, new RegExp(`<div class="kcells tf" style="--f:${swap}ms"><i class="x">2</i>`));
  const after = html.slice(html.indexOf('kcells tf'));
  assert.match(after, /<i class="w">6<svg/); assert.match(after, /<i class="o">7<svg/); assert.match(after, /<i class="x">11<\/i>/);
  assert.match(html, new RegExp(`<b class="kpuck O fly" style="left:40\\.91%;--to:40\\.91%;--t:${tim.puck}ms;--d:${T.puck}ms"`), 'the marker flies onto the 6, in the roller\'s colour');
  // the pairs: O's dice, never X's 1 and 1
  const pairs = [...html.matchAll(/<div class="kpair([^"]*)" style="([^"]*)"[^>]*><div class="kdice">(.*?)<\/div><b class="ktot ([^"]*)" style="--t:(\d+)ms">(\d+)<\/b><\/div>/g)];
  assert.equal(pairs.length, 3);
  assert.deepEqual(pairs.map(p => Number(p[6])), [6, 8, 6]); assert.deepEqual(pairs.map(p => Number(p[5])), [land(0), land(1), land(2)], 'each total pops as its pair lands');
  assert.deepEqual(pairs.map(p => p[4].replace(' appear', '')), ['p O', 'x', 'w'], 'the number set (the roller\'s ring), a roll that did nothing, the winning one');
  assert.deepEqual(pairs.map(p => p[1].trim()), ['gone', 'gone', 'cheer']); assert.ok(pairs[0][2].includes(`--t2:${tim.at[1]}ms`) && pairs[2][2].includes(`--d:${land(2)}ms`));
  pairs.forEach((p, k) => { const d = [...p[3].matchAll(/class="d3 d3cube roll v([01])" style="--dur:(\d+)ms(?:;--t:(\d+)ms)?"/g)]; assert.deepEqual(d.map(v => [v[1], Number(v[2]), Number(v[3] || 0)]), [['0', T.land, tim.at[k]], ['1', T.land, tim.at[k]]]); });
  assert.equal(pips(pairs[0][3].split('class="kd b"')[0].match(/<i class="d3f d3a">.*?<\/i>/)[0]), 2); assert.equal(pips(pairs[0][3].split('class="kd b"')[1].match(/<i class="d3f d3a">.*?<\/i>/)[0]), 4);
  // a ring on each total rolled, the result's words and the winner's pip
  assert.equal((html.match(/<b class="khit O late/g) || []).length, 3);
  assert.match(html, new RegExp(`class="arcres ok appear" style="--t:${land(2)}ms" role="status">Point 6 made!<`)); assert.doesNotMatch(html, /Xena<\/b>: /);
  assert.match(html, new RegExp(`<div class="kfelt win late" style="--d:${land(2)}ms">`));
  assert.match(html, new RegExp(`class="on fillin" style="--t:${land(2) + KV.KRABS_T.pip}ms"`), 'the winner\'s pip fills in just after');
  // its sounds: each roll's rattle, first touch and landing, the marker, the result as the last pair lands
  const snd = []; KV.sounds(o.flash, (n, ms) => snd.push([n, ms]));
  assert.deepEqual(snd.filter(s => s[0] === 'thunk').map(s => s[1]), [land(0), land(1), land(2)]); assert.deepEqual(snd.filter(s => s[0] === 'rattle').map(s => s[1]), tim.at);
  assert.deepEqual(snd.filter(s => s[0] === 'diceTap').length, 3); assert.deepEqual(snd.at(-1), ['diceWin', land(2)]); assert.deepEqual(snd.find(s => s[0] === 'clack'), ['clack', tim.puck + T.puck]);
  assert.ok(land(2) + 1200 <= E.playMs(o.flash) + 800, 'the hop is over within the move and its hold');
});

test('Krabs: out on the first roll; a long round\'s later rolls tumble quicker and still land inside their slot; nothing playing shows the dice as they lie and the first roll\'s strip', () => {
  const m0 = E.newMini('craps', E.makeRng('k2')), x = play(m0, 'X', dice([1, 2]));
  const h = screen(m0, x.flash, 'X');
  assert.match(h, /class="arcres no appear" style="--t:\d+ms" role="status">3: out!</); assert.match(h, /<b class="ktot o appear"/); assert.match(h, /<div class="kfelt lose late"/); assert.match(h, /<div class="kpair sad"/);
  assert.doesNotMatch(h, /kpuck|kcells t[uf]/, 'no number was set: no marker, the strip as it was');
  const long = play(m0, 'O', dice([2, 2], [1, 1], [1, 2], [6, 6], [5, 6], [1, 1], [3, 4])), tim = E.crapsTimes(long.flash.craps.rolls, 4, null), hl = screen(m0, long.flash, 'O');
  const durs = [...hl.matchAll(/class="d3 d3cube roll v0" style="--dur:(\d+)ms/g)].map(m => Number(m[1]));
  assert.deepEqual(durs, [E.CRAPS.land, E.CRAPS.land, E.CRAPS.land, E.CRAPS.land, KV.KRABS_T.quickLand, KV.KRABS_T.quickLand, KV.KRABS_T.quickLand]);
  assert.ok(KV.KRABS_T.quickLand < E.CRAPS.quick, 'a quick roll has landed before the next is thrown');
  assert.match(hl, new RegExp(`role="status">Seven out<`)); assert.ok(tim.at[6] + KV.KRABS_T.quickLand <= E.playMs(long.flash));
  // nothing playing, the turn passed: the last dice at rest, no total, no rolls listed, the first roll's strip, Roll
  const idle = screen(x.mini, null, 'O');
  assert.match(idle, /<div class="kpair idle"/); assert.doesNotMatch(idle, /ktot|khit|kpuck| roll v/); assert.match(idle, /<div class="kcells"><i class="o">2<svg/);
  assert.match(idle, />Roll<\/button>/); assert.match(idle, /aria-label="First roll: 7 or 11 wins; 2, 3 or 12 is out"/);
  assert.match(screen(m0, null, 'X'), /<b class="d3q">\?<\/b>/, 'a square nobody has rolled in: two dice not rolled yet');
  // a round won with the turn kept: Roll again, and the header says who goes again
  const won = play(m0, 'X', dice([3, 4])); state.lock = 4; state.zoom = 4;
  assert.match(screen(won.mini, null, 'X'), />Roll again<\/button>/); assert.equal(KV.heldSub(won.mini, 'X', null), '<b class="X">Xena</b> goes again'); assert.equal(KV.heldSub(won.mini, 'X', won.flash), '');
  state.lock = null; state.zoom = null;
});
