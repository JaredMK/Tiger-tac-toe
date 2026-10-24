// Sky Hop, Scoop Stack and Pinball: what the finger games share (an attempt, its log, the server's check,
// the computer's hand).
import { tune } from '../../core/tune.js';
import { PHYSICS } from './physics.js';
import { PINB, pinCheck, pinReplayCheck } from '../pinball/rules.js';
import { SCOOP, scoopAi, scoopResult, scoopStart, scoopStep } from '../scoop/rules.js';
import { hopAi, hopResult, hopStart, hopStep } from '../skyhop/rules.js';

// ---------- Sky Hop, Scoop Stack and Pinball: the finger games ----------
// A move is one attempt, played on the player's phone in real time with a finger (a drag left and right
// steers Sky Hop's hopper and Scoop Stack's cone; Pinball's flippers are held down). Each player keeps
// their own progress from attempt to attempt: Sky Hop's height, Scoop Stack's stack, Pinball's lit
// targets. Sky Hop and Scoop Stack are worked out here, in fixed steps of plain arithmetic, so the same
// inputs give the same attempt everywhere: the phone sends its inputs (where the finger steered, step by
// step) with the result, and the server plays them through again and takes the result only when it is
// the same, in no more time than the turn has lasted. The computer plays through the same steps with a
// hand of its own (it reacts a little late and aims a little off), and every phone replays any attempt it
// did not play from those inputs, at full speed. Pinball runs on Matter.js (physics.js).
export const FINGER_TYPES = ['skyhop', 'scoop', 'pinball'];
// grace: seconds of safety at the start of an attempt; step: the simulation step; every: the finger is
// read every 2 steps (60 times a second); slackMs: how much longer than the turn an attempt may be (the
// clock check); maxSecs: the longest attempt the server will play through.
export const FING = { grace: 2, step: 1 / 120, every: 2, slackMs: 2500, maxSecs: 300, q: 50, replayMax: 30000 };   // q: the finger's place is kept to 1/50 of a unit; replayMax: a longer attempt replays faster, in this long
// The inputs: [step, value] pairs (the finger's place changed at that step), written as base-36 step gaps and values.
export function fingLog(pairs) { let s = 0; return pairs.map(([k, v]) => { const d = k - s; s = k; return d.toString(36) + ':' + v.toString(36); }).join(','); }
export function fingUnlog(str, maxSteps, maxV) {
  if (typeof str !== 'string' || str.length > 400000) return null;
  if (!str) return [];
  const out = [];
  let s = 0;
  for (const part of str.split(',')) {
    const m = /^([0-9a-z]{1,6}):([0-9a-z]{1,4})$/.exec(part);
    if (!m) return null;
    s += parseInt(m[1], 36); const v = parseInt(m[2], 36);
    if (s > maxSteps || v > maxV || (out.length && s <= out[out.length - 1][0])) return null;
    out.push([s, v]);
  }
  return out;
}
export const fwrap = (x, w) => ((x % w) + w) % w;
export const fdiff = (a, b, w) => { const d = fwrap(a - b, w); return d > w / 2 ? d - w : d; };   // a - b the short way round

// Sky Hop: the hopper bounces off every platform it falls onto (each bounce the same height up); a drag
// steers it (it moves towards the finger's place at up to vx, round the edges: the sky wraps). The course
// goes up to the target height, made per square from a seed, one course for both players (a section that beat
// you is still there next time, and for the other player): a chain of platforms each within a bounce of the last (sure to be reachable: never
// more than gapK of a bounce up, never further across than the time in the air allows), with more
// platforms between; higher up the gaps grow, the platforms narrow, some move, some break after one
// bounce, and now and then a hazard floats beside the way up (never across it). Falling below the screen
// ends the attempt; the highest point reached is kept. An attempt starts on a full-width platform at the
// saved height that holds for the grace seconds, with nothing hazardous in the first bounce's reach.
// Heights in metres; the sky is w wide; the screen's bottom edge is fall metres below the highest point
// reached (falling out past it ends the attempt); view: how far the course is kept in reach.
export const HOP = { w: 9, view: 17, fall: 6, g: 44, vx: 11, foot: 0.3, below: 0.6, body: 0.36, bodyY: 0.45, haz: 0.48, gapK: 0.86, reachK: 0.8, clear: 1.9, edge: 0.42 };   // edge: the sky's sides are walls; the hopper's middle stays this far in
export const HOP_MEMO = new Map();

// An attempt played through from its inputs (the phone's, the computer's): the same steps the phone took.
export function fingReplay(type, mini, p, log, steps) {
  const sim = type === 'skyhop' ? hopStart(mini, p) : scoopStart(mini, p), step = type === 'skyhop' ? hopStep : scoopStep;
  let k = 0;
  while (sim.n < steps && !sim.end) {
    let tx = null;
    if (k < log.length && log[k][0] === sim.n) tx = log[k++][1] / FING.q;
    step(sim, tx);
  }
  return sim;
}
// Records a hand's inputs as the attempt is played (the value the step used, when it changed).
export function fingRecorder() {
  const pairs = [];
  let last = null;
  return { pairs, at(n, tx) { const v = Math.round(tx * FING.q); if (v !== last) { pairs.push([n, v]); last = v; } return v / FING.q; } };
}
// The computer's hand (an average player's): it sees what happens react seconds late, aims off by a
// little (aim: the spread, in units), and now and then misses a hazard (lapse) or misjudges a platform.
export const FHAND = { skyhop: { react: [0.22, 0.32], aim: 0.65, lapse: 0.15, misjudge: 0.5 }, scoop: { react: [0.26, 0.36], aim: 0.46, lapse: 0.2 } };
// A square's hand: FHAND (Pinball's: physics-sim.js pinAi's own) with its settings over it (meta.js TUNE:
// reactions in ms, aim and odds in hundredths), for a square dealt with any.
export function fingHand(mini) {
  if (!mini || !mini.tune) return FHAND[mini && mini.type];
  const t = tune(mini), react = [t.aiReact0 / 1000, t.aiReact1 / 1000];
  if (mini.type === 'pinball') return { react, jitter: t.aiJitter / 1000 };
  return Object.assign({}, FHAND[mini.type], { react, aim: t.aiAim / 100, lapse: t.aiLapse / 100 }, mini.type === 'skyhop' ? { misjudge: t.aiMisjudge / 100 } : {});
}
// The finger games' moves: checked (Sky Hop and Scoop Stack played through again from their inputs),
// then the attempt's result. Returns { why } or { to, sim } (to: the progress after it).
export function fingCheck(mini, p, m) {
  if (mini.type === 'pinball') return m && typeof m === 'object' && m.log != null ? pinReplayCheck(mini, p, m) : { why: pinCheck(mini, p, m) };   // its inputs: the ball played through again here (online); its recording: checked (local play, the computer's own ball)
  if (!m || typeof m !== 'object') return { why: 'bad' };
  const steps = Number(m.steps), maxV = Math.ceil((mini.type === 'skyhop' ? HOP.w : SCOOP.w) * FING.q);
  if (!Number.isInteger(steps) || steps < 1 || steps > FING.maxSecs / FING.step) return { why: 'bad' };
  const log = fingUnlog(m.log, steps, maxV);
  if (!log) return { why: 'bad' };
  const sim = fingReplay(mini.type, mini, p, log, steps), end = sim.end || 'out';
  if (sim.n !== steps || String(m.end) !== end) return { why: 'replay' };   // (ended sooner, or not as said)
  if (mini.type === 'skyhop' ? Number(m.h) !== hopResult(sim).h : Number(m.n) !== scoopResult(sim).n) return { why: 'replay' };
  return { why: null, sim };
}
// The computer's attempt (an average player's hand): the move, played through.
export function fingAi(mini, p, rng) {
  if (mini.type === 'skyhop') return hopAi(mini, p, rng).move;
  if (mini.type === 'scoop') return scoopAi(mini, p, rng).move;
  const r = PHYSICS.lib.pinAi(PHYSICS.lib.pinTable(mini), mini.cfg, mini.lit[p], rng, fingHand(mini)).result;
  return { hits: r.hits, ms: r.ms, rec: r.rec, end: r.end };
}
// Progress: Sky Hop's height, Scoop Stack's stack, Pinball's lit targets; and how far to go.
export const fingAt = (mini, p) => (mini.type === 'skyhop' ? mini.height[p] : mini.type === 'scoop' ? mini.stack[p].length : mini.lit[p].filter(Boolean).length);
export const fingGoal = mini => (mini.type === 'pinball' ? mini.lit.X.length : mini.cfg.target);
// The computer's attempts still needed, about (what it gets in one, from its hand: see the tuning in the tests).
export const FING_GAIN = { skyhop: 113, scoop: 5.6, pinball: 1.45 };
export const fingNeeds = (mini, p) => Math.max(1, (fingGoal(mini) - fingAt(mini, p)) / FING_GAIN[mini.type]);
// How long an attempt lasted (fingRaw), and how long it takes to play through on another phone (the
// replay: as it was, or faster for an attempt longer than replayMax), in ms.
export const fingRaw = f => (!f || f.auto ? 0 : f.type === 'pinball' ? Number(f.ms) || 0 : Math.round(f.steps * FING.step * 1000));
export const fingMs = f => Math.min(fingRaw(f), FING.replayMax);
export function fingerApply(mini, p, m, rng, idx) {   // one attempt: checked (played through again, or its recording), then kept; a timed-out one ('auto') changes nothing
  const from = fingAt(mini, p);
  let to = from, last;
  if (m === 'auto') last = { by: p, auto: true, from, to };
  else {
    const c = fingCheck(mini, p, m);
    if (c.why) return { ok: false, reason: c.why };
    if (mini.type === 'skyhop') { to = Math.max(from, hopResult(c.sim).h); mini.height[p] = to; last = { by: p, from, to, log: m.log, steps: m.steps, end: m.end, try: mini.tries[p] }; }
    else if (mini.type === 'scoop') { mini.stack[p] = mini.stack[p].concat(c.sim.got).slice(0, mini.cfg.target); to = mini.stack[p].length; last = { by: p, from, to, log: m.log, steps: m.steps, end: m.end, try: mini.tries[p], got: c.sim.got.slice() }; }
    else if (c.sim) { const r = c.sim; for (const [id] of r.hits) mini.lit[p][id] = 1; to = fingAt(mini, p); last = Object.assign({ by: p, from, to, hits: r.hits.map(h => [h[0], Math.round(Number(h[1]) * 1000) / 1000]), ms: r.ms, rec: r.rec, end: r.end }, c.diff ? { diff: true } : {}); }   // the ball as played through again here, whatever the phone said of it
    else { for (const [id] of m.hits) mini.lit[p][id] = 1; to = fingAt(mini, p); last = { by: p, from, to, hits: m.hits.map(h => [h[0], Math.round(Number(h[1]) * 1000) / 1000]), ms: Math.round(Number(m.ms)), rec: m.rec, end: String(m.end || 'drain') }; }
  }
  if (mini.type === 'pinball') mini.balls[p] += 1; else mini.tries[p] += 1;
  mini.last = last;
  if (mini.started) mini.started[p] = null;                     // (the next attempt: its own Start)
  if (to >= fingGoal(mini)) return { ok: true, outcome: 'win', note: 'top' };
  return { ok: true, outcome: 'continue', note: last.auto ? 'out' : to > from ? 'up' : 'none' };
}

// The finger games: the computer's attempt is played only for the square it chose.
export function fingPlay(state, best, me, rng) { if (best && best.move && best.move.fing) best.move = fingAi(state.squares[best.square].mini, me, rng); return best; }
export function fingerMoveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last; flash.fing = Object.assign({ type: mini.type, goal: fingGoal(mini), at: { X: fingAt(mini, 'X'), O: fingAt(mini, 'O') } }, JSON.parse(JSON.stringify(l))); return;
}
export function fingerFlashMs(f, winLen, won) {
  return (f.fing && !f.timeout ? fingMs(f.fing) : 0) + PINB.hold + (won ? 600 : 0);   // someone else's attempt plays through first, then the result (the phone that played it skips that)
}
