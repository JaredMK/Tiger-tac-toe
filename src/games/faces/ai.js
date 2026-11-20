// Mystery Face: the computer's play, from the clues it may go by. Normal guesses any face still possible; Hard the
// possible face whose clue would leave the fewest faces on average (it tries each against every face still possible);
// Easy guesses a face still possible two times in three, else any face not yet guessed.
import { faceClues, faceLeft } from './rules.js';

const clueKey = (pm, g, t) => { const m = pm.faces[g].map((v, j) => (v === pm.faces[t][j] ? 1 : 0)); return pm.clue === 'count' ? String(m.reduce((x, v) => x + v, 0)) : pm.clue === 'which' ? m.join('') : m.join('').replace(/1/g, 'x').length ? String(m.indexOf(1)) : ''; };

export function needs(pm, p) { const n = faceLeft(pm, p).length; return n <= 1 ? 1 : 1 + Math.log(n) / Math.log(3.2); }
export function best(pm, me, rng, style, ctx) {
  const level = (ctx && ctx.level) || 'normal', left = faceLeft(pm, me), q = 1 / Math.max(1, left.length);
  const pick = a => a[Math.floor(rng() * a.length)];
  if (!left.length) { const done = new Set(faceClues(pm, me).map(c => c.f)); return { move: pick(pm.faces.map((f, i) => i).filter(i => !done.has(i))), q: 0 }; }
  if (level === 'easy' && rng() < 1 / 3) { const done = new Set(faceClues(pm, me).map(c => c.f)), any = pm.faces.map((f, i) => i).filter(i => !done.has(i)); return { move: pick(any), q }; }
  if (level !== 'hard' || left.length <= 2) return { move: pick(left), q };
  let bestV = Infinity, bestI = [];
  for (const g of left) {
    const groups = new Map();                                     // the clue each possible mystery face would give this guess
    for (const t of left) { const k = clueKey(pm, g, t); groups.set(k, (groups.get(k) || 0) + 1); }
    let v = 0; for (const n of groups.values()) v += n * n;
    v = (v - 1) / left.length;                                    // the faces left on average (its own face: none)
    if (v < bestV - 1e-9) { bestV = v; bestI = [g]; } else if (Math.abs(v - bestV) <= 1e-9) bestI.push(g);
  }
  return { move: pick(bestI), q };
}
