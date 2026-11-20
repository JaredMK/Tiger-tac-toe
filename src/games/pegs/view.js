// Peg Jump Race: the screen, the miniature, the move's words and sounds, and the pick of a peg.
// The board is a grid of holes with a home bar at each end (X crosses upwards to the top bar, O downwards to the
// bottom one; the pegs home stand in their bar). The mover's pegs that can move are buttons: a tap picks one (ringed)
// and its ways show on the board: a dot on a cell it can step to, an arc on one it can jump to, the home bar lit when
// a jump goes off the board. A tap on one makes the move. Mid-chain the peg stays picked, its further jumps showing,
// with End turn beside the board. A move: the peg slides (PEGS.step) or hops in an arc over the peg it jumps, which
// wobbles (PEGS.jump); a peg going home runs off its end and pops up in its bar.
import { PEGS, pegMoves } from './rules.js';
import { SND, ownPress } from '../../audio/sound.js';
import { haptic } from '../../net/platform.js';
import { blocked } from '../../net/room.js';
import { N, mv, state } from '../../ui/app.js';
import { arcTally, lateAt, pips } from '../../ui/progress.js';
import { render } from '../../ui/render.js';
import { pipRows, thumbArt } from '../../ui/thumbs.js';
import { tok } from '../../ui/tok.js';

export const ownLine = true;
export const hold = f => (f.kind === 'again' ? 0 : null);
export const replay = { synth: () => [] };                         // the move is its peg and cell: shown from the flash
let sel = null;                                                    // this phone's pick: { sq, p, sig, k }
const sig = (mini, p) => JSON.stringify(mini.pegs[p]);
function picked(mini, sq, p) {
  if (mini.hop && mini.hop.by === p) return mini.hop.k;
  return sel && sel.sq === sq && sel.p === p && sel.sig === sig(mini, p) ? sel.k : -1;
}
function pickAct(el) {
  const sq = state.squares && state.squares[state.zoom], m = sq && sq.mini;
  if (!m || m.type !== 'pegs' || state.flash || state.done || blocked() || (m.hop && m.hop.by === state.turn)) return;
  const p = state.turn, k = Number(el.dataset.k);
  if (!pegMoves(m, p).some(x => x.k === k)) return;
  sel = picked(m, state.zoom, p) === k ? null : { sq: state.zoom, p, sig: sig(m, p), k };
  SND.play('pjPick'); haptic('tap'); render();
}
export const actions = { 'pj-pick': el => { ownPress(); pickAct(el); } };
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const s = a && a.pg && !a.pg.stop ? a.pg : null, o = { view, locked, turn }, R = mini.rows, C = mini.cols, n = mini.pegs.X.length;
  const live = !view && !locked, all = live ? pegMoves(mini, turn) : [], pk = live ? picked(mini, state.zoom, turn) : -1, ways = all.filter(x => x.k === pk);
  const tal = p => arcTally(p, o, pips(p, mini.home[p], n, !!(s && s.home && a.by === p), s && s.jump ? PEGS.jump : PEGS.step));
  const T = s ? (s.jump ? PEGS.jump : PEGS.step) : 0;
  const pegAt = (r, c) => { for (const p of ['X', 'O']) { const k = mini.pegs[p].findIndex(q => q && q[0] === r && q[1] === c); if (k >= 0) return { p, k }; } return null; };
  const cell = (r, c) => {
    const g0 = pegAt(r, c), way = ways.find(x => x.to[0] === r && x.to[1] === c);
    let inner = '', cls = 'pjc';
    if (g0) {
      const moved = s && a.by === g0.p && s.k === g0.k && !s.home, jumped = s && s.over && s.over[0] === r && s.over[1] === c;
      const st = moved ? ` style="--dx:${s.from[1] - c};--dy:${s.from[0] - r};--t:${T}ms"` : jumped ? ` style="--t:${T}ms"` : '';
      inner = `<i class="pjmv${moved ? (s.jump ? ' hop' : ' slide') : ''}${jumped ? ' wob' : ''}"${st}>${tok(g0.p, pk === g0.k && g0.p === turn && live ? 'sel' : '')}</i>`;
      if (live && g0.p === turn && !(mini.hop && mini.hop.by === turn) && all.some(x => x.k === g0.k)) return `<button class="${cls} peg can ${turn}" data-act="pj-pick" data-k="${g0.k}" aria-label="Your peg ${g0.k + 1}" aria-pressed="${pk === g0.k}">${inner}</button>`;
      return `<div class="${cls} peg">${inner}</div>`;
    }
    if (s && s.home && s.from[0] === r && s.from[1] === c) inner = `<i class="pjmv gone" style="--dy:${a.by === 'X' ? -(r + 1) : R - r};--t:${T}ms">${tok(a.by)}</i>`;   // a peg going home: off its end of the board
    if (way) return `<button class="${cls} way ${turn}${way.jump ? ' jump' : ''}" data-act="move" ${mv({ k: way.k, to: way.to })} aria-label="${way.jump ? 'Jump' : 'Step'} to row ${r + 1}, column ${c + 1}"><i class="pjdot"></i></button>`;
    return `<div class="${cls}">${inner}</div>`;
  };
  let grid = ''; for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) grid += cell(r, c);
  const bar = p => {                                              // p's home bar (X's at the top): its pegs home, and the way off the board when the picked peg has one
    const off = p === turn ? ways.find(x => x.to[0] < 0 || x.to[0] >= R) : null, fresh1 = s && s.home && a.by === p;
    const toks = Array.from({ length: n }, (_, k) => (k < mini.home[p] ? `<span ${fresh1 && k === mini.home[p] - 1 ? lateAt('pjh on', T) : 'class="pjh on"'}>${tok(p)}</span>` : '<span class="pjh"></span>')).join('');
    return off ? `<button class="pjbar ${p} way" data-act="move" ${mv({ k: off.k, to: off.to })} aria-label="Jump home">${toks}</button>` : `<div class="pjbar ${p}" role="img" aria-label="${p}: ${mini.home[p]} of ${n} home">${toks}</div>`;
  };
  const say = s ? (s.home ? ['Home!', 'ok'] : s.jump ? ['Jump!', 'ok'] : null) : null, hopping = live && mini.hop && mini.hop.by === turn;
  const line = say ? `<p ${lateAt('pjline ' + say[1], T)} role="status">${say[0]}</p>` : hopping ? `<p class="pjline"><button class="btn pjstop" data-act="move" ${mv('stop')}>End turn</button></p>` : '<p class="pjline"></p>';
  return `<div class="g-pj pc-${s ? a.by : turn}"><div class="ctals two">${tal('X')}${tal('O')}</div><div class="pjbox">${bar('X')}<div class="pjgrid" style="--rows:${R};--cols:${C}">${grid}</div>${bar('O')}</div>${line}</div>`;
}
export function heldSub(mini, turn, f, a) { return f ? '' : `<b class="${turn}">${N(turn)}</b> may jump again`; }
// The miniature: the board from above with every peg on it, beside each player's pegs home as pips.
export function miniature(mini, final) {
  const R = mini.rows, C = mini.cols, n = mini.pegs.X.length, u = 60 / Math.max(R, C); let out = `<rect class="tpjb" x="1" y="1" width="${(C * u - 2).toFixed(1)}" height="${(R * u - 2).toFixed(1)}" rx="5"/>`;
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) out += `<circle class="tpjh" cx="${((c + 0.5) * u).toFixed(1)}" cy="${((r + 0.5) * u).toFixed(1)}" r="${(u * 0.16).toFixed(1)}"/>`;
  for (const p of ['X', 'O']) for (const q of mini.pegs[p]) if (q) out += `<circle class="tpjp ${p}" cx="${((q[1] + 0.5) * u).toFixed(1)}" cy="${((q[0] + 0.5) * u).toFixed(1)}" r="${(u * 0.34).toFixed(1)}"/>`;
  return thumbArt(`<svg class="tpj" viewBox="0 0 ${(C * u).toFixed(1)} ${(R * u).toFixed(1)}">${out}</svg>`, pipRows(mini.home, n), 'tpjw', `Peg Jump Race: X ${mini.home.X}, O ${mini.home.O} of ${n} home`);
}
export function moveText(f, who) { const l = f.pg; return !l || l.stop ? `${who} ended the turn` : l.home ? `${who} got a peg home` : l.jump ? `${who} jumped` : `${who} stepped`; }
// A step's tap as the peg lands; a jump's spring and its landing; a chime for a peg home.
export function sounds(f, add, won, mini, last) {
  const l = f.pg; if (!l || l.stop) return;
  if (l.jump) { add('pjHop', 0); add('pjLand', PEGS.jump); } else add('pjLand', PEGS.step);
  if (l.home) add('ding', l.jump ? PEGS.jump : PEGS.step);
}
