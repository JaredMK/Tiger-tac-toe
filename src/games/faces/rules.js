// Mystery Face: the rules (pure: no page, no clock; the server runs the same code).
// A board of faces (`faces[i]`: the kind of each of its features, e.g. [hat, eyes, mouth, colour, collar]), no two the
// same. Separate (the default): each player has a mystery face of their own among them (`tg.X`, `tg.O`: never the same
// face; hidden, the server's alone online: `secret`/`hide`); a move guesses one face (its number) and the clue comes
// back: for each feature, whether the mystery face has the same kind (`g[p]`: [{ f, m: [0/1 a feature] }]). The clues
// are open (they say nothing of the other player's face). A player who guesses their own mystery face takes the
// square. Shared (`boards`): one mystery face, every clue on show for both, the first to guess it wins.
// The deal draws faces so that every feature's kinds are spread evenly (no kind much rarer than another).
import { needRng, randInt, shuffle } from '../../core/random.js';
import { tuneLive } from '../../core/tune.js';

export const FACES = { names: ['hat', 'eyes', 'mouth', 'colour', 'collar'], flip: 240, mark: 170, hold: 520 };   // ms: the guessed face popping, each feature's mark after it, the clue on show
export function create(type, rng) {
  const t = tuneLive(type), r = needRng(rng), T = t.traits, V = t.vals, n = Math.min(t.faces, V ** T), seen = new Set(), faces = [];
  // each face: its features drawn from decks that hold every kind as often (so the kinds stay even), no face twice
  const decks = Array.from({ length: T }, () => shuffle(Array.from({ length: Math.ceil(n / V) * V }, (_, k) => k % V), r));
  for (let i = 0; i < n; i++) {
    let f = decks.map(d => d[i]);
    for (let k = 0; k < 200 && seen.has(f.join('')); k++) f = f.map((v, j) => (randInt(r, T) === j || k > 40 ? randInt(r, V) : v));
    seen.add(f.join('')); faces.push(f);
  }
  const sep = t.boards !== 'shared', a = randInt(r, n); let b = randInt(r, n - 1); if (b >= a) b++;
  return { type, v: 1, sep, clue: ['one', 'count', 'which'].includes(t.clue) ? t.clue : 'which', faces, tg: sep ? { X: a, O: b } : a, g: { X: [], O: [] }, last: null };
}
export const faceClue = (faces, guess, target) => faces[guess].map((v, j) => (v === faces[target][j] ? 1 : 0));
// The clues p goes by: their own (a mystery face each), or everyone's (one for both).
export const faceClues = (mini, p) => (mini.sep ? mini.g[p] : mini.g.X.concat(mini.g.O));
// The faces still possible for p: every clue so far says of them what it said. A clue is one of three kinds
// (`mini.clue`): 'which' (the default): a tick or a cross on every feature (`m`); 'one': one feature the guess shares with the mystery face (`j`; -1: none in common; of
// several, one the player has not been shown yet); 'count': how many features match (`n`); 'which': a tick or a cross
// on every feature (`m`).
const sum = m => m.reduce((x, v) => x + v, 0);
export function faceFits(mini, i, c) {
  if (c.f === i) return false;
  const m = mini.faces[c.f].map((v, j) => (v === mini.faces[i][j] ? 1 : 0));
  if (mini.clue === 'count') return sum(m) === c.n;
  if (mini.clue === 'which') return m.every((v, j) => v === c.m[j]);
  return c.j < 0 ? sum(m) === 0 : m[c.j] === 1;
}
// What p knows of their mystery face for sure: for each feature, its kind (-1 not known yet).
export function faceKnown(mini, p) {
  const k = mini.faces[0].map(() => -1);
  for (const c of faceClues(mini, p)) { if (mini.clue === 'one' && c.j >= 0) k[c.j] = mini.faces[c.f][c.j]; if (mini.clue === 'which') c.m.forEach((v, j) => { if (v) k[j] = mini.faces[c.f][j]; }); }
  return k;
}
export function faceLeft(mini, p) {
  const cl = faceClues(mini, p);
  return mini.faces.map((f, i) => i).filter(i => cl.every(c => faceFits(mini, i, c)));
}
export function apply(mini, p, m, rng, idx) {
  if (!idx(mini.faces.length)) return { ok: false, reason: 'bad' };
  if (faceClues(mini, p).some(c => c.f === m)) return { ok: false, reason: 'guessed' };
  const tg = mini.sep ? mini.tg && mini.tg[p] : mini.tg;
  if (!Number.isInteger(tg)) return { ok: false, reason: 'secret' };
  const cl = faceClue(mini.faces, m, tg), hit = m === tg;
  const n = cl.reduce((x, v) => x + v, 0);
  let clue;
  if (mini.clue === 'count') clue = { f: m, n };
  else if (mini.clue === 'which') clue = { f: m, m: cl };
  else {                                                          // one feature in common: one not shown yet when there is one
    const known = faceKnown(mini, p), all = cl.map((v, j) => (v ? j : -1)).filter(j => j >= 0), fresh = all.filter(j => known[j] < 0), from = fresh.length ? fresh : all;
    clue = { f: m, j: hit || !from.length ? -1 : from[randInt(needRng(rng), from.length)] };
  }
  mini.g[p].push(clue);
  mini.last = Object.assign({ by: p, hit }, clue);
  return hit ? { ok: true, outcome: 'win', note: 'found' } : { ok: true, outcome: 'continue', note: 'clue' };
}
export function timeoutClose(mini, p) { return null; }
const cpc = c => Object.assign({}, c, c.m ? { m: c.m.slice() } : null), cpg = g => ({ X: g.X.map(cpc), O: g.O.map(cpc) });
export function publicView(mini) {                                // never a mystery face
  return { type: 'faces', v: mini.v, sep: !!mini.sep, clue: mini.clue, faces: mini.faces.map(f => f.slice()), g: cpg(mini.g), last: mini.last ? cpc(mini.last) : null };
}
export function secret(mini) { return mini.tg == null ? null : { tg: typeof mini.tg === 'object' ? { X: mini.tg.X, O: mini.tg.O } : mini.tg }; }
export function hide(m, k, st) { delete m.tg; }
export function randomMove(mini, p, rng, from, empties) { return from(faceLeft(mini, p)); }   // (the tests' stand-in: a face still possible)
export function moveFlash(m, p, range, bjFrom, mini, flash) { const l = mini.last; flash.fc = Object.assign({}, l, l.m ? { m: l.m.slice() } : null, { k: mini.faces[0].length, clue: mini.clue }); delete flash.fc.by; }
export const facesMs = (kind, n) => FACES.flip + (kind === 'which' ? n : 1) * FACES.mark;
export function flashMs(f, winLen, won) { return facesMs(f.fc ? f.fc.clue : 'one', f.fc ? f.fc.k : 5) + FACES.hold + (won ? 400 : 0); }
