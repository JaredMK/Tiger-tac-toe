'use strict';
// The registry (src/games/index.js): what adding a game relies on (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../engine.js');
const { GAMES } = require('../../src/games/index.js');

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
