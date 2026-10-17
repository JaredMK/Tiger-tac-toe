// Flood: the screen, the miniature, the move's words and sounds, and the inputs.
import { FLOOD, FLOOD_MS } from './rules.js';
import { N, mv, state } from '../../ui/app.js';
import { arcTally, lateAt, sbar } from '../../ui/progress.js';

// Flood: the 6x6 grid in its colours, the blob's cells and the cells each player has grabbed marked in
// their colour; the colour buttons below (not the blob's own). A move: the blob turns the colour, then the
// cells it grabs fill in, wave by wave out from it.
const FLOOD_COL = ['#3d7fe0', '#21b2a6', '#8d5bd8', '#86c440', '#f06aa8'];
const FLOOD_NAMES = ['blue', 'teal', 'purple', 'green', 'pink'];
function floodTable(mini, a, o) {
  const fl = a && a.flood ? a.flood : null, turn = o.turn, blob = mini.colors[0];
  const tal = p => arcTally(p, o, '');
  // the bar chart: each player's cells against the target
  const fbar = p => { const n = Math.min(FLOOD.goal, mini.score[p]), n0 = fl && a.by === p ? Math.min(FLOOD.goal, mini.score[p] - fl.gain) : n;
    return `<div class="fbr ${p}"><b class="${p}">${p}</b>${sbar([{ cls: p, n, n0, label: p }, { cls: 'E', n: FLOOD.goal - n, n0: FLOOD.goal - n0, label: 'To go' }], FLOOD.goal, fl && a.by === p ? FLOOD_MS.base : null, true)}<small>${fl && a.by === p && n !== n0 ? `<span class="sbn"><span class="tu" style="--u:${FLOOD_MS.base}ms">${n0}</span><span class="tf" style="--f:${FLOOD_MS.base}ms">${n}</span></span>` : n}<span>/${FLOOD.goal}</span></small></div>`; };
  const waveOf = {};
  if (fl) fl.waves.forEach((w, k) => w.forEach(i => { waveOf[i] = k; }));
  const cells = mini.colors.map((c, i) => {
    const own = mini.owner[i], fresh = waveOf[i] != null;
    const n = FLOOD.n, r = Math.floor(i / n), k = i % n, inBlob = j => mini.owner[j] != null;
    let cls = 'flc' + (own === 'X' || own === 'O' ? ' own ' + own : '') + (i === 0 ? ' start' : '') + (own != null ? ' blob' : '');
    if (own != null) { if (r > 0 && inBlob(i - n)) cls += ' jt'; if (k < n - 1 && inBlob(i + 1)) cls += ' jr'; if (r < n - 1 && inBlob(i + n)) cls += ' jb'; if (k > 0 && inBlob(i - 1)) cls += ' jl'; }   // the blob's cells run together: no line between two of them
    let st = `background:${FLOOD_COL[c]}`;
    if (fresh) { cls += ' grab'; st += `;--t:${Math.round(FLOOD_MS.base * 0.55 + waveOf[i] * FLOOD_MS.wave)}ms`; }
    else if (fl && own != null) { cls += ' recolor'; st += `;--c0:${FLOOD_COL[fl.from == null ? c : fl.from]};--c1:${FLOOD_COL[c]};--t:0ms`; }
    return `<i class="${cls}" style="${st}">${own === 'X' || own === 'O' ? `<b>${own}</b>` : ''}</i>`;
  }).join('');
  const btns = o.view ? '' : `<div class="fbtns">${FLOOD_COL.map((col, c) => `<button class="fsw" style="background:${col}" data-act="move" ${mv(c)} aria-label="${FLOOD_NAMES[c]}"${c === blob || o.locked ? ' disabled' : ''}>${c === blob ? '<i>blob</i>' : ''}</button>`).join('')}</div>`;
  const res = fl ? `<p ${lateAt('arcres ' + (fl.gain ? 'ok' : 'no'), FLOOD_MS.base)} role="status">${fl.gain ? `+${fl.gain}` : 'Nothing grabbed'}</p>`
    : `<p class="arcnote">${o.view ? '' : o.locked ? `Waiting for <b class="${turn}">${N(turn)}</b>…` : ''}</p>`;
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="flood"><div class="flgrid">${cells}</div><div class="fbars">${fbar('X')}${fbar('O')}</div>${res}</div>${btns}</div>`;
}
export function miniature(mini, final) {
  return `<div class="tg gfl">${mini.colors.map((c, i) => `<i class="${mini.owner[i] === 'X' || mini.owner[i] === 'O' ? 'own ' + mini.owner[i] : ''}" style="background:${FLOOD_COL[c]}"></i>`).join('')}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = floodTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
export function moveText(f, who) {
  return f.flood ? `${who} went ${FLOOD_NAMES[f.flood.color]} · +${f.flood.gain}` : `${who} picked a colour`;
}
export function sounds(f, add, won, mini, last) {
  if (f.flood) { add('splash', 0); if (!f.flood.gain) add('thud', FLOOD_MS.base); f.flood.waves.slice(0, 6).forEach((w, k) => add('pop', Math.round(FLOOD_MS.base * 0.55 + k * FLOOD_MS.wave), 1 + k * 0.06)); } return;
}
