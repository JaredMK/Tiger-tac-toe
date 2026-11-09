// Find the Pair: the rules (pure: no page, no clock; the server runs the same code).
import { randInt, shuffle } from '../../core/random.js';
import { raceDealt, raceSide } from '../../core/race.js';
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
// Race mode (core/race.js): the same deck for both, but each player flips their own copy of it (`mini.side[p]`: { flips,
// seen (the cards they have turned, by index), faces (those cards' faces, theirs alone: online the deck stays on the
// server), last }); the other side sees only how many flips they have made (raceShape: { n }).
export function create(type, rng, opts) {
  const cards = memoryDeck(rng, tuneLive(type).pairs);
  if (raceDealt(type, opts)) return { type, cards, race: true, side: { X: { flips: 0, seen: [], faces: new Array(9).fill(null), last: null }, O: { flips: 0, seen: [], faces: new Array(9).fill(null), last: null } } };
  return { type, cards, flips: 0, seen: [], last: null };   // seen: cards shown so far
}
// What p knows of the deck: the cards they have seen and those cards' faces (a shared square: everyone's; a race: p's own
// part, null for a side this copy has not got).
export function memoryKnown(pm, p) {
  if (!pm.race) return { seen: pm.seen || [], cards: pm.cards };
  const part = raceSide(pm, p);
  return part ? { seen: part.seen || [], cards: part.faces || [] } : null;
}
export function apply(mini, p, m, rng, idx) {
  if (!Array.isArray(m) || m.length !== 2) return { ok: false, reason: 'bad' };
  const [a, b] = m;
  if (![a, b].every(k => Number.isInteger(k) && k >= 0 && k < 9) || a === b) return { ok: false, reason: 'bad' };
  if (mini.race) {                                               // a race: p's own flips; the faces they turn are theirs to keep
    const part = raceSide(mini, p);
    if (!part) return { ok: false, reason: 'bad' };
    if (!Array.isArray(mini.cards) || !mini.cards[a] || !mini.cards[b]) return { ok: false, reason: 'secret' };
    part.flips += 1; part.last = { by: p, a, b };
    if (!Array.isArray(part.faces)) part.faces = new Array(9).fill(null);
    for (const k of [a, b]) { if (!part.seen.includes(k)) part.seen.push(k); part.faces[k] = { s: mini.cards[k].s, c: mini.cards[k].c }; }
    const ca = mini.cards[a], cb = mini.cards[b];
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
  if (mini.race) return { type: 'memory', race: true, side: mini.side };   // (core/minis.js publicMini keeps one side's own part alone and adds both shapes)
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
// Race: a side's progress for anyone to see: its flips (never which cards).
export function raceShape(mini, p) {
  const part = raceSide(mini, p);
  return part ? { n: part.flips || 0 } : {};
}
export function raceFlash(f, mini) { return Object.assign({ by: f.by }, raceShape(mini, f.by)); }
export function randomMove(mini, p, rng, from, empties) {
  const a = randInt(rng, 9); let b = randInt(rng, 8); if (b >= a) b++; return [a, b];
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  flash.reveal = [m[0], m[1]]; return;
}
export function secret(mini) {
  return { cards: mini.cards.map(c => ({ s: c.s, c: c.c })) };
}
export function hide(m, k, st) {
  const show = new Set(m.race ? [] : m.seen || []);              // (a race: the cards each side has seen are theirs alone, in their part, the first card picked too: records.js applyOnlinePick)
  if (st && !m.race && st.pickSq === k && st.pick != null) show.add(st.pick);
  m.cards = m.cards.map((c, i) => (show.has(i) ? c : null));
  return;
}
export function flashMs(f, winLen, won) {
  return 500;
}
