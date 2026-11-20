// Mystery Face: the screen, the miniature, the move's words and sounds.
// The board is a grid of cartoon faces (original drawings: a round head in one of four colours, a hat, eyes, a mouth
// and a collar, each in up to four kinds), each a button. A guessed face keeps its clue under it: a tick or a cross on
// each feature's little icon, or the one feature it shares, or how many match (the square's clue kind). Over the grid,
// what the clues have pinned down so far: each feature's kind once known. A guess: the face pops (FACES.flip), its
// marks land one after another (FACES.mark), the words say the clue; the mystery face found bursts gold.
// With a mystery face each, the clues on show are the mover's own; with one for both, everyone's.
import { FACES, faceClues, faceKnown } from './rules.js';
import { N, mv } from '../../ui/app.js';
import { CROSS, TICK } from '../../ui/art.js';
import { arcTally, lateAt } from '../../ui/progress.js';

export const ownLine = true;
const SKIN = ['#8fd3f4', '#b9e769', '#ffb3c6', '#ffc46b'], INK = '#161210';
// A face's parts by feature (60 by 60): 0 hat, 1 eyes, 2 mouth, 3 colour (the head), 4 collar.
const HAT = [
  '<path d="M19 17c3-5 19-5 22 0" fill="none" stroke="#161210" stroke-width="2" stroke-linecap="round"/><path d="M27 12c1-3 5-3 6 0" fill="none" stroke="#161210" stroke-width="2" stroke-linecap="round"/>',
  '<path d="M13 21c0-12 34-12 34 0z" fill="#e4572e" stroke="#161210" stroke-width="2.2" stroke-linejoin="round"/><path d="M40 21h12" stroke="#161210" stroke-width="3" stroke-linecap="round"/>',
  '<rect x="19" y="2" width="22" height="17" rx="2" fill="#2b2b3a" stroke="#161210" stroke-width="2.2"/><path d="M11 19.500h38" stroke="#161210" stroke-width="4" stroke-linecap="round"/><path d="M19 14h22" stroke="#f4d35e" stroke-width="3"/>',
  '<path d="M13 22c1-13 33-13 34 0z" fill="#7b5ea7" stroke="#161210" stroke-width="2.2" stroke-linejoin="round"/><path d="M13 21.500h34" stroke="#f7f0e0" stroke-width="4" stroke-linecap="round"/><circle cx="30" cy="8" r="4.200" fill="#f7f0e0" stroke="#161210" stroke-width="2"/>',
];
const EYES = [
  '<circle cx="23" cy="32" r="2.600" fill="#161210"/><circle cx="37" cy="32" r="2.600" fill="#161210"/>',
  '<circle cx="22.500" cy="32" r="5.600" fill="#fff" stroke="#161210" stroke-width="2"/><circle cx="37.500" cy="32" r="5.600" fill="#fff" stroke="#161210" stroke-width="2"/><path d="M28.100 32h3.800" stroke="#161210" stroke-width="2"/><circle cx="22.500" cy="32" r="1.800" fill="#161210"/><circle cx="37.500" cy="32" r="1.800" fill="#161210"/>',
  '<path d="M14 29h32v4.500c0 3-3 5-6 5h-4c-3 0-4.500-2-6-4-1.500 2-3 4-6 4h-4c-3 0-6-2-6-5z" fill="#161210"/><path d="M18 31.500l4-1" stroke="#fff" stroke-width="1.600" stroke-linecap="round"/>',
  '<path d="M19 33c2-3 6-3 8 0M33 33c2-3 6-3 8 0" fill="none" stroke="#161210" stroke-width="2.400" stroke-linecap="round"/>',
];
const MOUTH = [
  '<path d="M22 42c4 5 12 5 16 0" fill="none" stroke="#161210" stroke-width="2.400" stroke-linecap="round"/>',
  '<path d="M22 46c4-5 12-5 16 0" fill="none" stroke="#161210" stroke-width="2.400" stroke-linecap="round"/>',
  '<ellipse cx="30" cy="44" rx="4" ry="5" fill="#7a1f1f" stroke="#161210" stroke-width="2"/>',
  '<path d="M30 41c-3-3-9-2-11 3 4 1 8 0 11-2 3 2 7 3 11 2-2-5-8-6-11-3z" fill="#5b3a1e" stroke="#161210" stroke-width="1.600" stroke-linejoin="round"/>',
];
const COLLAR = [
  '',
  '<path d="M30 55l-9-5v10zM30 55l9-5v10z" fill="#e4572e" stroke="#161210" stroke-width="1.800" stroke-linejoin="round"/><circle cx="30" cy="55" r="2.400" fill="#f4d35e" stroke="#161210" stroke-width="1.400"/>',
  '<path d="M14 50c8 6 24 6 32 0v7c-8 5-24 5-32 0z" fill="#3fa7d6" stroke="#161210" stroke-width="2" stroke-linejoin="round"/><path d="M22 53.500v6M30 54.500v6M38 53.500v6" stroke="#fff" stroke-width="2"/>',
  '<path d="M16 51c7 7 21 7 28 0" fill="none" stroke="#161210" stroke-width="1.400"/><circle cx="20" cy="54" r="2.300" fill="#f4d35e" stroke="#161210" stroke-width="1.200"/><circle cx="26" cy="56.500" r="2.300" fill="#f4d35e" stroke="#161210" stroke-width="1.200"/><circle cx="34" cy="56.500" r="2.300" fill="#f4d35e" stroke="#161210" stroke-width="1.200"/><circle cx="40" cy="54" r="2.300" fill="#f4d35e" stroke="#161210" stroke-width="1.200"/>',
];
const PARTS = [HAT, EYES, MOUTH, null, COLLAR];
// A face from its features' kinds (only: one feature alone on a plain head, for the "known so far" strip; -1: unknown).
export function faceSvg(kinds, only) {
  const on = j => only == null || only === j, k = j => (j < kinds.length ? kinds[j] : 0);
  const head = `<circle cx="30" cy="34" r="19.500" fill="${on(3) && kinds.length > 3 ? SKIN[k(3) % 4] : only == null ? SKIN[0] : '#e9e2d0'}" stroke="${INK}" stroke-width="2.400"/>`;
  const ears = `<circle cx="10.500" cy="34" r="3.400" fill="${on(3) && kinds.length > 3 ? SKIN[k(3) % 4] : only == null ? SKIN[0] : '#e9e2d0'}" stroke="${INK}" stroke-width="2"/><circle cx="49.500" cy="34" r="3.400" fill="${on(3) && kinds.length > 3 ? SKIN[k(3) % 4] : only == null ? SKIN[0] : '#e9e2d0'}" stroke="${INK}" stroke-width="2"/>`;
  const part = j => (on(j) && j < kinds.length ? PARTS[j][k(j) % 4] : '');
  return `<svg class="fcface" viewBox="0 0 60 62" aria-hidden="true">${part(4)}${ears}${head}${on(1) ? part(1) : ''}${on(2) ? part(2) : ''}${part(0)}${only != null && only !== 1 && only !== 2 ? '' : ''}</svg>`;
}
// A feature's little icon (for a clue's marks).
const ICON = [
  '<path d="M3 11c0-8 14-8 14 0zM1 11.500h18" fill="none" stroke="currentColor" stroke-width="2.400" stroke-linecap="round" stroke-linejoin="round"/>',
  '<circle cx="5.500" cy="9" r="3.300" fill="none" stroke="currentColor" stroke-width="2.200"/><circle cx="14.500" cy="9" r="3.300" fill="none" stroke="currentColor" stroke-width="2.200"/>',
  '<path d="M3 7c3 6 11 6 14 0" fill="none" stroke="currentColor" stroke-width="2.600" stroke-linecap="round"/>',
  '<path d="M10 2c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z" fill="currentColor"/>',
  '<path d="M10 10 3 5v10zM10 10l7-5v10z" fill="currentColor"/>',
];
const icon = j => `<svg viewBox="0 0 20 18" aria-hidden="true">${ICON[j]}</svg>`;
const NAME = FACES.names;
function clueWords(kind, c, T) {
  if (c.hit) return 'Found it!';
  if (kind === 'count') return `${c.n} of ${T} match`;
  if (kind === 'one') return c.j < 0 ? 'Nothing in common' : `Same ${NAME[c.j]}!`;
  const n = c.m.reduce((x, v) => x + v, 0); return `${n} of ${T} match`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const T = mini.faces[0].length, n = mini.faces.length, s = a && a.fc ? a.fc : null, o = { view, locked, turn };
  const who = s ? a.by : (view || d) && mini.last ? mini.last.by : turn, kind = mini.clue || 'which';
  const clues = faceClues(mini, who), byFace = new Map(), owner = new Map();
  if (mini.sep) clues.forEach(c => byFace.set(c.f, c)); else for (const p of ['X', 'O']) mini.g[p].forEach(c => { byFace.set(c.f, c); owner.set(c.f, p); });
  const tal = p => arcTally(p, o, `<small class="fccount">${mini.g[p].length} ${mini.g[p].length === 1 ? 'guess' : 'guesses'}</small>`);
  const cols = n <= 9 ? 3 : n <= 16 ? 4 : 5, rows = Math.ceil(n / cols), T0 = FACES.flip;
  const tg = view && mini.tg != null ? (typeof mini.tg === 'object' ? [mini.tg.X, mini.tg.O] : [mini.tg]) : [];
  const marks = (c, late) => {
    const at = j => (late ? lateAt('', T0 + j * FACES.mark).replace('class=""', '').replace('class=" appear"', 'class="appear"') : '');
    if (c.hit) return `<span class="fcm hit"${late ? ` style="--t:${T0}ms"` : ''}><i class="ok${late ? ' appear' : ''}"${late ? ` style="--t:${T0}ms"` : ''}>${TICK}</i></span>`;
    if (kind === 'count') return `<span class="fcm"><b class="fcn${late ? ' appear' : ''}"${late ? ` style="--t:${T0}ms"` : ''}>${c.n}</b></span>`;
    if (kind === 'one') return `<span class="fcm"><i class="${c.j < 0 ? 'no' : 'ok'}${late ? ' appear' : ''}"${late ? ` style="--t:${T0}ms"` : ''}>${c.j < 0 ? CROSS : icon(c.j)}</i></span>`;
    return `<span class="fcm">${c.m.map((v, j) => `<i class="${v ? 'ok' : 'no'}${late ? ' appear' : ''}"${late ? ` style="--t:${T0 + j * FACES.mark}ms"` : ''} ${at(j) ? '' : ''}>${icon(j)}</i>`).join('')}</span>`;
  };
  const card = i => {
    const c = byFace.get(i), fresh1 = s && s.f === i, by = mini.sep ? who : owner.get(i), lab = `Face ${i + 1}`;
    const cls = `fccard${c ? ' done' : ''}${fresh1 ? ' pop' : ''}${c && c.hit ? ' hit' : ''}${tg.includes(i) ? ' tg' : ''}${c && !mini.sep ? ' by' + by : ''}`;
    const inner = `${faceSvg(mini.faces[i])}${c ? marks(c, !!fresh1) : '<span class="fcm"></span>'}`;
    return c || view || locked ? `<div class="${cls}" role="img" aria-label="${lab}${c ? ': guessed' : ''}">${inner}</div>` : `<button class="${cls} ${turn}" data-act="move" ${mv(i)} aria-label="${lab}">${inner}</button>`;
  };
  const known = kind === 'count' ? null : faceKnown(mini, who);
  const strip = known ? `<div class="fcknown" role="img" aria-label="Known so far: ${known.map((v, j) => (v < 0 ? '' : NAME[j])).filter(Boolean).join(', ') || 'nothing'}">${known.map((v, j) => `<span class="${v < 0 ? 'q' : 'k'}">${v < 0 ? `<i>${icon(j)}</i><b>?</b>` : faceSvg(mini.faces[0].map((x, i) => (i === j ? v : 0)), j)}</span>`).join('')}</div>` : '<div class="fcknown none"></div>';
  const end = s ? FACES.flip + (kind === 'which' && !s.hit ? T : 1) * FACES.mark : 0, l = s || ((view || d) && mini.last ? mini.last : null);
  const line = l ? `<p ${s ? lateAt('fcline ' + (l.hit ? 'ok' : 'cl'), end) : `class="fcline ${l.hit ? 'ok' : 'cl'}"`} role="status">${clueWords(kind, l, T)}</p>` : '<p class="fcline"></p>';
  return `<div class="g-fc pc-${who}"><div class="ctals">${tal('X')}${tal('O')}</div>${strip}<div class="fcgrid" style="--cols:${cols};--rows:${rows}">${mini.faces.map((x, i) => card(i)).join('')}</div>${line}</div>`;
}
export function heldSub(mini, turn, f, a) { return `<b class="${turn}">${N(turn)}</b>`; }
// The miniature: four of the board's faces, and each player's guesses so far as dots under their mark.
export function miniature(mini, final) {
  const pick = [0, 1, 2, 3].map(k => mini.faces[k % mini.faces.length]);
  const dots = p => `<div class="tfcr ${p}"><b class="${p}">${p}</b>${Array.from({ length: Math.min(6, mini.g[p].length) }, () => '<i></i>').join('')}</div>`;
  return `<div class="tfc" aria-label="Mystery Face: X ${mini.g.X.length} guesses, O ${mini.g.O.length} guesses"><div class="tfcf" aria-hidden="true">${pick.map(k => faceSvg(k)).join('')}</div>${dots('X')}${dots('O')}</div>`;
}
export function moveText(f, who) { const c = f.fc; return !c ? `${who} guessed` : c.hit ? `${who} found the mystery face` : `${who} guessed a face`; }
// The face popping, a tick for each mark as it lands (higher for a match), then a chime for the mystery face found.
export function sounds(f, add, won, mini, last) {
  const c = f.fc; if (!c) return;
  add('pop', 0);
  if (c.hit) { add('ding', FACES.flip); add('sparkle', FACES.flip + 130); return; }
  if (c.clue === 'which') c.m.forEach((v, j) => add(v ? 'fcYes' : 'fcNo', FACES.flip + j * FACES.mark));
  else add((c.clue === 'one' ? c.j >= 0 : c.n > 0) ? 'fcYes' : 'fcNo', FACES.flip);
}
