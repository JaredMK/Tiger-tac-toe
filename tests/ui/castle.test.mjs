// Castle Smash's view (games/castle/view.js), rendered in Node with the browser's names stubbed: the screen's fixed
// rows (tallies, the scene's canvas, the result line reserved from the start), the miniature (both castles as they
// stand, a picture, no text), a recorded block's pose between its frames, and the shot's sounds, each once from the
// simulation's events (someone else's shot first draws the catapult back; this phone's own is ahead by that pull).
// The camera's intro: the wide shot of the whole battlefield, held, then eased into the shooter's aiming view; once a
// turn on this phone's own turn; at the start of someone else's shot (its sounds and its count after it); never on this
// phone's own shot. (The stubbed page reads as reduced motion: CSV.intro forces the intro on or off.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));
const { state } = await import('../../src/ui/app.js');
const V = await import('../../src/games/castle/view.js');
const R = await import('../../src/games/castle/rules.js');
const { SFX } = await import('../../src/audio/sound.js');
const { RESULT_SOUNDS, BAD_SOUNDS } = await import('../../src/ui/haptics.js');

const match = (cpu) => { const st = E.newMatch(E.makeRng('cs-ui'), { games: ['castle'] }); Object.assign(state, st, { screen: 'mini', zoom: 4, online: null, cpu: cpu || null, sc: null, flash: null, done: null }); state.turn = 'X'; return state.squares[4]; };
const draw = (sq, a) => V.screen(sq, a || null, null, sq.mini, false, false, a || null, null, false, null, false, state.turn, {});

test('Castle Smash: the screen: two tallies, the scene\'s canvas (live on the mover\'s turn), the result line reserved; no help text in it', () => {
  const sq = match();
  const html = draw(sq);
  assert.match(html, /^<div class="g-cs pc-X"><div class="ctals">/); assert.equal((html.match(/class="ctal /g) || []).length, 2);
  assert.match(html, /<div class="csfield live"><canvas class="cscv"/); assert.match(html, /<p class="csline"><\/p>/);
  assert.ok(!/drag|tap|swipe/i.test(html.replace(/aria-label="[^"]*"/g, '')), 'no instructions inside the game');
  assert.match(html, /aria-label="0 shots"/);
  // a shot on show: the canvas no longer takes a drag, the line says what came of it, the thrower's count turns over
  const m = sq.mini, shot = R.castleAimAt(R.castleCore(m.c.O)[1] / 10, 70, 0.8, R.castleCfg(m).vMax);
  assert.ok(E.playMove(state, 4, shot, E.makeRng('s')).ok);
  const f = state.flash, h2 = draw(state.squares[4], f);
  assert.ok(!/csfield live/.test(h2)); assert.match(h2, /<p class="csline (ok|no) appear" style="--t:\d+ms" role="status">[A-Z][^<]+<\/p>/);
  assert.match(h2, /<i class="was" style="--t:\d+ms"><span>0<\/span><small>shots<\/small><\/i><i class="now" style="--t:\d+ms"><span>1<\/span><small>shot<\/small><\/i>/);
  assert.match(V.moveText(f, 'Sam'), /^Sam/); assert.equal(typeof V.replay.synth, 'function'); assert.deepEqual(V.replay.synth(f), []); assert.equal(V.ownLine, true);
});

test('Castle Smash: the miniature: both castles block for block, a crystal in each, a drawn mark by each, no text', () => {
  const sq = match(), m = sq.mini, html = V.miniature(m, false);
  assert.match(html, /^<div class="tcs" aria-label="Castle Smash: X's castle \d+ blocks, O's castle \d+ blocks"><svg /);
  assert.equal((html.match(/<rect /g) || []).length, m.c.X.length + m.c.O.length - 2); assert.equal((html.match(/class="tcsg"/g) || []).length, 2);
  assert.equal((html.match(/class="ttok [XO]"/g) || []).length, 2); assert.ok(!/<text|undefined|NaN/.test(html));
  m.c.O = m.c.O.filter(b => b[0] !== R.K.core); m.c.X[0] = [m.c.X[0][0], m.c.X[0][1] + 40, m.c.X[0][2], 700];
  const after = V.miniature(m, true);
  assert.equal((after.match(/class="tcsg"/g) || []).length, 1, 'a smashed crystal is gone'); assert.match(after, /rotate\(-40\)/, 'a toppled block lies as it fell (X\'s castle is drawn turned round)');
});

test('Castle Smash: a recorded block between its frames, and gone at its going', () => {
  const w = [0, 4000, 800, 0], d = { tr: new Map([[1, { f0: 10, v: [800, 160, 0, 820, 150, 50], gone: 13 }]]) };
  assert.deepEqual(V.poseAt(d, w, 0, 5), [400, 80, 0], 'no track: where it lies');
  assert.deepEqual(V.poseAt(d, w, 1, 3), [400, 80, 0], 'before its first frame: where it lay');
  assert.deepEqual(V.poseAt(d, w, 1, 10.5), [405, 77.5, 0.5]); assert.deepEqual(V.poseAt(d, w, 1, 12), [410, 75, 1]); assert.equal(V.poseAt(d, w, 1, 13), null);
});

test('Castle Smash: the sounds: each from an event of the simulation, once; someone else\'s shot starts with the rope and the fling', () => {
  for (const n of ['csPull', 'csFling', 'csWhoosh', 'csKnock', 'csWood', 'csThump', 'csCrack', 'csBreak', 'csCrumble', 'csOff', 'csSmash', 'csDud']) assert.ok(SFX[n], n);
  assert.ok(RESULT_SOUNDS.has('csSmash') && RESULT_SOUNDS.has('csBreak') && BAD_SOUNDS.has('csDud'));
  const sq = match('O'); state.turn = 'O';
  const m = sq.mini, shot = R.castleAimAt(R.castleCore(m.c.X)[1] / 10, 30, 0.45, R.castleCfg(m).vMax);
  assert.ok(E.playMove(state, 4, shot, E.makeRng('s')).ok);
  const f = state.flash, ph = f.phys, got = []; V.sounds(f, (n, ms, rate) => got.push([n, Math.round(ms), rate]), false, m, null);
  const lead = R.CST.pull + R.CST.swing, step = 1000 / R.CS.hz;
  assert.deepEqual(got.slice(0, 3).map(x => x[0]), ['csPull', 'csFling', 'csWhoosh']); assert.deepEqual([got[0][1], got[1][1]], [0, R.CST.pull]);
  const hits = ph.ev.filter(e => e.k === 'hit' && e.v >= R.CS.knock);
  assert.ok(hits.length, 'the boulder struck something'); assert.ok(got.some(x => ['csKnock', 'csWood', 'csThump'].includes(x[0]) && x[1] === Math.round(lead + hits[0].t * step)), 'its first knock at its moment');
  for (const [k, n] of [['crack', 'csCrack'], ['core', 'csSmash'], ['off', 'csOff']]) assert.equal(got.filter(x => x[0] === n).length, ph.ev.filter(e => e.k === k).length, n);
  assert.equal(got.filter(x => x[0] === 'csBreak' || x[0] === 'csCrumble').length, ph.ev.filter(e => e.k === 'break').length);
  assert.ok(got.every(x => x[1] >= 0 && x[1] <= E.playMs(f)), 'all inside the move');
  // this phone's own shot: no rope, no fling (heard as it let go), everything earlier by the pull it never shows
  state.cpu = 'O'; state.turn = 'X'; const sq2 = state.squares[4];
  assert.ok(E.playMove(Object.assign(state, { flash: null, done: null }), 4, R.castleAimAt(R.castleCore(sq2.mini.c.O)[1] / 10, 30, 0.45, R.castleCfg(m).vMax), E.makeRng('t')).ok);
  const own = []; V.sounds(state.flash, (n, ms) => own.push([n, Math.round(ms)]), false, sq2.mini, null);
  assert.ok(!own.some(x => x[0] === 'csPull' || x[0] === 'csFling')); const h0 = state.flash.phys.ev.find(e => e.k === 'hit' && e.v >= R.CS.knock);
  assert.ok(own.some(x => x[1] === Math.round(R.CST.swing + h0.t * step)), 'its knock a swing after the fling');
});

test('Castle Smash: the camera: the wide shot frames the whole battlefield; the intro holds it, then eases into the shooter\'s aiming view', () => {
  const PRE = R.CST.wide + R.CST.zoom;
  const inView = (v, a, b) => v.l <= a + 1e-9 && v.l + v.w >= b - 1e-9;
  const catX = [R.CS.cat - 44, R.CS.cat + 22], catO = [R.CS.w - catX[1], R.CS.w - catX[0]];   // (each catapult: its frame, its arm at rest with the boulder ringed in the spoon)
  const castleX = [R.CS.w - R.CS.foot[1], R.CS.w - R.CS.foot[0]], castleO = R.CS.foot.slice(), poles = [R.CS.w - R.CS.foot[1] - 6, R.CS.foot[1] + 6];
  for (const [W, H] of [[340, 300], [360, 420], [375, 520], [415, 640], [430, 380], [400, 120]]) {
    const wide = V.wideView(W, H), gy = Math.round(H - Math.max(22, H * V.CSV.ground));
    for (const [a, b] of [castleX, castleO, catX, catO, poles]) assert.ok(inView(wide, a, b), `the wide shot at ${W}x${H} holds ${a}..${b}`);
    assert.ok(118 * W / wide.w <= gy, `the banners' tops fit the height at ${W}x${H}`);
    assert.ok(V.camZooms(W, H), `a phone's canvas zooms (${W}x${H})`);
    for (const by of ['X', 'O']) {
      const aim = V.aimView(by, W), [cat, castle] = by === 'X' ? [catX, castleO] : [catO, castleX];
      assert.ok(inView(aim, cat[0], cat[1]) && inView(aim, castle[0], castle[1]), 'the aiming view: the shooter\'s catapult and the castle it throws at');
      assert.deepEqual(V.introView(by, W, H, 0), wide); assert.deepEqual(V.introView(by, W, H, R.CST.wide - 1), wide, 'the wide shot held');
      assert.deepEqual(V.introView(by, W, H, PRE), aim); assert.deepEqual(V.introView(by, W, H, PRE + 900), aim, 'then the aiming view, exactly');
      const edge = v => (by === 'X' ? v.l + v.w : v.l), shared = Math.abs(edge(wide) - edge(aim)) < 1e-6;   // (the target's side of the canvas: the same edge on a phone; a short canvas's wide shot is centred, a little wider)
      let prev = wide;
      for (let t = R.CST.wide; t <= PRE; t += 16) {
        const v = V.introView(by, W, H, t);
        assert.ok(v.w <= prev.w + 1e-9 && v.w >= aim.w - 1e-9, 'it only ever zooms in, and no further than the aim');
        if (shared) assert.ok(Math.abs(edge(v) - edge(aim)) < 1e-6, 'the castle thrown at keeps to its edge');
        else assert.ok((edge(v) - edge(prev)) * (edge(aim) - edge(wide)) >= -1e-9, 'the target\'s edge moves one way only');
        assert.ok(inView(v, cat[0], cat[1]) && inView(v, castle[0], castle[1]), 'the shooter and its castle in view all the way');
        prev = v;
      }
      if (H > 200) assert.ok(shared, `a phone's wide shot shares the target's edge with the aim (${W}x${H})`);
      const mid = V.introView(by, W, H, R.CST.wide + R.CST.zoom / 2);
      assert.ok(mid.w < wide.w - 1 && mid.w > aim.w + 1, 'halfway: on its way');
    }
  }
  assert.ok(!V.camZooms(600, 500) && !V.camZooms(560, 640), 'a canvas as wide as the scene aims with all of it in view: no intro');
  for (const [x, y] of [[0, 0], [0.1, 0.025863], [0.25, 0.236587], [0.5, 0.775561], [0.75, 0.959368], [0.9, 0.994354], [1, 1]]) assert.ok(Math.abs(V.easeStd(x) - y) < 2e-5, `cubic-bezier(.4, 0, .2, 1) at ${x}`);
  assert.equal(V.easeStd(-1), 0); assert.equal(V.easeStd(NaN), 0); assert.equal(V.easeStd(3), 1);
  assert.deepEqual(V.viewAt({ l: 0, w: 100 }, { l: 50, w: 100 }, 0.5), { l: 25, w: 100 }, 'the same width: the edge simply slides');
});

test('Castle Smash: someone else\'s shot opens on the intro (its sounds and its count after it), this phone\'s own skips it, and without the intro the pull comes at once', () => {
  const PRE = R.CST.wide + R.CST.zoom, step = 1000 / R.CS.hz, was = V.CSV.intro;
  const otherShot = (mini, seed) => R.castleAimAt(R.castleCore(mini.c.X)[1] / 10, 30, 0.45, R.castleCfg(mini).vMax) || R.randomMove(mini, 'O', E.makeRng(seed));
  try {
    V.CSV.intro = true;
    const sq = match('O'); state.turn = 'O';
    assert.ok(E.playMove(state, 4, otherShot(sq.mini, 'a'), E.makeRng('s')).ok);
    const f = state.flash, ph = f.phys, got = []; V.sounds(f, (n, ms, rate) => got.push([n, Math.round(ms), rate]), false, sq.mini, null);
    assert.deepEqual(got.slice(0, 2).map(x => [x[0], x[1]]), [['csPull', PRE], ['csFling', PRE + R.CST.pull]], 'the rope and the fling after the intro');
    const h0 = ph.ev.find(e => e.k === 'hit' && e.v >= R.CS.knock);
    assert.ok(h0 && got.some(x => x[1] === Math.round(PRE + R.CST.pull + R.CST.swing + h0.t * step)), 'its first knock after the intro, the pull and the swing');
    assert.ok(E.playMs(f) >= PRE + R.CST.pull + R.CST.swing + ph.ms && got.every(x => x[1] >= 0 && x[1] <= E.playMs(f)), 'the intro is in the move\'s length, every sound inside it');
    const html = draw(state.squares[4], f), t0 = PRE + R.CST.pull + R.CST.swing;
    assert.match(html, new RegExp(`<i class="was" style="--t:${t0}ms">`), 'the count turns over as the boulder leaves, after the intro');
    assert.match(html, /<p class="csline (ok|no) appear" style="--t:(\d+)ms"/); assert.ok(Number(html.match(/csline (?:ok|no) appear" style="--t:(\d+)ms"/)[1]) >= t0, 'the words once it has landed');
    // this phone's own shot: no intro, no rope, no fling, its knock a swing after the fling
    state.turn = 'X'; Object.assign(state, { flash: null, done: null });
    const sq2 = state.squares[4];
    assert.ok(E.playMove(state, 4, R.castleAimAt(R.castleCore(sq2.mini.c.O)[1] / 10, 30, 0.45, R.castleCfg(sq2.mini).vMax) || R.randomMove(sq2.mini, 'X', E.makeRng('b')), E.makeRng('t')).ok);
    const own = []; V.sounds(state.flash, (n, ms) => own.push([n, Math.round(ms)]), false, sq2.mini, null);
    const k0 = state.flash.phys.ev.find(e => e.k === 'hit' && e.v >= R.CS.knock);
    assert.ok(!own.some(x => x[0] === 'csPull' || x[0] === 'csFling'));
    if (k0) assert.ok(own.some(x => x[1] === Math.round(R.CST.swing + k0.t * step)), 'its knock a swing after the fling, as before');
    assert.match(draw(state.squares[4], state.flash), new RegExp(`<i class="was" style="--t:${R.CST.swing}ms">`), 'its count turns over a swing after the fling');
    // without the intro (reduced motion, a canvas that sees the whole scene as it aims): someone else's pull at once
    V.CSV.intro = false; state.turn = 'O'; Object.assign(state, { flash: null, done: null });
    assert.ok(E.playMove(state, 4, otherShot(state.squares[4].mini, 'c'), E.makeRng('u')).ok);
    const off = []; V.sounds(state.flash, (n, ms) => off.push([n, Math.round(ms)]), false, state.squares[4].mini, null);
    assert.deepEqual(off.slice(0, 2), [['csPull', 0], ['csFling', R.CST.pull]], 'no intro: the rope at once');
  } finally { V.CSV.intro = was; }
});

test('Castle Smash: this phone\'s turn has its intro once: the same through redraws, none on the computer\'s turn, a new one at its next shot', () => {
  const sq = match('O'); state.turn = 'X';
  draw(sq); const r = V.introNow();
  assert.ok(r && r.t0 == null && !r.cut, 'this phone\'s turn: an intro, its clock to start once the square is in place');
  draw(sq); assert.equal(V.introNow(), r, 'a redraw: the same intro, never started again');
  r.t0 = 1; draw(sq); assert.equal(V.introNow().t0, 1);
  state.turn = 'O'; draw(sq); assert.equal(V.introNow(), null, 'the computer\'s turn: none of this phone\'s');
  state.turn = 'X'; draw(sq); assert.equal(V.introNow(), r, 'the square opened again the same turn: the same one, its clock as it was');
  state.turn = 'O';
  assert.ok(E.playMove(state, 4, R.randomMove(sq.mini, 'O', E.makeRng('q')), E.makeRng('q2')).ok);
  Object.assign(state, { flash: null, done: null }); state.turn = 'X';
  draw(state.squares[4]); const r2 = V.introNow();
  assert.ok(r2 && r2 !== r && r2.key !== r.key && r2.t0 == null, 'the next turn: an intro of its own');
});
