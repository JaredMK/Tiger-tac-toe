// Trivia: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, randInt, shuffle } from '../../core/random.js';
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
export const TRIVIA = { goal: 3, options: 4, aiRight: 0.65, aiKnow: 0.53, reveal: 900, flip: 600, pause: 900, bank: null };   // aiKnow: the computer knows it this often, else guesses among what is left (65% right with four left); bank: the questions, as the host sets them
export function setTriviaBank(bank) { TRIVIA.bank = bank && Array.isArray(bank.questions) && bank.questions.length ? bank : null; }
export function triviaReady() { return !!TRIVIA.bank; }
export function triviaUsed(state) {
  const used = new Set();
  for (const sq of (state && state.squares) || []) {
    const m = sq && sq.mini;
    if (!m || m.type !== 'trivia') continue;
    for (const id of m.asked || []) used.add(id);
    if (m.ask && m.ask.id) used.add(m.ask.id);
  }
  return used;
}
// The square's question, when it has none (a new square, or the last one answered right): never one
// asked before in this match (every question of the bank asked: any again). The answers' order is
// shuffled; the right one's place goes in answer, and nothing is crossed out yet.
export function triviaDeal(state, sq, rng) {
  const m = sq.mini;
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
// The square's question turned face up by the player to move: they are then held to the square (lock)
// until they answer. Not a move: the turn and its clock go on. A question already up needs no reveal.
export function triviaReveal(state, i, p) {
  const sq = state.squares && state.squares[i];
  if (state.winner || state.turn !== p) return { ok: false, reason: 'turn' };
  if (!sq || sq.owner || sq.mini.type !== 'trivia' || !sq.mini.ask) return { ok: false, reason: 'bad' };
  if (state.lock != null && state.lock !== i) return { ok: false, reason: 'locked' };
  if (sq.mini.shown) return { ok: false, reason: 'shown' };
  sq.mini.shown = true; sq.mini.fresh = p; state.lock = i;
  return { ok: true };
}
export function create(type, rng) {
  return { type, right: { X: 0, O: 0 }, ask: null, answer: null, crossed: [], asked: [], shown: false, last: null };   // ask: the square's question; answer: the right option's place (hidden online); crossed: the places picked wrong; asked: the ids answered here
}
export function apply(mini, p, m, rng, idx) {   // the square's question: a wrong pick is crossed out and it stays; the right one scores and a new one comes
  const ask = mini.ask;
  if (!ask || !ask.q) return { ok: false, reason: 'noquestion' };
  const right = mini.answer;
  if (!Number.isInteger(right)) return { ok: false, reason: 'secret' };   // (a phone without the answer: the server judges)
  const crossed = Array.isArray(mini.crossed) ? mini.crossed.slice() : [];
  let picked, auto = false;
  if (m === 'auto') {                                     // the turn's time ran out: one wrong pick, an option still standing crossed out at random
    const wrong = ask.opts.map((_, k) => k).filter(k => k !== right && !crossed.includes(k));
    picked = wrong.length ? wrong[randInt(needRng(rng), wrong.length)] : -1; auto = true;
  } else if (Number.isInteger(m) && m >= 0 && m < ask.opts.length && !crossed.includes(m)) picked = m;
  else return { ok: false, reason: Number.isInteger(m) && crossed.includes(m) ? 'crossed' : 'bad' };
  const correct = picked === right, fresh = !mini.shown || mini.fresh === p;   // turned up in this turn (now, or by the reveal before the pick)
  mini.shown = true; delete mini.fresh;
  mini.last = Object.assign({ by: p, id: ask.id, q: ask.q, cat: ask.cat, opts: ask.opts.slice(), crossed, picked, correct }, correct ? { right } : {}, auto ? { auto: true } : {}, fresh ? { fresh: true } : {});   // (a wrong pick never carries the right answer)
  if (!correct) {
    if (picked >= 0) mini.crossed = crossed.concat(picked);
    return { ok: true, outcome: 'continue', note: 'wrong' };
  }
  mini.right[p] += 1;
  mini.asked = (mini.asked || []).concat(ask.id);
  mini.ask = null; mini.answer = null; mini.crossed = [];  // the next question is dealt by playMove, from the whole match's unasked ones
  if (mini.right[p] >= tune(mini).goal) return { ok: true, outcome: 'win', note: 'right' };
  return { ok: true, outcome: 'continue', note: 'right' };
}
// Trivia and Odd One Out: the computer plays to a success rate (it knows the answer about half the
// time, else guesses among the options still standing; a find 75%, 60%, then 45%), so it is told the
// answer here and makes up its mind from there. Online, a phone
// never gets these (hideMini): only the server, which plays the bots, does.
export function publicView(mini) {
  return { type: 'trivia', right: { X: mini.right.X, O: mini.right.O }, answer: Number.isInteger(mini.answer) ? mini.answer : null, crossed: (mini.crossed || []).slice(), ask: mini.ask && (mini.ask.q || mini.ask.down) ? { opts: mini.ask.opts ? mini.ask.opts.length : mini.ask.n || tune(mini).opts } : null };
}
export function randomMove(mini, p, rng, from, empties) {
  return 'auto';                                      // one wrong pick: an option still standing is crossed out
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last; flash.trivia = Object.assign({ q: l.q, cat: l.cat, opts: l.opts.slice(), crossed: (l.crossed || []).slice(), picked: l.picked, correct: l.correct, counts: { X: mini.right.X, O: mini.right.O } }, l.correct ? { right: l.right } : {}, l.auto ? { auto: true } : {}, l.fresh ? { fresh: true } : {}); return;
}
export function secret(mini) {
  const s = { answer: Number.isInteger(mini.answer) ? mini.answer : null }; if (mini.ask && !mini.shown) s.ask = mini.ask; return s;
}
export function hide(m, k, st) {
  delete m.answer; delete m.answers; if (m.ask && !m.shown) m.ask = { down: true, n: m.ask.opts ? m.ask.opts.length : tune(m).opts }; return;   // face down: only that there is one
}
export function flashMs(f, winLen, won) {
  return (f.trivia && f.trivia.fresh ? TRIVIA.flip : 0) + TRIVIA.pause + TRIVIA.reveal + (won ? 600 : 0);   // (another phone: the card turned up, a pause, then the pick)
}
// Super Chaos: the question is face up for both, and each answers in their own move. A right answer keeps
// the question on show until the round ends (scAfter). At the round's end the wrong answers are crossed out
// for both, each player who was right scores (their own count), and if anyone was, the core deals a new
// question for the next round.
export function scAfter(mini, before, p, res) {
  if (res.note === 'right' && before.ask) { mini.ask = before.ask; mini.answer = before.answer; mini.crossed = (before.crossed || []).slice(); mini.asked = (before.asked || []).slice(); }
}
export function scMerge(m, c) {
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
