// Number Shuffle: the screen, the miniature, the move's words and sounds, and this phone's guess.
// The card: what is known so far ("Between 23,145 and 31,254"), the slots of the guess being made, the digits to
// tap into them (a tap on a filled slot takes its digit back), Clear and Guess. Under it the guesses so far with their
// answers (Higher / Lower / the hit): a column each in a race, one list for both in Shared, the newest first. A guess
// plays as its digits sliding into the slots one after the other (NS.slide), then its answer (NS.say) landing in the
// list. Only the guess is sent, never the arranging before it.
import { NS, nsCfg, nsRange, nsShowMs, nsVal } from './rules.js';
import { SND, ownPress } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { haptic } from '../../net/platform.js';
import { blocked, mySide } from '../../net/room.js';
import { esc, mv, state } from '../../ui/app.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { render } from '../../ui/render.js';
import { tok } from '../../ui/tok.js';

export const ownLine = true;
export const replay = { synth: () => [] };                         // the guess plays from the move: its digits slide in, then the answer
let draft = null;                                                  // this phone's guess being arranged: { sq, p, k (guesses so far), o: [digits] }
const draftOf = (sq, p, mini) => (draft && draft.sq === sq && draft.p === p && draft.k === mini.g.length ? draft : null);
const live = () => { const sq = state.squares && state.squares[state.zoom], m = sq && sq.mini; return m && m.type === 'numbers' && !sq.owner && !state.flash && !state.done && !blocked() ? m : null; };
function here() { const m = live(); if (!m) return null; let d = draftOf(state.zoom, state.turn, m); if (!d) d = draft = { sq: state.zoom, p: state.turn, k: m.g.length, o: [] }; return { m, d }; }
export const actions = {
  'ns-d': el => { const h = here(); if (!h) return; ownPress(); const v = Number(el.dataset.v); if (h.d.o.includes(v) || h.d.o.length >= h.m.d.length) return; h.d.o.push(v); SND.play('rtTick', { rate: 1 + h.d.o.length * 0.06 }); haptic('tap'); render(); },
  'ns-s': el => { const h = here(); if (!h) return; ownPress(); const k = Number(el.dataset.k); if (!(k >= 0 && k < h.d.o.length)) return; h.d.o.splice(k, 1); SND.play('cardSlide'); haptic('tap'); render(); },
  'ns-clr': () => { const h = here(); if (!h || !h.d.o.length) return; ownPress(); h.d.o = []; SND.play('cardSlide'); render(); },
};
const fmt = v => v.toLocaleString('en-US');
const ANS = { hi: ['Higher', '▲'], lo: ['Lower', '▼'], eq: ['Got it!', '✓'] };
const row = (e, cls, at) => `<li ${lateAt(`nsg ${e.r} by${e.by}${cls || ''}`, at)}><span class="nsgn">${e.o.join('')}</span><span class="nsga"><i aria-hidden="true">${ANS[e.r][1]}</i>${ANS[e.r][0]}</span></li>`;
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  if (mini.v !== 2) return '<div class="g-ns"><p class="nsline">This square is from an older version.</p></div>';
  const c = nsCfg(mini), s = a && a.ns ? a.ns : null, o = { view, locked, turn }, n = mini.d.length;
  const mine = !view && !locked && !s && !d, dr = mine ? draftOf(state.zoom, turn, mini) : null, cur = dr ? dr.o : [];
  const me = c.mode === 'shared' ? turn : (mySide() || turn);      // whose hidden number the range line is about (this phone's own in a race)
  const say = s ? nsShowMs(s) : 0;
  // what is known (before the move on show lands: its answer comes with it)
  const before = s ? Object.assign({}, mini, { g: mini.g.slice(0, s.k) }) : mini;
  const rg = nsRange(before, c.mode === 'shared' ? turn : me), lo = rg.all[rg.lo], hi = rg.all[rg.hi];
  const known = !rg.left ? '' : rg.left === rg.all.length ? `Somewhere from ${fmt(nsVal(rg.all[0]))} to ${fmt(nsVal(rg.all[rg.all.length - 1]))}` : rg.left === 1 ? `It must be ${fmt(nsVal(lo))}` : `Between ${fmt(nsVal(lo))} and ${fmt(nsVal(hi))}`;
  // the slots: the move on show sliding in, or this phone's draft
  const shown = s ? s.o : cur;
  const slots = Array.from({ length: n }, (_, k) => {
    const v = shown[k];
    if (s) return `<span ${lateAt(`nsslot full ${s.by}`, NS.slide * k)}>${v}</span>`;
    return v != null && mine ? `<button class="nsslot full ${turn}" data-act="ns-s" data-k="${k}" aria-label="Take back ${v}">${v}</button>` : `<span class="nsslot"></span>`;
  }).join('');
  const digits = mini.d.map(v => `<button class="nsdig" data-act="ns-d" data-v="${v}"${mine && !cur.includes(v) ? '' : ' disabled'} aria-label="${v}">${v}</button>`).join('');
  const full = mine && cur.length === n;
  const btns = view ? '' : `<div class="cbtns two"><button class="big" data-act="ns-clr"${mine && cur.length ? '' : ' disabled'}>Clear</button><button class="big ${turn}" data-act="move" ${mv(full ? { o: cur.slice() } : null)}${full ? '' : ' disabled'}>Guess</button></div>`;
  // the guesses: the newest first, the one on show landing with its answer
  const fixList = c.mode === 'shared'
    ? `<ol class="nslist one">${mini.g.map((e, i) => ({ e, i })).reverse().map(({ e, i }) => row(e, '', s && i === s.k ? say : null)).join('')}</ol>`
    : (() => ['X', 'O'].map(p => { const es = mini.g.map((e, i) => ({ e, i })).filter(x => x.e.by === p).reverse(); return `<div class="nscol ${p}">${tok(p)}<ol class="nslist">${es.map(({ e, i }) => row(e, '', s && i === s.k ? say : null)).join('')}</ol></div>`; }).join(''))();   // (a race: a column each, the one on show found by its place)
  const res = s ? `<p ${lateAt('nsline ' + s.r, say)} role="status">${s.r === 'eq' ? 'Spot on!' : `${ANS[s.r][0]} than ${fmt(nsVal(s.o))}`}${s.other ? ` <small>· theirs was ${s.other.join('')}</small>` : ''}</p>`
    : `<p class="nsline">${esc(known)}</p>`;
  const tal = p => arcTally(p, o, `<span class="nscount">${mini.g.filter(e => e.by === p).length}<small> guess${mini.g.filter(e => e.by === p).length === 1 ? '' : 'es'}</small></span>`);
  return `<div class="g-ns pc-${s ? s.by : turn} ${c.mode}" style="--n:${n}"><div class="ctals">${tal('X')}${tal('O')}</div>${res}<div class="nsslots">${slots}</div><div class="nsdigs">${digits}</div>${btns}<div class="nslists">${fixList}</div></div>`;
}
// The miniature: each player's hidden number as a bar of what is still possible, narrowing as the guesses close in
// (one bar in Shared), under their marks.
export function miniature(mini, final) {
  if (mini.v !== 2) return '<div class="tnsw"></div>';
  const c = nsCfg(mini), bar = (p, x) => {
    const r = nsRange(mini, p), tot = r.all.length, y0 = 8 + 48 * (r.lo / tot), y1 = 8 + 48 * ((r.hi + 1) / tot);
    return `<rect class="tnsb" x="${x}" y="8" width="14" height="48" rx="3"/><rect class="tnsf ${c.mode === 'shared' ? 'S' : p}" x="${x}" y="${y0.toFixed(1)}" width="14" height="${Math.max(2, y1 - y0).toFixed(1)}" rx="2"/>`;
  };
  const art = c.mode === 'shared' ? bar('X', 23) : bar('X', 12) + bar('O', 34);
  return `<div class="tnsw" aria-label="Number Shuffle: ${mini.g.length} guesses"><svg viewBox="0 0 60 60" aria-hidden="true">${art}</svg></div>`;
}
export function moveText(f, who) { const s = f.ns; return !s ? `${who} guessed` : s.r === 'eq' ? `${who} found the number` : `${who} guessed ${s.o.join('')}: ${ANS[s.r][0].toLowerCase()}`; }
// A tick as each digit slides in, then the answer: a rising or falling blip, or the chime of the hit.
export function sounds(f, add, won, mini, last) {
  const s = f.ns; if (!s) return;
  s.o.forEach((x, k) => add('rtTick', NS.slide * k, 1 + k * 0.06));
  add(s.r === 'eq' ? 'solve' : s.r === 'hi' ? 'ding' : 'thud', nsShowMs(s));
}
