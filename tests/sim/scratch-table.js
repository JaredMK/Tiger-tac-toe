'use strict';
// Scratch & Match: the Hard computer's table (src/games/scratch/table.js), worked out offline:
//   node tests/sim/scratch-table.js            writes the table for the default layout (6 pictures, 1 line, 2 pairs)
//   node tests/sim/scratch-table.js 6 2 5 1    several layouts: kinds then pairs, a pair of numbers each (one line a card only)
// A card's hidden pictures are one of the cards the layout allows, each as likely (rules.js scrCard); what a player knows
// is the panels shown. Every such position, up to the card's eight symmetries and the pictures' names (1,981 of them for
// the default layout), is solved exactly here over all the cards still possible (259,200 to start with): the panel
// that takes the fewest scratches on average to show three of a kind, and that average. Each entry is 12 characters:
// the position (nine panels, '.' hidden, pictures numbered as they first appear, the smallest of its eight turns and
// flips), the panel to scratch (in that same turn) and the scratches still needed x 100 in base 36 (two characters).
const fs = require('node:fs'), path = require('node:path');
const { LINES, SCR, scrLayout } = require('../../src/games/scratch/rules.js');

const SYM = [[0, 1, 2, 3, 4, 5, 6, 7, 8], [2, 5, 8, 1, 4, 7, 0, 3, 6], [8, 7, 6, 5, 4, 3, 2, 1, 0], [6, 3, 0, 7, 4, 1, 8, 5, 2], [2, 1, 0, 5, 4, 3, 8, 7, 6], [6, 7, 8, 3, 4, 5, 0, 1, 2], [0, 3, 6, 1, 4, 7, 2, 5, 8], [8, 5, 2, 7, 4, 1, 6, 3, 0]];
function canon(open) {
  let best = null, at = 0;
  SYM.forEach((sy, k) => {
    const map = new Map(); let s = '';
    for (let i = 0; i < 9; i++) { const v = open[sy[i]]; if (v < 0) s += '.'; else { if (!map.has(v)) map.set(v, map.size); s += map.get(v); } }
    if (best === null || s < best) { best = s; at = k; }
  });
  return { key: best, sym: at };
}
function subsets(arr, k, from = 0, cur = [], out = []) { if (cur.length === k) { out.push(cur.slice()); return out; } for (let i = from; i < arr.length; i++) { cur.push(arr[i]); subsets(arr, k, i + 1, cur, out); cur.pop(); } return out; }
function perms(bag) {                                             // the different orders of a bag of pictures
  const out = [], cnt = new Map(), cur = [];
  for (const x of bag) cnt.set(x, (cnt.get(x) || 0) + 1);
  const ks = [...cnt.keys()];
  (function rec() { if (cur.length === bag.length) { out.push(cur.slice()); return; } for (const k of ks) if (cnt.get(k)) { cnt.set(k, cnt.get(k) - 1); cur.push(k); rec(); cur.pop(); cnt.set(k, cnt.get(k) + 1); } })();
  return out;
}
function allCards(lay) {
  const cards = [], K = lay.kinds;
  for (const ln of LINES) for (let s = 0; s < K; s++) {
    const rest = Array.from({ length: K }, (_, k) => k).filter(x => x !== s), spots = Array.from({ length: SCR.n }, (_, i) => i).filter(i => !ln.includes(i));
    for (const P of subsets(rest, lay.pairs)) for (const S of subsets(rest.filter(x => !P.includes(x)), lay.singles)) for (const pm of perms([...P, ...P, ...S])) {
      const c = new Int8Array(SCR.n); ln.forEach(i => { c[i] = s; }); spots.forEach((i, k) => { c[i] = pm[k]; }); cards.push(c);
    }
  }
  return cards;
}
function solve(lay) {
  const cards = allCards(lay), memo = new Map();
  const parts = (list, i) => { const b = new Map(); for (const c of list) { let a = b.get(c[i]); if (!a) b.set(c[i], (a = [])); a.push(c); } return b; };
  const two = (open, s) => { let c = 0; for (let j = 0; j < 9; j++) if (open[j] === s) c++; return c >= 2; };
  function E(open, list) {
    const { key, sym } = canon(open), hit = memo.get(key);
    if (hit) return hit.e;
    let be = Infinity, bi = -1;
    for (let i = 0; i < 9; i++) {
      if (open[i] >= 0) continue;
      let e = 1;
      for (const [s, sub] of parts(list, i)) { if (two(open, s)) continue; open[i] = s; e += sub.length / list.length * E(open, sub); open[i] = -1; }
      if (e < be - 1e-12) { be = e; bi = i; }
    }
    memo.set(key, { e: be, panel: SYM[sym].indexOf(bi) });        // (the panel as the smallest turn of the position has it)
    return be;
  }
  const root = E(new Int8Array(9).fill(-1), cards);
  return { cards: cards.length, root, memo };
}
const args = process.argv.slice(2).map(Number), layouts = [];
for (let k = 0; k + 1 < args.length; k += 2) layouts.push([args[k], args[k + 1]]);
if (!layouts.length) layouts.push([6, 2]);
let out = '// Scratch & Match: the Hard computer\'s table, by layout (kinds|lines|pairs). Written by tests/sim/scratch-table.js (read there\n// what an entry is); never edited by hand.\nexport const SCR_TABLE = {\n';
for (const [kinds, pairs] of layouts) {
  const lay = scrLayout({ kinds, lines: 1, pairs }), r = solve(lay);
  const rows = [...r.memo].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([key, v]) => key + v.panel + Math.round(v.e * 100).toString(36).padStart(2, '0'));
  console.log(`${lay.kinds}|1|${lay.pairs}: ${r.cards} cards, ${rows.length} positions, ${r.root.toFixed(4)} scratches from a fresh card`);
  out += `  '${lay.kinds}|1|${lay.pairs}': '${rows.join('')}',\n`;
}
out += '};\n';
fs.writeFileSync(path.join(__dirname, '..', '..', 'src', 'games', 'scratch', 'table.js'), out);
