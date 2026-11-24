// Number Shuffle: the screen, the miniature, the move's words and sounds, and this phone's guess.
// The card: what is known so far ("Between 23,145 and 31,254"), the slots of the guess being made, the digits to
// tap into them (a tap on a filled slot takes its digit back), Clear and Guess. Under it the guesses so far as a number
// line (December 2026, the owner's ask): sorted by value, the highest at the top, each with its answer as an arrow chip
// (Lower ▼ above the hidden number, Higher ▲ below it, both pointing at it), and between the lowest "lower" and the
// highest "higher" the marker "Mystery number is here" (at an end while a side has no guess yet; the hit takes its place
// once found). A column each in a race (each their own hidden number), one list for both in Shared (each row with its
// guesser's mark). The list keeps its marker in view: past its room it slides inside its own box, centred on the
// marker (pure CSS from the item count and the marker's place: `--rn`, `--f`). A guess plays as its digits sliding into
// the slots one after the other (NS.slide), then its answer (NS.say): the new row drops into its sorted place, the rows
// below and the marker sliding down to make room, the window following (NS.sort, inside flashMs's hold).
// Only the guess is sent, never the arranging before it.
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
// A list's layout: the guesses ({ e, i }: i its place in mini.g) highest first, with the marker ('m') in the gap after the
// last "lower" (the hidden number is under every lower and over every higher), none once the hit is in; `f` the place to
// keep in view (the marker, or the hit).
export function nsLayout(es) {
  const rows = es.slice().sort((a, b) => nsVal(b.e.o) - nsVal(a.e.o)), hit = rows.findIndex(x => x.e.r === 'eq');
  const items = rows.map(x => ({ k: x.i, x })), m = rows.filter(x => x.e.r === 'lo').length;
  if (hit < 0) items.splice(m, 0, { k: 'm' });
  return { items, f: hit < 0 ? m : hit };
}
const MARK = '<li class="nsit nsmark{C}" style="--i:{I}{I0}" aria-label="The mystery number is here"><span class="nsmk" aria-hidden="true">?</span><span class="nsmt">Mystery number is here</span></li>';
// One list: `es` the guesses after the move on show (if any: `s`, landing at `say`), `by` the guesser's mark on each row (Shared).
function listHtml(es, s, say, by) {
  const A = nsLayout(es), nw = s && es.some(x => x.i === s.k), B = nw ? nsLayout(es.filter(x => x.i !== s.k)) : null;
  const was = k => { if (!B) return -1; return B.items.findIndex(y => y.k === k); };
  const items = A.items.map((y, i) => {
    const i0 = was(y.k), mv = nw && i0 >= 0 && i0 !== i ? ' mv' : '', fresh = nw && y.k === s.k ? ' nw' : '', i0s = mv ? `;--i0:${i0}` : '';
    if (y.k === 'm') return MARK.replace('{C}', mv).replace('{I}', i).replace('{I0}', i0s);
    const e = y.x.e, [w, ar] = ANS[e.r];
    return `<li class="nsit nsg ${e.r} by${e.by}${mv}${fresh}" style="--i:${i}${i0s}" aria-label="${e.o.join('')}: ${w}">${by ? tok(e.by, 'nsgt') : ''}<span class="nsgn">${e.o.join('')}</span><span class="nsch ${e.r}" aria-hidden="true"><i>${ar}</i>${w}</span></li>`;
  });
  if (B && !A.items.some(y => y.k === 'm')) { const mi = was('m'); if (mi >= 0) items.push(MARK.replace('{C}', ' out').replace('{I}', mi).replace('{I0}', '')); }   // (the hit found: the marker fades where it was as the hit lands there)
  const moved = B && (B.f !== A.f || B.items.length !== A.items.length);
  return `<div class="nsbox"><ol class="nstrack${moved ? ' mv' : ''}" style="--rn:${A.items.length};--f:${A.f}${moved ? `;--rn0:${B.items.length};--f0:${B.f}` : ''}${nw ? `;--t:${Math.round(say)}ms` : ''}">${items.join('')}</ol></div>`;
}
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
  // the guesses: by value, highest first, the marker in the gap; the one on show dropping into its place with its answer
  const withI = mini.g.map((e, i) => ({ e, i }));
  const fixList = c.mode === 'shared'
    ? `<div class="nscol one">${listHtml(withI, s, say, true)}</div>`
    : ['X', 'O'].map(p => `<div class="nscol ${p}">${tok(p)}${listHtml(withI.filter(x => x.e.by === p), s, say, false)}</div>`).join('');   // (a race: a column each, their own hidden number's list)
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
