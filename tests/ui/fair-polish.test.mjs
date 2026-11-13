// Claw Machine, Hook-a-Duck and Coin Pusher (the November 2026 polish, round 2). Claw Machine: the machine as a picture
// (cabinet, case, prize door, a shelf of prizes won for each player), a prize won rattling down the chute, out of the
// door and onto its winner's shelf (the pip fills as it lands there), a slipped one falling back, the claw's sounds.
// Hook-a-Duck: the tub with its rim, the hook down its line from the rod's tip, the duck lifted, turned over and its
// catch flying to the row of catches (ui/cardfly.js); never a value of a duck still swimming in the page. Coin Pusher:
// coins with weight (dropping from the dropper, tipping into the tray, lying there), the total counting on coin by
// coin. The controls are what they were: Drop (and a tap on the case), a tap on a duck, taps on the machine; the
// moves, the machines' sums and their timings untouched. Rendered in Node with the browser's names stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
globalThis.window = new Proxy(stub(), { get: (t, k) => (k === 'matchMedia' ? () => ({ matches: false }) : stub()) });   // (motion on: the views draw their moves)
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const claw = await import('../../src/games/claw/view.js');
const duck = await import('../../src/games/duck/view.js');
const pusher = await import('../../src/games/pusher/view.js');
const CR = await import('../../src/games/claw/rules.js');
const DR = await import('../../src/games/duck/rules.js');
const PR = await import('../../src/games/pusher/rules.js');
const H = await import('../../src/ui/haptics.js');
const { SFX } = await import('../../src/audio/sound.js');
const { state } = await import('../../src/ui/app.js');
const MD = fs.readFileSync(new URL('../../SOUNDS.md', import.meta.url), 'utf8');

const at = (...v) => { let k = 0; return () => v[Math.min(k++, v.length - 1)]; };   // a rng giving these numbers in turn
const seat = () => Object.assign(state, E.newMatch(E.makeRng('fair'), { games: ['claw'] }), { screen: 'mini', zoom: 0, online: null, cpu: null, sc: null, flash: null, turn: 'X' });
const draw = (view, mini, o = {}) => view.screen({ owner: o.owner || null, mini }, o.a || null, null, mini, !!o.view, !!o.locked, o.a || null, null, () => false, () => -1, !!o.fresh, o.turn || 'X', '');
const sounds = (view, f, mini) => { const out = []; view.sounds(f, (n, ms, rate) => out.push([n, Math.round(ms), rate]), f.kind === 'claim', mini, null); return out; };
const count = (html, re) => (html.match(re) || []).length;
const move = (mini, p, m, rng) => { const r = E.applyMove(mini, p, m, rng), f = { type: mini.type, kind: r.outcome === 'win' ? 'claim' : 'move', by: p, note: r.note, winner: r.winner }; E.rulesOf(mini.type).moveFlash(m, p, null, null, mini, f); return { r, f }; };
const listed = names => { for (const n of names) { assert.ok(SFX[n], `${n} is a sound`); assert.ok(MD.includes('`' + n + '`'), `${n} is listed in SOUNDS.md`); } };
const one = (k, x, id) => ({ id: id || 0, k, c: 0, x, w: CR.CLAW_KINDS[k].w });
const stepAt = (m, x) => { const c = CR.clawCfg(m), xs = CR.clawPath(c, m.ph, CR.CLAW.hz * 8); let b = 0; xs.forEach((v, k) => { if (Math.abs(v - x) < Math.abs(xs[b] - x)) b = k; }); return b; };

test('claw: the one control is Drop (and a tap on the case), as before', () => {
  seat();
  const mini = E.newMini('claw', E.makeRng('cl')), html = draw(claw, mini);
  assert.equal(count(html, /<button/g), 1);
  assert.match(html, /<button class="big X" data-act="claw-drop">Drop<\/button>/);
  assert.match(html, /<div class="claw live" data-claw="area"><canvas class="clawcv" data-claw="cv"/);
  const off = draw(claw, mini, { locked: true });
  assert.match(off, /<button class="big X" data-act="claw-drop" disabled/); assert.doesNotMatch(off, /class="claw live"/);
  assert.deepEqual(Object.keys(claw.actions), ['claw-drop']);
  assert.deepEqual(claw.replay.synth(), [], 'someone else\'s grab has no inputs to press: the sweep up to their tap is in the move');
});

test('claw: a move\'s moments in order; the word as the prize drops out of the door, the pip as it lands on the shelf', () => {
  seat();
  const grab = (res, p) => { const m = E.newMini('claw', E.makeRng('ct')); m.case = [one('blob', 60), one('ball', 85, 1)]; const k = stepAt(m, res === 'miss' ? 30 : 60); return Object.assign(move(m, p || 'X', { k }, res === 'win' ? at(0.01, 0.99, 0.5, 0.3) : res === 'slip' ? at(0.01, 0.01, 0.5, 0.3) : at(0.99, 0.5, 0.5, 0.3)), { m }); };
  for (const res of ['win', 'slip', 'miss']) {
    const { f, m } = grab(res), T = CR.clawTimes(f.claw, false), own = CR.clawTimes(f.claw, true);
    assert.equal(f.claw.res, res);
    assert.ok(T.pre > 0 && own.pre === 0, 'someone else\'s grab shows the sweep up to the tap first');
    assert.ok(T.down < T.closed && T.closed < T.up && T.up < T.top && T.top <= T.say && T.say < T.end, `${res}: in order`);
    if (res === 'win') assert.ok(T.atChute < T.tray && T.tray === T.say && T.tray < T.score && T.score < T.end);
    if (res === 'slip') assert.ok(T.top < T.slipAt && T.slipAt < T.say && T.say <= T.land && T.land < T.end);
    assert.equal(CR.flashMs(f, 0, false), T.end, 'the move\'s time is the rules\'');
    const html = draw(claw, m, { a: f, locked: true });
    assert.match(html, new RegExp(`class="arcres ${res === 'win' ? 'ok' : 'no'} appear" style="--t:${Math.round(own.say)}ms" role="status">${res === 'win' ? 'Got it!' : res === 'slip' ? 'Slipped!' : 'Missed'}<`));
    if (res === 'win') assert.match(html, new RegExp(`<i class="on fillin" style="--t:${Math.round(own.score)}ms"></i>`), 'the pip fills as the prize lands on its shelf');
    else assert.doesNotMatch(html, /fillin/);
  }
});

test('claw: the motor, the snap, the chute, the ding and the sparkle; a slip whistles down and thuds; the buzz at the result', () => {
  seat();
  const m = E.newMini('claw', E.makeRng('cs')); m.case = [one('blob', 60), one('ball', 85, 1)];
  const w = move(m, 'X', { k: stepAt(m, 60) }, at(0.01, 0.99, 0.5, 0.3)), T = CR.clawTimes(w.f.claw, true), sw = sounds(claw, w.f, m);
  assert.deepEqual(sw.map(s => s[0]), ['clawMotor', 'clawSnap', 'thunk', 'clawMotor', 'clawChute', 'ding', 'sparkle']);
  assert.deepEqual([sw[1][1], sw[5][1], sw[6][1]], [T.closed, T.tray, T.score].map(Math.round));
  assert.deepEqual(H.movePlan(w.f, sw).slice(-1)[0], ['medium', Math.round(T.score)]);
  const s = move(m, 'O', { k: stepAt(m, 85) }, at(0.01, 0.01, 0.5, 0.3)), Ts = CR.clawTimes(s.f.claw, true), ss = sounds(claw, s.f, m);
  assert.equal(s.f.claw.res, 'slip');
  assert.deepEqual(ss.slice(-2), [['clawSlip', Math.round(Ts.slipAt), undefined], ['thud', Math.round(Ts.land), undefined]]);
  const x = move(m, 'X', { k: stepAt(m, 30) }, at(0.99, 0.5, 0.5, 0.3));
  assert.equal(x.f.claw.res, 'miss'); assert.deepEqual(sounds(claw, x.f, m).map(v => v[0]), ['clawMotor', 'clawSnap', 'thud']);
  listed(['clawMotor', 'clawSnap', 'clawChute', 'clawSlip']);
  for (const n of ['clawMotor', 'clawSnap', 'clawChute', 'clawSlip']) assert.ok(SFX[n].level <= 0.6 && !H.RESULT_SOUNDS.has(n) && !H.BAD_SOUNDS.has(n), `${n}: the motion's sound, no buzz of its own`);
});

test('claw: the miniature is the machine with the prizes left and a pip for every prize of the goal', () => {
  const m = E.newMini('claw', E.makeRng('cm')); m.won.X = 2; m.won.O = 1;
  const html = claw.miniature(m, false);
  assert.match(html, /<svg class="tclaw"/); assert.equal(count(html, /class="tclawi on"/g), 3); assert.equal(count(html, /class="tclawi/g), 6);
  assert.equal(count(html.split('class="tclawz"')[1].split('</g>')[0], /<(rect|circle|ellipse|polygon) /g), m.case.length, 'every prize left is drawn');
  assert.doesNotMatch(html, /undefined|NaN/);
});

test('duck: a tap on a duck is the move, every duck still swimming a button of its slot; nothing of a value in the page', () => {
  seat();
  const mini = E.newMini('duck', E.makeRng('dk')), html = draw(duck, mini);
  assert.equal(count(html, /<button class="dukd"/g), 12);
  for (let i = 0; i < 12; i++) assert.match(html, new RegExp(`<button class="dukd" style="[^"]*" data-act="move" data-m='${i}' aria-label="Duck ${i + 1}">`));
  assert.equal(count(draw(duck, mini, { locked: true }), /<button/g), 0, 'not this phone\'s move: no duck to tap');
  assert.doesNotMatch(html, /dukv|dukboot|dukback/, 'no bottom is drawn for a duck in the water');
  const other = JSON.parse(JSON.stringify(mini)); other.vals = other.vals.slice().reverse();
  assert.equal(draw(duck, other), html, 'the pond is drawn the same whatever the ducks are worth');
  const hidden = JSON.parse(JSON.stringify(mini)); delete hidden.vals;
  assert.equal(draw(duck, hidden), html, 'and the same from the record the other phone has');
  assert.match(html, /class="g-duk pc-X"/); assert.match(draw(duck, mini, { turn: 'O', locked: true }), /class="g-duk pc-O"/);
});

test('duck: the hooked duck alone shows its bottom; its catch flies from it to the row and the total counts on at the reveal', () => {
  seat();
  const mini = E.newMini('duck', E.makeRng('dk2')), i = mini.vals.findIndex(v => v > 0), v = mini.vals[i];
  const { f } = move(mini, 'X', i, E.makeRng('r')), T = DR.duckTimes(f.duck), html = draw(duck, mini, { a: f, locked: true });
  assert.deepEqual([T.lift, T.show, T.end], [DR.DUKT.reach, DR.DUKT.reach + DR.DUKT.lift + DR.DUKT.flip, DR.DUKT.reach + DR.DUKT.lift + DR.DUKT.flip + DR.DUKT.hold], 'the move\'s moments are the rules\', unchanged');
  assert.equal(count(html, /<button/g), 0);
  assert.equal(count(html, /class="dukd hk"/g), 1); assert.equal(count(html, /class="dukback"/g), 1);
  assert.match(html, new RegExp(`<span class="dukback"><span class="dukv v${v}">${v}</span></span>`));
  assert.equal(count(html, /class="dukd"/g), 11, 'the others swim on');
  assert.match(html, /<span class="dukup" data-anchor="dukhk"><\/span>/);
  assert.match(html, new RegExp(`<i class="dukc X appear" style="--t:\\d+ms" data-cf="dukhk" data-cfat="(\\d+)">${v}</i>`));
  const land = Number(html.match(/data-cf="dukhk" data-cfat="(\d+)"/)[1]);
  assert.ok(land > T.show && land + 280 <= T.end, 'the catch leaves once the bottom has shown and lands inside the move');
  assert.match(html, new RegExp(`<b class="cnt" data-from="0" data-delay="${T.score}">${v}</b>`));
  assert.match(html, new RegExp(`class="dukres ok appear" style="--t:${T.show}ms"`));
  for (const u of mini.vals.filter((_, k) => k !== i && mini.left[k])) assert.doesNotMatch(html.replace(/dukback.*?<\/span><\/span>/, ''), new RegExp(`class="dukv v${u}"`), 'no other duck\'s value');
});

test('duck: the reel, the plop, the squeak, the splash, then a ding or the boot\'s flop; the buzz stays at the reveal through a refill', () => {
  seat();
  const mini = E.newMini('duck', E.makeRng('dk3')), pt = mini.vals.findIndex(v => v > 0 && v < 5), bt = mini.vals.indexOf(0);
  const a = move(mini, 'X', pt, E.makeRng('r')), T = DR.duckTimes(a.f.duck), sa = sounds(duck, a.f, mini);
  assert.deepEqual(sa.map(s => s[0]), ['dukReel', 'plop', 'dukSqueak', 'splash', 'ding']); assert.equal(sa[4][1], T.show);
  assert.deepEqual(H.movePlan(a.f, sa).slice(-1)[0], ['medium', T.show]);
  const b = move(mini, 'O', bt, E.makeRng('r')), sb = sounds(duck, b.f, mini);
  assert.deepEqual(sb.slice(-1)[0].slice(0, 2), ['dukBoot', T.show]); assert.ok(H.RESULT_SOUNDS.has('dukBoot'));
  // the last duck of a pond: the refill's sounds come after the reveal and carry no buzz
  let last = null; for (let k = 0; k < 12; k++) if (mini.left[k]) last = move(mini, k % 2 ? 'O' : 'X', k, E.makeRng('r' + k));
  assert.equal(last.f.duck.refill, true);
  const sr = sounds(duck, last.f, mini), Tr = DR.duckTimes(last.f.duck), plan = H.movePlan(last.f, sr);
  assert.ok(sr.filter(s => s[1] > Tr.show + 200).every(s => s[0] === 'dukSqueak'));
  assert.ok(plan.filter(p => p[0] === 'medium').every(p => p[1] <= Tr.show + 100), 'the result\'s buzz is the reveal\'s');
  const html = draw(duck, mini, { a: last.f, locked: true });
  assert.equal(count(html, /class="dukd dnew"/g), 12, 'the new pond floats in'); assert.doesNotMatch(html.replace(/dukback.*?<\/span><\/span>/, ''), /dukv/);
  listed(['dukReel', 'dukSqueak', 'dukBoot']);
});

test('pusher: taps on the machine are the move: a canvas, no button; the picture\'s moments are its own, the machine\'s untouched', () => {
  seat();
  const mini = E.newMini('pusher', E.makeRng('ps')), html = draw(pusher, mini);
  assert.match(html, /<div class="psh live"><canvas class="pshcv"/); assert.equal(count(html, /<button/g), 0);
  assert.doesNotMatch(draw(pusher, mini, { locked: true }), /class="psh live"/);
  assert.deepEqual(PR.PUSH, { slots: 9, Q: 10000, hz: 60, r: 0.05, back: 0.16, gut: 0.84, iters: 6, hold: 500, still: 2e-5, pace: 1.6 });
  assert.equal(PR.pushCapSteps(PR.pushCfg(mini)), 480, 'the settle: at most 4 strokes of 2 s (it stops once settled)');
  assert.ok(pusher.PSHT.drop < 250 && pusher.PSHT.fall + pusher.PSHT.bounce <= PR.PUSH.hold, 'a coin over the edge at the very end still lands before the result\'s hold is over');
});

test('pusher: the machine runs faster than real time, its settle at the page\'s pace (Speed), and stands still between turns', async () => {
  const T = await import('../../src/core/timer.js'), c = PR.pushCfg(E.newMini('pusher', E.makeRng('pace')));
  try {
    T.setAnimMode('normal');
    assert.equal(pusher.pushLiveRate(c, 'play'), 60 * 1.6, 'the machine at 1.6x real time while coins drop');
    assert.equal(pusher.pushLiveRate(c, 'settle'), 60 * 1.6, 'Normal: the settle at the same pace');
    T.setAnimMode('speed');
    assert.equal(pusher.pushLiveRate(c, 'play'), 60 * 1.6, 'Speed: the taps keep real time (the game)');
    assert.ok(pusher.pushLiveRate(c, 'settle') >= 2 * 60 * 1.6, 'Speed: the settle twice as fast');
  } finally { T.setAnimMode('normal'); }
  const m = E.newMini('pusher', E.makeRng('pz')); E.applyMove(m, 'X', { ph: 0, dp: 0, k: [0, 30] }, E.makeRng('z'));
  assert.equal(pusher.restPh(m), m.ph, 'idle, the bar is drawn where the last move left it (frozen: nothing falls between turns)');
});

test('pusher: someone else\'s move sounds from its events (a clink and a tick a coin, the tray\'s clink, a star\'s chime) and their total counts on from where it was', () => {
  seat(); state.cpu = 'O';
  E.setTune('pusher', { start: 40 }); const mini = E.newMini('pusher', E.makeRng('ps2')); E.setTune('pusher', null);   // (a fuller shelf: a push spills coins)
  mini.moves = { X: 1, O: 1 }; mini.turns = { X: 1, O: 1 }; mini.coins.forEach((q, i) => { q[1] = Math.min(9900, q[1] + 700); if (q[1] > 8800 && i % 2 === 0) q[2] = 1; if (i % 4 === 1) q[3] = 1; });   // (the shared shelf about to spill, star coins at the front, some of them X's)
  const { f } = move(mini, 'O', { ph: 100, dp: 300, k: [0, 30, 70] }, E.makeRng('r')), g = f.push;
  assert.ok(g.scored > 1 && g.pts + g.opp > g.scored, 'coins over the edge, a star coin among them');
  assert.ok(pusher.pushPre(f) > 0);
  const rp = PR.pushReplay(PR.pushCfg(mini), g), ss = sounds(pusher, f, mini);
  const drops = rp.events.filter(e => e.kind === 'drop'), offs = rp.events.filter(e => e.kind === 'off');
  assert.deepEqual(ss.filter(s => s[0] === 'clink').map(s => s[1]), drops.map(e => e.t));
  assert.deepEqual(ss.filter(s => s[0] === 'pshDrop').map(s => s[1]), drops.map(e => e.t + pusher.PSHT.drop));
  assert.deepEqual(ss.filter(s => s[0] === 'pshTray' || s[0] === 'pshStar').map(s => [s[0], s[1]]), offs.slice(0, 6).map(e => [e.st ? 'pshStar' : 'pshTray', e.t + pusher.PSHT.fall]));
  assert.deepEqual(ss.slice(-1)[0].slice(0, 2), ['ding', g.ms]);
  const html = draw(pusher, mini, { a: f, locked: true, turn: 'O' });
  assert.match(html, new RegExp(`<b data-psh="sc-O">${g.before}</b>`), 'the mover\'s total starts where it was and counts on as coins land (the canvas\'s frames)');
  assert.match(html, new RegExp(`<b data-psh="sc-X">${g.ob}</b>`), 'the other player\'s too: their own coins go over on anyone\'s move');
  assert.match(html, new RegExp(`class="arcres ok appear" style="--t:${g.ms}ms" role="status">\\+${g.pts}`));
  const mine = move(mini, 'X', { ph: 100, dp: 300, k: [0, 30, 70] }, E.makeRng('r'));
  assert.equal(pusher.pushPre(mine.f), 0); assert.deepEqual(sounds(pusher, mine.f, mini), [], 'a move made here had its sounds live');
  listed(['pshDrop', 'pshTray', 'pshStar', 'pshGone']);
});

test('pusher: the miniature shows the one machine, each coin in its owner\'s colour (the machine\'s own pale, star coins blue), both players\' points beside it', () => {
  const mini = E.newMini('pusher', E.makeRng('pm')); mini.score.X = 6; mini.score.O = 12;
  mini.coins[0][3] = 1; mini.coins[1][3] = 2;
  const html = pusher.miniature(mini, false), stars = mini.coins.filter(q => q[2]).length;
  assert.equal(count(html, /<circle class="[nXO] st"/g), stars); assert.equal(count(html, /<circle/g), mini.coins.length, 'every coin');
  assert.equal(count(html, /<circle class="X/g), 1); assert.equal(count(html, /<circle class="O/g), 1);
  assert.match(html, /<span class="tsn">6<\/span>.*<span class="tsn">12<\/span>/);
});
