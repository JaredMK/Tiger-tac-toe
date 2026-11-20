// Mancala Race: the screen, the miniature, the move's words and sounds.
// The board stands upright: X's pits down the right, sown upwards into X's bank at the top; O's pits down the left,
// sown downwards into O's bank at the bottom; so the seeds run round the board anticlockwise. Each pit shows its seeds
// as pebbles with their number; the mover's pits with seeds are buttons. A sowing: the pit empties (MANC.lift), then a
// seed drops into each place on its way, one after another (MANC.sow each, a tick each), the bank counting on as its
// seed lands; a capture sweeps the two pits into the bank after the last seed (MANC.cap).
import { MANC, mancCfg, mancMoves, mancMs } from './rules.js';
import { N, mv } from '../../ui/app.js';
import { lateAt } from '../../ui/progress.js';
import { thumbArt } from '../../ui/thumbs.js';
import { barRows, ptsTally } from '../../ui/tok.js';

export const ownLine = true;
export const hold = f => (f.kind === 'again' ? 0 : null);
const SPOT = [[30, 34], [62, 30], [46, 60], [24, 66], [70, 62], [48, 24], [78, 42], [16, 48], [56, 78], [36, 82], [66, 84], [84, 70]];   // where a pit's pebbles lie (percent)
const pebbles = (n, late, gone) => Array.from({ length: Math.min(12, n) }, (_, k) => { const [x, y] = SPOT[k], t = late && late[k] != null ? late[k] : null; return `<i class="mcs${t != null ? ' appear' : ''}${gone != null ? ' gone' : ''}" style="left:${x}%;top:${y}%${t != null ? `;--t:${t}ms` : ''}${gone != null ? `;--u:${gone}ms` : ''}"></i>`; }).join('');
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const c = mancCfg(mini), n = mini.pits.X.length, s = a && a.mc && !a.mc.end ? a.mc : null, o = { view, locked, turn }, live = !view && !locked;
  const moves = live ? mancMoves(mini, turn) : [], by = s ? a.by : turn;
  // when each seed of the move lands: by place
  const lands = {}; if (s) s.path.forEach(([side, at], k) => { const key = side + ':' + at; (lands[key] = lands[key] || []).push(MANC.lift + (k + 1) * MANC.sow); });
  const capAt = s && s.cap ? MANC.lift + s.path.length * MANC.sow : null, end = s ? mancMs(s) : 0;
  const tal = p => ptsTally(p, o, c.target, mini.bank[p], s && a.by === p ? s.from : null, s && a.by === p ? (lands[p + ':bank'] ? lands[p + ':bank'][0] : capAt || 0) : 0);
  const pit = (p, i) => {
    const v = mini.pits[p][i], got = lands[p + ':' + i] || [], capMine = s && s.cap && a.by === p && s.cap.i === i, capOpp = s && s.cap && a.by !== p && n - 1 - s.cap.i === i;
    const late = {}; got.forEach((t, k) => { late[v - got.length + k] = t; });
    const ghost = capMine ? pebbles(1, null, capAt) : capOpp ? pebbles(s.cap.n - 1, null, capAt) : '';
    const num = got.length && v ? `<b class="mcn cnt" data-from="${v - got.length}" data-delay="${got[0]}" data-ms="${Math.max(60, got[got.length - 1] - got[0])}">${v}</b>` : `<b class="mcn">${v || ''}</b>`;
    const inner = `<span class="mcpeb">${pebbles(v, late)}${ghost}</span>${num}`, src = s && a.by === p && s.i === i;
    const cls = `mcp ${p}${src ? ' src' : ''}${v ? '' : ' empty'}`;
    return live && p === turn && v > 0 ? `<button class="${cls} can" data-act="move" ${mv(i)} aria-label="Your pit ${i + 1}: ${v} seeds">${inner}</button>` : `<div class="${cls}" role="img" aria-label="${p} pit ${i + 1}: ${v} seeds">${inner}</div>`;
  };
  const bank = p => { const got = lands[p + ':bank'] || [], gain = s && a.by === p && s.to > s.from; return `<div class="mcbank ${p}${gain ? ' gain' : ''}" style="--t:${got[0] != null ? got[0] : capAt || 0}ms" role="img" aria-label="${p}'s bank: ${mini.bank[p]}"><span class="mcpeb">${pebbles(Math.min(12, mini.bank[p]))}</span><b class="mcn">${gain ? `<b class="cnt" data-from="${s.from}" data-delay="${got[0] != null ? got[0] : capAt || 0}" data-ms="${s.cap ? MANC.cap : 200}">${mini.bank[p]}</b>` : mini.bank[p]}</b></div>`; };
  let rows = ''; for (let r = 0; r < n; r++) rows += pit('O', r) + pit('X', n - 1 - r);
  const stuck = live && !moves.length;
  const say = s ? (s.cap ? [`Captured ${s.cap.n}!`, 'ok'] : s.again ? ['In the bank: go again', 'ok'] : null) : null;
  const line = say ? `<p ${lateAt('mcline ' + say[1], end)} role="status">${say[0]}</p>` : stuck ? `<p class="mcline"><button class="btn mcend" data-act="move" ${mv('end')}>Nothing to sow: count up</button></p>` : '<p class="mcline"></p>';
  return `<div class="g-mc pc-${by}"><div class="ctals two">${tal('X')}${tal('O')}</div><div class="mcbox"><div class="mcboard" style="--n:${n}">${bank('X')}<div class="mcpits">${rows}</div>${bank('O')}</div></div>${line}</div>`;
}
export function heldSub(mini, turn, f, a) { return f ? '' : `<b class="${turn}">${N(turn)}</b> goes again`; }
// The miniature: the board upright (the two rows of pits, darker where they hold seeds, a bank at each end), over each
// player's banked seeds as a bar.
export function miniature(mini, final) {
  const c = mancCfg(mini), n = mini.pits.X.length, h = 34 / n; let out = '<rect class="tmcb" x="1" y="1" width="38" height="58" rx="8"/><rect class="tmck X" x="8" y="4" width="24" height="7" rx="3.500"/><rect class="tmck O" x="8" y="49" width="24" height="7" rx="3.500"/>';
  for (let r = 0; r < n; r++) for (const [p, x, i] of [['O', 11, r], ['X', 29, n - 1 - r]]) out += `<circle class="tmcp${mini.pits[p][i] ? ' on' : ''}" cx="${x}" cy="${(13 + (r + 0.5) * h).toFixed(1)}" r="${Math.min(4.2, h * 0.42).toFixed(1)}"/>`;
  return thumbArt(`<svg class="tmc" viewBox="0 0 40 60">${out}</svg>`, barRows(mini.bank, c.target), 'tmcw', `Mancala Race: X ${mini.bank.X}, O ${mini.bank.O} of ${c.target} banked`);
}
export function moveText(f, who) { const l = f.mc; return !l || l.end ? `${who} had nothing to sow` : l.cap ? `${who} captured ${l.cap.n}` : `${who} sowed ${l.n}`; }
// The seeds scooped up, a tick as each one drops (a brighter one into a bank), a sweep and a chime for a capture.
export function sounds(f, add, won, mini, last) {
  const l = f.mc; if (!l || l.end) return;
  add('mcScoop', 0);
  l.path.forEach(([side, at], k) => add(at === 'bank' ? 'mcBank' : 'mcDrop', MANC.lift + (k + 1) * MANC.sow, 0.9 + (k % 4) * 0.06));
  if (l.cap) { add('mcScoop', MANC.lift + l.path.length * MANC.sow); add('ding', MANC.lift + l.path.length * MANC.sow + MANC.cap); }
}
