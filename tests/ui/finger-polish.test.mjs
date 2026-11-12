// Sky Hop's and Scoop Stack's polish in Node, the browser's names stubbed: the square keeps its one control (Start: the
// same label, act and place in the markup) and says nothing inside the game; each miniature is a picture of the game
// with both players' progress in it (its own classes, no type in the drawing); someone else's attempt replays to its
// very last step (the one that ended it: the fall, the burr, the nasty catch are shown as the player saw them) and
// notes for the scene what each step did, the same however the replay's frames fall; its sounds come from its inputs
// alone (a bounce's spring over the feet's pat, a catch's note rising through the attempt), never for an attempt this
// phone made; the scenes draw an attempt under way, every end as it plays and at rest, without a slip.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const plain = stub();                                               // (a window whose reduced-motion query says no: otherwise no replay plays)
Object.defineProperty(globalThis, 'window', { value: new Proxy(function () {}, { get: (t, k) => (k === 'matchMedia' ? () => ({ matches: false, addEventListener() {}, addListener() {} }) : plain[k]), apply: () => stub(), construct: () => stub(), set: () => true }), configurable: true, writable: true });
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const { GAMES, TYPES } = await import('../../src/games/index.js');
for (const t of TYPES) GAMES[t].view = await import(`../../src/games/${t}/view.js`);
const { state } = await import('../../src/ui/app.js');
const F = await import('../../src/ui/finger.js');
const GAMES2 = ['skyhop', 'scoop'];
const square = (t, seed) => {
  const rng = E.makeRng('fing-ui-' + t + (seed || '')), st = E.newMatch(rng, { games: [t], names: { X: 'Ann', O: 'Bo' } });
  Object.assign(state, st, { screen: 'mini', zoom: 0, online: null, cpu: null, sc: null, flash: null, done: null, winner: null });
  state.setup.names = { X: 'Ann', O: 'Bo' };
  const sq = state.squares[0]; sq.mini = E.newMini(t, rng); sq.owner = null; state.turn = 'X';
  return sq;
};
const screen = (sq, f, view) => GAMES[sq.mini.type].view.screen(sq, f || null, null, sq.mini, !!view, !!f || !!view, f || null, null, () => false, () => -1, false, state.turn, '');
const ai = (mini, rng) => (mini.type === 'skyhop' ? E.hopAi(mini, 'X', rng) : E.scoopAi(mini, 'X', rng)).move;
// Someone else's attempt, as ui/finger.js builds it for a replay (fingReplayOf).
const repOf = (mini, m) => { const raw = Math.round(m.steps * E.FING.step * 1000); return { type: mini.type, p: 'X', mini0: JSON.parse(JSON.stringify(mini)), log: E.fingUnlog(m.log, m.steps, 500), steps: m.steps, ms: raw, speed: 1, raw }; };

test('Sky Hop, Scoop Stack: the square keeps its one control (Start, last in the square, under the scene) and no words inside the game', () => {
  for (const t of GAMES2) {
    const sq = square(t), html = screen(sq);
    assert.match(html, /<div class="cbtns one"><button class="big X" data-act="fing-start">Start<\/button><\/div><\/div>$/, `${t}: Start, as it was`);
    assert.equal((html.match(/<button/g) || []).length, 1, `${t}: one button`);
    assert.match(html, new RegExp(`<div class="fscene ${t}" data-fing="scene"[^>]*><canvas data-fing="cv"></canvas><div class="rhud fhud" data-fing="hud">[^<]+</div></div>`), `${t}: the scene and its counter`);
    assert.match(html, /<p class="atwords fwords"><span><\/span><\/p>/, `${t}: the reserved line empty before an attempt (how to play is in the ? alone)`);
    assert.doesNotMatch(html, /fhint|Tap Start|Drag to/, `${t}: no help text`);
  }
});
test('Sky Hop: the miniature is the shaft with each hopper at its height, drawn marks, no type', () => {
  const sq = square('skyhop'), V = GAMES.skyhop.view, T = sq.mini.cfg.target;
  const fresh = V.miniature(sq.mini, false);
  assert.match(fresh, /^<div class="thop" aria-label="X at 0, O at 0 of \d+"><svg viewBox="0 0 100 62"/);
  assert.equal((fresh.match(/class="hhop [XO]"/g) || []).length, 2); assert.equal((fresh.match(/class="tmk"/g) || []).length, 2, 'both marks, drawn');
  assert.match(fresh, /class="hhop X" transform="translate\(32 55\.0\)"/); assert.match(fresh, /class="hhop O" transform="translate\(68 55\.0\)"/);
  assert.doesNotMatch(fresh, /<text|class="(wall|plank|cloud|goal|back|sq|big|bar|frame)[ "]/, 'no type, no interface class');
  sq.mini.height = { X: T / 2, O: T };
  const mid = V.miniature(sq.mini, false);
  assert.match(mid, /class="hhop X" transform="translate\(32 34\.0\)"/, 'X half way up'); assert.match(mid, /class="hhop O" transform="translate\(68 13\.0\)"/, 'O at the bunting');
  assert.match(mid, /class="hcol X" d="M32 58V34\.0"/, 'X\'s column: the climb so far');
  assert.doesNotMatch(mid, /undefined|NaN/);
});
test('Scoop Stack: the miniature is each cone with its stack as tall as its share of the target, the counts under it', () => {
  const sq = square('scoop'), V = GAMES.scoop.view, T = sq.mini.cfg.target;
  const fresh = V.miniature(sq.mini, false);
  assert.match(fresh, /^<div class="tscoop" aria-label="X at 0, O at 0 of \d+"><svg viewBox="0 -5 100 67"/);
  assert.equal((fresh.match(/class="cone"/g) || []).length, 2); assert.match(fresh, /class="slv X"/); assert.match(fresh, /class="slv O"/);
  assert.doesNotMatch(fresh, /class="so"|<text/, 'no stack yet, no type in the drawing');
  assert.match(fresh, /<div class="tswn" aria-hidden="true"><span class="X">0<\/span><span class="O">0<\/span><\/div>/);
  sq.mini.stack = { X: Array.from({ length: T }, (_, i) => i % 5), O: [3] };
  const full = V.miniature(sq.mini, false), tops = [...full.matchAll(/class="so" d="M[\d.]+ 40V([\d.]+)a/g)].map(m => +m[1]);
  assert.equal(tops.length, 2, 'an outline round each stack');
  assert.match(full, /class="sgoal" d="M6 1h88"/); assert.ok(Math.abs(tops[0] - 6.6 - 1) < 0.2, `X's full stack reaches the target's line (its dome's top at ${(tops[0] - 6.6).toFixed(1)})`);
  assert.ok(tops[1] > 34, 'O\'s one scoop sits on its cone');
  assert.match(full, new RegExp(`<span class="X">${T}</span><span class="O">1</span>`));
  assert.doesNotMatch(full, /undefined|NaN|class="(back|sq|big|bar|frame)[ "]/);
});
test('someone else\'s attempt replays to its last step, the one that ended it, and notes what each step did the same however the frames fall', () => {
  for (const t of GAMES2) {
    let seen = 0;
    for (let k = 0; k < 8; k++) {
      const sq = square(t, k), m = ai(sq.mini, E.makeRng(`rp${k}`));
      const whole = repOf(sq.mini, m), v = F.fingRepView(whole, whole.raw / 1000);
      assert.equal(v.sim.n, m.steps, `${t} ${k}: every step played (${m.steps * E.FING.step * 1000} ms of attempt kept as ${whole.raw})`);
      assert.equal(v.sim.end || 'out', m.end, `${t} ${k}: its end shown`);
      if (m.end !== 'out') { assert.equal(v.end, m.end); assert.ok(v.endAt != null); }
      const parts = repOf(sq.mini, m); let pv = null;
      for (let ms = 0; ms < parts.raw; ms += 37) pv = F.fingRepView(parts, ms / 1000);
      pv = F.fingRepView(parts, parts.raw / 1000);
      assert.deepEqual(pv.ev, v.ev, `${t} ${k}: the same notes in pieces as at once`); assert.deepEqual(pv.out, v.out); assert.deepEqual(pv.brk, v.brk);
      if (t === 'skyhop') { assert.ok(v.ev.length > 0 && v.ev.every(e => ['base', 'bounce', 'break'].includes(e.k) && e.t > 0 && e.t <= v.sim.t), 'each bounce noted with its moment'); assert.deepEqual(v.rival, { p: 'O', h: 0 }); }
      else {
        const caught = Object.values(v.out).filter(o => o.o === 'catch');
        assert.deepEqual(caught.map(o => o.n), caught.map((_, i) => i), 'each catch knows its place in the stack');
        const lost = Object.values(v.out).filter(o => o.gone != null).length;
        assert.ok(v.sim.miss <= lost, 'every miss counted is a scoop that left the screen'); assert.ok(v.ev.every(e => e.k === 'gone' && e.m >= 1));
        seen += lost;
      }
    }
    if (t === 'scoop') assert.ok(seen > 0, 'some scoop was missed in eight attempts');
  }
});
test('the sounds of an attempt: someone else\'s from its inputs (a pat under every spring, a catch\'s note rising), this phone\'s own: the result alone', () => {
  for (const t of GAMES2) {
    const sq = square(t), m = ai(sq.mini, E.makeRng('snd')), res = E.playMove(state, 0, m, E.makeRng('p'));
    assert.equal(res.ok, true); const f = state.flash, V = GAMES[t].view;
    const own = []; state.cpu = null; V.sounds(f, (n, ms, r) => own.push([n, ms, r]), false, sq.mini, null);
    assert.equal(own.length, 1, `${t}: an attempt this phone made: its result's sound alone`); assert.ok(['ding', 'thud'].includes(own[0][0]));
    const theirs = []; state.cpu = 'X'; V.sounds(f, (n, ms, r) => theirs.push([n, ms, r]), false, sq.mini, null);
    const again = []; V.sounds(f, (n, ms, r) => again.push([n, ms, r]), false, sq.mini, null); state.cpu = null;
    assert.deepEqual(again, theirs, `${t}: the same every time (from the inputs alone)`);
    const names = theirs.map(s => s[0]), count = n => names.filter(x => x === n).length, drive = Math.round(m.steps * E.FING.step * 1000);
    assert.equal(names[0], 'go'); assert.ok(['ding', 'thud'].includes(names[names.length - 1]));
    for (const [n, ms] of theirs.slice(1, -1)) assert.ok(ms >= 0 && ms <= drive + 1, `${t}: ${n} at ${ms} inside the attempt (${drive})`);
    if (t === 'skyhop') { assert.ok(count('spring') > 0); assert.equal(count('runLand'), count('spring'), 'the feet\'s pat under every spring'); }
    else {
      const notes = theirs.filter(s => s[0] === 'scoop').map(s => s[2]);
      assert.equal(notes.length, m.n - f.fing.from, 'a note for every scoop caught');
      notes.forEach((r, i) => assert.equal(r, F.scoopNote(i + 1)));
      assert.ok(F.scoopNote(1) < F.scoopNote(2) && F.scoopNote(12) === F.scoopNote(40) && F.scoopNote(12) < 1.5, 'rising a little with each catch, to a ceiling');
    }
  }
});
test('the scenes draw the clean start, an attempt under way, every end as it plays and at rest', () => {
  const D = { skyhop: GAMES.skyhop.view.drawHop, scoop: GAMES.scoop.view.drawScoop }, ENDS = { skyhop: ['hazard', 'fall', 'time', 'top'], scoop: ['hazard', 'miss', 'time', 'top'] };
  for (const t of GAMES2) for (const [W, H] of [[330, 276], [360, 480]]) {
    const sq = square(t), c = stub(), m = ai(sq.mini, E.makeRng('draw')), rep = repOf(sq.mini, m);
    const still = t === 'skyhop' ? { type: t, p: 'X', sim: E.hopStart(sq.mini, 'X'), out: {}, brk: {}, rival: { p: 'O', h: 12 }, still: true } : { type: t, p: 'O', sim: E.scoopStart(sq.mini, 'O'), out: {}, brk: {}, stack: [0, 1, 2], still: true };
    assert.doesNotThrow(() => D[t](c, W, H, still, 1000), `${t}: the clean start`);
    let now = 1000, v = null;
    for (let ms = 0; ms <= rep.raw; ms += 50) { v = F.fingRepView(rep, ms / 1000); now += 50; assert.doesNotThrow(() => D[t](c, W, H, v, now), `${t}: a frame ${ms} ms in`); }
    v = F.fingRepView(rep, rep.raw / 1000);
    for (const end of ENDS[t]) for (const dt of [0, 120, 400, 900, 5000]) assert.doesNotThrow(() => D[t](c, W, H, Object.assign({}, v, { end, endAt: now }), now + dt), `${t}: ${end}, ${dt} ms in`);
  }
});
