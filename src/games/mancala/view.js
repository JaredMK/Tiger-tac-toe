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
// The end by an empty side (`v: 2`): once the move's own sowing has played, a second hand, in the colour of the side
// whose seeds are left, comes for them and scoops its pits one by one along that side (MANC.sweep each, their
// pebbles and numbers gone as it takes them), carries them into that side's bank and pours them in (MANC.pour, with
// the clicks); then both banks count up from 0 to their totals at one pace (the higher over MANC.count, each number
// ticking), and the verdict lands in the reserved line (MANC.say after): the winner and the count, or a level count's
// draw, the winner's bank ringed in its colour. All from the move's flash (rules.js mancTimes), the same live, in a
// replay and for the computer's move; with reduced motion the board shows the end at once (no hand), the totals and
// the verdict.
import { MANC, mancCfg, mancMoves, mancTimes } from './rules.js';
import { N, REDUCED, app, isYou, mv } from '../../ui/app.js';
import { fx, fxAt } from '../../ui/fx.js';
import { lateAt } from '../../ui/progress.js';
import { thumbArt } from '../../ui/thumbs.js';
import { barRows, ptsTally } from '../../ui/tok.js';

export const ownLine = true;
export const hold = f => (f.kind === 'again' ? 0 : null);
const SPOT = [[30, 34], [62, 30], [46, 60], [24, 66], [70, 62], [48, 24], [78, 42], [16, 48], [56, 78], [36, 82], [66, 84], [84, 70]];   // where a pit's pebbles lie (percent)
// The pebbles of a pit or a bank: `late` (by pebble) when one lands this move, `gone` when they all leave it.
const pebbles = (n, late, gone) => Array.from({ length: Math.min(12, n) }, (_, k) => { const [x, y] = SPOT[k], t = late && late[k] != null ? late[k] : null; return `<i class="mcs${t != null ? ' appear' : ''}${gone != null ? ' gone' : ''}" style="left:${x}%;top:${y}%${t != null ? `;--t:${t}ms` : ''}${gone != null ? `;--u:${gone}ms` : ''}"></i>`; }).join('');
const sum = a => a.reduce((s, v) => s + v, 0);
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const c = mancCfg(mini), n = mini.pits.X.length, l = a && a.mc && !(a.mc.end && !a.mc.sw) ? a.mc : null, o = { view, locked, turn }, live = !view && !locked;
  const s = l && l.path ? l : null, w = l && l.sw && l.fin ? l : null, T = l ? mancTimes(l) : null;   // (s: the move's sowing; w: the square ended by an empty side, its sweep, count and verdict)
  const moves = live ? mancMoves(mini, turn) : [], by = l ? a.by : turn;
  // when each seed of the move lands: by place
  const lands = {}; if (s) s.path.forEach(([side, at], k) => { const key = side + ':' + at; (lands[key] = lands[key] || []).push(MANC.lift + (k + 1) * MANC.sow); });
  const capAt = s && s.cap ? MANC.lift + s.path.length * MANC.sow : null, oppAt = capAt != null ? capAt + MANC.scoop : null, bankAt = capAt != null ? capAt + MANC.cap - 120 : null;
  const swept = p => (w ? sum(w.sw[p]) : 0), scoopAt = (p, i) => (w && T.side === p && T.ks.includes(i) ? T.scoop[T.ks.indexOf(i)] : null);
  const pre = p => (s && a.by === p ? s.from : mini.bank[p] - swept(p));   // a bank before the move
  const tal = p => (w ? ptsTally(p, o, c.target, mini.bank[p], pre(p), T.say)   // (an end by the sweep: the scores settle with the verdict, once the banks are counted)
    : ptsTally(p, o, c.target, mini.bank[p], s && a.by === p ? s.from : null, s && a.by === p ? (lands[p + ':bank'] ? lands[p + ':bank'][0] : bankAt || 0) : 0));
  const pit = (p, i) => {
    const v = w ? w.sw[p][i] : mini.pits[p][i], got = lands[p + ':' + i] || [], out = scoopAt(p, i);   // (a sweep: the pit as the sowing left it, until the hand takes its seeds)
    const capMine = s && s.cap && a.by === p && s.cap.i === i, capOpp = s && s.cap && a.by !== p && n - 1 - s.cap.i === i;
    const late = {}; got.forEach((t, k) => { late[v - got.length + k] = t; });
    const ghost = capMine ? pebbles(1, null, capAt) : capOpp ? pebbles(s.cap.n - 1, null, oppAt) : '';
    const cls = out != null ? ' out' : '', u = out != null ? ` style="--u:${out}ms"` : '';
    const num = got.length && v ? `<b class="mcn cnt${cls}"${u} data-from="${v - got.length}" data-delay="${got[0]}" data-ms="${Math.max(60, got[got.length - 1] - got[0])}">${v}</b>` : `<b class="mcn${cls}"${u}>${v || ''}</b>`;
    const inner = `<span class="mcpeb">${pebbles(v, late, out)}${ghost}</span>${num}`, src = s && a.by === p && s.i === i;
    const kls = `mcp ${p}${src ? ' src' : ''}${v ? '' : ' empty'}`;
    return live && p === turn && v > 0 && moves.includes(i) ? `<button class="${kls} can" data-mcp="${p}:${i}" data-act="move" ${mv(i)} aria-label="Your pit ${i + 1}: ${v} seeds">${inner}</button>` : `<div class="${kls}" data-mcp="${p}:${i}" role="img" aria-label="${p} pit ${i + 1}: ${v} seeds">${inner}</div>`;
  };
  const top = w && w.fin.X !== w.fin.O ? (w.fin.X > w.fin.O ? 'X' : 'O') : null;   // (the bank that wins the count)
  const bank = p => {
    const fin = mini.bank[p], b0 = pre(p), adds = (lands[p + ':bank'] || []).slice();   // when each seed coming into it lands: the sowing's, a capture's, the sweep's
    if (s && s.cap && a.by === p) for (let k = 0; k < s.cap.n; k++) adds.push(bankAt);
    if (w && T.side === p) for (let k = 0; k < swept(p); k++) adds.push(T.drop);
    const late = {}; adds.forEach((t, k) => { late[b0 + k] = t; });
    const gain = adds.length > 0, at = gain ? adds[0] : 0, sow = s && a.by === p && s.to > s.from;
    const first = sow ? `<b class="cnt" data-from="${s.from}" data-delay="${at}" data-ms="${s.cap ? MANC.cap : 200}">${s.to}</b>` : `${s && a.by === p ? s.to : b0}`;
    const number = w ? `<i class="mcq a" style="--u:${T.count}ms">${first}</i><i class="mcq b" style="--t:${T.count}ms;--d:${Math.max(240, T.cms[p] + 120)}ms"><b class="cnt" data-from="0" data-delay="${T.count}" data-ms="${Math.max(60, T.cms[p])}">${fin}</b></i>`   // (the count: from 0 to the total, the higher taking MANC.count)
      : sow ? first : `${fin}`;
    const kls = `mcbank ${p}${gain ? ' gain' : ''}${top === p ? ' top' : ''}`, st = `--t:${at}ms${top === p ? `;--w:${T.say}ms` : ''}`;
    return `<div class="${kls}" data-mcp="${p}:bank" style="${st}" role="img" aria-label="${p}'s bank: ${fin}"><span class="mcpeb">${pebbles(fin, late)}</span><b class="mcn">${number}</b></div>`;
  };
  let rows = ''; for (let r = 0; r < n; r++) rows += pit('O', r) + pit('X', n - 1 - r);
  const stuck = live && !moves.length;
  const say = s ? (s.cap ? [`Captured ${s.cap.n}!`, 'ok'] : s.again ? ['In the bank: go again', 'ok'] : null) : null;
  let line;
  if (w) {                                                       // the end by an empty side: why the square ends, then the verdict once the banks are counted
    const first = s && s.cap ? `Captured ${s.cap.n}!` : 'Out of seeds!', lo = Math.min(w.fin.X, w.fin.O), hi = Math.max(w.fin.X, w.fin.O);
    const verdict = top ? `<b class="${top} hn">${N(top)}</b> ${isYou(top) ? 'win' : 'wins'} ${hi}–${lo}` : `Level ${hi}–${lo}: a draw`;
    line = `<p class="mcline sw" role="status"><span class="mcl1${s && s.cap ? ' ok' : ''}" aria-hidden="true" style="--t:${T.sow}ms;--u:${T.say}ms">${first}</span><span class="mcl2${top ? '' : ' lvl'}" style="--t:${T.say}ms">${verdict}</span></p>`;
  } else line = say ? `<p ${lateAt('mcline ' + say[1], T ? T.sow : 0)} role="status">${say[0]}</p>` : stuck ? `<p class="mcline"><button class="btn mcend" data-act="move" ${mv('end')}>Nothing to sow: count up</button></p>` : '<p class="mcline"></p>';
  // the hands: the seeds lifted out of the pit, one gone at each drop (a capture's seeds join it as they are scooped);
  // the sweep's, the seeds left on their side joining it pit by pit and poured into their bank together
  let hand = '';
  if (s) {
    const lift = s.path.map((pl, k) => `<i class="mcs gone" style="${HAND[k % HAND.length]};--u:${MANC.lift + (k + 1) * MANC.sow}ms"></i>`).join('');
    const cap = s.cap ? Array.from({ length: Math.min(8, s.cap.n) }, (_, k) => `<i class="mcj" style="${HAND[k % HAND.length]};--t:${k ? oppAt : capAt}ms"><i class="mcs gone" style="--u:${bankAt}ms"></i></i>`).join('') : '';
    hand = `<span class="mchand ${a.by}" aria-hidden="true">${lift}${cap}</span>`;
  }
  if (w && T.side) {
    const joins = []; T.ks.forEach((i, k) => { for (let j = 0; j < w.sw[T.side][i]; j++) joins.push(T.scoop[k]); });
    hand += `<span class="mchand mcsw ${T.side}" aria-hidden="true">${joins.slice(0, HAND.length).map((t, j) => `<i class="mcj" style="${HAND[j]};--t:${t}ms"><i class="mcs gone" style="--u:${T.drop}ms"></i></i>`).join('')}</span>`;
  }
  if (hand) carryNext(a);
  return `<div class="g-mc pc-${by}"><div class="ctals two">${tal('X')}${tal('O')}</div><div class="mcbox"><div class="mcboard" style="--n:${n}">${bank('X')}<div class="mcpits">${rows}</div>${bank('O')}${hand}</div></div>${line}</div>`;
}
// ---- the hands' ways: through the middles of the places they visit, measured on the page (the board's own units) ----
const HAND = ['left:30%;top:36%', 'left:62%;top:32%', 'left:46%;top:62%', 'left:24%;top:66%', 'left:70%;top:64%', 'left:48%;top:22%', 'left:78%;top:44%', 'left:16%;top:46%'];
function carryNext(a) {
  if (REDUCED || typeof requestAnimationFrame !== 'function') return;   // (reduced motion: no hand, the board shows where the seeds went)
  requestAnimationFrame(() => carry(a));
}
// The sowing's hand: over the pit, lifted, each drop on the way, a capture's scoop and carry, then away.
function sowStops(s, by, mid, board) {
  const n = s.path.length, other = by === 'X' ? 'O' : 'X', pits = board.querySelectorAll('.mcp.' + by).length;
  const stops = [[0, mid(`${by}:${s.i}`), 1, 1], [MANC.lift, mid(`${by}:${s.i}`), 1.18, 1]];         // over the pit, lifted
  s.path.forEach(([side, at], i) => { const t = MANC.lift + (i + 1) * MANC.sow, p = mid(`${side}:${at}`); stops.push([t - MANC.sow * 0.35, p, 1.08, 1], [t, p, 1, 1]); });
  let end = MANC.lift + n * MANC.sow;
  if (s.cap) {
    const own = mid(`${by}:${s.cap.i}`), opp = mid(`${other}:${pits - 1 - s.cap.i}`), bank = mid(`${by}:bank`), c0 = end;
    stops.push([c0 + 60, own, 1.12, 1], [c0 + MANC.scoop - 40, opp, 1.12, 1], [c0 + MANC.scoop, opp, 1.2, 1], [c0 + MANC.cap - 160, bank, 1.12, 1], [c0 + MANC.cap - 120, bank, 1, 1]);
    end = c0 + MANC.cap;
  }
  stops.push([end + 120, stops[stops.length - 1][1], 0.6, 0]);
  return stops;
}
// The sweep's hand: unseen until the beat after the sowing, then over the first pit with seeds left, a dip at each as
// it takes them, along the side to its bank, poured in, away.
function sweepStops(l, mid) {
  const T = mancTimes(l), pos = T.ks.map(i => mid(`${T.side}:${i}`)), bank = mid(`${T.side}:bank`), t1 = T.scoop[0];
  const stops = [[0, pos[0], 0.6, 0], [Math.max(0, t1 - 170), pos[0], 0.6, 0], [t1 - 50, pos[0], 1.14, 1], [t1, pos[0], 1, 1]];
  for (let k = 1; k < pos.length; k++) stops.push([T.scoop[k] - MANC.sweep * 0.35, pos[k], 1.1, 1], [T.scoop[k], pos[k], 1, 1]);
  stops.push([T.drop - 90, bank, 1.16, 1], [T.drop, bank, 1, 1], [T.drop + 140, bank, 0.6, 0]);
  return stops;
}
function carry(a) {
  const board = app && app.querySelector ? app.querySelector('.mcboard') : null, l = a && a.mc;
  if (!board || !l) return;
  const b = board.getBoundingClientRect(), k = b.width / (board.offsetWidth || b.width) || 1;
  const mid = key => { const e = board.querySelector(`[data-mcp="${key}"]`); if (!e) return null; const r = e.getBoundingClientRect(); return [(r.left + r.width / 2 - b.left) / k, (r.top + r.height / 2 - b.top) / k]; };
  const at = fxAt('move', a), rate = (fx.move && fx.move.rate) || 1;
  for (const hand of board.querySelectorAll('.mchand')) {
    if (hand.mcRun || typeof hand.animate !== 'function') continue;   // (each hand drawn is set going once; one drawn again carries on from the move's own time)
    const stops = hand.classList.contains('mcsw') ? (l.sw && l.fin ? sweepStops(l, mid) : null) : (l.path ? sowStops(l, a.by, mid, board) : null);
    if (!stops || stops.some(x => !x[1])) continue;
    hand.mcRun = true;
    const total = stops[stops.length - 1][0] || 1;
    const frames = stops.map(([t, [x, y], sc, op]) => ({ offset: Math.min(1, t / total), transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${sc})`, opacity: op }));
    frames.forEach((f, i) => { if (i && f.offset < frames[i - 1].offset) f.offset = frames[i - 1].offset; });
    const anim = hand.animate(frames, { duration: total, fill: 'both', easing: 'linear' });
    if (at != null) { try { anim.playbackRate = rate; anim.currentTime = Math.max(0, performance.now() - at); } catch (e) { /* (kept) */ } }
  }
}
export function heldSub(mini, turn, f, a) { return f ? '' : `<b class="${turn}">${N(turn)}</b> goes again`; }
// The miniature: the board upright (the two rows of pits, darker where they hold seeds, a bank at each end), over each
// player's banked seeds as a bar.
export function miniature(mini, final) {
  const c = mancCfg(mini), n = mini.pits.X.length, h = 34 / n; let out = '<rect class="tmcb" x="1" y="1" width="38" height="58" rx="8"/><rect class="tmck X" x="8" y="4" width="24" height="7" rx="3.500"/><rect class="tmck O" x="8" y="49" width="24" height="7" rx="3.500"/>';
  for (let r = 0; r < n; r++) for (const [p, x, i] of [['O', 11, r], ['X', 29, n - 1 - r]]) out += `<circle class="tmcp${mini.pits[p][i] ? ' on' : ''}" cx="${x}" cy="${(13 + (r + 0.5) * h).toFixed(1)}" r="${Math.min(4.2, h * 0.42).toFixed(1)}"/>`;
  return thumbArt(`<svg class="tmc" viewBox="0 0 40 60">${out}</svg>`, barRows(mini.bank, c.target), 'tmcw', `Mancala Race: X ${mini.bank.X}, O ${mini.bank.O} of ${c.target} banked`);
}
export function moveText(f, who) { const l = f.mc; return !l || (l.end && !l.sw) ? `${who} had nothing to sow` : !l.path ? 'Out of seeds' : l.cap ? `${who} captured ${l.cap.n}` : `${who} sowed ${l.n}`; }
// The square's won chime: at the verdict when the count decides it (else the usual moment, audio/sound.js).
export const wonAt = (f, total) => (f.mc && f.mc.sw && f.mc.fin ? mancTimes(f.mc).say : total - 600);
export const drawAt = f => (f.mc && f.mc.sw && f.mc.fin ? mancTimes(f.mc).say : 420);   // a level sweep's reset sound: with its verdict, never during the sowing (audio/sound.js moveSounds)
// The seeds scooped up into the hand, then one marble-on-marble click for each seed dropped (its pitch a little
// different each time, a touch brighter into a bank); a capture: a scoop at each pit, the seeds clicking into the
// bank together, a chime. The sweep: a scoop at each pit it takes, the seeds clicking into their bank together; the
// count: a click as each bank's number goes up, climbing in pitch (thinned where the two counts run together).
const PITCH = [1, 1.09, 0.94, 1.15, 0.97, 1.05, 0.9, 1.12];
export function sounds(f, add, won, mini, last) {
  const l = f.mc; if (!l || (l.end && !l.sw)) return;
  if (l.path) {
    add('mcScoop', 0);
    l.path.forEach(([side, at], k) => add('mcClick', MANC.lift + (k + 1) * MANC.sow, PITCH[k % PITCH.length] * (at === 'bank' ? 1.18 : 1)));
    if (l.cap) {
      const c0 = MANC.lift + l.path.length * MANC.sow, b = c0 + MANC.cap - 120;
      add('mcScoop', c0 + 60); add('mcScoop', c0 + MANC.scoop);
      for (let k = 0; k < Math.min(6, l.cap.n); k++) add('mcClick', b + k * 40, PITCH[(k + 3) % PITCH.length] * 1.15);
      add('ding', c0 + MANC.cap);
    }
  }
  if (!(l.sw && l.fin)) return;
  const T = mancTimes(l);
  if (T.side) {
    T.scoop.forEach(t => add('mcScoop', t));
    for (let k = 0; k < Math.min(6, sum(l.sw[T.side])); k++) add('mcClick', T.drop + k * 40, PITCH[(k + 5) % PITCH.length] * 1.18);
  }
  const ticks = [];                                              // (the count eases out, ui/fx.js countTo: each number shows from half way to it)
  for (const p of ['X', 'O']) { const to = l.fin[p], ms = Math.max(60, T.cms[p]); for (let j = 1; j <= to; j++) ticks.push([T.count + Math.round(ms * (1 - Math.sqrt(1 - (j - 0.5) / to))), j / Math.max(1, l.fin.X, l.fin.O)]); }
  ticks.sort((x, y) => x[0] - y[0]);
  let gap = -1e9; for (const [t, k] of ticks) if (t - gap >= 45) { add('mcClick', t, 1.05 + 0.5 * k); gap = t; }
}
