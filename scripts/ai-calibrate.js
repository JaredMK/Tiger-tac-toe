'use strict';
// How a square of each game really goes (docs/ai.md): for every game of the scope, squares played alone by the Hard
// computer against itself, and from them the first mover's share, the draws, the moves the winner needed, how often
// a move keeps the turn, and how well each side's `needs` and who is on the move predict who takes the square (the
// fit of the race model b^k / (a^k + b^k), the mover's needs less tau: a loss near 0.69 says `needs` tells nothing).
// A measuring tool: it writes nothing.
//
//   node scripts/ai-calibrate.js [types|all] [n] [--engine=new|ref] [--threads=n]

const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');
const V = require('./ai-versus.js');

// One game's squares: every decision as [mover is X, a (X's needs), b (O's needs), result for X (1, 0, 0.5 a draw)], and the tallies.
function collect(type, n, which, seed) {
  const E = V.engine(which), rows = [], T = { n: 0, draws: 0, first: 0, winMoves: 0, moves: 0, keeps: 0, fresh: 0, freshN: 0 };
  for (let g = 0; g < n; g++) {
    const rng = E.makeRng(`cal:${seed}:${type}:${g}`), st = E.newMatch(rng, { games: [type] });
    st.only = 4; if (g % 2) st.turn = 'O';
    let mini = st.squares[4].mini, ep = [], own = { X: 0, O: 0 }, first = st.turn, guard = 0;
    const close = res => { for (const r of ep) rows.push([r[0], r[1], r[2], res]); T.n++; if (res === 0.5) T.draws++; else { if ((res === 1 ? 'X' : 'O') === first) T.first++; T.winMoves += own[res === 1 ? 'X' : 'O']; } ep = []; own = { X: 0, O: 0 }; };
    { const pm = E.publicMini(mini, st.turn), a = E.needsOf(pm, 'X'), b = E.needsOf(pm, 'O'); if (isFinite(a) && isFinite(b)) { T.fresh += (a + b) / 2; T.freshN++; } }
    while (!st.squares[4].owner && guard++ < 400) {
      const p = st.turn, pm = E.publicMini(st.squares[4].mini, p);
      ep.push([p === 'X' ? 1 : 0, E.needsOf(pm, 'X'), E.needsOf(pm, 'O')]);
      const m = E.cpuMove(st, rng, null, { level: 'hard' });
      if (!m) { st.turn = E.other(p); continue; }
      const r = E.playMove(st, m.square, m.move, rng); if (!r.ok) throw new Error(type + ' refused ' + r.reason);
      E.endFlash(st); own[p]++; T.moves++;
      if (st.turn === p && !st.squares[4].owner) T.keeps++;
      if (!st.squares[4].owner && st.squares[4].mini !== mini) { close(0.5); mini = st.squares[4].mini; first = st.turn; }   // a draw: the square dealt again
    }
    if (st.squares[4].owner) close(st.squares[4].owner === 'X' ? 1 : 0);
  }
  return { type, rows, T };
}
// The race model: the chance X takes the square from a, b and the mover: the mover's needs less tau, then b^k / (a^k + b^k).
function odds(mx, a, b, tau, k) {
  if (!isFinite(a) && !isFinite(b)) return 0.5; if (!isFinite(a)) return 0; if (!isFinite(b)) return 1;
  const A = Math.max(0.25, a - (mx ? tau : 0)), B = Math.max(0.25, b - (mx ? 0 : tau)), x = Math.pow(A, k), y = Math.pow(B, k);
  return y / (x + y);
}
function loss(rows, tau, k) {
  let s = 0, n = 0;
  for (const r of rows) { if (r[3] === 0.5) continue; const p = Math.min(0.999, Math.max(0.001, odds(r[0], r[1], r[2], tau, k))); s -= r[3] ? Math.log(p) : Math.log(1 - p); n++; }
  return n ? s / n : 0;
}
function fit(rows) {
  let best = { tau: 0, k: 1, loss: loss(rows, 0, 1) };
  const base = best.loss;
  for (let tau = 0; tau <= 1.5001; tau += 0.125) for (let k = 0.5; k <= 8.001; k += 0.25) { const l = loss(rows, tau, k); if (l < best.loss - 1e-9) best = { tau, k, loss: l }; }
  return Object.assign(best, { base });
}
module.exports = { collect, fit, odds };

function runAll(types, n, which, seed, threads) {
  const out = {}; let next = 0, live = 0;
  return new Promise((resolve, reject) => {
    for (let k = 0; k < Math.min(threads, types.length); k++) {
      const w = new Worker(__filename, { workerData: { cal: true } }); live++;
      const feed = () => { if (next >= types.length) { w.terminate(); if (--live === 0) resolve(out); return; } w.postMessage({ type: types[next++], n, which, seed }); };
      w.on('message', m => { if (m.error) return reject(new Error(m.error)); out[m.type] = m; feed(); }); w.on('error', reject); feed();
    }
  });
}
async function main() {
  const args = process.argv.slice(2), flags = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => a.slice(2).split('='))), pos = args.filter(a => !a.startsWith('--'));
  const types = !pos[0] || pos[0] === 'all' ? V.scope() : pos[0].split(','), n = Number(pos[1] || 400), which = flags.engine || 'new';
  const res = await runAll(types, n, which, flags.seed || 'c1', Number(flags.threads || 2));
  console.log('game         squares  first%  draw%  winMoves  keep%  fresh   tau    k   loss (k=1: base)');
  for (const t of types) {
    const { rows, T } = res[t], f = fit(rows), dec = T.n - T.draws;
    const m = { tau: f.tau, k: f.k, first: Number((T.first / Math.max(1, dec)).toFixed(3)), draw: Number((T.draws / Math.max(1, T.n)).toFixed(3)), moves: Number((T.winMoves / Math.max(1, dec)).toFixed(2)), keep: Number((T.keeps / Math.max(1, T.moves)).toFixed(3)), fresh: Number((T.fresh / Math.max(1, T.freshN)).toFixed(2)) };
    console.log(`${t.padEnd(11)} ${String(T.n).padStart(7)}  ${(100 * m.first).toFixed(1).padStart(5)}  ${(100 * m.draw).toFixed(1).padStart(5)}  ${String(m.moves).padStart(7)}  ${(100 * m.keep).toFixed(1).padStart(5)}  ${String(m.fresh).padStart(5)}  ${f.tau.toFixed(2)}  ${f.k.toFixed(2)}  ${f.loss.toFixed(3)} (${f.base.toFixed(3)})`);
  }
}
if (!isMainThread && workerData && workerData.cal) parentPort.on('message', m => { try { const r = collect(m.type, m.n, m.which, m.seed); parentPort.postMessage(r); } catch (e) { parentPort.postMessage({ error: String(e && e.stack || e) }); } });
else if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
