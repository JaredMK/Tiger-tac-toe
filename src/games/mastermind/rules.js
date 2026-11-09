// Codebreaker: the rules (pure: no page, no clock; the server runs the same code).
import { shuffle } from '../../core/random.js';
import { RACE_V, raceDealt, raceSide } from '../../core/race.js';
import { tune, tuneLive } from '../../core/tune.js';

export const MM = { pegs: 4, colors: 6 };    // Codebreaker: a code of 4 pegs from 6 colours, no colour twice      // Hexapawn: X starts on the bottom row and moves up, O starts on the top row and moves down
// Codebreaker: one hidden code shared by both players, 4 pegs from 6 colours, no colour twice (in the
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
// Race mode (core/race.js, `rv: 2`): each player cracks a code of their own, dealt from the same colours by the same
// rule (four different colours; every code as hard as any other), the two codes different (`mini.tg[p]`, the targets:
// secret until the square ends, as a Shared square's code is); each player's guesses and markers are their own
// (`mini.side[p]`: { guesses }), open to both. No guess limit; the first to crack their own code takes the square.
// Where p's guesses live: the square itself (Shared), or p's own side (Race; null for a side this copy has not got).
export const mmPart = (mini, p) => (mini && mini.race ? raceSide(mini, p) : mini);
// p's guesses as this copy has them (a race side it lacks: none).
export const mmGuesses = (mini, p) => { const part = mmPart(mini, p); return part && Array.isArray(part.guesses) ? part.guesses : []; };
// p's code: Shared, the square's one; Race, p's own (a race square from before the rework: its one code). Null where
// this copy has not got it (the public state of an open square).
export const mmCodeOf = (mini, p) => (mini && mini.race && mini.tg ? (mini.tg[p] || null) : (mini && mini.code) || null);
// The codes still consistent with every feedback so far (public information only; a race: p's own guesses).
export function mmCandidates(pm, p) {
  const gs = pm.race ? mmGuesses(pm, p) : pm.guesses;
  return mmAll(tune(pm).colors).filter(code => gs.every(g => { const f = mmFeedback(g.code, code); return f.solid === g.solid && f.hollow === g.hollow; }));
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
export function create(type, rng, opts) {
  const colors = tuneLive(type).colors, code = mmCode(rng, colors);   // (the admin's settings: the colours to choose from, the mode)
  if (raceDealt(type, opts)) {                                    // a race: a code each, the two different
    let other = mmCode(rng, colors);
    for (let k = 0; k < 40 && other.join() === code.join(); k++) other = mmCode(rng, colors);
    return { type, race: true, rv: RACE_V, side: { X: { guesses: [] }, O: { guesses: [] } }, tg: { X: code, O: other } };
  }
  return { type, code, guesses: [] };
}
export function apply(mini, p, m, rng, idx) {
  const part = mmPart(mini, p), code = mmCodeOf(mini, p);
  if (!part || !code) return { ok: false, reason: 'bad' };
  if (!Array.isArray(part.guesses)) part.guesses = [];            // (an empty list the database dropped)
  if (!mmValid(m, tune(mini).colors)) return { ok: false, reason: 'bad' };
  const f = mmFeedback(m, code);
  part.guesses.push({ by: p, code: m.slice(), solid: f.solid, hollow: f.hollow });
  if (f.solid === MM.pegs) return { ok: true, outcome: 'win', cells: [0, 1, 2, 3] };
  return { ok: true, outcome: 'continue', note: 'guess' };
}
const pubGuesses = gs => (gs || []).map(g => ({ by: g.by, code: g.code.slice(), solid: g.solid, hollow: g.hollow }));
export function publicView(mini) {
  if (mini.race) return { type: 'mastermind', race: true, side: { X: { guesses: pubGuesses(mmGuesses(mini, 'X')) }, O: { guesses: pubGuesses(mmGuesses(mini, 'O')) } } };   // (a race: both players' guesses, open; the codes stay out)
  return { type: 'mastermind', guesses: pubGuesses(mini.guesses) };
}
// Race: p's progress in brief (core/race.js publicMini's shape): guesses made and their best row's markers.
export function raceShape(mini, p) {
  if (!raceSide(mini, p)) return {};
  const best = mmBestRow(mmGuesses(mini, p));
  return { n: mmGuesses(mini, p).length, best: best ? [best.solid, best.hollow] : null };
}
// The row nearest the code (most solid markers, then most hollow ones; the later among equals), or null with none.
export function mmBestRow(gs) {
  let best = null;
  for (const g of gs || []) if (!best || g.solid > best.solid || (g.solid === best.solid && g.hollow >= best.hollow)) best = g;
  return best;
}
export function randomMove(mini, p, rng, from, empties) {
  return mmCode(rng, tune(mini).colors);
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const gs = mmGuesses(mini, p), g = gs[gs.length - 1]; flash.code = g.code.slice(); flash.solid = g.solid; flash.hollow = g.hollow; return;
}
export function secret(mini) {
  if (mini.race && mini.tg) return { tg: JSON.parse(JSON.stringify(mini.tg)) };   // (a race: both players' codes, top-level: core/records.js fullState puts them back with Object.assign)
  return mini.code ? { code: mini.code.slice() } : null;
}
export function hide(m, k, st) {
  delete m.code; delete m.tg; return;
}
export function flashMs(f, winLen, won) {
  return 450 + MM.pegs * 250 + (won ? 900 : 0);
}
// Super Chaos: each player gets their own feedback during their move; at the round's end both guesses join
// the shared history.
export function scMerge(m, c) {
  if (m.race) { for (const p of c.played) if (c.forks[p].side) m.side[p] = c.forks[p].side[p]; return; }   // (Super Chaos is off; a race square keeps each side's own)
  const n = c.base.guesses.length;
  m.guesses = c.base.guesses.concat(...c.played.map(p => c.forks[p].guesses.slice(n)));
}
