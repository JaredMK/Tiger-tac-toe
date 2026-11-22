'use strict';
// The mini-game review's simulation pass (docs/mini-game-review.md, Phase 1): N squares of one game, the computer
// against itself at Normal, on the engine as the page and the server run it (the square loop is scripts/balance-sim.js's,
// with the physics library and the trivia bank loaded so every game plays, and a round or attempt started where a game
// needs Start). The first mover alternates X and O.
//
//   node scripts/audit/sim.js <type> [n=300]            one game, prints its JSON summary
//   node scripts/audit/sim.js --all [n] [--jobs 2] [--out dir] [--only a,b]   every game, a child process each
const path = require('node:path'), fs = require('node:fs'), { spawn } = require('node:child_process');
const ROOT = path.join(__dirname, '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };

function one(type, N) {
  const E = require(path.join(ROOT, 'src', 'core', 'engine.js'));
  E.setPhysics(require(path.join(ROOT, 'tests', 'physics.js')));
  try { E.setTriviaBank(JSON.parse(fs.readFileSync(path.join(ROOT, 'trivia.json'), 'utf8'))); } catch (e) { /* (no bank: Trivia will not deal) */ }
  const other = p => (p === 'X' ? 'O' : 'X'), needsStart = process.env.AUDIT_START === '1' && (E.ATT_TYPES.includes(type) || E.FINGER_TYPES.includes(type));
  const pct = (a, p) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))]; };
  const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const rows = [], t0 = Date.now();
  let clock = 1e9;
  for (let k = 0; k < N; k++) {
    const rng = E.makeRng(`audit:${type}:${k}`), first = k % 2 ? 'O' : 'X';
    const st = E.newMatch(rng, { games: [type], vs: 'cpu' }); st.turn = first;
    const sharp = E.levelCfg('normal').sharp, sq = st.squares[0];
    let actions = 0, refused = 0, row = null, firstTurnWin = false;
    for (let n = 0; n < 3000 && !row; n++) {
      const me = st.turn, mini = sq.mini;
      if (!E.canMove(mini, me)) { if (!E.canMove(mini, other(me))) { row = { stuck: 'nobody can move' }; break; } st.turn = other(me); continue; }
      const lvl = rng() < sharp ? 'hard' : 'normal';
      clock += 4000;
      if (needsStart && !(mini.started && mini.started[me])) { try { E.attStart(st, 0, me, clock); } catch (e) { /* (not a Start game after all) */ } }
      let mv = null;
      try { mv = E.localBest(E.publicMini(sq.mini, me), me, rng, Object.assign({}, E.STYLE0), { value: E.squareValue(st.squares, 0, me, E.STYLE0), behind: 0, level: lvl, until: null }).move; } catch (e) { mv = null; }
      if (mv && mv.fing) mv = E.fingAi(sq.mini, me, rng, mv.level);   // (a finger game's attempt is made by the computer's hand: core/ai.js fingPlay)
      let r = mv == null || mv === 'auto' ? { ok: false } : E.playMove(st, 0, mv, rng, { at: clock + 2000 });
      if (!r.ok) { refused++; let m2 = null; try { m2 = E.randomLegalMove(sq.mini, me, rng); } catch (e) { m2 = null; } r = m2 == null ? { ok: false } : E.playMove(st, 0, m2, rng, { at: clock + 2000 }); }
      if (!r.ok) { row = { stuck: 'no legal move: ' + (r.reason || '') }; break; }
      actions++;
      const kind = r.flash.kind;
      E.endFlash(st);
      if (kind === 'claim' || kind === 'match' || kind === 'draw') { const e = st.sqlog[st.sqlog.length - 1]; row = { end: e.end, w: e.w, X: e.X, O: e.O, first, actions, refused }; }
    }
    rows.push(row || { stuck: 'never ended (3000 actions)' });
    if (Date.now() - t0 > 20 * 60000) break;                        // (a game this slow: what it has by then)
  }
  const ok = rows.filter(r => !r.stuck), won = ok.filter(r => r.end === 'won'), w = won.map(r => r[r.w]), l = won.map(r => r[other(r.w)]);
  return { type, name: E.INFO[type].name, n: rows.length, stuck: rows.length - ok.length, stuckWhy: [...new Set(rows.filter(r => r.stuck).map(r => r.stuck))].slice(0, 3),
    draws: ok.length ? +((ok.length - won.length) / ok.length).toFixed(3) : null,
    winnerMoves: { p25: pct(w, 0.25), p50: pct(w, 0.5), p75: pct(w, 0.75), mean: w.length ? +mean(w).toFixed(2) : null }, loserMedian: pct(l, 0.5),
    firstMover: won.length ? +(won.filter(r => r.w === r.first).length / won.length).toFixed(3) : null,
    winIn1: won.length ? +(won.filter(r => r[r.w] <= 1).length / won.length).toFixed(3) : null, winIn2: won.length ? +(won.filter(r => r[r.w] <= 2).length / won.length).toFixed(3) : null,
    actionsMedian: pct(won.map(r => r.actions), 0.5), refused: ok.reduce((s, r) => s + r.refused, 0), secs: Math.round((Date.now() - t0) / 1000) };
}

if (process.argv[2] === '--all') {
  const E = require(path.join(ROOT, 'src', 'core', 'engine.js'));
  const N = Number(process.argv[3]) > 0 ? Number(process.argv[3]) : 300, JOBS = Number(arg('--jobs', 2)), OUT = path.resolve(arg('--out', path.join(ROOT, '_shots', 'audit-sim'))), only = arg('--only', null);
  fs.mkdirSync(OUT, { recursive: true });
  const queue = E.TYPES.filter(t => (!only || only.split(',').includes(t)) && !fs.existsSync(path.join(OUT, t + '.json')));
  let done = 0; const total = queue.length;
  const next = () => {
    const t = queue.shift(); if (!t) return;
    let buf = ''; const c = spawn(process.execPath, [__filename, t, String(N)], { stdio: ['ignore', 'pipe', 'pipe'] });
    c.stdout.on('data', d => { buf += d; }); let err = ''; c.stderr.on('data', d => { err += d; });
    const kill = setTimeout(() => c.kill(), 25 * 60000);
    c.on('close', code => { clearTimeout(kill); done++; let r; try { r = JSON.parse(buf); } catch (e) { r = { type: t, error: (err || 'no output').split('\n').slice(0, 4).join(' | ').slice(0, 400), code }; } fs.writeFileSync(path.join(OUT, t + '.json'), JSON.stringify(r)); console.log(`${done}/${total} ${t}: ${r.error ? 'ERROR ' + r.error : `winner's moves ${r.winnerMoves.p25}/${r.winnerMoves.p50}/${r.winnerMoves.p75}, first mover ${r.firstMover}, draws ${r.draws}, stuck ${r.stuck}, refused ${r.refused}, ${r.secs}s`}`); next(); });
  };
  for (let k = 0; k < JOBS; k++) next();
} else console.log(JSON.stringify(one(process.argv[2], Number(process.argv[3]) || 300)));
