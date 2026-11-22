// Letter Hive: the computer's play. It never enters more words than a person could in a burst: a number of words by
// its level (`aiMin`..`aiMax`: Easy 1 or 2, Normal 2 to 4, Hard 4 to 6), drawn from the words nobody has found yet with
// a lean to short ones (each extra letter makes a word `aiShort` % as likely as one a letter shorter: Easy keeps to the
// 4-letter words, Hard reaches for the long ones) and to everyday ones (the puzzles mark them; a word that is not one
// is `aiRare` % as likely, so what the computer finds looks like what a person would), and Hard goes looking for a
// full-hive word `aiFullHard` % of its bursts. Nothing is searched (a fixed, small amount of work whatever `ctx.until` says). `needs` is the points still
// needed over what a Normal burst is worth on the words left.
import { randInt } from '../../core/random.js';
import { goAgain } from '../../core/tune.js';
import { HIVE, hiveCfg, hivePts, hivePuzzle } from './rules.js';

const weight = (c, pz, short, w) => Math.pow(Math.max(0.01, short / 100), Math.min(w.length, 10) - HIVE.min) * (pz.plain.has(w) ? 1 : c.rare / 100);
const left = pm => { const pz = hivePuzzle(pm.pz), got = new Set(pm.found); return pz.words.filter(w => !got.has(w)); };
// About what a burst of this level is worth on the words left: its average count of words times a word's weighted worth.
export function hiveBurst(pm, level) {
  const c = hiveCfg(pm), pz = hivePuzzle(pm.pz), [lo, hi, short, full] = c.ai[level] || c.ai.normal, rest = left(pm);
  let sw = 0, sp = 0;
  for (const w of rest) { const k = weight(c, pz, short, w); sw += k; sp += k * hivePts(c, pz, w); }
  const fulls = rest.filter(w => pz.full.includes(w)), extra = fulls.length ? full / 100 * hivePts(c, pz, fulls[0]) : 0;
  return sw ? Math.min(rest.length, (lo + hi) / 2) * sp / sw + extra : 0;
}
export function needs(pm, p) {
  const c = hiveCfg(pm), need = c.target - pm.pts[p];
  if (need <= 0) return 0;
  const per = Math.max(0.5, hiveBurst(pm, 'normal'));
  return Math.max(1, need / per * (goAgain(pm) ? 0.95 : 1));
}
export function best(pm, me, rng, style, ctx) {
  const c = hiveCfg(pm), pz = hivePuzzle(pm.pz), level = (ctx && ctx.level) || 'normal', [lo, hi, short, full] = c.ai[level] || c.ai.normal, rest = left(pm), w = [];
  let n = Math.min(HIVE.cap, Math.max(0, lo + randInt(rng, Math.max(1, hi - lo + 1))));
  if (n > 0 && rng() < full / 100) {                               // a full-hive word, looked for
    const fulls = rest.filter(x => pz.full.includes(x));
    if (fulls.length) { const x = fulls[randInt(rng, fulls.length)]; rest.splice(rest.indexOf(x), 1); w.push(x); n--; }
  }
  for (; n > 0 && rest.length; n--) {                              // the rest by their weights, none twice
    const ws = rest.map(x => weight(c, pz, short, x)), sum = ws.reduce((a, b) => a + b, 0);
    let r = rng() * sum, k = 0; while (k < rest.length - 1 && (r -= ws[k]) > 0) k++;
    w.splice(randInt(rng, w.length + 1), 0, rest.splice(k, 1)[0]);
  }
  const need = c.target - pm.pts[me], per = hiveBurst(pm, level);
  return { move: { w }, q: need <= per ? 0.5 : need <= per * 1.6 ? 0.15 : 0 };
}
