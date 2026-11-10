'use strict';
// Hangman, a Shared square, solved (slow: about a minute and 1.5 GB; never part of npm test):
//   node --max-old-space-size=4096 tests/sim/hangman-table.js
// The exact race over the word list for each word length: a position is the words still possible; the side to move
// names a letter: the words that hold it, grouped by where it sits (the side goes again), and the words without it
// (the other side moves). It prints what src/games/hangman/ai.js ships:
//   - the first mover's chance of a fresh word and its best first letters (HANG_OPEN);
//   - the fit of a set's worth to its two likeliest letters and its length (HH.leaf: the value of a set out of the
//     search's reach), with its error against the plain guess the old Hard used (0.5 + 0.3 x the likeliest letter);
//   - whether a wasted letter (one in no candidate, to hand the move over) is ever the better move, with the count of
//     such letters left kept exactly (the untried letters in no candidate, less the misses made): it prints how many
//     positions it would be better in.
(async () => {
  const { WORDS_HANG } = await import('../../src/games/hangman/words.js');
  const rows = [];
  for (const len of [...new Set(WORDS_HANG.map(w => w.length))].sort()) {
    const words = [...new Set(WORDS_HANG.filter(w => w.length === len).map(w => w.toUpperCase()))];
    const pos = words.map(w => { const a = new Uint8Array(26); for (let i = 0; i < len; i++) a[w.charCodeAt(i) - 65] |= 1 << i; return a; });
    const split = (S, l) => { const gr = new Map(), miss = []; for (const c of S) { const p = pos[c][l]; if (p) { let g = gr.get(p); if (!g) gr.set(p, (g = [])); g.push(c); } else miss.push(c); } return miss.length === S.length || (!miss.length && gr.size === 1) ? null : [miss, gr]; };
    const memo = new Map();
    const worth = (S, sp) => { let v = 0; for (const g of sp[1].values()) v += g.length / S.length * V(g); if (sp[0].length) v += sp[0].length / S.length * (1 - V(sp[0])); return v; };
    const V = S => { if (S.length <= 1) return 1; const key = S.join(','), h = memo.get(key); if (h !== undefined) return h; let top = 0; for (let l = 0; l < 26; l++) { const sp = split(S, l); if (!sp) continue; const v = worth(S, sp); if (v > top) top = v; } memo.set(key, top); return top; };
    const all = words.map((_, i) => i), root = V(all), firsts = [];
    for (let l = 0; l < 26; l++) { const sp = split(all, l); if (sp) firsts.push([String.fromCharCode(65 + l), worth(all, sp)]); }
    firsts.sort((a, b) => b[1] - a[1]);
    console.log(`${len} letters: ${words.length} words, ${memo.size} positions; the first mover wins ${(100 * root).toFixed(2)}%; first letters: ${firsts.slice(0, 5).map(x => x[0] + ' ' + (100 * x[1]).toFixed(2)).join(', ')}`);
    // a wasted letter, counted exactly: W(S, k) with k misses made since the fresh word
    const dead = S => { let inS = 0; for (const c of S) for (let l = 0; l < 26; l++) if (pos[c][l]) inS |= 1 << l; let d = 0; for (let l = 0; l < 26; l++) if (!((inS >> l) & 1)) d++; return d; };
    const wm = new Map(); let better = 0;
    const W = (S, k) => {
      if (S.length <= 1) return 1;
      const P = Math.max(0, dead(S) - k), key = S.join(',') + ':' + Math.min(P, 2) + (P & 1), h = wm.get(key);   // (the waits left: none, or their parity)
      if (h !== undefined) return h;
      let top = 0;
      for (let l = 0; l < 26; l++) { const sp = split(S, l); if (!sp) continue; let v = 0; for (const g of sp[1].values()) v += g.length / S.length * W(g, k); if (sp[0].length) v += sp[0].length / S.length * (1 - W(sp[0], k + 1)); if (v > top) top = v; }
      if (P > 0) { const v = 1 - W(S, k + 1); if (v > top + 1e-9) { top = v; better++; } }
      wm.set(key, top); return top;
    };
    if (len !== 6 || process.argv.includes('--waits6')) console.log(`   with wasted letters allowed: the first mover ${(100 * W(all, 0)).toFixed(2)}%; better than every telling letter in ${better} positions`);
    let k = 0;
    for (const [key, v] of memo) {
      if ((k++ % 37) !== 0) continue;
      const S = key.split(',').map(Number), m = S.length; if (m < 6) continue;
      const hs = []; for (let l = 0; l < 26; l++) { let c = 0; const ps = new Set(); for (const w of S) if (pos[w][l]) { c++; ps.add(pos[w][l]); } if (!c || (c === m && ps.size === 1)) continue; hs.push(c / m); }
      hs.sort((a, b) => b - a); rows.push([m, hs[0] || 0, hs[1] || 0, v]);
    }
  }
  const fit = f => {
    const X = rows.map(f), y = rows.map(r => r[3]), p = X[0].length, A = Array.from({ length: p }, () => new Array(p + 1).fill(0));
    for (let i = 0; i < X.length; i++) for (let a = 0; a < p; a++) { for (let b = 0; b < p; b++) A[a][b] += X[i][a] * X[i][b]; A[a][p] += X[i][a] * y[i]; }
    for (let a = 0; a < p; a++) { let piv = a; for (let r = a + 1; r < p; r++) if (Math.abs(A[r][a]) > Math.abs(A[piv][a])) piv = r; [A[a], A[piv]] = [A[piv], A[a]]; for (let r = 0; r < p; r++) if (r !== a) { const q = A[r][a] / A[a][a]; for (let c = a; c <= p; c++) A[r][c] -= q * A[a][c]; } }
    const w = A.map((r, a) => r[p] / r[a]); let se = 0;
    for (let i = 0; i < X.length; i++) { let e = y[i]; for (let a = 0; a < p; a++) e -= w[a] * X[i][a]; se += e * e; }
    return { w, rmse: Math.sqrt(se / X.length) };
  };
  let se = 0; for (const r of rows) { const e = r[3] - (0.5 + 0.3 * r[1]); se += e * e; }
  const f = fit(r => [1, r[1], r[2], 1 / r[0]]);
  console.log(`${rows.length} sets of 6 words or more: the old leaf's error ${Math.sqrt(se / rows.length).toFixed(4)}; HH.leaf = [${f.w.map(x => x.toFixed(4)).join(', ')}] (1, likeliest letter, second, 1 / words): error ${f.rmse.toFixed(4)}`);
})();
