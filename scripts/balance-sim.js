'use strict';
// The balance baseline (December 2026): the released mini-games played by the computer against itself at Normal, square by
// square and as whole matches, on the engine as the page and the server run it. Never part of npm test: slow.
//
//   node scripts/balance-sim.js [--squares 1000] [--matches 300] [--out dir] [--only type,...] [--no-matches] [--no-changes]
//                               [--budget 100] [--workers 4]
//
// Per square (each game alone, square 0 of a board of that game, the first mover alternating X and O): a move is chosen
// as cpuMove chooses a square's move at Normal (its tactics at the strongest level `normalSharp` of the time, else the
// plain ones: core/ai.js localBest, a fixed amount of work: until null), played through core/board.js playMove and
// endFlash, so a turn is counted exactly as the stats count it (sq.mv: a bonus move inside the same turn is not a new
// move) and a level square resets (a draw). Reported: n, the reset rate, the winner's moves (p25, median, p75, mean), the
// loser's median, the first mover's wins (of decided squares), and an ESTIMATED time in the square.
//
// The time estimate (no person in a simulation): every action's own animation (the game's flashMs at Normal, core/timer.js
// playMs) plus its result's hold (PLAY.flash) plus a person's decision time: DECIDE_MS (2.5 s) for each turn's first
// action, AGAIN_MS (1 s) for each further action inside the same turn (another roll, another spin). A whole match adds the
// board's own moments each turn: BOARD_MS (1.5 s: the glow, the zoom in and out). These are assumptions, stated in the output.
//
// Whole matches: the 19 released games dealt, cpuMove at Normal for both sides (its search on the real clock with a
// smaller budget, --budget ms a decision, so it runs in reasonable time), the match's turns, each side's own turns, the
// estimated minutes and the share of drawn matches (no line left for either side).
//
// Changes: for the games past the targets (the winner's median above 6, or a p75 of 8 or more) a few TUNE settings,
// each simulated the same way (E.setTune before dealing). Results as JSON and a Markdown summary in --out.
const path = require('node:path'), fs = require('node:fs');
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');
const E = require('../src/core/engine.js');

const LAUNCH = ['bullseye', 'bump', 'candy', 'coins', 'wordle', 'ttt', 'c4', 'bs', 'hangman', 'hilo', 'pig', 'wheels', 'rl', 'plinko', 'snakes', 'rps', 'war', 'claw', 'mastermind'];
const DECIDE_MS = 2500, AGAIN_MS = 1000, BOARD_MS = 1500;
// The setting changes tried for a game past the targets (each within its TUNE's range: checked when the run starts).
// Each: a TUNE change (config/tune/<type>) or a game's own card (config/pig, config/wheels, config/plinko). Picked from the
// baseline (December 2026): the games past the targets (moves or a long p75, or time), and those whose first mover wins
// over 60%. A computer mistake rate ('miss') changes the computer alone: shown as a proxy for less exact (human) play.
const CHANGES = {
  c4: [{ tune: { k: 3 } }, { tune: { miss: 15 } }, { tune: { miss: 30 } }],
  ttt: [{ tune: { miss: 10 } }, { tune: { miss: 25 } }],
  wheels: [{ wheels: { target: 25 } }, { wheels: { target: 20 } }],
  pig: [{ pig: { target: 40 } }, { pig: { target: 35 } }, { pig: { sides: 6, target: 35 } }],
  coins: [{ tune: { flips: 4 } }, { tune: { n: 3 } }],
  bullseye: [{ tune: { goal: 6 } }, { tune: { goal: 8 } }],
  candy: [{ tune: { gap: 2 } }, { tune: { gap: 4 } }],
  plinko: [{ plinko: { target: 10 } }, { plinko: { target: 14 } }, { tune: { bonus: 1 } }],
};
const FLAG = s => s.winnerMoves.p50 > 6 || s.winnerMoves.p75 >= 8 || s.resetRate > 0.5 || (s.timeSec.p50 != null && s.timeSec.p50 > 90) || s.firstMoverWins > 0.6;
const CARDS = { pig: 'setPigConfig', wheels: 'setWheelsConfig', plinko: 'setPlinkoConfig' };
const CARD_NOW = { pig: () => E.pigConfig(), wheels: () => E.wheelsConfig(), plinko: () => E.plinkoConfig() };
function withChange(c) {   // (a card is set whole: the values in force with the change over them; Risky Spins ignores a partial card)
  const tuneSet = c && c.tune, cards = Object.keys(CARDS).filter(k => c && c[k]);
  return { tuneSet, apply: () => { for (const k of cards) E[CARDS[k]](Object.assign({}, CARD_NOW[k](), c[k])); }, undo: () => { for (const k of cards) E[CARDS[k]](null); } };
}
const label = c => (!c ? 'as set' : Object.entries(c).map(([card, o]) => Object.entries(o).map(([k, v]) => `${card === 'tune' ? '' : card + '.'}${k} ${v}`).join(', ')).join('; '));

const pct = (a, p) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))]; };
const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const q3 = a => ({ p25: pct(a, 0.25), p50: pct(a, 0.5), p75: pct(a, 0.75), mean: mean(a) });
const other = p => (p === 'X' ? 'O' : 'X');
const actMs = f => E.playMs(f, 4) + (E.PLAY.flash[f.kind] || 800);

// ---------- one square ----------
function square(type, k) {
  const rng = E.makeRng(`balance:${type}:${k}`), first = k % 2 ? 'O' : 'X';
  const st = E.newMatch(rng, { games: [type], vs: 'cpu' });
  st.turn = first;
  const sharp = E.levelCfg('normal').sharp, sq = st.squares[0];
  let ms = 0, actions = 0, refused = 0, skipped = 0;
  for (let n = 0; n < 2000; n++) {
    const me = st.turn, mini = sq.mini;
    if (!E.canMove(mini, me)) { if (!E.canMove(mini, other(me))) return { stuck: true }; st.turn = other(me); skipped++; continue; }   // (a side with nothing to do here plays elsewhere on a real board)
    const fresh = st.lock !== 0;
    const lvl = rng() < sharp ? 'hard' : 'normal';
    let mv = null;
    try { mv = E.localBest(E.publicMini(mini, me), me, rng, Object.assign({}, E.STYLE0), { value: E.squareValue(st.squares, 0, me, E.STYLE0), behind: 0, level: lvl, until: null }).move; } catch (e) { mv = null; }
    let r = mv == null ? { ok: false } : E.playMove(st, 0, mv, rng);
    if (!r.ok) { refused++; r = E.playMove(st, 0, E.randomLegalMove(mini, me, rng), rng); }
    if (!r.ok) return { stuck: true };
    actions++; ms += actMs(r.flash) + (fresh ? DECIDE_MS : AGAIN_MS);
    const kind = r.flash.kind;
    E.endFlash(st);
    if (kind === 'claim' || kind === 'match' || kind === 'draw') {
      const e = st.sqlog[st.sqlog.length - 1];
      return { end: e.end, w: e.w, X: e.X, O: e.O, first, ms, actions, refused, skipped };
    }
  }
  return { stuck: true };
}
function squares(type, n, change) {
  const w = withChange(change);
  E.setTune(type, w.tuneSet || null); w.apply();
  const out = [];
  try { for (let k = 0; k < n; k++) out.push(square(type, k)); } finally { E.setTune(type, null); w.undo(); }
  return out;
}
function summarize(type, rows, tuneSet) {
  const ok = rows.filter(r => !r.stuck), won = ok.filter(r => r.end === 'won');
  const w = won.map(r => r[r.w]), l = won.map(r => r[other(r.w)]);
  return {
    type, change: tuneSet || null, label: label(tuneSet), n: ok.length, stuck: rows.length - ok.length,
    resetRate: ok.length ? (ok.length - won.length) / ok.length : null,
    winnerMoves: q3(w), loserMedian: pct(l, 0.5),
    firstMoverWins: won.length ? won.filter(r => r.w === r.first).length / won.length : null,
    timeSec: q3(won.map(r => r.ms / 1000)), actionsMedian: pct(won.map(r => r.actions), 0.5),
    refusedMoves: ok.reduce((s, r) => s + r.refused, 0),
  };
}

// ---------- one whole match ----------
function match(k, budget) {
  const rng = E.makeRng('balance-match:' + k);
  const st = E.newMatch(rng, { games: LAUNCH, vs: 'cpu' });
  const own = { X: 0, O: 0 };
  let ms = 0, turns = 0;
  for (let n = 0; n < 3000 && !st.winner; n++) {
    const me = st.turn, fresh = st.lock == null;
    const m = E.cpuMove(st, rng, null, { level: 'normal', budget });
    if (!m) { st.turn = other(me); continue; }
    let r = E.playMove(st, m.square, m.move, rng);
    if (!r.ok) r = E.playMove(st, m.square, E.randomLegalMove(st.squares[m.square].mini, me, rng), rng);
    if (!r.ok) return { stuck: true };
    if (fresh) { turns++; own[me]++; ms += DECIDE_MS + BOARD_MS; } else ms += AGAIN_MS;
    ms += actMs(r.flash);
    E.endFlash(st);
  }
  if (!st.winner) return { stuck: true };
  return { turns, X: own.X, O: own.O, min: ms / 60000, winner: st.winner, reason: st.winReason, squares: st.sqlog.length };
}

// ---------- the worker pool ----------
if (!isMainThread) {
  const job = workerData;
  if (job.kind === 'sq') parentPort.postMessage(summarize(job.type, squares(job.type, job.n, job.change), job.change));
  else parentPort.postMessage(Array.from({ length: job.to - job.from }, (_, i) => match(job.from + i, job.budget)));
} else setImmediate(main);

function run(jobs, workers) {
  return new Promise((resolve, reject) => {
    const out = new Array(jobs.length); let next = 0, done = 0;
    const start = () => {
      if (next >= jobs.length) return;
      const i = next++, w = new Worker(__filename, { workerData: jobs[i] });
      w.once('message', m => { out[i] = m; done++; process.stderr.write(`  ${done}/${jobs.length}\r`); });
      w.once('error', reject);
      w.once('exit', () => { if (done === jobs.length) resolve(out); else start(); });
    };
    if (!jobs.length) resolve(out);
    for (let k = 0; k < Math.min(workers, jobs.length); k++) start();
  });
}
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const flag = k => process.argv.includes('--' + k);
const f1 = v => (v == null ? '—' : Number.isInteger(v) ? String(v) : v.toFixed(1));
const pc = v => (v == null ? '—' : (100 * v).toFixed(1) + '%');


async function main() {
  const N = Number(arg('squares', 1000)), M = Number(arg('matches', 300)), out = arg('out', path.join(process.cwd(), 'balance-out'));
  const only = arg('only', null), types = only ? only.split(',') : LAUNCH, W = Number(arg('workers', 4)), budget = Number(arg('budget', 100));
  fs.mkdirSync(out, { recursive: true });
  for (const [t, list] of Object.entries(CHANGES)) for (const c of list) for (const [k, v] of Object.entries(c.tune || {})) {   // every TUNE change within its range
    const f = E.tuneFields(t).find(x => x.k === k);
    if (!f || E.tuneValue(f, v) !== v) throw new Error(`${t}.${k} = ${v}: not a value its TUNE takes`);
  }
  const t0 = Date.now();
  console.error(`baseline: ${types.length} games x ${N} squares`);
  const base = await run(types.map(type => ({ kind: 'sq', type, n: N })), W);
  fs.writeFileSync(path.join(out, 'baseline.json'), JSON.stringify(base, null, 1));
  let mres = null;
  if (!flag('no-matches')) {
    console.error(`matches: ${M}`);
    const per = Math.ceil(M / (W * 2)), jobs = [];
    for (let a = 0; a < M; a += per) jobs.push({ kind: 'match', from: a, to: Math.min(M, a + per), budget });
    const rows = (await run(jobs, W)).flat(), ok = rows.filter(r => !r.stuck);
    mres = { n: ok.length, stuck: rows.length - ok.length, budget, turns: q3(ok.map(r => r.turns)), ownTurns: q3(ok.flatMap(r => [r.X, r.O])), minutes: q3(ok.map(r => r.min)),
      drawShare: ok.filter(r => r.winner === 'draw').length / ok.length, xWins: ok.filter(r => r.winner === 'X').length / ok.length, squaresEnded: q3(ok.map(r => r.squares)) };
    fs.writeFileSync(path.join(out, 'matches.json'), JSON.stringify(mres, null, 1));
  }
  let changes = [];
  if (!flag('no-changes')) {
    const jobs = [];
    for (const s of base) if (FLAG(s)) for (const c of CHANGES[s.type] || []) jobs.push({ kind: 'sq', type: s.type, n: N, change: c });
    console.error(`changes: ${jobs.length}`);
    changes = await run(jobs, W);
    fs.writeFileSync(path.join(out, 'changes.json'), JSON.stringify(changes, null, 1));
  }
  const name = t => (E.INFO[t] && E.INFO[t].name) || t;
  const row = s => `| ${s.change || s.asSet ? s.label : name(s.type)} | ${s.n} | ${f1(s.winnerMoves.p25)} / ${f1(s.winnerMoves.p50)} / ${f1(s.winnerMoves.p75)} | ${f1(s.winnerMoves.mean)} | ${f1(s.loserMedian)} | ${pc(s.firstMoverWins)} | ${pc(s.resetRate)} | ${f1(s.timeSec.p25)} / ${f1(s.timeSec.p50)} / ${f1(s.timeSec.p75)} |`;
  const head = '| Game | Squares | Winner\'s moves p25 / median / p75 | Mean | Loser median | First mover wins | Resets | Est. time in square, s (p25 / median / p75) |\n|---|---|---|---|---|---|---|---|';
  let md = `# Balance baseline (simulation, computer v computer at Normal)\n\n${N} squares a game, seeded (balance:<type>:<k>), the first mover alternating. Moves are turns (a bonus move inside a turn is not a new move), as the stats count them. **Time is an estimate**: every action's animation (the game's flashMs at Normal) and its result's hold, plus ${DECIDE_MS / 1000} s of decision for a turn's first action and ${AGAIN_MS / 1000} s for each further action in the same turn. Flagged ⚠: winner's median above 6, p75 of 8 or more, resets over half the squares, an estimated median over 90 s in the square, or the first mover winning over 60% of decided squares.\n\n${head}\n${base.map(s => row(s) + (FLAG(s) ? ' ⚠' : '')).join('\n')}\n`;
  if (mres) md += `\n## Whole matches (${mres.n}, the 19 released games, cpuMove at Normal both sides, search budget ${budget} ms)\n\n| | p25 | median | p75 | mean |\n|---|---|---|---|---|\n| Turns (both sides) | ${f1(mres.turns.p25)} | ${f1(mres.turns.p50)} | ${f1(mres.turns.p75)} | ${f1(mres.turns.mean)} |\n| Each player's own turns | ${f1(mres.ownTurns.p25)} | ${f1(mres.ownTurns.p50)} | ${f1(mres.ownTurns.p75)} | ${f1(mres.ownTurns.mean)} |\n| Est. minutes (+ ${BOARD_MS / 1000} s a turn on the board) | ${f1(mres.minutes.p25)} | ${f1(mres.minutes.p50)} | ${f1(mres.minutes.p75)} | ${f1(mres.minutes.mean)} |\n| Squares ended (won or reset) | ${f1(mres.squaresEnded.p25)} | ${f1(mres.squaresEnded.p50)} | ${f1(mres.squaresEnded.p75)} | ${f1(mres.squaresEnded.mean)} |\n\nDrawn matches: ${pc(mres.drawShare)}; X (first) wins ${pc(mres.xWins)}.\n`;
  if (changes.length) {
    md += `\n## Setting changes for the flagged games (each simulated alone, ${N} squares)\n`;
    for (const t of [...new Set(changes.map(c => c.type))]) md += `\n### ${name(t)}\n\n${head.replace('| Game |', '| Setting |')}\n${row(Object.assign({}, base.find(b => b.type === t), { asSet: true, label: 'as set (code defaults)' }))}\n${changes.filter(c => c.type === t).map(row).join('\n')}\n`;
  }
  md += `\nRun time ${((Date.now() - t0) / 1000).toFixed(0)} s.\n`;
  fs.writeFileSync(path.join(out, 'summary.md'), md);
  console.log(md);
}
