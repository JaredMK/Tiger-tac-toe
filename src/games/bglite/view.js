// Backgammon Lite: the screen, the miniature, the move's words and sounds, and the inputs.
import { BGL, BGLT, bglCan, bglDice, bglHome, bglMoves, bglStep, bglTimes, bglTo, bglV2 } from './rules.js';
import { N, REDUCED, mv, state, waitLine, zoomedType } from '../../ui/app.js';
import { dieFace } from '../../ui/art.js';
import { DIE_FLAT_MS } from '../../ui/dice.js';
import { DIE_MORE } from '../../core/config.js';
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

// The board: the track's n points in a row, with a zone at each end: the left one holds X's pieces waiting to start
// (top) and O's pieces borne off (bottom), the right one O's waiting and X's off. X travels left to right, O right to
// left (the arrows under the board). Pieces stack up from the bottom of their point (one side to a point: a lone
// enemy is hit, two block). Every piece has a cell (column, slot of 6) worked out from the positions alone (bglCells),
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
  SND.play('clack', at(BGLT.slide - 60));
  if (res.hit) SND.play('thud', at(BGLT.slide + 40));
  if (dr.off) SND.play('ding', at(BGLT.slide - 80));
  return true;
}
// Undo: the steps back to before the last one chosen (the forced ones after it go with it).
function undoStep(dr, mini) {
  if (!dr.steps.some(s => !s.auto)) return false;
  const c = played(mini, dr);
  while (dr.steps.length && dr.steps[dr.steps.length - 1].auto) dr.steps.pop();
  dr.steps.pop();
  dr.from = bglCells(c.pos, c.n); dr.at = performance.now(); dr.hit = null; dr.off = false; dr.pick = null;
  clearTimeout(dr.commitT); dr.commitT = null;
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
const piece = p => `<svg viewBox="-10 -10 20 20" aria-hidden="true"><circle r="8.6"/>${markSvgG(p, 3.6)}</svg>`;
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
  const pieces = ['X', 'O'].flatMap(p => [0, 1, 2].map(k => {
    const key = p + k, [col, slot] = now[key], hs = H[key];
    let cls = `bglp ${p}${hs && hs.length ? ' mv' : ''}`;
    const st = cellStyle(col, slot, c), inner = hopWrap(piece(p), hs);
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
  const pts = Array.from({ length: n }, (_, i) => `<i class="bglpt${i % 2 ? ' b' : ''}" style="left:${((i + 1) * 100 / c).toFixed(3)}%;width:${(100 / c).toFixed(3)}%"></i>`).join('');
  const zones = `<i class="bglz l" style="width:${(100 / c).toFixed(3)}%"></i><i class="bglz r" style="width:${(100 / c).toFixed(3)}%"></i>`
    + (bglV2(mini) ? ['X', 'O'].map(p => { const h = bglHome(mini), from = p === 'X' ? n - h + 1 : 1; return `<i class="bglhm ${p}" style="left:${(from * 100 / c).toFixed(3)}%;width:${(h * 100 / c).toFixed(3)}%"></i>`; }).join('') : '');   // each side's home zone: a band in its colour under its last points
  const host = !b && dr && dr.at != null ? fxAttr(dr.at) : '';    // (the draft's step: its slide timed from the tap)
  const board = `<div class="bglw"><div class="bglb" style="--c:${c}"${host} role="img" aria-label="The track: ${n} points">${zones}${pts}${pieces}${rings}</div></div>`;
  const arrows = `<div class="bglar" aria-hidden="true"><svg class="X" viewBox="0 0 40 12"><path d="M2 6h33M29 1.5l6 4.5-6 4.5"/></svg><svg class="O" viewBox="0 0 40 12"><path d="M38 6H5M11 1.5L5 6l6 4.5"/></svg></div>`;
  // the dice: the roll's tumbling in; the turn's greying one by one as each is used (crossed: no move for it)
  const rollNow = b && b.kind === 'roll' && !REDUCED;
  let dd = null;
  if (b && b.kind === 'roll') dd = b.v.map((v, d) => ({ v, cls: (b.one && d === 1 ? ' used' : '') + (rollNow ? ' roll' : '') }));
  else if (tb) {
    const spendAt = {}; tb.steps.forEach((s, i) => { spendAt[s.d] = T.steps[i].land; });
    dd = tb.v.map((v, d) => {
      if (tb.used0[d]) return { v, cls: ' used' };
      if (spendAt[d] != null) return anim ? { v, cls: ' spend', t: spendAt[d] } : { v, cls: ' used' };
      if (tb.lost.includes(d)) return anim ? { v, cls: ' dead late', t: T.deadAt } : { v, cls: ' dead' };
      return { v, cls: '' };
    });
  } else if (view.dice && view.dice.by === (dr ? dr.p : turn)) {
    const dead = dr ? deadOf(view, optsOf(view, dr.p)) : [], last = dr && dr.steps.length && dr.at != null ? dr.steps[dr.steps.length - 1].d : null;
    dd = view.dice.v.map((v, d) => ({ v, cls: view.dice.used[d] ? (d === last && !REDUCED ? ' spend' : ' used') : dead.includes(d) ? ' dead' : (me && to.some(x => x.d === d) ? ' sel' : ''), t: d === last ? BGLT.slide : null }));
  }
  const dice = dd ? dd.map(x => (x.v ? `<span class="die bgldie${x.cls}"${x.t != null || /roll/.test(x.cls) ? ` style="${x.t != null ? `--t:${Math.round(x.t)}ms;` : ''}${/roll/.test(x.cls) ? `--dur:${DIE_FLAT_MS}ms` : ''}"` : ''} aria-label="${x.v}${/used|spend/.test(x.cls) ? ', used' : /dead/.test(x.cls) ? ', no move' : ''}">${dieFace(x.v)}</span>` : '')).join('') : '';
  const W = p => `<b class="${p}">${N(p)}</b>`;
  const offOf = p => view.pos[p].filter(x => x > n).length;
  const tal = p => arcTally(p, o, pips(p, offOf(p), BGL.pieces, !!(anim && tb.by === p && T.offAt != null), anim ? T.offAt : null));
  let say = '', ok = '', sayAt = null;
  if (b && b.kind === 'roll') { say = b.stuck ? 'No move: the turn passes' : b.one ? `Opening roll: ${b.v[0]}` : b.v.length === 4 ? `Double ${b.v[0]}: four moves` : `${W(b.by)} rolled ${b.v[0]} and ${b.v[1]}`; sayAt = rollNow ? BGLT.roll : null; }
  else if (tb) {
    const hi = tb.steps.findIndex(s => s.hit), oi = tb.steps.findIndex(s => s.off);
    if (hi >= 0) { say = `Hit! ${W(other(tb.by))} goes back to the start`; ok = 'ok'; sayAt = T.steps[hi].hitAt; }
    else if (oi >= 0) { say = tb.steps.filter(s => s.off).length > 1 ? 'Pieces off!' : 'A piece off!'; ok = 'ok'; sayAt = T.steps[oi].land; }
    else if (tb.lost.length) { say = deadLine(tb.v, tb.lost); sayAt = T.deadAt; }
    else if (tb.again) { say = 'Roll again'; sayAt = T.slid; }
    if (!anim) sayAt = null;
  } else if (dr) {
    if (dr.hit && dr.steps.length) { say = `Hit! ${W(other(dr.p))} goes back to the start`; ok = 'ok'; }
    else say = deadLine(view.dice ? view.dice.v : [], deadOf(view, optsOf(view, dr.p)));
  }
  const res = say ? `<p ${lateAt('arcres ' + ok, sayAt)} role="status">${say}</p>`
    : `<p class="arcnote">${o.view ? '' : o.locked && !dr ? waitLine(turn) : ''}</p>`;
  // the button: Roll, or, with the dice out, Undo (the same room)
  const inPlay = !!bglDice(mini, turn) || !!dr || !!tb;
  let btn = '';
  if (!o.view) btn = inPlay && !(b && b.kind === 'roll')
    ? `<div class="cbtns one"><button class="big bglundo" data-act="bglundo"${live && dr.steps.some(s => !s.auto) ? '' : ' disabled'}>Undo</button></div>`
    : `<div class="cbtns one"><button class="big ${turn}" data-act="move" ${mv('roll')}${o.locked || inPlay || b ? ' disabled' : ''}>Roll</button></div>`;
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="bgl">${board}${arrows}<div class="bgldice"${host}>${dice}</div>${res}</div>${btn}</div>`;
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
// The miniature: the track as a strip of points with every piece on it (and those waiting in the end zones), and under
// it each player's pieces borne off as pips.
export function miniature(mini, final) {
  const n = mini.n, c = n + 2, cells = bglCells(mini.pos, n), W = c * 10, H = 30;
  const pts = Array.from({ length: n }, (_, i) => `<rect class="tbglpt${i % 2 ? ' b' : ''}" x="${(i + 1) * 10}" y="0" width="10" height="${H}"/>`).join('');
  const toks = ['X', 'O'].flatMap(p => [0, 1, 2].map(k => {
    const [col, slot] = cells[p + k], a = mini.pos[p][k];
    if (a > n) return '';                                         // (borne off: the pips)
    const y = a <= 0 ? 5 + slot * 10 : H - 5 - (SLOTS - 1 - slot) * 10;
    return tokSvg(p, col * 10 + 5, y, 4.4);
  })).join('');
  const art = `<svg class="tbgl" viewBox="0 0 ${W} ${H}" aria-hidden="true"><rect class="tbglz" x="0" y="0" width="${W}" height="${H}" rx="3"/>${pts}${toks}</svg>`;
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
// The roll: the rattle, the dice landing (a thud for no move); each step: its click as it lands, a hit's thump as the
// other piece flies home, a ding for a piece off (none for a turn already played here, step by step: seenOf).
export function sounds(f, add, won, mini, last) {
  const b = f.bgl;
  if (!b) return;
  if (b.kind === 'roll') { add('rattle', 0); add('thunk', 500 + DIE_MORE); if (b.stuck) add('thud', BGLT.roll); return; }
  const tt = turnOf(b);
  if (!tt || seenOf(tt.b, state.zoom)) return;
  tt.b.steps.forEach((s, i) => {
    const t = tt.T.steps[i];
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
