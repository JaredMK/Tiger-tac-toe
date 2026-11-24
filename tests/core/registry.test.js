'use strict';
// The registry (src/games/index.js): what adding a game relies on (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../engine.js');
const { GAMES, TYPES } = require('../../src/games/index.js');
const { tuneValue, tuneNorm, tuneDefaults } = require('../../src/core/tune.js');

const DIR = path.join(__dirname, '..', '..', 'src', 'games');
test('registry: every game has its folder (rules.js, ai.js, meta.js, view.js) and its meta (name, explainer, icon, release)', () => {
  for (const t of Object.keys(GAMES)) {
    for (const f of ['rules.js', 'ai.js', 'meta.js', 'view.js']) assert.ok(fs.existsSync(path.join(DIR, t, f)), `${t}/${f}`);
    const m = GAMES[t].meta;
    assert.ok(m.info && m.info.name && m.info.hint, `${t}: info`);
    assert.ok(m.explainer && m.explainer.name && m.explainer.play && m.explainer.win, `${t}: explainer (name, play, win)`);
    assert.match(m.icon, /^<svg /, `${t}: icon`);
    assert.ok(['admin', 'released'].includes(m.release), `${t}: release`);
    assert.equal(typeof GAMES[t].rules.create, 'function', `${t}: rules.create`);
    assert.equal(typeof GAMES[t].ai.best, 'function', `${t}: ai.best`);
  }
  for (const d of fs.readdirSync(DIR)) if (d !== 'shared' && fs.statSync(path.join(DIR, d)).isDirectory()) assert.ok(GAMES[d], `${d} has a folder but no line in the registry`);
});
test('registry: the game lists come from it, in menu order, the retired games last and never dealt', () => {
  assert.deepEqual(Object.keys(GAMES), [...E.TYPES, ...E.OLD_TYPES]);
  assert.deepEqual(E.OLD_TYPES, ['dice', 'hexapawn']);
  assert.deepEqual(E.TEST_TYPES, E.TYPES.filter(t => GAMES[t].meta.release === 'admin'));
  for (const t of Object.keys(GAMES)) assert.equal(E.INFO[t], GAMES[t].meta.info);
});
test('every game has a kind (meta.js category: luck, skill or brain; its icon in the Mini-games checklist)', () => {
  for (const t of Object.keys(E.INFO)) assert.ok(["luck", "skill", "brain"].includes(GAMES[t].meta.category), `${t}: ${GAMES[t].meta.category}`);
});
test('the luck games are luck; no game carries a target label any more (its "?" shows the category alone)', () => {
  for (const t of ['hilo', 'hangman', 'sniff', 'hunt']) assert.equal(GAMES[t].meta.category, 'luck', t);
  for (const t of Object.keys(E.INFO)) assert.ok(!('target' in GAMES[t].meta) && !('scTarget' in GAMES[t].meta), `${t}: no target label`);
});

test('registry: every game lists its settings (meta.js TUNE) for Mini-game Settings, each valid, its default the code\'s', () => {
  for (const t of TYPES) {
    const T = E.tuneFields(t);   // (as registered: the game's TUNE and its per-level computer settings, core/tune.js levelTune)
    assert.ok(Array.isArray(T) && T.length >= 1, `${t}: TUNE`);
    const keys = new Set();
    for (const f of T) {
      assert.match(f.k, /^[A-Za-z0-9_]{1,24}$/, `${t}: key ${f.k}`); assert.ok(!keys.has(f.k), `${t}: ${f.k} once`); keys.add(f.k);
      assert.ok(typeof f.label === 'string' && f.label.length > 2, `${t}.${f.k}: label`);
      assert.ok(E.TUNE_GROUPS.includes(f.group) || /^Level [1-5]$/.test(f.group), `${t}.${f.k}: group ${f.group}`);   // (Level N: a game with its own values per level, Shell Game)
      if (f.opts) assert.ok(f.opts.includes(f.def), `${t}.${f.k}: default among its choices`);
      else { assert.ok(f.min <= f.def && f.def <= f.max && f.step > 0, `${t}.${f.k}: default in range`); assert.equal(tuneValue(f, f.def), f.def, `${t}.${f.k}: default on its step`); }
    }
    assert.deepEqual(tuneNorm(t, tuneDefaults(t)), {}, `${t}: the defaults are no change`);
  }
});

// The computer's levels (core/tune.js levelTune, core/ai.js aiSlip): every game but the retired ones has a thinking time
// per level in its own group; a game that can slip (games/index.js slipMode) its mistake rates too; at the defaults
// nothing changes (0); with every move a mistake the computer's moves are still legal, square after square.
test('registry: per-level computer settings (thinking time everywhere, mistakes where a game can slip), defaults no change', () => {
  for (const t of TYPES) {
    const ks = new Map(E.tuneFields(t).map(f => [f.k, f]));
    for (const l of E.AI_LEVELS_LIST) {
      const g = E.AI_GROUPS[l], th = ks.get(E.aiThinkKey(l)), mi = ks.get(E.aiMissKey(l)), off = GAMES[t].meta.AI_LEVELS === false;
      if (!off) assert.ok(th && th.group === g, `${t}: ${E.aiThinkKey(l)} in ${g}`);
      if (!mi || mi.group.startsWith('Computer:')) assert.equal(!!mi, !!E.slipMode(t), `${t}: ${E.aiMissKey(l)} exactly where it can slip (${E.slipMode(t)})`);   // (Rhythm Tap's own aiMiss<Level>, its notes missed, is its own)
      if (mi && E.slipMode(t)) assert.equal(mi.group, g, `${t}.${mi.k}: its level's group`);
    }
  }
  assert.equal(E.slipMode('dice'), null, 'a retired game has none');
});
E.setTriviaBank({ questions: Array.from({ length: 30 }, (_, i) => ({ id: 'q' + i, cat: 'Test', q: `Question ${i}?`, a: 'Right ' + i, wrong: ['Wrong a' + i, 'Wrong b' + i, 'Wrong c' + i] })) });
test('the mistake hook: every move a mistake still plays legal moves, and at 0 the computer draws nothing more from its rng', () => {
  const all = {}; for (const l of E.AI_LEVELS_LIST) all[E.aiMissKey(l)] = 100;
  for (const t of TYPES.filter(x => E.slipMode(x))) {
    E.setTune(t, all);
    try {
      for (let g = 0; g < 3; g++) {
        const rng = E.makeRng(`slip:${t}:${g}`), m = E.newMini(t, rng), st = { squares: [{ mini: m }] }, deal = () => t === 'trivia' && E.triviaDeal(st, st.squares[0], rng);
        deal();
        let p = 'X';
        for (let k = 0; k < 400; k++) {
          const b = E.localBest(E.publicMini(m, p), p, rng, {}, { level: ['easy', 'normal', 'hard'][k % 3], until: null });
          const r = E.applyMove(m, p, b.move, rng);
          assert.ok(r.ok, `${t}: a mistake refused (${r.reason}): ${JSON.stringify(b.move).slice(0, 120)}`);
          if (r.outcome !== 'continue') break;
          deal();
          if (!r.again) p = p === 'X' ? 'O' : 'X';
        }
      }
    } finally { E.setTune(t, null); }
  }
  const a = E.makeRng('same'), b = E.makeRng('same'), m = E.newMini('ttt', E.makeRng('d'));
  const x = E.localBest(E.publicMini(m, 'X'), 'X', a, {}, { level: 'easy', until: null }), y = E.localPlain(E.publicMini(m, 'X'), 'X', b, {}, { level: 'easy', until: null });
  assert.deepEqual(x, y); assert.equal(a(), b(), 'the same rng draws');
});
test('the mistake hook: a game\'s own worse() (Tic-Tac-Toe), by the match\'s difficulty (ctx.diff), from the square\'s own dealt settings', () => {
  assert.equal(E.slipMode('ttt'), 'own');
  const deal = () => { const m = E.newMini('ttt', E.makeRng('d')); m.cells[0] = 'X'; m.cells[1] = 'X'; m.cells[4] = 'O'; return m; };
  const before = deal();
  E.setTune('ttt', { aiMissNormal: 100 });
  let after;
  try { after = deal(); } finally { E.setTune('ttt', null); }
  const pick = (m, ctx) => E.localBest(E.publicMini(m, 'O'), 'O', E.makeRng('a'), {}, Object.assign({ until: null }, ctx));
  assert.equal(pick(after, { level: 'hard' }).move, 2, 'Hard: no mistakes set, the block');
  const s = pick(after, { level: 'normal' });
  assert.ok(s.slip && s.move !== 2 && !after.cells[s.move], 'Normal: the weaker move, a legal one');
  assert.equal(pick(after, { level: 'hard', diff: 'normal' }).slip, true, 'by the match\'s difficulty: a Normal match playing its sharp tactics');
  assert.equal(pick(before, { level: 'normal' }).move, 2, 'a square dealt before keeps the settings it was dealt with');
});
