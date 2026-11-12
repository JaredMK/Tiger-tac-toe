// Trivia: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, randInt, shuffle } from '../../core/random.js';
import { RACE_V, raceDealt, raceOld } from '../../core/race.js';
import { tune } from '../../core/tune.js';

// Trivia: the questions come from the bank the host sets (trivia.json, from the Open Trivia Database;
// setTriviaBank). A square has one question at a time, shared by both players, dealt from the questions
// not yet asked of anyone in this match. A wrong pick is crossed out (for both) and the question stays,
// the right answer never shown; the next turn there, either player's, goes on with what is left. The
// right answer scores and a new question is dealt. The right answer's place is kept apart from the
// public state online (answer); crossed holds the places picked wrong so far.
// A new question is dealt face down (shown false; online the question itself stays with the secrets).
// The player to move turns it up (triviaReveal: not a move, but from then they are held to the square
// until they answer, timer and all); once up it stays up for both until it is answered right. A pick
// on a question still face down turns it up too (the computer, a timeout); last.fresh marks a question
// turned up in the mover's own turn, so the other phone shows the reveal, a pause, then the pick.
// Race mode (core/race.js, `rv: 2`): each player their own questions (`mini.side[p]`: { ask, shown, crossed, last }),
// the i-th of each drawn from the same difficulty and category (`bands`, kept with the secrets), never the same
// question; each their own Reveal (a face-down question waits in `tq[p]`, the secrets; turned up it moves to the
// player's open part), their own cross-outs, the right place of their own question kept apart (`tg[p]`, the secrets).
// A right answer scores and deals that player their next question, face down; the first to the goal takes the
// square. Everything but the face-down questions and the right places is open: both players' scores, questions
// turned up and cross-outs. No try caps (none in Shared either: a question always ends answered).
export const TRIVIA = { goal: 3, options: 4, aiRight: 0.65, aiKnow: 0.53, reveal: 900, flip: 600, pause: 600, bank: null };   // aiKnow: the computer knows it this often, else guesses among what is left (65% right with four left); bank: the questions, as the host sets them
export function setTriviaBank(bank) { TRIVIA.bank = bank && Array.isArray(bank.questions) && bank.questions.length ? bank : null; }
export function triviaReady() { return !!TRIVIA.bank; }
export function triviaUsed(state) {
  const used = new Set();
  for (const sq of (state && state.squares) || []) {
    const m = sq && sq.mini;
    if (!m || m.type !== 'trivia') continue;
    for (const id of m.asked || []) used.add(id);
    if (m.ask && m.ask.id) used.add(m.ask.id);
    if (m.race) for (const p of ['X', 'O']) { const a = m.side && m.side[p] && m.side[p].ask, d = m.tq && m.tq[p]; if (a && a.id) used.add(a.id); if (d && d.id) used.add(d.id); }   // (a race: both players' questions)
  }
  return used;
}
// The square's question, when it has none (a new square, or the last one answered right): never one
// asked before in this match (every question of the bank asked: any again). The answers' order is
// shuffled; the right one's place goes in answer, and nothing is crossed out yet.
export function triviaDeal(state, sq, rng) {
  const m = sq.mini;
  if (m && m.type === 'trivia' && m.race && !raceOld(m)) { triviaRaceDeal(state, m, rng); return; }
  if (!m || m.type !== 'trivia' || !TRIVIA.bank || m.ask) return;
  const used = triviaUsed(state);
  let pool = TRIVIA.bank.questions.filter(q => !used.has(q.id));
  if (!pool.length) pool = TRIVIA.bank.questions;
  const q = pool[randInt(rng, pool.length)];
  const opts = shuffle([q.a].concat(q.wrong.slice(0, tune(m).opts - 1)), rng);
  m.ask = { id: q.id, q: q.q, cat: q.cat || '', opts };
  m.answer = opts.indexOf(q.a);
  m.crossed = [];
  m.shown = false; delete m.fresh;
}
// Race: a question for each player who has none (a new square, or their last answered right), face down. A player's
// i-th question comes from the band (difficulty and category) of the other's i-th where that one is dealt already, so
// the two climb the same ladder; never the question the other has now, never one asked before in this match where
// the bank allows.
const diffOf = q => q.diff || q.difficulty || '';
export function triviaRaceDeal(state, m, rng) {
  if (!TRIVIA.bank || !m.side) return;
  if (!m.tg) m.tg = { X: null, O: null };
  if (!m.tq) m.tq = {};
  if (!Array.isArray(m.bands)) m.bands = [];
  const all = TRIVIA.bank.questions, n = tune(m).opts;
  for (const p of ['X', 'O']) {
    const part = m.side[p];
    if (!part || part.ask) continue;
    const used = triviaUsed(state && state.squares ? state : { squares: [{ mini: m }] }), o = m.side[p === 'X' ? 'O' : 'X'], oid = (o && o.ask && o.ask.id) || (m.tq[p === 'X' ? 'O' : 'X'] || {}).id;
    let pool = all.filter(q => !used.has(q.id));
    if (!pool.length) pool = all.filter(q => q.id !== oid);         // (every question asked: any again, but never the other's)
    if (!pool.length) pool = all;
    const k = m.right[p] || 0, band = m.bands[k];
    let cands = pool;
    if (band) {
      const same = pool.filter(q => diffOf(q) === band.d && (q.cat || '') === band.c), diff = pool.filter(q => diffOf(q) === band.d);
      cands = same.length ? same : diff.length ? diff : pool;
    }
    const q = cands[randInt(rng, cands.length)];
    if (!band) m.bands[k] = { d: diffOf(q), c: q.cat || '' };
    const opts = shuffle([q.a].concat(q.wrong.slice(0, n - 1)), rng);
    m.tq[p] = { id: q.id, q: q.q, cat: q.cat || '', opts };
    m.tg[p] = opts.indexOf(q.a);
    part.ask = { down: true, n: opts.length }; part.shown = false; part.crossed = [];
  }
  m.ask = m.side.X && m.side.X.ask && m.side.O && m.side.O.ask ? { down: true, race: true, n } : null;   // (the square has questions: core/minis.js canMove)
  m.shown = false; delete m.fresh;
}
// Where p's picks live: the square itself (Shared), or p's own part (Race; null for a side this copy has not got).
export const triviaPart = (mini, p) => (mini && mini.race ? (mini.side && mini.side[p]) || null : mini);
export const triviaCrossed = (mini, p) => { const part = triviaPart(mini, p); return part && Array.isArray(part.crossed) ? part.crossed : []; };
// Race: p's question as it stands for them (turned up, or face down: { down, n }; null: none), and whether it is up.
export const triviaAskOf = (mini, p) => { const part = triviaPart(mini, p); return part ? part.ask || null : null; };
export const triviaUpOf = (mini, p) => { const a = triviaAskOf(mini, p); return !!(a && a.q && (mini.race ? triviaPart(mini, p).shown : mini.shown)); };
// The square's question turned face up by the player to move: they are then held to the square (lock)
// until they answer. Not a move: the turn and its clock go on. A question already up needs no reveal.
export function triviaReveal(state, i, p) {
  const sq = state.squares && state.squares[i];
  if (state.winner || state.turn !== p) return { ok: false, reason: 'turn' };
  if (!sq || sq.owner || sq.mini.type !== 'trivia' || !sq.mini.ask) return { ok: false, reason: 'bad' };
  if (state.lock != null && state.lock !== i) return { ok: false, reason: 'locked' };
  const m = sq.mini;
  if (m.race) {                                                   // a race: the player's own question turned up (it leaves the secrets for their open part)
    const part = m.side && m.side[p];
    if (!part || !part.ask) return { ok: false, reason: 'bad' };
    if (part.shown) return { ok: false, reason: 'shown' };
    if (!m.tq || !m.tq[p]) return { ok: false, reason: 'secret' };
    part.ask = m.tq[p]; delete m.tq[p]; part.shown = true; m.fresh = p; state.lock = i;
    return { ok: true };
  }
  if (m.shown) return { ok: false, reason: 'shown' };
  m.shown = true; m.fresh = p; state.lock = i;
  return { ok: true };
}
export function create(type, rng, opts) {
  const base = { type, right: { X: 0, O: 0 }, ask: null, answer: null, asked: [], shown: false };   // ask: the square's question; answer: the right option's place (hidden online); asked: the ids answered here
  if (raceDealt(type, opts)) {                                    // a race: each player their own questions (dealt by triviaDeal, as the square's are)
    const part = () => ({ ask: null, shown: false, crossed: [], last: null });
    return Object.assign(base, { race: true, rv: RACE_V, side: { X: part(), O: part() }, tg: { X: null, O: null }, tq: {}, bands: [] });
  }
  return Object.assign(base, { crossed: [], last: null });   // crossed: the places picked wrong, for both
}
export function apply(mini, p, m, rng, idx) {   // the square's question: a wrong pick is crossed out and it stays; the right one scores and a new one comes (a race: on p's own question)
  if (mini.race && !raceOld(mini)) return raceApply(mini, p, m, rng);
  const ask = mini.ask;
  if (!ask || !ask.q) return { ok: false, reason: 'noquestion' };
  const right = mini.answer;
  if (!Number.isInteger(right)) return { ok: false, reason: 'secret' };   // (a phone without the answer: the server judges)
  const part = mini;
  const crossed = Array.isArray(part.crossed) ? part.crossed.slice() : [];
  const pk = pickOf(ask, right, crossed, m, rng);
  if (!pk) return { ok: false, reason: Number.isInteger(m) && crossed.includes(m) ? 'crossed' : 'bad' };
  const { picked, auto } = pk, correct = picked === right, fresh = !mini.shown || mini.fresh === p;   // turned up in this turn (now, or by the reveal before the pick)
  mini.shown = true; delete mini.fresh;
  part.last = lastOf(p, ask, crossed, picked, correct, right, auto, fresh);   // (a wrong pick never carries the right answer)
  if (!correct) {
    if (picked >= 0) part.crossed = crossed.concat(picked);
    return { ok: true, outcome: 'continue', note: 'wrong' };
  }
  mini.right[p] += 1;
  mini.asked = (mini.asked || []).concat(ask.id);
  mini.ask = null; mini.answer = null; mini.crossed = [];  // the next question is dealt by playMove, from the whole match's unasked ones
  if (mini.right[p] >= tune(mini).goal) return { ok: true, outcome: 'win', note: 'right' };
  return { ok: true, outcome: 'continue', note: 'right' };
}
// The pick: an option still standing, or 'auto' (the turn's time ran out: one wrong option still standing crossed out at random); null: refused.
function pickOf(ask, right, crossed, m, rng) {
  if (m === 'auto') { const wrong = ask.opts.map((_, k) => k).filter(k => k !== right && !crossed.includes(k)); return { picked: wrong.length ? wrong[randInt(needRng(rng), wrong.length)] : -1, auto: true }; }
  if (Number.isInteger(m) && m >= 0 && m < ask.opts.length && !crossed.includes(m)) return { picked: m, auto: false };
  return null;
}
const lastOf = (p, ask, crossed, picked, correct, right, auto, fresh) => Object.assign({ by: p, id: ask.id, q: ask.q, cat: ask.cat, opts: ask.opts.slice(), crossed, picked, correct }, correct ? { right } : {}, auto ? { auto: true } : {}, fresh ? { fresh: true } : {});
// Race: p's pick on their own question (one face down is turned up with it: the computer, a timeout); right, a point and
// (short of the goal) their next question, dealt by playMove (triviaDeal) face down.
function raceApply(mini, p, m, rng) {
  const part = mini.side && mini.side[p];
  if (!part || !part.ask) return { ok: false, reason: 'noquestion' };
  const ask = part.shown ? part.ask : mini.tq && mini.tq[p];
  if (!ask || !ask.q) return { ok: false, reason: 'secret' };     // (a phone without its question's secrets: the server judges)
  const right = mini.tg && mini.tg[p];
  if (!Number.isInteger(right)) return { ok: false, reason: 'secret' };
  const crossed = Array.isArray(part.crossed) ? part.crossed.slice() : [];
  const pk = pickOf(ask, right, crossed, m, rng);
  if (!pk) return { ok: false, reason: Number.isInteger(m) && crossed.includes(m) ? 'crossed' : 'bad' };
  const { picked, auto } = pk, correct = picked === right, fresh = !part.shown || mini.fresh === p;
  if (!part.shown) { part.ask = ask; part.shown = true; delete mini.tq[p]; }
  delete mini.fresh;
  part.last = lastOf(p, ask, crossed, picked, correct, right, auto, fresh);
  if (!correct) {
    if (picked >= 0) part.crossed = crossed.concat(picked);
    return { ok: true, outcome: 'continue', note: 'wrong' };
  }
  mini.right[p] += 1;
  mini.asked = (mini.asked || []).concat(ask.id);
  if (mini.right[p] >= tune(mini).goal) return { ok: true, outcome: 'win', note: 'right' };   // (the question stays, for the review)
  part.ask = null; part.shown = false; part.crossed = []; mini.tg[p] = null;   // (their next: triviaDeal, from the band of the other's)
  return { ok: true, outcome: 'continue', note: 'right' };
}
// Trivia and Odd One Out: the computer plays to a success rate (it knows the answer about half the
// time, else guesses among the options still standing; a find 75%, 60%, then 45%), so it is told the
// answer here and makes up its mind from there. Online, a phone
// never gets these (hideMini): only the server, which plays the bots, does.
// A race: both players' open parts (scores, questions turned up, cross-outs); the right place of forSide's own question
// alone where publicMini names the side (the computer's own, as in Shared), never the other's, never a face-down question.
export function publicView(mini, forSide) {
  if (mini.race && !raceOld(mini)) {
    const side = JSON.parse(JSON.stringify(mini.side || {})), own = forSide && mini.tg ? mini.tg[forSide] : null;
    return Object.assign({ type: 'trivia', race: true, rv: mini.rv, right: { X: mini.right.X, O: mini.right.O }, side, ask: mini.ask ? { opts: mini.ask.n || tune(mini).opts } : null }, Number.isInteger(own) ? { answer: own } : {});
  }
  const v = { type: 'trivia', right: { X: mini.right.X, O: mini.right.O }, answer: Number.isInteger(mini.answer) ? mini.answer : null, ask: mini.ask && (mini.ask.q || mini.ask.down) ? { opts: mini.ask.opts ? mini.ask.opts.length : mini.ask.n || tune(mini).opts } : null };
  if (mini.race) return Object.assign(v, { race: true, side: {} });   // (a race square from before the rework: dealt again as it is met)
  return Object.assign(v, { crossed: (mini.crossed || []).slice() });
}
export function randomMove(mini, p, rng, from, empties) {
  return 'auto';                                      // one wrong pick: an option still standing is crossed out
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = triviaPart(mini, p).last; flash.trivia = Object.assign({ q: l.q, cat: l.cat, opts: l.opts.slice(), crossed: (l.crossed || []).slice(), picked: l.picked, correct: l.correct, counts: { X: mini.right.X, O: mini.right.O } }, l.correct ? { right: l.right } : {}, l.auto ? { auto: true } : {}, l.fresh ? { fresh: true } : {}); return;
}
export function secret(mini) {
  if (mini.race && !raceOld(mini)) return { tg: Object.assign({ X: null, O: null }, mini.tg), tq: JSON.parse(JSON.stringify(mini.tq || {})), bands: (mini.bands || []).slice() };   // a race: both players' right places, the questions still face down, the bands to come
  const s = { answer: Number.isInteger(mini.answer) ? mini.answer : null }; if (mini.ask && !mini.shown) s.ask = mini.ask; return s;
}
export function hide(m, k, st) {
  delete m.answer; delete m.answers;
  if (m.race && !raceOld(m)) { delete m.tg; delete m.tq; delete m.bands; return; }   // (a race: a face-down question is only { down, n } in the player's part)
  if (m.ask && !m.shown) m.ask = { down: true, n: m.ask.opts ? m.ask.opts.length : tune(m).opts }; return;   // face down: only that there is one
}
export function flashMs(f, winLen, won) {
  const t = f.trivia || f.race;
  return (t && t.fresh ? TRIVIA.flip : 0) + TRIVIA.pause + TRIVIA.reveal + (won ? 600 : 0);   // (another phone: the card turned up, a pause, then the pick)
}
// Super Chaos: the question is face up for both, and each answers in their own move. A right answer keeps
// the question on show until the round ends (scAfter). At the round's end the wrong answers are crossed out
// for both, each player who was right scores (their own count), and if anyone was, the core deals a new
// question for the next round.
export function scAfter(mini, before, p, res) {
  if (mini.race) return;
  if (res.note === 'right' && before.ask) { mini.ask = before.ask; mini.answer = before.answer; mini.crossed = (before.crossed || []).slice(); mini.asked = (before.asked || []).slice(); }
}
export function scMerge(m, c) {
  if (m.race) { for (const p of c.played) m.side[p] = c.forks[p].side[p]; return; }   // (a race square keeps each side's own card)
  const b = c.base, id = b.ask && b.ask.id, crossed = new Set(b.crossed || []);
  m.ask = b.ask; m.answer = b.answer; m.asked = (b.asked || []).slice(); m.shown = true; delete m.fresh;
  let right = false;
  for (const p of c.played) {
    const l = c.forks[p].last;
    if (!l || l.id !== id) continue;
    if (l.correct) right = true; else if (l.picked >= 0) crossed.add(l.picked);
  }
  m.crossed = [...crossed].sort((x, y) => x - y);
  if (right) { m.asked = m.asked.concat(id); m.ask = null; m.answer = null; m.crossed = []; return { deal: true }; }
}
