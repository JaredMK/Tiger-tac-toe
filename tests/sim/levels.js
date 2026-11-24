'use strict';
// The computer's levels against each other in one mini-game (the AI levels pass): N squares between two levels, the
// first mover alternating square by square (the higher level moves first in the even squares), through the engine's own
// computer (core/ai.js localBest: the game's tactics at that level and the level's mistakes in this game, aiSlip), a
// finger game's attempt and Echo's plan as cpuMove makes them. A square is played until it is claimed, drawn (a level
// square) or `cap` moves have gone.
//
//   pairing(type, hi, lo, N, tune, opts) -> { n, hiWins, loWins, draws, open, hiRate, ms, moves }
//     hiRate: hi's share of the decided squares (draws apart: reported as their own share of N).
//     tune: the game's settings for this run ({ k: value }, as the admin saves them; null: the defaults).
//     opts: { seed, cap (moves a square, 3000), budget (ms a decision may search: ctx.until; null, the default, a
//       fixed amount of work as the tests use) }.
//
// From the command line, every pairing in parallel over worker threads (os.availableParallelism() - 1 by default):
//   node tests/sim/levels.js <type,type,...|all> [N] [--budget ms] [--jobs n] [--tune '{"aiMissEasy":20}'] [--json file]
// prints, for each game, Hard v Normal and Normal v Easy (hi's share of decided squares, draws, never ended, time).
// Targets (the AI levels pass): Hard beats Normal 65-75%, Normal beats Easy 65-75%; a game of pure luck is exempt and
// says so in its notes.
const path = require('path');
const { performance } = require('perf_hooks');

let E = null;
const eng = () => {
  if (E) return E;
  E = require('../engine.js');
  E.setPhysics(require('../physics.js'));                                    // (Mini Golf, Pool, Bowling: dealt only with their physics)
  E.setTriviaBank(JSON.parse(require('fs').readFileSync(path.join(__dirname, '../../trivia.json'), 'utf8')));   // (Trivia: the real bank)
  return E;
};

// What the match does around a square that a lone square needs too: Trivia's questions come from the match (core/board.js
// triviaDeal, at the deal and after each right answer).
function deal(m, rng) { if (m.type === 'trivia') { const e = eng(), st = { squares: [{ mini: m }] }; e.triviaDeal(st, st.squares[0], rng); } }
function play(type, lv, rng, N0, o, m) {
  const e = eng();
  let p = N0, moves = 0;
  deal(m, rng);
  for (let k = 0; k < (o.cap || 3000); k++) {
    const t0 = o.budget ? performance.now() : 0, until = o.budget ? () => Math.max(0, t0 + o.budget - performance.now()) : null;
    const b = e.localBest(e.publicMini(m, p), p, rng, {}, { level: lv[p], diff: lv[p], until, value: 1, behind: 0 });
    let mv = b.move;
    if (mv && mv.fing) mv = e.fingAi(m, p, rng, mv.level);                 // (a finger game: its attempt, made as cpuMove's fingPlay makes it)
    else if (mv && mv.echo) mv = e.cpuEcho(m, p, mv, rng);              // (Echo: its taps from its plan)
    const r = e.applyMove(m, p, mv, rng);
    if (!r.ok) throw new Error(`${type}: the computer's move was refused (${r.reason}) at ${lv[p]}: ${JSON.stringify(mv).slice(0, 200)}`);
    moves++;
    if (r.outcome !== 'continue') return { end: r.outcome === 'draw' ? 'draw' : (r.winner || p), moves };
    deal(m, rng);
    if (!r.again) p = p === 'X' ? 'O' : 'X';
  }
  return { end: 'open', moves };
}
// Squares `from` to `to` of a pairing (a worker's share): the higher level is X in even squares, O in odd ones; X
// always moves first, so the first mover alternates.
function chunk(type, hi, lo, from, to, tuneSet, opts) {
  const e = eng(), o = opts || {}, out = { hiWins: 0, loWins: 0, draws: 0, open: 0, moves: 0, ms: 0 };
  e.setTune(type, tuneSet || null);
  try {
    for (let g = from; g < to; g++) {
      const hiSide = g % 2 ? 'O' : 'X', lv = hiSide === 'X' ? { X: hi, O: lo } : { X: lo, O: hi };
      const rng = e.makeRng(`${type}-levels:${hi}:${lo}:${o.seed || ''}:${g}`), m = e.newMini(type, rng);
      const t0 = performance.now(), r = play(type, lv, rng, 'X', o, m);
      out.ms += performance.now() - t0; out.moves += r.moves;
      if (r.end === 'draw') out.draws++; else if (r.end === 'open') out.open++; else if (r.end === hiSide) out.hiWins++; else out.loWins++;
    }
  } finally { e.setTune(type, null); }
  return out;
}
const sum = (rs, n) => {
  const t = { n, hiWins: 0, loWins: 0, draws: 0, open: 0, moves: 0, ms: 0 };
  for (const r of rs) for (const k of ['hiWins', 'loWins', 'draws', 'open', 'moves', 'ms']) t[k] += r[k];
  const dec = t.hiWins + t.loWins;
  t.hiRate = dec ? t.hiWins / dec : 0.5; t.moves /= n || 1;
  return t;
};
function pairing(type, hi, lo, N, tuneSet, opts) { return sum([chunk(type, hi, lo, 0, N, tuneSet, opts)], N); }
const pct = x => `${(100 * x).toFixed(1)}%`;
function line(type, label, r) {
  return `${label} ${pct(r.hiRate).padStart(6)} (${r.hiWins}-${r.loWins}${r.draws ? `, ${r.draws} drawn` : ''}${r.open ? `, ${r.open} NEVER ENDED` : ''}), ${(r.ms / r.n).toFixed(1)} ms a square`;
}
module.exports = { pairing, chunk, line, deal, PAIRS: [['hard', 'normal'], ['normal', 'easy']] };

// ---- the command line: every (game, pairing, slice) a job, over worker threads ----
if (require.main === module) {
  const { Worker } = require('worker_threads'), os = require('os'), fs = require('fs');
  const args = process.argv.slice(2), flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args.splice(i, 2)[1] : d; };
  const budget = flag('--budget', null), jobsN = Number(flag('--jobs', Math.max(1, (os.availableParallelism ? os.availableParallelism() : os.cpus().length) - 1)));
  const tuneArg = flag('--tune', null), jsonOut = flag('--json', null), pairsArg = flag('--pairs', null);
  const e = eng(), list = !args[0] || args[0] === 'all' ? e.TYPES.filter(t => !e.SC_ONLY.includes(t)) : args[0].split(',');   // (all: every game a normal match deals; Standoff Grid, Super Chaos's alone, left out)
  const N = Number(args[1] || 300), SL = Math.max(10, Math.ceil(N / 6)), tuneSet = tuneArg ? JSON.parse(tuneArg) : null;
  const pairs = pairsArg ? pairsArg.split(',').map(s => s.split(':')) : module.exports.PAIRS;
  const jobs = [];
  for (const t of list) for (const [hi, lo] of pairs) for (let f = 0; f < N; f += SL) jobs.push({ t, hi, lo, from: f, to: Math.min(N, f + SL) });
  const res = {}, t0 = Date.now();
  let next = 0, live = 0;
  const done = () => {
    const out = {};
    for (const t of list) {
      out[t] = {};
      const rows = pairs.map(([hi, lo]) => { const k = `${hi}:${lo}`, r = sum((res[t] && res[t][k]) || [], N); out[t][k] = r; return line(t, `${hi[0].toUpperCase()}v${lo[0].toUpperCase()}`, r); });
      console.log(`${t.padEnd(9)} ${rows.join('  |  ')}`);
    }
    console.log(`${list.length} games, ${N} squares a pairing, ${jobsN} workers${budget ? `, ${budget} ms a decision` : ', fixed work (until null)'}: ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(out, null, 1));
  };
  const spawn = () => {
    if (next >= jobs.length) { if (!live) done(); return; }
    const j = jobs[next++]; live++;
    const w = new Worker(__filename.replace(/levels\.js$/, 'levels-worker.js'), { workerData: { job: j, tune: tuneSet, budget: budget ? Number(budget) : null } });
    w.once('message', m => {
      live--;
      if (m.err) { console.error(`${j.t} ${j.hi}v${j.lo}: ${m.err}`); (res[j.t] = res[j.t] || {})[`${j.hi}:${j.lo}`] = ((res[j.t] || {})[`${j.hi}:${j.lo}`] || []).concat([]); }
      else ((res[j.t] = res[j.t] || {})[`${j.hi}:${j.lo}`] = (res[j.t][`${j.hi}:${j.lo}`] || [])).push(m.r);
      w.terminate(); spawn();
    });
    w.once('error', er => { live--; console.error(`${j.t}: ${er.message}`); spawn(); });
  };
  for (let k = 0; k < Math.min(jobsN, jobs.length); k++) spawn();
}
