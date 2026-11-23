// Door Drop's screen (games/doors/view.js), rendered in Node with the browser's names stubbed: the tower's canvas,
// the door buttons for the mover's floor (every door from v 3; never the boarded ones of a square from before; never while a move plays), no memory aids (v 3: a floor drawn as dealt after tries), the result line at its
// moment, the tallies (a map of each player's tower in the race, pips on a shared tower), the miniature (a picture with
// each player's floors, public alone), the move's sounds each at its moment, the runner's pose through a move, the
// doors' designs, and the camera: the wide shot of the whole tower(s), the intro (held, then eased into the mover's
// floor), someone else's move opening on it inside its own time, this phone's own move and a pick that goes on from a
// way down without it, this phone's turn's intro once a turn. (The stubbed page reads as reduced motion: DOORSV.intro
// forces the intro on or off.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : k === 'matchMedia' ? () => ({ matches: false }) : k === 'getItem' ? () => null : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const { state } = await import('../../src/ui/app.js');
const { renderMini } = await import('../../src/ui/mini.js');
const { GAMES } = await import('../../src/games/index.js');
const { moveSounds, SFX } = await import('../../src/audio/sound.js');
const { RESULT_SOUNDS, BAD_SOUNDS } = await import('../../src/ui/haptics.js');
const { startFx } = await import('../../src/ui/fx.js');
const V = await import('../../src/games/doors/view.js');
const R = await import('../../src/games/doors/rules.js');
GAMES.doors.view = V;
const D = R.DOORS, PRE = R.doorsPre(), tD = R.doorsIn() + D.dark;

function match(tune = null, turn = 'X') {
  E.setTune('doors', tune);
  Object.assign(state, E.newMatch(E.makeRng('dd-ui'), { games: ['doors'], vs: 'cpu' }), { screen: 'mini', zoom: 4, cpu: 'O', sc: null, flash: null, done: null, spot: null, winner: null, online: null, turn, lock: null });
  state.setup.vs = 'cpu'; state.setup.human = 'X'; state.setup.names = { X: 'Xena', O: 'Computer' };
  return state.squares[4].mini;
}
const game = html => html.slice(html.indexOf('class="g-dd'));
const wrong = (m, r) => (m.good[r] + 1) % m.d[r];
const dd = f => moveSounds(f).filter(x => /^dd/.test(x[0])).map(x => [x[0], x[1]]);

test('Door Drop: the screen: a canvas, a door button for each door of the mover\'s floor still worth trying, an empty result line', () => {
  const m = match();
  let g = game(renderMini(state.squares[4]));
  assert.ok(g.includes('<canvas class="ddcv"'));
  assert.equal((g.match(/class="ddgo X"/g) || []).length, m.d[0]);
  assert.ok(g.includes('<p class="ddline"></p>'));
  assert.equal((g.match(/class="ddmap sm"/g) || []).length, 2, 'the race: a map of each tower in the tallies');
  assert.ok(!/undefined|NaN/.test(g));
  m.tried.X[0][wrong(m, 0)] = 1;
  g = game(renderMini(state.squares[4]));
  assert.equal((g.match(/class="ddgo X"/g) || []).length, m.d[0], 'no memory aids (v 3): a door tried is a button like the rest');
  m.v = 2; g = game(renderMini(state.squares[4]));
  assert.equal((g.match(/class="ddgo X"/g) || []).length, m.d[0] - 1, 'a square from before: a boarded-up door is no button');
  assert.ok(!g.includes(`data-m="${wrong(m, 0)}"`)); m.v = 3;
  state.turn = 'O';
  assert.ok(!game(renderMini(state.squares[4])).includes('ddgo'), 'the computer\'s turn: no buttons');
  match({ towers: 'shared' });
  g = game(renderMini(state.squares[4]));
  assert.ok(!g.includes('ddmap') && g.includes('class="pips"'), 'a shared tower: pips');
  assert.deepEqual(V.replay.synth(), [], 'a move is played from its flash: no door is pressed first');
  E.setTune('doors', null);
});

test('Door Drop: this phone\'s own move: a dead end and a way down: no buttons while it plays, the line at its moment, the sounds each once, no intro', () => {
  let m = match();
  assert.ok(E.playMove(state, 4, wrong(m, 0), E.makeRng('w')).ok);
  let f = state.flash; startFx('move', f);
  let g = game(renderMini(state.squares[4]));
  assert.ok(!g.includes('ddgo'), 'no buttons while the move plays');
  assert.ok(g.includes(`<p class="ddline no appear" style="--t:${Math.round(R.doorsSayAt(f.dd))}ms" role="status">Dead end!</p>`), 'the words as the runner lands, the walk begun at once');
  assert.equal(E.playMs(f), PRE + R.doorsDeadMs(), 'the move\'s length counts the intro (someone else\'s move opens on it)');
  assert.deepEqual(dd(f), [['ddStep', 30], ['ddStep', Math.round(30 + (D.walk - 60) / 3)], ['ddStep', Math.round(30 + 2 * (D.walk - 60) / 3)], ['ddCreak', D.walk], ['ddStep', Math.round(D.walk + D.open + D.step * 0.4)], ['ddDark', R.doorsIn()],
    ['ddBang', tD], ['ddTumble', Math.round(tD + D.out * 0.6)], ['ddBonk', Math.round(tD + D.out + D.pop * 0.74)]], 'no planks nailed on (v 3: nothing marked)');
  m = match();
  assert.ok(E.playMove(state, 4, m.good[0], E.makeRng('g')).ok);
  f = state.flash; startFx('move', f);
  g = game(renderMini(state.squares[4]));
  assert.ok(g.includes(`<p class="ddline ok appear" style="--t:${R.doorsSayAt(f.dd)}ms" role="status">Down a floor!</p>`));
  assert.equal(R.doorsSayAt(f.dd), tD + D.beat + D.drop, 'as the runner lands a floor down');
  assert.equal(E.playMs(f), PRE + R.doorsDownMs());
  assert.deepEqual(dd(f).slice(-5), [['ddAha', tD], ['ddHatch', tD + D.beat], ['ddFall', Math.round(tD + D.beat + D.drop * 0.14)], ['ddLand', tD + D.beat + D.drop], ['ddRise', tD + D.beat + D.drop + 60]]);
  for (const k of ['ddStep', 'ddCreak', 'ddDark', 'ddBang', 'ddTumble', 'ddBonk', 'ddNail', 'ddAha', 'ddHatch', 'ddFall', 'ddLand', 'ddRise', 'ddHop']) assert.ok(SFX[k], k);
  assert.ok(RESULT_SOUNDS.has('ddLand') && BAD_SOUNDS.has('ddBonk'));
  E.setTune('doors', null);
});

test('Door Drop: someone else\'s move opens on the camera\'s intro (its sounds and its words after it); without the intro its walk comes at once; a pick going on from a way down has none', () => {
  const was = V.DOORSV.intro;
  try {
    V.DOORSV.intro = true;
    let m = match(null, 'O');
    assert.ok(E.playMove(state, 4, wrong(m, 0), E.makeRng('w')).ok);
    let f = state.flash; startFx('move', f);
    let g = game(renderMini(state.squares[4]));
    assert.ok(g.includes(`style="--t:${Math.round(PRE + R.doorsSayAt(f.dd))}ms" role="status">Dead end!</p>`), 'the words after the intro');
    let got = dd(f);
    assert.deepEqual(got[0], ['ddStep', PRE + 30], 'the first step after the intro'); assert.deepEqual(got[got.length - 1], ['ddBonk', Math.round(PRE + tD + D.out + D.pop * 0.74)]);
    assert.ok(got.every(x => x[1] >= PRE && x[1] <= E.playMs(f)), 'every sound after the intro, inside the move');
    V.DOORSV.intro = false;                                       // (reduced motion: no intro: the picture starts at the walk)
    m = match(null, 'O');
    assert.ok(E.playMove(state, 4, wrong(m, 0), E.makeRng('w')).ok);
    f = state.flash; startFx('move', f);
    assert.deepEqual(dd(f)[0], ['ddStep', 30]);
    assert.ok(game(renderMini(state.squares[4])).includes(`style="--t:${Math.round(R.doorsSayAt(f.dd))}ms" role="status">Dead end!</p>`));
    // Go again on success: the computer's second pick of a turn has no intro in it at all
    V.DOORSV.intro = true;
    m = match({ again: 'on' }, 'O');
    assert.ok(E.playMove(state, 4, m.good[0], E.makeRng('g')).ok); E.endFlash(state);
    assert.equal(state.turn, 'O'); assert.ok(R.doorsCont(m, 'O') && !R.doorsCont(m, 'X'));
    assert.ok(E.playMove(state, 4, wrong(m, 1), E.makeRng('h')).ok);
    f = state.flash; startFx('move', f);
    assert.equal(f.dd.c, 1); assert.equal(E.playMs(f), R.doorsDeadMs(), 'no intro in its length');
    assert.deepEqual(dd(f)[0], ['ddStep', 30]);
  } finally { V.DOORSV.intro = was; E.setTune('doors', null); }
});

test('Door Drop: this phone\'s turn has its intro once: the same through redraws, none on the computer\'s turn or for a pick going on from a way down, a new one next turn', () => {
  const m = match(), draw = () => renderMini(state.squares[4]);
  draw(); const r = V.introNow();
  assert.ok(r && r.t0 == null && !r.cut, 'this phone\'s turn: an intro, its clock to start once the square is in place');
  draw(); assert.equal(V.introNow(), r, 'a redraw: the same intro, never started again');
  r.t0 = 1; draw(); assert.equal(V.introNow().t0, 1);
  state.turn = 'O'; draw(); assert.equal(V.introNow(), null, 'the computer\'s turn: none of this phone\'s');
  state.turn = 'X'; draw(); assert.equal(V.introNow(), r, 'the square opened again the same turn: the same one');
  assert.ok(E.playMove(state, 4, wrong(m, 0), E.makeRng('w')).ok); E.endFlash(state);
  state.turn = 'X'; state.screen = 'mini'; state.zoom = 4; Object.assign(state, { flash: null, done: null });
  draw(); const r2 = V.introNow();
  assert.ok(r2 && r2 !== r && r2.key !== r.key && r2.t0 == null, 'the next turn: an intro of its own');
  const n = match({ again: 'on' });
  assert.ok(E.playMove(state, 4, n.good[0], E.makeRng('g')).ok); E.endFlash(state);
  assert.equal(state.turn, 'X'); state.screen = 'mini'; state.zoom = 4;
  draw(); assert.equal(V.introNow(), null, 'Go again on: the next pick of the turn has no intro (the camera just follows down)');
  assert.ok(game(draw()).includes('class="ddgo X"'), 'its doors there to tap');
  E.setTune('doors', null);
});

test('Door Drop: the camera: the wide shot holds every tower whole; the intro holds it, then only zooms in, to the mover\'s floor exactly', () => {
  for (const tune of [null, { towers: 'shared' }, { floors: 8, doors: 6 }, { floors: 1 }]) {
    const m = match(tune), F = m.f, TV = V.DOORSV;
    for (const [W, H] of [[327, 380], [350, 385], [398, 640], [440, 560]]) {
      const wide = V.wideView(m, W, H), k = W / wide.w, X = x => (x - wide.cx) * k + W / 2, Y = y => (y - wide.cy) * k + H / 2;
      const right = (m.sep ? TV.tw + 2 * TV.wall + TV.gap : 0) + TV.tw + TV.wall;
      assert.ok(X(-TV.wall) >= 0 && X(right) <= W, 'every tower\'s walls in view'); assert.ok(Y(-TV.roof - TV.top) >= -0.5, 'the roof\'s pole'); assert.ok(Y((F + 1) * TV.fh) <= H + 0.5 && Y((F + 1) * TV.fh + TV.ground) <= H + 0.5, 'the ground');
      for (const p of ['X', 'O']) for (const fl of [0, F - 1, F]) {
        const close = V.closeView(m, p, fl, W, H), kc = W / close.w, vh = close.w * H / W;
        assert.equal(close.w, TV.view); assert.equal(close.cx, (m.sep && p === 'O' ? TV.tw + 2 * TV.wall + TV.gap : 0) + TV.tw / 2, 'on the mover\'s tower');
        if (vh >= TV.fh + 8 && vh < (F + 1) * TV.fh) { const feet = (fl + 1) * TV.fh - TV.slab, y = (feet - close.cy) * kc + H / 2; assert.ok(y > 0 && y <= H, 'the mover\'s floor in view'); }
        assert.deepEqual(V.introView(m, p, fl, W, H, 0), wide); assert.deepEqual(V.introView(m, p, fl, W, H, D.wide - 1), wide, 'the wide shot held');
        assert.deepEqual(V.introView(m, p, fl, W, H, PRE), close); assert.deepEqual(V.introView(m, p, fl, W, H, PRE + 500), close, 'then the mover\'s floor, exactly');
        if (!V.camZooms(m, W, H)) continue;
        let last = wide.w;
        for (let t = D.wide; t <= PRE; t += 20) { const v = V.introView(m, p, fl, W, H, t); assert.ok(v.w <= last + 1e-6 && v.w >= close.w - 1e-6, 'only ever zooming in'); last = v.w; }
      }
      assert.equal(V.camZooms(m, W, H), 1 - TV.view / wide.w > TV.minZoom);
    }
    assert.ok(F < 3 || V.camZooms(m, 350, 385), 'a phone: a tower of three floors or more zooms');
  }
  assert.equal(V.easeStd(0), 0); assert.equal(V.easeStd(1), 1); assert.ok(V.easeStd(0.25) < 0.25 && V.easeStd(0.75) > 0.75, 'the interface\'s easing');
  E.setTune('doors', null);
});

test('Door Drop: the ground floor wins: its line, its timings (the dance) and the won chime as the runner lands', () => {
  const m = match({ floors: 1 });
  assert.ok(E.playMove(state, 4, m.good[0], E.makeRng('g')).ok);
  const f = state.flash; startFx('move', f);
  assert.ok(f.kind === 'claim' || f.kind === 'match');
  const g = game(renderMini(state.squares[4]));
  assert.ok(g.includes('>Ground floor!</p>'));
  assert.equal(E.playMs(f), PRE + R.doorsDownMs() + D.win);
  assert.equal(V.wonAt(f, E.playMs(f)), R.doorsDownMs(), 'this phone\'s own: no intro before it');
  const names = dd(f).map(x => x[0]); assert.deepEqual(names.slice(-2), ['ddHop', 'ddHop'], 'the dance\'s hops');
  E.setTune('doors', null);
});

test('Door Drop: the runner\'s pose through a move: walks to the door, gone in the dark, out of the linked door and the door tried boarded, or a floor down through the trapdoor', () => {
  const s = { r: 0, i: 1, down: false, out: 3, from: 50, ix: 38, ox: 88 }, tP = tD + D.out, tB = tP + D.pop;
  let P = V.doorsPose(s, 0, 3); assert.deepEqual([P.x, P.y, P.al, P.face, P.open], [50, 1, 1, -1, 0], 'facing the way it goes');
  P = V.doorsPose(s, D.walk / 2, 3); assert.ok(P.x < 50 && P.x > 38 && P.walk > 0, 'on its way, stepping');
  P = V.doorsPose(s, D.walk, 3); assert.equal(P.x, 38);
  P = V.doorsPose(s, D.walk + D.open - 1, 3); assert.ok(P.open > 0.9, 'the door swung open');
  P = V.doorsPose(s, R.doorsIn() + D.dark / 2, 3); assert.equal(P.al, 0); assert.ok(P.dim > 0.9 && P.open < 0.5 && !P.mark, 'the dark: the door swung to, nothing known yet');
  P = V.doorsPose(s, tD + D.out / 2, 3); assert.ok(P.openOut > 0.4 && P.bang >= 0 && P.al === 0 && !P.mark, 'the linked door bursting open');
  P = V.doorsPose(s, tP + D.pop * 0.4, 3); assert.ok(P.x === 88 && P.al === 1 && P.air && P.lift > 5 && P.mark && P.board === 0, 'tumbling out of it');
  P = V.doorsPose(s, tB + D.board / 2, 3); assert.ok(P.board > 0 && P.board < 1 && !P.air, 'the planks going on');
  P = V.doorsPose(s, R.doorsDeadMs(), 3); assert.deepEqual([P.x, P.y, P.al, P.mark, P.board, P.lift, P.rot, P.dizzy, P.openOut, P.open, P.cf], [88, 1, 1, true, 1, 0, 0, 0, 0, 0, 0], 'out of the other door, on the same floor, the door tried boarded up');
  assert.deepEqual(V.doorsPose(s, 1e9, 3), P, 'and so it stays');
  const d = Object.assign({}, s, { down: true }), tF = tD + D.beat, tL = tF + D.drop;
  P = V.doorsPose(d, tD + D.beat / 2, 3); assert.ok(P.mark && P.glow > 0.9 && P.burst >= 0 && P.open > 0.9 && P.al === 1 && P.y === 1, 'the beat: the doorway lit, its burst');
  P = V.doorsPose(d, tF + D.drop / 2, 3); assert.ok(P.y > 1 && P.y < 2 && P.x === 38 && P.hatch >= 1 && P.air && P.cf > 0 && P.cf < 1, 'dropping through the trapdoor, the camera following');
  P = V.doorsPose(d, tL + D.land / 3, 3); assert.ok(P.y === 2 && P.sq > 0.5 && P.dust >= 0, 'the landing\'s squash and dust');
  P = V.doorsPose(d, R.doorsDownMs(), 3); assert.deepEqual([P.y, P.cf, P.sq, P.lift, P.hatch, P.arms, P.party, P.exit], [2, 1, 0, 0, 0, 0, -1, 0], 'a floor down');
  const w = Object.assign({}, d, { r: 2 });
  P = V.doorsPose(w, R.doorsDownMs() + D.win * 0.5, 3); assert.ok(P.party >= 0 && P.exit > 0.9 && P.arms === 1, 'on the ground: the way out open, the dance');
  P = V.doorsPose(w, R.doorsDownMs() + D.win, 3); assert.deepEqual([P.y, P.arms, P.exit, P.lift, P.rot, P.party], [4, 1, 1, 0, 0, -1], 'on the ground floor, arms up by the way out');
  for (let t = 0; t <= R.doorsDownMs() + D.win; t += 7) for (const q of [s, d, w]) { const p = V.doorsPose(q, t, 3); for (const k in p) assert.ok(typeof p[k] === 'boolean' || Number.isFinite(p[k]), `${k} at ${t}`); assert.ok(p.al >= 0 && p.al <= 1 && p.open >= -0.2 && p.open <= 1.2); }
});

test('Door Drop: the doors\' designs: every door of a floor its own, the same for both towers and every phone; never red or yellow', () => {
  for (const tune of [null, { doors: 6, floors: 8 }, { doors: 3 }, { doors: 5 }]) for (let g = 0; g < 30; g++) {
    E.setTune('doors', tune);
    const m = E.newMini('doors', E.makeRng('look' + g));
    for (let r = 0; r < m.f; r++) {
      const L = V.doorsLook(m, r);
      assert.equal(L.doors.length, m.d[r]); assert.equal(new Set(L.doors).size, m.d[r], 'all different');
      assert.ok(L.doors.every(n => Number.isInteger(n) && n >= 0 && n < V.DES.length));
      assert.deepEqual(V.doorsLook(E.publicMini(m), r), L, 'from what is public alone');
      assert.deepEqual(V.doorsLook(JSON.parse(JSON.stringify(m)), r), L);
    }
    if (m.f > 1) assert.notEqual(V.doorsLook(m, 0).room, V.doorsLook(m, 1).room, 'rooms one over the other papered apart');
  }
  assert.equal(V.DES.length, 6); assert.equal(new Set(V.DES.map(d => d.col)).size, 6); assert.equal(new Set(V.DES.map(d => d.em)).size, 6);
  for (const d of V.DES) { const [r, g, b] = [1, 3, 5].map(i => parseInt(d.col.slice(i, i + 2), 16)); assert.ok(!(r > 200 && g < 110 && b < 110), 'not red'); assert.ok(!(r > 200 && g > 170 && b < 110), 'not yellow'); }
  const old = { type: 'doors', v: 1, sep: true, f: 2, d: [2, 5], tried: { X: [[0, 0], [0, 0, 0, 0, 0]], O: [[0, 0], [0, 0, 0, 0, 0]] }, at: { X: 0, O: 0 }, pos: { X: 50, O: 50 }, last: null };
  assert.equal(new Set(V.doorsLook(old, 1).doors).size, 5, 'a square from before: drawn all the same');
  E.setTune('doors', null);
});

test('Door Drop: the miniature: a picture of the tower(s) with each player\'s floors; public alone', () => {
  const m = match();
  m.at.X = 1; m.tried.X[0][m.good[0]] = 2; m.tried.O[0][wrong(m, 0)] = 1;
  const h = V.miniature(m);
  assert.ok(h.includes('class="tart tddw"') && (h.match(/<svg class="ddmap/g) || []).length === 2);
  assert.ok(!/ddmd s[12]/.test(h), 'no memory aids: every door block the same');
  m.v = 2; const h2 = V.miniature(m); m.v = 3;
  assert.ok(h2.includes('ddmd s2') && h2.includes('ddmd s1'), 'a square from before keeps its marks');
  assert.equal((h.match(/class="tr X"[^>]*>.*?<\/div>/)[0].match(/ on/g) || []).length, 1);
  assert.ok(!/good|link|undefined|NaN/.test(h));
  E.setTune('doors', null);
});

test('Door Drop: no memory aids (v 3): after tries, a floor is drawn exactly as dealt: the same doors, maps and buttons as before, apart from the runner', () => {
  for (const tune of [null, { towers: 'shared' }]) {
    const m = match(tune), r0 = 0, before = [0, 1, 2].map(r => JSON.stringify(V.doorsRest(m, m.sep ? 'X' : 'S', r)));
    const strip = h => // (the runners' places and floors gone down apart)
       game(h).replace(/<g class="ttok[\s\S]*?<\/g>/g, '').replace(/<span class="pips"[\s\S]*?<\/span>/g, '').replace(/aria-label="[^"]*"/g, '').replace(/<b class="[^"]*">[^<]*<\/b>/g, '');
    const html0 = strip(renderMini(state.squares[4]));
    for (const p of ['X', 'O']) { const w = wrong(m, r0); E.applyMove(m, p, w, E.makeRng('t' + p)); E.applyMove(m, p, (w + 1) % 4 === m.good[r0] ? (w + 2) % 4 : (w + 1) % 4, E.makeRng('u' + p)); }
    E.applyMove(m, 'O', m.good[0], E.makeRng('down'));            // a way down found, a floor above the other runner
    state.turn = 'X'; Object.assign(state, { flash: null, done: null });
    assert.ok(m.tried[m.sep ? 'X' : 0] && JSON.stringify(m.tried).includes('1') && JSON.stringify(m.tried).includes('2'), 'the record keeps what was tried');
    for (const tw of m.sep ? ['X', 'O'] : ['S']) [0, 1, 2].forEach(r => { assert.equal(JSON.stringify(V.doorsRest(m, tw, r)), before[r], 'every door as dealt'); assert.ok(V.doorsRest(m, tw, r).every(d => d.st === 0 && d.open === 0)); });
    assert.equal(V.doorsLinksShown(m), false, 'no link arrows');
    for (const p of ['X', 'O']) [0, 1, 2].forEach(r => assert.deepEqual(V.doorsMapMarks(m, p, r), [0, 0, 0, 0]));
    const html1 = strip(renderMini(state.squares[4]));
    assert.equal((html1.match(/class="ddgo X"/g) || []).length, 4, 'every door a button');
    assert.equal(html1.replace(/style="[^"]*"/g, ''), html0.replace(/style="[^"]*"/g, ''), 'the same markup but for the runners');
    assert.ok(!/ddmd s[12]/.test(V.miniature(m)));
    const old = JSON.parse(JSON.stringify(m)); old.v = 2;            // a square from before: its marks
    assert.ok(V.doorsRest(old, old.sep ? 'X' : 'S', 0).some(d => d.st === 1) && V.doorsLinksShown(old) && V.doorsMapMarks(old, 'X', 0).includes(1));
  }
  E.setTune('doors', null);
});
