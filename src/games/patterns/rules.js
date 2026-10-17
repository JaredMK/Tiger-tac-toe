// Patterns: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, randInt, shuffle } from '../../core/random.js';

// ---------- Patterns: sequence puzzles, made by rules ----------
// Nothing is written by hand: each template is a rule (a number sequence, a shape changing step by step,
// dots counted by a rule), the sequence is built from it and the answer is the rule's own value at the
// gap. The wrong options are near misses of it: a step too far or too short, the wrong operation, the
// wrong turn, the colours in the wrong order, a shape or fill that should not have changed. Every puzzle
// is then checked against a set of simple rules (any that fits what is shown, and is borne out by it,
// gives an answer): exactly one option may be such an answer, and no two options look alike. A puzzle
// that fails is thrown away and another made. One puzzle per square, shared, as Trivia's question: a
// wrong pick is crossed out for both, the right one scores and a new puzzle comes; first to 3.
// Items: a number { n }, a shape { g, r, z, c, f } (g: 0 a circle, 1 an arrow, 3-8 a polygon of that many
// sides; r its turn in degrees; z its size 1-5; c its colour 0-5; f 1 solid, 0 outline), dots { d, c }.
export const PATTERNS = { goal: 3, aiRight: 0.6, options: 4, colours: 6, maxN: 999, maxDots: 16, reveal: 1200,
  mix: [['num', 40], ['shape', 38], ['dots', 22]], middle: 0.25 };
export const patKey = it => (it == null ? '?' : 'n' in it ? `n${it.n}` : 'd' in it ? `d${it.d}c${it.c}` : `g${it.g}r${patRot(it)}z${it.z}c${it.c}f${it.f}`);
// a turn that cannot be seen is no turn: a circle has none, a polygon repeats itself every 360/sides degrees
export const patRot = it => (it.g === 0 ? 0 : it.g === 1 ? ((it.r % 360) + 360) % 360 : ((it.r % (360 / it.g)) + 360 / it.g) % (360 / it.g));
export const patNum = n => ({ n }), patDots = (d, c) => ({ d, c }), patShape = (g, r, z, c, f) => ({ g, r: ((r % 360) + 360) % 360, z, c, f });
export const patPick = (rng, list) => list[randInt(rng, list.length)];
export const patRange = (rng, lo, hi) => lo + randInt(rng, hi - lo + 1);

// The number rules a player might see in a sequence, each fitted to the values shown (null: the gap):
// the value it gives at the gap, or null when it does not fit, or is not borne out (no more shown values
// than it has numbers of its own to fix).
export function patFits(vals, gap) {
  const known = vals.map((v, i) => [i, v]).filter(([i, v]) => v != null && i !== gap), out = [];
  const isInt = x => Math.abs(x - Math.round(x)) < 1e-9;
  const check = (f, params) => { if (known.length <= params) return; for (const [i, v] of known) { const y = f(i); if (y == null || !isInt(y) || Math.round(y) !== v) return; } const y = f(gap); if (y != null && isInt(y)) out.push(Math.round(y)); };
  const [[i0, v0], [i1, v1]] = known;
  // add a step each time
  { const d = (v1 - v0) / (i1 - i0); check(i => v0 + d * (i - i0), 2); }
  // multiply each time (by 2 to 5)
  for (let r = 2; r <= 5; r++) if (v0 !== 0) check(i => v0 * Math.pow(r, i - i0), 2);
  // two steps taking turns (+a, +b, +a, ...): x_i = x0 + ceil(i/2) a + floor(i/2) b
  { const rows = known.map(([i, v]) => [1, Math.ceil(i / 2), Math.floor(i / 2), v]);
    for (let a = 0; a < rows.length; a++) for (let b = a + 1; b < rows.length; b++) for (let c = b + 1; c < rows.length; c++) {
      const s = patSolve3([rows[a], rows[b], rows[c]]);
      if (s) { check(i => s[0] + Math.ceil(i / 2) * s[1] + Math.floor(i / 2) * s[2], 3); a = b = c = rows.length; }
    } }
  // two sequences taking turns, each adding its own step
  { const fit = par => { const k = known.filter(([i]) => i % 2 === par); if (k.length < 2) return null; const d = (k[1][1] - k[0][1]) / ((k[1][0] - k[0][0]) / 2); return j => k[0][1] + d * ((j - k[0][0]) / 2); };
    const fe = fit(0), fo = fit(1);
    if (fe && fo) check(i => (i % 2 ? fo(i) : fe(i)), 4); }
  // a step that grows by the same amount each time (squares, 1 3 6 10, ...): x_i = A + B i + C i^2
  { const rows = known.map(([i, v]) => [1, i, i * i, v]);
    for (let a = 0; a < rows.length; a++) for (let b = a + 1; b < rows.length; b++) for (let c = b + 1; c < rows.length; c++) {
      const s = patSolve3([rows[a], rows[b], rows[c]]);
      if (s) { check(i => s[0] + s[1] * i + s[2] * i * i, 3); a = b = c = rows.length; }
    } }
  // each the sum of the two before (Fibonacci-style): filled out from what is shown, both ways
  { const x = vals.map((v, i) => (i === gap ? null : v));
    for (let pass = 0; pass < 4; pass++) for (let i = 0; i < x.length; i++) {
      if (x[i] != null) continue;
      if (i >= 2 && x[i - 1] != null && x[i - 2] != null) x[i] = x[i - 1] + x[i - 2];
      else if (i + 2 < x.length && x[i + 1] != null && x[i + 2] != null) x[i] = x[i + 2] - x[i + 1];
      else if (i >= 1 && i + 1 < x.length && x[i - 1] != null && x[i + 1] != null) x[i] = x[i + 1] - x[i - 1];
    }
    if (x.every(v => v != null) && known.length > 2 && x.every((v, i) => i < 2 || v === x[i - 1] + x[i - 2])) out.push(x[gap]); }
  return out;
}
// Three linear equations [a, b, c, = v]: the solution, or null when they do not fix it.
export function patSolve3(m) {
  const det = (a, b, c, d, e, f, g, h, k) => a * (e * k - f * h) - b * (d * k - f * g) + c * (d * h - e * g);
  const D = det(m[0][0], m[0][1], m[0][2], m[1][0], m[1][1], m[1][2], m[2][0], m[2][1], m[2][2]);
  if (Math.abs(D) < 1e-9) return null;
  const col = k => m.map(r => r.map((x, j) => (j === k ? r[3] : x)));
  return [0, 1, 2].map(k => { const c = col(k); return det(c[0][0], c[0][1], c[0][2], c[1][0], c[1][1], c[1][2], c[2][0], c[2][1], c[2][2]) / D; });
}
// One feature of a shape (or dots' colour) across the sequence: the values it may take at the gap,
// from the rules it might follow (the same all along, adding a step (turns: round the circle), or a
// repeating cycle of 2 or 3), each one that fits and is borne out.
export function patFeature(vals, gap, kind) {
  const known = vals.map((v, i) => [i, v]).filter(([i, v]) => v != null && i !== gap), out = new Set();
  const norm = v => (kind === 'turn' ? ((v % 360) + 360) % 360 : v);
  if (known.every(([, v]) => norm(v) === norm(known[0][1]))) out.add(norm(known[0][1]));
  if (kind !== 'cat' && known.length >= 3) {
    const [[i0, v0], [i1, v1]] = known, d = (v1 - v0) / (i1 - i0);
    if (Number.isInteger(d) && known.every(([i, v]) => norm(v0 + d * (i - i0)) === norm(v))) out.add(norm(v0 + d * (gap - i0)));
    if (kind === 'turn') for (const d2 of [45, 90, 135, 180, 225, 270, 315]) if (known.every(([i, v]) => norm(v0 + d2 * (i - i0)) === norm(v))) out.add(norm(v0 + d2 * (gap - i0)));
  }
  for (const p of [2, 3]) {
    const cls = {}; let ok = true, two = false;
    for (const [i, v] of known) { const k = i % p; if (cls[k] == null) cls[k] = norm(v); else if (cls[k] !== norm(v)) ok = false; else two = true; }
    if (ok && two && cls[gap % p] != null) out.add(cls[gap % p]);
  }
  return out;
}
// Which options fit the sequence by some rule (at most one should).
export function patFitting(puz, opts) {
  const gap = puz.seq.indexOf(null), seq = puz.seq;
  if (puz.fam === 'num' || puz.fam === 'dots') {
    const key = puz.fam === 'num' ? 'n' : 'd', fits = new Set(patFits(seq.map(it => (it ? it[key] : null)), gap));
    const colours = puz.fam === 'dots' ? patFeature(seq.map(it => (it ? it.c : null)), gap, 'cat') : null;
    return opts.map((o, k) => (fits.has(o[key]) && (!colours || colours.has(o.c)) ? k : -1)).filter(k => k >= 0);
  }
  const feats = { g: 'cat', r: 'turn', z: 'num', c: 'cat', f: 'cat' }, sets = {};
  for (const [f, kind] of Object.entries(feats)) sets[f] = patFeature(seq.map(it => (it ? (f === 'r' ? patRot(it) : it[f]) : null)), gap, kind);
  // the sides of a polygon may also be counting up or down
  const sides = seq.map(it => (it ? it.g : null)), sideFit = new Set(patFits(sides, gap));
  for (const s of sideFit) if (s >= 3 && s <= 8) sets.g.add(s);
  return opts.map((o, k) => (Object.keys(feats).every(f => sets[f].has(f === 'r' ? patRot(o) : o[f])) ? k : -1)).filter(k => k >= 0);
}

// ----- the templates: a rule, the sequence from it, the answer at the gap, and its near misses -----
// A number template: { rule, len, at(i) } and its near misses (values around the answer).
export function patNumTemplate(rng) {
  const kind = patPick(rng, ['add', 'add', 'mul', 'alt', 'square', 'fib', 'two']);
  if (kind === 'add') {
    const down = rng() < 0.3, d = patRange(rng, 2, 9) * (down ? -1 : 1), a = down ? patRange(rng, 40, 80) : patRange(rng, 1, 20);
    return { rule: down ? 'subtract' : 'add', len: 5, at: i => a + d * i, steps: [d] };
  }
  if (kind === 'mul') { const r = patPick(rng, [2, 2, 3]), a = patPick(rng, r === 3 ? [1, 2, 3, 4] : [1, 2, 3, 5, 6]); return { rule: 'multiply', len: 5, at: i => a * Math.pow(r, i), steps: [r], mul: r }; }
  if (kind === 'alt') {
    const d1 = patRange(rng, 2, 7); let d2 = patPick(rng, [-3, -2, -1, 1, 3, 4, 5, 6, 8, 9]); if (d2 === d1) d2 += 1;
    const a = patRange(rng, 2, 15);
    return { rule: 'alternate', len: 6, at: i => a + Math.ceil(i / 2) * d1 + Math.floor(i / 2) * d2, steps: [d1, d2] };
  }
  if (kind === 'square') { const s = patRange(rng, 1, 6); return { rule: 'squares', len: 5, at: i => (i + s) * (i + s), steps: [] }; }
  if (kind === 'fib') {
    const a = patRange(rng, 1, 4), b = patRange(rng, 1, 5), x = [a, b];
    for (let i = 2; i < 8; i++) x.push(x[i - 1] + x[i - 2]);
    return { rule: 'fibonacci', len: 6, at: i => x[i], steps: [] };
  }
  const a = patRange(rng, 1, 9), b = patRange(rng, 10, 30); let d = patRange(rng, 2, 6), e = patPick(rng, [-3, -2, -1, 1, 2, 3, 4, 5]); if (e === d) e = -e;
  return { rule: 'two sequences', len: 7, at: i => (i % 2 ? b + e * ((i - 1) / 2) : a + d * (i / 2)), steps: [d, e] };
}
export function patNumMisses(t, gap, ans, vals, rng) {
  const near = [], far = [], prev = vals[gap - 1], prev2 = vals[gap - 2], next = vals[gap + 1];
  near.push(t.at(gap + 1));                                            // a step too far
  if (prev != null && prev2 != null) near.push(prev + (prev - prev2), prev * 2, prev + prev2);   // the wrong operation: the last step again, doubling, the sum of the two before
  if (t.mul) near.push(ans + t.mul, prev != null ? prev * (t.mul + 1) : ans * 2);
  for (const st of t.steps) near.push(ans + st, ans - st);             // the step added once too often, or once too few
  near.push(ans + 1, ans - 1);
  far.push(t.at(gap - 1), ans + 2, ans - 2, ans + 10, ans - 10);
  if (next != null && prev != null) far.push(Math.round((prev + next) / 2));   // (a gap in the middle: halfway between its neighbours)
  return shuffle(near, rng).concat(shuffle(far, rng));
}
export function patNumPuzzle(rng, fam) {
  const t = fam === 'dots' ? patDotsTemplate(rng) : patNumTemplate(rng), mid = rng() < PATTERNS.middle;
  const len = t.len, gap = mid ? patRange(rng, 1, len - 2) : len - 1;
  const vals = Array.from({ length: len }, (_, i) => t.at(i)), ans = vals[gap];
  const max = fam === 'dots' ? PATTERNS.maxDots : PATTERNS.maxN, min = fam === 'dots' ? 1 : 0;
  if (vals.some(v => v < min || v > max)) return null;
  const colour = patRange(rng, 0, PATTERNS.colours - 1);
  const make = v => (fam === 'dots' ? patDots(v, colour) : patNum(v));
  const misses = patNumMisses(t, gap, ans, vals.map((v, i) => (i === gap ? null : v)), rng).filter(v => Number.isInteger(v) && v >= min && v <= max && v !== ans).map(make);
  if (fam === 'dots' && rng() < 0.5) misses.splice(2, 0, patDots(ans, (colour + 1 + randInt(rng, PATTERNS.colours - 1)) % PATTERNS.colours));   // sometimes: the right count, the wrong colour
  return { fam, rule: t.rule + (mid ? ' (gap)' : ''), seq: vals.map((v, i) => (i === gap ? null : make(v))), ans: make(ans), misses, ordered: true };
}
export function patDotsTemplate(rng) {
  const kind = patPick(rng, ['add', 'add', 'double', 'triangle', 'alt']);
  if (kind === 'add') { const d = patRange(rng, 1, 3), a = patRange(rng, 1, 3); return { rule: 'dots add', len: 5, at: i => a + d * i, steps: [d] }; }
  if (kind === 'double') return { rule: 'dots double', len: 5, at: i => Math.pow(2, i), steps: [], mul: 2 };
  if (kind === 'alt') { const a = patRange(rng, 1, 3); return { rule: 'dots +2 -1', len: 6, at: i => a + Math.ceil(i / 2) * 2 - Math.floor(i / 2), steps: [2, -1] }; }
  return { rule: 'dots triangle', len: 5, at: i => (i + 1) * (i + 2) / 2, steps: [] };
}
// A shape template: the features that change (and how), the rest fixed.
export function patShapePuzzle(rng) {
  const kind = patPick(rng, ['turn', 'sides', 'size', 'colour', 'fill', 'sides+fill', 'turn+colour']);
  const c0 = randInt(rng, PATTERNS.colours), base = { g: patPick(rng, [0, 3, 4, 5, 6]), r: 0, z: 3, c: c0, f: 1 };
  let len = 5, at, rule = kind;
  const cycle = shuffle([0, 1, 2, 3, 4, 5], rng).slice(0, 3), turnStep = patPick(rng, [45, 90, -45, -90]), r0 = patPick(rng, [0, 45, 90, 180, 270]);
  const grow = rng() < 0.6, s0 = patPick(rng, [3, 4]), fill0 = randInt(rng, 2);
  if (kind === 'turn') at = i => ({ ...base, g: 1, r: r0 + turnStep * i });
  else if (kind === 'sides') at = i => ({ ...base, g: grow ? s0 + i : 8 - i });
  else if (kind === 'size') at = i => ({ ...base, z: grow ? 1 + i : 5 - i });
  else if (kind === 'colour') { len = 6; at = i => ({ ...base, c: cycle[i % 3] }); }
  else if (kind === 'fill') at = i => ({ ...base, f: (fill0 + i) % 2 });
  else if (kind === 'sides+fill') at = i => ({ ...base, g: s0 + i, f: (fill0 + i) % 2 });
  else { len = 6; at = i => ({ ...base, g: 1, r: r0 + turnStep * i, c: cycle[i % 3] }); }
  const mid = rng() < PATTERNS.middle, gap = mid ? patRange(rng, 1, len - 2) : len - 1;
  const items = Array.from({ length: len }, (_, i) => { const s = at(i); return patShape(s.g, s.r, s.z, s.c, s.f); }), ans = items[gap];
  const v = (o, ch) => patShape(ch.g != null ? ch.g : o.g, ch.r != null ? ch.r : o.r, ch.z != null ? ch.z : o.z, ch.c != null ? ch.c : o.c, ch.f != null ? ch.f : o.f);
  const after = at(gap + 1), before = at(gap - 1), turns = kind.startsWith('turn');
  const own = [], other = [];                                          // near misses along the rule's own change first, then a feature that should not have changed
  if (turns) own.push(v(ans, { r: after.r }), v(ans, { r: before.r }), v(ans, { r: ans.r + 180 }), v(ans, { r: ans.r + (Math.abs(turnStep) === 90 ? 45 : 90) }));   // the wrong turn
  if (kind.includes('sides')) own.push(v(ans, { g: after.g }), v(ans, { g: before.g }));              // a side too many, or too few
  if (kind === 'size') own.push(v(ans, { z: after.z }), v(ans, { z: before.z }), v(ans, { z: ans.z + (grow ? -2 : 2) }));   // a size too far, or too short
  if (kind.includes('colour')) own.push(v(ans, { c: cycle[(cycle.indexOf(ans.c) + 1) % 3] }), v(ans, { c: cycle[(cycle.indexOf(ans.c) + 2) % 3] }));   // the colours in the wrong order
  if (kind.includes('fill')) own.push(v(ans, { f: 1 - ans.f }));                                     // the wrong fill
  if (!kind.includes('fill')) other.push(v(ans, { f: 1 - ans.f }));
  if (!kind.includes('colour')) other.push(v(ans, { c: (ans.c + 3) % PATTERNS.colours }), v(ans, { c: (ans.c + 1) % PATTERNS.colours }));
  if (!kind.includes('sides') && !turns) other.push(v(ans, { g: ans.g === 0 ? 4 : ans.g === 8 ? 7 : ans.g + 1 }));
  if (kind !== 'size') other.push(v(ans, { z: ans.z === 3 ? 2 : 3 }));
  const ok = o => o.z >= 1 && o.z <= 5 && (o.g === 0 || o.g === 1 || (o.g >= 3 && o.g <= 8));
  const misses = shuffle(own.filter(ok), rng).slice(0, 2).concat(shuffle(other.filter(ok), rng), own.filter(ok));
  if (items.some(o => o.z < 1 || o.z > 5 || (o.g !== 0 && o.g !== 1 && (o.g < 3 || o.g > 8)))) return null;
  return { fam: 'shape', rule: kind + (mid ? ' (gap)' : ''), seq: items.map((it, i) => (i === gap ? null : it)), ans, misses, ordered: true };
}
// A puzzle: { fam, seq (null at the gap), opts }, the right option's place (answer) and the rule's name,
// checked: the right option the only one any fitting rule gives, the four options all different to look at.
export function patPuzzle(rng, avoid) {
  for (let tries = 0; tries < 200; tries++) {
    let fam = PATTERNS.mix[0][0]; { let r = rng() * PATTERNS.mix.reduce((s, x) => s + x[1], 0); for (const [f, w] of PATTERNS.mix) { r -= w; if (r < 0) { fam = f; break; } } }
    if (fam === avoid && tries < 20) continue;                        // (not the same kind twice running, if it can be helped)
    const p = fam === 'shape' ? patShapePuzzle(rng) : patNumPuzzle(rng, fam);
    if (!p) continue;
    const seen = new Set([patKey(p.ans)]), wrong = [];
    for (const m of p.misses) {                                       // near misses first (each template orders its own), each looking unlike the rest
      const k = patKey(m);
      if (seen.has(k)) continue;
      seen.add(k); wrong.push(m);
      if (wrong.length === PATTERNS.options - 1) break;
    }
    if (wrong.length < PATTERNS.options - 1) continue;
    const opts = shuffle([p.ans].concat(wrong), rng), answer = opts.indexOf(p.ans);
    const puz = { fam: p.fam, seq: p.seq, opts };
    const fit = patFitting(puz, opts);
    if (fit.length !== 1 || fit[0] !== answer) continue;               // more than one option could be right (or the right one could not): another
    return { puz, answer, rule: p.rule };
  }
  return null;
}
export function create(type, rng) {
  const r = needRng(rng); let g = null; while (!g) g = patPuzzle(r); return { type, right: { X: 0, O: 0 }, puz: g.puz, answer: g.answer, rule: g.rule, crossed: [], last: null };
}
export function apply(mini, p, m, rng, idx) {   // the square's puzzle: a wrong pick is crossed out and it stays; the right one scores and a new one comes
  const puz = mini.puz, right = mini.answer;
  if (!puz) return { ok: false, reason: 'bad' };
  if (!Number.isInteger(right)) return { ok: false, reason: 'secret' };   // (a phone without the answer: the server judges)
  const crossed = Array.isArray(mini.crossed) ? mini.crossed.slice() : [];
  let picked, auto = false;
  if (m === 'auto') {                                     // the turn's time ran out: one wrong pick, an option still standing crossed out at random
    const wrong = puz.opts.map((_, k) => k).filter(k => k !== right && !crossed.includes(k));
    picked = wrong.length ? wrong[randInt(needRng(rng), wrong.length)] : -1; auto = true;
  } else if (Number.isInteger(m) && m >= 0 && m < puz.opts.length && !crossed.includes(m)) picked = m;
  else return { ok: false, reason: Number.isInteger(m) && crossed.includes(m) ? 'crossed' : 'bad' };
  const correct = picked === right;
  mini.last = Object.assign({ by: p, fam: puz.fam, seq: puz.seq, opts: puz.opts, crossed, picked, correct }, correct ? { right } : {}, auto ? { auto: true } : {});   // (a wrong pick never carries the answer)
  if (!correct) {
    if (picked >= 0) mini.crossed = crossed.concat(picked);
    return { ok: true, outcome: 'continue', note: 'wrong' };
  }
  mini.right[p] += 1;
  if (mini.right[p] >= PATTERNS.goal) return { ok: true, outcome: 'win', note: 'right' };
  let next = null; const r = needRng(rng);
  while (!next) next = patPuzzle(r, puz.fam);                 // a new puzzle (made here: the server, online), not the same kind as this one if it can be helped
  mini.puz = next.puz; mini.answer = next.answer; mini.rule = next.rule; mini.crossed = [];
  return { ok: true, outcome: 'continue', note: 'right' };
}
export function publicView(mini) {
  return { type: 'patterns', right: { X: mini.right.X, O: mini.right.O }, puz: mini.puz, answer: Number.isInteger(mini.answer) ? mini.answer : null, crossed: (mini.crossed || []).slice() };   // (the computer's own: it knows the answer, and gets it about 60% of the time)
}
export function randomMove(mini, p, rng, from, empties) {
  return 'auto';                                     // one wrong pick: an option still standing crossed out
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last; flash.pat = Object.assign({ fam: l.fam, seq: l.seq, opts: l.opts, crossed: (l.crossed || []).slice(), picked: l.picked, correct: l.correct, counts: { X: mini.right.X, O: mini.right.O } }, l.correct ? { right: l.right } : {}, l.auto ? { auto: true } : {}); return;
}
export function secret(mini) {
  return { answer: Number.isInteger(mini.answer) ? mini.answer : null, rule: mini.rule || null };   // the right option's place, and the rule it came from
}
export function hide(m, k, st) {
  delete m.answer; delete m.rule; return;
}
export function flashMs(f, winLen, won) {
  return PATTERNS.reveal + (won ? 600 : 0);
}
