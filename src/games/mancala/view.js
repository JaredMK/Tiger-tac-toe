// Mancala Race: the screen, the miniature, the move's words and sounds.
// The board stands upright: X's pits down the right, sown upwards into X's bank at the top; O's pits down the left,
// sown downwards into O's bank at the bottom; so the seeds run round the board anticlockwise. Each pit shows its seeds
// as pebbles with their number; the mover's pits with seeds are buttons. A sowing (December 2026): every seed of the
// pit lifts into a hand (a cluster of the seeds over the pit, MANC.lift), the hand carries them along the way and
// drops one into each place in order (MANC.sow each), the bank only where the way goes into it, the cluster one seed
// smaller at each drop and the bank counting on as its seed lands; a capture (MANC.cap): the hand scoops up its own
// last seed, crosses to the opposite pit, scoops those up too and carries the lot into the bank. The hand is one
// element moved by Web Animations through the places' measured middles (`carry`), timed by the move's own event (the
// square's .gwrap is its host: ui/fx.js anchorFx keeps it there through a redraw). A drop is a marble's click on the
// others, its pitch a little different each time.
import { MANC, mancCfg, mancMoves, mancMs } from './rules.js';
import { N, app, mv } from '../../ui/app.js';
import { fx, fxAt } from '../../ui/fx.js';
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
  const capAt = s && s.cap ? MANC.lift + s.path.length * MANC.sow : null, end = s ? mancMs(s) : 0, oppAt = capAt != null ? capAt + MANC.scoop : null, bankAt = capAt != null ? capAt + MANC.cap - 120 : null;
  const tal = p => ptsTally(p, o, c.target, mini.bank[p], s && a.by === p ? s.from : null, s && a.by === p ? (lands[p + ':bank'] ? lands[p + ':bank'][0] : bankAt || 0) : 0);
  const pit = (p, i) => {
    const v = mini.pits[p][i], got = lands[p + ':' + i] || [], capMine = s && s.cap && a.by === p && s.cap.i === i, capOpp = s && s.cap && a.by !== p && n - 1 - s.cap.i === i;
    const late = {}; got.forEach((t, k) => { late[v - got.length + k] = t; });
    const ghost = capMine ? pebbles(1, null, capAt) : capOpp ? pebbles(s.cap.n - 1, null, oppAt) : '';
    const num = got.length && v ? `<b class="mcn cnt" data-from="${v - got.length}" data-delay="${got[0]}" data-ms="${Math.max(60, got[got.length - 1] - got[0])}">${v}</b>` : `<b class="mcn">${v || ''}</b>`;
    const inner = `<span class="mcpeb">${pebbles(v, late)}${ghost}</span>${num}`, src = s && a.by === p && s.i === i;
    const cls = `mcp ${p}${src ? ' src' : ''}${v ? '' : ' empty'}`;
    return live && p === turn && v > 0 ? `<button class="${cls} can" data-mcp="${p}:${i}" data-act="move" ${mv(i)} aria-label="Your pit ${i + 1}: ${v} seeds">${inner}</button>` : `<div class="${cls}" data-mcp="${p}:${i}" role="img" aria-label="${p} pit ${i + 1}: ${v} seeds">${inner}</div>`;
  };
  const bank = p => { const got = lands[p + ':bank'] || [], gain = s && a.by === p && s.to > s.from; return `<div class="mcbank ${p}${gain ? ' gain' : ''}" data-mcp="${p}:bank" style="--t:${got[0] != null ? got[0] : bankAt || 0}ms" role="img" aria-label="${p}'s bank: ${mini.bank[p]}"><span class="mcpeb">${pebbles(Math.min(12, mini.bank[p]))}</span><b class="mcn">${gain ? `<b class="cnt" data-from="${s.from}" data-delay="${got[0] != null ? got[0] : bankAt || 0}" data-ms="${s.cap ? MANC.cap : 200}">${mini.bank[p]}</b>` : mini.bank[p]}</b></div>`; };
  let rows = ''; for (let r = 0; r < n; r++) rows += pit('O', r) + pit('X', n - 1 - r);
  const stuck = live && !moves.length;
  const say = s ? (s.cap ? [`Captured ${s.cap.n}!`, 'ok'] : s.again ? ['In the bank: go again', 'ok'] : null) : null;
  const line = say ? `<p ${lateAt('mcline ' + say[1], end)} role="status">${say[0]}</p>` : stuck ? `<p class="mcline"><button class="btn mcend" data-act="move" ${mv('end')}>Nothing to sow: count up</button></p>` : '<p class="mcline"></p>';
  // the hand: the seeds lifted out of the pit, one gone at each drop; a capture's seeds join it as they are scooped
  let hand = '';
  if (s) {
    const lift = s.path.map((pl, k) => `<i class="mcs gone" style="${HAND[k % HAND.length]};--u:${MANC.lift + (k + 1) * MANC.sow}ms"></i>`).join('');
    const cap = s.cap ? Array.from({ length: Math.min(8, s.cap.n) }, (_, k) => `<i class="mcj" style="${HAND[k % HAND.length]};--t:${k ? oppAt : capAt}ms"><i class="mcs gone" style="--u:${bankAt}ms"></i></i>`).join('') : '';
    hand = `<span class="mchand ${a.by}" aria-hidden="true">${lift}${cap}</span>`;
    carryNext(a, s, a.by);
  }
  return `<div class="g-mc pc-${by}"><div class="ctals two">${tal('X')}${tal('O')}</div><div class="mcbox"><div class="mcboard" style="--n:${n}">${bank('X')}<div class="mcpits">${rows}</div>${bank('O')}${hand}</div></div>${line}</div>`;
}
// ---- the hand's way: through the middles of the places it visits, measured on the page (the board's own units) ----
const HAND = ['left:30%;top:36%', 'left:62%;top:32%', 'left:46%;top:62%', 'left:24%;top:66%', 'left:70%;top:64%', 'left:48%;top:22%', 'left:78%;top:44%', 'left:16%;top:46%'];
let carried = null;
function carryNext(a, s, by) {
  if (typeof requestAnimationFrame !== 'function') return;
  requestAnimationFrame(() => carry(a, s, by));
}
function carry(a, s, by) {
  const hand = app && app.querySelector ? app.querySelector('.mchand') : null, board = hand && hand.parentElement;
  if (!hand || !board || typeof hand.animate !== 'function' || carried === hand) return;
  carried = hand;
  const b = board.getBoundingClientRect(), k = b.width / (board.offsetWidth || b.width) || 1;
  const mid = key => { const e = board.querySelector(`[data-mcp="${key}"]`); if (!e) return null; const r = e.getBoundingClientRect(); return [(r.left + r.width / 2 - b.left) / k, (r.top + r.height / 2 - b.top) / k]; };
  const n = s.path.length, other = by === 'X' ? 'O' : 'X', pits = board.querySelectorAll('.mcp.' + by).length;
  const stops = [[0, mid(`${by}:${s.i}`), 1], [MANC.lift, mid(`${by}:${s.i}`), 1.18]];         // over the pit, lifted
  s.path.forEach(([side, at], i) => { const t = MANC.lift + (i + 1) * MANC.sow, p = mid(`${side}:${at}`); stops.push([t - MANC.sow * 0.35, p, 1.08], [t, p, 1]); });
  let end = MANC.lift + n * MANC.sow;
  if (s.cap) {
    const own = mid(`${by}:${s.cap.i}`), opp = mid(`${other}:${pits - 1 - s.cap.i}`), bank = mid(`${by}:bank`), c0 = end;
    stops.push([c0 + 60, own, 1.12], [c0 + MANC.scoop - 40, opp, 1.12], [c0 + MANC.scoop, opp, 1.2], [c0 + MANC.cap - 160, bank, 1.12], [c0 + MANC.cap - 120, bank, 1]);
    end = c0 + MANC.cap;
  }
  stops.push([end + 120, stops[stops.length - 1][1], 0.6]);
  if (stops.some(x => !x[1])) return;
  const total = stops[stops.length - 1][0] || 1;
  const frames = stops.map(([t, [x, y], sc], i) => ({ offset: Math.min(1, t / total), transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${sc})`, opacity: i === stops.length - 1 ? 0 : 1 }));
  frames.forEach((f, i) => { if (i && f.offset < frames[i - 1].offset) f.offset = frames[i - 1].offset; });
  const anim = hand.animate(frames, { duration: total, fill: 'both', easing: 'linear' });
  const at = fxAt('move', a), rate = (fx.move && fx.move.rate) || 1;
  if (at != null) { try { anim.playbackRate = rate; anim.currentTime = Math.max(0, performance.now() - at); } catch (e) { /* (kept) */ } }
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
// The seeds scooped up into the hand, then one marble-on-marble click for each seed dropped (its pitch a little
// different each time, a touch brighter into a bank); a capture: a scoop at each pit, the seeds clicking into the
// bank together, a chime.
const PITCH = [1, 1.09, 0.94, 1.15, 0.97, 1.05, 0.9, 1.12];
export function sounds(f, add, won, mini, last) {
  const l = f.mc; if (!l || l.end) return;
  add('mcScoop', 0);
  l.path.forEach(([side, at], k) => add('mcClick', MANC.lift + (k + 1) * MANC.sow, PITCH[k % PITCH.length] * (at === 'bank' ? 1.18 : 1)));
  if (l.cap) {
    const c0 = MANC.lift + l.path.length * MANC.sow, b = c0 + MANC.cap - 120;
    add('mcScoop', c0 + 60); add('mcScoop', c0 + MANC.scoop);
    for (let k = 0; k < Math.min(6, l.cap.n); k++) add('mcClick', b + k * 40, PITCH[(k + 3) % PITCH.length] * 1.15);
    add('ding', c0 + MANC.cap);
  }
}
