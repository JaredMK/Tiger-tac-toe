// Find the Pair: the rules (pure: no page, no clock; the server runs the same code).
import { randInt, shuffle } from '../../core/random.js';
import { RACE_V, raceDealt, raceSide } from '../../core/race.js';
import { tuneLive } from '../../core/tune.js';

export const MEMORY = { shapes: ['circle', 'square', 'triangle', 'diamond'], colors: ['green', 'yellow', 'purple', 'orange'] };
// 9 cards: one matching pair plus seven other, all-different shape/colour combinations (pairs: TUNE's count
// of matching pairs, the rest all different).
export function memoryDeck(rng, pairs = 1) {
  const combos = [];
  for (const s of MEMORY.shapes) for (const c of MEMORY.colors) combos.push({ s, c });
  const pick = shuffle(combos, rng).slice(0, 9 - pairs);
  let cards = [];
  for (let k = 0; k < pairs; k++) cards.push({ s: pick[k].s, c: pick[k].c }, { s: pick[k].s, c: pick[k].c });
  cards = cards.concat(pick.slice(pairs));
  return shuffle(cards, rng);
}
// Race mode (core/race.js, `rv: 2`): the same deck for both, each player their own shuffle of it (`mini.tg`: { X, O },
// the square's secret; never the same layout), and their own flips (`mini.side[p]`: { flips, seen (the cards they have
// turned, by index), faces (those cards' faces: turned up, so open to both), last }). No flip limit: the first to turn up
// a pair in their own layout wins. The first card picked goes through the match's pick as in Shared: its face rides
// the public state as `up` ({ i, s, c }: the picker's own layout's card, `hide`), up for both.
const sameLayout = (a, b) => a.every((c, i) => c.s === b[i].s && c.c === b[i].c);
export function create(type, rng, opts) {
  const cards = memoryDeck(rng, tuneLive(type).pairs);
  if (raceDealt(type, opts)) {
    let o = shuffle(cards.map(c => ({ s: c.s, c: c.c })), rng);
    for (let k = 0; k < 8 && sameLayout(o, cards); k++) o = shuffle(o, rng);   // (a shuffle that leaves it as it was: again)
    if (sameLayout(o, cards)) o = cards.slice(1).concat(cards[0]).map(c => ({ s: c.s, c: c.c }));   // (still: turned by one, never the same: the deck has other designs)
    const part = () => ({ flips: 0, seen: [], faces: new Array(9).fill(null), last: null });
    return { type, race: true, rv: RACE_V, tg: { X: cards, O: o }, side: { X: part(), O: part() } };
  }
  return { type, cards, flips: 0, seen: [], last: null };   // seen: cards shown so far
}
// The layout p flips: a race square's own (null where this copy has not got it), else the square's deck.
export const memoryLayout = (mini, p) => (mini.race ? (mini.tg && Array.isArray(mini.tg[p]) ? mini.tg[p] : null) : mini.cards);
// What p knows of the deck: the cards they have seen and those cards' faces (a shared square: everyone's; a race: p's own
// flips, null for a part this copy has not got).
export function memoryKnown(pm, p) {
  if (!pm.race) return { seen: pm.seen || [], cards: pm.cards };
  const part = raceSide(pm, p);
  return part ? { seen: part.seen || [], cards: part.faces || [] } : null;
}
// Race: the pairs p has turned up both cards of (designs seen twice in their own layout).
export function memoryKnownPairs(part) {
  if (!part || !Array.isArray(part.faces)) return 0;
  const n = {};
  for (const f of part.faces) if (f) { const k = f.s + f.c; n[k] = (n[k] || 0) + 1; }
  return Object.values(n).filter(v => v >= 2).length;
}
export function apply(mini, p, m, rng, idx) {
  if (!Array.isArray(m) || m.length !== 2) return { ok: false, reason: 'bad' };
  const [a, b] = m;
  if (![a, b].every(k => Number.isInteger(k) && k >= 0 && k < 9) || a === b) return { ok: false, reason: 'bad' };
  if (mini.race) {                                               // a race: p's own flips in p's own layout; the other side's untouched
    const part = raceSide(mini, p), L = memoryLayout(mini, p);
    if (!part) return { ok: false, reason: 'bad' };
    if (!L || !L[a] || !L[b]) return { ok: false, reason: 'secret' };
    part.flips += 1; part.last = { by: p, a, b };
    if (!Array.isArray(part.faces)) part.faces = new Array(9).fill(null);
    if (!Array.isArray(part.seen)) part.seen = [];
    for (const k of [a, b]) { if (!part.seen.includes(k)) part.seen.push(k); part.faces[k] = { s: L[k].s, c: L[k].c }; }
    const ca = L[a], cb = L[b];
    if (ca.s === cb.s && ca.c === cb.c) return { ok: true, outcome: 'win', cells: [a, b] };
    return { ok: true, outcome: 'continue', note: 'nomatch' };
  }
  mini.flips += 1; mini.last = { by: p, a, b };
  if (!mini.seen) mini.seen = [];
  for (const k of [a, b]) if (!mini.seen.includes(k)) mini.seen.push(k);
  const ca = mini.cards[a], cb = mini.cards[b];
  if (ca.s === cb.s && ca.c === cb.c) return { ok: true, outcome: 'win', cells: [a, b] };
  return { ok: true, outcome: 'continue', note: 'nomatch' };
}
export function publicView(mini) {
  if (mini.race) return { type: 'memory', race: true, side: JSON.parse(JSON.stringify(mini.side || {})) };   // both players' flips and the faces they turned, never a layout
  const seen = (mini.seen || []).slice();
  return { type: 'memory', seen, cards: mini.cards.map((c, i) => (seen.includes(i) ? { s: c.s, c: c.c } : null)) };
}
export function memoryPair(pm, known) {
  for (let x = 0; x < known.length; x++) for (let y = x + 1; y < known.length; y++) {
    const a = pm.cards[known[x]], b = pm.cards[known[y]];
    if (a.s === b.s && a.c === b.c) return [known[x], known[y]];
  }
  return null;
}
// Race: a side's progress in brief: its flips and the pairs it has seen both cards of.
export function raceShape(mini, p) {
  const part = raceSide(mini, p);
  return part ? { n: part.flips || 0, pairs: memoryKnownPairs(part) } : {};
}
export function randomMove(mini, p, rng, from, empties) {
  const a = randInt(rng, 9); let b = randInt(rng, 8); if (b >= a) b++; return [a, b];
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  flash.reveal = [m[0], m[1]]; return;
}
export function secret(mini) {
  if (mini.race) return { tg: { X: (mini.tg.X || []).map(c => ({ s: c.s, c: c.c })), O: (mini.tg.O || []).map(c => ({ s: c.s, c: c.c })) } };
  return { cards: mini.cards.map(c => ({ s: c.s, c: c.c })) };
}
export function hide(m, k, st) {
  if (m.race) {                                                  // a race: the layouts go; the faces turned stay in the parts, and the first card picked (the picker's: the turn's) rides as `up`
    const L = st && st.pickSq === k && st.pick != null && m.tg ? m.tg[st.turn] : null, c = L && L[st.pick];
    if (c) m.up = { i: st.pick, s: c.s, c: c.c }; else delete m.up;
    delete m.tg; delete m.cards; return;
  }
  const show = new Set(m.seen || []);
  if (st && st.pickSq === k && st.pick != null) show.add(st.pick);
  m.cards = m.cards.map((c, i) => (show.has(i) ? c : null));
  return;
}
// The second card is round at 0.36 s and the chime or the two falling notes sound at 0.38 s; a pair's lift and burst
// play on from there (styles.css mempair).
export function flashMs(f, winLen, won) {
  return won ? 950 : 500;
}
