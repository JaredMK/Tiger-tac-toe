// Classic only, the new main menu, hosting as Player 1 and 2, the side reveal and the invite:
//   the main menu: Play Computer, Play a Friend, Find Match (no Play Local / Play Online, no mode);
//   Play Computer: its setup (You vs Computer, your side Random by default, Mini-games, difficulty Normal by default), then Start (core/match.js startCpu);
//   Play a Friend: Host, Join and a small Same phone; Same phone is two people (no computer, no mode);
//   the host's room: Player 1 (you) and Player 2 (friend), no X/O choice; the join screen likewise;
//   every match opens with the side reveal ("You are X", or who is which on a shared phone);
//   the invite is one text carrying the room's code and its link (shared with no separate url), and Copy invite copies it;
//   logged-in players play friend games under their username (no name field); against the computer, no waiting band.
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
const { inviteText, setRoom, shareRoom, copyInvite } = await import('../../src/net/room.js');
const { waitBand } = await import('../../src/ui/board.js');
const { acct } = await import('../../src/net/accounts.js');
const { SUPER_CHAOS_ENABLED } = await import('../../src/core/config.js');
const { state } = await import('../../src/ui/app.js');

const board = () => E.newMatch(E.makeRng('cm'), { games: ['ttt'] });
test('Super Chaos is off in the code, for everyone', () => assert.equal(SUPER_CHAOS_ENABLED, false));
test('the main menu: Play Computer, Play a Friend, Find Match, How to Play; no Play Local, Play Online or mode', () => {
  Object.assign(state, board(), { screen: 'menu', online: null });
  MM.setFindOn(true);
  const html = renderMenu();
  const acts = [...html.matchAll(/data-act="([^"]+)"/g)].map(m => m[1]);
  for (const a of ['cpu-go', 'friend-go', 'find-go', 'howto', 'settings', 'login']) assert.ok(acts.includes(a), a);
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
test('Play Computer: you against the computer, your side as picked (Random drawn), its level, the ticked mini-games; the Same phone setup untouched', () => {
  const st = board(), sides = new Set(), rng = E.makeRng('cpu');
  st.setup.games = Object.fromEntries(E.TYPES.map(t => [t, ['ttt', 'c4', 'hilo'].includes(t)]));
  st.setup.local = { pick: 'O', p2: 'human', n1: 'Ann', n2: 'Bo', level: 'easy' };
  assert.deepEqual(E.normCpu(st.setup), { pick: 'random', level: 'normal' }, 'Random and Normal by default');
  for (let k = 0; k < 20; k++) {
    const me = E.startCpu(st, rng, 'Ann');
    assert.ok(me === 'X' || me === 'O'); sides.add(me);
    assert.equal(st.cpu, E.other(me), 'the computer plays the other side'); assert.equal(st.cpuLevel, 'normal');
    assert.deepEqual([st.setup.names[me], st.setup.names[E.other(me)]], ['Ann', 'Computer']);
    assert.equal(st.quick, true); assert.equal(st.sc, null, 'Classic'); assert.equal(st.screen, 'board');
    assert.deepEqual(st.games.slice().sort(), ['c4', 'hilo', 'ttt'], 'the ticked mini-games');
  }
  assert.deepEqual([...sides].sort(), ['O', 'X'], 'Random: either side, drawn');
  st.setup.vsCpu = { pick: 'O', level: 'hard' };
  assert.equal(E.startCpu(st, rng, ''), 'O'); assert.equal(st.cpuLevel, 'hard'); assert.equal(st.setup.names.O, 'You', 'no name: You');
  assert.deepEqual(st.setup.local, { pick: 'O', p2: 'human', n1: 'Ann', n2: 'Bo', level: 'easy' }, "Same phone's choices kept as they were");
  assert.equal(E.startMatch(st, rng), true); assert.equal(st.quick, false, 'a Same phone match is not a Play Computer one');
});
test('Play Computer: its setup screen: You vs Computer, your side (Random), Mini-games (All), difficulty, Start; back to the main menu', () => {
  Object.assign(state, board(), { screen: 'setup', online: null });
  state.setup.vs = 'cpu'; state.setup.vsCpu = null;
  for (const t of E.TYPES) state.setup.games[t] = true;
  const html = renderSetup();
  assert.match(html, /<b>Play Computer<\/b><small>You vs Computer<\/small>/);
  assert.match(html, /data-act="cside" data-side="random" aria-pressed="true"/, 'your side: Random by default');
  assert.match(html, /data-act="cside" data-side="X"/); assert.match(html, /data-act="cside" data-side="O"/);
  assert.match(html, /<b>You<\/b>/); assert.match(html, /<b>Computer<\/b>/, 'You vs Computer');
  assert.match(html, /data-act="clevel" data-v="normal" aria-pressed="true"/, 'Normal by default'); assert.match(html, /data-act="clevel" data-v="easy"/); assert.match(html, /data-act="clevel" data-v="hard"/);
  assert.match(html, /data-act="adv"[^>]*><span>Mini-games<\/span><small>All<\/small>/, 'Mini-games: All, and editable');
  assert.match(html, /data-act="start"/); assert.match(html, /class="back" data-act="menu"/);
  assert.doesNotMatch(html, /data-ln=|data-act="kind"|data-act="gmode"/, 'no name to type, no mode');
  state.setup.vs = 'same';
});
test('Same phone: two people on this phone, no computer, no level, no mode; back to Play a Friend', () => {
  Object.assign(state, board(), { screen: 'setup', online: null });
  state.setup.vs = 'same';
  const html = renderSetup();
  assert.match(html, /<b>Same phone<\/b>/);
  assert.doesNotMatch(html, /data-act="kind"|data-act="level"|Computer|data-act="gmode"/);
  assert.match(html, /data-act="lside" data-side="random"/, "player 1's side: X, O or Random, as before");
  assert.match(html, /class="back" data-act="friend-go"/);
});
test("hosting: the host is Player 1 and the friend Player 2, X and O drawn when the match starts: no side to pick", () => {
  Object.assign(state, board(), { screen: 'setup', online: { role: 'host', code: 'ABCDE', me: 'X', joined: false } });
  state.setup.names = { X: 'Hosty', O: 'O' };
  acct.profile = { username: 'hosty_k' }; acct.user = { uid: 'h' };
  const html = renderSetup();
  assert.match(html, /<span>Player 1 · you<\/span><div class="namebox">hosty_k<\/div>/, 'the host plays under their username');
  assert.doesNotMatch(html, /data-p=|placeholder="Your name"/, 'no name field to edit');
  assert.match(html, /<span>Player 2 · friend<\/span>/);
  assert.doesNotMatch(html, /data-act="side"|You play|X player|O player|goes first/);
  assert.match(html, /data-act="timer"/, 'the timer stays'); assert.match(html, /data-act="adv"/, 'and the mini-games');
  assert.match(html, /data-act="share">Share invite<\/button><button class="btn" data-act="copy-invite">Copy invite<\/button>/, 'Share invite and Copy invite');
  // the friend's join screen, seated: Player 1 the host, Player 2 them, the sides drawn; no mode
  state.online = { role: 'guest', code: 'ABCDE', me: 'O', joined: true };
  setRoom({ players: { X: { uid: 'h', name: 'Hosty' }, O: { uid: 'g', name: 'Gus' } }, setup: { games: { ttt: true }, timer: 60, hostPick: 'random' }, status: 'lobby' });
  const join = renderJoin();
  assert.match(join, /Player 1 · host<\/span><div class="namebox">Hosty/); assert.match(join, /Player 2 · you<\/span><div class="namebox">Gus/);
  assert.match(join, /X and O drawn at random each match/);
  assert.doesNotMatch(join, /Mode|Super Chaos|You play/);
  setRoom(null);
  // the join form: a logged-in player joins under their username (no name field); a guest types a name
  state.online = null;
  let form = renderJoin();
  assert.match(form, /You play as<\/span><div class="namebox">hosty_k/); assert.doesNotMatch(form, /id="jname"/); assert.match(form, /id="jcode"/);
  acct.profile = null; acct.user = null;
  form = renderJoin();
  assert.match(form, /id="jname"/, 'a guest enters a name'); assert.match(form, /id="jcode"/);
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
test('the invite: one text with the code and the full link, shared with no separate url field (iMessage drops the text when one comes)', async () => {
  assert.equal(inviteText('ABCDE', 'https://tictacchaos.com/?room=ABCDE'), 'Join my Tic Tac Chaos game! Code: ABCDE https://tictacchaos.com/?room=ABCDE');
  const shared = [];
  const nav = globalThis.navigator, loc = globalThis.location;
  globalThis.location = { protocol: 'https:', origin: 'https://tictacchaos.com', pathname: '/' };
  globalThis.navigator = { share: async d => { shared.push(d); } };
  Object.assign(state, board(), { screen: 'setup', online: { role: 'host', code: 'ABCDE', me: 'X', joined: false } });
  await shareRoom();
  assert.equal(shared.length, 1); assert.deepEqual(Object.keys(shared[0]), ['text'], 'the text alone');
  assert.equal(shared[0].text, 'Join my Tic Tac Chaos game! Code: ABCDE https://tictacchaos.com/?room=ABCDE');
  const copied = [];
  globalThis.navigator = { clipboard: { writeText: async t => { copied.push(t); } } };
  await copyInvite();
  assert.deepEqual(copied, [shared[0].text], 'Copy invite: the same text');
  globalThis.navigator = nav; globalThis.location = loc; state.online = null;
});
test('against the computer: no waiting band while it plays (its square lights up and its move replays)', () => {
  E.startCpu(Object.assign(state, board()), E.makeRng('band'), 'Ann');
  state.screen = 'board'; state.turn = state.cpu;
  assert.equal(waitBand(null).on, false, 'no band on the computer\'s turn');
  assert.doesNotMatch(waitBand(null).html, /is playing/);
});
