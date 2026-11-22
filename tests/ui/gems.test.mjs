// Gem Swap's screen (ui: games/gems/view.js), rendered in Node with the browser's names stubbed: a move plays as layers
// from its flash alone (the swap, each step's bursts, falls and new gems, the board at the end), its moments from
// gemsTimes; the mover's points count on step by step; the gems are buttons only on this phone's turn; the miniature
// is the board itself.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1.7e12 });
Object.defineProperty(globalThis, 'performance', { value: { now: () => Date.now() - 1.7e12 + 1e5 }, configurable: true, writable: true });
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const R = await import('../../src/games/gems/rules.js');
const V = await import('../../src/games/gems/view.js');
const { state } = await import('../../src/ui/app.js');
const { SND } = await import('../../src/audio/sound.js');
const C = await import('../../src/net/connect.js');
const Rm = await import('../../src/net/room.js');
const heard = []; SND.play = (name, o) => { heard.push(name); return o; };

const count = (html, re) => (html.match(re) || []).length;
// A square after a move with a cascade of at least `steps` steps (and, asked for, a shuffle): { mini, before, flash }.
function played(steps, sh, size) {
  E.setTune('gems', size ? { size, target: 80 } : { target: 80 });
  try {
    for (let g = 0; g < 4000; g++) {
      const rng = E.makeRng(`ui:${steps}:${g}`), mini = E.newMini('gems', rng), before = JSON.parse(JSON.stringify(mini));
      const r = E.applyMove(mini, 'X', E.randomLegalMove(mini, 'X', rng), rng);
      if (r.ok && mini.last.steps.length >= steps && !!mini.last.sh === !!sh) { const flash = { by: 'X', type: 'gems' }; R.moveFlash(null, 'X', null, null, mini, flash); return { mini, before, flash }; }
    }
  } finally { E.setTune('gems', null); }
  throw new Error('no such move found');
}
const draw = (mini, o = {}) => { Object.assign(state, { screen: 'mini', zoom: 4, flash: o.a || null, done: null, online: null, cpu: null }); return V.screen(4, o.a || null, o.d || null, mini, !!o.view, !!o.locked, o.a || null, !!o.a, false, null, false, o.turn || 'X'); };

test('Gem Swap: on this phone\'s turn every gem is a button of its own act; locked or in a review none is; nothing of the draft is ever a move', () => {
  const mini = E.newMini('gems', E.makeRng('v1')), mine = draw(mini), locked = draw(mini, { locked: true }), view = draw(mini, { view: true });
  assert.equal(count(mine, /<button class="gsc[^"]*" data-act="gems-cell" data-i="\d+"/g), 49); assert.ok(mine.includes('gsgrid live'));
  assert.equal(count(locked, /<button/g), 0); assert.equal(count(view, /<button/g), 0); assert.ok(!locked.includes('gsgrid live'));
  assert.equal(count(mine, /class="gsg"/g), 49); assert.equal(count(mine, /<symbol id="gsk\d"/g), 6);
  assert.ok(!mine.includes('data-act="move"') && !/undefined|NaN|\[object/.test(mine));
  assert.deepEqual(V.replay.synth(), []); assert.equal(V.ownLine, true);
  assert.equal(count(mine, /aria-label="[a-z ]+ gem, row \d, column \d"/g), 49, 'each gem named by its shape and colour');
});

test('Gem Swap: a move plays from its flash alone: a layer for the swap, one a step and the board at the end, each in its own time', () => {
  const { mini, before, flash } = played(3), s = flash.gs, T = R.gemsTimes(s), K = s.steps.length;
  for (const m of [mini, before]) {                                  // (drawn the same over the square as it is now and as it was: an online replay runs on the square before)
    const html = draw(m, { a: flash, locked: true });
    assert.equal(count(html, /<div class="gsl[ "]/g), K + 2); assert.equal(count(html, /<button/g), 0);
    assert.equal(count(html, /class="gsc swap"/g), 2);
    const layers = html.split('<div class="gsl').slice(1);
    assert.ok(layers[0].startsWith('" style="--f:0ms;--u:' + R.GEMS.swap + 'ms"'));
    s.steps.forEach((st, k) => {
      const l = layers[k + 1], end = k + 1 < K ? T.steps[k + 1].pop : T.casc;
      assert.ok(l.startsWith(`" style="--f:${T.steps[k].pop}ms;--u:${end}ms"`), `step ${k + 1} on show from its burst to the next`);
      assert.equal(count(l, /class="gsc pop"/g), st.x.length, 'a burst a gem removed'); assert.equal(count(l, /class="gsc drop"/g), st.x.length, 'a new gem for each');
      assert.equal(count(l, new RegExp(`--t:${T.steps[k].pop}ms`, 'g')), st.x.length); assert.ok(count(l, new RegExp(`--t:${T.steps[k].fall}ms`, 'g')) >= st.x.length);
      assert.equal(count(l, /class="gsc[ "]/g), 49 + st.x.length);
    });
    const fin = layers[K + 1]; assert.ok(fin.startsWith(` fin" style="--f:${T.casc}ms"`));
    const kinds = [...fin.matchAll(/href="#gsk(\d)"/g)].map(x => x[1]).join(''); assert.equal(kinds, mini.b, 'the last layer is the board the move left');
    // the points count on burst by burst, the line says each step's total
    let acc = 0; const tot = s.steps.map(st => (acc += st.x.length));
    assert.deepEqual([...html.matchAll(/<b class="gsv[^"]*" style="[^"]*">(\d+)<\/b>/g)].map(x => +x[1]), [0, ...tot]);
    assert.deepEqual([...html.matchAll(/<span class="gsw[^"]*" style="[^"]*">\+(\d+)/g)].map(x => +x[1]), tot);
    assert.ok(html.includes(`+${tot[1]} Combo!`) && html.includes(`+${tot[2]} Combo x3!`)); assert.ok(html.includes(`pc-X`));
    assert.ok(!/undefined|NaN|\[object/.test(html));
  }
  assert.equal(R.flashMs(flash, 0, false), T.end + R.GEMS.hold);
});

test('Gem Swap: a shuffle swirls the board the cascade left out and the board laid out again in; the sounds follow the same moments', () => {
  const { mini, flash } = played(1, true, 5), s = flash.gs, T = R.gemsTimes(s), html = draw(mini, { a: flash, locked: true }), K = s.steps.length;
  assert.equal(count(html, /<div class="gsl[ "]/g), K + 3); assert.ok(html.includes(`gsl swirl" style="--f:${T.sh}ms;--u:${T.sh + R.GEMS.shuffle / 2}ms"`)); assert.ok(html.includes(`gsl fin unswirl" style="--f:${T.sh + R.GEMS.shuffle / 2}ms"`));
  const fin = html.split('gsl fin unswirl')[1]; assert.equal([...fin.matchAll(/href="#gsk(\d)"/g)].map(x => x[1]).join(''), s.sh); assert.equal(mini.b, s.sh);
  assert.ok(html.includes('Shuffle!'));
  const out = []; V.sounds(flash, (n, ms, rate) => out.push([n, ms, rate]));
  assert.deepEqual(out[0].slice(0, 2), ['gsSwap', 0]); assert.deepEqual(out.filter(x => x[0] === 'gsPop').map(x => x[1]), T.steps.map(t => t.pop)); assert.deepEqual(out[out.length - 1].slice(0, 2), ['gsShuffle', T.sh]);
  const { flash: big } = played(3), rates = []; V.sounds(big, (n, ms, rate) => { if (n === 'gsPop') rates.push(rate); });
  assert.ok(rates.every((r, k) => k === 0 || r > rates[k - 1]), 'each step of a cascade a note higher');
  assert.ok(Math.max(...out.map(x => x[1])) <= R.flashMs(flash, 0, false));
  assert.ok(/swapped for \d+/.test(V.moveText(flash, 'Sam')));
});

test('Gem Swap: the miniature is the board itself, a shape a gem, beside each player\'s bar; a tally never shows past the target', () => {
  const mini = E.newMini('gems', E.makeRng('v4')); mini.pts = { X: 40, O: 16 };
  const html = V.miniature(mini, false);
  assert.ok(html.includes('<svg class="tgs"') && html.includes('class="tart tgsw"')); assert.equal(count(html, /class="tgsk"/g), 49);
  assert.equal(count(html, /class="tr nbar [XO]"/g), 2); assert.ok(html.includes('--w:100.0%') && html.includes('--w:50.0%')); assert.ok(html.includes('X 32, O 16 of 32'));
  assert.ok(!/<text|undefined|NaN/.test(html), 'a picture: no figures in it');
  const scr = draw(mini, { view: true }); assert.ok(scr.includes('aria-label="32 of 32"') && scr.includes('<b>32</b><small>/32</small>'));
});

test('Gem Swap: a tap picks a gem, a tap on a neighbour swaps; a swap that makes no line is never sent; online the two gems only show pressed until the server answers', async () => {
  const sent = [];
  C.setFb({ fns: {}, uid: 'u-x', fnM: {}, db: {}, m: new Proxy({}, { get: () => () => Promise.resolve({ val: () => null }) }) });
  C.setConnected(true);
  let answer = null; C.setCall((name, data) => { sent.push([name, data]); return new Promise(res => { answer = res; }); });
  const rec = E.newOnlineMatch({ names: { X: 'Ann', O: 'Bo' }, games: { gems: true }, timer: 0 }, E.makeRng('gs-on'), 'm-gs');
  rec.state.turn = 'X';
  state.online = { kind: 'mm', game: 'g-gs', me: 'X', joined: true, matchId: 'm-gs', shownSeq: rec.state.seq, room: 'ABCDE', code: 'ABCDE', role: 'host', introFor: 'g-gs' };
  state.setup.names = { X: 'Ann', O: 'Bo' };
  const pub = { players: { X: { name: 'Ann' }, O: { name: 'Bo' } }, state: JSON.stringify(rec.state), timer: 0, mode: 'friend', status: 'playing' };
  Rm.setRoom({ kind: 'mm', status: 'playing', players: pub.players, match: { state: pub.state }, setup: { timer: 0 }, pub });
  Rm.takeFields(rec.state);
  Object.assign(state, { sc: null, cpu: null, flash: null, done: null, spot: null, winner: null, lock: null, screen: 'mini', zoom: 4, notice: null });
  Rm.setMoveWait(null);
  const mini = state.squares[4].mini, g = R.gemsArr(mini.b), n = mini.n, ok = R.gemsMoves(g, n)[0];
  let no = null; for (let i = 0; i < n * n - 1 && !no; i++) if (i % n < n - 1 && !R.gemsValid(g, n, i, i + 1)) no = [i, i + 1];
  const tap = i => V.actions['gems-cell']({ dataset: { i: String(i) } });
  const shown = () => V.screen(4, null, null, state.squares[4].mini, false, Rm.blocked(), null, false, false, null, false, 'X');
  // a pick: its own sound, the gem ringed; the same gem again puts it down
  tap(no[0]); assert.deepEqual(heard, ['gsPick']); assert.equal(count(shown(), /class="gsc pick"/g), 1); assert.ok(shown().includes(`class="gsc pick" data-act="gems-cell" data-i="${no[0]}"`));
  tap(no[0]); assert.equal(count(shown(), /class="gsc pick"/g), 0);
  // a neighbour that makes no line: the soft no, nothing sent, nothing picked
  heard.length = 0; tap(no[0]); tap(no[1]);
  assert.deepEqual(heard, ['gsPick', 'gsNo']); assert.equal(sent.length, 0); assert.equal(count(shown(), /class="gsc pick/g), 0); assert.equal(state.flash, null);
  // a gem far from the picked one moves the pick there
  tap(no[0]); tap(n * n - 1); assert.ok(shown().includes(`class="gsc pick" data-act="gems-cell" data-i="${n * n - 1}"`)); tap(n * n - 1);
  // a swap that makes a line goes to the server as { a, b }; until it answers the two gems show pressed, nothing else moves
  heard.length = 0; tap(ok[0]); tap(ok[1]);
  assert.deepEqual(sent.map(x => [x[0], x[1].square, x[1].move]), [['move', 4, { a: ok[0], b: ok[1] }]]);
  assert.ok(Rm.moveWait); assert.equal(state.flash, null); assert.equal(state.squares[4].mini.b, mini.b, 'the board waits for the server\'s gems');
  const wait = shown();
  assert.equal(count(wait, /class="gsc pick pend"/g), 2); assert.ok(wait.includes(`class="gsc pick pend" data-i="${ok[0]}"`) && wait.includes(`class="gsc pick pend" data-i="${ok[1]}"`)); assert.equal(count(wait, /<button/g), 0);
  assert.ok(!heard.includes('gsSwap') && !heard.includes('error'));
  answer({ ok: true }); await Promise.resolve(); await Promise.resolve();
  Rm.setMoveWait(null); state.online = null;
});
