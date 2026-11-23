// Letter Hive's screen (games/hive/view.js), new letters every turn (23 November 2026): before Go! the hive's seven
// cells blank (the centre one marked) with Go! alone, the page's own move control; Go! deals the letters in, timed from
// the move, with its sounds, and this phone's burst begins by itself once they have landed (Delete / Shuffle / Enter,
// the time bar); online, while this phone's Go! is with the server, "…" in the line and Go! pressed; both players'
// found words on show, each under its finder's tally; someone else's Go! deals their letters in and their burst lands
// word by word in their list, timed from the move, with the points counting on and the line at its end; this phone's own
// burst said at once; the review (the last burst's letters, no controls); the miniature (blank before any burst, then
// the last burst's letters, a bar each); a square from before; and the explainer following the settings.
// Rendered in Node with the browser's names stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : k === 'matchMedia' ? () => ({ matches: false }) : k === 'getItem' ? () => null : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const R = require('../../src/games/hive/rules.js');
const { state, setMenuOpen } = await import('../../src/ui/app.js');
const { renderMini } = await import('../../src/ui/mini.js');
const { GAMES } = await import('../../src/games/index.js');
const { moveSounds } = await import('../../src/audio/sound.js');
const { startFx } = await import('../../src/ui/fx.js');
const RM = await import('../../src/net/room.js');
const V = await import('../../src/games/hive/view.js');
const { explainOf } = await import('../../src/ui/explainer.js');
GAMES.hive.view = V;   // (the page registers the views in main.js; here by hand)

function match(turn = 'X') {
  Object.assign(state, E.newMatch(E.makeRng('hive-ui'), { games: ['hive'], vs: 'cpu' }), { screen: 'mini', zoom: 0, cpu: 'O', sc: null, flash: null, done: null, spot: null, winner: null, online: null, turn, lock: null, lockBy: null });
  state.setup.vs = 'cpu'; state.setup.names = { X: 'Xena', O: 'Computer' };
  return state.squares[0].mini;
}
const tick = () => new Promise(r => setTimeout(r, 5));
// Go! made here (the move itself, as the page's move control makes it), its flash started; after: back in the square.
const playGo = (seed, p) => { assert.ok(E.playMove(state, 0, R.HIVE_GO, E.makeRng(seed)).ok); startFx('move', state.flash); return state.flash; };
const after = () => { E.endFlash(state); state.screen = 'mini'; state.zoom = 0; };
const game = html => html.slice(html.indexOf('class="g-hv'));
const btns = html => [...game(html).matchAll(/<button class="([^"]*)" data-act="([a-z-]+)"(?: data-m='([^']*)')?[^>]*?( disabled)?>([^<]*)</g)].map(m => [m[2], m[3] || null, m[5], !m[4], m[1]]);
const cells = html => [...game(html).matchAll(/<g class="hvc( mid)?" data-k="([a-z]?)" style="--i:(\d+)(?:;--d:(\d+))?">/g)].map(m => [m[2], !!m[1], m[4] == null ? null : Number(m[4])]);
const list = (html, p) => { const g = game(html), at = g.indexOf(`<ul class="hvlist ${p}"`); return g.slice(at, g.indexOf('</ul>', at)); };
const chips = (html, p) => [...list(html, p).matchAll(/<li class="([^"]*)"(?: style="--t:(\d+)ms")?>([a-z]+)<\/li>/g)].map(m => [m[3], m[1], m[2] == null ? null : Number(m[2])]);
const pick = (pz, n, k = 0) => pz.words.filter(w => w.length === n && !pz.full.includes(w))[k];

test('hive: before Go!: Go! alone (the page\'s move control), the seven cells blank with the centre marked, both lists and tallies', () => {
  const mini = match('X'), html = renderMini(state.squares[0]), g = game(html);
  assert.equal(mini.pz, null, 'no letters drawn: none to show');
  assert.deepEqual(btns(html).map(b => b.slice(0, 4)), [['move', '"go"', 'Go!', true]]);
  assert.deepEqual(cells(html), [['', false, null], ['', false, null], ['', false, null], ['', false, null], ['', false, null], ['', false, null], ['', true, null]], 'seven blank cells, the centre drawn last (marked)');
  assert.equal((g.match(/<text /g) || []).length, 0, 'no letter anywhere'); assert.equal((g.match(/class="hvback"/g) || []).length, 7, 'each cell its tile back');
  assert.ok(g.includes('class="hvhive blank"')); assert.ok(!g.includes('hvcar') && !g.includes('hvbar on'), 'no caret and no time bar before Go!');
  assert.equal((g.match(/class="ctal /g) || []).length, 2); assert.ok(g.includes('<small>/40</small>')); assert.deepEqual([chips(html, 'X'), chips(html, 'O')], [[], []]);
  assert.match(g, /<p class="hvline"><\/p>/, 'the line is there, empty');
  match('O'); assert.deepEqual(btns(renderMini(state.squares[0])).map(b => b.slice(0, 4)), [['move', '"go"', 'Go!', false]], 'the computer\'s turn: nothing to press');
  assert.deepEqual(V.replay.synth(), [], 'a replay presses nothing: Go! and the burst play from the move'); assert.equal(V.ownLine, true);
});

test('hive: this phone\'s Go! deals the letters in from the move, with its sounds; once they have landed its burst begins by itself', async () => {
  match('X');
  const f = playGo('g1', 'X'), mini = state.squares[0].mini, pz = R.hivePuzzle(mini.pz);
  assert.deepEqual([f.kind, f.hv, state.lock], ['again', { go: 1, by: 'X', pz: mini.pz }, 0]);
  let html = renderMini(state.squares[0]);
  assert.ok(game(html).includes('class="hvhive deal"'), 'the deal');
  assert.deepEqual(cells(html), [...pz.letters.slice(1)].map((ch, k) => [ch, false, R.hiveDealAt(k)]).concat([[pz.centre, true, 0]]), 'each letter at its moment, the centre first');
  assert.equal((game(html).match(/<text /g) || []).length, 7);
  assert.deepEqual(btns(html).map(b => b.slice(0, 4)), [['move', '"go"', 'Go!', false]], 'Go! pressed: nothing more to press while the letters come');
  assert.match(game(html), /<p class="hvline"><\/p>/); assert.equal(V.heldSub(mini, 'X', null, null), '', 'no "goes again" while a burst is owed');
  assert.deepEqual(moveSounds(f).filter(s => /^hv/.test(s[0])).map(s => [s[0], s[1]]), [['hvGo', 0]].concat([-1, 0, 1, 2, 3, 4, 5].map(k => ['hvDeal', R.hiveDealAt(k) + 40])));
  assert.equal(V.hold(f), 0, 'this phone\'s Go!: its burst the moment the letters are in'); assert.equal(E.playMs(f), R.hiveDealMs());
  assert.equal(V.moveText(f, 'Xena'), 'Xena drew the letters');
  after();
  renderMini(state.squares[0]); await tick();                       // (the burst begins after the page is drawn)
  html = renderMini(state.squares[0]);
  assert.deepEqual(btns(html).map(b => [b[0], b[2], b[3]]), [['hive-del', 'Delete', true], ['hive-shuf', 'Shuffle', true], ['hive-ent', 'Enter', true]], 'the burst under way');
  assert.ok(game(html).includes('hvbar on') && game(html).includes('hvcar') && game(html).includes('class="hvhive on"'), 'its time bar, its caret, its letters live');
  assert.deepEqual(cells(html).map(c => c[0]).sort(), [...pz.letters].sort(), 'the letters drawn, on show');
  // the turn's end comes for it: a timeout plays its burst empty (the record moves on), and the burst here is let go, unsent
  state.timer = E.newTimer(0); state.flash = null;
  assert.ok(E.playMove(state, 0, { w: [] }, E.makeRng('t'), { forced: true, noAgain: true }).ok); E.endFlash(state); state.screen = 'mini'; state.zoom = 0; state.turn = 'X';
  html = renderMini(state.squares[0]);
  assert.deepEqual(btns(html).map(b => b.slice(0, 4)), [['move', '"go"', 'Go!', true]], 'let go: Go! again, for new letters');
  assert.ok(game(html).includes('class="hvhive blank"'), 'and the hive blank again');
});

test('hive: the burst waits while the menu is open (a "?" card the same): it begins once it closes', async () => {
  match('X'); playGo('m-menu', 'X'); after();
  setMenuOpen(true);
  try {
    renderMini(state.squares[0]); await tick(); await tick();
    assert.ok(!/class="g-hv[^"]*live/.test(renderMini(state.squares[0])), 'not begun behind the menu');
  } finally { setMenuOpen(false); }
  await new Promise(r => setTimeout(r, 300));
  const html = renderMini(state.squares[0]);
  assert.ok(/class="g-hv[^"]*live/.test(html) && game(html).includes('hvbar on'), 'begun once the menu has closed (nothing redrawn for it)');
  state.squares[0].mini.go = null; renderMini(state.squares[0]);   // (let go of it: the square moved past it)
});

test('hive: online, this phone\'s Go! with the server: "…" in the line and Go! pressed, until the record brings the letters', () => {
  match('X'); state.online = { kind: 'mm', game: 'g', me: 'X', matchId: 'm', shownSeq: 0 }; RM.setMoveWait(Date.now());
  try {
    const html = renderMini(state.squares[0]), b = btns(html);
    assert.match(game(html), /<p class="hvline wait" role="status">…<\/p>/);
    assert.deepEqual(b.map(x => x.slice(0, 4)), [['move', '"go"', 'Go!', false]]); assert.ok(/\bpend\b/.test(b[0][4]), 'pressed');
    assert.ok(game(html).includes('class="hvhive blank"'), 'no letters until the record has them');
  } finally { RM.setMoveWait(null); state.online = null; }
  assert.doesNotMatch(game(renderMini(state.squares[0])), /hvline wait/, 'nothing on its way: no "…"');
});

test('hive: someone else\'s Go! deals their letters in, their burst lands word by word, the points counting on, then the line; this phone\'s own is said at once', () => {
  match('X');
  playGo('m0', 'X'); after();
  const xpz = state.squares[0].mini.pz, px = R.hivePuzzle(xpz), a = pick(px, 4);
  assert.ok(E.playMove(state, 0, { w: [a] }, E.makeRng('m1')).ok);   // X's burst (this phone's)
  startFx('move', state.flash);
  let html = renderMini(state.squares[0]);
  assert.deepEqual(chips(html, 'X'), [[a, 'hvw', null]], 'its word already in the list, nothing timed');
  assert.match(game(html), /<p class="hvline ok">1 word · \+1<\/p>/); assert.deepEqual(moveSounds(state.flash).filter(s => /^hv/.test(s[0])), [], 'heard live: nothing again');
  assert.deepEqual(cells(html).map(c => c[0]).sort(), [...px.letters].sort(), 'the letters it was played on');
  state.flash = null; state.done = null; state.screen = 'mini'; state.zoom = 0; state.turn = 'O';
  const gf = playGo('m2', 'O'), mo = state.squares[0].mini, po = R.hivePuzzle(mo.pz);   // the computer's Go!
  assert.notEqual(mo.pz, xpz, 'new letters for the other player');
  html = renderMini(state.squares[0]);
  assert.ok(game(html).includes('class="hvhive deal"')); assert.deepEqual(cells(html).map(c => c[0]).sort(), [...po.letters].sort());
  assert.equal(V.hold(gf), null, 'someone else\'s Go!: the usual hold, the letters seen before their words land'); assert.ok(moveSounds(gf).some(s => s[0] === 'hvGo'));
  after(); html = renderMini(state.squares[0]);
  assert.deepEqual(btns(html).map(b => b.slice(0, 4)), [['move', '"go"', 'Go!', false]], 'their burst under way: nothing here to press');
  assert.deepEqual(cells(html).map(c => c[0]).sort(), [...po.letters].sort(), 'their letters on show while they play');
  const [b, c] = [pick(po, 5), po.full[0]];
  assert.ok(E.playMove(state, 0, { w: [b, 'junk', c] }, E.makeRng('m3')).ok);   // O's burst (the computer's)
  const f = state.flash, s = f.hv; startFx('move', f);
  html = renderMini(state.squares[0]);
  assert.deepEqual(s.w, [b, c]); assert.equal(s.pz, mo.pz);
  assert.deepEqual(chips(html, 'O'), [[b, 'hvw land', R.hiveWordAt(s, 0)], [c, 'hvw full land', R.hiveWordAt(s, 1)]], 'each word at its own moment, the full-hive word marked');
  assert.deepEqual(chips(html, 'X'), [[a, 'hvw', null]], 'the other list as it was');
  const g = game(html), cnt = g.match(/<b class="cnt" data-from="(\d+)" data-delay="(\d+)" data-ms="(\d+)">(\d+)<\/b>/);
  assert.deepEqual(cnt.slice(1).map(Number), [0, R.hiveWordAt(s, 0), Math.round(2 * R.hiveBeat(2)), 5 + c.length + 7], 'the points count on through the words');
  assert.ok(g.includes(`<p class="hvline full appear" style="--t:${R.hiveShowMs(s)}ms" role="status">Full hive! 2 words · +${5 + c.length + 7}</p>`), 'the line at the end of the landing');
  assert.ok(!g.includes('junk'));
  assert.deepEqual(moveSounds(f).filter(x => /^hv|ding|thud/.test(x[0])).map(x => [x[0], x[1]]), [['hvLand', R.hiveWordAt(s, 0)], ['hvFull', R.hiveWordAt(s, 1)], ['ding', R.hiveShowMs(s)]]);
  assert.ok(E.playMs(f) >= R.hiveShowMs(s) + R.HIVE.hold);
  // an empty burst: no words, a thud
  state.flash = null; state.done = null; state.screen = 'mini'; state.zoom = 0; state.turn = 'O';
  playGo('m4', 'O'); after();
  assert.ok(E.playMove(state, 0, { w: [] }, E.makeRng('m5')).ok); startFx('move', state.flash);
  assert.ok(game(renderMini(state.squares[0])).includes('>No words</p>')); assert.deepEqual(moveSounds(state.flash).filter(x => /^hv|ding|thud/.test(x[0])).map(x => x[0]), ['thud']);
  assert.match(V.moveText(f, 'Computer'), /^Computer found 2 words for \d+$/); assert.equal(V.moveText(state.flash, 'Computer'), 'Computer found no words');
});

test('hive: a won square under review: both lists, the last burst\'s letters and line, no controls; the turn held after a full-hive word says so', () => {
  match('X'); playGo('w0', 'X'); after();
  const mini = state.squares[0].mini, pz = R.hivePuzzle(mini.pz);
  mini.pts.X = 39; assert.ok(E.playMove(state, 0, { w: [pz.full[0]] }, E.makeRng('w')).ok); assert.equal(state.squares[0].owner, 'X');
  state.flash = null; state.done = null; state.screen = 'mini'; state.zoom = 0;
  const html = renderMini(state.squares[0]);
  assert.deepEqual(btns(html), []); assert.deepEqual(chips(html, 'X').map(c => c.slice(0, 2)), [[pz.full[0], 'hvw full']]); assert.ok(game(html).includes('Full hive! 1 word'));
  assert.deepEqual(cells(html).map(c => c[0]).sort(), [...pz.letters].sort(), 'the letters it was won on');
  assert.ok(!/claim|stamp/.test(game(html)), 'no claim inside the game');
  const m2 = match('X'); state.lock = 0; state.lockBy = null; assert.match(V.heldSub(m2, 'X', null, null), /filled the hive · goes again/); state.lockBy = 'open'; assert.equal(V.heldSub(m2, 'X', null, null), ''); state.lock = null; state.lockBy = null;
});

test('hive: the miniature: blank before any burst, then the last burst\'s seven letters, the centre marked, a bar each; public and small', () => {
  const mini = match('X');
  mini.pts = { X: 10, O: 30 };
  let t = V.miniature(mini, false);
  assert.equal((t.match(/<polygon class="thvc/g) || []).length, 7); assert.equal((t.match(/<text /g) || []).length, 0, 'blank before any burst'); assert.equal((t.match(/class="thvb/g) || []).length, 7);
  assert.deepEqual([...t.matchAll(/--w:([\d.]+)%/g)].map(m => Number(m[1])), [25, 75]);
  assert.ok(t.includes('aria-label="Letter Hive: X 10, O 30 of 40 points"')); assert.ok(!/class="[^"]*\b(sq|back|bar|big)\b/.test(t), 'its classes are its own');
  playGo('mn', 'X'); after();
  assert.equal((V.miniature(state.squares[0].mini, false).match(/<text /g) || []).length, 0, 'letters drawn, the burst not in yet: still the last burst\'s (none)');
  const pz = R.hivePuzzle(mini.pz); assert.ok(E.playMove(state, 0, { w: [] }, E.makeRng('mn2')).ok);
  t = V.miniature(state.squares[0].mini, false);
  assert.deepEqual([...t.matchAll(/<text class="thvl( mid)?"[^>]*>([A-Z])<\/text>/g)].map(m => m[2] + (m[1] ? '*' : '')), [...pz.letters.slice(1).toUpperCase()].concat([pz.centre.toUpperCase() + '*']), 'the last burst\'s letters, the centre marked');
});

test('hive: a square dealt before (its letters dealt with it, no Go!) draws and plays: Go!, its words and points kept', () => {
  match('X');
  const p3 = R.hivePuzzle(3), w = pick(p3, 4);
  state.squares[0].mini = { type: 'hive', pz: 3, found: [w], by: 'O', pts: { X: 0, O: 1 }, n: { X: 0, O: 1 }, last: { by: 'O', w: [w], pts: [1], full: 0, from: 0, to: 1 } };
  const html = renderMini(state.squares[0]);
  assert.deepEqual(btns(html).map(b => b.slice(0, 4)), [['move', '"go"', 'Go!', true]]); assert.ok(game(html).includes('class="hvhive blank"'));
  assert.deepEqual(chips(html, 'O'), [[w, 'hvw', null]]);
  assert.equal((V.miniature(state.squares[0].mini, false).match(/<text /g) || []).length, 7, 'its miniature: the letters its last burst was on');
  playGo('old', 'X'); assert.equal(state.squares[0].mini.v, 2); assert.notEqual(state.squares[0].mini.pz, 3);
});

test('hive: the explainer follows the settings', () => {
  const text = () => { const e = explainOf('hive'); return e.play + ' | ' + e.win; };
  state.screen = 'menu';   // (How to Play's: the settings as they would be dealt now; an open square shows its own)
  assert.match(text(), /^Each turn deals seven new letters, hidden until you tap Go!, then a burst of 20 seconds\..*4-letter word scores 1, a longer word its length, and a word with all seven letters 7 more\. A word either player has already found scores nothing\. \| First to 40 points\.$/);
  E.setTune('hive', { secs: 30, target: 50, four: 2, bonus: 10, again: 'on' });
  try { assert.match(text(), /burst of 30 seconds.*scores 2,.*seven letters 10 more.*All seven letters in a word\? Go again\. \| First to 50 points\./); } finally { E.setTune('hive', null); }
});
