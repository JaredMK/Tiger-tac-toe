'use strict';
// Simulation: Pinball's launch. On every layout, 50 balls at each strength 0.0, 0.1 ... 1.0 (the power
// within ±0.05 of it, the square's seven spots dealt afresh each ball, no flipper input), each run to its
// first drain, save or fall-back (or 15 s). Reports, per layout and strength, how many entered the
// playfield (touched a bumper, a slingshot or a target, or came down to the flippers), how many drained
// or were saved without touching anything (the loop-and-drain), how many fell back into the lane (too
// weak: served again), how many were still going at the cap or had to be nudged (stuck), and any
// tunnelling (outside the outline, inside a wall, back in the lane through the shut gate, the guard).
// Slow, so never part of npm test:   npm run sim -- pinball-launch
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const P = require('../physics.js');
E.setPhysics(P);

const { dealTable, launchTrial } = require('../pinball-launch.js');
const STRENGTHS = Array.from({ length: 11 }, (_, i) => i / 10);
test('pinball: 50 launches at every strength on every layout, no flippers: where each ball went', () => {
  const rows = [], overall = {};
  for (let k = 0; k < P.PIN_LAYOUTS.length; k++) {
    for (const s of STRENGTHS) {
      const c = { entered: 0, touched: 0, loopDrain: 0, fellBack: 0, stuck: 0, tunnel: 0, n: 50, touch: [] }, probs = [];
      for (let b = 0; b < 50; b++) {
        const rng = E.makeRng(`launch:${k}:${s}:${b}`), tb = dealTable(k, rng), p = Math.max(0, Math.min(1, s - 0.05 + 0.1 * rng()));
        const r = launchTrial(tb, p);
        if (r.entered) c.entered++;
        if (r.touched) c.touched++;
        if (r.end === 'loopDrain') c.loopDrain++;
        if (r.end === 'fellBack') c.fellBack++;
        if (r.end === 'stuck') c.stuck++;
        if (r.tunnel) { c.tunnel++; probs.push(`${r.tunnel} (power ${p.toFixed(2)})`); }
        if (r.firstTouch != null) c.touch.push(r.firstTouch);
      }
      const pct = v => Math.round((100 * v) / c.n).toString().padStart(3) + '%';
      const touch = c.touch.length ? (c.touch.reduce((a, b) => a + b, 0) / c.touch.length).toFixed(2) + 's' : '  -  ';
      rows.push(`  ${P.PIN_LAYOUTS[k].name.padEnd(12)} ${s.toFixed(1)}  entered ${pct(c.entered)}  touched ${pct(c.touched)}  loop-and-drain ${pct(c.loopDrain)}  fell back ${pct(c.fellBack)}  stuck ${pct(c.stuck)}  tunnelled ${pct(c.tunnel)}  first touch ${touch}` + (probs.length ? `  !! ${probs.slice(0, 3).join('; ')}` : ''));
      for (const key of ['tunnel', 'stuck']) assert.equal(c[key], 0, `${P.PIN_LAYOUTS[k].name} at ${s.toFixed(1)}: no ball ${key === 'tunnel' ? 'tunnels' : 'is stuck'} (${probs.join('; ')})`);
      assert.ok(c.loopDrain <= c.n * 0.05, `${P.PIN_LAYOUTS[k].name} at ${s.toFixed(1)}: loop-and-drain at most 5% (${c.loopDrain} of ${c.n})`);
      assert.equal(c.fellBack, 0, `${P.PIN_LAYOUTS[k].name} at ${s.toFixed(1)}: no launch falls back into the lane (${c.fellBack} of ${c.n})`);
      const o = overall[s] || (overall[s] = { entered: 0, touched: 0, loopDrain: 0, fellBack: 0, stuck: 0, tunnel: 0, n: 0 });
      for (const key of ['entered', 'touched', 'loopDrain', 'fellBack', 'stuck', 'tunnel', 'n']) o[key] += c[key];
    }
  }
  console.log(rows.join('\n'));
  console.log('  all layouts:');
  for (const s of STRENGTHS) { const o = overall[s], pct = v => Math.round((100 * v) / o.n).toString().padStart(3) + '%'; console.log(`    ${s.toFixed(1)}  entered ${pct(o.entered)}  touched ${pct(o.touched)}  loop-and-drain ${pct(o.loopDrain)}  fell back ${pct(o.fellBack)}  stuck ${pct(o.stuck)}  tunnelled ${pct(o.tunnel)}`); }
  for (const s of STRENGTHS) { const o = overall[s]; assert.ok(o.entered >= o.n * 0.98, `strength ${s}: nearly every ball enters the playfield (${o.entered} of ${o.n})`); if (s >= 0.3) assert.ok(o.touched >= o.n * 0.9, `strength ${s}: nine in ten touch a bumper, a slingshot or a target (${o.touched} of ${o.n})`); }   // (the weakest launches drop off the gate onto the right side and some roll straight to the flippers)
});
