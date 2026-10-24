'use strict';
// A match record as the database holds it (core/records.js parseMatch): only the match's own fields are taken, each held
// to its shape; a blob carrying anything else, or a field out of shape, is no match (security review F2: a crafted
// record is never applied to the page).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

const good = () => E.newOnlineMatch({ names: { X: 'A', O: 'B' }, games: { ttt: true } }, E.makeRng('pm'), 'm1');
const pack = st => ({ state: JSON.stringify(st), secrets: '{}' });

test('parseMatch: a record as the server writes it comes back whole; fields it does not know are dropped', () => {
  const rec = good(), r = E.parseMatch(E.packMatch(rec));
  assert.deepEqual(Object.keys(r.state).sort(), Object.keys(rec.state).sort());
  const extra = Object.assign({}, rec.state, { __proto__: null, evil: '<script>', screen: 'win', flash: { kind: 'x' }, online: { me: 'X' } });
  const p = E.parseMatch(pack(extra));
  assert.ok(p, 'still a match');
  for (const k of ['evil', 'screen', 'flash', 'online']) assert.equal(k in p.state, false, `${k} dropped`);
});
test('parseMatch: a field out of shape is no match at all', () => {
  const rec = good();
  for (const [k, v] of [['turn', 'Z'], ['turn', '<b>'], ['seq', '3'], ['winner', 'both'], ['lock', 12], ['resigned', 'XO'], ['lastBy', 1], ['squares', []], ['recent', {}], ['sc', 'yes'], ['id', 'x'.repeat(61)]]) {
    const st = Object.assign({}, rec.state, { [k]: v });
    assert.equal(E.parseMatch(pack(st)), null, `${k} = ${JSON.stringify(v)}`);
  }
  const sq = Object.assign({}, rec.state, { squares: rec.state.squares.map((q, i) => (i === 4 ? { owner: '<img>', mini: q.mini } : q)) });
  assert.equal(E.parseMatch(pack(sq)), null, 'a square owned by something that is not a side');
  assert.equal(E.parseMatch({ state: 'not json' }), null); assert.equal(E.parseMatch({ state: '[]' }), null); assert.equal(E.parseMatch(null), null);
  assert.deepEqual(E.parseMatch({ state: JSON.stringify(rec.state), secrets: '[1,2]' }).secrets, {}, 'secrets that are not a map are none');
});
