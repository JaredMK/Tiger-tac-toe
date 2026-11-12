// Thirty-One's screen and miniature (src/games/t31/view.js), rendered in Node with the browser's names stubbed (v 2: one
// deck and one pile, private hands). The tally a player sees is their hand's best suit total at every step of a square
// played out: before a move, through a take (the card counting as it lands), through a discard, during the other side's
// moves (their replay), live against the computer and from the online record with this side's own node; the other
// side's tally is "?" until the square is won; nothing of the other hand or the deck ever reaches the markup. (The bug
// this guards: a move's flash carried `score` twice, the mover's number overwritten by an object, so the result line read
// "[object Object] in spades", and the tally and the lit cards ignored the card just taken.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
Object.defineProperty(globalThis, 'window', { value: new Proxy(function () {}, { get: (t, k) => (k === 'matchMedia' ? () => ({ matches: false, addEventListener() {}, addListener() {} }) : k === Symbol.toPrimitive ? () => '' : stub()), apply: () => stub(), construct: () => stub(), set: () => true }), configurable: true, writable: true });
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const R = require('../../src/games/t31/rules.js');
const { GAMES } = await import('../../src/games/index.js');
const V = await import('../../src/games/t31/view.js');
const { hideMini } = await import('../../src/core/records.js');
const { state } = await import('../../src/ui/app.js');
state.setup = Object.assign({}, state.setup, { names: { X: 'Xena', O: 'Olaf' } });
const seat = me => { state.online = null; state.cpu = me === 'X' ? 'O' : 'X'; };   // this page is `me` (net/room.js mySide: against the computer, the player's side)

const clone = v => JSON.parse(JSON.stringify(v));
const other = p => (p === 'X' ? 'O' : 'X');
const pv = (m, p) => E.publicMini(m, p);
// A move on a copy of the square: the square after it and the move's flash (what the page and a replay get).
function play(mini, p, mv, rng) {
  const m = clone(mini), res = E.applyMove(m, p, mv, rng || E.makeRng('p'));
  assert.equal(res.ok, true, res.reason);
  const won = res.outcome === 'win';
  const flash = { kind: won ? 'claim' : res.again ? 'again' : 'move', by: p, next: p, square: 0, type: 't31', note: res.note || null, pass: null, timeout: false, m: mv };
  GAMES.t31.rules.moveFlash(mv, p, null, 0, m, flash);
  return { mini: m, flash, res, won };
}
const screen = (mini, flash, turn, o = {}) => V.screen({ owner: o.owner || null, mini }, flash, null, mini, !!o.view, !!flash || !!o.view || !!o.locked, flash, null, false, () => -1, false, turn, '');
// A side's tally as drawn: { text (the figure at rest, as the markup has it), from (what it counts on from, or null), hidden }.
function tally(html, p) {
  const m = new RegExp(`<div class="ctal ${p}[^"]*">.*?<span class="t31sc([^"]*)"[^>]*>(.*?)</span></div>`).exec(html);
  assert.ok(m, `${p}'s tally is on the screen`);
  const b = /<b([^>]*)>([^<]*)<\/b>/.exec(m[2]), from = /data-from="(\d+)"/.exec(b[1]);
  return { text: b[2], from: from ? Number(from[1]) : null, hidden: /\bhid\b/.test(m[1]), target: Number(/<small>\/(\d+)<\/small>/.exec(m[2])[1]) };
}
const faces = html => [...html.matchAll(/aria-label="((?:\d+|Jack|Queen|King|Ace) of (?:spades|hearts|diamonds|clubs))"/g)].map(m => m[1]);
const NAME = c => `${{ T: '10', J: 'Jack', Q: 'Queen', K: 'King', A: 'Ace' }[c[0]] || c[0]} of ${{ S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' }[c[1]]}`;
// What this page may show of the cards: its own hand, the pile's top two, a card the other side took off the pile and holds.
function publicFaces(mini, me, flash) {
  const ok = new Set([...(mini.hand[me] || []), ...mini.pile.slice(-2), ...mini.seen[other(me)]]);
  if (flash && flash.t31 && flash.t31.card) ok.add(flash.t31.card);
  return new Set([...ok].map(NAME));
}

test('the tally is the hand\'s best suit total at every step of a square played out, for this side, live and through the other side\'s moves; the other side\'s is "?"; no card of theirs or of the deck in the markup', () => {
  let steps = 0, games = 0;
  for (const me of ['X', 'O']) for (let g = 0; g < 12; g++) {
    seat(me);
    const rng = E.makeRng(`t31-ui-${me}-${g}`); let mini = E.newMini('t31', rng), p = 'X', over = false;
    for (let n = 0; n < 300 && !over; n++) {
      // at rest, before the move
      const idle = screen(mini, null, p), mine = tally(idle, me), theirs = tally(idle, other(me));
      assert.equal(mine.text, String(R.t31Score(mini.hand[me])), `at rest, move ${n}`); assert.equal(mine.from, null); assert.equal(mine.target, 30);
      assert.ok(theirs.hidden && theirs.text === '?', 'the other side\'s score is theirs alone');
      for (const f of faces(idle)) assert.ok(publicFaces(mini, me).has(f), `at rest: ${f} is not this page's to show`);
      const mv = E.localBest(pv(mini, p), p, rng, {}, { level: n % 3 ? 'normal' : 'easy' }).move;
      const before = mini, out = play(mini, p, mv, rng); mini = out.mini;
      const html = screen(mini, out.flash, p, { owner: out.won ? p : null }), t = tally(html, me);
      // through the move: the figure it ends on is the hand's score; what it counts on from is the figure shown before
      assert.equal(t.text, String(R.t31Score(mini.hand[me])), `move ${n} ${mv} by ${p}: ${me}'s tally`);
      assert.ok(Number(t.text) >= 7 && Number(t.text) <= 31, 'never 0, never over 31');
      if (p === me) { if (t.from != null) { assert.equal(t.from, R.t31Score(before.hand[me]), 'counted on from the figure before'); assert.notEqual(t.from, Number(t.text)); } else assert.equal(R.t31Score(before.hand[me]), R.t31Score(mini.hand[me]), 'no count: no change'); }
      else assert.equal(t.from, null, 'the other side\'s move never moves this side\'s figure');
      if (!out.won) {
        const o = tally(html, other(me));
        assert.ok(o.hidden && o.text === '?', 'the other side\'s score stays hidden through the move');
        for (const f of faces(html)) assert.ok(publicFaces(mini, me, out.flash).has(f), `move ${n} ${mv} by ${p}: ${f} is not this page's to show`);
        assert.ok(!/\[object/.test(html) && !/undefined|NaN/.test(html.replace(/data-[a-z]+="[^"]*"/g, '')), 'no stray value in the markup');
      } else {
        // a square won: both hands are open (the record of a claimed square is whole), both scores shown
        const o = tally(html, other(me));
        assert.ok(!o.hidden); assert.equal(o.text, String(R.t31Score(mini.hand[other(me)])));
        assert.ok(Number(tally(html, p).text) >= 30, 'the winner at the target');
        over = true; games++;
      }
      steps++;
      if (!out.res.again) p = other(p);
    }
    assert.ok(over, 'the square was won');
  }
  assert.equal(games, 24); assert.ok(steps > 150, 'steps checked: ' + steps);
});

test('online: the tally from the record and this side\'s own node, move by move, the node in step or a moment behind the record; the other phone shows nothing of the hand', () => {
  const st = E.newMatch(E.makeRng('t31-on'), { games: ['t31'] }), k = 4;
  let rec = E.matchRecord(st), p = st.turn, n = 0;
  const rng = E.makeRng('t31-on-play');
  // a phone's square: the public one with its own side's part merged in (net/room.js mergeMySides)
  const phone = (r, side, sides) => { const m = clone(r.state.squares[k].mini); R.sideMerge(m, side, clone((sides || r.sides)[side][k])); return m; };
  for (; n < 200; n++) {
    const full = E.fullState(rec).squares[k].mini, mv = E.localBest(pv(full, p), p, rng, {}, { level: 'normal' }).move;
    const out = E.applyOnlineMove(rec, p, k, mv, rng);
    assert.ok(out.ok, out.reason);
    const e = out.entries[0], after = E.fullState(out.rec).squares[k];
    if (after.owner) break;
    const flash = Object.assign({}, e); delete flash.after; delete flash.before;
    for (const side of ['X', 'O']) {
      state.cpu = null; state.online = { me: side, kind: 'mm' };
      const want = String(R.t31Score(after.mini.hand[side]));
      // the record and the node together
      const m1 = phone(out.rec, side), h1 = screen(m1, flash, p);
      assert.equal(tally(h1, side).text, want, `move ${n} ${mv} by ${p}: ${side}'s phone`);
      assert.ok(tally(h1, other(side)).hidden);
      for (const f of faces(h1)) assert.ok(publicFaces(after.mini, side, flash).has(f), `${side}'s phone shows ${f}`);
      // the record first, the node still the one before (the page's listeners fire one after the other)
      const m0 = phone(out.rec, side, rec.sides), h0 = screen(m0, flash, p), t0 = tally(h0, side);
      if (side !== p || mv !== 'deck') assert.equal(t0.text, want, `move ${n} ${mv} by ${p}: ${side}'s phone, its node a moment behind`);
      else assert.equal(t0.text, String(R.t31Score(full.hand[side])), 'a card off the deck not here yet: the hand as it was, never a 0');
      assert.ok(Number(t0.text) >= 7);
      for (const f of faces(h0)) assert.ok(publicFaces(after.mini, side, flash).has(f) || full.hand[side].map(NAME).includes(f), `${side}'s phone, behind, shows ${f}`);
      // at rest afterwards
      assert.equal(tally(screen(m1, null, e.kind === 'again' ? p : other(p)), side).text, want);
    }
    // a phone with no node at all (a watcher, the first moment after a reload): both tallies hidden, card backs alone
    state.online = { me: 'X', kind: 'mm' };
    const bare = screen(clone(out.rec.state.squares[k].mini), null, p);
    assert.ok(tally(bare, 'X').hidden && tally(bare, 'O').hidden);
    for (const f of faces(bare)) assert.ok([...after.mini.pile.slice(-2), ...after.mini.seen.X, ...after.mini.seen.O].map(NAME).includes(f));
    rec = out.rec;
    if (e.kind !== 'again') p = other(p);
  }
  assert.ok(n > 6, 'moves checked: ' + n);
  state.online = null;
});

test('a move\'s steps: a take counts the new card as it lands (the best three of four), a discard counts on from there; the result line says the score in words; the best suit\'s cards are lit', () => {
  seat('X');
  const m = E.newMini('t31', E.makeRng('steps'));
  Object.assign(m, { hand: { X: ['TS', 'TH', '8C'], O: ['7D', '9H', 'KC'] }, deck: ['7C', 'AS'], left: 2, pile: ['QD'] });
  assert.equal(tally(screen(m, null, 'X'), 'X').text, '10');
  const take = play(m, 'X', 'deck');                                 // the ace of spades: two tens and an ace in hand
  let html = screen(take.mini, take.flash, 'X'), t = tally(html, 'X');
  assert.deepEqual([t.text, t.from], ['21', 10], 'the ace counts with its ten as it lands');
  assert.match(html, /data-from="10" data-delay="560"/, 'as the card has turned up');
  assert.match(html, />Took <span class="cshort suS">A/);
  html = screen(take.mini, null, 'X');
  assert.equal(tally(html, 'X').text, '21', 'two tens and an ace, one ten the ace\'s suit: 21, with the card still to let go');
  const lit = [...html.matchAll(/<button class="t31c([^"]*)"[^>]*data-m='"(d\d)"'/g)].map(x => [x[2], /\bbest\b/.test(x[1])]);
  assert.deepEqual(lit, [['d0', true], ['d1', false], ['d2', false], ['d3', true]], 'the ten and the ace of spades are lit');
  const drop = play(take.mini, 'X', 'd2');                           // the 8 of clubs goes
  html = screen(drop.mini, drop.flash, 'O'); t = tally(html, 'X');
  assert.deepEqual([t.text, t.from], ['21', null], 'the best discard: the figure stands');
  assert.match(html, /role="status">21 in spades</); assert.match(html, /class="arcres ok appear"/, 'a higher score than before the take');
  const bad = play(take.mini, 'X', 'd3');                            // the ace thrown back
  html = screen(bad.mini, bad.flash, 'O'); t = tally(html, 'X');
  assert.deepEqual([t.text, t.from], ['10', 21], 'a worse discard counts down as the card lands');
  assert.match(html, /data-from="21" data-delay="620"/); assert.match(html, /role="status">10 in spades</);
  assert.equal(V.moveText(drop.flash, 'Xena'), 'Xena threw a card'); assert.equal(V.moveText(take.flash, 'Xena'), 'Xena drew a card');
  // the other side's move, seen from here: its cards as backs, a card off the pile face up while it is the one in hand
  const ot = play(drop.mini, 'O', 'pile');
  html = screen(ot.mini, ot.flash, 'O');
  assert.equal(tally(html, 'X').text, '21'); assert.ok(tally(html, 'O').hidden);
  assert.match(html, /Olaf<\/b> took <span class="cshort suC">8/); assert.match(html, /data-cf="pile"/, 'the card flies from the pile to their hand');
  assert.deepEqual(faces(html).filter(f => f === '8 of clubs').length, 1, 'the card they took was on show');
  for (const c of ['7D', '9H', 'KC', '7C']) assert.ok(!faces(html).includes(NAME(c)), `${c} is theirs alone`);
  const od = play(ot.mini, 'O', 'd0');
  html = screen(od.mini, od.flash, 'X');
  assert.match(html, /Olaf<\/b> threw <span class="cshort red suD">7/); assert.match(html, /data-cf="opp:0"/, 'thrown from its place in their hand');
  assert.ok(tally(html, 'O').hidden);
  // a win: 31, the hands open
  const w = E.newMini('t31', E.makeRng('win'));
  Object.assign(w, { hand: { X: ['TS', '8C', 'AS'], O: ['7D', '9H', 'KC'] }, deck: ['7C'], left: 1, pile: ['JS'] });
  const wt = play(w, 'X', 'pile'), wd = play(wt.mini, 'X', 'd1');
  assert.ok(wd.won); html = screen(wd.mini, wd.flash, 'X', { owner: 'X' });
  assert.deepEqual([tally(html, 'X').text, tally(html, 'X').from, tally(html, 'O').text], ['31', null, '10']);
  assert.match(html, /role="status">31!</); assert.equal(V.moveText(wd.flash, 'Xena'), 'Xena: 31 in one suit');
  seat('O'); html = screen(wd.mini, wd.flash, 'X', { owner: 'X' });   // the loser's phone: the winning hand turned up
  assert.equal(tally(html, 'X').text, '31'); for (const c of ['TS', 'AS', 'JS']) assert.ok(faces(html).includes(NAME(c)));
});

test('the controls: the deck and the pile to take, a hand card to let go (deck, pile, d0 to d3), open only when they can be used', () => {
  seat('X');
  const m = E.newMini('t31', E.makeRng('ctl'));
  const ctl = html => Object.fromEntries([...html.matchAll(/<button[^>]*data-m='"([a-z0-9]+)"'[^>]*>/g)].map(x => [x[1], !/ disabled/.test(x[0])]));
  let c = ctl(screen(m, null, 'X'));
  assert.deepEqual(c, { deck: true, pile: false, d0: false, d1: false, d2: false }, 'the first take is from the deck: the pile is empty');
  const t = play(m, 'X', 'deck'); c = ctl(screen(t.mini, null, 'X'));
  assert.deepEqual(c, { deck: false, pile: false, d0: true, d1: true, d2: true, d3: true }, 'a card taken: any of the four goes');
  const d = play(t.mini, 'X', 'd3'); c = ctl(screen(d.mini, null, 'O', { locked: true }));
  assert.deepEqual(c, { deck: false, pile: false }, 'the other side\'s turn: nothing to tap, and no move of this hand\'s for their replayed press to land on');
  c = ctl(screen(play(play(d.mini, 'O', 'deck').mini, 'O', 'd3').mini, null, 'X'));
  assert.deepEqual(c, { deck: true, pile: true, d0: false, d1: false, d2: false });
});

test('the miniature: public alone (the same from the hidden square as from the full one), a picture of the table with each hand as backs', () => {
  const rng = E.makeRng('t31-mini'); let m = E.newMini('t31', rng), p = 'X';
  for (let n = 0; n < 14; n++) {
    const hid = clone(m); hideMini(hid, 0, {});
    const a = V.miniature(m, false), b = V.miniature(hid, false);
    assert.equal(a, b, 'move ' + n);
    const shown = [...a.matchAll(/<i class="tcd[^"]* su([SHDC])"><b>([^<]+)<\/b>/g)].map(x => (x[2] === '10' ? 'T' : x[2]) + x[1]);
    assert.deepEqual(shown, m.pile.slice(-1), 'the one face on the board is the pile\'s top card');
    assert.equal((a.match(/tt31b X/g) || []).length, m.hand.X.length); assert.equal((a.match(/tt31b O/g) || []).length, m.hand.O.length);
    assert.ok(!/\d+\/30|>\d\d<\/span>/.test(a), 'no score on the board');
    const r = E.applyMove(m, p, E.localBest(pv(m, p), p, rng, {}, { level: 'easy' }).move, rng);
    if (r.outcome === 'win') break;
    if (!r.again) p = other(p);
  }
  // a square from before the rework (as a claimed one may still be in a match under way): drawn without a throw
  const old = { type: 't31', v: 1, hand: { X: ['2C', '3H', '4D'], O: ['5C', '6H', '9D'] }, pile: { X: ['9C'], O: ['8C'] }, deckN: { X: 1, O: 1 }, held: null, turns: { X: 0, O: 0 }, last: null };
  assert.ok(V.miniature(old, false).includes('tt31w'));
  seat('X'); assert.ok(screen(old, null, 'X', { view: true, owner: 'X' }).includes('t31felt'));
});
