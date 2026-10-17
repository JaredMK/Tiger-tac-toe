// Memory: the rules (pure: no page, no clock; the server runs the same code).
import { randInt, shuffle } from '../../core/random.js';

export const MEMORY = { shapes: ['circle', 'square', 'triangle', 'diamond'], colors: ['green', 'yellow', 'purple', 'orange'] };
// 9 cards: one matching pair plus seven other, all-different shape/colour combinations.
export function memoryDeck(rng) {
  const combos = [];
  for (const s of MEMORY.shapes) for (const c of MEMORY.colors) combos.push({ s, c });
  const pick = shuffle(combos, rng).slice(0, 8);
  const cards = [{ s: pick[0].s, c: pick[0].c }, { s: pick[0].s, c: pick[0].c }].concat(pick.slice(1));
  return shuffle(cards, rng);
}
export function create(type, rng) {
  return { type, cards: memoryDeck(rng), flips: 0, seen: [], last: null };   // seen: cards shown so far
}
export function apply(mini, p, m, rng, idx) {
  if (!Array.isArray(m) || m.length !== 2) return { ok: false, reason: 'bad' };
  const [a, b] = m;
  if (![a, b].every(k => Number.isInteger(k) && k >= 0 && k < 9) || a === b) return { ok: false, reason: 'bad' };
  mini.flips += 1; mini.last = { by: p, a, b };
  if (!mini.seen) mini.seen = [];
  for (const k of [a, b]) if (!mini.seen.includes(k)) mini.seen.push(k);
  const ca = mini.cards[a], cb = mini.cards[b];
  if (ca.s === cb.s && ca.c === cb.c) return { ok: true, outcome: 'win', cells: [a, b] };
  return { ok: true, outcome: 'continue', note: 'nomatch' };
}
export function publicView(mini) {
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
  const show = new Set(m.seen || []);
  if (st && st.pickSq === k && st.pick != null) show.add(st.pick);
  m.cards = m.cards.map((c, i) => (show.has(i) ? c : null));
  return;
}
export function flashMs(f, winLen, won) {
  return 500;
}
