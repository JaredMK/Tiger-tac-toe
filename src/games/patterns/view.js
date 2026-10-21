// Patterns: the screen, the miniature, the move's words and sounds, and the inputs.
import { patCfg, patRot } from './rules.js';
import { N, esc, mv, state } from '../../ui/app.js';
import { arcTally, lateAt, pips } from '../../ui/progress.js';

// Patterns: the sequence with its gap, and four options (two by two). As Trivia: a wrong pick is crossed
// out for both players and the puzzle stays; nothing ever shows the answer after a wrong pick. The right
// one glows and drops into the gap; the next puzzle waits for the next turn.
const PAT_COL = ['#3d7fe0', '#4caf50', '#8d5bd8', '#f06aa8', '#21b2a6', '#f39a3b'];
const PAT_COLN = ['blue', 'green', 'purple', 'pink', 'teal', 'orange'];
const PAT_SIDES = { 3: 'triangle', 4: 'square', 5: 'pentagon', 6: 'hexagon', 7: 'heptagon', 8: 'octagon' };
// An item in words (for the options' labels and the screen reader).
function patSay(it) {
  if (it == null) return 'the gap';
  if ('n' in it) return String(it.n);
  if ('d' in it) return `${it.d} ${PAT_COLN[it.c]} dot${it.d === 1 ? '' : 's'}`;
  const name = it.g === 0 ? 'circle' : it.g === 1 ? 'arrow' : PAT_SIDES[it.g];
  return `${it.f ? 'solid' : 'outline'} ${PAT_COLN[it.c]} ${name}, size ${it.z}${it.g === 1 ? `, pointing ${['up', 'up-right', 'right', 'down-right', 'down', 'down-left', 'left', 'up-left'][Math.round(patRot(it) / 45) % 8]}` : ''}`;
}
// An item drawn in a 100 x 100 box: a number, a shape (ink-outlined, the game's style), or dots.
function patSvg(it) {
  if ('n' in it) { const t = String(it.n); return `<svg viewBox="0 0 100 100" aria-hidden="true"><text x="50" y="${t.length > 3 ? 62 : 66}" class="pnum" font-size="${t.length > 3 ? 30 : t.length > 2 ? 38 : 48}">${t}</text></svg>`; }
  if ('d' in it) {
    const n = it.d, cols = n <= 3 ? n : n <= 4 ? 2 : n <= 9 ? 3 : 4, rows = Math.ceil(n / cols), gap = cols <= 3 && rows <= 3 ? 26 : 21, r = gap * 0.36;
    const dots = Array.from({ length: n }, (_, k) => { const row = Math.floor(k / cols), inRow = row === rows - 1 ? n - row * cols : cols, col = k % cols; return `<circle cx="${(50 + (col - (inRow - 1) / 2) * gap).toFixed(1)}" cy="${(50 + (row - (rows - 1) / 2) * gap).toFixed(1)}" r="${r.toFixed(1)}"/>`; }).join('');
    return `<svg viewBox="0 0 100 100" aria-hidden="true"><g class="pdots" fill="${PAT_COL[it.c]}">${dots}</g></svg>`;
  }
  const R = 11 + it.z * 6.4, col = PAT_COL[it.c], fill = it.f ? col : '#fff', stroke = it.f ? 'var(--ink)' : col, sw = it.f ? 4 : 7;
  let body;
  if (it.g === 0) body = `<circle cx="50" cy="50" r="${R}"/>`;
  else if (it.g === 1) { const s = R / 40; body = `<path transform="rotate(${it.r} 50 50) translate(50 50) scale(${s.toFixed(3)})" d="M0 -40 L30 -6 L12 -6 L12 38 L-12 38 L-12 -6 L-30 -6 Z" stroke-width="${(sw / s).toFixed(1)}"/>`; }
  else body = `<polygon points="${Array.from({ length: it.g }, (_, k) => { const t = (-90 + (it.g % 2 ? 0 : 180 / it.g) + (360 / it.g) * k + it.r) * Math.PI / 180; return `${(50 + R * Math.cos(t)).toFixed(1)},${(50 + R * Math.sin(t)).toFixed(1)}`; }).join(' ')}"/>`;
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><g fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round">${body}</g></svg>`;
}
function patternsTable(mini, a, o) {
  const t = a && a.pat ? a.pat : null, l = mini.last, turn = o.turn;
  const goal = patCfg(mini).goal, tal = p => arcTally(p, o, pips(p, Math.min(goal, mini.right[p]), goal, !!(t && t.correct && a.by === p), 250));
  const pick = t || ((o.done || o.view) && l ? l : null);   // the pick just made (fresh), the one on show until heading back or when looking back, else the open puzzle
  const shown = pick || mini.puz;
  if (!shown) return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><p class="arcnote">No puzzle here.</p></div>`;
  const crossed = new Set(pick ? (pick.crossed || []) : (mini.crossed || []));
  const solved = pick && pick.correct ? shown.opts[pick.right] : null;
  const seq = shown.seq.map(it => (it ? `<span class="patit">${patSvg(it)}</span>`
    : solved ? `<span ${lateAt('patit gap filled', t ? 250 : null)}>${patSvg(solved)}</span>` : '<span class="patit gap"><b>?</b></span>')).join('');
  const letters = 'ABCD';
  const opts = shown.opts.map((it, k) => {
    let cls = 'popt';
    if (crossed.has(k)) cls += ' out';
    else if (pick && k === pick.picked) cls += pick.correct ? ' right' : ' wrong out fresh';
    const st = pick && t && k === pick.picked ? ' style="--t:250ms"' : '';
    const dis = !!pick || o.locked || crossed.has(k);
    return `<button class="${cls}"${st} data-act="move" ${mv(k)}${dis ? ' disabled' : ''} aria-label="${letters[k]}: ${esc(patSay(it))}${crossed.has(k) || (pick && !pick.correct && k === pick.picked) ? ' (crossed out)' : ''}"><b>${letters[k]}</b>${patSvg(it)}</button>`;
  }).join('');
  const who = pick ? pick.by || (t && a.by) : turn, left = shown.opts.length - crossed.size;
  const ask = shown.seq.indexOf(null) === shown.seq.length - 1 ? 'What comes next?' : 'What is missing?';
  const res = t ? `<p ${lateAt('arcres ' + (t.correct ? 'ok' : 'no'), 250)} role="status">${t.correct ? 'Right!' : t.picked < 0 ? 'Time\'s up' : t.auto ? 'Time\'s up: one crossed out' : 'Wrong: crossed out'}</p>`
    : pick ? `<p class="arcres ${pick.correct ? 'ok' : 'no'}"><b class="${who}">${N(who)}</b> ${pick.correct ? 'got it right' : 'got it wrong'}</p>`
    : `<p class="arcnote">${o.view ? '' : `<b class="${turn}">${N(turn)}</b>'s turn · ${left} option${left === 1 ? '' : 's'} left`}</p>`;
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="patterns"><div class="patcard"><small>${ask}</small><div class="pseq" style="--n:${shown.seq.length}" aria-label="The sequence: ${esc(shown.seq.map(patSay).join(', '))}">${seq}</div></div><div class="popts">${opts}</div>${res}</div></div>`;
}
export function miniature(mini, final) {
  const pz = mini.puz || (mini.last ? { seq: mini.last.seq } : null); return `<div class="tpat">${['X', 'O'].map(p => `<div class="tr ${p}"><b class="${p}">${p}</b>${Array.from({ length: patCfg(mini).goal }, (_, k) => `<i class="${k < mini.right[p] ? 'on' : ''}"></i>`).join('')}</div>`).join('')}${pz ? `<div class="tseq">${pz.seq.map(it => (it ? `<span>${patSvg(it)}</span>` : '<span class="q">?</span>')).join('')}</div>` : ''}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = patternsTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
export function moveText(f, who) {
  return f.pat ? (f.pat.correct ? `${who} got the pattern` : `${who} picked wrong · crossed out`) : `${who} picked`;
}
export function sounds(f, add, won, mini, last) {
  if (f.pat) add(f.pat.correct ? 'ding' : 'thud', 250); return;   // the pick glows (and drops into the gap) or is struck through
}
