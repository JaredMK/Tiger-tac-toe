// Tic-tac-toe and Four in a Row (the November 2026 polish): the mark played draws itself (the others are the plain
// character), the cell or piece played last is marked, a win draws its line; Four in a Row has one button a column (the
// rail's piece and the hole it would land in), a full column closed, and its piece's fall, the thunk and the buzz all
// timed from the one figure, inside the move's time. Rendered in Node with the browser's names stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const ttt = await import('../../src/games/ttt/view.js');
const c4 = await import('../../src/games/c4/view.js');
const { C4, flashMs: c4Flash } = await import('../../src/games/c4/rules.js');
const { flashMs: tttFlash } = await import('../../src/games/ttt/rules.js');
const H = await import('../../src/ui/haptics.js');

const play = (type, moves) => { const rng = E.makeRng('lines'), mini = E.newMini(type, rng); let r = null; for (const [p, m] of moves) r = E.applyMove(mini, p, m, rng); return { mini, r }; };
const won = mini => i => !!(mini.winCells && mini.winCells.includes(i));
const wk = mini => i => (mini.winCells ? mini.winCells.indexOf(i) : -1);
// the view's screen as ui/mini.js calls it: a = the move's flash (its animation playing), or none
const draw = (view, mini, o = {}) => view.screen({ owner: o.owner || null, mini }, o.a || null, null, mini, !!o.view, !!o.locked, o.a || null, o.a && Number.isInteger(mini.last) ? mini.last : null, won(mini), wk(mini), !!o.fresh, o.turn || 'X', '');
const sounds = (view, f, mini) => { const out = []; view.sounds(f, (n, ms) => out.push([n, ms]), f.kind === 'claim', mini, null); return out; };

test('tic-tac-toe: the mark just played draws itself stroke by stroke; the others, and it once the move is over, are the plain character', () => {
  const { mini } = play('ttt', [['X', 4], ['O', 0]]);
  const live = draw(ttt, mini, { a: { type: 'ttt', kind: 'move', by: 'O' }, locked: true });
  assert.equal((live.match(/tttmk/g) || []).length, 1, 'one mark being drawn');
  assert.match(live, /<button class="cell O last"[^>]*data-m='0'[^>]*>.*?tttmk.*?<\/button>/, 'the cell just played');
  assert.match(live, /<path class="ol s1" pathLength="1"[^>]*><path class="fl s1"/, 'the ring: its outline, then its colour, one sweep');
  const idle = draw(ttt, mini);
  assert.doesNotMatch(idle, /tttmk/, 'nothing draws itself without a move playing');
  assert.equal((idle.match(/ last"/g) || []).length, 1, 'the mark played last is ringed');
  assert.match(idle, /class="g-ttt tX open"/, 'open to the mover, their colour for the ghost under the finger');
  assert.match(draw(ttt, mini, { locked: true, turn: 'O' }), /class="g-ttt tO"/, 'not this phone\'s to play: no ghost');
  const x = play('ttt', [['X', 4]]).mini, xl = draw(ttt, x, { a: { type: 'ttt', kind: 'move', by: 'X' }, locked: true });
  assert.match(xl, /class="ol s1"[^>]*><path class="ol s2"[^>]*><path class="fl s1"[^>]*><path class="fl s2"/, 'the X: both outlines under both strokes, the second after the first');
});

test('tic-tac-toe: a win draws its line through the three (once, when fresh), each lit in turn; a finished square shows it drawn', () => {
  const { mini, r } = play('ttt', [['X', 0], ['O', 3], ['X', 1], ['O', 4], ['X', 2]]);
  assert.equal(r.outcome, 'win'); mini.winCells = r.cells;
  const live = draw(ttt, mini, { a: { type: 'ttt', kind: 'claim', by: 'X', winner: 'X' }, owner: 'X', fresh: true, locked: true });
  assert.match(live, /<svg class="tttline draw"[^>]*><path class="tttlo" d="M0\.16 0\.50L2\.84 0\.50" pathLength="1"\/><path class="tttlc X"/);
  assert.deepEqual([...live.matchAll(/class="cell X win lit[^"]*" style="--k:(\d)"/g)].map(m => m[1]), ['0', '1', '2'], 'the three hop in the line\'s order');
  const after = draw(ttt, mini, { owner: 'X', view: true, locked: true });
  assert.match(after, /<svg class="tttline"/); assert.doesNotMatch(after, / lit| last|tttmk/, 'the review: the line as drawn, nothing playing, no last mark');
});

test('tic-tac-toe: the pen for each stroke, the line\'s swish and the square\'s chime, all within the move\'s time', () => {
  assert.deepEqual(sounds(ttt, { type: 'ttt', kind: 'move', by: 'O' }, {}), [['mark', 0]]);
  assert.deepEqual(sounds(ttt, { type: 'ttt', kind: 'move', by: 'X' }, {}), [['mark', 0], ['mark', ttt.TTT_T.stroke2]]);
  const win = sounds(ttt, { type: 'ttt', kind: 'claim', by: 'X', winner: 'X' }, {});
  assert.deepEqual(win.map(s => s[0]), ['mark', 'mark', 'swish', 'won']);
  assert.ok(win.every(s => s[1] < tttFlash({}, 3, true)), 'inside the win\'s time');
  assert.ok(ttt.TTT_T.stroke2 < tttFlash({}, 3, false));
  assert.deepEqual(H.movePlan({ by: 'X', winner: 'X' }, win).map(b => b[0]), ['tap', 'success'], 'a tap as the mark goes down, success as the square is won');
});

test('Four in a Row: a button a column over the rail and its holes, the landing hole named, a full column closed', () => {
  const { mini } = play('c4', [['X', 3], ['O', 3], ['X', 3], ['O', 3], ['X', 3], ['O', 3], ['X', 0]]);
  const html = draw(c4, mini, { turn: 'O' });
  const cols = html.match(/<button class="c4col[\s\S]*?<\/button>/g);
  assert.equal(cols.length, C4.cols);
  assert.match(html, /class="g-c4w tO open"/, 'the rail\'s pieces in the mover\'s colour');
  assert.match(cols[3], /class="c4col full"[^>]*aria-label="Drop in column 4, full"[^>]* disabled/);
  assert.match(cols[0], /data-m='0'[^>]*style="--land:4"/, 'column 1 lands on the X there');
  assert.match(cols[1], /data-m='1'[^>]*style="--land:5"/);
  assert.ok(cols.every((c, k) => k === 3 || !/ disabled/.test(c)));
  assert.equal((html.match(/class="c4c /g) || []).length, C4.cols * C4.rows, 'the holes are drawn, not pressed');
  assert.equal((html.match(/c4c X last/g) || []).length, 1, 'the piece played last is ringed');
  assert.doesNotMatch(html, /<button class="c4c[ "]/);
  const locked = draw(c4, mini, { turn: 'O', locked: true });
  assert.match(locked, /class="g-c4w tO"/, 'nobody\'s to play here: no pieces on the rail'); assert.ok(locked.match(/<button class="c4col[^>]*>/g).every(b => / disabled/.test(b)));
});

test('Four in a Row: the piece falls from the rail in a dropped thing\'s time, the thunk and its buzz at the landing, all inside the move', () => {
  const falls = Array.from({ length: C4.rows }, (_, r) => c4.c4FallMs(r * C4.cols));
  for (let r = 1; r < C4.rows; r++) assert.ok(falls[r] > falls[r - 1], 'the further, the longer');
  assert.ok(falls[C4.rows - 1] + c4.C4_T.land <= c4Flash({}, 4, false), `the longest fall and its landing (${falls[C4.rows - 1] + c4.C4_T.land} ms) inside flashMs`);
  assert.ok(falls[C4.rows - 1] + c4.C4_T.land + 20 + 3 * 60 + 320 <= c4Flash({}, 4, true), 'a win\'s line and hops inside its flashMs');
  const { mini } = play('c4', [['X', 2], ['O', 2]]), k = mini.last, f = { type: 'c4', kind: 'move', by: 'O' };
  const html = draw(c4, mini, { a: f, locked: true });
  assert.match(html, new RegExp(`class="g-c4w tX drop" style="--ft:${c4.c4FallMs(k)}ms"`));
  assert.match(html, new RegExp(`<i class="c4c landing"><span class="c4p" style="--fall:${Math.floor(k / C4.cols) + 1}"><span class="c4b O">`), 'the piece on its own layer over its hole, from the rail');
  assert.deepEqual(sounds(c4, f, mini), [['c4drop', c4.c4FallMs(k)]], 'the thunk as it lands, nothing as it falls');
  assert.deepEqual(H.movePlan({ by: 'O' }, sounds(c4, f, mini)), [['tap', 0], ['medium', c4.c4FallMs(k)]], 'a tap at the release, the landing\'s buzz');
  assert.deepEqual(sounds(c4, { type: 'c4', kind: 'draw', by: 'X', drawn: mini }, { type: 'ttt', last: 4 }), [['c4drop', c4.c4FallMs(k)]], 'a draw: timed from the board that drew, not the square\'s new game');
});

test('Four in a Row: a win draws its line through the four; the miniatures mark the last move and stay public', () => {
  const { mini, r } = play('c4', [['X', 0], ['O', 0], ['X', 1], ['O', 1], ['X', 2], ['O', 2], ['X', 3]]);
  assert.equal(r.outcome, 'win'); mini.winCells = r.cells;
  const live = draw(c4, mini, { a: { type: 'c4', kind: 'claim', by: 'X', winner: 'X' }, owner: 'X', fresh: true, locked: true });
  assert.match(live, /<svg class="c4line draw" viewBox="0 0 7 6"[^>]*><path class="c4lo" d="M0\.20 5\.50L3\.80 5\.50" pathLength="1"\/>/);
  assert.equal((live.match(/ win lit/g) || []).length, 4);
  assert.match(c4.miniature(mini, true), /^<div class="tg g5">/); assert.doesNotMatch(c4.miniature(mini, true), /last/, 'a claimed square: no last mark');
  const open = play('c4', [['X', 3], ['O', 4]]).mini;
  assert.equal((c4.miniature(open, false).match(/class="O last"/g) || []).length, 1);
  const t = play('ttt', [['X', 4], ['O', 0]]).mini;
  assert.equal((ttt.miniature(t, false).match(/class="O last"/g) || []).length, 1);
  assert.equal(ttt.miniature(t, false), ttt.miniature(JSON.parse(JSON.stringify(t)), false));
});
