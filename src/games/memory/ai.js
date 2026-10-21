// Memory: the computer's play.
import { randInt, shuffle } from '../../core/random.js';
import { tune } from '../../core/tune.js';
import { memoryPair } from './rules.js';

export function needs(pm, p) {
  const known = pm.seen.filter(i => pm.cards[i]); return memoryPair(pm, known) ? 1 : 1 + (9 - pm.seen.length) / 2;
}
export function best(pm, me, rng, style, ctx) {
  let known = pm.seen.filter(i => pm.cards[i]);
  const mem = tune(pm).mem, forgot = [];
  if (mem < 100) known = known.filter(i => rng() * 100 < mem || !forgot.push(i));   // its memory (TUNE): a card seen may be forgotten, as good as unseen
  const pair = memoryPair(pm, known);
  if (pair) return { move: pair, q: 1, shared: true };
  const unseen = [];
  for (let i = 0; i < 9; i++) if (!pm.seen.includes(i)) unseen.push(i);
  unseen.push(...forgot);
  if (unseen.length >= 2) { shuffle(unseen, rng); return { move: [unseen[0], unseen[1]], q: 2 / (unseen.length * (unseen.length - 1)), shared: true }; }
  if (unseen.length === 1) return { move: [unseen[0], known[randInt(rng, known.length)]], q: 1 / known.length, shared: true };
  return { move: [known[0], known[1]], q: 0, shared: true };
}
