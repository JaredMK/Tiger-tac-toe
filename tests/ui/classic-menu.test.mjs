// Classic only, the new main menu, hosting as Player 1 and 2, the side reveal and the invite:
//   the main menu: Play Computer, Play a Friend, Find Match (no Play Local / Play Online, no mode);
//   Play Computer starts a Classic match at once: the side drawn at random, the released games, Normal (core/match.js startQuick);
//   Play a Friend: Host, Join and a small Same phone; Same phone is two people (no computer, no mode);
//   the host's room: Player 1 (you) and Player 2 (friend), no X/O choice; the join screen likewise;
//   every match opens with the side reveal ("You are X", or who is which on a shared phone);
//   the invite carries the room's code in its words and its link.
// Rendered in Node with the browser's names stubbed (no page needed).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const MM = await import('../../src/net/matchmaking.js');
const { renderMenu } = await import('../../src/ui/screens/menu.js');
const { renderFriend, renderJoin } = await import('../../src/ui/screens/online.js');
const { renderIntro } = await import('../../src/ui/screens/find.js');
const { renderSetup } = await import('../../src/ui/screens/setup.js');
const { inviteText, setRoom } = await import('../../src/net/room.js');
const { SUPER_CHAOS_ENABLED } = await import('../../src/core/config.js');
const { state } = await import('../../src/ui/app.js');

const board = () => E.newMatch(E.makeRng('cm'), { games: ['ttt'] });
test('Super Chaos is off in the code, for everyone', () => assert.equal(SUPER_CHAOS_ENABLED, false));
test('the main menu: Play Computer, Play a Friend, Find Match, How to Play; no Play Local, Play Online or mode', () => {
  Object.assign(state, board(), { screen: 'menu', online: null });
  MM.setFindOn(true);
  const html = renderMenu();
  const acts = [...html.matchAll(/data-act="([^"]+)"/g)].map(m => m[1]);
  for (const a of ['cpu-go', 'friend-go', 'find-go', 'howto', 'sound', 'login']) assert.ok(acts.includes(a), a);
  assert.ok(acts.indexOf('cpu-go') < acts.indexOf('friend-go') && acts.indexOf('friend-go') < acts.indexOf('find-go'), 'in that order');
  assert.match(html, />Play Computer</); assert.match(html, />Play a Friend</); assert.match(html, />Find Match</);
  assert.doesNotMatch(html, /Play Local|Play Online|mode-go|online-go|Super Chaos/);
  MM.setFindOn(false);
  assert.match(renderMenu(), /data-act="find-go" disabled>Find Match<small>Not available at this time<\/small>/, 'switched off on the admin page: greyed');
  MM.setFindOn(true);
});
test('Play a Friend: Host, Join and a small Same phone; back to the main menu', () => {
  const html = renderFriend();
  assert.match(html, /data-act="host"/); assert.match(html, /data-act="join-go"/);
  assert.match(html, /<button class="link wide same" data-act="same-go">Same phone<\/button>/);
  assert.match(html, /class="back" data-act="menu"/);
});
test('Play Computer: a Classic match at once, the side drawn at random, every released game (no Super Chaos only one), Normal; the Same phone setup untouched', () => {
  const st = board(), sides = new Set(), rng = E.makeRng('quick');
  st.setup.games = Object.fromEntries(E.TYPES.map(t => [t, t === 'ttt']));
  const released = E.TYPES.filter(t => t !== 'clash');
  for (let k = 0; k < 20; k++) {
    const me = E.startQuick(st, rng, released, 'Ann');
    assert.ok(me === 'X' || me === 'O'); sides.add(me);
    assert.equal(st.cpu, E.other(me), 'the computer plays the other side'); assert.equal(st.cpuLevel, 'normal');
    assert.deepEqual([st.setup.names[me], st.setup.names[E.other(me)]], ['Ann', 'Computer']);
    assert.equal(st.quick, true); assert.equal(st.sc, null, 'Classic'); assert.equal(st.screen, 'board');
    assert.ok(st.games.every(t => released.includes(t) && !E.SC_ONLY.includes(t)) && st.games.length > 9, 'the released games');
  }
  assert.deepEqual([...sides].sort(), ['O', 'X'], 'either side, drawn');
  assert.deepEqual(E.enabledGames(st.setup), ['ttt'], "the Same phone setup's games kept as they were");
  assert.equal(E.startMatch(st, rng), true); assert.equal(st.quick, false, 'a Same phone match is not a Play Computer one');
});
test('Same phone: two people on this phone, no computer, no level, no mode; back to Play a Friend', () => {
  Object.assign(state, board(), { screen: 'setup', online: null });
  const html = renderSetup();
  assert.match(html, /<b>Same phone<\/b>/);
  assert.doesNotMatch(html, /data-act="kind"|data-act="level"|Computer|data-act="gmode"/);
  assert.match(html, /data-act="lside" data-side="random"/, "player 1's side: X, O or Random, as before");
  assert.match(html, /class="back" data-act="friend-go"/);
});
test("hosting: the host is Player 1 and the friend Player 2, X and O drawn when the match starts: no side to pick", () => {
  Object.assign(state, board(), { screen: 'setup', online: { role: 'host', code: 'ABCDE', me: 'X', joined: false } });
  state.setup.names = { X: 'Hosty', O: 'O' };
  const html = renderSetup();
  assert.match(html, /<span>Player 1 · you<\/span><input data-p="X" value="Hosty"/);
  assert.match(html, /<span>Player 2 · friend<\/span>/);
  assert.doesNotMatch(html, /data-act="side"|You play|X player|O player|goes first/);
  assert.match(html, /data-act="timer"/, 'the timer stays'); assert.match(html, /data-act="adv"/, 'and the mini-games');
  assert.match(html, />Share invite</);
  // the friend's join screen, seated: Player 1 the host, Player 2 them, the sides drawn; no mode
  state.online = { role: 'guest', code: 'ABCDE', me: 'O', joined: true };
  setRoom({ players: { X: { uid: 'h', name: 'Hosty' }, O: { uid: 'g', name: 'Gus' } }, setup: { games: { ttt: true }, timer: 60, hostPick: 'random' }, status: 'lobby' });
  const join = renderJoin();
  assert.match(join, /Player 1 · host<\/span><div class="namebox">Hosty/); assert.match(join, /Player 2 · you<\/span><div class="namebox">Gus/);
  assert.match(join, /X and O drawn at random each match/);
  assert.doesNotMatch(join, /Mode|Super Chaos|You play/);
  setRoom(null); state.online = null;
});
test('the side reveal: "You are X" against the computer or online; on a shared phone, who is which; the computer waits for it', () => {
  Object.assign(state, board(), { screen: 'board', online: null });
  MM.showSides({ X: { name: 'Ann' }, O: { name: 'Computer' } }, 'X');
  let html = renderIntro();
  assert.match(html, /<h2 class="vstitle">You are X<\/h2>/); assert.match(html, /<i>You<\/i>/); assert.match(html, /You go first/);
  assert.doesNotMatch(html, /<small>\d+-\d+-\d+<\/small>/, 'no record outside Find Match');
  MM.showSides({ X: { name: 'Ann' }, O: { name: 'Bo' } }, 'O');
  assert.match(renderIntro(), /You are O[^]*Ann goes first/);
  MM.showSides({ X: { name: 'Ann' }, O: { name: 'Bo' } }, null);
  html = renderIntro();
  assert.match(html, /Ann is X · Bo is O/); assert.doesNotMatch(html, /<i>You<\/i>/);
  let closed = 0; MM.onIntroClosed(() => { closed++; });
  MM.closeIntro();
  assert.equal(MM.mmIntro, null); assert.equal(closed, 1, 'its close lets the computer move');
  assert.equal(renderIntro(), '');
  MM.onIntroClosed(null);
});
test('the invite: the room code in the words and in the link (some apps drop one of them)', () => {
  assert.equal(inviteText('ABCDE', 'https://tictacchaos.com/?room=ABCDE'), 'Join my Tic Tac Chaos game! Code: ABCDE tictacchaos.com/?room=ABCDE');
});
