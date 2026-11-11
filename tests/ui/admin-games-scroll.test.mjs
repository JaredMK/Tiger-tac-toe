// The admin Games list keeps its place (admin.js): going from the list into a game's page remembers the list's scroll and the
// game opened; coming back (the Games link or the browser's Back) restores the scroll and lights that game's row. The router
// block is cut out of admin.js and run against a stubbed window.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../../admin.js', import.meta.url), 'utf8');
const a = src.indexOf('let gamesMemo = null;'), b = src.indexOf("window.addEventListener('scroll'");
const end = src.indexOf('\n', src.indexOf('{ passive: true });', b)) + 1;
assert.ok(a > 0 && b > a && end > b, 'the router block is there');
const block = src.slice(a, end);

function page() {
  const listeners = {}, scrolls = [], rows = {}, st = { y: 0, hash: '#games' };
  const win = { addEventListener: (n, f) => { listeners[n] = f; }, scrollTo: (x, y) => { st.y = y; scrolls.push(y); }, get scrollY() { return st.y; } };
  const row = t => rows[t] || (rows[t] = { classList: { on: new Set(), add(c) { this.on.add(c); }, remove(c) { this.on.delete(c); } } });
  const app = { querySelector: sel => { const m = /href="#games\/(\w+)"/.exec(sel); return m ? row(m[1]) : null; } };
  const loc = { get hash() { return st.hash; } };
  const view = { status: 'ready' };
  const render = () => {};
  const fn = new Function('window', 'location', 'view', 'render', 'app', 'setTimeout', block + '\nreturn {};');
  fn(win, loc, view, render, app, () => 0);
  return { st, scrolls, row, go(h) { st.hash = h; listeners.hashchange({}); }, scroll(y) { st.y = y; listeners.scroll(); } };
}

test('the Games list: scroll remembered into a game and back, the edited game lit', () => {
  const p = page();
  p.scroll(900);                                   // scrolled down the list
  p.go('#games/snake');                            // opens a game: its page starts at the top
  assert.equal(p.st.y, 0);
  p.go('#games');                                  // back: the list where it was, the game lit
  assert.equal(p.st.y, 900);
  assert.ok(p.row('snake').classList.on.has('glit'));
});
test('a game page is not restored; another game opened after returns to its own place', () => {
  const p = page();
  p.scroll(400); p.go('#games/claw'); p.go('#games');
  assert.equal(p.st.y, 400);
  p.scroll(1200); p.go('#games/duck'); p.go('#games');
  assert.equal(p.st.y, 1200); assert.ok(p.row('duck').classList.on.has('glit'));
  p.go('#');                                       // the menu: top, nothing lit
  assert.equal(p.st.y, 0);
});
