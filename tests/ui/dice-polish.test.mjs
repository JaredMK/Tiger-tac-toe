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

// ---- Shut the Box and Ship, Captain & Crew (the polish sweep, batch 3): the same die, each game's move from its own flash ----
const SV = await import('../../src/games/shut/view.js');
const CV = await import('../../src/games/scc/view.js');
const SR = await import('../../src/games/shut/rules.js');
const CR = await import('../../src/games/scc/rules.js');
const { CF } = await import('../../src/ui/cardfly.js');
const one = (...faces) => seq(...faces.map(die));
function move(type, mini, p, mv, rng) {
  const m = clone(mini), res = E.applyMove(m, p, mv, rng);
  assert.equal(res.ok, true, JSON.stringify(res));
  const flash = { kind: res.outcome === 'win' ? 'claim' : 'move', by: p, next: p, square: 0, type, note: res.note || null, pass: null, timeout: false };
  GAMES[type].rules.moveFlash(mv, p, null, 0, m, flash);
  return { mini: m, flash, res };
}
const show = (V, shown, flash, turn, o = {}) => V.screen({ owner: null, mini: shown }, flash, o.done || null, shown, !!o.view, !!flash || !!o.done || !!o.view || !!o.locked, flash, null, false, () => -1, !!(flash && flash.kind === 'claim'), turn, '');
const sounds = (V, f, won) => { const out = []; V.sounds(f, (n, ms, rate) => out.push([n, ms, rate]), !!won); return out; };
const faces = html => [...html.matchAll(/<i class="d3f d3a">(.*?)<\/i>/g)].map(m => (m[1].includes('d3q') ? null : pips(m[1])));

test('Shut the Box: a roll throws the 3-D dice from the move, the total pops as they land and the tiles that can make it light then; a pick is refused where no way takes it', () => {
  const T = SR.SHUT, m0 = E.newMini('shut', E.makeRng('s')); m0.up.X = [true, true, false, true, false, true];
  const r = move('shut', m0, 'X', 'roll', one(2, 3));
  assert.deepEqual([r.flash.shut.d, r.flash.shut.none], [[2, 3], false]);
  const html = show(SV, m0, r.flash, 'X');   // (drawn over the square as it was: every die and number is the move's own)
  assert.deepEqual([...html.matchAll(/class="d3 d3cube roll v([01])" style="--dur:(\d+)ms"/g)].map(m => [m[1], Number(m[2])]), [['0', T.land], ['1', T.land]], 'two dice thrown in, each its own way, landing together');
  assert.deepEqual(faces(html), [2, 3]);
  assert.match(html, new RegExp(`<b class="shxtot pop" style="--t:${T.land}ms" aria-label="5">5</b>`), 'the total pops as the dice land');
  assert.equal((html.match(/<span class="shxpts late"[^>]*>(.*?)<\/span>/)[1].match(/<i /g) || []).length, 5, 'a pip for each point of the roll');
  // X's open tiles 1, 2, 4, 6: only 1 + 4 make 5
  const tiles = side => [...html.split(`<div class="shxrail ${side}`)[1].split('</div></div>')[0].matchAll(/<button class="shxt ([^"]*)"( data-act="shtile")? data-v="(\d)"/g)].map(m => [Number(m[3]), m[1], !!m[2]]);
  assert.deepEqual(tiles('X').map(t => t[1]), ['up can soon', 'up off soon', 'dn', 'up can soon', 'dn', 'up off soon']);
  assert.ok(tiles('X').every(t => t[2]) && tiles('O').every(t => !t[2] && t[1] === 'up'), 'only the rail being picked from carries the tiles\' act (a replayed press is shown on the first match)');
  assert.match(html, new RegExp(`<div class="shxrail X now" style="--n:6;--land:${T.land}ms">`)); assert.match(html, /<div class="shxrail O rest"/);
  assert.match(html, new RegExp(`class="arcres  appear" style="--t:${T.land}ms" role="status">Make 5<`));
  assert.deepEqual(sounds(SV, r.flash).map(s => s.slice(0, 2)), [['rattle', 0], ['diceTap', Math.round(T.land * DIE_BOUNCE)], ['thunk', T.land]]);
  // the roll waiting: the tiles as buttons, the ones no way takes marked so; nothing picked yet
  state.zoom = 0;
  const wait = show(SV, r.mini, null, 'X');
  assert.match(wait, /<button class="shxt up can" data-act="shtile" data-v="1" aria-label="Tile 1">/); assert.match(wait, /<button class="shxt up off" data-act="shtile" data-v="2" aria-label="Tile 2, cannot make the roll" aria-disabled="true">/);
  assert.doesNotMatch(wait, / roll v|shxtot pop/); assert.deepEqual(faces(wait), [2, 3]); assert.match(wait, />Make 5<\/p>/); assert.match(wait, /data-m='"roll"'[^>]* disabled|disabled[^>]*>Roll</);
  assert.deepEqual([...SV.shutCan([true, true, true, true, true, true], 8, [])].sort(), [1, 2, 3, 4, 5, 6]); assert.deepEqual([...SV.shutCan([true, true, true, true, true, true], 8, [1, 2])].sort(), [1, 2, 5]);
  assert.deepEqual([...SV.shutCan(r.mini.up.X, 5, [])].sort(), [1, 4]);
  assert.equal(SV.heldSub(r.mini, 'X', null), '<b class="X">Xena</b> rolled 5'); assert.equal(SV.heldSub(r.mini, 'X', r.flash), '');
  // nobody has rolled: the dice the mover is about to throw, blank (one die once the open tiles add up to little)
  assert.deepEqual(faces(show(SV, m0, null, 'O')), [null, null]);
  const low = clone(m0); low.up.O = [true, true, false, false, false, false];
  assert.deepEqual(faces(show(SV, low, null, 'O')), [null]);
  state.zoom = null;
});

test('Shut the Box: the tiles fall shut one after the other with a clack and a pip each; no tiles make the roll: the total is struck and the rail shakes; the last tile: the lid', () => {
  const T = SR.SHUT, V = SV.SHUT_T, m0 = E.newMini('shut', E.makeRng('s2')); m0.up.X = [true, true, false, true, false, true];
  const r = move('shut', m0, 'X', 'roll', one(2, 3)), f = move('shut', r.mini, 'X', [1, 4], one(1));
  const tim = SR.shutTimes(f.flash.shut), html = show(SV, r.mini, f.flash, 'O');   // (on the other phone: the square as it was, the flip playing)
  assert.deepEqual(faces(html), [2, 3], 'the dice of the roll the flip answers, at rest'); assert.doesNotMatch(html, / roll v/);
  // (the square shown is the one before the flip in this call: the tiles come from the square, so draw the one after it too)
  const after = show(SV, f.mini, f.flash, 'O');
  assert.deepEqual([...after.matchAll(/<button class="shxt dn flip"[^>]*data-v="(\d)" style="--t:(\d+)ms"/g)].map(m => [Number(m[1]), Number(m[2])]), [[1, 0], [4, T.flip]]);
  const clack = k => Math.round(tim.flipAt(k) + T.flipMs * V.clack);
  assert.deepEqual([...after.split('<div class="ctal O')[0].matchAll(/<i class="on fillin" style="--t:(\d+)ms">/g)].map(m => Number(m[1])), [clack(0), clack(1)], 'a pip fills as each tile meets the box');
  assert.match(after, new RegExp(`class="arcres ok appear" style="--t:${tim.end - T.hold}ms" role="status">Flipped 1 \\+ 4<`));
  assert.deepEqual(sounds(SV, f.flash), [['domClick', clack(0), 1], ['domClick', clack(1), 0.93]]);
  assert.ok(clack(1) < SR.flashMs(f.flash, 0, false));
  // the move made here, still on show once it has played: its dice and its words, nothing moving
  const held = show(SV, f.mini, null, 'O', { done: f.flash });
  assert.deepEqual(faces(held), [2, 3]); assert.match(held, /class="arcres ok" role="status">Flipped 1 \+ 4</); assert.doesNotMatch(held, /flip|fillin| roll v/); assert.match(held, /<div class="shxrail X now"/);
  // one tile left (a 1), one die: a 5 makes nothing
  const m1 = clone(m0); m1.up.X = [true, false, false, false, false, false];
  const n = move('shut', m1, 'X', 'roll', one(5)), nh = show(SV, n.mini, n.flash, 'X'), no = T.land + V.no;
  assert.deepEqual([n.flash.shut.none, n.res.again || false, faces(nh)], [true, false, [5]]);
  assert.match(nh, new RegExp(`<div class="shxfelt none sad" style="--no:${no}ms"`)); assert.match(nh, /<b class="shxtot no pop"[^>]*>5<i class="late"><\/i><\/b>/);
  assert.match(nh, new RegExp(`<div class="shxrail X now nope" style="--n:6;--land:${T.land}ms;--no:${no}ms">`)); assert.doesNotMatch(nh, / can| off/);
  assert.match(nh, new RegExp(`class="arcres no appear" style="--t:${T.land}ms" role="status">No tiles make 5<`));
  assert.deepEqual(sounds(SV, n.flash).at(-1).slice(0, 2), ['diceLose', no]); assert.ok(no + 450 <= SR.flashMs(n.flash, 0, false), 'the struck total and the shake are over within the move');
  // the last tile shut: the lid comes down over the rail after it, with its thump and a sparkle, inside the move
  const w0 = move('shut', m1, 'X', 'roll', one(1)), w = move('shut', w0.mini, 'X', [1], one(1));
  assert.equal(w.res.outcome, 'win');
  const wh = show(SV, w.mini, w.flash, 'X'), wt = SR.shutTimes(w.flash.shut), lid = wt.end - T.hold + V.lid;
  assert.match(wh, new RegExp(`<i class="shxlid close" style="--t:${lid}ms" aria-hidden="true">`)); assert.match(wh, /role="status">Box shut!</); assert.doesNotMatch(wh, /Won by|stamp/);
  const ws = sounds(SV, w.flash, true);
  assert.deepEqual(ws.map(s => s[0]), ['domClick', 'c4drop', 'sparkle']); assert.ok(ws[1][1] > ws[0][1] && ws[2][1] === lid + V.lidMs && lid + V.lidMs <= SR.flashMs(w.flash, 0, true));
  assert.match(show(SV, w.mini, null, 'O', { view: true }), /<i class="shxlid" aria-hidden="true">/, 'a finished square: the lid down, at rest');
});

test('Ship, Captain & Crew: five 3-D dice land one after the other; each die set aside flies from its own place in the tray to its place on the deck, in order, a bell each; the two left close up as the cargo', () => {
  const T = CR.SCC, m0 = E.newMini('scc', E.makeRng('c')), r = move('scc', m0, 'X', 'roll', one(5, 4, 6, 1, 1));
  assert.deepEqual([r.flash.scc.took, r.flash.scc.lv, r.flash.scc.cargo], [[2, 0, 1], 3, [1, 1]]);
  const tm = CR.sccTimes(r.flash.scc), html = show(CV, m0, r.flash, 'X'), at = k => tm.aside + k * T.take;
  assert.deepEqual([...html.matchAll(/class="d3 d3cube roll v(\d)" style="--dur:(\d+)ms"/g)].map(m => [Number(m[1]), Number(m[2])]), [0, 1, 2, 3, 0].map((v, j) => [v, T.land - (4 - j) * T.stag]), 'thrown together, landing one after the other, the last at SCC.land');
  assert.deepEqual(faces(html), [5, 4, 6, 1, 1]);
  // the ship (the 6, the third die), then the captain (the first), then the crew (the second): each leaves the tray as its flight starts and lands a `take` after the one before
  const go = [...html.matchAll(/<span class="sccd go" style="--tl:(\d+)ms;--tg:(\d+)ms" data-anchor="sccd:(\d)"/g)].map(m => [Number(m[3]), Number(m[2])]);
  assert.deepEqual(go, [[0, at(1) - T.fly], [1, at(2) - T.fly], [2, at(0) - T.fly]]);
  const slots = [...html.matchAll(/<div class="sccslot (\w+) on fresh" style="--k:(\d);--t:(\d+)ms"[^>]*>.*?<span class="sccsd" data-cf="sccd:(\d)" data-cfat="(\d+)" data-cfd="(\d+)">(.*?)<\/span>/g)].map(m => [m[1], Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]), pips(m[7])]);
  assert.deepEqual(slots, [['ship', at(0), 2, at(0) - T.fly, T.fly, 6], ['captain', at(1), 0, at(1) - T.fly, T.fly, 5], ['crew', at(2), 1, at(2) - T.fly, T.fly, 4]]);
  assert.ok(at(0) - T.fly >= T.land, 'the first leaves once the dice are down'); assert.equal(T.fly, CF.fly);
  assert.doesNotMatch(html, /sccslot \w+ next/, 'no place is marked as wanted while dice are on their way to the deck');
  // the two left close up about the middle and are ringed as the cargo; the crate turns and its number pops
  const rest = [...html.matchAll(/<span class="sccd gather crg late" style="--tl:\d+ms;--dx:(-?[\d.]+);--ta:(\d+)ms;--tc:(\d+)ms"/g)].map(m => [Number(m[1]), Number(m[2]), Number(m[3])]);
  assert.deepEqual(rest, [[-1.5, tm.cargo - T.shown, tm.cargo], [-1.5, tm.cargo - T.shown, tm.cargo]]);
  assert.match(html, new RegExp(`<span class="scccrate full in" style="--tc:${tm.cargo}ms" data-anchor="scccrate" role="img" aria-label="Cargo: 2"><b class=" pop" style="--t:${tm.cargo}ms">2</b>`));
  assert.match(html, new RegExp(`class="arcres ok appear" style="--t:${tm.cargo}ms" role="status">Ship, captain and crew!<`));
  assert.equal((html.match(/<span class="sccrl"[^>]*>.*?<\/span>/)[0].match(/<i class="on">/g) || []).length, 2, 'a roll spent: two pips left');
  const snd = sounds(CV, r.flash);
  assert.deepEqual(snd.filter(s => s[0] === 'shipBell'), [['shipBell', at(0), CV.SCC_BELL[0]], ['shipBell', at(1), CV.SCC_BELL[1]], ['shipBell', at(2), CV.SCC_BELL[2]]]);
  assert.ok(CV.SCC_BELL[0] < CV.SCC_BELL[1] && CV.SCC_BELL[1] < CV.SCC_BELL[2]);
  assert.deepEqual([snd[0].slice(0, 2), snd.find(s => s[0] === 'thunk').slice(0, 2), snd.at(-1).slice(0, 2)], [['rattle', 0], ['thunk', T.land], ['point', tm.cargo]]);
  assert.ok(snd.every(s => s[1] <= CR.flashMs(r.flash, 0, false)));
  // at rest after it: the cargo in the middle, its crate, Reroll and what Keep scores; nothing rolled yet: five blank dice and the ship wanted
  state.lock = 0;
  const idle = show(CV, r.mini, null, 'X');
  assert.deepEqual(faces(idle), [1, 1]); assert.doesNotMatch(idle, / roll v|gather|late|data-cf=/); assert.match(idle, />Reroll<\/button>/); assert.match(idle, />Keep <b>2<\/b><\/button>/);
  assert.equal(CV.heldSub(r.mini, 'X', null), '<b class="X">Xena</b>: turn in progress');
  state.lock = null;
  const fresh = show(CV, m0, null, 'X');
  assert.deepEqual(faces(fresh), [null, null, null, null, null]); assert.match(fresh, /<div class="sccslot ship next"/); assert.match(fresh, /<div class="scctray idle"/); assert.match(fresh, />Roll<\/button>/);
});

test('Ship, Captain & Crew: a reroll shows the new cargo as its dice land; Keep sends the cargo from the crate to the tally, which counts on as it arrives; a turn that ends short is plainly worth nothing', () => {
  const T = CR.SCC, m0 = E.newMini('scc', E.makeRng('c2')); m0.score = { X: 5, O: 9 };
  const a = move('scc', m0, 'O', 'roll', one(6, 5, 4, 2, 3)), b = move('scc', a.mini, 'O', 'roll', one(6, 4)), tb = CR.sccTimes(b.flash.scc);
  const hb = show(CV, a.mini, b.flash, 'O');
  assert.deepEqual(faces(hb), [6, 4]); assert.doesNotMatch(hb, /sccd go|gather|fresh/);
  assert.match(hb, new RegExp(`<span class="scccrate full" data-anchor="scccrate"[^>]*><b class=" pop" style="--t:${T.land}ms">10</b>`), 'the new cargo, from the move, as its dice land');
  assert.match(hb, /role="status">New cargo: 10</); assert.equal(tb.end, T.land + T.hold);
  // Keep: the chip leaves the crate at `score`, is in the tally at `count`; the bar grows and the number counts on from then
  const k = move('scc', b.mini, 'O', 'keep', one(1)), tk = CR.sccTimes(k.flash.scc), hk = show(CV, k.mini, k.flash, 'X');
  assert.deepEqual([tk.score, tk.count], [0, T.fly]);
  assert.match(hk, new RegExp(`<b class="sccplus" data-cf="scccrate" data-cfat="0" data-cfgo="" data-cfd="${T.fly}" aria-hidden="true">\\+10</b>`));
  const oTal = hk.split('<div class="ctal O')[1].split('</div>')[0];
  assert.match(oTal, new RegExp(`<b class="grow" style="width:${(19 / 22 * 100).toFixed(1)}%;--w0:${(9 / 22 * 100).toFixed(1)}%;--t:${tk.count}ms">`)); assert.match(oTal, new RegExp(`<b class="cnt" data-from="9" data-delay="${tk.count}" data-ms="${T.score - 100}">19</b> / 22`));
  assert.doesNotMatch(hk.split('<div class="ctal O')[0], /sccplus|grow|cnt/, 'the other tally is left alone');
  assert.match(hk, /<span class="scccrate full spent late" style="--ts:0ms"/); assert.match(hk, new RegExp(`class="arcres ok appear" style="--t:${tk.count}ms" role="status"><b class="O">Olaf</b> scored 10!<`));
  assert.deepEqual(sounds(CV, k.flash).map(s => s.slice(0, 2)), [['ding', tk.count]]); assert.ok(tk.count + T.score <= CR.flashMs(k.flash, 0, false));
  assert.match(hk, /disabled>Reroll<\/button>/); assert.match(hk, /disabled>Keep <b>10<\/b><\/button>/);
  // the move made here, still on show once it has played: as it ended, nothing moving
  const held = show(CV, k.mini, null, 'X', { done: k.flash });
  assert.deepEqual(faces(held), [6, 4]); assert.match(held, /<span class="scccrate full spent" data-anchor/); assert.doesNotMatch(held, /sccplus|late|grow|cnt/); assert.match(held, /role="status"><b class="O">Olaf<\/b> scored 10!</);
  // the last roll with the ship alone: the dice dull, the empty places marked, a struck 0 in the crate, a thud
  const s0 = clone(m0); s0.turn = { by: 'X', n: 2, lv: 1, dice: [2, 3, 1, 1], cargo: null };
  const s = move('scc', s0, 'X', 'roll', one(3, 4, 6, 1)), ts = CR.sccTimes(s.flash.scc), hs = show(CV, s.mini, s.flash, 'X');
  assert.deepEqual([s.flash.scc.end, s.flash.scc.pts, s.flash.scc.lv], [true, 0, 1]); assert.equal(ts.count, ts.score);
  assert.equal((hs.match(/<span class="sccd dull late" style="--tl:\d+ms;--tz:\d+ms"/g) || []).length, 4);
  assert.match(hs, new RegExp(`<div class="sccslot captain miss late" style="--k:1;--t:${ts.score}ms"`)); assert.match(hs, new RegExp(`<div class="sccslot crew miss late" style="--k:2;--t:${ts.score}ms"`)); assert.match(hs, /<div class="sccslot ship on" style="--k:0"/);
  assert.match(hs, new RegExp(`<span class="scccrate zero in" style="--tc:${ts.score}ms"[^>]*aria-label="Cargo: 0"><b class=" pop" style="--t:${ts.score}ms">0</b>`));
  assert.match(hs, new RegExp(`class="arcres no appear" style="--t:${ts.score}ms" role="status">No captain: nothing scored<`));
  assert.deepEqual(sounds(CV, s.flash).at(-1).slice(0, 2), ['thud', ts.score]); assert.doesNotMatch(hs, /sccplus|grow/);
  assert.equal((hs.match(/<span class="sccrl"[^>]*>.*?<\/span>/)[0].match(/<i class="on">/g) || []).length, 0);
  // a keep that takes the square: the three hop once the points are in, inside the move
  const w0 = clone(m0); w0.score = { X: 14, O: 9 }; w0.turn = { by: 'X', n: 1, lv: 3, dice: [6, 6], cargo: [6, 6] };
  const w = move('scc', w0, 'X', 'keep', one(1)), tw = CR.sccTimes(w.flash.scc), hw = show(CV, w.mini, w.flash, 'X');
  assert.equal(w.res.outcome, 'win'); assert.match(hw, new RegExp(`<div class="sccdeck cheer" style="--tw:${tw.count + T.score - 150}ms">`)); assert.ok(tw.count + T.score - 150 + 180 + 500 <= CR.flashMs(w.flash, 0, true));
  assert.doesNotMatch(hw, /Won by|stamp/);
});
