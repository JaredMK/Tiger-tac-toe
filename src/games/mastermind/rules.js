// Mastermind: the rules (pure: no page, no clock; the server runs the same code).
import { shuffle } from '../../core/random.js';
import { tune, tuneLive } from '../../core/tune.js';

export const MM = { pegs: 4, colors: 6 };    // Mastermind: a code of 4 pegs from 6 colours, no colour twice      // Hexapawn: X starts on the bottom row and moves up, O starts on the top row and moves down
// Mastermind: one hidden code shared by both players, 4 pegs from 6 colours, no colour twice (in the
// code or in a guess). Feedback: a solid marker per peg right in colour and place, a hollow one per peg
// right in colour but in the wrong place. Everything guessed stays on show; the exact code wins.
export function mmFeedback(guess, code) {
  let solid = 0, common = 0;
  for (let k = 0; k < MM.pegs; k++) { if (guess[k] === code[k]) solid++; if (code.includes(guess[k])) common++; }
  return { solid, hollow: common - solid };
}
export function mmValid(g, colors = MM.colors) { return Array.isArray(g) && g.length === MM.pegs && g.every(c => Number.isInteger(c) && c >= 0 && c < colors) && new Set(g).size === MM.pegs; }
export let MM_ALL = null;                       // every possible code (6 x 5 x 4 x 3 = 360), built once (fewer colours, TUNE: their own list)
const MM_BY = {};
export function mmAll(colors = MM.colors) {
  if (MM_BY[colors]) return MM_BY[colors];
  const out = [];
  const walk = (cur) => {
    if (cur.length === MM.pegs) { out.push(cur.slice()); return; }
    for (let c = 0; c < colors; c++) if (!cur.includes(c)) { cur.push(c); walk(cur); cur.pop(); }
  };
  walk([]);
  if (colors === MM.colors) MM_ALL = out;
  return (MM_BY[colors] = out);
}
export function mmCode(rng, colors = MM.colors) { const cols = shuffle(Array.from({ length: colors }, (_, c) => c), rng); return cols.slice(0, MM.pegs); }
// The codes still consistent with every feedback so far (public information only).
export function mmCandidates(pm) {
  return mmAll(tune(pm).colors).filter(code => pm.guesses.every(g => { const f = mmFeedback(g.code, code); return f.solid === g.solid && f.hollow === g.hollow; }));
}
// The guess that best splits what is left: the smallest worst-case group of remaining codes (minimax),
// a code that could itself be the answer first among equals.
export function mmBestGuess(cand, colors = MM.colors) {
  if (cand.length <= 2) return cand[0];
  const canSet = new Set(cand.map(c => c.join('')));
  let best = null, bestWorst = Infinity, bestIn = false;
  for (const g of mmAll(colors)) {
    const groups = new Map();
    let worst = 0;
    for (const c of cand) {
      const f = mmFeedback(g, c), k = f.solid * 10 + f.hollow;
      const n = (groups.get(k) || 0) + 1;
      groups.set(k, n);
      if (n > worst) { worst = n; if (worst > bestWorst) break; }
    }
    const isIn = canSet.has(g.join(''));
    if (worst < bestWorst || (worst === bestWorst && isIn && !bestIn)) { best = g; bestWorst = worst; bestIn = isIn; }
  }
  return best.slice();
}
export function create(type, rng) {
  return { type, code: mmCode(rng, tuneLive(type).colors), guesses: [] };   // (the admin's settings: the colours to choose from)
}
export function apply(mini, p, m, rng, idx) {
  if (!mmValid(m, tune(mini).colors)) return { ok: false, reason: 'bad' };
  const f = mmFeedback(m, mini.code);
  mini.guesses.push({ by: p, code: m.slice(), solid: f.solid, hollow: f.hollow });
  if (f.solid === MM.pegs) return { ok: true, outcome: 'win', cells: [0, 1, 2, 3] };
  return { ok: true, outcome: 'continue', note: 'guess' };
}
export function publicView(mini) {
  return { type: 'mastermind', guesses: mini.guesses.map(g => ({ by: g.by, code: g.code.slice(), solid: g.solid, hollow: g.hollow })) };
}
export function randomMove(mini, p, rng, from, empties) {
  return mmCode(rng, tune(mini).colors);
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const g = mini.guesses[mini.guesses.length - 1]; flash.code = g.code.slice(); flash.solid = g.solid; flash.hollow = g.hollow; return;
}
export function secret(mini) {
  return { code: mini.code.slice() };
}
export function hide(m, k, st) {
  delete m.code; return;
}
export function flashMs(f, winLen, won) {
  return 450 + MM.pegs * 250 + (won ? 900 : 0);
}
// Super Chaos: each player gets their own feedback during their move; at the round's end both guesses join
// the shared history.
export function scMerge(m, c) {
  const n = c.base.guesses.length;
  m.guesses = c.base.guesses.concat(...c.played.map(p => c.forks[p].guesses.slice(n)));
}
