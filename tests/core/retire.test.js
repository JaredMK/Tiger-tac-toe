'use strict';
// Retirement (December 2026): the admin's "remove from rotation" day per game, everywhere or on one platform
// (releases/retire/{all|web|ios}/{type}), read as the release switches stand on a day (core/games.js inRotation).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../engine.js');

const rel = { war: true, claw: true, ttt: true, soon: { claw: true }, retire: { all: { war: '2026-12-10' }, ios: { claw: '2026-12-05' }, web: { ttt: 'nope' } } };
test('a game leaves rotation from its day, everywhere or on its platform; before it, nothing changes; the raw node is left alone', () => {
  assert.equal(E.retireDate('war', rel, 'ios'), '2026-12-10'); assert.equal(E.retireDate('claw', rel, 'web'), null); assert.equal(E.retireDate('claw', rel, 'ios'), '2026-12-05');
  assert.equal(E.retireDate('ttt', rel, 'web'), null, 'a value that is not a day is ignored');
  assert.equal(E.retiredOn('war', rel, 'web', '2026-12-09'), false); assert.equal(E.retiredOn('war', rel, 'web', '2026-12-10'), true, 'from the day itself');
  const before = E.inRotation(rel, '2026-12-04');
  assert.equal(E.isReleased('war', before), true); assert.equal(E.platformOff('claw', before, 'ios'), false);
  const after = E.inRotation(rel, '2026-12-10');
  assert.equal(E.isReleased('war', after), false, 'retired everywhere: no longer released');
  assert.deepEqual(E.releasedTypes(after).includes('war'), false);
  assert.equal(E.platformOff('claw', after, 'ios'), true, 'retired on iOS: off there'); assert.equal(E.platformOff('claw', after, 'web'), false, 'the web keeps it');
  assert.equal(E.isReleased('claw', after), true);
  assert.equal(rel.war, true, 'the raw node untouched'); assert.equal(rel.platform, undefined);
  assert.deepEqual(E.retireList(rel).map(x => [x.t, x.p, x.date]), [['claw', 'ios', '2026-12-05'], ['war', 'all', '2026-12-10']], 'soonest first, malformed left out');
  assert.equal(E.inRotation(rel, null), rel, 'no day: as stored');
  assert.equal(E.inRotation({ war: true }, '2026-12-10').war, true, 'nothing scheduled: as stored');
});
test('dealing: a new match never gets a game out of rotation (the clients\' games, Find Match, a friend room); a match under way keeps dealing it from its own list', () => {
  const after = E.inRotation({ retire: { all: { war: '2026-01-01' }, ios: { claw: '2026-01-01' } }, war: true, claw: true }, '2026-06-01');
  const web = { v: E.CLIENT_VERSION, p: 'web' }, ios = { v: E.CLIENT_VERSION, p: 'ios' };
  assert.ok(!E.clientTypes(E.releasedTypes(after), [web, web], after).includes('war'));
  assert.ok(E.clientTypes(E.releasedTypes(after), [web, web], after).includes('claw'), 'a web match still has it');
  assert.ok(!E.clientTypes(E.releasedTypes(after), [web, ios], after).includes('claw'), 'any iOS player: not dealt');
  assert.ok(!E.allowedTypes(after, false).includes('war'), 'a player\'s setup');
  // a match dealt before keeps its own list: its resets still deal the game
  const st = E.newMatch(E.makeRng('r'), { games: { war: true, ttt: true } });
  assert.ok(st.games.includes('war'));
});
test('the rules: only the admin writes releases/retire, a plain day under all, web or ios; the server reads the switches through inRotation', () => {
  const rules = JSON.parse(fs.readFileSync(path.join(__dirname, '../../database.rules.json'), 'utf8')).rules.releases.retire;
  assert.match(rules.$p['.validate'], /all\|web\|ios/);
  assert.match(rules.$p.$type['.write'], /auth\.token\.admin === true/);
  assert.match(rules.$p.$type['.validate'], /\[0-9\]\{4\}-/);
  const idx = fs.readFileSync(path.join(__dirname, '../../functions/index.js'), 'utf8');
  assert.match(idx, /async function releasesNow\(\) \{ return E\.inRotation\(/);
  const page = fs.readFileSync(path.join(__dirname, '../../src/net/releases.js'), 'utf8');
  assert.match(page, /export const visibleTypes = \(\) => \{ const r = nowReleases\(\);/);
});
