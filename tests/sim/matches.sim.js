'use strict';
// Simulations: whole matches, the computer against itself, every game. Slow, so never part of npm test:
// npm run sim -- matches
// ---- from the arcade tests ----
{
  // Run with:  node --test
  // The arcade games in the shared engine (engine.js): Bullseye, Echo, Peg Drop, Cup Pong, Trivia and Odd One Out.
  const test = require('node:test');
  const assert = require('node:assert/strict');
  const E = require('../engine.js');
  E.setPhysics(require('../physics.js'));   // Mini Golf, Pool and Bowling are dealt only with their physics

  const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const bank = n => ({ questions: Array.from({ length: n }, (_, i) => ({ id: 'q' + i, cat: i % 2 ? 'Science' : 'History', q: `Question ${i}?`, a: 'Right ' + i, wrong: ['Wrong a' + i, 'Wrong b' + i, 'Wrong c' + i] })) });
  // Play whole turns until the match is over: the computer on both sides.
  function cpuMatch(games, seed, guard = 900) {
    const rng = lcg(seed), st = E.newMatch(rng, { games });
    let n = 0;
    while (!st.winner && n++ < guard) {
      const m = E.cpuMove(st, rng);
      const r = E.playMove(st, m.square, m.move, rng);
      assert.equal(r.ok, true, `${st.squares[m.square].mini.type}: ${JSON.stringify(m.move)} refused (${r.reason})`);
      assert.deepEqual(JSON.parse(JSON.stringify(st)), st, 'the state stays plain JSON');
      E.endFlash(st);
    }
    return { st, n };
  }
  test.before(() => E.setTriviaBank(bank(40)));

  /* ===================================== all together ===================================== */
  test('the arcade games: random moves are legal, timeouts work, and matches of the computer against itself finish', () => {
    const rng = lcg(91);
    for (const t of ['bullseye', 'echo', 'plinko', 'pong', 'trivia', 'oddone']) {
      for (let k = 0; k < 30; k++) {
        const st = E.newMatch(lcg(k), { games: [t] }), m = st.squares[0].mini;
        const mv = E.randomLegalMove(m, 'X', rng);
        assert.equal(E.playMove(st, 0, mv, rng).ok, true, `${t}: a random move (${JSON.stringify(mv)})`);
      }
      const st = E.newMatch(lcg(7), { games: [t], mode: 'online', timer: 60 });
      const r = E.timeoutMove(st, rng);
      assert.equal(r.ok, true, `${t}: a timeout move`);
      assert.equal(st.lock, null, `${t}: the turn ends`);
      const { st: done, n } = cpuMatch([t], 3 + t.length);
      assert.ok(done.winner, `${t}: a match of the computer against itself finishes (${n} moves)`);
      assert.ok(n < 400, `${t}: in reasonable time (${n} moves)`);
    }
    const { st, n } = cpuMatch(['bullseye', 'echo', 'plinko', 'pong', 'trivia', 'oddone', 'ttt'], 99);
    assert.ok(st.winner, `all six together: finishes (${n} moves)`);
    // each of the six's playback timings are set, under a few seconds
    for (const t of ['bullseye', 'echo', 'plinko', 'pong', 'trivia', 'oddone']) {
      const st2 = E.newMatch(lcg(5), { games: [t] });
      const r = E.playMove(st2, 0, E.randomLegalMove(st2.squares[0].mini, 'X', rng), rng);
      const ms = E.playMs(r.flash);
      assert.ok(ms >= 500 && ms <= ({ bullseye: 6500, echo: 10500 }[t] || 3500), `${t}: plays in ${ms} ms`);   // (Bullseye and Echo include someone else's aim or attempt, replayed)
    }
  });
}

// ---- from the logic tests ----
{
  // Run with:  node --test
  // Exercises the game engine (engine.js), which the page and the Cloud Functions share.
  const test = require('node:test');
  const assert = require('node:assert/strict');

  const E = require('../engine.js');
  E.setPhysics(require('../physics.js'));   // Mini Golf, Pool and Bowling are dealt only with their physics
  // Trivia needs its questions (the page fetches trivia.json; the server has it as a file): a small made-up bank here.
  E.setTriviaBank({ questions: Array.from({ length: 30 }, (_, i) => ({ id: 'q' + i, cat: 'Test', q: `Question ${i}?`, a: 'Right ' + i, wrong: ['Wrong a' + i, 'Wrong b' + i, 'Wrong c' + i] })) });
  // The engine takes all its randomness from the caller. Where a test does not care which random choice
  // is made, these wrappers hand it a fixed seeded generator.
  const anyRng = () => E.makeRng('any');
  const L = Object.assign({}, E, {
    newState: rng => E.newState(rng || anyRng()),
    startMatch: (st, rng) => E.startMatch(st, rng || anyRng()),
    newMatch: (rng, setup) => E.newMatch(rng || anyRng(), setup),
    playMove: (st, i, m, rng, opts) => E.playMove(st, i, m, rng || anyRng(), opts),
    cpuMove: (st, rng) => E.cpuMove(st, rng || anyRng()),
    timeoutMove: (st, rng) => E.timeoutMove(st, rng || anyRng()),
    randomLegalMove: (mini, p, rng) => E.randomLegalMove(mini, p, rng || anyRng()),
    applyMove: (mini, p, m, rng, ...rest) => E.applyMove(mini, p, m, rng || anyRng(), ...rest),
  });

  // ---- helpers ----
  // rng that yields a fixed sequence of values in [0, 1)
  const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };
  // rng value that makes randInt(rng, n) return k
  const pick = (k, n) => (k + 0.5) / n;
  const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const wordRng = (list, word) => seq(pick(list.indexOf(word), list.length));
  const REMOVED = ['nim', 'chomp', 'obstruction', 'tug', 'othello'];   // Hexapawn came back as a 3x4 game

  function matchWith(types, rng = lcg(7)) {
    const st = L.newMatch(rng);
    types.forEach((t, i) => { st.squares[i].mini = L.newMini(t, rng); });
    return st;
  }
  const mini = (type, rng) => L.newMini(type, rng || lcg(11));
  // a battleship with its ship on the given cells
  const bsAt = (...ship) => Object.assign(mini('bs'), { len: ship.length, ship, revealed: new Array(16).fill(null), hits: [] });

  // O O X / X O O / O X X : full, no line, O has 5 and X has 4 (impossible with strict alternation)
  const TTT_DRAW = ['O', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];

  // a legal random move for any mini-game
  function randomMove(m, rng, p) {
    const pickFrom = a => a[Math.floor(rng() * a.length)];
    const empties = (arr, ok) => arr.map((c, k) => (ok(c) ? k : -1)).filter(k => k >= 0);
    switch (m.type) {
      case 'ttt': case 'hex': return pickFrom(empties(m.cells, c => !c));
      case 'c4': return pickFrom(Array.from({ length: L.C4.cols }, (_, c) => c).filter(c => !m.cells[c]));
      case 'hexapawn': return pickFrom(L.hpMoves(m.cells, p));
      case 'mastermind': return pickFrom(L.mmCandidates(L.publicMini(m))).slice();   // a random code still possible: legal, and the square gets cracked
      case 'bs': return pickFrom(empties(m.revealed, c => !c));
      case 'wordle': return rng() < 0.2 ? m.word : pickFrom(L.WORDS5).toUpperCase();
      case 'hangman': return pickFrom('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(l => !m.letters.some(x => x.l === l)));
      case 'dice': case 'candy': return 1;
      case 'snakes': return 'roll';
      case 'bump': return 'spin';
      case 'hilo': return m.lo + Math.floor(rng() * (m.hi - m.lo + 1));
      case 'memory': { const a = Math.floor(rng() * 9); let b = Math.floor(rng() * 8); if (b >= a) b++; return [a, b]; }
      case 'coins': return 'flip';
      case 'pig': {
        if (!m.turn) return 'roll';
        if (m.turn.rolls.length >= L.RISKY.maxRolls || m.bank[p] + m.turn.pot >= L.RISKY.goal) return 'bank';
        return rng() < 0.5 ? 'roll' : 'bank';
      }
      case 'hunt': return pickFrom(empties(m.dug, c => !c));
      case 'bj': return !m.hand ? 'deal' : pickFrom(m.hand.cards.length === 2 ? ['hit', 'stand', 'double'] : ['hit', 'stand']);
      case 'bus': return pickFrom(L.BUS.guesses[m.prog[p].length]);
      case 'rl': {
        const r = rng();
        if (r < 0.1) return 'zero';
        if (r < 0.55) return pickFrom(['g1', 'g2', 'g3']);
        const nums = [];
        while (nums.length < 8) { const n = 1 + Math.floor(rng() * 24); if (!nums.includes(n)) nums.push(n); }
        return nums;
      }
      case 'bullseye': return { x: Math.round(rng() * 1000) / 1000, y: Math.round(rng() * 1000) / 1000 };
      case 'echo': { const seq = L.echoSeq(m, p, m.level[p]); return rng() < 0.5 ? seq.slice() : seq.slice(0, Math.floor(rng() * seq.length)).concat(Math.floor(rng() * 4)); }
      case 'plinko': { const open = L.plinkoOpen(m); return open[Math.floor(rng() * open.length)]; }
      case 'pong': return { aim: rng() * 2 - 1, power: rng() };
      case 'trivia': { if (!m.ask) return 'auto'; const left = [0, 1, 2, 3].filter(k => !(m.crossed || []).includes(k)); return left.length ? left[Math.floor(rng() * left.length)] : 'auto'; }
      case 'patterns': { const left = [0, 1, 2, 3].filter(k => !(m.crossed || []).includes(k)); return left[Math.floor(rng() * left.length)]; }   // (a real pick: a timeout's is always wrong)
      case 'oddone': return Math.floor(rng() * m.grid[p].n * m.grid[p].n);
      case 'headcount': case 'flash': case 'snapshot': return rng() < 0.6 ? L.attTruth(m.type, m.round[p]) : L.attWrong(m.type, m.round[p], rng);   // (a real answer, right or near: a timeout's is always wrong)
      case 'dash': case 'lane': return rng() < 0.3 ? 'auto' : L.runAuto(m, p, rng);   // a timed-out run, or a short run as the engine itself makes one
      case 'golf': case 'pool': case 'bowling': return rng() < 0.7 ? L.physRandom(m, p, rng) : L.physAi(m, p, rng).move;   // a random gentle shot, or now and then an aimed one (gentle shots alone can take for ever to sink a hole)
      case 'skyhop': case 'scoop': case 'pinball': return rng() < 0.2 ? 'auto' : L.fingAi(m, p, rng);   // an attempt as the computer plays one (or none, timed out)
      default: return L.randomLegalMove(m, p, rng);                                       // the newer games: the engine's own random move
    }
    throw new Error('no move for ' + m.type);
  }
  // a match where the computer plays `me`, with the given squares (type names or ready-made minis)
  function cpuMatch(me, squares, owners = []) {
    const st = matchWith(squares.map(s => (typeof s === 'string' ? s : s.type)));
    for (let i = squares.length; i < 9; i++) st.squares[i].mini = L.newMini('ttt', lcg(900 + i));   // the rest: fresh, plain squares (what the pool happens to deal must not decide a tactics test)
    squares.forEach((s, i) => { if (typeof s !== 'string') st.squares[i].mini = s; });
    owners.forEach((o, i) => { if (o) st.squares[i].owner = o; });
    st.cpu = me; st.turn = me;
    return st;
  }

  test('removed games are gone from assignment, resets and the rules', () => {
    for (const t of REMOVED) {
      assert.ok(!L.TYPES.includes(t), t);
      assert.equal(L.INFO[t], undefined);
      assert.throws(() => L.newMini(t, Math.random));
    }
    const rng = lcg(42);
    const seen = new Set();
    for (let k = 0; k < 500; k++) L.newMatch(rng).squares.forEach(s => seen.add(s.mini.type));
    for (let k = 0; k < 300; k++) {
      const st = matchWith(['ttt'], rng);
      for (let i = 0; i < 8; i++) st.squares[0].mini.cells[i] = TTT_DRAW[i];
      st.turn = TTT_DRAW[8];
      L.playMove(st, 0, 8, rng);
      seen.add(st.squares[0].mini.type);
    }
    assert.deepEqual([...seen].sort(), [...L.TYPES].sort());
    for (const t of REMOVED) assert.ok(!seen.has(t));
  });

  test('random play over many matches always finishes, never shows a removed game, and keeps state plain JSON', () => {
    const rng = lcg(2024);
    const types = new Set();
    for (let game = 0; game < 60; game++) {
      const st = L.newMatch(rng);
      st.squares.forEach(s => types.add(s.mini.type));
      let guard = 0;
      while (!st.winner && guard++ < 5000) {
        const cands = st.squares.map((s, i) => (!s.owner && L.canMove(s.mini, st.turn) ? i : -1)).filter(i => i >= 0);
        const i = st.lock != null ? st.lock : cands[Math.floor(rng() * cands.length)];
        assert.ok(i != null, 'the player to move always has somewhere to play');
        const m = st.squares[i].mini;
        const r = L.playMove(st, i, randomMove(m, rng, st.turn), rng);
        assert.equal(r.ok, true, `${m.type}: ${r.reason}`);
        assert.deepEqual(JSON.parse(JSON.stringify(st)), st);
        if (st.flash.kind === 'again') assert.equal(st.lock, i);
        else assert.equal(st.lock, null);
        if (st.flash.newType) types.add(st.flash.newType);
        const mover = st.turn, again = st.flash.kind === 'again', pass = !!st.flash.pass;
        L.endFlash(st);
        if (!st.winner) {
          assert.equal(st.done, null);
          assert.equal(st.screen, again ? 'mini' : 'board');
          assert.equal(st.turn, again || pass ? mover : L.other(mover), 'the turn passes as the board comes back (unless the other side has no move anywhere)');
        }
      }
      assert.ok(st.winner, `random play finishes a match (left: ${st.squares.map(q => q.owner || q.mini.type).join(' ')})`);
      assert.equal(st.screen, 'win');
    }
    assert.deepEqual([...types].sort(), [...L.TYPES].sort(), 'every current game type showed up');
    for (const t of REMOVED) assert.ok(!types.has(t));
  });

  test('the computer cannot tell hidden information apart: same public view, same move', () => {
    const rng = lcg(5);
    const twins = [
      () => [L.newMini('wordle', wordRng(L.WORDS5, 'crane')), L.newMini('wordle', wordRng(L.WORDS5, 'house'))],
      () => [L.newMini('hangman', wordRng(L.WORDS_HANG, 'apple')), L.newMini('hangman', wordRng(L.WORDS_HANG, 'melon'))],
      () => [L.newMini('hilo', seq(pick(2, 20))), L.newMini('hilo', seq(pick(17, 20)))],
      () => [bsAt(0, 1, 2), bsAt(13, 14, 15)],
      () => [L.newMini('hunt', seq(pick(0, 25))), L.newMini('hunt', seq(pick(24, 25)))],
      () => { const a = mini('memory'), b = mini('memory', lcg(77)); return [a, b]; },
    ];
    for (const make of twins) {
      const [a, b] = make();
      assert.equal(a.type, b.type);
      const sa = cpuMatch('X', [a, 'ttt', 'ttt']), sb = cpuMatch('X', [b, 'ttt', 'ttt']);
      for (let k = 0; k < 3; k++) {
        const ma = L.cpuMove(sa, lcg(k)), mb = L.cpuMove(sb, lcg(k));
        assert.deepEqual(mb, ma, `${a.type}: the move only depends on what can be seen`);
        // make the same move in both and compare again (hidden results may differ; only public parts may steer)
        const r = L.playMove(sa, ma.square, ma.move, lcg(k + 50)); L.endFlash(sa);
        L.playMove(sb, mb.square, mb.move, lcg(k + 50)); L.endFlash(sb);
        if (!r.ok || sa.winner || sb.winner || sa.squares[ma.square].owner || sb.squares[mb.square].owner) break;
        sa.turn = 'X'; sb.turn = 'X'; sa.lock = null; sb.lock = null;
        if (JSON.stringify(L.publicMini(sa.squares[0].mini)) !== JSON.stringify(L.publicMini(sb.squares[0].mini))) break;   // the clues now differ
      }
    }
  });

  test('the computer only ever makes legal moves, from any position and in bonus moves', () => {
    const rng = lcg(606);
    let moves = 0;
    for (let game = 0; game < 25; game++) {
      const st = L.newMatch(rng);
      // some random play by both sides first, then the computer takes over each side in turn
      for (let k = 0; k < 8 && !st.winner; k++) {
        const cands = st.squares.map((s, i) => (!s.owner && L.canMove(s.mini, st.turn) ? i : -1)).filter(i => i >= 0);
        const i = st.lock != null ? st.lock : cands[Math.floor(rng() * cands.length)];
        assert.equal(L.playMove(st, i, randomMove(st.squares[i].mini, rng, st.turn), rng).ok, true);
        L.endFlash(st);
      }
      let guard = 0;
      while (!st.winner && guard++ < 400) {
        const m = L.cpuMove(st, rng);
        assert.ok(m && Number.isInteger(m.square), 'a square is chosen');
        assert.equal(st.squares[m.square].owner, null, 'never a claimed square');
        if (st.lock != null) assert.equal(m.square, st.lock, 'a bonus move stays in its square');
        const r = L.playMove(st, m.square, m.move, rng);
        assert.equal(r.ok, true, `${st.squares[m.square].mini.type}: ${JSON.stringify(m.move)} refused (${r.reason})`);
        moves++;
        L.endFlash(st);
      }
      assert.ok(st.winner, 'the match finishes');
    }
    assert.ok(moves > 500);
  });

  test('computer against computer: matches finish, every move is legal, and the state stays plain JSON', () => {
    const rng = lcg(2025);
    const winners = { X: 0, O: 0, draw: 0 }, seen = new Set();
    for (let game = 0; game < 8; game++) {
      const st = L.newMatch(rng, { mode: 'cpu', human: game % 2 ? 'X' : 'O' });
      assert.equal(st.cpu, game % 2 ? 'O' : 'X');
      st.cpu = null;                                   // both sides are played by cpuMove below
      let guard = 0;
      while (!st.winner && guard++ < 600) {
        const m = L.cpuMove(st, rng);
        const r = L.playMove(st, m.square, m.move, rng);
        assert.equal(r.ok, true, `${st.squares[m.square].mini.type}: ${JSON.stringify(m.move)} refused (${r.reason})`);
        seen.add(st.flash.type);
        assert.deepEqual(JSON.parse(JSON.stringify(st)), st);
        L.endFlash(st);
      }
      assert.ok(st.winner, `match ${game} finishes (${guard} moves)`);
      assert.equal(st.screen, 'win');
      winners[st.winner]++;
      if (st.winner === 'draw') assert.equal(st.winReason, 'blocked', 'a draw: no line left for either side');
    }
    assert.equal(winners.X + winners.O + winners.draw, 8);
    assert.ok(seen.size >= 8, `the computer played ${seen.size} different games`);
  });

  test('randomLegalMove is legal in every mini-game, many times over', () => {
    const rng = lcg(77);
    for (const type of L.TYPES) {
      for (let k = 0; k < 40; k++) {
        const mini = L.newMini(type, rng);
        // play a few random moves first so the position is not always fresh
        let p = 'X';
        for (let j = 0; j < 3; j++) {
          if (!L.canMove(mini, p)) break;
          const m = L.randomLegalMove(mini, p, rng);
          const r = L.applyMove(mini, p, m, rng);
          assert.equal(r.ok, true, `${type}: random move ${JSON.stringify(m)} refused (${r.reason})`);
          if (r.outcome !== 'continue') break;
          if (!r.again) p = L.other(p);
        }
      }
    }
  });

  test('engine: pure and seeded: the same seed plays the same match, and nothing random happens without an rng', () => {
    const play = seed => { const rng = E.makeRng(seed), st = E.newMatch(rng); for (let k = 0; k < 40 && !st.winner; k++) { const c = E.cpuMove(st, rng); E.playMove(st, c.square, c.move, rng); while (st.flash) E.endFlash(st, false) || E.leaveSquare(st); } return JSON.stringify(st.squares); };
    assert.equal(play('seed-1'), play('seed-1'), 'same seed, same match');
    assert.notEqual(play('seed-1'), play('seed-2'), 'another seed, another match');
    const r = E.makeRng(42);
    for (let k = 0; k < 1000; k++) { const v = r(); assert.ok(v >= 0 && v < 1); }
    assert.throws(() => E.newState(), /needs an rng/);
    assert.throws(() => E.playMove(E.newMatch(E.makeRng(1)), 0, 0), /needs an rng/);
    const src = require('../engine-files.js').map(f => require('node:fs').readFileSync(f, 'utf8')).join('\n');
    const code = src.replace(/\/\/.*$/gm, '');                       // the code, without its comments
    assert.ok(!/Math\.random|Date\.now|performance\.now|\bdocument\.|\bwindow\.|localStorage/.test(code), 'no clock, no Math.random, no page in the engine');
  });
}

// ---- from the nine tests ----
{
  // Run with:  node --test
  // Craps, Takeover and Flood (and the rest of the nine, as they come) in the shared engine.
  const test = require('node:test');
  const assert = require('node:assert/strict');
  const E = require('../engine.js');
  E.setPhysics(require('../physics.js'));

  const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  function cpuSquare(t, seed, guard = 400) {                        // the computer on both sides of one square: moves until it is decided
    const st = E.newMatch(lcg(seed), { games: [t] }), rr = lcg(seed + 7);
    let n = 0, kind = null;
    while (n < guard) {
      st.lock = 4;
      const m = E.cpuMove(st, rr), r = E.playMove(st, 4, m.move, rr);
      assert.equal(r.ok, true, `${t}: ${JSON.stringify(m.move)} refused (${r.reason})`);
      assert.deepEqual(JSON.parse(JSON.stringify(st)), st, 'the state stays plain JSON');
      n++; kind = st.flash.kind; E.endFlash(st); st.lock = null;
      if (kind !== 'move' && kind !== 'again') break;
    }
    return { n, kind, owner: st.squares[4].owner };
  }

  /* ===================================== together ===================================== */
  test('the new games: admin only to begin with, in the full list, dealt and played to the end by the computer; random and timed-out moves are legal', () => {
    for (const t of ['craps', 'takeover', 'flood']) {
      assert.ok(E.TYPES.includes(t) && E.TEST_TYPES.includes(t), `${t}: in the list, admin only`);
      assert.ok(E.INFO[t] && E.INFO[t].name, `${t}: named`);
      for (let k = 0; k < 30; k++) {
        const st = E.newMatch(lcg(k), { games: [t] }), mv = E.randomLegalMove(st.squares[0].mini, 'X', lcg(k + 1));
        assert.equal(E.playMove(st, 0, mv, lcg(k + 2)).ok, true, `${t}: a random move (${JSON.stringify(mv)})`);
        assert.ok(E.playMs(st.flash) >= 500 && E.playMs(st.flash) < 60000);
      }
      const st = E.newMatch(lcg(7), { games: [t], mode: 'online', timer: 60 });
      assert.equal(E.timeoutMove(st, lcg(8)).ok, true, `${t}: a timeout`);
      const { n, owner } = cpuSquare(t, 21);
      assert.ok(owner, `${t}: decided (${n} moves)`);
    }
    // a whole match of the three with others, the computer on both sides
    const rng = lcg(31), st = E.newMatch(rng, { games: ['craps', 'takeover', 'flood', 'ttt'] });
    let n = 0;
    while (!st.winner && n++ < 600) { const m = E.cpuMove(st, rng); assert.equal(E.playMove(st, m.square, m.move, rng).ok, true); E.endFlash(st); }
    assert.ok(st.winner, `a match finishes (${n} moves)`);
  });

  test('the second four: admin only, dealt and played to the end by the computer (ties reset); random and timed-out moves are legal; nothing to come is kept in the square', () => {
    for (const t of ['seating', 'districts', 'shelves', 'roads']) {
      assert.ok(E.TYPES.includes(t) && E.TEST_TYPES.includes(t) && E.INFO[t], `${t}: listed, admin only`);
      for (let k = 0; k < 20; k++) {
        const st = E.newMatch(lcg(k), { games: [t] }), mv = E.randomLegalMove(st.squares[0].mini, 'X', lcg(k + 1));
        assert.equal(E.playMove(st, 0, mv, lcg(k + 2)).ok, true, `${t}: a random move (${JSON.stringify(mv)})`);
        assert.ok(E.playMs(st.flash) >= 500 && E.playMs(st.flash) < 5000);
      }
      const st = E.newMatch(lcg(7), { games: [t], mode: 'online', timer: 60 });
      assert.equal(E.timeoutMove(st, lcg(8)).ok, true, `${t}: a timeout`);
      const sq = E.newMini(t, lcg(3));
      assert.equal(E.secretOf(sq), null, `${t}: no secret kept; what comes next is drawn as the move is made`);
      const keys = Object.keys(sq).join(',');
      assert.ok(!/queue|future|order/.test(keys), `${t}: nothing to come in the square (${keys})`);
      const { kind } = cpuSquare(t, 41);
      assert.ok(['claim', 'match', 'draw'].includes(kind), `${t}: decided or tied (${kind})`);
    }
    const rng = lcg(51), st = E.newMatch(rng, { games: ['seating', 'districts', 'shelves', 'roads', 'ttt'] });
    let n = 0;
    while (!st.winner && n++ < 800) { const m = E.cpuMove(st, rng); assert.equal(E.playMove(st, m.square, m.move, rng).ok, true); E.endFlash(st); }
    assert.ok(st.winner, `a match of them finishes (${n} moves)`);
  });
}

// ---- from the trio tests ----
{
  // Run with:  node --test
  // Patterns, Risk Wheels and Sniff in the shared engine (engine.js): the rules, the hidden parts, the
  // timeouts, the computer, and the checks on each game's numbers.
  const test = require('node:test');
  const assert = require('node:assert/strict');
  const E = require('../engine.js');

  // Play whole turns until the match is over: the computer on both sides.
  function cpuMatch(games, seed, guard = 900) {
    const rng = E.makeRng('trio' + seed), st = E.newMatch(rng, { games });
    let n = 0;
    while (!st.winner && n++ < guard) {
      const m = E.cpuMove(st, rng);
      const r = E.playMove(st, m.square, m.move, rng);
      assert.equal(r.ok, true, `${st.squares[m.square].mini.type}: ${JSON.stringify(m.move)} refused (${r.reason})`);
      assert.deepEqual(JSON.parse(JSON.stringify(st)), st, 'the state stays plain JSON');
      E.endFlash(st);
    }
    return { st, n };
  }
  const only = t => Object.fromEntries(E.TYPES.map(g => [g, g === t]));

  /* ===================================== all three ===================================== */
  test('patterns, wheels and sniff: computer-vs-computer matches finish, the state stays plain JSON, every square settles', () => {
    for (const g of ['patterns', 'wheels', 'sniff']) for (let s = 0; s < 6; s++) {
      const { st, n } = cpuMatch(only(g), g + s);
      assert.ok(st.winner, `${g}: a result (${n} moves)`);
    }
    for (let s = 0; s < 6; s++) { const games = Object.fromEntries(E.TYPES.map(t => [t, ['patterns', 'wheels', 'sniff', 'ttt'].includes(t)])); assert.ok(cpuMatch(games, 'mix' + s).st.winner); }
  });
}
