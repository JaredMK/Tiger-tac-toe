// Patterns: the screen, the miniature, the move's words and sounds, and the inputs.
import { patCfg, patRaceShape, patRot } from './rules.js';
import { N, esc, mv, state, viewer } from '../../ui/app.js';
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
  if ('n' in it) { const t = String(it.n); return `<svg viewBox="0 0 100 100" aria-hidden="true"><text x="50" y="${t.length > 3 ? 62 : 66}" class="pnum" font-size="${t.length > 3 ? 30 : t.length > 2 ? 38 : 48}">${esc(t)}</text></svg>`; }
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
// Race mode (core/race.js): the square this view gets holds this phone's own card alone (mini.side[me]: its cross-outs and
// its last pick) and both players' shapes (wrong tries made, right or not); the other side's move arrives redacted
// (a.race: right or wrong, a timeout), never the option they picked. A finished square (view) is full: both cards shown.
const TICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5l5.5 5.5L20 7" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const shapeOf = (mini, p) => (mini.shape && mini.shape[p]) || patRaceShape(mini.side && mini.side[p]);   // a side's progress: the shape the record carries, or from its card (a finished square)
// A player's race tally: a pip for each wrong try they could make (filled red for each made) and a tick once they are right.
export function raceTally(sh, slots, fresh, t) {
  const n = sh.n || 0;
  return `<span class="pips tqr" aria-label="${n} wrong${sh.right ? ', got it' : ''}">${Array.from({ length: slots }, (_, k) => `<i ${lateAt(k < n ? 'no' : '', fresh && !sh.right && k === n - 1 ? t : null, 'fillin')}></i>`).join('')}<em ${lateAt('tqok' + (sh.right ? ' on' : ''), fresh && sh.right ? t : null)}>${TICK}</em></span>`;
}
function patternsTable(mini, a, o) {
  const race = !!mini.race, me = race ? (viewer() || o.turn) : null, turn = o.turn;
  const part = race ? (mini.side && mini.side[me]) || null : mini;                          // this side's own card (a race: may be absent on a phone with no side), or the square
  const theirs = race && a && a.race && a.by !== me ? a : null;                              // the other side's move in a race: its shape alone
  const t = a && a.pat ? a.pat : null, fr = t || (theirs && theirs.race), l = part ? part.last : null;
  const goal = patCfg(mini).goal, nOpts = mini.puz ? mini.puz.opts.length : 4;
  const tal = p => arcTally(p, o, race ? raceTally(shapeOf(mini, p), nOpts - 1, !!(fr && a.by === p), 250) : pips(p, Math.min(goal, mini.right[p]), goal, !!(t && t.correct && a.by === p), 250));
  const winL = race && o.view ? ['X', 'O'].map(p => mini.side && mini.side[p] && mini.side[p].last).find(x => x && x.correct) || null : null;   // a finished race square: the winning pick
  const held = o.done && (!race || o.dby === me);                                            // this phone's own move, held until Board (never the other side's)
  const pick = t || (race && o.view ? winL : (held || o.view) && l ? l : null);   // the pick just made (fresh), the one on show until heading back or when looking back, else the open puzzle
  const shown = pick || mini.puz;
  if (!shown) return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><p class="arcnote">No puzzle here.</p></div>`;
  const crossed = new Set(pick && !winL ? (pick.crossed || []) : part ? (part.crossed || []) : []);   // this phone's own cross-outs (a race), or the square's
  const outBy = k => (winL ? ['X', 'O'].filter(p => mini.side && mini.side[p] && (mini.side[p].crossed || []).includes(k)) : []);   // a finished race square: who crossed an option out
  const solved = pick && pick.correct ? shown.opts[pick.right] : null;
  const seq = shown.seq.map(it => (it ? `<span class="patit">${patSvg(it)}</span>`
    : solved ? `<span ${lateAt('patit gap filled', t ? 250 : null)}>${patSvg(solved)}</span>` : '<span class="patit gap"><b>?</b></span>')).join('');
  const letters = 'ABCD';
  const opts = shown.opts.map((it, k) => {
    let cls = 'popt';
    const by = outBy(k);
    if (crossed.has(k) || by.length) cls += ' out';
    else if (pick && k === pick.picked) cls += pick.correct ? ' right' : ' wrong out fresh';
    const st = pick && t && k === pick.picked ? ' style="--t:250ms"' : '';
    const dis = !!pick || !!theirs || o.locked || crossed.has(k);
    const who = by.length ? `<small class="tqwho" aria-hidden="true">${by.map(p => `<b class="${p}">${p}</b>`).join('')}</small>` : '';
    return `<button class="${cls}"${st} data-act="move" ${mv(k)}${dis ? ' disabled' : ''} aria-label="${letters[k]}: ${esc(patSay(it))}${crossed.has(k) || by.length || (pick && !pick.correct && k === pick.picked) ? ' (crossed out)' : ''}"><b>${letters[k]}</b>${patSvg(it)}${who}</button>`;
  }).join('');
  const who = pick ? pick.by || (t && a.by) : turn, left = shown.opts.length - crossed.size;
  const ask = shown.seq.indexOf(null) === shown.seq.length - 1 ? 'What comes next?' : 'What is missing?';
  const res = theirs                                                      // the other side's pick in a race: right or wrong, never which
    ? `<p ${lateAt('arcres ' + (theirs.race.correct ? 'ok' : 'no'), 250)} role="status"><b class="${a.by}">${N(a.by)}</b> ${theirs.race.correct ? 'got it' : theirs.race.auto ? 'ran out of time' : 'got it wrong'}</p>`
    : t ? `<p ${lateAt('arcres ' + (t.correct ? 'ok' : 'no'), 250)} role="status">${t.correct ? 'Right!' : t.picked < 0 ? 'Time\'s up' : t.auto ? 'Time\'s up: one crossed out' : 'Wrong: crossed out'}</p>`
    : pick ? `<p class="arcres ${pick.correct ? 'ok' : 'no'}"><b class="${who}">${N(who)}</b> ${pick.correct ? 'got it right' : 'got it wrong'}</p>`
    : `<p class="arcnote">${o.view ? '' : `<b class="${turn}">${N(turn)}</b>'s turn · ${left} option${left === 1 ? '' : 's'} left${race ? ' for you' : ''}`}</p>`;
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="patterns"><div class="patcard"><small>${ask}</small><div class="pseq" style="--n:${shown.seq.length}" aria-label="The sequence: ${esc(shown.seq.map(patSay).join(', '))}">${seq}</div></div><div class="popts">${opts}</div>${res}</div></div>`;
}
// The miniature: each player's patterns got as pips, and the puzzle's sequence with its gap (dashed). A sequence of
// numbers shows only the gap and the two next to it, each number as large as the board's other text; shapes and dots
// show the whole sequence.
export function miniature(mini, final) {
  const pz = mini.puz || (mini.last ? { seq: mini.last.seq } : null);
  let seq = pz ? pz.seq : [];
  const nums = seq.some(it => it && 'n' in it);
  if (nums && seq.length > 3) { const g = Math.max(0, seq.indexOf(null)), at = Math.max(0, Math.min(seq.length - 3, g === 0 ? 0 : g - 2)); seq = seq.slice(at, at + 3); }
  const cell = it => (!it ? '<span class="q"></span>' : 'n' in it ? `<span class="n">${esc(String(it.n))}</span>` : `<span>${patSvg(it)}</span>`);
  const n = pz && pz.opts ? pz.opts.length : 4;
  const row = p => (mini.race                                                                  // a race: each player's wrong tries and a tick once they are right (their shapes; nobody's picks)
    ? `<div class="tr ${p}"><b class="${p}">${p}</b>${Array.from({ length: n - 1 }, (_, k) => `<i class="${k < (shapeOf(mini, p).n || 0) ? 'no' : ''}"></i>`).join('')}<em class="tqok${shapeOf(mini, p).right ? ' on' : ''}">${TICK}</em></div>`
    : `<div class="tr ${p}"><b class="${p}">${p}</b>${Array.from({ length: patCfg(mini).goal }, (_, k) => `<i class="${k < mini.right[p] ? 'on' : ''}"></i>`).join('')}</div>`);
  return `<div class="tpat${mini.race ? ' tqrm' : ''}"${mini.race ? ` aria-label="Patterns race: ${['X', 'O'].map(p => `${p} ${shapeOf(mini, p).right ? 'got it' : `${shapeOf(mini, p).n || 0} wrong`}`).join(', ')}"` : ''}>${row('X')}${row('O')}${seq.length ? `<div class="tseq${nums ? ' tnums' : ''}">${seq.map(cell).join('')}</div>` : ''}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = patternsTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d, dby: d ? d.by : null }); return g;
}
export function moveText(f, who) {
  if (f.race && !f.pat) return f.race.correct ? `${who} got the pattern` : `${who} picked wrong${f.race.auto ? ' (out of time)' : ''}${f.race.n ? ` · ${f.race.n} wrong so far` : ''}`;   // the other side's pick in a race: right or wrong alone
  return f.pat ? (f.pat.correct ? `${who} got the pattern` : `${who} picked wrong · crossed out`) : `${who} picked`;
}
export function sounds(f, add, won, mini, last) {
  const t = f.pat || f.race; if (t) add(t.correct ? 'ding' : 'thud', 250); return;   // the pick glows (and drops into the gap) or is struck through (a race: the other side's, right or wrong alone)
}
