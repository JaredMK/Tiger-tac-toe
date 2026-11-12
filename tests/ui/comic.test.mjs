// Comic Chaos (December 2026; src/ui/comic.js, comic.css): the game's look.
//   tappable: a skewed panel (.pn) with a thick outline, a hard shadow and a caption tag, pressed it punches in;
//   information: flat (bubbles, captions, burst badges), never a .pn; selected: inverted to ink and yellow (.pn.on);
//   the main menu: a panel for each way to play with its tag and line, Find Match a small "soon" tag while off;
//   every panel 44 px or more; the fonts embedded.
// Rendered in Node with the browser's names stubbed (no page needed).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const MM = await import('../../src/net/matchmaking.js');
const { renderMenu } = await import('../../src/ui/screens/menu.js');
const { renderWin } = await import('../../src/ui/screens/win.js');
const { state } = await import('../../src/ui/app.js');
const ROOT = new URL('../../', import.meta.url);
const CSS = fs.readFileSync(new URL('src/ui/comic.css', ROOT), 'utf8');
const board = () => E.newMatch(E.makeRng('cc'), { games: ['ttt'] });
export const panels = html => [...html.matchAll(/<button class="pn ([^"]*)" data-act="([^"]+)"/g)].map(m => ({ cls: m[1], act: m[2] }));

test('the stylesheet and the two faces are the page\'s', () => {
  const page = fs.readFileSync(new URL('index.html', ROOT), 'utf8');
  assert.ok(page.indexOf('src/ui/comic.css') > page.indexOf('src/ui/styles.css'));
  const fonts = fs.readFileSync(new URL('src/ui/fonts.css', ROOT), 'utf8');
  for (const f of ["font-family: 'Bangers'", "font-family: 'Comic Neue'"]) assert.ok(fonts.includes(f), f);
  assert.match(fonts, /Open Font License/);
});

test('the main menu: a panel with a caption tag and a line for each way to play; Find Match a small "soon" tag while off', () => {
  Object.assign(state, board(), { screen: 'menu', online: null });
  MM.setFindOn(true);
  let html = renderMenu();
  assert.match(html, /<main class="scr menu cc loud">/);
  for (const [act, b, tag] of [['cpu-go', 'Play Computer', '1 player'], ['friend-go', 'Play a Friend', '2 players'], ['find-go', 'Find Match', 'online']]) assert.match(html, new RegExp(`class="pn [^"]*" data-act="${act}"[^>]*><i class="ptag" aria-hidden="true">${tag}</i><b>${b}</b><small>[^<]+</small>`), b);
  assert.deepEqual(panels(html).map(p => p.act), ['cpu-go', 'friend-go', 'find-go', 'howto', 'settings']);
  MM.setFindOn(false);
  html = renderMenu();
  assert.match(html, /<button class="soon" data-act="find-go" disabled[^>]*>Find Match<small>soon<\/small>/);
  assert.ok(!panels(html).some(p => p.act === 'find-go'), 'never a dead panel');
  MM.setFindOn(true);
});

test('tappable panels are 44 px or more, skewed, shadowed and press in; information never takes the panel\'s look', () => {
  const rule = sel => { const m = new RegExp(sel.replace(/[.()[\]]/g, '\\$&') + ' \\{([^}]*)\\}').exec(CSS); return m ? m[1] : ''; };
  const pn = rule('.cc .pn');
  assert.match(pn, /min-height: 44px/); assert.match(pn, /min-width: 44px/); assert.match(pn, /skew\(var\(--cc-skew\)\)/); assert.match(pn, /box-shadow: 6px 6px 0/);
  assert.match(rule('.cc .pn:active:not(:disabled)'), /translate\(4px, 4px\)/);
  assert.match(rule('.cc .soon'), /height: 44px/);
  for (const sel of ['.cc .bub', '.cc .cap', '.cc .soon']) { const r = rule(sel); assert.ok(r, sel); assert.doesNotMatch(r, /box-shadow|skew/, `${sel}: flat`); }
  assert.match(CSS, /\.cc \.pn\.on[^{]*\{[^}]*background: var\(--ink\); color: var\(--o\)/, 'selected: ink and yellow');
});

test('no display type under 16 px in the comic stylesheet', () => {
  for (const m of CSS.matchAll(/font: 400 (?:clamp\((\d+)px[^)]*\)|(\d+)px)[^;]*'Bangers'/g)) assert.ok(Number(m[1] || m[2]) >= 16, m[0]);
});

test('the results: Rematch the one big panel, then Board, Menu and Share as small panels; the facts as burst badges; the celebration', () => {
  Object.assign(state, board(), { screen: 'win', online: null, cpu: 'O', winner: 'X', winLine: [0, 4, 8], winReason: 'line' });
  for (const i of [0, 4, 8]) state.squares[i].owner = 'X';
  state.squares[2].owner = 'O';
  const html = renderWin();
  assert.match(html, /<main class="scr win-scr cc loud win">/);
  assert.deepEqual(panels(html).map(p => p.act), ['rematch', 'review', 'menu', 'share-result'], 'Rematch first, then the small panels');
  assert.match(html, /class="pn y big" data-act="rematch"[^>]*><i class="ptag"[^>]*>again\?<\/i><b>Rematch!<\/b>/);
  assert.match(html, /<span class="bbadge y why"[^>]*><span>Three in a row<\/span><\/span><span class="bbadge w fsq"[^>]*><span>3 squares to 1<\/span><\/span>/);
  assert.match(html, /<div class="cel win"/, 'the confetti'); assert.match(html, /class="ccrays"/, 'the rays');
  assert.doesNotMatch(html, /class="[^"]*\bsq\b/, 'no board-tile class on the results');
  state.winReason = 'resign'; state.cpu = 'X'; state.winner = 'O';
  assert.match(renderWin(), /resigned/, 'a computer\'s name stays markup, never escaped twice');
  assert.doesNotMatch(renderWin(), /&lt;svg/);
});
