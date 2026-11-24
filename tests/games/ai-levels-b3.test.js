'use strict';
// The computer's three levels really differ (the AI levels pass, batch 3): each game's Easy, Normal and Hard play or
// hand differ in a way a fixed position or the level's settings show. The measured rates are the levels sim's
// (node tests/sim/levels.js <ids> 300), never run here.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const imp = p => require('../../src/games/' + p);

const mini = (type, seed, t) => { E.setTune(type, t || null); try { return E.newMini(type, E.makeRng(type + ':lv:' + (seed || 1))); } finally { E.setTune(type, null); } };
const best = (pm, p, level, seed) => E.localBest(E.publicMini(pm, p), p, E.makeRng('b:' + (seed || level)), {}, { level, diff: level }).move;
const keys = type => E.tuneFields(type).map(f => f.k);
const def = (type, k) => E.tuneFields(type).find(f => f.k === k).def;

test('levels: the games of pure luck have no mistake setting (nothing weaker to play), only thinking time', () => {
  for (const t of ['duck', 'reels']) { assert.ok(!keys(t).some(k => k.startsWith('aiMiss')), t); assert.ok(keys(t).includes('aiThinkEasy'), t); }
});

test('levels: Pig: Easy banks a pot Normal rolls on; Hard plays the solved race', () => {
  const m = mini('piggy'); m.turn = { by: 'X', pot: 7, n: 2, roll: 3 };
  assert.deepEqual([best(m, 'X', 'easy'), best(m, 'X', 'normal')], ['bank', 'roll']);
  assert.ok(def('piggy', 'aiBankEasy') < def('piggy', 'aiBank'));
});

test('levels: mistakes (a deliberately weaker move) by level: Easy most, Hard least; each game\'s own weaker move is legal', () => {
  for (const t of ['bridge', 'rummy', 'mahjong', 'faces', 'pegs', 'sniff']) {
    const [e, n, h] = ['Easy', 'Normal', 'Hard'].map(l => def(t, 'aiMiss' + l));
    assert.ok(e > n || (e > h && n >= h), `${t}: ${e} ${n} ${h}`);
  }
  for (const t of ['bridge', 'rummy', 'mahjong', 'faces', 'sniff']) {
    const m = mini(t, 2), A = imp(t + '/ai.js');
    for (let s = 0; s < 6; s++) {
      const mv = A.worse(E.publicMini(m, 'X'), 'X', E.makeRng('w' + s));
      assert.ok(mv != null, t);
      assert.equal(E.applyMove(JSON.parse(JSON.stringify(m)), 'X', mv, E.makeRng('a' + s)).ok, true, `${t}: ${JSON.stringify(mv)}`);
    }
  }
  const all = { aiMissEasy: 100, aiMissNormal: 100, aiMissHard: 100 };   // a move every time a weaker one: the faces guessed are ruled out by the clues
  const f = mini('faces', 3, all); E.applyMove(f, 'X', best(f, 'X', 'normal'), E.makeRng('f'));
  const left = imp('faces/rules.js').faceLeft(f, 'X');
  if (left.length > 1) assert.ok(!left.includes(best(f, 'X', 'normal', 'x')), 'a slip guesses a face its clues rule out');
});

test('levels: the attention games: Easy right less often than Normal, Hard more', () => {
  const { attOkAt } = imp('shared/attention.js');
  for (const t of ['headcount', 'flash', 'snapshot', 'shell']) {
    const tu = E.tune(mini(t)), [e, n, h] = ['easy', 'normal', 'hard'].map(l => attOkAt(t, 0, tu, l));
    assert.ok(e < n && n < h, `${t}: ${e} ${n} ${h}`);
  }
});

test('levels: the real-time games\' hands: Easy slower and looser than Normal, Hard quicker and surer', () => {
  const { fingHand } = imp('shared/finger.js');
  for (const t of ['skyhop', 'scoop']) {
    const [e, n, h] = ['easy', 'normal', 'hard'].map(l => fingHand(mini(t), l));
    assert.ok(e.react[0] > n.react[0] && n.react[0] > h.react[0] && e.aim > n.aim && n.aim > h.aim && e.lapse > n.lapse && n.lapse > h.lapse, t);
  }
  const [pe, pn, ph] = ['easy', 'normal', 'hard'].map(l => fingHand(mini('pinball'), l));
  assert.ok(pe.jitter > pn.jitter && pn.jitter > ph.jitter && pe.letGo > pn.letGo && pe.anyPull > pn.anyPull && pn.anyPull > ph.anyPull);
  const [se, sn, sh] = ['easy', 'normal', 'hard'].map(l => E.snakeHand(mini('snake'), l));
  assert.ok(se.err > sn.err && sn.err > sh.err && se.slip > sn.slip && sn.slip > sh.slip && sh.safe && !sn.safe);
  const [we, wn, wh] = ['easy', 'normal', 'hard'].map(l => E.swarmHand(mini('swarm'), l));
  assert.ok(we.react[0] > wn.react[0] && wn.react[0] > wh.react[0] && we.aim > wn.aim && wn.aim > wh.aim && wh.sway && !wn.sway);
  const [be, bn, bh] = ['easy', 'normal', 'hard'].map(l => E.brkHand(mini('bricks'), l));
  assert.ok(be.react[0] > bn.react[0] && bn.react[0] > bh.react[0] && be.aim > bn.aim && bn.aim > bh.aim && bh.steer && !bn.steer);
  const MR = imp('muncher/rules.js'), [me, mn, mh] = ['easy', 'normal', 'hard'].map(l => MR.munHand(mini('muncher'), l));
  assert.ok(me.react > mn.react && mn.react > mh.react && me.lapse > mn.lapse && mn.lapse > mh.lapse && mh.predict && !mn.predict);
  const hc = imp('homer/rules.js').homerCfg(mini('homer')), cc = imp('claw/rules.js').clawCfg(mini('claw')), CA = imp('claw/ai.js'), sc = imp('split/rules.js').splitCfg(mini('split'));
  assert.ok(hc.ai.easy > hc.ai.normal && hc.ai.normal > hc.ai.hard);
  assert.ok(CA.clawSd(cc, 'easy') > CA.clawSd(cc, 'normal') && CA.clawSd(cc, 'normal') > CA.clawSd(cc, 'hard'));
  assert.ok(sc.ai.easy > sc.ai.normal && sc.ai.normal > sc.ai.hard);
  assert.ok(def('pusher', 'aiErrEasy') > def('pusher', 'aiErr') && def('pusher', 'aiErr') > def('pusher', 'aiErrHard'));
});

test('levels: Word Tiles: Hard notices more of the words than Normal, Easy fewer and short ones only', () => {
  assert.ok(def('wtiles', 'aiSeeHard') > def('wtiles', 'aiSee') && def('wtiles', 'aiSee') > def('wtiles', 'aiSeeEasy'));
  const m = mini('wtiles', 4), all = mini('wtiles', 4, { aiSeeHard: 100 });
  const R = imp('wtiles/rules.js'), ms = R.wtMoves(m.board, m.rack.X, R.wtCfg(m)).sort((a, b) => b.score - a.score);
  const h = best(all, 'X', 'hard');
  assert.deepEqual(h, ms[0].t, 'Hard seeing every word plays the best-scoring one');
  for (let s = 0; s < 5; s++) { const e = best(m, 'X', 'easy', 'e' + s), w = ms.find(x => JSON.stringify(x.t) === JSON.stringify(e)); assert.ok(w && w.w.length <= def('wtiles', 'aiLenEasy'), 'Easy keeps to short words'); }
});

test('levels: Maze Runner, Sniff and Peg Jump Race: their own per-level settings', () => {
  assert.ok(def('maze', 'aiStrayEasy') > 0);
  assert.ok(def('sniff', 'aiMemoryEasy') < def('sniff', 'aiMemoryNormal'));
  assert.ok(def('pegs', 'aiDepthHard') >= 2 && def('pegs', 'aiWary') === 'on' && def('pegs', 'aiWaryEasy') === 'off');
});

test('levels: Muncher\'s computer never stays stuck: a run that would be caught at once is tried another way', () => {
  // (the audit's squares that never ended: the spooks leave the pen alike every run, and the same plan was caught the
  // same way for ever; tests/sim/levels.js plays these squares to their end now)
  const { chunk } = require('../sim/levels.js');
  const r = chunk('muncher', 'normal', 'easy', 7, 8, null, {});
  assert.equal(r.open, 0, 'the square ended');
});
