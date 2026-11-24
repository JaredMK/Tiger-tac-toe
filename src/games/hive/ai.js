// Letter Hive: the computer's play. A turn is Go! (the letters drawn: the move HIVE_GO, as anyone's), then its burst.
// It never enters more words than a person could in a burst: a number of words by its level (`aiMin`..`aiMax`: Easy 1
// to 3, Normal 1 to 4, Hard 2 to 5), drawn from the words of the letters just drawn that nobody has found yet, with a
// lean to short ones (each extra letter makes a word `aiShort` % as likely as one a letter shorter: Easy keeps to the
// 4-letter words; Hard, with more words a burst, keeps to shorter ones than Normal: tuned so Hard beats Normal about
// 70%, the AI levels pass) and to everyday ones (the puzzles mark them; a word that is not one
// is `aiRare` % as likely, so what the computer finds looks like what a person would), and Hard can go looking for a
// full-hive word `aiFullHard` % of its bursts (0 by default). Nothing is searched (a fixed, small amount of work whatever `ctx.until`
// says). `needs` is the points still needed over what a Normal burst is worth: on the letters drawn, when its Go! is
// made; else on new letters (every burst gets them), the average over the puzzles.
import { randInt } from '../../core/random.js';
import { goAgain } from '../../core/tune.js';
import { HIVE, HIVE_GO, hiveCfg, hiveCount, hiveGo, hivePts, hivePuzzle } from './rules.js';

const weight = (c, pz, short, w) => Math.pow(Math.max(0.01, short / 100), Math.min(w.length, 10) - HIVE.min) * (pz.plain.has(w) ? 1 : c.rare / 100);
const left = (pm, pz) => { const got = new Set(pm.found); return pz.words.filter(w => !got.has(w)); };
// What a burst of this level is worth on these words: its average count of words times a word's weighted worth.
function worth(c, pz, rest, level) {
  const [lo, hi, short, full] = c.ai[level] || c.ai.normal;
  let sw = 0, sp = 0;
  for (const w of rest) { const k = weight(c, pz, short, w); sw += k; sp += k * hivePts(c, pz, w); }
  const fulls = rest.filter(w => pz.full.includes(w)), extra = fulls.length ? full / 100 * hivePts(c, pz, fulls[0]) : 0;
  return sw ? Math.min(rest.length, (lo + hi) / 2) * sp / sw + extra : 0;
}
// On new letters: the average over every puzzle, nothing found (kept for each set of the settings it reads).
const FRESH = new Map();
function freshWorth(c, level) {
  const key = JSON.stringify([c.four, c.bonus, c.rare, c.ai[level] || c.ai.normal]);
  if (!FRESH.has(key)) { let s = 0; for (let k = 0; k < hiveCount(); k++) { const pz = hivePuzzle(k); s += worth(c, pz, pz.words, level); } FRESH.set(key, s / hiveCount()); }
  return FRESH.get(key);
}
// About what p's next burst at this level is worth: on the letters drawn for it, or on new ones.
export function hiveBurst(pm, level, p) {
  const c = hiveCfg(pm), go = hiveGo(pm);
  if (go && (p == null || go === p)) { const pz = hivePuzzle(pm.pz); return worth(c, pz, left(pm, pz), level); }
  return freshWorth(c, level);
}
export function needs(pm, p) {
  const c = hiveCfg(pm), need = c.target - pm.pts[p];
  if (need <= 0) return 0;
  const per = Math.max(0.5, hiveBurst(pm, 'normal', p));
  return Math.max(1, need / per * (goAgain(pm) ? 0.95 : 1));
}
const qOf = (need, per) => (need <= per ? 0.5 : need <= per * 1.6 ? 0.15 : 0);
export function best(pm, me, rng, style, ctx) {
  const c = hiveCfg(pm), level = (ctx && ctx.level) || 'normal', need = c.target - pm.pts[me];
  if (hiveGo(pm) !== me) return { move: HIVE_GO, q: qOf(need, hiveBurst(pm, level, me)) };   // Go! first: its letters drawn as anyone's
  const pz = hivePuzzle(pm.pz), [lo, hi, short, full] = c.ai[level] || c.ai.normal, rest = left(pm, pz), w = [];
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
  return { move: { w }, q: qOf(need, hiveBurst(pm, level, me)) };
}
