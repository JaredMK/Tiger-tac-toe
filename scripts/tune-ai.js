'use strict';
// Self-play tuning of the Hard computer's strategy weights (src/core/aiw.js: line value, defence priority,
// risk appetite, the playouts' exploring, progress chance and reset needs, the playouts per candidate):
//
//   npm run tune-ai -- [--rounds 30] [--matches 200] [--budget 60] [--seed 1] [--threads 4] [--physics] [--save]
//
// Hill climbing: each round nudges one weight (up or down, by its step or a few), plays that candidate against
// the weights so far (both at Hard, sides swapped every match, the same seeds for every candidate) and keeps
// the change only when it wins clearly more (above half by the margin). Thousands of matches: minutes to an
// hour, on every core. Never run on its own (no workflow calls it): the admin runs it and decides.
// --save writes the weights to the database (config/ai, read by the game at start and the server every
// 20 s; the admin's Bot Settings page shows them) with the service-account key in GOOGLE_APPLICATION_CREDENTIALS
// (as scripts/make-admin.js); without --save the result is printed, nothing is written anywhere.
const path = require('node:path');
const { engine, runMany } = require('./ai-arena.js');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 && process.argv[i + 1] != null && !/^--/.test(process.argv[i + 1]) ? process.argv[i + 1] : d; };
const flag = k => process.argv.includes('--' + k);
const ROUNDS = Number(arg('rounds', 30)), MATCHES = Number(arg('matches', 200)), BUDGET = Number(arg('budget', 60)), SEED = String(arg('seed', 1));
const THREADS = Number(arg('threads', 0)) || undefined, PHYSICS = flag('physics'), MARGIN = Number(arg('margin', 0.03));
const E = engine(PHYSICS), { AI_DEFAULTS, AI_LIMITS } = E;
const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const fix = (k, v) => { const [lo, hi, step] = AI_LIMITS[k]; return Number(Math.min(hi, Math.max(lo, Math.round(v / step) * step)).toFixed(4)); };

// Candidate against incumbent over MATCHES matches (sides swapped every other match): the candidate's score
// (a win 1, a draw 0.5) over the matches decided.
async function duel(cand, inc, round) {
  const jobs = [];
  for (let k = 0; k < MATCHES; k++) {
    const cx = k % 2 === 0;
    jobs.push({ seed: `${SEED}:${round}:${k}`, levels: { X: 'hard', O: 'hard' }, weights: { X: cx ? cand : inc, O: cx ? inc : cand }, budget: BUDGET, physics: PHYSICS, cx });
  }
  const rs = await runMany(jobs, { threads: THREADS });
  let pts = 0, n = 0;
  rs.forEach((r, k) => { if (r.winner === 'none') return; n++; const me = jobs[k].cx ? 'X' : 'O'; pts += r.winner === me ? 1 : r.winner === 'draw' ? 0.5 : 0; });
  return { rate: n ? pts / n : 0.5, n };
}
(async () => {
  const keys = Object.keys(AI_DEFAULTS).filter(k => k !== 'margin'), rnd = lcg(Number(SEED) || 7);
  let inc = Object.assign({}, AI_DEFAULTS), played = 0, kept = 0;
  console.log(`tune-ai: ${ROUNDS} rounds of ${MATCHES} matches, ${BUDGET} ms a Hard decision${PHYSICS ? ', the physics games dealt' : ''}; starting from`, JSON.stringify(inc));
  for (let r = 1; r <= ROUNDS; r++) {
    const k = keys[Math.floor(rnd() * keys.length)], [, , step] = AI_LIMITS[k], size = step * (1 + Math.floor(rnd() * 3)) * (rnd() < 0.5 ? -1 : 1);
    const cand = Object.assign({}, inc, { [k]: fix(k, inc[k] + size) });
    if (cand[k] === inc[k]) { console.log(`round ${r}: ${k} at its limit, skipped`); continue; }
    const prev = inc[k], t0 = Date.now(), d = await duel(cand, inc, r);
    played += MATCHES;
    const win = d.rate > 0.5 + MARGIN;
    if (win) { inc = cand; kept++; }
    console.log(`round ${r}: ${k} ${cand[k]} (was ${win ? prev : inc[k]}) ${win ? 'kept' : 'dropped'}: ${(d.rate * 100).toFixed(1)}% over ${d.n} matches, ${((Date.now() - t0) / 1000).toFixed(0)} s${win ? ' -> ' + JSON.stringify(inc) : ''}`);
  }
  const out = Object.assign({}, inc, { tuned: Date.now(), matches: played });
  console.log(`\n${played} matches, ${kept} changes kept. Weights:\n${JSON.stringify(out)}`);
  if (!flag('save')) { console.log('\nNothing saved: run again with --save (and GOOGLE_APPLICATION_CREDENTIALS set) to write config/ai.'); return; }
  const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
  const PROJECT = process.env.TTC_PROJECT || 'tic-tac-chaos';
  admin.initializeApp({ projectId: PROJECT, databaseURL: `https://${PROJECT}-default-rtdb.firebaseio.com` });
  await admin.database().ref('config/ai').set(out);
  console.log('Saved to config/ai: the game reads it at its next start, the server within 20 s.');
  await admin.app().delete();
})().catch(e => { console.error(e); process.exit(1); });
