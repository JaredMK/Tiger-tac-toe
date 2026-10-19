'use strict';
// Flash: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

/* ===================================== Flash ===================================== */
// The question answered again here, from its words and the items shown, independently of the engine.
function answerOf(items, text) {
  const has = (it, w) => it[0] === w || it[1] === w, words = ['star', 'heart', 'bolt', 'blue', 'green', 'purple'];
  let m;
  if ((m = text.match(/^How many (blue|green|purple) items\?$/))) return items.filter(it => it[1] === m[1]).length;
  if ((m = text.match(/^How many (star|heart|bolt)s\?$/))) return items.filter(it => it[0] === m[1]).length;
  if ((m = text.match(/^How many (blue|green|purple) (star|heart|bolt)s\?$/))) return items.filter(it => it[1] === m[1] && it[0] === m[2]).length;
  if ((m = text.match(/^How many items were NOT (blue|green|purple)\?$/))) return items.filter(it => it[1] !== m[1]).length;
  if ((m = text.match(/^How many items were NOT (star|heart|bolt)s\?$/))) return items.filter(it => it[0] !== m[1]).length;
  if ((m = text.match(/^What was the (\d+)(st|nd|rd|th) item\?$/))) return items[Number(m[1]) - 1].join(':');
  if ((m = text.match(/^Which item came right after the first (star|heart|bolt|blue item|green item|purple item)\?$/))) { const w = m[1].replace(' item', ''); const k = items.findIndex(it => has(it, w)); return items[k + 1].join(':'); }
  if ((m = text.match(/^Which item came right before the last (star|heart|bolt)\?$/))) { let k = -1; items.forEach((it, j) => { if (it[0] === m[1]) k = j; }); return items[k - 1].join(':'); }
  throw new Error('a question not understood: ' + text + words.length);
}
const P = require('../physics.js');
E.setPhysics(P);
E.setPhysics(require('../physics.js'));   // Mini Golf, Pool and Bowling are dealt only with their physics

test('flash: 6, 7 and 8 cards at 0.5 s each, a shape in a colour (never the X or O colours); only "How many [shape]s?" and "How many [colour] items?"; exactly one right option, checked against the cards shown; near-miss wrong options', () => {
  const cfg = E.flashConfig(), kinds = new Set();
  assert.ok(!E.FLASH.colours.some(c => ['red', 'yellow', 'orange'].includes(c)), 'colours apart from X (red) and O (yellow)');
  for (let level = 0; level < 3; level++) {
    for (let k = 0; k < 2000; k++) {
      const r = E.flashRound(level, lcg(k * 11 + level));
      assert.equal(r.items.length, 6 + level); assert.equal(r.ms, 500); assert.equal(r.ms, cfg['ms' + (level + 1)]);
      assert.ok(r.items.every(it => E.FLASH.shapes.includes(it[0]) && E.FLASH.colours.includes(it[1])));
      assert.ok(new Set(r.items.map(it => it[0])).size >= 2 && new Set(r.items.map(it => it[1])).size >= 2, 'never one shape or one colour throughout');
      kinds.add(r.q.kind);
      const truth = answerOf(r.items, r.q.text);
      assert.ok(/^How many ((blue|green|purple) items|(star|heart|bolt)s)\?$/.test(r.q.text), r.q.text);
      assert.ok(truth >= 1, 'never about something that never showed');
      assert.equal(r.opts.length, 4);
      assert.equal(new Set(r.opts).size, 4, 'four different options');
      assert.equal(r.opts.filter(o => o === truth).length, 1, `exactly one right option: ${r.q.text} ${JSON.stringify(r.items)} ${JSON.stringify(r.opts)}`);
      assert.equal(r.opts[r.ans], truth, 'and it is the one the engine marks');
      assert.ok(r.opts.every(o => Number.isInteger(o) && o >= 0 && o <= r.items.length) && r.opts.filter(o => o !== truth && Math.abs(o - truth) <= 3).length >= 2, `near misses: ${r.opts} for ${truth}`);
      assert.ok(r.opts.some(o => Math.abs(o - truth) === 1), 'one off among them');
    }
  }
  assert.deepEqual([...kinds].sort(), ['colour', 'shape'], 'the two questions, at every level');
});

test('physics games: the flash carries the recording and the playback time follows it; timeouts are gentle random shots; the match state stays plain JSON', () => {
  const st = E.newMatch(lcg(9), { games: ['golf', 'pool', 'bowling'] });
  for (const t of ['golf', 'pool', 'bowling']) {
    const i = st.squares.findIndex(s => s.mini.type === t && !s.owner);
    const mv = E.randomLegalMove(st.squares[i].mini, st.turn, lcg(1));
    assert.ok(mv.power >= 0.2 && mv.power <= 0.75, `${t}: a gentle shot (${mv.power})`);
    const r = E.playMove(st, i, mv, lcg(2));
    assert.equal(r.ok, true, `${t}: ${r.reason}`);
    assert.ok(st.flash.phys && st.flash.phys.rec && st.flash.phys.rec.frames.length > 10, `${t}: the recording is in the flash`);
    assert.equal(E.playMs(st.flash), st.flash.phys.ms + (t === 'golf' ? E.GOLF.hold : t === 'pool' ? E.POOLG.hold : E.BOWLG.hold) + (st.flash.kind === 'claim' ? 600 : 0) + (t === 'bowling' && st.flash.phys.strike ? 500 : 0));
    assert.deepEqual(JSON.parse(JSON.stringify(st)), st);
    E.endFlash(st);
  }
  assert.equal(E.secretOf(st.squares[0].mini), null, 'nothing hidden: the table is in the open');
  assert.ok(E.TEST_TYPES.includes('golf') && E.TEST_TYPES.includes('pool') && E.TEST_TYPES.includes('bowling'), 'admin only to begin with');
});

test('runners: the public view, the flash, the playback time, the stats log, and the match data', () => {
  E.setRunConfig(null);
  const st = E.newMatch(lcg(5), { games: ['dash', 'lane'] });
  const i = st.squares.findIndex(s => s.mini.type === 'dash');
  const m = st.squares[i].mini;
  const pm = E.publicMini(m);
  assert.deepEqual(Object.keys(pm).sort(), ['cfg', 'dist', 'runs', 'seed', 'type'], 'the seed is public: the course is no secret');
  assert.equal(E.secretOf(m), null);
  const ob = E.runCourse(m, 'X')[1];
  const r = E.playMove(st, i, { dist: ob.at, ms: Math.round(E.runSecs(m.cfg, 0, ob.at) * 1000) }, lcg(1));
  assert.equal(r.ok, true);
  assert.deepEqual(st.flash.run, { from: 0, to: ob.at, ms: Math.round(E.runSecs(m.cfg, 0, ob.at) * 1000), out: false, done: false, dist: { X: ob.at, O: 0 }, runs: { X: 1, O: 0 }, target: m.cfg.target });
  assert.equal(E.playMs(st.flash), E.RUNT.bar + E.RUNT.hold);
  E.endFlash(st);
  m.dist.O = m.cfg.target - 1; m.runs.O = 3; m.crashes.O = [120, 310, 480];
  st.turn = 'O';
  const w = E.playMove(st, i, { dist: m.cfg.target, ms: 200 }, lcg(2));
  assert.equal(w.flash.kind, 'claim'); assert.equal(E.playMs(w.flash), E.RUNT.bar + E.RUNT.hold + 600);
  assert.deepEqual(st.sqlog[st.sqlog.length - 1], { t: 'dash', end: 'won', w: 'O', X: 1, O: 1, run: { runs: { X: 1, O: 4 }, dist: { X: Math.round(ob.at), O: m.cfg.target }, crashes: { X: [Math.round(ob.at)], O: [120, 310, 480] } } }, 'the square\'s log carries its runs and crashes for the tuning');
  const stats = E.matchStats(st);
  assert.deepEqual(stats.squares[0].run.runs, { X: 1, O: 4 });
  E.endFlash(st);
  const j = st.squares.findIndex(s => s.mini.type === 'lane' && !s.owner);
  st.turn = 'X';
  E.playMove(st, j, 'auto', lcg(3)); E.endFlash(st);
  const open = E.matchStats(st).squares.find(e => e.end === 'open' && e.t === 'lane');
  assert.ok(open && open.run && open.run.runs.X === 1 && open.run.crashes.X.length === 1, 'a square still open reports its runs too');
});
