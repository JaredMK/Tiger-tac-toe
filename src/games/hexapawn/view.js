// Hexapawn: the screen, the miniature, the move's words and sounds, and the inputs.
import { other } from '../../core/util.js';
import { HP, hpMoves } from './rules.js';
import { N, mv, state, zoomedType } from '../../ui/app.js';
import { toon, toonT } from '../../ui/art.js';
import { render } from '../../ui/render.js';

export let hpSel = null;                                                // Hexapawn: { sq, from } the pawn picked up on this phone                                           // the clock on screen is refreshed four times a second
export function miniature(mini, final) {
  return `<div class="tg thp">${mini.cells.map((c, i) => `<i class="${c || ''}${(Math.floor(i / HP.cols) + i) % 2 ? ' dk' : ''}">${c ? toonT(c) : ''}</i>`).join('')}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  // Tap one of your pawns to see where it can go, then tap a highlighted square. The pawn just moved
  // slides in from where it was; a captured pawn is knocked off the board.
  if (f || d || view) hpSel = null;                          // a move is playing out: nothing stays picked up
  const moves = view || f || d ? [] : hpMoves(mini.cells, turn);
  const sel = hpSel && hpSel.sq === state.zoom && moves.some(([x]) => x === hpSel.from) ? hpSel.from : null;
  const targets = sel == null ? [] : moves.filter(([x]) => x === sel).map(([, y]) => y);
  const mine = !locked;
  const stuck = !view && !f && !d && !locked && !moves.length;
  const cells = mini.cells.map((c, i) => {
    const r = Math.floor(i / HP.cols), col = i % HP.cols, tgt = targets.includes(i), movable = moves.some(([x]) => x === i);
    const moved = a && a.to === i, lit = won(i) && fresh;
    const style = moved ? ` style="--dx:${(a.from % HP.cols) - col};--dy:${Math.floor(a.from / HP.cols) - r}"` : '';
    const ghost = moved && a.capture ? `<span class="hpp ghost" style="--kx:${col >= (a.from % HP.cols) ? 1 : -1}" aria-hidden="true">${toon(other(a.by))}</span>` : '';
    const piece = c ? `<span class="hpp${moved ? ' slide' : ''}"${style}>${toonT(c)}</span>` : '';
    const act = mine && tgt ? `data-act="move" ${mv([sel, i])}` : mine && movable ? 'data-act="hpsel"' : '';
    const label = `Row ${r + 1} column ${col + 1}${c ? ', ' + c + ' pawn' : ''}${tgt ? (c ? ', capture here' : ', move here') : ''}`;
    return `<button class="hpc${(r + col) % 2 ? ' dk' : ''}${tgt ? ' tgt' : ''}${tgt && c ? ' cap' : ''}${i === sel ? ' sel' : ''}${won(i) ? ' win' : ''}${lit ? ' lit' : ''}" data-i="${i}" ${act} aria-label="${label}"${act ? '' : ' disabled'}>${ghost}${piece}</button>`;
  }).join('');
  g = `<div class="g-hp"><div class="hpgoal X">X wins by reaching this row</div><div class="hpb">${cells}</div><div class="hpgoal O">O wins by reaching this row</div>
        <p class="hpnote">${stuck ? `<b class="${turn}">${N(turn)}</b> has no move here: play another square` : ''}</p></div>`;
  return g;
}
export function moveText(f, who) {
  return f.capture ? `${who} captured a pawn` : `${who} stepped forward`;
}
export function sounds(f, add, won, mini, last) {
  add('pieceSlide', 0); if (f.capture) add('knock', 340); return;
}
// Hexapawn: pick a pawn (again to put it down) to see its moves
export function hpselAct(el, e, act) {
  if (zoomedType() !== 'hexapawn') return;
  const i = Number(el.dataset.i);
  hpSel = hpSel && hpSel.sq === state.zoom && hpSel.from === i ? null : { sq: state.zoom, from: i };
  render();
}
// Its own controls (data-act): the page's click handler hands them here.
export const actions = { hpsel: hpselAct };

// Setters for the names other modules reassign (an imported name is read-only there).
export function setHpSel(v) { hpSel = v; }
