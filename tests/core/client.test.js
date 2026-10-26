'use strict';
// Client versions and platforms (core/client.js): every phone reports its version and platform; a match deals only the
// games both players' clients have (meta.js minVersion) and that are on for both their platforms (releases/platform/{p});
// a client below its platform's minimum (config/clients) must update.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const { GAMES } = require('../../src/games/index.js');

test('client: versions compare part by part (missing parts are 0); only plain versions are versions', () => {
  assert.equal(E.cmpVersion('1.0.0', '1.0.0'), 0);
  assert.equal(E.cmpVersion('1.2', '1.2.0'), 0);
  assert.equal(E.cmpVersion('1.10.0', '1.9.9'), 1, 'numbers, not text');
  assert.equal(E.cmpVersion('0.9', '1'), -1);
  for (const ok of ['1', '1.2', '1.2.3']) assert.ok(E.versionOk(ok), ok);
  for (const bad of ['', 'dev', '1.2.3.4', 'v1', '1..2', null, 3, '12345']) assert.ok(!E.versionOk(bad), String(bad));
});
test('client: a report checked: an unknown platform is the web, a bad version the first; saying nothing is the first web page', () => {
  assert.deepEqual(E.normClient({ v: '1.3.0', p: 'ios' }), { v: '1.3.0', p: 'ios' });
  assert.deepEqual(E.normClient({ v: 'x', p: 'android' }), { v: '1.0.0', p: 'web' });
  assert.deepEqual(E.normClient(undefined), { v: '1.0.0', p: 'web' });
  assert.ok(E.versionOk(E.CLIENT_VERSION), 'this code has a version');
  assert.deepEqual(E.PLATFORMS, ['web', 'ios']);
});
test('client: every mini-game declares the oldest client that has it, never newer than this code', () => {
  for (const t of E.TYPES.concat(E.OLD_TYPES)) {
    const v = GAMES[t].meta.minVersion;
    assert.ok(E.versionOk(v), `${t}: minVersion ${v}`);
    assert.ok(E.cmpVersion(v, E.CLIENT_VERSION) <= 0, `${t}: needs ${v}, this code is ${E.CLIENT_VERSION}`);
  }
});
test('client: a match deals only games both clients have and that are on for both their platforms', () => {
  const was = GAMES.c4;
  try {
    GAMES.c4 = Object.assign({}, was, { meta: Object.assign({}, was.meta, { minVersion: '1.4.0' }) });   // (as if Four in a Row came with 1.4.0)
    const web14 = { v: '1.4.0', p: 'web' }, ios13 = { v: '1.3.0', p: 'ios' }, ios14 = { v: '1.4.0', p: 'ios' };
    assert.deepEqual(E.clientTypes(['ttt', 'c4'], [web14, ios14], {}), ['ttt', 'c4']);
    assert.deepEqual(E.clientTypes(['ttt', 'c4'], [web14, ios13], {}), ['ttt'], 'the older client has no Four in a Row');
    assert.deepEqual(E.clientTypes(['ttt', 'c4'], [web14], {}), ['ttt', 'c4'], 'against a bot: only the human counts');
    assert.deepEqual(E.clientTypes(['ttt', 'c4'], [undefined], {}), ['ttt'], 'a page that says nothing is the first version');
  } finally { GAMES.c4 = was; }
  const rel = { platform: { ios: { hangman: false } } };
  assert.ok(E.platformOff('hangman', rel, 'ios') && !E.platformOff('hangman', rel, 'web'));
  assert.deepEqual(E.clientTypes(['ttt', 'hangman'], [{ p: 'web' }, { p: 'web' }], rel), ['ttt', 'hangman'], 'web and web: on');
  assert.deepEqual(E.clientTypes(['ttt', 'hangman'], [{ p: 'web' }, { p: 'ios' }], rel), ['ttt'], 'cross-play with iOS: off for both');
  assert.ok(!E.platformOff('ttt', { platform: { ios: { ttt: true } } }, 'ios'), 'a switch only ever turns a game off');
  assert.ok(E.isReleased('hangman', rel), 'the per-platform node is no game of its own');
});
test('client: below its platform\'s minimum a client must update; no minimum, no gate', () => {
  assert.ok(!E.needsUpdate({ v: '1.0.0', p: 'ios' }, null));
  assert.ok(!E.needsUpdate({ v: '1.0.0', p: 'ios' }, { web: '1.2.0' }), 'the web\'s minimum is not the app\'s');
  assert.ok(E.needsUpdate({ v: '1.0.0', p: 'ios' }, { ios: '1.1' }));
  assert.ok(!E.needsUpdate({ v: '1.1.0', p: 'ios' }, { ios: '1.1' }));
  assert.deepEqual(E.normMins({ web: '1.0.0', ios: 'nope', android: '2' }), { web: '1.0.0', ios: null });
});
