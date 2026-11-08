// Scratch & Match: the computer's play. A card's hidden pictures are a random deal, so no panel is likelier than
// another until something shows; what shows says a lot, because three of a kind always lie in a line (rules.js): two
// matching pictures in a line name the third panel, a picture shown outside a line rules that line out for it, and the
// layout (how many lines, pairs and singles a card holds) bounds what each picture can still be. Normal scratches the
// panel that would complete three of a kind where two already show in a line, else any panel; Hard weighs every card
// still possible (scrOdds: each way the lines and the decoys could lie, given the panels shown) and scratches the panel
// likeliest to complete a line now, between equals the one likeliest to be on a line at all.
import { randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';
import { LINES, LINE_SETS, SCR, scrBest, scrCounts, scrLayout, scrOpen } from './rules.js';

// n! / Π(rem[k]!): the ways a multiset of pictures fits a set of panels.
const FACT = [1]; for (let k = 1; k <= 12; k++) FACT[k] = FACT[k - 1] * k;
const multi = (n, rem) => { let d = 1; for (const r of rem) d *= FACT[r]; return FACT[n] / d; };
// The subsets of size k of 0..n-1.
function subsets(n, k, from = 0, cur = [], out = []) {
  if (cur.length === k) { out.push(cur.slice()); return out; }
  for (let i = from; i <= n - (k - cur.length); i++) { cur.push(i); subsets(n, k, i + 1, cur, out); cur.pop(); }
  return out;
}
// The ways the decoy pictures (the ones not on a line: `free` of them) fit the decoy panels, given what shows there:
// each way of picking which are the pairs and which the singles that allows every picture shown (a pair at most twice,
// a single once, the rest never), times the arrangements of what is left over the hidden decoy panels.
function decoyWays(obs, free, lay, hidden) {
  let total = 0;
  for (const P of subsets(free, lay.pairs)) {
    const rest = []; for (let k = 0; k < free; k++) if (!P.includes(k)) rest.push(k);
    for (const S of subsets(rest.length, lay.singles)) {
      const cap = new Array(free).fill(0);
      for (const k of P) cap[k] = 2;
      for (const j of S) cap[rest[j]] = 1;
      let ok = true; const rem = [];
      for (let k = 0; k < free && ok; k++) { if (obs[k] > cap[k]) ok = false; else rem.push(cap[k] - obs[k]); }
      if (ok) total += multi(hidden, rem);
    }
  }
  return total;
}
// Everything the panels shown say about p's card: for each panel, the weight of the cards where scratching it completes
// three of a kind now (win) and where it lies on a line at all (line), the total weight (W), the average hidden panels
// of the nearest line (h), and the lines still possible (support). Every card consistent with the layout and what
// shows counts once (the deal was uniform over them).
const ODDS = new Map();                                        // the odds of a card as shown, by layout (the main board's AI asks many times over, in its playouts too)
const ODDS_MAX = 3000;
export function scrOdds(pm, p) {
  const lay = scrLayout(tune(pm)), K = lay.kinds, L = lay.lines, open = scrOpen(pm, p);
  const key = `${K}|${L}|${lay.pairs}|${open.map(v => (v == null ? '.' : v)).join('')}`;
  const hit = ODDS.get(key);
  if (hit) return hit;
  const out = scrOddsCalc(lay, K, L, open);
  if (ODDS.size >= ODDS_MAX) ODDS.delete(ODDS.keys().next().value);
  ODDS.set(key, out);
  return out;
}
function scrOddsCalc(lay, K, L, open) {
  const win = new Array(SCR.n).fill(0), line = new Array(SCR.n).fill(0), lines = new Set();
  let W = 0, hSum = 0;
  const shownAt = open.map((v, i) => (v == null ? -1 : i)).filter(i => i >= 0);
  for (const set of LINE_SETS[L]) {
    const inLine = new Array(SCR.n).fill(-1);
    set.forEach((ln, j) => ln.forEach(i => { inLine[i] = j; }));
    const req = new Array(L).fill(null);
    let ok = true;
    for (const i of shownAt) { const j = inLine[i]; if (j < 0) continue; if (req[j] == null) req[j] = open[i]; else if (req[j] !== open[i]) { ok = false; break; } }
    if (!ok) continue;
    const outside = new Array(K).fill(0);
    let shownOut = 0;
    for (const i of shownAt) if (inLine[i] < 0) { outside[open[i]]++; shownOut++; }
    const hiddenOut = lay.decoys - shownOut;
    const hid = set.map(ln => ln.filter(i => open[i] == null));
    const near = Math.min(...hid.map(h => h.length));
    // the lines' pictures: distinct, as required where a panel of the line shows, never shown outside a line
    const choose = (j, used) => {
      if (j === L) {
        const obs = []; for (let s = 0; s < K; s++) if (!used.includes(s)) obs.push(outside[s]);
        const w = decoyWays(obs, K - L, lay, hiddenOut);
        if (!w) return;
        W += w; hSum += w * near;
        set.forEach((ln, k) => { lines.add(LINES.indexOf(ln)); for (const i of hid[k]) line[i] += w; if (hid[k].length === 1) win[hid[k][0]] += w; });
        return;
      }
      for (let s = 0; s < K; s++) { if (used.includes(s) || outside[s]) continue; if (req[j] != null && req[j] !== s) continue; used.push(s); choose(j + 1, used); used.pop(); }
    };
    choose(0, []);
  }
  return { win, line, W, h: W ? hSum / W : SCR.need, support: lines.size, open };
}
// The panel two matching pictures in a line point at (the obvious scratch), or -1.
export function scrObvious(open) {
  for (const ln of LINES) {
    const shown = ln.filter(i => open[i] != null), hid = ln.filter(i => open[i] == null);
    if (shown.length === 2 && hid.length === 1 && open[shown[0]] === open[shown[1]]) return hid[0];
  }
  return -1;
}
// The scratches a side still needs: none with three of a kind on show; else the nearest line's hidden panels under
// every card still possible, plus a spread for not knowing which line it is (calibrated to Hard's own play, 0.72 a
// doubling of the lines still possible: tests/sim/scratch.sim.js).
export function needs(pm, p) {
  const open = scrOpen(pm, p);
  if (scrBest(open) >= SCR.need) return 0;
  const o = scrOdds(pm, p);
  if (!o.W) return Math.max(1, SCR.need - scrBest(open));
  return o.h + 0.72 * Math.log2(Math.max(1, o.support));
}
export function best(pm, me, rng, style, ctx) {
  const open = scrOpen(pm, me), hidden = open.map((v, i) => (v == null ? i : -1)).filter(i => i >= 0);
  if (!hidden.length) return { move: 0, q: 0 };
  const K = scrLayout(tune(pm)).kinds;
  if (ctx && ctx.level === 'hard') {
    const o = scrOdds(pm, me);
    if (o.W) {
      let top = [];
      for (const i of hidden) {
        const a = top.length ? top[0] : -1;
        if (!top.length || o.win[i] > o.win[a] || (o.win[i] === o.win[a] && o.line[i] > o.line[a])) top = [i];
        else if (o.win[i] === o.win[a] && o.line[i] === o.line[a]) top.push(i);
      }
      const move = top[randInt(rng, top.length)];
      return { move, q: o.win[move] / o.W };
    }
  }
  const ob = scrObvious(open);
  if (ob >= 0) return { move: ob, q: 1 / Math.max(1, K - Object.keys(scrCounts(open)).length + 1) };
  const move = hidden[randInt(rng, hidden.length)];
  const twos = Object.values(scrCounts(open)).filter(n => n === 2).length;   // (a pair on show: this panel may be its third)
  return { move, q: twos ? Math.min(1, twos / hidden.length) : 0 };
}
