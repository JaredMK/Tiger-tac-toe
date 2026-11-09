// Patterns: the screen, the miniature, the move's words and sounds, and the inputs.
import { patCfg, patRot } from './rules.js';
import { raceOld } from '../../core/race.js';
import { raceBoards, raceMe, raceThem, raceThumb } from '../../ui/race.js';
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
function patternsTable(mini, a, o) {
  if (mini.race) return raceOld(mini) ? '<div class="g-arc"><p class="arcnote">This square is being dealt again.</p></div>' : patternsRace(mini, a, o);
  const turn = o.turn, part = mini;
  const t = a && a.pat ? a.pat : null, l = part.last;
  const goal = patCfg(mini).goal;
  const tal = p => arcTally(p, o, pips(p, Math.min(goal, mini.right[p]), goal, !!(t && t.correct && a.by === p), 250));
  const pick = t || ((o.done || o.view) && l ? l : null);   // the pick just made (fresh), the one on show until heading back or when looking back, else the open puzzle
  const shown = pick || mini.puz;
  if (!shown) return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><p class="arcnote">No puzzle here.</p></div>`;
  const crossed = new Set(pick ? (pick.crossed || []) : part.crossed || []);
  const solved = pick && pick.correct ? shown.opts[pick.right] : null;
  const seq = seqHtml(shown, solved, t ? 250 : null);
  const opts = optsHtml(shown, crossed, pick, !!t, k => !!pick || o.locked || crossed.has(k));
  const who = pick ? pick.by || (t && a.by) : turn, left = shown.opts.length - crossed.size;
  const res = t ? `<p ${lateAt('arcres ' + (t.correct ? 'ok' : 'no'), 250)} role="status">${t.correct ? 'Right!' : t.picked < 0 ? 'Time\'s up' : t.auto ? 'Time\'s up: one crossed out' : 'Wrong: crossed out'}</p>`
    : pick ? `<p class="arcres ${pick.correct ? 'ok' : 'no'}"><b class="${who}">${N(who)}</b> ${pick.correct ? 'got it right' : 'got it wrong'}</p>`
    : `<p class="arcnote">${o.view ? '' : `<b class="${turn}">${N(turn)}</b>'s turn · ${left} option${left === 1 ? '' : 's'} left`}</p>`;
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="patterns">${cardHtml(shown, seq)}<div class="popts">${opts}</div>${res}</div></div>`;
}
const askOf = puz => (puz.seq.indexOf(null) === puz.seq.length - 1 ? 'What comes next?' : 'What is missing?');
// The sequence with its gap (filled with the right option once got: at `t` ms, the pick's moment, or at once).
const seqHtml = (puz, solved, t) => puz.seq.map(it => (it ? `<span class="patit">${patSvg(it)}</span>`
  : solved ? `<span ${lateAt('patit gap filled', t)}>${patSvg(solved)}</span>` : '<span class="patit gap"><b>?</b></span>')).join('');
const cardHtml = (puz, seq) => `<div class="patcard"><small>${askOf(puz)}</small><div class="pseq" style="--n:${puz.seq.length}" aria-label="The sequence: ${esc(puz.seq.map(patSay).join(', '))}">${seq}</div></div>`;
// The options as buttons: crossed out struck; the pick glowing (right) or struck (wrong); `right`: the right place to show (a finished square).
function optsHtml(puz, crossed, pick, fresh, dis, right) {
  const letters = 'ABCD';
  return puz.opts.map((it, k) => {
    let cls = 'popt';
    if (crossed.has(k)) cls += ' out';
    else if (pick && k === pick.picked) cls += pick.correct ? ' right' : ' wrong out fresh';
    else if (right === k) cls += ' right';
    const st = pick && fresh && k === pick.picked ? ' style="--t:250ms"' : '';
    return `<button class="${cls}"${st} data-act="move" ${mv(k)}${dis(k) ? ' disabled' : ''} aria-label="${letters[k]}: ${esc(patSay(it))}${crossed.has(k) || (pick && !pick.correct && k === pick.picked) ? ' (crossed out)' : ''}"><b>${letters[k]}</b>${patSvg(it)}</button>`;
  }).join('');
}
// Race mode (core/race.js, `rv: 2`): each player their own puzzles. This phone's board large (its own puzzle, options,
// cross-outs, its score to the goal), the other player's small under it (their score as pips, their puzzle, its options
// small with their cross-outs; never the right one while it is open). Their move plays on their board from its flash
// (the pick glowing or struck, a right one dropping into the gap), the result in this board's reserved line. A finished
// square: both boards, the right options shown.
function racePart(mini, p, a, o) {
  const part = (mini.side && mini.side[p]) || {}, t = a && a.pat && a.by === p ? a.pat : null;
  if (t) return { puz: t, crossed: t.crossed || [], pick: t, flash: true };
  if (o.view) {
    const won = part.last && part.last.correct && (mini.right[p] || 0) >= patCfg(mini).goal;
    if (won) return { puz: part.last, crossed: part.last.crossed || [], right: part.last.right, solved: true };
    return { puz: part.puz, crossed: part.crossed || [], right: mini.tg && Number.isInteger(mini.tg[p]) ? mini.tg[p] : null };
  }
  if (o.done && o.dby === p && part.last) return { puz: part.last, crossed: part.last.crossed || [], pick: part.last };   // this phone's own pick, held until Board
  return { puz: part.puz, crossed: part.crossed || [] };
}
function patternsRace(mini, a, o) {
  const me = raceMe(), them = raceThem(), goal = patCfg(mini).goal, turn = o.turn;
  const t = a && a.pat ? a.pat : null, W = p => `<b class="${p}">${N(p)}</b>`;
  const tally = p => pips(p, Math.min(goal, mini.right[p]), goal, !!(t && t.correct && a.by === p), 250);
  const mp = racePart(mini, me, a, o), myTurn = !o.view && turn === me;
  let body = '<p class="arcnote">No puzzle here.</p>', left = 0;
  if (mp.puz && Array.isArray(mp.puz.opts)) {
    const crossed = new Set(mp.crossed), pick = mp.pick, solved = pick && pick.correct ? mp.puz.opts[pick.right] : mp.solved ? mp.puz.opts[mp.right] : null;
    left = mp.puz.opts.length - crossed.size;
    body = `<div class="patterns">${cardHtml(mp.puz, seqHtml(mp.puz, solved, mp.flash ? 250 : null))}<div class="popts">${optsHtml(mp.puz, crossed, pick, !!mp.flash, k => !!pick || o.locked || !myTurn || crossed.has(k), mp.right)}</div></div>`;
  }
  const res = t && a.by === me ? `<p ${lateAt('arcres ' + (t.correct ? 'ok' : 'no'), 250)} role="status">${t.correct ? 'Right!' : t.picked < 0 ? 'Time\'s up' : t.auto ? 'Time\'s up: one crossed out' : 'Wrong: crossed out'}</p>`
    : t ? `<p ${lateAt('arcres ' + (t.correct ? 'ok' : 'no'), 250)} role="status">${W(a.by)} ${t.correct ? 'got it' : t.picked < 0 || t.auto ? 'ran out of time' : 'got it wrong'}</p>`
    : mp.pick ? `<p class="arcres ${mp.pick.correct ? 'ok' : 'no'}">${mp.pick.correct ? 'Right!' : 'Wrong: crossed out'}</p>`
    : `<p class="arcnote">${o.view ? '' : turn === me ? `Your turn · ${left} option${left === 1 ? '' : 's'} left` : `${W(turn)}'s turn`}</p>`;
  const mine = `<div class="g-arc trq ptq"><div class="ctals col">${arcTally(me, o, tally(me))}</div>${body}${res}</div>`;
  // the other player's board: their puzzle small, its options as chips
  const tp = racePart(mini, them, a, o), late = !!(t && a.by === them);
  let theirs = '<div class="trqopp"></div>';
  if (tp.puz && Array.isArray(tp.puz.opts)) {
    const crossed = new Set(tp.crossed), pick = tp.pick, solved = pick && pick.correct ? tp.puz.opts[pick.right] : tp.solved ? tp.puz.opts[tp.right] : null;
    const seq = tp.puz.seq.map(it => (it ? `<span class="ptqit">${patSvg(it)}</span>` : solved ? `<span ${lateAt('ptqit gap filled', late ? 250 : null)}>${patSvg(solved)}</span>` : '<span class="ptqit gap"><b>?</b></span>')).join('');
    const chips = tp.puz.opts.map((it, k) => {
      let cls = 'ptqo';
      if (crossed.has(k)) cls += ' out';
      else if (pick && k === pick.picked) cls += (pick.correct ? ' right' : ' wrong') + (late ? ' late' : '');
      else if (tp.right === k) cls += ' right';
      return `<i class="${cls}"${pick && late && k === pick.picked ? ' style="--t:250ms"' : ''}>${patSvg(it)}</i>`;
    }).join('');
    theirs = `<div class="trqopp up ptqopp"><div class="ptqseq" style="--n:${tp.puz.seq.length}" aria-label="Their sequence">${seq}</div><div class="ptqos">${chips}</div></div>`;
  }
  return raceBoards(mine, theirs, tally(them), { cls: 'trqb' });
}
// The miniature: each player's patterns got as pips, and the puzzle's sequence with its gap (dashed). A sequence of
// numbers shows only the gap and the two next to it, each number as large as the board's other text; shapes and dots
// show the whole sequence. A race: each player's progress side by side (raceArt).
// A race miniature's picture for p: their right picks as pips to the goal, a sequence card (two items and the gap,
// ticked when done) and the current puzzle's wrong tries as red marks (public: never a pick's place or the answer).
function raceArt(mini, p, goal) {
  const part = (mini.side && mini.side[p]) || {}, n = part.puz && Array.isArray(part.puz.opts) ? part.puz.opts.length : 4;
  const right = Math.min(goal, mini.right[p] || 0), wrong = (part.crossed || []).length, done = right >= goal;
  const gx = k => 20 + (k - (goal - 1) / 2) * 9, tx = k => 20 + (k - (n - 2) / 2) * 8;
  return `<svg class="trqm ptqm ${p}" viewBox="0 0 40 46" aria-hidden="true">${Array.from({ length: goal }, (_, k) => `<circle class="${k < right ? 'tqon' : ''}" cx="${gx(k)}" cy="5" r="3.6"/>`).join('')}`
    + `<rect class="tqc${done ? ' tqw' : ''}" x="5" y="13" width="30" height="18" rx="3"/>${done ? '<path class="tqk" d="M14 22.5l4 4 8-8.5"/>' : '<circle class="tqi" cx="12" cy="22" r="3.2"/><circle class="tqi" cx="20" cy="22" r="3.2"/><rect class="tqg" x="25" y="18" width="7" height="8" rx="1.5"/>'}`
    + `${done ? '' : Array.from({ length: n - 1 }, (_, k) => `<rect class="tqt${k < wrong ? ' tqno' : ''}" x="${tx(k) - 3}" y="36" width="6" height="6" rx="1.5"/>`).join('')}</svg>`;
}
export function miniature(mini, final) {
  if (mini.race) {
    const goal = patCfg(mini).goal;
    if (raceOld(mini)) return '<div class="tpat"></div>';
    return raceThumb(p => raceArt(mini, p, goal), 'trqt', `Patterns race: ${['X', 'O'].map(p => `${p} ${mini.right[p]} of ${goal}`).join(', ')}`);
  }
  const pz = mini.puz || (mini.last ? { seq: mini.last.seq } : null);
  let seq = pz ? pz.seq : [];
  const nums = seq.some(it => it && 'n' in it);
  if (nums && seq.length > 3) { const g = Math.max(0, seq.indexOf(null)), at = Math.max(0, Math.min(seq.length - 3, g === 0 ? 0 : g - 2)); seq = seq.slice(at, at + 3); }
  const cell = it => (!it ? '<span class="q"></span>' : 'n' in it ? `<span class="n">${esc(String(it.n))}</span>` : `<span>${patSvg(it)}</span>`);
  const row = p => `<div class="tr ${p}"><b class="${p}">${p}</b>${Array.from({ length: patCfg(mini).goal }, (_, k) => `<i class="${k < mini.right[p] ? 'on' : ''}"></i>`).join('')}</div>`;
  return `<div class="tpat">${row('X')}${row('O')}${seq.length ? `<div class="tseq${nums ? ' tnums' : ''}">${seq.map(cell).join('')}</div>` : ''}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = patternsTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d, dby: d ? d.by : null }); return g;
}
export function moveText(f, who) {
  return f.pat ? (f.pat.correct ? `${who} got the pattern` : `${who} picked wrong · crossed out`) : `${who} picked`;
}
export function sounds(f, add, won, mini, last) {
  const t = f.pat; if (t) add(t.correct ? 'ding' : 'thud', 250); return;   // the pick glows (and drops into the gap) or is struck through
}
