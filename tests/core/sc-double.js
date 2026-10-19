'use strict';
// Super Chaos test helper: a round in which both players win the same square (square 4), for any Super Chaos
// game, found by playing: both players play that square round after round (each with the game's own tactics,
// each on their own copy of it, as in a match) until a round where a move of each wins it together. The
// round is rebuilt from its seeds, so a page can play the same round (tests/core/chaos-double.test.js).
const E = require('../engine.js');

const SQ = 4;
const clone = v => JSON.parse(JSON.stringify(v));
// A Super Chaos match against the computer (it plays O), every square Higher/Lower but square 4: the type's
// Super Chaos square, dealt from the seed.
function setUp(type, seed) {
  const rng = E.makeRng('dbl:' + type + ':' + seed);
  const st = E.newState(rng);
  st.setup.local = { pick: 'X', p2: 'cpu', n1: '', n2: '' };
  E.seatLocal(st.setup, rng);
  if (!E.startChaos(st, rng)) throw new Error('no match');
  st.squares = Array.from({ length: 9 }, () => ({ owner: null, mini: { type: 'hilo', target: 20, lo: 1, hi: 20, guesses: [] }, mv: { X: 0, O: 0 } }));
  E.scSquareMini(st, st.squares[SQ], type, E.makeRng('dbl-sq:' + type + ':' + seed));   // (its own stream: the same square whatever the match's deal took)
  E.scBegin(st, rng);
  st.sc.cpu = null;
  return st;
}
// The human's move in square 4: the game's own tactics, step by step (from the seed), then back to the board.
function humanMove(st, seed) {
  const rng = E.makeRng(seed), moves = [];
  for (let k = 0; k < 60 && !st.sc.me; k++) {
    const l = st.lock; st.lock = SQ;
    const plan = E.cpuMove(st, rng);
    st.lock = l;
    if (!plan) break;
    let r = E.playMove(st, SQ, plan.move, rng);
    if (!r.ok) { const m = E.randomLegalMove(st.squares[SQ].mini, st.turn, rng); r = E.playMove(st, SQ, m, rng); if (!r.ok) break; moves.push(m); }
    else moves.push(plan.move);
    st.flash = null;
  }
  E.leaveSquare(st);
  return moves;
}
const cpuMove = (st, seed) => E.scCpu(st, E.makeRng(seed), { square: SQ });
const bothWon = rc => !!rc && rc.resets.some(x => x.square === SQ && x.why === 'both');
// The round, played from its seeds: the computer's move, the human's, resolved.
function playRound(st, ox, rseed) {
  st.sc.cpu = cpuMove(st, ox.o);
  const moves = humanMove(st, ox.x);
  if (!st.sc.cpu || !st.sc.me) return { rc: null, moves };
  return { rc: E.chaosResolve(st, E.makeRng(rseed)), moves };
}
// Search: a fresh square (seed), rounds played until one where a move of each wins it together. Returns
// { type, seed, rounds: [{ o, x, r }], last: { o, x, r } } (the seeds of each round), or null.
function findDouble(type, opts) {
  opts = Object.assign({ seeds: 6, tries: 10, rounds: 40 }, opts || {});
  for (let s = 0; s < opts.seeds; s++) {
    const st = setUp(type, s), rounds = [];
    for (let r = 0; r < opts.rounds; r++) {
      const xs = [], os = [];
      for (let k = 0; k < opts.tries; k++) {
        const c = clone(st); humanMove(c, `x${r}:${k}`);
        if (c.sc.me) xs.push({ seed: `x${r}:${k}`, win: !!c.sc.me.win, need: E.needsOf(E.publicMini(c.squares[SQ].mini), 'X'), at: JSON.stringify(E.publicMini(c.squares[SQ].mini)) });
        const m = cpuMove(st, `o${r}:${k}`);
        if (m) os.push({ seed: `o${r}:${k}`, win: !!m.win, need: E.needsOf(E.publicMini(m.mini), 'O'), at: JSON.stringify(E.publicMini(m.mini)) });
      }
      const wx = xs.filter(x => x.win), wo = os.filter(o => o.win);
      const px = (wx.length ? wx : xs).slice(0, 4), po = (wo.length ? wo : os).slice(0, 4);   // (a game settled at the round's end: any moves, tried together)
      for (const x of px) for (const o of po) for (const rs of ['r0', 'r1', 'r2']) {
        const c = clone(st), { rc } = playRound(c, { o: o.seed, x: x.seed }, rs);
        if (bothWon(rc)) return { type, seed: s, rounds, last: { o: o.seed, x: x.seed, r: rs } };
      }
      // On towards the win, neither winning yet: the moves that get both furthest, together (a Bump knock, say, undoes them)
      const near = list => list.filter(z => !z.win).sort((a, b) => a.need - b.need).filter((z, k, l) => l.findIndex(y => y.at === z.at) === k).slice(0, 3);   // (different outcomes)
      const need = c => E.needsOf(E.publicMini(c.squares[SQ].mini), 'X') + E.needsOf(E.publicMini(c.squares[SQ].mini), 'O');
      const kept = (c, rc) => !!rc && !c.winner && !c.squares[SQ].owner && !rc.resets.some(z => z.square === SQ);
      let step = null;
      for (const x of near(xs)) for (const o of near(os)) for (let q = 0; q < 4; q++) {   // (q: the round's end, where it decides something: a Roulette spin)
        if (step) break;
        const c = clone(st), t = { o: o.seed, x: x.seed, r: `ar${r}:${q}` }, { rc } = playRound(c, t, t.r);
        if (kept(c, rc) && need(c) <= need(st) && JSON.stringify(E.publicMini(c.squares[SQ].mini)) !== JSON.stringify(E.publicMini(st.squares[SQ].mini))) step = t;
      }
      if (!step) break;                                          // the square goes whatever they do: a fresh one
      playRound(st, step, step.r);
      rounds.push(step);
      E.chaosNext(st, E.makeRng('next' + r)); st.sc.cpu = null;
    }
  }
  return null;
}
// The round before the double win, rebuilt from the seeds found: the match as it stands, square 4 about to be
// won by both. The computer's move (forced) and the human's seed for theirs.
function rebuild(found) {
  const st = setUp(found.type, found.seed);
  found.rounds.forEach((step, r) => { playRound(st, step, step.r); E.chaosNext(st, E.makeRng('next' + r)); st.sc.cpu = null; });
  return st;
}
module.exports = { SQ, setUp, humanMove, cpuMove, playRound, bothWon, findDouble, rebuild };

// `node tests/core/sc-double.js [types...]`: find the double wins again and keep their seeds (sc-double.json).
if (require.main === module) {
  const fs = require('node:fs'), path = require('node:path');
  E.setPhysics(require('../physics.js'));
  E.setTriviaBank({ questions: Array.from({ length: 30 }, (_, i) => ({ id: 'q' + i, cat: 'Test', q: `Question ${i}?`, a: 'Right ' + i, wrong: ['Wrong a' + i, 'Wrong b' + i, 'Wrong c' + i] })) });
  const file = path.join(__dirname, 'sc-double.json'), kept = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const types = process.argv.slice(2).length ? process.argv.slice(2) : E.scTypes();
  for (const t of types) {
    const t0 = Date.now(), f = findDouble(t);
    console.log(t.padEnd(11), f ? `seed ${f.seed}, ${f.rounds.length} rounds before` : 'NOT FOUND', `(${Date.now() - t0} ms)`);
    if (f) kept[t] = f; else delete kept[t];
  }
  fs.writeFileSync(file, JSON.stringify(kept, null, 1) + '\n');
}
