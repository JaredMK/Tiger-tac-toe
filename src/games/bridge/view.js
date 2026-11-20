// Glass Bridge: the screen, the miniature, the move's words and sounds.
// The bridge runs up the screen from the near bank to the flag: a row of glass platforms a line, each a button while
// it is in the mover's next row. Glass nobody has stood on is pale blue; glass that held is green with a tick; glass
// that broke is a hole with its shards. A hop: the mover's token jumps onto the platform (BRIDGE.hop) and it turns
// green under it; a break: the token lands, the glass cracks (BRIDGE.crack), gives way and the token drops through
// (BRIDGE.drop), then stands on its old row again (BRIDGE.back). Shared: one bridge with both tokens; separate: one
// each, side by side under its player's mark. Everything is timed from the move (rules.js BRIDGE).
import { BRIDGE, bridgeSeen } from './rules.js';
import { N, mv } from '../../ui/app.js';
import { TICK } from '../../ui/art.js';
import { arcTally, lateAt, pips } from '../../ui/progress.js';
import { pipRows, thumbArt } from '../../ui/thumbs.js';
import { tok } from '../../ui/tok.js';

export const ownLine = true;
export const hold = f => (f.kind === 'again' ? 0 : null);         // a hop that holds: the next one at once
const SHARDS = '<svg class="gbsh" viewBox="0 0 40 24" aria-hidden="true"><path d="M3 4l9 3-4 6zM22 3l7 5-9 2zM30 14l7-2-3 8zM12 15l8 2-6 5z"/></svg>';
function bridge(mini, o, a, own) {                               // own: whose bridge (separate), null the shared one
  const R = mini.n.length, s = a && a.gb && (!own || a.by === own) ? a.gb : null, by = s ? a.by : null;
  const seen = own ? mini.seen[own] : mini.seen, who = own ? [own] : ['X', 'O'], mover = o.turn;
  const next = !o.view && !o.locked && (!own || own === mover) ? mini.at[mover] + 1 : -1;
  const here = (p, r, i) => (r < 0 ? mini.at[p] < 0 : mini.at[p] === r && mini.pos[p] === i);
  const tokens = (r, i) => who.filter(p => here(p, r, i)).map(p => {
    if (s && by === p && !s.fall && s.r === r && s.i === i) return tok(p, 'hopin');           // just landed here
    if (s && by === p && s.fall) return tok(p, 'backin');                                       // fell: back on this row once the fall has played
    return tok(p);
  }).join('') + (s && s.fall && s.r === r && s.i === i ? tok(by, 'fallin') : '');
  const row = r => `<div class="gbrow" style="--n:${mini.n[r]}">${seen[r].map((v, i) => {
    const fresh = s && s.r === r && s.i === i ? ' fresh' : '', cls = `gbp s${v}${fresh}`, inner = `${v === 1 ? `<i class="gbok">${TICK}</i>` : ''}${v === 2 ? SHARDS : ''}${tokens(r, i)}`;
    return r === next && v !== 2 ? `<button class="${cls} nx ${mover}" data-act="move" ${mv(i)} aria-label="Row ${r + 1}, platform ${i + 1}${v === 1 ? ', safe' : ''}">${inner}</button>` : `<div class="${cls}">${inner}</div>`;
  }).join('')}</div>`;
  let rows = ''; for (let r = R - 1; r >= 0; r--) rows += row(r);
  return `<div class="gbb${own ? ' own ' + own : ''}" style="--rows:${R}"><div class="gbend far"><i class="gbflag"></i></div>${rows}<div class="gbend near">${tokens(-1, -1)}</div></div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const R = mini.n.length, s = a && a.gb ? a.gb : null, o = { view, locked, turn }, T = BRIDGE;
  const tal = p => arcTally(p, o, pips(p, mini.at[p] + 1, R, !!(s && !s.fall && a.by === p), T.hop));
  const say = s ? (s.fall ? ['Crack! It broke', 'no', T.hop + T.crack] : fresh ? ['Across!', 'ok', T.hop] : ['Safe!', 'ok', T.hop]) : null;
  const line = say ? `<p ${lateAt('gbline ' + say[1], say[2])} role="status">${say[0]}</p>` : '<p class="gbline"></p>';
  const br = mini.sep ? bridge(mini, o, a, 'X') + bridge(mini, o, a, 'O') : bridge(mini, o, a, null);
  return `<div class="g-gb${mini.sep ? ' sep' : ''}" style="--hop:${T.hop}ms;--crk:${T.hop + T.crack}ms;--bk:${T.hop + T.crack + T.drop}ms;--dr:${T.drop}ms"><div class="ctals two">${tal("X")}${tal("O")}</div><div class="gbwrap">${br}</div>${line}</div>`;
}
export function heldSub(mini, turn, f, a) { return f ? '' : `<b class="${turn}">${N(turn)}</b> hops again`; }
// The miniature: the bridge from above (its rows of glass: untried, safe, broken; a dot where each player stands),
// beside each player's rows crossed as pips.
export function miniature(mini, final) {
  const R = mini.n.length, one = (own, x0, w) => {
    const seen = own ? mini.seen[own] : mini.seen, h = 56 / R; let out = '';
    for (let r = 0; r < R; r++) for (let i = 0; i < mini.n[r]; i++) {
      const cw = w / mini.n[r], x = x0 + i * cw, y = 58 - (r + 1) * h;
      out += `<rect class="tgbp s${seen[r][i]}" x="${(x + 0.8).toFixed(1)}" y="${(y + 0.8).toFixed(1)}" width="${(cw - 1.6).toFixed(1)}" height="${(h - 1.6).toFixed(1)}" rx="1.5"/>`;
      for (const p of own ? [own] : ['X', 'O']) if (mini.at[p] === r && mini.pos[p] === i) out += `<circle class="tgbt ${p}" cx="${(x + cw / 2 + (own ? 0 : p === 'X' ? -cw * 0.18 : cw * 0.18)).toFixed(1)}" cy="${(y + h / 2).toFixed(1)}" r="${Math.min(3.4, h * 0.34).toFixed(1)}"/>`;
    }
    return out;
  };
  const art = `<svg class="tgb" viewBox="0 0 60 60">${mini.sep ? one('X', 2, 26) + one('O', 32, 26) : one(null, 8, 44)}</svg>`;
  return thumbArt(art, pipRows({ X: mini.at.X + 1, O: mini.at.O + 1 }, R), 'tgbw', `Glass Bridge: X on row ${mini.at.X + 1}, O on row ${mini.at.O + 1} of ${R}`);
}
export function moveText(f, who) { const s = f.gb; return !s ? `${who} hopped` : s.fall ? `${who} broke the glass on row ${s.r + 1}` : `${who} reached row ${s.r + 1}`; }
// The jump, then its landing: a glass tink where it holds; a crack, the smash and the drop where it breaks.
export function sounds(f, add, won, mini, last) {
  const s = f.gb; if (!s) return;
  add('gbJump', 0);
  if (s.fall) { add('gbCrack', BRIDGE.hop); add('gbSmash', BRIDGE.hop + BRIDGE.crack); add('thud', BRIDGE.hop + BRIDGE.crack + BRIDGE.drop); } else add('gbTink', BRIDGE.hop);
}
