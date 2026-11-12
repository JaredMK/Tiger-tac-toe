// Rummy Lite's screen and miniature (src/games/rummy/view.js; the polish sweep, November 2026: Thirty-One's sibling),
// rendered in Node with the browser's names stubbed. One felt: the other hand as card backs (seven small places, so it
// never runs off a 360 px screen), the shared deck and pile, this phone's own hand (one card size whatever it holds).
// Nothing of the other hand or the deck ever reaches the markup; this side's hand stays drawn through the other side's
// moves, live against the computer and from the online record with this side's own node in step, a moment behind, or
// missing (the square as it was before their move: net/room.js presentEntry); a new meld lights with the throw that
// keeps it; the controls are the deck, the pile and the hand's cards, as they were.
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
const R = require('../../src/games/rummy/rules.js');
const { GAMES } = await import('../../src/games/index.js');
const V = await import('../../src/games/rummy/view.js');
const { hideMini } = await import('../../src/core/records.js');
const { state } = await import('../../src/ui/app.js');
const Room = await import('../../src/net/room.js');
const Rep = await import('../../src/ui/replay.js');
GAMES.rummy.view = V;   // (the page registers the views in main.js; here by hand)
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
  const flash = { kind: won ? 'claim' : res.again ? 'again' : 'move', by: p, next: p, square: 0, type: 'rummy', note: res.note || null, pass: null, timeout: false, m: mv };
  GAMES.rummy.rules.moveFlash(mv, p, null, 0, m, flash);
  return { mini: m, flash, res, won };
}
const screen = (mini, flash, turn, o = {}) => V.screen({ owner: o.owner || null, mini }, flash, null, mini, !!o.view, !!flash || !!o.view || !!o.locked, flash, null, false, () => -1, false, turn, '');
const NAME = c => `${{ T: '10', J: 'Jack', Q: 'Queen', K: 'King', A: 'Ace' }[c[0]] || c[0]} of ${{ S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' }[c[1]]}`;
const faces = html => [...html.matchAll(/((?:\d+|Jack|Queen|King|Ace) of (?:spades|hearts|diamonds|clubs))/g)].map(m => m[1]);   // (every card named anywhere: a card's label, a button's)
// The cards this page's own hand shows, in the row's order.
const myCards = html => { const row = /<div class="rmyhand [XO]"[^>]*>(.*?)<\/div><\/div><\/div>$/s.exec(html); assert.ok(row, 'the hand row is on the screen'); return [...row[1].matchAll(/data-anchor="card:(..)"/g)].map(m => m[1]); };
const oppRow = html => /<div class="rmyoh">(.*?)<\/div><\/div><div class="rmytop">/s.exec(html)[1];
// What this page may show of the cards: its own hand, the pile's top two (the pile is open), a card the other side took
// off the pile and holds, the card a move threw or took off the pile.
function publicFaces(mini, me, flash) {
  const ok = new Set([...(mini.hand[me] || []), ...mini.pile.slice(-2)]);
  if (mini.held && mini.held.from === 'pile' && mini.held.c) ok.add(mini.held.c);
  const r = flash && flash.rummy; if (r && r.c) ok.add(r.c); if (r && r.d) ok.add(r.d);
  return new Set([...ok].map(NAME));
}
const pips = (html, p) => { const m = new RegExp(`<div class="ctal ${p}[^"]*">.*?<span class="pips"[^>]*>(.*?)</span></div>`).exec(html); assert.ok(m, `${p}'s tally`); return { on: (m[1].match(/class="on/g) || []).length, fill: (m[1].match(/fillin/g) || []).length }; };

test('whole squares: this side\'s hand is drawn at every step (its own moves and the other side\'s), the tallies are the melds held, and no card of the other hand or of the deck is in the markup', () => {
  let steps = 0, games = 0;
  for (const me of ['X', 'O']) for (let g = 0; g < 10; g++) {
    seat(me);
    const rng = E.makeRng(`rmy-ui-${me}-${g}`); let mini = E.newMini('rummy', rng), p = 'X', over = false;
    for (let n = 0; n < 400 && !over; n++) {
      const idle = screen(mini, null, p);
      assert.deepEqual(myCards(idle).slice().sort(), mini.hand[me].slice().sort(), `at rest, move ${n}: the hand`);
      for (const f of faces(idle)) assert.ok(publicFaces(mini, me).has(f), `at rest: ${f} is not this page's to show`);
      assert.equal(pips(idle, 'X').on, mini.mc.X); assert.equal(pips(idle, 'O').on, mini.mc.O);
      const mv = E.localBest(pv(mini, p), p, rng, {}, { level: n % 3 ? 'normal' : 'easy' }).move;
      const out = play(mini, p, mv, rng); mini = out.mini;
      const html = screen(mini, out.flash, p, { owner: out.won ? p : null });
      assert.deepEqual(myCards(html).slice().sort(), mini.hand[me].slice().sort(), `move ${n} by ${p}: ${me}'s hand`);
      assert.ok(!/\[object|undefined|NaN/.test(html.replace(/data-[a-z]+="[^"]*"/g, '')), 'no stray value in the markup');
      if (!out.won) for (const f of faces(html)) assert.ok(publicFaces(mini, me, out.flash).has(f), `move ${n} ${JSON.stringify(mv)} by ${p}: ${f} is not this page's to show`);
      else {
        // a square won: both hands are open (the record of a claimed square is whole): the other one is turned up
        for (const c of mini.hand[other(me)]) assert.ok(faces(html).includes(NAME(c)), 'the other hand is shown once the square is won');
        assert.match(html, /role="status">2 melds!</);
        over = true; games++;
      }
      steps++;
      if (!out.res.again) p = other(p);
    }
    assert.ok(over, 'the square was won');
  }
  assert.equal(games, 20); assert.ok(steps > 150, 'steps checked: ' + steps);
});

test('online: the hand from the record and this side\'s own node, move by move, the node in step, a moment behind, or missing while the other side\'s move replays; the other phone shows nothing of it', () => {
  const st = E.newMatch(E.makeRng('rmy-on'), { games: ['rummy'] }), k = 4;
  let rec = E.matchRecord(st), p = st.turn, n = 0;
  const rng = E.makeRng('rmy-on-play');
  const phone = (r, side, sides) => { const m = clone(r.state.squares[k].mini); R.sideMerge(m, side, clone((sides || r.sides)[side][k])); return m; };   // the public square with its own side's part (net/room.js mergeMySides)
  for (; n < 200; n++) {
    const full = E.fullState(rec).squares[k].mini, mv = E.localBest(pv(full, p), p, rng, {}, { level: 'normal' }).move;
    const out = E.applyOnlineMove(rec, p, k, mv, rng);
    assert.ok(out.ok, out.reason);
    const e = out.entries[0], after = E.fullState(out.rec).squares[k];
    if (after.owner) break;
    const flash = Object.assign({}, e); delete flash.after; delete flash.before;
    for (const side of ['X', 'O']) {
      state.cpu = null; state.online = { me: side, kind: 'mm', game: 'g0' };
      const want = after.mini.hand[side].slice().sort();
      // the record and the node together
      const h1 = screen(phone(out.rec, side), flash, p);
      assert.deepEqual(myCards(h1).slice().sort(), want, `move ${n} ${JSON.stringify(mv)} by ${p}: ${side}'s phone`);
      for (const f of faces(h1)) assert.ok(publicFaces(after.mini, side, flash).has(f), `${side}'s phone shows ${f}`);
      // the record first, the node still the one before (the page's listeners fire one after the other)
      const h0 = screen(phone(out.rec, side, rec.sides), flash, p), got = myCards(h0).slice().sort();
      if (side !== p || mv !== 'deck') assert.deepEqual(got, want, `move ${n} ${JSON.stringify(mv)} by ${p}: ${side}'s phone, its node a moment behind`);
      else { assert.deepEqual(got, full.hand[side].slice().sort(), 'a card off the deck not here yet: the hand as it was'); assert.equal((h0.match(/class="rmyc rmyw"/g) || []).length, 1, 'and a back in its place, flying in'); }
      for (const f of faces(h0)) assert.ok(publicFaces(after.mini, side, flash).has(f) || full.hand[side].map(NAME).includes(f), `${side}'s phone, behind, shows ${f}`);
    }
    // the other side's move replays on the square as it was before it (the public record alone): this side's hand stays drawn
    const waiter = e.kind === 'again' ? other(p) : p;                 // (whoever does not move next: the phone that will watch the next move's replay)
    state.online = { me: waiter, kind: 'mm', game: 'g1' };
    screen(phone(out.rec, waiter), null, other(waiter));
    const held0 = screen(clone(out.rec.state.squares[k].mini), null, other(waiter));
    assert.deepEqual(myCards(held0).slice().sort(), after.mini.hand[waiter].slice().sort(), 'the hand last drawn here stands in while the record has none');
    assert.ok(!/class="rmyc rmyw"/.test(held0), 'none of its cards a back');
    // a phone with no node at all (another match, the first moment after a reload): card backs alone
    state.online = { me: 'X', kind: 'mm', game: 'g2' };
    const bare = screen(clone(out.rec.state.squares[k].mini), null, p);
    assert.deepEqual(myCards(bare), []);
    for (const f of faces(bare)) assert.ok([...after.mini.pile.slice(-2), ...(after.mini.held && after.mini.held.from === 'pile' ? [after.mini.held.c] : [])].map(NAME).includes(f));
    rec = out.rec;
    if (e.kind !== 'again') p = other(p);
  }
  assert.ok(n > 6, 'moves checked: ' + n);
  state.online = null;
});

test('online: the other side\'s move is played back on the square as it was, with this side\'s own part on it (net/room.js presentEntry)', () => {
  const st = E.newMatch(E.makeRng('rmy-pe'), { games: ['rummy'] }), k = 4;
  const rec = E.matchRecord(st), p = st.turn, me = other(p), rng = E.makeRng('rmy-pe-play');
  const out = E.applyOnlineMove(rec, p, k, 'deck', rng);
  assert.ok(out.ok && out.entries[0].before, 'the entry carries the square as it was');
  assert.deepEqual(out.entries[0].before.mini.hand, {}, 'which is the public record: no hand on it');
  const mine = E.fullState(out.rec).squares[k].mini.hand[me];
  Object.assign(state, clone(rec.state), { online: { me, kind: 'mm', game: 'pe', shownSeq: rec.state.seq }, cpu: null, screen: 'mini', zoom: k, flash: null, done: null, spot: null });
  Room.setMySides(clone(out.rec.sides[me]));
  Room.presentEntry(E.parseMatch({ state: JSON.stringify(out.rec.state) }).state, clone(out.entries[0]), []);
  assert.deepEqual(state.squares[k].mini.hand[me], mine, 'this side\'s hand is on the square while their take replays');
  assert.equal(state.squares[k].mini.held, null, 'the square as it was before the take');
  assert.equal(state.squares[k].mini.hand[p], undefined, 'and nothing of theirs');
  Rep.repStop(); Room.setMySides(null); state.online = null; state.flash = null; state.spot = null;
});

test('the table: seven small places for the other hand, the hand\'s cards one size whatever it holds, the melds grouped and ringed; a take makes room, a throw closes up and a new meld lights with it', () => {
  seat('X');
  const m = E.newMini('rummy', E.makeRng('tbl'));
  Object.assign(m, { hand: { X: ['2S', '3S', '5H', '5D', '8C', '7D'], O: ['AS', 'AH', 'AD', '6C', '7C', '8D'] }, deck: ['KS', '5C'], left: 2, pile: ['3D', '4S'], mc: { X: 0, O: 1 }, hn: { X: 6, O: 6 } });
  let html = screen(m, null, 'X');
  assert.equal((oppRow(html).match(/class="rmyo"/g) || []).length, 6); assert.equal((oppRow(html).match(/class="rmyslot"/g) || []).length, 1, 'six backs and the seventh place kept');
  assert.ok(!/--n:/.test(html), 'no card size by the hand\'s count');
  assert.ok(!/Take a card|Throw a card/.test(html), 'no instruction on the table');
  assert.match(html, /class="rmydeck can"/); assert.match(html, /class="rmypile can"/, 'the deck and the pile are lit to take from');
  assert.deepEqual([pips(html, 'X').on, pips(html, 'O').on], [0, 1]);
  // the 4 of spades off the pile: 2-3-4 of spades, grouped first, hopping as the card lands
  const take = play(m, 'X', 'pile'); html = screen(take.mini, take.flash, 'X');
  assert.deepEqual(myCards(html), ['2S', '3S', '4S', '5H', '5D', '7D', '8C']);
  assert.equal((html.match(/class="rmygrp"/g) || []).length, 1); assert.equal((html.match(/rmym[^"]* hop/g) || []).length, 3, 'the meld the card made hops');
  assert.match(html, /role="status">Took <span class="cshort suS">4/); assert.match(html, /data-cf="pile"/);
  assert.equal(pips(html, 'X').on, 0, 'the tally counts it once the throw keeps it');
  html = screen(take.mini, null, 'X');
  assert.equal((html.match(/<button class="rmyc[^"]* can"/g) || []).length, 7, 'every card of the seven can go');
  assert.match(html, /class="rmyc rmym new can"[^>]*data-anchor="card:4S"/, 'the card just taken is marked');
  const drop = play(take.mini, 'X', { d: '7D' }); html = screen(drop.mini, drop.flash, 'X');
  assert.equal(drop.flash.note, 'meld'); assert.match(html, /class="arcres ok appear"[^>]*role="status">Meld!</);
  assert.deepEqual(pips(html, 'X'), { on: 1, fill: 1 }); assert.equal((html.match(/rmym[^"]* hop/g) || []).length, 3);
  assert.match(html, /class="plc[^"]*rmyin[^"]*"[^>]*data-cf="card:7D"/, 'the card flies from its place in the hand to the pile');
  // a throw that makes nothing: said plainly, nothing lights
  const dull = play(take.mini, 'X', { d: '4S' }); html = screen(dull.mini, dull.flash, 'X');
  assert.match(html, /Xena<\/b> threw <span class="cshort suS">4/); assert.equal(pips(html, 'X').fill, 0); assert.ok(!/ hop/.test(html));
  // the other side's move, from here: their cards backs; a card off the pile face up while it is the one in hand
  const ot = play(drop.mini, 'O', 'pile'); html = screen(ot.mini, ot.flash, 'O');
  assert.match(html, /Olaf<\/b> took <span class="cshort red suD">7/); assert.equal(faces(oppRow(html)).join(), '7 of diamonds');
  assert.equal((oppRow(html).match(/class="rmyo"/g) || []).length, 7, 'seven cards in their row');
  for (const c of ot.mini.hand.O.filter(c => c !== '7D')) assert.ok(!faces(html).includes(NAME(c)), `${c} is theirs alone`);
  const od = play(ot.mini, 'O', { d: '6C' }); html = screen(od.mini, od.flash, 'X');
  assert.match(html, /class="plc[^"]*rmyod[^"]*"[^>]*data-cf="opp"/, 'their throw flies from their row');
  assert.match(html, /Olaf<\/b> threw <span class="cshort suC">6/);
  // the win: the second meld; on the loser's phone the winning hand turns up, its melds ringed
  const wt = play(od.mini, 'X', 'deck'); assert.equal(wt.mini.held.c, '5C');
  html = screen(wt.mini, wt.flash, 'X'); assert.match(html, /class="plc[^"]*flip[^"]*rmydk[^"]*"[^>]*data-cf="deck"/, 'a deck card of one\'s own comes as a back and turns up');
  const wd = play(wt.mini, 'X', { d: '8C' }); assert.ok(wd.won);
  html = screen(wd.mini, wd.flash, 'X', { owner: 'X' });
  assert.match(html, /role="status">2 melds!</); assert.deepEqual(pips(html, 'X'), { on: 2, fill: 1 });
  seat('O'); html = screen(wd.mini, wd.flash, 'X', { owner: 'X' });
  assert.equal((oppRow(html).match(/class="rmyo rmym"/g) || []).length, 6); assert.equal((oppRow(html).match(/class="plc[^"]* flip/g) || []).length, 6, 'each card of the winning hand turns up');
  assert.equal(V.moveText(wd.flash, 'Xena'), 'Xena threw a card · 2 melds'); assert.equal(V.moveText(take.flash, 'Xena'), 'Xena took from the pile');
});

test('the controls: the deck and the pile to take, a card of the seven to throw (deck, pile, { d: card }), open only when they can be used', () => {
  seat('X');
  const m = E.newMini('rummy', E.makeRng('ctl'));
  const ctl = html => Object.fromEntries([...html.matchAll(/<button[^>]*data-act="move" data-m='([^']+)'[^>]*>/g)].map(x => [x[1].replace(/&quot;/g, '"'), !/ disabled/.test(x[0])]));
  let c = ctl(screen(m, null, 'X'));
  assert.deepEqual(c, { '"deck"': true, '"pile"': true }, 'a take: the deck or the pile, no card of the hand');
  const t = play(m, 'X', 'deck'); c = ctl(screen(t.mini, null, 'X'));
  assert.deepEqual(Object.keys(c).sort(), ['"deck"', '"pile"', ...t.mini.hand.X.map(x => JSON.stringify({ d: x }))].sort());
  assert.ok(!c['"deck"'] && !c['"pile"'] && t.mini.hand.X.every(x => c[JSON.stringify({ d: x })]), 'a card taken: any of the seven goes, no second take');
  const d = play(t.mini, 'X', { d: t.mini.hand.X[0] }); c = ctl(screen(d.mini, null, 'O', { locked: true }));
  assert.deepEqual(c, { '"deck"': false, '"pile"': false }, 'the other side\'s turn: nothing to tap');
  const html = screen(t.mini, null, 'X');
  for (const x of t.mini.hand.X) assert.ok(html.includes(`aria-label="Throw the ${NAME(x)}"`));
  assert.match(html, /aria-label="Take from the deck \(\d+ left\)"/);
});

test('the miniature: public alone (the same from the hidden square as from the full one): the felt with the deck and the pile\'s top card, the melds as pips', () => {
  const rng = E.makeRng('rmy-mini'); let m = E.newMini('rummy', rng), p = 'X';
  for (let n = 0; n < 16; n++) {
    const hid = clone(m); hideMini(hid, 0, {});
    const a = V.miniature(m, false), b = V.miniature(hid, false);
    assert.equal(a, b, 'move ' + n);
    const shown = [...a.matchAll(/<i class="tcd[^"]* su([SHDC])"><b>([^<]+)<\/b>/g)].map(x => (x[2] === '10' ? 'T' : x[2]) + x[1]);
    assert.deepEqual(shown, m.pile.slice(-1), 'the one face on the board is the pile\'s top card');
    assert.ok(a.includes('trmyf') && a.includes('class="tpip"'));
    const r = E.applyMove(m, p, E.localBest(pv(m, p), p, rng, {}, { level: 'easy' }).move, rng);
    if (r.outcome === 'win') break;
    if (!r.again) p = other(p);
  }
  // a square from before the rework (as a claimed one may still be in a match under way): drawn without a throw
  const old = { type: 'rummy', v: 1, hand: { X: ['2C', '3C', '4C', '5H', '5D', '5S'], O: ['5C', '6H', '9D', 'AS', 'KD', '7C'] }, pile: { X: ['9C'], O: ['8C'] }, deckN: { X: 1, O: 1 }, held: null, turns: { X: 0, O: 0 }, last: null };
  assert.ok(V.miniature(old, false).includes('trmyw'));
  seat('X'); assert.ok(screen(old, null, 'X', { view: true, owner: 'X' }).includes('rmyfelt'));
});

test('the sounds: a slide for every card moved, a turn as a deck card of one\'s own shows, a snap onto the pile, a ding for a new meld and a sparkle for the last', () => {
  seat('X');
  const snd = (f, won) => { const out = []; V.sounds(f, (n, ms) => out.push([n, ms]), !!won, {}, null); return out; };
  const T = R.rmyTimes;
  assert.deepEqual(snd({ by: 'X', rummy: { kind: 'take', from: 'deck' } }), [['cardSlide', 0], ['cardFlip', R.RMYT.slide]]);
  assert.deepEqual(snd({ by: 'O', rummy: { kind: 'take', from: 'deck' } }), [['cardSlide', 0]], 'their deck card stays a back: no turn');
  assert.deepEqual(snd({ by: 'X', rummy: { kind: 'take', from: 'pile' } }), [['cardSlide', 0]]);
  assert.equal(snd({ by: 'X', rummy: { kind: 'take', from: 'deck', reshuf: true } }).length, 5, 'a shuffle first: three more slides');
  assert.deepEqual(snd({ by: 'X', note: 'discard', rummy: { kind: 'discard', d: '2S', n: 1 } }), [['cardSlide', 0], ['cardFlip', R.RMYT.slide]], 'a meld held before is not rung again');
  assert.deepEqual(snd({ by: 'X', note: 'meld', rummy: { kind: 'discard', d: '2S', n: 1 } }).pop(), ['ding', T({ kind: 'discard', n: 1 }).light]);
  assert.deepEqual(snd({ by: 'X', note: 'melds', rummy: { kind: 'discard', d: '2S', n: 2 } }, true).pop(), ['sparkle', T({ kind: 'discard', n: 2 }).light]);
  assert.ok(R.flashMs({ rummy: { kind: 'take', from: 'deck', reshuf: true } }) >= R.RMYT.deal + R.RMYT.slide + R.RMYT.flip, 'the move lasts as long as its animation');
});
