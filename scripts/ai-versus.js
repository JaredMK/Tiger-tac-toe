'use strict';
// The new computer against a frozen one (docs/ai.md): the engine of this checkout against the engine of an earlier
// commit (the reference: "the old Hard"), on the same matches, each side deciding with its own code on the one state
// (the rules are the checkout's; the reference only chooses moves). Seeded and spread over worker threads.
//
//   node scripts/ai-versus.js ref [<commit>]            export the reference engine into .ai-ref/ (default: the commit in docs/ai-ref.txt)
//   node scripts/ai-versus.js duel [types|all] [n]      one square of a game, n squares a game (sides and the first move swapped): the local play alone
//   node scripts/ai-versus.js match [n] [A] [B]         whole matches on the scope's games; A and B: new:hard, ref:hard, new:normal, new:easy, random, simple
//   options: --budget=ms (0: fixed work, the default)  --games=a,b  --threads=n  --seed=s
const path = require('node:path'), os = require('node:os'), fs = require('node:fs'), cp = require('node:child_process');
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');
const ROOT = path.join(__dirname, '..'), REF = path.join(ROOT, '.ai-ref');

const BANK = { questions: ['easy', 'medium'].flatMap(d => ['Science', 'History', 'Sports'].flatMap(c => Array.from({ length: 20 }, (_, i) => ({ id: `${d[0]}${c[0]}${i}`, diff: d, cat: c, q: `${c} ${d} question ${i}?`, a: `Right ${d}${c}${i}`, wrong: ['Wa' + i, 'Wb' + i, 'Wc' + i] })))) };
const engines = {};
function engine(which) {
  if (engines[which]) return engines[which];
  const E = require(path.join(which === 'ref' ? REF : which === 'mid' ? path.join(ROOT, '.ai-mid') : ROOT, 'src', 'core', 'engine.js'));
  E.setTriviaBank(BANK);
  E.AI_CLOCK.now = null;
  if (which !== 'ref' && process.env.AI_W && E.setAiWeights) E.setAiWeights(Object.fromEntries(process.env.AI_W.split(',').map(kv => { const [k, v] = kv.split(':'); return [k, Number(v)]; })));   // (experiments: AI_W=normalSearch:100,normalSharp:60)
  return (engines[which] = E);
}
// The games this work is about: every luck and brain game (no skill games), none that is Super Chaos only.
function scope() {
  const E = engine('new');
  return E.TYPES.filter(t => !E.SC_ONLY.includes(t) && ['luck', 'brain'].includes(E.metaOf(t).category));
}
// A side: 'new:hard', 'ref:hard', 'random' (any legal move anywhere open), 'simple' (the square worth most on the board, any legal move there).
function decide(side, st, rng, budget) {
  const [who, level] = side.split(':'), N = engine('new');
  if (who === 'random' || who === 'simple') {
    const me = st.turn, open = st.lock != null ? [st.lock] : st.only != null ? [st.only] : st.squares.map((s, i) => (s.owner || !N.canMove(s.mini, me) ? -1 : i)).filter(i => i >= 0);
    if (!open.length) return null;
    let i = open[Math.floor(rng() * open.length)];
    if (who === 'simple') { let top = -1; for (const k of open) { const v = N.squareValue(st.squares, k, me); if (v > top) { top = v; i = k; } } }
    const m = N.randomLegalMove(st.squares[i].mini, me, rng);
    if (m != null && m !== 'auto') return { square: i, move: m };
    return N.cpuMove(st, rng, null, { level: 'easy' });          // (a staged game: a round to start, a question to turn up)
  }
  const E = engine(who);
  return E.cpuMove(st, rng, null, { level: level || 'hard', clock: budget ? Date.now : null, budget: budget || undefined });
}
function play(job) {
  const N = engine('new'), rng = N.makeRng('versus:' + job.seed);
  const st = N.newMatch(rng, { games: job.games });
  if (job.only != null) st.only = job.only;
  if (job.first) st.turn = job.first;
  const t0 = Date.now(), think = { X: 0, O: 0 }, n = { X: 0, O: 0 };
  let moves = 0, max = 0;
  const over = () => (job.only != null ? !!st.squares[job.only].owner : !!st.winner);
  while (!over() && moves < 900) {
    const p = st.turn, a = Date.now();
    let m;
    try { m = decide(job.sides[p], st, rng, job.budget); } catch (e) { throw new Error(`${job.sides[p]} deciding (${job.games.join(',')} seed ${job.seed}): ${e && e.stack}`); }
    const d = Date.now() - a; think[p] += d; n[p]++; if (d > max) max = d;
    if (!m) { if (st.winner) break; st.turn = N.other(p); moves++; continue; }
    const r = N.playMove(st, m.square, m.move, rng);
    if (!r.ok) throw new Error(`${job.sides[p]}: ${st.squares[m.square].mini.type} ${JSON.stringify(m.move)} refused (${r.reason}), seed ${job.seed}`);
    N.endFlash(st);
    moves++;
  }
  const winner = job.only != null ? st.squares[job.only].owner || 'none' : st.winner || 'none';
  return { winner, moves, ms: Date.now() - t0, think, n, max };
}
function runMany(jobs, threads, onResult) {
  threads = Math.max(1, Math.min(threads || os.cpus().length, jobs.length));
  const out = new Array(jobs.length);
  let next = 0, live = 0;
  return new Promise((resolve, reject) => {
    for (let k = 0; k < threads; k++) {
      const w = new Worker(__filename, { workerData: { worker: true } });
      live++;
      const feed = () => { if (next >= jobs.length) { w.terminate(); if (--live === 0) resolve(out); return; } const i = next++; w.postMessage({ i, job: jobs[i] }); };
      w.on('message', m => { if (m.error) { reject(new Error(m.error)); return; } out[m.i] = m.result; if (onResult) onResult(m.i, m.result); feed(); });
      w.on('error', reject);
      feed();
    }
  });
}
// A share with its 95% interval (Wilson), draws counted as half.
function wilson(w, d, n) {
  if (!n) return { p: 0, lo: 0, hi: 0 };
  const p = (w + d / 2) / n, z = 1.96, den = 1 + z * z / n, mid = (p + z * z / (2 * n)) / den, half = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den;
  return { p, lo: mid - half, hi: mid + half };
}
const pct = v => (100 * v).toFixed(1);
// A against B over n games, sides swapped every other game: A's wins, draws, losses.
function pairJobs(A, B, n, base) {
  return Array.from({ length: n }, (_, k) => Object.assign({ seed: `${base.seedTag}:${k >> 1}`, sides: k % 2 ? { X: B, O: A } : { X: A, O: B }, aIs: k % 2 ? 'O' : 'X' }, base.job));
}
function tally(jobs, results) {
  let w = 0, d = 0, l = 0, ms = 0, max = 0, mv = 0;
  results.forEach((r, k) => { if (r.winner === jobs[k].aIs) w++; else if (r.winner === 'none' || r.winner === 'draw') d++; else l++; ms += r.think[jobs[k].aIs] / Math.max(1, r.n[jobs[k].aIs]); if (r.max > max) max = r.max; mv += r.moves; });
  return { w, d, l, n: jobs.length, ms: ms / jobs.length, max, moves: mv / jobs.length };
}
module.exports = { engine, scope, play, runMany, wilson, pairJobs, tally, REF };

async function main() {
  const args = process.argv.slice(2), flags = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => a.slice(2).split('='))), pos = args.filter(a => !a.startsWith('--'));
  const cmd = pos[0], budget = Number(flags.budget || 0), threads = Number(flags.threads || 0) || undefined, seed = flags.seed || 's1';
  if (cmd === 'ref') {
    const refFile = path.join(ROOT, 'docs', 'ai-ref.txt'), commit = pos[1] || fs.readFileSync(refFile, 'utf8').trim();
    fs.rmSync(REF, { recursive: true, force: true }); fs.mkdirSync(REF, { recursive: true });
    cp.execSync(`git archive ${commit} src/core src/games | tar -x -C "${REF}"`, { cwd: ROOT, stdio: 'inherit' });
    fs.writeFileSync(path.join(REF, 'package.json'), '{ "type": "module" }\n');
    console.log(`reference engine: ${commit} in .ai-ref/`);
    return;
  }
  if (!fs.existsSync(REF)) { console.error('no reference engine: run `node scripts/ai-versus.js ref` first'); process.exit(1); }
  if (cmd === 'duel') {
    const all = scope(), types = !pos[1] || pos[1] === 'all' ? all : pos[1].split(','), n = Number(pos[2] || 400);
    const A = flags.a || 'new:hard', B = flags.b || 'ref:hard';
    console.log(`duel: ${A} against ${B}, ${n} squares a game${budget ? `, ${budget} ms a decision` : ''}`);
    for (const t of types) {
      const jobs = pairJobs(A, B, n, { seedTag: `${seed}:${t}`, job: { games: [t], only: 4, budget } });
      const t0 = Date.now(), res = await runMany(jobs, threads), s = tally(jobs, res), ci = wilson(s.w, s.d, s.n);
      console.log(`${t.padEnd(11)} ${pct(ci.p).padStart(5)}%  [${pct(ci.lo)}, ${pct(ci.hi)}]  w ${s.w} d ${s.d} l ${s.l}  ${s.moves.toFixed(1)} moves  ${s.ms.toFixed(1)} ms/move (max ${s.max})  ${((Date.now() - t0) / 1000).toFixed(0)} s${ci.lo > 0.5 ? '  +' : ci.hi < 0.5 ? '  -' : ''}`);
    }
    return;
  }
  if (cmd === 'match') {
    const n = Number(pos[1] || 1000), A = pos[2] || 'new:hard', B = pos[3] || 'ref:hard', games = flags.games ? flags.games.split(',') : scope();
    const jobs = pairJobs(A, B, n, { seedTag: `${seed}:m`, job: { games, budget } });
    const t0 = Date.now();
    let done = 0;
    const res = await runMany(jobs, threads, () => { if (++done % 200 === 0) process.stderr.write(`${done}/${n}\n`); }), s = tally(jobs, res), ci = wilson(s.w, s.d, s.n);
    console.log(`${A} against ${B}, ${n} matches on ${games.length} games${budget ? `, ${budget} ms a decision` : ''}: ${pct(ci.p)}% [${pct(ci.lo)}, ${pct(ci.hi)}]  (won ${s.w}, drawn ${s.d}, lost ${s.l}; ${s.moves.toFixed(0)} moves a match, ${s.ms.toFixed(1)} ms a decision, max ${s.max}; ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    return;
  }
  console.error('usage: ai-versus.js ref [commit] | duel [types|all] [n] | match [n] [A] [B]');
  process.exit(1);
}
if (!isMainThread && workerData && workerData.worker) {
  parentPort.on('message', m => { try { parentPort.postMessage({ i: m.i, result: play(m.job) }); } catch (e) { parentPort.postMessage({ i: m.i, error: String(e && e.stack || e) }); } });
} else if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
