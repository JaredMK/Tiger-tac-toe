// Headcount, Flash and Snapshot: what the attention games share (rounds, levels, judging an answer, the
// computer's chances).
import { needRng, randInt, shuffle } from '../../core/random.js';
import { FINGER_TYPES } from './finger.js';
import { flashAnswer, flashConfig } from '../flash/rules.js';
import { headRound } from '../headcount/rules.js';
import { snapRound } from '../snapshot/rules.js';

// ---------- Headcount, Flash and Snapshot: the attention games ----------
// Each player has their own progress (right): first to 3 correct wins the square. A move is one round
// at the player's level (0, 1 or 2: how many they have right so far), freshly drawn each time and
// harder at each level; a right answer moves them on, a wrong one does not (and the turn ends either
// way). The round is in the open (the page plays it); its right answer follows from it, and the engine
// works it out (attTruth). On the page, Start holds the player to the square until the answer goes in;
// no answer in the turn's time counts as wrong ('auto'). Every difficulty value is the admin's
// (config/headcount, config/flash, config/snapshot), aimed at the share of rounds a typical player gets
// right at each level (ATT.aiOk); the computer gets them right that often.
export const ATT_TYPES = ['headcount', 'flash', 'snapshot'];
export const ATT = { goal: 3, aiOk: { headcount: [0.45, 0.3, 0.2], flash: [0.8, 0.7, 0.6], snapshot: [0.65, 0.5, 0.35] }, pause: 900, show: 1600 };   // pause: someone else's round, then their answer; show: the result and the right answer
export const attOk = (type, level) => { const a = ATT.aiOk[type] || ATT.aiOk.headcount; return a[Math.min(level, a.length - 1)]; };

// Flash: cards flash one at a time in the middle (a shape in a colour; never the X or O colours), each
// for 0.5 s, then one question with 4 options: "How many [shape]s?" or "How many [colour] items?". Level
// 1 flashes 6 cards, level 2 7, level 3 8. The wrong options are near misses: one off, the count of a
// neighbouring shape or colour, two off.
export const FLASH = { shapes: ['star', 'heart', 'bolt'], colours: ['blue', 'green', 'purple'], on: 0.78 };   // on: the part of each card's time it shows (then a blank, so a repeat flashes twice)
export const plural = s => s + 's';
export function flashRound(level, rng, cfg) {
  cfg = cfg || flashConfig();
  const L = Math.min(level, 2) + 1, N = cfg['n' + L], ms = cfg['ms' + L], S = FLASH.shapes, C = FLASH.colours;
  for (let tries = 0; tries < 200; tries++) {
    const items = Array.from({ length: N }, () => [S[randInt(rng, 3)], C[randInt(rng, 3)]]);
    if (new Set(items.map(it => it[0])).size < 2 || new Set(items.map(it => it[1])).size < 2) continue;   // (never a round of one shape or one colour)
    const s = S[randInt(rng, 3)], c = C[randInt(rng, 3)];
    const q = rng() < 0.5 ? { kind: 'colour', c, text: `How many ${c} items?` } : { kind: 'shape', s, text: `How many ${plural(s)}?` };   // the two questions there are, at every level
    const truth = flashAnswer(items, q);
    if (truth == null) continue;
    let opts;
    if (typeof truth === 'number') {                            // counts: one off either side first, then a similar combination's count, then two off
      if (truth === 0) continue;                                // (never a question about something that never showed)
      const similar = q.kind === 'combo' ? [flashAnswer(items, { kind: 'combo', s, c: C[(C.indexOf(c) + 1) % 3] }), flashAnswer(items, { kind: 'combo', s: S[(S.indexOf(s) + 1) % 3], c }), flashAnswer(items, { kind: 'colour', c })]
        : q.kind === 'colour' ? [flashAnswer(items, { kind: 'colour', c: C[(C.indexOf(c) + 1) % 3] })] : q.kind === 'shape' ? [flashAnswer(items, { kind: 'shape', s: S[(S.indexOf(s) + 1) % 3] })] : [];
      const ok = v => v >= 0 && v <= N && v !== truth, wrong = [truth + 1, truth - 1].filter(ok);
      const sim = similar.find(v => ok(v) && !wrong.includes(v)); if (sim != null && wrong.length < 3) wrong.push(sim);   // at most one similar combination's count
      for (const v of [truth + 2, truth - 2, truth + 3, truth - 3, truth + 4, truth - 4]) if (ok(v) && !wrong.includes(v) && wrong.length < 3) wrong.push(v);
      if (wrong.length < 3) continue;
      opts = shuffle([truth].concat(wrong), rng);
    } else {                                                    // items: those next to it in the order, then the same shape in another colour, the same colour as another shape
      const [ts, tc] = truth.split(':'), k = q.kind === 'nth' ? q.i : q.kind === 'after' ? items.findIndex(it => (q.s ? it[0] === q.s : it[1] === q.c)) + 1 : (() => { let j = -1; items.forEach((it, x) => { if (it[0] === q.s) j = x; }); return j - 1; })();
      const cands = [items[k - 1], items[k + 1], items[k - 2], items[k + 2]].filter(Boolean).map(it => it.join(':'))
        .concat(C.filter(x => x !== tc).map(x => ts + ':' + x), S.filter(x => x !== ts).map(x => x + ':' + tc), shuffle(S.flatMap(a => C.map(b => a + ':' + b)), rng));
      const wrong = [];
      for (const v of cands) if (v !== truth && !wrong.includes(v) && wrong.length < 3) wrong.push(v);
      opts = shuffle([truth].concat(wrong), rng).map(v => v.split(':'));
    }
    const ans = opts.findIndex(o => (Array.isArray(o) ? o.join(':') : o) === truth);
    return { level: L - 1, items, ms, q, opts, ans };
  }
  return null;
}

// The three together: a round, its right answer, a check of an answer, how long it plays, and a near miss (the computer's slip).
export const attRound = (type, level, rng) => (type === 'headcount' ? headRound(level, rng) : type === 'flash' ? flashRound(level, rng) : snapRound(level, rng));
export const attTruth = (type, r) => (type === 'headcount' ? r.items.filter(o => o.k === r.t).length : type === 'flash' ? r.ans : r.cells.slice());
export function attValid(type, r, m) {
  if (type === 'headcount') return Number.isInteger(m) && m >= 0 && m <= 99;
  if (type === 'flash') return Number.isInteger(m) && m >= 0 && m < r.opts.length;
  return Array.isArray(m) && m.length <= r.c * r.r && m.every(i => Number.isInteger(i) && i >= 0 && i < r.c * r.r) && new Set(m).size === m.length;
}
export function attJudge(type, r, m) {
  if (type === 'snapshot') { const a = m.slice().sort((x, y) => x - y); return a.length === r.cells.length && a.every((v, i) => v === r.cells[i]); }
  return m === attTruth(type, r);
}
// Start: the round plays from now and the player is held to the square until the answer goes in (a timeout answers it, wrong).
export function attStart(state, i, p) {
  const sq = state.squares && state.squares[i];
  if (state.winner || state.turn !== p) return { ok: false, reason: 'turn' };
  if (!sq || sq.owner || !(ATT_TYPES.includes(sq.mini.type) || FINGER_TYPES.includes(sq.mini.type))) return { ok: false, reason: 'bad' };
  if (state.lock != null && state.lock !== i) return { ok: false, reason: 'locked' };
  state.lock = i;
  return { ok: true };
}
export const attMs = (type, r) => (type === 'headcount' ? r.ms : type === 'flash' ? r.items.length * r.ms + 300 : r.show + (r.wait || 0));   // (Snapshot: the pattern, then the blank grid's countdown)
export function attWrong(type, r, rng) {
  if (type === 'headcount') { const t = attTruth(type, r), d = [1, -1, 2, -2][randInt(rng, 4)]; return Math.max(0, t + d === t ? t + 1 : t + d); }
  if (type === 'flash') { let w = randInt(rng, r.opts.length - 1); if (w >= r.ans) w++; return w; }
  const on = new Set(r.cells), off = Array.from({ length: r.c * r.r }, (_, i) => i).filter(i => !on.has(i));
  const out = r.cells.slice(); out.splice(randInt(rng, out.length), 1, off[randInt(rng, off.length)]);   // one cell misplaced
  return out.sort((a, b) => a - b);
}
export function attentionCreate(type, rng) {
  return { type, right: { X: 0, O: 0 }, round: { X: attRound(type, 0, needRng(rng)), O: attRound(type, 0, needRng(rng)) }, last: null };   // each player's own round, at their own level
}
export function attentionApply(mini, p, m, rng, idx) {   // one round: right, a step on; wrong (or no answer in time), none; a fresh round either way
  const type = mini.type, round = mini.round && mini.round[p];
  if (!round) return { ok: false, reason: 'bad' };
  let answer;
  if (m === 'auto') answer = null;
  else if (attValid(type, round, m)) answer = type === 'snapshot' ? m.slice().sort((a, b) => a - b) : m;
  else return { ok: false, reason: 'bad' };
  const correct = answer != null && attJudge(type, round, answer);
  if (correct) mini.right[p] += 1;
  mini.last = { by: p, level: round.level, round: JSON.parse(JSON.stringify(round)), answer, truth: attTruth(type, round), correct };
  mini.round[p] = attRound(type, Math.min(mini.right[p], ATT.goal - 1), needRng(rng));
  if (mini.right[p] >= ATT.goal) return { ok: true, outcome: 'win', note: 'right' };
  return { ok: true, outcome: 'continue', note: correct ? 'right' : 'wrong' };
}
export function attentionBest(pm, me, rng, style, ctx) {   // right about 85%, 65%, then 45% of the time; else a near miss (one off, a wrong option, a cell out of place)
  const r = pm.round && pm.round[me], q = attOk(pm.type, pm.right[me]);
  if (!r) return { move: 'auto', q: 0 };
  return { move: rng() < q ? attTruth(pm.type, r) : attWrong(pm.type, r, rng), q };
}
export function attentionMoveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last; flash.att = { level: l.level, round: l.round, answer: l.answer, truth: l.truth, correct: l.correct, right: { X: mini.right.X, O: mini.right.O } }; return;
}
export function attentionFlashMs(f, winLen, won) {
  return (f.att && !f.timeout ? attMs(f.type, f.att.round) + ATT.pause : 0) + ATT.show + (won ? 600 : 0);   // someone else's round plays first, then their answer (the phone that played it skips that)
}
