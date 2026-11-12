// Backgammon Lite: the screen, the miniature, the move's words and sounds, and the inputs.
import { BGL, BGLT, bglCan, bglDice, bglHome, bglMoves, bglStep, bglTimes, bglTo, bglV2 } from './rules.js';
import { N, REDUCED, mv, state, waitLine, zoomedType } from '../../ui/app.js';
import { dieFace } from '../../ui/art.js';
import { DIE_BOUNCE, die3d } from '../../ui/dice.js';
import { fxAttr } from '../../ui/fx.js';
import { arcTally, lateAt, pips } from '../../ui/progress.js';
import { markSvgG, pipRows, tokSvg } from '../../ui/thumbs.js';
import { render } from '../../ui/render.js';
import { rep, repActive, repNote } from '../../ui/replay.js';
import { flashAnimating, skipFlash } from '../../ui/turns.js';
import { attemptMove } from '../../net/moves.js';
import { blocked } from '../../net/room.js';
import { haptic } from '../../net/platform.js';
import { SND } from '../../audio/sound.js';
import { ANIM } from '../../core/timer.js';

// The board: a wooden frame round the track's n points in a row, with a tray at each end: the left one holds O's pieces
// borne off (and, on a square from before, X's waiting to start at its top), the right one X's off (O's waiting). Each
// tray carries its owner's mark and a socket for each piece still to come; each side's home zone (its last points) is
// tinted in its colour over a band along the bottom. X travels left to right, O right to left (the marks and arrows
// under the board). Pieces stack up from the bottom of their point (one side to a point: a lone enemy is hit, two
// block). The dice are the shared 3-D die (ui/dice.js), thrown in under the board. The turn before is marked while
// nothing is under way: a ring on each piece it moved and a ghost where each came from. A hit bursts where it lands; a
// side with every piece off: its tray is framed in gold and its pieces hop. Every piece has a cell (column, slot of 6) worked out from the positions alone (bglCells),
// so a move is drawn as the change between the cells before and after it: the piece slides, a hit piece flies home
// after it lands, a piece borne off slides into its tray. A piece that moves several times in one turn slides once
// for each step, one after the other (a wrapper a step, nested: hops).
// The move flow (November 2026, the backgammon-app way): after the roll the dice show (four for a double) and every
// piece that can move glows; a tap on one picks it (one piece alone that can move is picked already) and a ring shows
// on each point it can reach, labelled with the die it would use (one ring a die; bearing off: a ring in the tray, the
// smallest die that does it); a tap on a ring plays that step here at once: the piece slides, its die greys, the
// pieces that can move glow again for the dice left. A die no piece can use is crossed out, the line under the dice
// saying so ("No move for the 6"). Undo takes back the steps of this turn, one choice at a time (any forced step
// after it with it). A step that is the only one possible plays itself after a short beat (BGLV.auto). Once no die
// is left that a piece can use, the whole turn goes in as one move ({ steps }: rules.js bglTurn) a beat after its last
// slide (BGLV.commit; Undo still open until then). Its flash then shows nothing new here: the steps have played
// (seenOf: straight to its result). A timeout before that plays nothing: the draft is never sent.
// Someone else's turn replays the same way: their taps (logged as they made them: the piece picked, the ring, Undo,
// a step that played itself) pressed in turn through the same draft (replay.input), the computer's from its move
// (replay.synth); a flash that no draft has shown (a reload, a turn from an older client) plays its steps one after
// the other from the flash itself.
const SLOTS = 6;
export const BGLV = { auto: 400, commit: 450 };   // ms at the game's pace: a forced step's beat before it plays; the beat after the last slide before the turn goes in
// The turn being played on this phone (or replayed): { sq, p, sig (the square as the turn found it), steps: [{ d, k, auto }],
// pick (the piece picked), at (when the last step or undo began), from (the cells before it), hit (the piece it hit),
// off, done (sent), rep (the replay it shows), autoFor, commitT }.
export let bglDraft = null;
const sigOf = mini => JSON.stringify([mini.pos, mini.dice]);
const keyOf = steps => steps.map(s => (Array.isArray(s) ? s : [s.d, s.k]).join('.')).join(',');
const other = p => (p === 'X' ? 'O' : 'X');
const clonePos = pos => ({ X: pos.X.slice(), O: pos.O.slice() });
function cloneMini(mini) { return { type: mini.type, v: mini.v, tune: mini.tune, n: mini.n, rolled: mini.rolled, pos: clonePos(mini.pos), dice: mini.dice ? JSON.parse(JSON.stringify(mini.dice)) : null }; }
// The square with the draft's steps played.
function played(mini, dr) { const c = cloneMini(mini); for (const s of dr.steps) bglStep(c, dr.p, s.d, s.k); return c; }
const allOff = (c, p) => c.pos[p].every(a => a > c.n);
const optsOf = (c, p) => (c.dice && c.dice.by === p && !allOff(c, p) ? bglMoves(c, p) : []);
// The piece a tap on a stack moves: its top one (the last index at that place; pieces alike move alike).
function topAt(c, p, a) { let k = -1; c.pos[p].forEach((x, j) => { if (x === a) k = j; }); return k; }
// Where piece k can go: one place a die value, { d, v, to }; bearing off by several dice: the smallest.
function dests(c, p, k) {
  const dc = c.dice, out = [], seen = new Set();
  const order = dc.v.map((v, d) => d).filter(d => !dc.used[d] && dc.v[d]).sort((a, b) => dc.v[a] - dc.v[b]);
  for (const d of order) {
    const v = dc.v[d];
    if (seen.has(v)) continue; seen.add(v);
    if (!bglCan(c, p, k, v)) continue;
    const to = bglTo(c, p, c.pos[p][k], v);
    if (to > c.n && out.some(x => x.to > c.n)) continue;
    out.push({ d, v, to });
  }
  return out;
}
// The dice still unused that no piece can use now.
const deadOf = (c, ms) => (c.dice ? c.dice.v.map((v, d) => d).filter(d => c.dice.v[d] && !c.dice.used[d] && !ms.some(x => c.dice.v[x.d] === c.dice.v[d])) : []);
function deadLine(v, ds) {
  if (!ds.length) return '';
  const vals = ds.map(d => v[d]);
  if (v.length === 4) return `No move for the ${vals[0]}${ds.length > 1 ? 's' : ''} left`;
  return ds.length > 1 ? `No move for the ${vals[0]} or the ${vals[1]}` : `No move for the ${vals[0]}`;
}
function newDraft(sq, p, mini, r) { return { sq, p, sig: sigOf(mini), steps: [], pick: null, at: null, from: null, hit: null, off: false, done: false, rep: r || null, autoFor: -1, commitT: null }; }
// A step added to the draft (a tap on a ring, a forced step, or a replayed one): false if it is not legal there.
function addStep(dr, mini, d, k, auto) {
  const c = played(mini, dr);
  if (!c.dice || !(d >= 0 && d < c.dice.v.length) || c.dice.used[d] || !c.dice.v[d] || !(k >= 0 && k < BGL.pieces) || allOff(c, dr.p) || !bglCan(c, dr.p, k, c.dice.v[d])) return false;
  dr.from = bglCells(c.pos, c.n);
  const res = bglStep(c, dr.p, d, k);
  dr.steps.push({ d, k, auto: !!auto }); dr.at = performance.now(); dr.pick = null;
  dr.hit = res.hit ? other(dr.p) + res.hit.k : null; dr.off = res.to > c.n;
  const S = ANIM.speed || 1, at = ms => ({ at: ms / 1000 / S });
  SND.play('pieceSlide');
  SND.play('clack', at(BGLT.slide - 60));
  if (res.hit) SND.play('thud', at(BGLT.slide + 40));
  if (dr.off) SND.play('ding', at(BGLT.slide - 80));
  clearTimeout(dr.buzzT); dr.buzzT = null;
  if (!dr.rep && (res.hit || dr.off)) dr.buzzT = setTimeout(() => { dr.buzzT = null; haptic('medium'); }, (BGLT.slide - 40) / S);   // (this phone's own step: a hit or a piece off buzzes as it lands)
  return true;
}
// Undo: the steps back to before the last one chosen (the forced ones after it go with it).
function undoStep(dr, mini) {
  if (!dr.steps.some(s => !s.auto)) return false;
  const c = played(mini, dr);
  while (dr.steps.length && dr.steps[dr.steps.length - 1].auto) dr.steps.pop();
  dr.steps.pop();
  dr.from = bglCells(c.pos, c.n); dr.at = performance.now(); dr.hit = null; dr.off = false; dr.pick = null;
  clearTimeout(dr.commitT); dr.commitT = null; clearTimeout(dr.buzzT); dr.buzzT = null;
  SND.play('swish');
  return true;
}
// This phone may play its draft now (its turn, in its square, nothing playing or on its way).
function canAct(dr) {
  if (!dr || dr.done || dr.rep || bglDraft !== dr || zoomedType() !== 'bglite' || state.zoom !== dr.sq || state.turn !== dr.p || blocked() || repActive()) return false;
  const sq = state.squares[dr.sq];
  return !!sq && sigOf(sq.mini) === dr.sig;
}
const pace = ms => ms / (ANIM.speed || 1);
// After a step here: once no die is left to use, the turn goes in a beat after its slide.
function afterStep(dr, mini) {
  const c = played(mini, dr);
  if (optsOf(c, dr.p).length) return;
  clearTimeout(dr.commitT);
  dr.commitT = setTimeout(() => { dr.commitT = null; send(dr); }, pace(BGLT.slide + (dr.hit ? BGLT.hit : 0) + BGLV.commit));
}
function send(dr) {
  if (!canAct(dr)) return;
  dr.done = true;
  const r = attemptMove({ steps: dr.steps.map(s => [s.d, s.k]) });
  if (r && typeof r === 'object' && r.ok === false) { dr.done = false; dr.steps = []; dr.from = null; dr.at = null; render(); }   // (refused here: the turn from its start again)
}
// A forced step (the only one possible) plays itself after a beat, once the slide before it has landed.
function armAuto(dr, mini, ms) {
  if (dr.rep || dr.done || dr.commitT || ms.length !== 1 || dr.autoFor === dr.steps.length) return;
  dr.autoFor = dr.steps.length;
  const n = dr.steps.length, left = dr.at == null ? 0 : Math.max(0, dr.at + pace(BGLT.slide + (dr.hit ? BGLT.hit : 0)) - performance.now());
  setTimeout(() => {
    if (!canAct(dr) || dr.steps.length !== n) { if (dr.autoFor === n && dr.steps.length === n) dr.autoFor = -1; return; }   // (not now: the next look at the square arms it again)
    const sq = state.squares[dr.sq], c = played(sq.mini, dr), now = optsOf(c, dr.p);
    if (now.length !== 1) return;
    const x = now[0], k = topAt(c, dr.p, c.pos[dr.p][x.k]);
    if (!addStep(dr, sq.mini, x.d, k, true)) return;
    repNote('bglauto', `n=${x.d}.${k}`);                          // (the other side's replay plays it too)
    afterStep(dr, sq.mini);
    render();
  }, left + pace(BGLV.auto));
}
// Each piece's cell: { 'X0': [col, slot], ... } for positions pos on a track of n points.
export function bglCells(pos, n) {
  const out = {};
  for (const p of ['X', 'O']) {
    const groups = new Map();
    pos[p].forEach((a, k) => { if (!groups.has(a)) groups.set(a, []); groups.get(a).push(k); });
    for (const [a, ks] of groups) ks.forEach((k, i) => {
      let col, slot;
      if (a <= 0) { col = p === 'X' ? 0 : n + 1; slot = i; }                          // waiting at the start: the zone's top
      else if (a > n) { col = p === 'X' ? n + 1 : 0; slot = SLOTS - 1 - i; }          // borne off: the other zone's bottom
      else { col = p === 'X' ? a : n + 1 - a; slot = SLOTS - 1 - i; }                // on the track: up from the bottom
      out[p + k] = [col, slot];
    });
  }
  return out;
}
// Where a piece would land: [col, slot] (the next free slot up from the bottom of that point or tray).
function landing(mini, p, k, v) {
  const n = mini.n, to = bglTo(mini, p, mini.pos[p][k], v), col = to > n ? (p === 'X' ? n + 1 : 0) : (p === 'X' ? to : n + 1 - to);
  const there = mini.pos[p].filter((a, j) => j !== k && (to > n ? a > n : a === to)).length;
  return [col, SLOTS - 1 - there];
}
const cellStyle = (col, slot, c) => `left:${(col * 100 / c).toFixed(3)}%;top:${(slot * 100 / SLOTS).toFixed(3)}%;width:${(100 / c).toFixed(3)}%;height:${(100 / SLOTS).toFixed(3)}%`;
const piece = p => `<svg viewBox="-10 -10 20 20" aria-hidden="true"><ellipse class="bglsh" cx="0.7" cy="1.9" rx="8.9" ry="8.5"/><circle class="bglck" r="8.5"/><circle class="bglrim" r="6.2"/>${markSvgG(p, 3.3)}</svg>`;
const markSvg = p => `<svg class="bglmk ${p}" viewBox="-10 -10 20 20" aria-hidden="true">${markSvgG(p, 6)}</svg>`;
// When die d of a roll's dice lands (ms into the move): the last at BGLT.land, each one before it a little sooner.
export const bglLand = (d, n) => BGLT.land - (n - 1 - d) * BGLT.stag;
// The hops between two layouts of the cells: every piece whose cell changed slides at t (the hit one flies at flyT).
function addHops(H, a, b, t, flyKey, flyT, lookKey, lookT) {
  for (const key of Object.keys(b)) {
    const [c0, s0] = a[key], [c1, s1] = b[key];
    if (key === lookKey) (H[key] = H[key] || []).push({ look: true, t: lookT });
    if (c0 === c1 && s0 === s1) continue;
    (H[key] = H[key] || []).push({ dx: c0 - c1, dy: s0 - s1, t: key === flyKey ? flyT : t, fly: key === flyKey });
  }
}
// A piece drawn inside its hops (a fly innermost, so its lift scales nothing else).
function hopWrap(inner, hs) {
  if (!hs || !hs.length) return inner;
  const order = hs.filter(h => h.fly || h.look).concat(hs.filter(h => !h.fly && !h.look));
  for (const h of order) inner = h.look ? `<i class="bglh look" style="--t:${Math.round(h.t)}ms">${inner}</i>` : `<i class="bglh ${h.fly ? 'fly' : 'slide'}" style="--dx:${h.dx * 100}%;--dy:${h.dy * 100}%;--t:${Math.round(h.t)}ms">${inner}</i>`;
  return inner;
}
// A move's flash as a turn: the whole turn's (kind 'turn'), or one step from a square played by an older client
// (kind 'use') as a turn of one step, with its moments.
function turnOf(b) {
  if (!b || (b.kind !== 'turn' && b.kind !== 'use')) return null;
  if (b.kind === 'turn') return { b, T: bglTimes(b) };
  const used0 = b.used.slice(); used0[b.d] = false;
  const lost = b.lost ? b.used.map((u, d) => d).filter(d => !b.used[d] && b.v[d]) : [];
  const t = bglTimes(b), steps = [{ d: b.d, k: b.k, from: b.from, to: b.to, hit: b.hit, off: b.off }];
  return { b: { by: b.by, kind: 'turn', v: b.v, used0, steps, lost, pos: b.pos, again: b.again }, T: { steps: [{ at: 0, go: 0, land: t.slid, hitAt: t.hitAt }], slid: t.slid, offAt: b.off ? t.slid : null, deadAt: t.slid } };
}
// The flash already shown here, step by step: the turn this phone drafted and sent, or the replay that has just
// pressed its steps in (nothing to play again: straight to the result).
function seenOf(b, sq) {
  const dr = bglDraft;
  return !!(dr && b && b.kind === 'turn' && dr.sq === sq && dr.p === b.by && (dr.done || dr.rep) && dr.steps.length && keyOf(dr.steps) === keyOf(b.steps || []));
}
const skipped = new WeakSet();
function table(mini, a, o) {
  const b = a && a.bgl ? a.bgl : null, n = mini.n, c = n + 2, turn = o.turn;
  const r = rep && rep.stage === 'inputs' && rep.sq === o.zoom ? rep : null;
  // the draft: this phone's turn under way, or the replay's
  let dr = null;
  const cur = bglDraft;
  const fits = cur && cur.sq === o.zoom && cur.sig === sigOf(mini);
  if (b) { if (cur && !seenOf(b, o.zoom)) bglDraft = null; }
  else if (o.view || o.d) bglDraft = null;
  else if (r) { if (fits && cur.rep === r) dr = cur; }
  else if (!o.locked && bglDice(mini, turn)) {
    if (fits && !cur.rep && cur.p === turn) dr = cur;
    else { if (cur) clearTimeout(cur.commitT); dr = bglDraft = newDraft(o.zoom, turn, mini); }
    if (dr.done) { dr.done = false; dr.steps = []; dr.from = null; dr.at = null; dr.hit = null; }   // (sent and come back unplayed, refused: the turn from its start)
  } else if (fits && cur.done && !cur.rep) dr = cur;              // (sent, on its way: shown as played)
  else if (cur && !(cur.done && cur.sq === o.zoom)) bglDraft = null;
  const live = !!dr && !dr.done && (!!dr.rep || !o.locked);       // its controls (a replay: as the mover had them; the page takes no tap)
  const view = dr ? played(mini, dr) : mini;
  const me = live ? dr.p : null;
  const ms = me ? optsOf(view, me) : [];
  // the pieces that can move (every piece at a place one can move from), the one picked and where it can go
  const movable = new Map();                                       // place -> the piece a tap moves
  for (const x of ms) { const at0 = view.pos[me][x.k]; if (!movable.has(at0)) movable.set(at0, topAt(view, me, at0)); }
  let pick = dr && dr.pick != null && movable.has(view.pos[me][dr.pick]) ? movable.get(view.pos[me][dr.pick]) : null;
  if (pick == null && movable.size === 1) pick = [...movable.values()][0];   // (one piece alone can move: picked already)
  const to = me && pick != null ? dests(view, me, pick) : [];
  if (dr && !dr.rep && live) {
    armAuto(dr, mini, ms);
    if (!ms.length && dr.steps.length && !dr.commitT) afterStep(dr, mini);   // (the turn played out but not sent: it goes in now)
  }
  // the turn's flash: its steps (unless shown here already) and their moments
  const tt = turnOf(b), seen = !!(tt && seenOf(tt.b, o.zoom)), tb = tt ? tt.b : null, T = tt ? tt.T : null;
  if (seen && a && !skipped.has(a)) { skipped.add(a); setTimeout(() => { if (state.flash === a && flashAnimating()) skipFlash(); }, 0); }
  const anim = tt && !seen && !REDUCED;
  // the cells, and every piece's hops: the flash's steps one after the other, or the draft's latest step (or undo)
  const now = bglCells(view.pos, n), H = {};
  if (anim) {
    const q = other(tb.by), pos = clonePos(tb.pos), list = [clonePos(pos)];
    for (let i = tb.steps.length - 1; i >= 0; i--) { const s = tb.steps[i]; pos[tb.by][s.k] = s.from; if (s.hit) pos[q][s.hit.k] = s.hit.from; list.unshift(clonePos(pos)); }
    const cells = list.map(p => bglCells(p, n));
    tb.steps.forEach((s, i) => addHops(H, cells[i], cells[i + 1], T.steps[i].go, s.hit ? q + s.hit.k : null, T.steps[i].hitAt, tb.by + s.k, T.steps[i].at));
  } else if (dr && dr.from && dr.at != null && !REDUCED) addHops(H, dr.from, now, 0, dr.hit, BGLT.slide);
  const pickedKey = me && pick != null ? me + pick : null;
  // the turn before, marked while nothing is under way: a ring on each piece it moved, a ghost where each came from
  const lt = !b && !dr && mini.last && (mini.last.kind === 'turn' || mini.last.kind === 'use') && mini.last.pos ? turnOf(mini.last) : null;
  const lm = lt && JSON.stringify(lt.b.pos) === JSON.stringify(mini.pos) ? lt.b : null;
  const moved = new Set(lm ? lm.steps.map(s => lm.by + s.k) : []), ghosts = new Set();
  const trail = lm ? lm.steps.map((s, i) => {
    const [col, slot] = bglCells(stepPos(lm, i), n)[lm.by + s.k], at = col + '.' + slot;
    if (ghosts.has(at) || Object.values(now).some(x => x[0] === col && x[1] === slot)) return '';
    ghosts.add(at);
    return `<i class="bgltr ${lm.by}" style="${cellStyle(col, slot, c)}" aria-hidden="true"></i>`;
  }).join('') : '';
  // a side with every piece off: its pieces hop in its tray (as the last one lands, when a move is playing)
  const offOf = p => view.pos[p].filter(x => x > n).length;
  const champ = ['X', 'O'].find(p => offOf(p) >= BGL.pieces) || null;
  const champAt = !champ || REDUCED ? null : anim ? T.slid : dr && dr.at != null && dr.off ? BGLT.slide : null;
  const pieces = ['X', 'O'].flatMap(p => [0, 1, 2].map(k => {
    const key = p + k, [col, slot] = now[key], hs = H[key];
    let cls = `bglp ${p}${hs && hs.length ? ' mv' : ''}${moved.has(key) ? ' last' : ''}${p === champ ? ` won${champAt != null ? ' late' : ''}` : ''}`;
    const st = cellStyle(col, slot, c) + (p === champ && champAt != null ? `;--tw:${Math.round(champAt + k * 90)}ms` : ''), inner = hopWrap(piece(p), hs);
    if (p === me && movable.has(view.pos[p][k])) {
      const tk = movable.get(view.pos[p][k]);
      cls += ' can' + (pickedKey === p + tk && tk === k ? ' pick' : '');
      return `<button class="${cls}" style="${st}" data-act="bglpk" data-k="${tk}" aria-label="${pickedKey === p + tk ? 'Picked' : 'Pick this piece'}">${inner}</button>`;
    }
    return `<span class="${cls}" style="${st}">${inner}</span>`;
  })).join('');
  // a ring on each place the picked piece can reach, labelled with its die (a tap there plays it)
  const dieLab = v => `<b class="bglld">${dieFace(v)}</b>`;
  let rings = to.map(x => {
    const [col, slot] = landing(view, me, pick, x.v), off = x.to > n;
    return `<button class="bglg ${me}${off ? ' off' : ''}" style="${cellStyle(col, slot, c)}" data-act="bglto" data-n="${x.d}.${pick}" aria-label="${off ? 'Bear off' : 'Move'} with the ${x.v}"><i>${dieLab(x.v)}</i></button>`;
  }).join('');
  if (anim) rings += tb.steps.map((s, i) => {                       // (a turn played from its flash: each step's ring and die, from the pick to the landing)
    const [col, slot] = bglCells(stepPos(tb, i + 1), n)[tb.by + s.k], st = T.steps[i];
    return `<i class="bglg fl ${tb.by}${s.off ? ' off' : ''}" style="${cellStyle(col, slot, c)};--t:${Math.round(st.at)}ms;--d:${Math.max(1, Math.round(st.land - st.at))}ms" aria-hidden="true"><i>${dieLab(tb.v[s.d])}</i></i>`;
  }).join('');
  // a hit: a burst where the piece lands on the other's (the flash's steps, or the draft's latest)
  let bams = '';
  if (anim) bams = tb.steps.map((s, i) => { if (!s.hit) return ''; const [col, slot] = bglCells(stepPos(tb, i + 1), n)[tb.by + s.k]; return `<i class="bglbam" style="${cellStyle(col, slot, c)};--t:${Math.round(T.steps[i].hitAt)}ms" aria-hidden="true"></i>`; }).join('');
  else if (dr && dr.hit && dr.at != null && dr.steps.length && !REDUCED) { const [col, slot] = now[dr.p + dr.steps[dr.steps.length - 1].k]; bams = `<i class="bglbam" style="${cellStyle(col, slot, c)};--t:${BGLT.slide}ms" aria-hidden="true"></i>`; }
  const v2 = bglV2(mini), wd = (100 / c).toFixed(3);
  const pts = Array.from({ length: n }, (_, i) => `<i class="bglpt${i % 2 ? ' b' : ''}" style="left:${((i + 1) * 100 / c).toFixed(3)}%;width:${wd}%"></i>`).join('');
  // the trays: the left one O's, the right one X's, each with its owner's mark and a socket a piece (a square from before: plain, its top the other side's waiting pieces)
  const tray = (side, p) => `<i class="bglz ${side} ${p}${offOf(p) >= BGL.pieces ? ' full' : ''}" style="width:${wd}%">${v2 ? markSvg(p) : ''}</i>`;
  const sockets = v2 ? ['X', 'O'].map(p => [0, 1, 2].map(i => `<i class="bglso" style="${cellStyle(p === 'X' ? n + 1 : 0, SLOTS - 1 - i, c)}"></i>`).join('')).join('') : '';
  const zones = tray('l', 'O') + tray('r', 'X')
    + (v2 ? ['X', 'O'].map(p => { const h = bglHome(mini), from = p === 'X' ? n - h + 1 : 1; return `<i class="bglhm ${p}" style="left:${(from * 100 / c).toFixed(3)}%;width:${(h * 100 / c).toFixed(3)}%"></i>`; }).join('') : '');   // each side's home zone: its last points tinted in its colour over a band along the bottom
  const host = !b && dr && dr.at != null ? fxAttr(dr.at) : '';    // (the draft's step: its slide timed from the tap)
  const board = `<div class="bglw"><div class="bglb" style="--c:${c}"${host} role="img" aria-label="The track: ${n} points">${zones}${pts}${sockets}${trail}${pieces}${rings}${bams}</div></div>`;
  const arrows = `<div class="bglar" aria-hidden="true"><span class="X">${markSvg('X')}<svg viewBox="0 0 40 12"><path d="M2 6h33M29 1.5l6 4.5-6 4.5"/></svg></span><span class="O"><svg viewBox="0 0 40 12"><path d="M38 6H5M11 1.5L5 6l6 4.5"/></svg>${markSvg('O')}</span></div>`;
  // the dice: the roll's tumbling in; the turn's greying one by one as each is used (crossed: no move for it)
  const rollNow = b && b.kind === 'roll' && !REDUCED;
  let dd = null;
  if (b && b.kind === 'roll') dd = b.v.map((v, d) => ({ v, cls: (b.one && d === 1 ? ' used' : '') + (b.stuck ? ` dead${rollNow ? ' late' : ''}` : ''), roll: rollNow, t: b.stuck && rollNow ? BGLT.roll : null }));   // (no move for it: crossed out as the words come)
  else if (tb) {
    const spendAt = {}; tb.steps.forEach((s, i) => { spendAt[s.d] = T.steps[i].land; });
    dd = tb.v.map((v, d) => {
      if (tb.used0[d]) return { v, cls: ' used' };
      if (spendAt[d] != null) return anim ? { v, cls: ' spend', t: spendAt[d] } : { v, cls: ' used' };
      if (tb.lost.includes(d)) return anim ? { v, cls: ' dead late', t: T.deadAt } : { v, cls: ' dead' };
      return { v, cls: '' };
    });
  } else if (view.dice && view.dice.by === (dr ? dr.p : turn)) {
    const dead = dr && champ !== dr.p ? deadOf(view, optsOf(view, dr.p)) : [], last = dr && dr.steps.length && dr.at != null ? dr.steps[dr.steps.length - 1].d : null;
    dd = view.dice.v.map((v, d) => ({ v, cls: view.dice.used[d] ? (d === last && !REDUCED ? ' spend' : ' used') : dead.includes(d) ? ' dead' : (me && to.some(x => x.d === d) ? ' sel' : ''), t: d === last ? BGLT.slide : null }));
  }
  const nd = dd ? dd.filter(x => x.v).length : 0;                  // (the shared 3-D die: a roll's dice thrown in, landing one after the other)
  const dice = dd ? dd.map((x, d) => (x.v ? `<span class="bgldie${x.cls}"${x.t != null ? ` style="--ts:${Math.round(x.t)}ms"` : ''} role="img" aria-label="${x.v}${/used|spend/.test(x.cls) ? ', used' : /dead/.test(x.cls) ? ', no move' : ''}">${die3d(x.v, { roll: x.roll ? bglLand(d, nd) : 0, v: d })}</span>` : '')).join('') : '';
  const W = p => `<b class="${p}">${N(p)}</b>`;
  // the tallies: a pip a piece off, filling as the piece reaches its tray (a move playing, or the draft's step)
  const offAt = anim ? T.offAt : dr && dr.off && dr.at != null && !REDUCED ? BGLT.slide - 60 : null, offBy = anim ? tb.by : dr ? dr.p : null;
  const tal = p => arcTally(p, o, pips(p, offOf(p), BGL.pieces, offAt != null && offBy === p, offAt));
  let say = '', ok = '', sayAt = null;
  if (b && b.kind === 'roll') { if (b.stuck) ok = 'no'; say = b.stuck ? 'No move: the turn passes' : b.one ? `Opening roll: ${b.v[0]}` : b.v.length === 4 ? `Double ${b.v[0]}: four moves` : `${W(b.by)} rolled ${b.v[0]} and ${b.v[1]}`; sayAt = rollNow ? BGLT.roll : null; }
  else if (tb) {
    const hi = tb.steps.findIndex(s => s.hit), oi = tb.steps.findIndex(s => s.off);
    if (hi >= 0) { say = 'Hit! Back to the start'; ok = 'ok'; sayAt = T.steps[hi].hitAt; }
    else if (oi >= 0) { say = champ === tb.by ? 'Last piece off!' : tb.steps.filter(s => s.off).length > 1 ? 'Pieces off!' : 'A piece off!'; ok = 'ok'; sayAt = champ === tb.by ? T.slid : T.steps[oi].land; }
    else if (tb.lost.length) { say = deadLine(tb.v, tb.lost); sayAt = T.deadAt; }
    else if (tb.again) { say = 'Roll again'; sayAt = T.slid; }
    if (!anim) sayAt = null;
  } else if (dr) {
    if (dr.hit && dr.steps.length) { say = 'Hit! Back to the start'; ok = 'ok'; sayAt = dr.at != null && !REDUCED ? BGLT.slide : null; }   // (the draft's step: said as the piece lands)
    else if (dr.off && dr.steps.length) { say = champ === dr.p ? 'Last piece off!' : 'A piece off!'; ok = 'ok'; sayAt = dr.at != null && !REDUCED ? BGLT.slide - 60 : null; }
    else if (champ !== dr.p) say = deadLine(view.dice ? view.dice.v : [], deadOf(view, optsOf(view, dr.p)));
  }
  const res = say ? `<p ${lateAt('arcres ' + ok, sayAt)}${!tb && !b && sayAt != null ? host : ''} role="status">${say}</p>`
    : `<p class="arcnote">${o.view ? '' : o.locked && !dr ? waitLine(turn) : ''}</p>`;
  // the button: Roll, or, with the dice out, Undo (the same room)
  const inPlay = !!bglDice(mini, turn) || !!dr || !!tb;
  let btn = '';
  if (!o.view) btn = inPlay && !(b && b.kind === 'roll')
    ? `<div class="cbtns one"><button class="big bglundo" data-act="bglundo"${live && dr.steps.some(s => !s.auto) ? '' : ' disabled'}>Undo</button></div>`
    : `<div class="cbtns one"><button class="big ${turn}" data-act="move" ${mv('roll')}${o.locked || inPlay || b ? ' disabled' : ''}>Roll</button></div>`;
  const pc = tb ? tb.by : b ? b.by : dr ? dr.p : turn;
  return `<div class="g-arc g-bgl pc-${pc}"><div class="ctals"${host}>${tal('X')}${tal('O')}</div><div class="bgl" style="--c:${c}">${board}${arrows}<div class="bgldice"${host}>${dice}</div>${res}</div>${btn}</div>`;
}
// The positions after the first i steps of a turn's flash (its pos is after them all).
function stepPos(tb, i) {
  const q = other(tb.by), pos = clonePos(tb.pos);
  for (let j = tb.steps.length - 1; j >= i; j--) { const s = tb.steps[j]; pos[tb.by][s.k] = s.from; if (s.hit) pos[q][s.hit.k] = s.hit.from; }
  return pos;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  return table(mini, a, { view, locked, turn, zoom: state.zoom, f: !!f, d: !!d });
}
// The miniature: the board in its frame (the points, each side's home band, the two trays) with every piece on it,
// the ones borne off in their trays, and under it each player's pieces off as pips.
export function miniature(mini, final) {
  const n = mini.n, c = n + 2, cells = bglCells(mini.pos, n), W = c * 10, H = 36, hm = bglV2(mini) ? bglHome(mini) : 0;
  const pts = Array.from({ length: n }, (_, i) => { const x = (i + 1) * 10; return `<path class="tbglpt${i % 2 ? ' b' : ''}" d="M${x + 0.9} ${H}L${x + 5} 5 ${x + 9.1} ${H}z"/>`; }).join('');
  const bands = hm ? `<rect class="tbglh X" x="${(n - hm + 1) * 10}" y="${H - 2.6}" width="${hm * 10}" height="2.6"/><rect class="tbglh O" x="10" y="${H - 2.6}" width="${hm * 10}" height="2.6"/>` : '';
  const toks = ['X', 'O'].flatMap(p => [0, 1, 2].map(k => {
    const [col, slot] = cells[p + k], a = mini.pos[p][k];
    const y = a <= 0 ? 5.2 + slot * 8.6 : H - 5.2 - (SLOTS - 1 - slot) * 8.6;
    return tokSvg(p, col * 10 + 5, y, 4.3);
  })).join('');
  const art = `<svg class="tbgl" viewBox="-3 -3 ${W + 6} ${H + 6}" aria-hidden="true"><rect class="tbglf" x="-2" y="-2" width="${W + 4}" height="${H + 4}" rx="4"/><rect class="tbglz" x="0" y="0" width="${W}" height="${H}" rx="2"/><rect class="tbglb" x="10" y="0" width="${W - 20}" height="${H}"/>${pts}${bands}<path class="tbgle" d="M10 0V${H}M${W - 10} 0V${H}"/>${toks}</svg>`;
  const off = { X: mini.pos.X.filter(a => a > n).length, O: mini.pos.O.filter(a => a > n).length };
  return `<div class="tbglm" aria-label="Backgammon Lite: X has ${off.X} of 3 off, O has ${off.O} of 3 off">${art}<div class="tpip tbglp">${pipRows(off, BGL.pieces)}</div></div>`;
}
export function moveText(f, who) {
  const b = f.bgl;
  if (!b) return `${who} played`;
  const rolled = b.v.length === 4 ? `a double ${b.v[0]}` : b.v.filter(Boolean).join(' and ');
  if (b.kind === 'roll') return b.stuck ? `${who} rolled ${rolled}: no move` : `${who} rolled ${rolled}`;
  if (b.kind === 'turn') { const st = b.steps || []; return `${who} moved ${st.map(s => b.v[s.d]).join(', ')}${st.some(s => s.hit) ? ' and hit' : st.some(s => s.off) ? ' and bore a piece off' : ''}`; }
  return `${who} moved ${b.v[b.d]}${b.hit ? ' and hit' : b.off ? ' and bore a piece off' : ''}`;
}
// The roll: the rattle, a light click as the first die touches down, the thunk of the last (a thud for no move); each
// step: the piece's slide, its click as it lands, a hit's thump as the other piece flies home, a ding for a piece off
// (none for a turn already played here, step by step: seenOf).
export function sounds(f, add, won, mini, last) {
  const b = f.bgl;
  if (!b) return;
  if (b.kind === 'roll') { const n = b.v.filter(Boolean).length; add('rattle', 0); add('diceTap', Math.round(bglLand(0, n) * DIE_BOUNCE)); add('thunk', BGLT.land); if (b.stuck) add('thud', BGLT.roll); return; }
  const tt = turnOf(b);
  if (!tt || seenOf(tt.b, state.zoom)) return;
  tt.b.steps.forEach((s, i) => {
    const t = tt.T.steps[i];
    add('pieceSlide', t.go);
    add('clack', t.land - (s.off ? BGLT.off : 0) - 60);
    if (s.hit) add('thud', t.hitAt + 40);
    if (s.off) add('ding', t.land - 80);
  });
}
// A piece tapped: picked (its rings show), or let go (tapped again).
export function bglpkAct(el) {
  const dr = bglDraft, k = Number(el.dataset.k);
  if (!canAct(dr) || !(k >= 0 && k < BGL.pieces)) return;
  dr.pick = dr.pick === k ? null : k;
  SND.play('select');
  render();
}
// A ring tapped: that step played here (the turn goes in once no die is left to use).
export function bgltoAct(el) {
  const dr = bglDraft, m = /^(\d)\.(\d)$/.exec(el.dataset.n || '');
  if (!canAct(dr) || !m) return;
  const mini = state.squares[dr.sq].mini;
  if (!addStep(dr, mini, Number(m[1]), Number(m[2]), false)) { SND.play('error'); return; }
  haptic('tap');
  afterStep(dr, mini);
  render();
}
export function bglundoAct() {
  const dr = bglDraft;
  if (!canAct(dr)) return;
  if (undoStep(dr, state.squares[dr.sq].mini)) render();
}
// Someone else's turn replayed (ui/replay.js): their taps through the same draft (a die tapped in an older client's
// log: nothing to show).
function replayInput(act, val, r) {
  if (act === 'bgldie') return true;
  if (!['bglpk', 'bglto', 'bglauto', 'bglundo'].includes(act)) return false;
  const sq = state.squares && state.squares[r.sq];
  if (!sq || !sq.mini || sq.mini.type !== 'bglite') return true;
  let dr = bglDraft;
  if (!dr || dr.rep !== r || dr.sq !== r.sq || dr.sig !== sigOf(sq.mini)) dr = bglDraft = newDraft(r.sq, r.by, sq.mini, r);
  if (act === 'bglpk') { const m = /^k=(\d)$/.exec(val || ''); if (m) { dr.pick = Number(m[1]); SND.play('select'); } return true; }
  if (act === 'bglundo') { undoStep(dr, sq.mini); return true; }
  const m = /^n=(\d)\.(\d)$/.exec(val || '');
  if (m) addStep(dr, sq.mini, Number(m[1]), Number(m[2]), act === 'bglauto');
  return true;
}
// The computer's turn (or a move with no log): each step's piece picked, then its ring.
function replaySynth(m, mini) {
  if (!m || typeof m !== 'object') return null;
  if (Number.isInteger(m.d)) return [[0, 'move', 'm=' + JSON.stringify(m)]];   // (an older client's single step)
  if (!Array.isArray(m.steps) || !m.steps.length) return null;
  const out = [];
  let t = 300;
  const c = mini && mini.pos ? cloneMini(mini) : null;
  for (const s of m.steps) {
    if (!Array.isArray(s)) return null;
    let hit = false;
    if (c && c.dice) { const r = bglStep(c, c.dice.by, s[0], s[1]); hit = !!r.hit; }
    out.push([t, 'bglpk', 'k=' + s[1]], [t + 500, 'bglto', `n=${s[0]}.${s[1]}`]);
    t += 500 + BGLT.slide + (hit ? BGLT.hit : 0) + 280;
  }
  return out;
}
export const replay = { input: replayInput, synth: replaySynth };
export const actions = { bglpk: bglpkAct, bglto: bgltoAct, bglundo: bglundoAct };
// The title bar's line while the turn is held to the square (ui/mini.js heldSub): the turn under way (dice to use), or,
// with Go again on success on, a piece borne off and the next roll to come.
export function heldSub(mini, turn, f, a) {
  if (f) return '';
  const who = `<b class="${turn}">${N(turn)}</b>`;
  return bglDice(mini, turn) ? `${who}: dice to use` : `${who} moved a piece off · goes again`;
}
