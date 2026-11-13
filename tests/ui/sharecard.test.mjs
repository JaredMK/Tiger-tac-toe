// The growth loop: the result card (ui/sharecard.js):
//   the card's text and share text for a win, a loss and a draw, first person where this phone played a side;
//   no rematch code; the computer as "the computer";
//   the win screen (and the draw screen) shows Share result in every mode: Play Computer, Same phone, a friend room, Find Match;
//   the main menu shows Challenge a friend under Play a Friend;
//   the characters as self-contained SVGs for the canvas, and the type sized to fit.
// Rendered in Node with the browser's names stubbed (no page needed; the canvas drawing is checked in a browser).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const { CARD, cardData, fitSize, perspective, shareBtn, toonSvg, toonUrl, LAYOUT } = await import('../../src/ui/sharecard.js');
const { renderWin } = await import('../../src/ui/screens/win.js');
const { renderMenu } = await import('../../src/ui/screens/menu.js');
const MM = await import('../../src/net/matchmaking.js');
const { state } = await import('../../src/ui/app.js');

const SITE = 'https://tictacchaos.com/';
// A finished match: the owners of the nine squares (X, O or ''), the winner and how.
function finished(owners, winner, how, names) {
  const st = E.newMatch(E.makeRng('card'), { games: ['ttt'] });
  owners.split('').forEach((o, i) => { st.squares[i].owner = o === 'X' || o === 'O' ? o : null; });
  const counts = { X: owners.split('').filter(c => c === 'X').length, O: owners.split('').filter(c => c === 'O').length };
  Object.assign(st, { winner, winReason: how, winLine: how === 'line' ? [0, 1, 2] : null, counts, screen: 'win', online: null, cpu: null, lock: null, done: null, flash: null });
  st.setup.names = Object.assign({ X: 'X', O: 'O' }, names);
  return st;
}
const vsCpu = (st, cpu) => { st.cpu = cpu; st.setup.names[cpu] = 'Computer'; return st; };

test('the card is square', () => { assert.equal(CARD, 1080); assert.ok(LAYOUT.board.cell * 3 + LAYOUT.board.gap * 2 < CARD); });
test('a win against the computer: the result, first person, no code', () => {
  const st = vsCpu(finished('XXXO.O...', 'X', 'line', { X: 'Alex' }), 'O');
  assert.equal(perspective(st), 'X');
  const d = cardData(st, { site: SITE });
  assert.equal(d.outcome, 'win');
  assert.equal(d.title, 'Alex beat the computer');
  assert.equal(d.sub, undefined, 'no score line on the card');
  assert.equal(d.text, 'I just beat the computer at Tic Tac Chaos! Play me: https://tictacchaos.com/');
  assert.equal(d.link, SITE); assert.equal(d.host, 'tictacchaos.com');
  assert.deepEqual(d.owners, ['X', 'X', 'X', 'O', null, 'O', null, null, null]); assert.deepEqual(d.winLine, [0, 1, 2]);
  assert.deepEqual(d.names, { X: 'Alex', O: 'Computer' }, 'the names row keeps the name');
  const lost = cardData(vsCpu(finished('OOOX.X...', 'O', 'line', { X: 'Alex' }), 'O'), { site: SITE });
  assert.equal(lost.outcome, 'loss'); assert.equal(lost.title, 'The computer beat Alex', 'a sentence starts with a capital');
  assert.equal(lost.text, 'The computer just beat me at Tic Tac Chaos! Play me: https://tictacchaos.com/');
});
test('a loss online: the other player beat me; most squares', () => {
  const st = finished('XXOOXXOOX', 'X', 'most', { X: 'Sam', O: 'Alex' });
  st.online = { kind: 'mm', game: 'g1', me: 'O' };
  const d = cardData(st, { site: SITE });
  assert.equal(d.outcome, 'loss');
  assert.equal(d.title, 'Sam beat Alex');
  assert.equal(d.text, 'Sam just beat me at Tic Tac Chaos! Play me: https://tictacchaos.com/');
});
test('a draw, a forfeit and a leaver', () => {
  const st = finished('XOXXOOOXX', 'draw', 'blocked', { X: 'Alex', O: 'Sam' });
  st.online = { kind: 'mm', game: 'g1', me: 'X' };
  let d = cardData(st, { site: SITE });
  assert.equal(d.outcome, 'draw'); assert.equal(d.winner, null);
  assert.equal(d.title, "It's a draw!");
  assert.equal(d.text, 'I just drew with Sam at Tic Tac Chaos! Play me: https://tictacchaos.com/');
  d = cardData(Object.assign(st, { winner: 'X', winReason: 'timeout' }), { site: SITE });
  assert.equal(d.title, 'Alex beat Sam'); assert.equal(d.text, 'I just beat Sam at Tic Tac Chaos! Play me: https://tictacchaos.com/');
  d = cardData(Object.assign(st, { winner: 'O', winReason: 'resign' }), { site: SITE });
  assert.equal(d.title, 'Sam beat Alex');
});
test('two people on one phone: nobody is "me"', () => {
  const d = cardData(finished('XXX.OO...', 'X', 'line', { X: 'Ann', O: 'Bo' }), { site: SITE });
  assert.equal(d.outcome, 'named'); assert.equal(d.me, null);
  assert.equal(d.text, 'Ann just beat Bo at Tic Tac Chaos! Play it: https://tictacchaos.com/');
  const dr = cardData(finished('XOXXOOOXX', 'draw', 'blocked', { X: 'Ann', O: 'Bo' }), { site: SITE });
  assert.equal(dr.text, 'Ann and Bo just drew at Tic Tac Chaos! Play it: https://tictacchaos.com/');
});
test('no rematch code on the card or in its link, a friend room included (November 2026)', () => {
  const st = finished('XXXO.O...', 'X', 'line', { X: 'Alex', O: 'Sam' });
  st.online = { kind: 'mm', game: 'g1', room: 'ABCDE', me: 'X' };
  const d = cardData(st, { site: SITE });
  assert.equal(d.code, undefined); assert.equal(d.link, 'https://tictacchaos.com/');
  assert.equal(d.text, 'I just beat Sam at Tic Tac Chaos! Play me: https://tictacchaos.com/');
  assert.doesNotMatch(JSON.stringify(d), /ABCDE/);
  assert.equal(cardData(st, { site: 'https://staging.tictacchaos.com/' }).host, 'staging.tictacchaos.com', 'the tag names the site the game runs on');
});
test('the win screen shows Share result in every mode (and the draw screen)', () => {
  const modes = {
    'Play Computer': st => vsCpu(st, 'O'),
    'Same phone': st => st,
    'a friend room': st => { st.online = { kind: 'mm', game: 'g1', room: 'ABCDE', me: 'X' }; return st; },
    'Find Match': st => { st.online = { kind: 'mm', game: 'g1', me: 'X' }; return st; },
  };
  for (const [mode, set] of Object.entries(modes)) {
    for (const [owners, winner, how] of [['XXXO.O...', 'X', 'line'], ['XOXXOOOXX', 'draw', 'blocked'], ['OOOX.X...', 'O', 'line']]) {
      Object.assign(state, set(finished(owners, winner, how, { X: 'Alex', O: 'Sam' })));
      const html = renderWin();
      assert.equal((html.match(/data-act="share-result"/g) || []).length, 1, `${mode}: one Share result (${winner})`);
      assert.match(html, /<button class="pn sm c" data-act="share-result" aria-label="Share result"[^>]*>.*?<b>Share<\/b><\/button><\/div><div class="shline" role="status"><\/div>/s, `${mode}: the button (a small panel, last in the row) and its note line`);
      assert.ok(html.indexOf('data-act="share-result"') > html.indexOf('Main menu'), `${mode}: under the buttons`);
    }
  }
  assert.match(shareBtn(), /data-act="share-result"/);
});
test('the main menu: Play Computer, Play a Friend, Find Match, How to Play; no Challenge a friend (as production\'s)', () => {
  Object.assign(state, finished('.........', null, null, {}), { screen: 'menu', winner: null, online: null });
  MM.setFindOn(true);
  const html = renderMenu();
  assert.doesNotMatch(html, /challenge|Challenge a friend/);
  const acts = [...html.matchAll(/data-act="([^"]+)"/g)].map(m => m[1]).filter(a => ['cpu-go', 'friend-go', 'find-go', 'howto'].includes(a));
  assert.deepEqual(acts, ['cpu-go', 'friend-go', 'find-go', 'howto']);
});
test('the characters for the canvas: self-contained SVGs in the palette (no page styles needed), as data: URLs', () => {
  const pal = { ink: '#161210', x: '#e5432a', o: '#f6c21b' };
  const x = toonSvg('X', pal), o = toonSvg('O', pal);
  assert.match(x, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 100 100" width="\d+" height="\d+"><style>/);
  assert.match(x, /\.ol\{stroke:#161210;fill:none;stroke-linecap:round;stroke-width:26\}/); assert.match(x, /\.fl\{stroke:#e5432a;/);
  assert.match(o, /\.ol\{[^}]*stroke-width:25\}/); assert.match(o, /\.fl\{stroke:#f6c21b;/);
  assert.match(x, /class="ol"/); assert.match(x, /class="eye"/); assert.match(x, /class="mouth"/, 'the face from art.js');
  for (const cls of ['ol', 'fl', 'eye', 'pup', 'mouth']) assert.match(x, new RegExp(`\\.${cls}\\{`), `${cls} styled inline`);
  assert.match(toonUrl('X', pal), /^data:image\/svg\+xml;charset=utf-8,%3Csvg/);
});
test('type sized to fit: shrunk in steps of 2 until it fits, never below the minimum', () => {
  const measure = (text, size) => text.length * size * 0.6;
  assert.equal(fitSize(measure, 'Alex beat Sam', 980, 66), 66, 'fits as it is');
  assert.equal(fitSize(measure, 'Somebody with a very long name beat somebody else', 980, 66), 32);
  assert.equal(fitSize(measure, 'x'.repeat(400), 980, 66, 30), 30, 'the floor');
});

test('the card is Comic Chaos: Bangers for the headline, Comic Neue for small text, an ink-outlined panel, bursts, no rematch code', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../../src/ui/sharecard.js', import.meta.url), 'utf8');
  assert.match(src, /'Bangers'/); assert.match(src, /'Comic Neue'/); assert.match(src, /burstPath/); assert.match(src, /halftone/);
  assert.doesNotMatch(src, /rematch\s*code|\?room=/i);
});
