'use strict';
// The computer against itself, many matches at a time: the harness npm run tune-ai (scripts/tune-ai.js) and the
// levels simulation (tests/sim/levels.sim.js) share. A match: two computers, each at a level (easy, normal or
// hard) with its own Hard weights, on the engine, every game but the physics ones (Mini Golf, Pool, Bowling,
// Pinball need Matter.js and simulate every candidate shot: slow; pass physics: true to deal them). The
// matches are spread over worker threads (one per core); each is seeded, so a run repeats exactly.
//
//   playMatch({ seed, levels: { X, O }, weights: { X, O }, budget, games }) -> { winner, moves, ms }
//   runMany(jobs, opts) -> results in job order (opts.threads: the threads to use)
const path = require('node:path'), os = require('node:os');
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');
const ROOT = path.join(__dirname, '..');

let E = null;
function engine(physics) {
  if (E) return E;
  E = require(path.join(ROOT, 'src', 'core', 'engine.js'));
  E.setTriviaBank({ questions: Array.from({ length: 60 }, (_, i) => ({ id: 'q' + i, cat: i % 2 ? 'Science' : 'History', q: `Question ${i}?`, a: 'Right ' + i, wrong: ['Wrong a' + i, 'Wrong b' + i, 'Wrong c' + i] })) });
  if (physics) E.setPhysics(require(path.join(ROOT, 'tests', 'physics.js')));
  E.AI_CLOCK.now = null;                                          // (the budget comes with each decision, below)
  return E;
}
const SLOW = ['golf', 'pool', 'bowling', 'pinball'];
function gamesFor(E, physics) { return E.TYPES.filter(t => !E.SC_ONLY.includes(t) && (physics || !SLOW.includes(t))); }
// One match. levels: each side's level; weights: each side's Hard weights (null: the defaults); budget: ms a
// Hard decision may take (0: a fixed amount of work).
function playMatch(job) {
  const E = engine(job.physics), rng = E.makeRng('arena:' + job.seed);
  const st = E.newMatch(rng, { games: job.games || gamesFor(E, job.physics) });
  const t0 = Date.now();
  let moves = 0;
  while (!st.winner && moves < 600) {
    const p = st.turn, w = job.weights && job.weights[p];
    E.setAiWeights(w || null);
    const m = E.cpuMove(st, rng, null, { level: job.levels[p], clock: job.budget ? Date.now : null, budget: job.budget || undefined });
    if (!m) break;
    const r = E.playMove(st, m.square, m.move, rng);
    if (!r.ok) throw new Error(`${st.squares[m.square].mini.type}: ${JSON.stringify(m.move)} refused (${r.reason})`);
    E.endFlash(st);
    moves++;
  }
  return { winner: st.winner || 'none', moves, ms: Date.now() - t0 };
}
// Many matches over the threads: jobs in order, the results in the same order.
function runMany(jobs, opts) {
  const threads = Math.max(1, Math.min((opts && opts.threads) || os.cpus().length, jobs.length));
  if (threads === 1) return Promise.resolve(jobs.map(playMatch));
  const out = new Array(jobs.length);
  let next = 0, live = 0;
  return new Promise((resolve, reject) => {
    const spawn = () => {
      const w = new Worker(__filename, { workerData: { worker: true } });
      live++;
      const feed = () => { if (next >= jobs.length) { w.terminate(); if (--live === 0) resolve(out); return; } const k = next++; w.postMessage({ k, job: jobs[k] }); };
      w.on('message', m => { out[m.k] = m.result; if (opts && opts.onResult) opts.onResult(m.k, m.result); feed(); });
      w.on('error', reject);
      feed();
    };
    for (let k = 0; k < threads; k++) spawn();
  });
}
if (!isMainThread && workerData && workerData.worker) {
  parentPort.on('message', m => { parentPort.postMessage({ k: m.k, result: playMatch(m.job) }); });
}
module.exports = { engine, gamesFor, playMatch, runMany };
