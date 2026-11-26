'use strict';
// Compare environments (functions/envRules.js, src/admin/envs.js): which settings are compared and may be copied, and the
// page's rows (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const ENV = require('../../functions/envRules.js');

test('the settings compared: every admin settings node, none of the play data or what is meant to differ', () => {
  for (const p of ['releases/war', 'releases/platform/ios/war', 'releases/soon/war', 'releases/superchaos', 'features/findMatch', 'config/tune/rps/goal', 'config/ai/hard/search', 'config/anim/speed', 'config/timer/spec', 'config/lineup/war/blurb', 'config/wheels/target', 'admin/config/bots/level', 'config/bowling/x'])
    assert.ok(ENV.allowed(p), p);
  for (const p of ['config/clients/ios', 'config/verify/since', 'config/staging/mode', 'admin/staging/allow/a', 'admin/secrets/resendKey', 'admin/ownerToken', 'config/versions/rps', 'config/versionLog/rps/v2', 'devmeta/abc', 'templates/u1/t1', 'users/u1', 'games/g1', 'mfacts/2026-11-26', 'releasesX', 'config/tunes', '../releases', 'releases/war/../x', 'releases/a b', ''])
    assert.ok(!ENV.allowed(p), p);
  assert.equal(ENV.peerOf('tic-tac-chaos'), 'tic-tac-chaos-staging'); assert.equal(ENV.peerOf('tic-tac-chaos-staging'), 'tic-tac-chaos');
  assert.equal(ENV.tuneGame('config/tune/rps/goal'), 'rps'); assert.equal(ENV.tuneGame('config/ai/hard'), null);
  const copy = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'scripts', 'copy-settings.js'), 'utf8').match(/^const PATHS = (\[[\s\S]*?\]);$/m);
  for (const p of new Function(`return ${copy[1]};`)()) assert.ok(ENV.ROOTS.includes(p), p + ': every path the copy workflow carries is compared here');
  assert.deepEqual(ENV.flatten({ a: { b: 1, c: null }, d: {} }, 'x'), { 'x/a/b': 1 });
});

test('the page: differences only by default, grouped by game, release switches marked, the confirm shows before and after', async () => {
  const V = await import('../../src/admin/envs.js');
  const roots = ENV.ROOTS;
  const data = {
    roots,
    here: { env: 'staging', values: { releases: { war: true, rps: true, platform: { ios: { war: false } } }, 'config/tune': { rps: { goal: 4 } }, 'config/timer': { spec: 'm5+5' } }, times: { tune: { rps: Date.UTC(2026, 10, 20) }, log: [] } },
    peer: { env: 'production', values: { releases: { war: false, rps: true }, 'config/tune': {}, 'config/timer': { spec: 'm5+5' } }, times: { tune: {}, log: [{ path: 'releases/war', at: Date.UTC(2026, 10, 21) }] } },
  };
  const games = { war: 'War', rps: 'Rock Paper Scissors' };
  const rows = V.envRows(data, games);
  const by = Object.fromEntries(rows.map(r => [r.path, r]));
  assert.equal(by['releases/war'].diff, true); assert.equal(by['releases/war'].release, true); assert.equal(by['releases/war'].group, 'war');
  assert.equal(by['releases/war'].stage, true); assert.equal(by['releases/war'].prod, false); assert.ok(by['releases/war'].tProd > 0, 'last changed: the copy log');
  assert.equal(by['releases/platform/ios/war'].label, 'Released on iOS');
  assert.equal(by['config/tune/rps/goal'].prod, undefined); assert.ok(by['config/tune/rps/goal'].tStage > 0, 'last changed: the game\'s settings saves');
  assert.equal(by['releases/rps'].diff, false);
  let html = V.envsPage({ data, all: false, names: games });
  assert.match(html, /3<\/b> settings differ/); assert.doesNotMatch(html, /releases\/rps</, 'the same on both: hidden by default');
  assert.match(html, /class="envdiff envrel"/); assert.match(html, /data-envcopy="production" data-path="releases\/war"/); assert.match(html, /data-envcopy="staging" data-path="releases\/war"/);
  html = V.envsPage({ data, all: true, names: games });
  assert.match(html, /releases\/rps</, 'Show all');
  html = V.envsPage({ data, all: false, names: games, ask: { path: 'releases/war', to: 'production', release: true, from: true, was: false } });
  assert.match(html, /Copy to production\?/); assert.match(html, /production now<\/th><td><code>false<\/code>/); assert.match(html, /production after<\/th><td><code>true<\/code>/);
  html = V.envsPage({ err: { message: 'x', details: { setup: true, peer: 'tic-tac-chaos', account: 'sa@x.iam.gserviceaccount.com', role: 'roles/firebasedatabase.admin' } }, names: games });
  assert.match(html, /gcloud projects add-iam-policy-binding tic-tac-chaos/); assert.match(html, /sa@x\.iam\.gserviceaccount\.com/);
});
