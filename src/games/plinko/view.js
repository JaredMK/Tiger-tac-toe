// Plinko: the screen, the miniature, the move's words and sounds, and the inputs.
import { makeRng } from '../../core/random.js';
import { PLINKO_DEFAULTS } from './meta.js';
import { PLINKO, plinkoBonusPts, setPlinkoConfig } from './rules.js';
import { FIREBASE_CONFIG, configured } from '../../net/connect.js';
import { N, mv, state } from '../../ui/app.js';
import { KEY } from '../../ui/config.js';
import { arcTally, lateAt } from '../../ui/progress.js';

// Plinko's target (config/plinko, the admin's dashboard): likewise.
const PLINKO_KEY = KEY + '.plinkocfg';
export function fetchPlinkoConfig() {
  try { const v = JSON.parse(localStorage.getItem(PLINKO_KEY) || 'null'); if (v && typeof v === 'object') setPlinkoConfig(v); } catch (e) { /* none kept */ }
  if (!configured()) return;
  const hook = window.TTT_FIREBASE, c = (hook && hook.config) || FIREBASE_CONFIG;
  const url = hook && hook.emulator ? `http://${hook.emulator.host}:${hook.emulator.port}/config/plinko.json?ns=${c.projectId}-default-rtdb` : `${c.databaseURL}/config/plinko.json`;
  try {
    fetch(url).then(r => (r.ok ? r.json() : null)).then(v => {
      if (!v || typeof v !== 'object') return;
      setPlinkoConfig(v);
      try { localStorage.setItem(PLINKO_KEY, JSON.stringify(v)); } catch (e) { /* no storage: read again next visit */ }
    }).catch(() => {});
  } catch (e) { /* offline: as last known */ }
}
// Plinko: the slots to drop from, the pegs, the bins (WIN marked); the chip bounces peg to peg along the
// path the move was given, then the bin lights.
// The chip's way down as keyframes. From the slot it drops onto the first peg; at each peg it squashes
// a little, pops up and out half a column in a short arc (gravity: across at a steady pace, up then
// down as a parabola in time), a touch higher or lower each time, and lands on the next; off the last
// peg it drops into its bin, squashes, hops once and settles. The left or right at each peg is the
// server's path: only the motion between pegs is drawn here, its heights from a generator seeded by the
// drop itself, so every redraw draws the same arcs. Positions are the chip's bottom (the chip sits on
// the point: translate -50%), so it rests on a peg's top and in the bin.
const PLK_BIN_Y = 96.6;                                         // the chip's bottom in its bin, on the bin's floor (percent of the board)
function plinkoFrames(pl, seedKey) {
  const T = PLINKO.rows * PLINKO.step, dur = T + PLINKO.land, rng = makeRng('plk:' + seedKey), out = [];
  const key = (ms, x, y, sx = 1, sy = 1) => out.push({ p: Math.max(0, Math.min(100, ms / dur * 100)), x, y, sx, sy });
  const onPeg = (x, r) => plinkoXY(x, r)[1] - 1.7;                // the chip's bottom on the peg's top
  let x = pl.slot * 2;
  const [x0, y0] = plinkoXY(x, 0), y1 = onPeg(x, 1);
  for (let k = 0; k <= 6; k++) { const u = k / 6; key(u * PLINKO.step, x0, y0 + (y1 - y0) * u * u); }   // the first drop, from rest
  for (let r = 1; r <= PLINKO.rows; r++) {
    const last = r === PLINKO.rows, t0 = r * PLINKO.step, seg = last ? 120 : PLINKO.step, nx = x + (pl.path[r - 1] ? 1 : -1);
    const ax = plinkoXY(x, r)[0], ay = onPeg(x, r), bx = plinkoXY(nx, last ? PLINKO.rows + 1 : r + 1)[0], by = last ? PLK_BIN_Y : onPeg(nx, r + 1);
    const D = by - ay, h = D * (last ? 0.3 : 0.62 + rng() * 0.32);   // the pop: about a fifth to a half of the drop to the next row, above the peg
    key(t0, ax, ay, 1.2, 0.8);                                     // the contact: a slight squash
    for (let k = 1; k <= 8; k++) { const u = k / 8; key(t0 + seg * u, ax + (bx - ax) * u, ay + D * u - 4 * h * u * (1 - u), last && k === 8 ? 1.22 : 1, last && k === 8 ? 0.78 : 1); }
    x = nx;
  }
  const ex = plinkoXY(x, PLINKO.rows + 1)[0], tb = T + 120;           // in the bin: the squash above, a little hop, at rest
  key(tb + 90, ex, PLK_BIN_Y - 3); key(tb + 180, ex, PLK_BIN_Y, 1.08, 0.92); key(tb + 260, ex, PLK_BIN_Y); key(dur, ex, PLK_BIN_Y);
  return out;
}
const PK = { pad: 6, top: 10, rows: PLINKO.rows, bottom: 86 };    // the board in percent: the chip starts at the top and the bins sit at the bottom
function plinkoXY(x, r) { return [PK.pad + (x / 12) * (100 - 2 * PK.pad), r <= 0 ? PK.top : r > PLINKO.rows ? PK.bottom + 4 : PK.top + (r / (PLINKO.rows + 1)) * (PK.bottom - PK.top)]; }
// Plinko: each bin's points under it (shaded light to dark, 1 to 5); the bonus peg, gold and marked +2; the slots dropped
// from greyed until all seven are used. The chip bounces down along the server's path; touching the bonus
// peg, it lights (and the next bonus peg shows when the chip lands); in its bin, the bin lights, the player's
// total counts up and the points (and any bonus) are said in the result line under the board (nothing over it).
function plinkoTable(mini, a, o) {
  const pl = a && a.plinko ? a.plinko : null, l = mini.last, turn = o.turn, tg = mini.target || PLINKO_DEFAULTS.target;
  const T = PLINKO.rows * PLINKO.step, land = T + PLINKO.land, inBin = T + 120, bp = plinkoBonusPts(mini);
  const score = p => {
    const now = mini.pts[p];
    return pl && a.by === p ? `<span class="ppts"><span class="tu" style="--u:${inBin}ms">${now - pl.pts}</span><span class="tf" style="--f:${inBin}ms">${now}</span></span>` : `<span class="ppts"><span>${now}</span></span>`;
  };
  const tal = p => arcTally(p, o, `<span class="plkpts">${score(p)}<small>/${tg}</small></span>`);
  const pegs = [];
  for (let r = 1; r <= PLINKO.rows; r++) for (let x = (r - 1) % 2; x <= 12; x += 2) { const [px, py] = plinkoXY(x, r); pegs.push(`<circle class="peg" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="1.6"/>`); }
  const w = (100 - 2 * PK.pad) / 6.6;
  const bins = Array.from({ length: PLINKO.slots }, (_, b) => { const [bx] = plinkoXY(b * 2, 0), lit = pl && pl.bin === b;
    return `<rect ${lateAt('bin v' + mini.vals[b], lit ? inBin : null, 'lit')} x="${(bx - w / 2).toFixed(1)}" y="${PK.bottom}" width="${w.toFixed(1)}" height="12" rx="2"/>`; }).join('');
  const vals = mini.vals.map((v, b) => `<span class="pval v${v}" style="left:${plinkoXY(b * 2, 0)[0].toFixed(1)}%">${v}</span>`).join('');
  const peg = (q, cls, extra = '', label = `Bonus peg: +${bp}`) => { const [x, y] = plinkoXY(q.x, q.r); return `<div ${cls} style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%${extra}" aria-label="${label}"><b>+${bp}</b><i>✓</i></div>`; };
  let bonus = '';
  if (pl && pl.hit) {                                              // the bonus peg touched: it lights and pops +2, then stays, marked hit, for the rest of the turn (the next one shows from the next turn)
    const th = pl.bonus.r * PLINKO.step;
    bonus = peg(pl.bonus, 'class="pbonus hit"', `;--t:${th}ms`, 'Bonus peg: hit');
  } else if (mini.bonus) bonus = peg(mini.bonus, 'class="pbonus"');
  let chip = '', style = '';
  if (pl) {                                                      // the drop: bounces peg to peg along the server's path, timed from the move
    const name = `pk${String(a.at || a.square)}${pl.slot}${pl.path.map(r => (r ? 1 : 0)).join('')}`.replace(/[^a-z0-9]/gi, '');
    const frames = plinkoFrames(pl, name).map(f => `${f.p.toFixed(2)}% { left: ${f.x.toFixed(2)}%; top: ${f.y.toFixed(2)}%; transform: translate(0, -100%) scale(${f.sx}, ${f.sy}); }`).join(' ');
    style = `<style>@keyframes ${name} { ${frames} }</style>`;
    const [ex] = plinkoXY(pl.bin * 2, PLINKO.rows + 1);
    chip = `<div class="pchip ${a.by} drop" style="--path:${name};--d:${land}ms;left:${ex.toFixed(1)}%;top:${PLK_BIN_Y}%"></div>`;   // (where it ends, without the motion)
  } else if (l && o.view) { const [cx] = plinkoXY(l.bin * 2, PLINKO.rows + 1); chip = `<div class="pchip ${l.by}" style="left:${cx.toFixed(1)}%;top:${PLK_BIN_Y}%"></div>`; }   // (a square opened shows clear bins; a past game's view keeps its last chip)
  const slots = o.view ? '' : `<div class="pslots" role="group" aria-label="Drop slots">${Array.from({ length: PLINKO.slots }, (_, k) => { const used = mini.used[k];
    return `<button class="${turn}${used ? ' used' : ''}" data-act="move" ${mv(k)}${o.locked || used ? ' disabled' : ''} aria-label="${used ? `Slot ${k + 1}: used` : `Drop from slot ${k + 1}`}">${k + 1}</button>`; }).join('')}</div>`;
  const won = pl && (a.kind === 'claim' || a.kind === 'match'), open = PLINKO.slots - mini.used.filter(Boolean).length;
  const res = pl ? `<p ${lateAt('arcres ' + (pl.pts >= 3 ? 'ok' : 'no'), inBin)} role="status">${won ? `+${pl.pts}${pl.hit ? ` (bonus +${bp})` : ''}: ${pl.total} of ${tg}!` : `+${pl.pts}${pl.hit ? ` (bonus +${bp})` : ''}: ${pl.total} of ${tg}`}${pl.reset ? '<br><small>All seven used: every slot opens again</small>' : ''}</p>`
    : l && o.view ? `<p class="arcres"><b class="${l.by}">${N(l.by)}</b> reached ${mini.pts[l.by]}</p>`
    : '<p class="arcnote"></p>';
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="plinko">${slots}<div class="pboard">${style}<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${pegs.join('')}${bins}</svg><div class="pvals">${vals}</div>${bonus}${chip}</div>${res}</div></div>`;
}
export function miniature(mini, final) {
  const pts = mini.pts || { X: 0, O: 0 }, tg = mini.target || PLINKO_DEFAULTS.target; return `<div class="tplk" aria-label="Plinko: X ${pts.X}, O ${pts.O} of ${tg} points"><div class="tbins">${(mini.vals || []).map((v, b) => `<i class="v${v}${mini.last && mini.last.bin === b ? ' ' + mini.last.by : ''}">${v}</i>`).join('')}</div><div class="tbpts">${['X', 'O'].map(p => `<div class="tr ${p}"><b class="${p}">${p}</b><span>${Math.min(tg, pts[p])}</span><small>/${tg}</small></div>`).join('')}</div></div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = plinkoTable(mini, a, { view, locked, turn, zoom: state.zoom }); return g;
}
export function moveText(f, who) {
  return f.plinko ? `${who} dropped from slot ${f.plinko.slot + 1}: +${f.plinko.pts}${f.plinko.hit ? ' with the bonus' : ''}` : `${who} dropped`;
}
export function sounds(f, add, won, mini, last) {
  for (let k = 1; k <= PLINKO.rows; k++) add('peg', k * PLINKO.step, 1 + (k % 3) * 0.08); add('plop', PLINKO.rows * PLINKO.step + 120); if (f.plinko) { if (f.plinko.hit) add('ding', f.plinko.bonus.r * PLINKO.step); add('point', PLINKO.rows * PLINKO.step + 160); if (won) add('sparkle', PLINKO.rows * PLINKO.step + PLINKO.land); } return;
}
