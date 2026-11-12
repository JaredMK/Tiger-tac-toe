// Peg Drop: the screen, the miniature, the move's words and sounds, and the inputs.
import { makeRng } from '../../core/random.js';
import { PLINKO_DEFAULTS } from './meta.js';
import { PLINKO, plinkoBonusPts, plinkoTouches, setPlinkoConfig } from './rules.js';
import { FIREBASE_CONFIG, configured } from '../../net/connect.js';
import { N, mv, state } from '../../ui/app.js';
import { KEY } from '../../ui/config.js';
import { arcTally, lateAt } from '../../ui/progress.js';

// Peg Drop's target (config/plinko, the admin's dashboard): likewise.
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
// Peg Drop: one board, drawn as an SVG (PK: its sizes, 100 across): the seven slots along the top (a chip in the mover's
// colour waiting in every open one: a tap drops it; a used slot stands empty), six rows of pegs (round studs, the gold
// bonus peg with its points over it), and the seven bins along the bottom, each a pocket over a plate that carries its
// points (shaded light to dark, 1 to 5). The chip falls from its slot and bounces peg to peg along the path the move was
// given (the left or right at each peg is the server's; only the motion between is drawn here), every peg it touches
// lighting for a moment, turning as it goes; it drops into its bin, squashes, hops once and settles: the pocket lights,
// its points pop, the mover's gauge and total fill; the points (and any bonus) are said in the result line under the
// board (nothing over it). All of it timed from the move (plinkoTimes), so a replay plays the same.
const PK = { w: 100, h: 115, pad: 7.5, slot: 9.5, row0: 25, dy: 11.8, pocket: 93, floor: 105.2, plate: 105.8, chip: 4.6, peg: 1.9, bonus: 2.7 };
const pkX = x => PK.pad + (x / 12) * (PK.w - 2 * PK.pad);       // a half-slot's place across (0 to 12; a slot or a bin at an even one)
const pkY = r => PK.row0 + (r - 1) * PK.dy;                       // a row of pegs' place down (1 to 6)
const n1 = v => v.toFixed(1);
// The moments of a drop (ms into the move): the chip on each row's peg (touch[0] the first row), in its bin (bin), at
// rest (end). A touch is never quite on the beat (each a little early or late, drawn from the drop itself, so every
// phone and every redraw has the same): a chip that clicks down like a metronome reads as a machine.
export function plinkoTimes(pl) {
  const rng = makeRng('plk:' + pl.slot + ':' + pl.path.map(r => (r ? 1 : 0)).join('')), T = PLINKO.rows * PLINKO.step, touch = [];
  for (let r = 1; r <= PLINKO.rows; r++) touch.push(Math.round(r * PLINKO.step + (r < PLINKO.rows ? (rng() - 0.5) * 0.3 * PLINKO.step : 0)));
  return { touch, bin: T + PLK_FALL, end: T + PLINKO.land, rng };
}
const PLK_FALL = 190;                                             // from the last peg down into the bin
// The chip's way down as keyframes: [{ ms, x, y, sx, sy, a }] (its foot's place, its squash, its turn in degrees). From
// the slot it drops onto the first peg; at each peg it squashes a little, pops up and out half a column in a short arc
// (across at a steady pace, up then down as a parabola in time), a touch higher or lower each time, turning the way it
// goes, and lands on the next; off the last peg it drops into its bin, squashes, hops once and settles.
export function plinkoFrames(pl) {
  const t = plinkoTimes(pl), rng = t.rng, out = [], foot = (x, r) => pkY(r) - PK.peg;   // the chip's foot on the peg's top
  const key = (ms, x, y, a, sx = 1, sy = 1) => out.push({ ms, x, y, a, sx, sy });
  let x = pl.slot * 2, a = 0;
  const x0 = pkX(x), y0 = PK.slot + PK.chip, y1 = foot(x, 1);
  for (let k = 0; k <= 6; k++) { const u = k / 6; key(u * t.touch[0], x0, y0 + (y1 - y0) * u * u, 0); }   // the first drop, from rest
  for (let r = 1; r <= PLINKO.rows; r++) {
    const last = r === PLINKO.rows, t0 = t.touch[r - 1], t1 = last ? t.bin : t.touch[r], dir = pl.path[r - 1] ? 1 : -1, nx = x + dir;
    const ax = pkX(x), ay = foot(x, r), bx = pkX(nx), by = last ? PK.floor : foot(nx, r + 1);
    const D = by - ay, h = D * (last ? 0.34 : 0.6 + rng() * 0.34), turn = dir * (last ? 70 : 88);   // the pop: well over half the drop to the next row, above the peg
    key(t0, ax, ay, a, 1.2, 0.8);                                  // the contact: a slight squash
    for (let k = 1; k <= 8; k++) { const u = k / 8; key(t0 + (t1 - t0) * u, ax + (bx - ax) * u, ay + D * u - 4 * h * u * (1 - u), a + turn * u, last && k === 8 ? 1.24 : 1, last && k === 8 ? 0.76 : 1); }
    x = nx; a += turn;
  }
  const ex = pkX(x);                                              // in the bin: the squash above, a little hop, at rest
  key(t.bin + 80, ex, PK.floor - 2.4, a + 6); key(t.bin + 160, ex, PK.floor, a + 10, 1.08, 0.92); key(t.end, ex, PK.floor, a + 10);
  return out;
}
const CHIP_MARK = { X: '<path class="pkmk" d="M-1.9 -1.9L1.9 1.9M1.9 -1.9L-1.9 1.9"/>', O: '<circle class="pkmk" r="1.9"/>' };
// A chip (its foot at 0,0): its shadow on the board, the disc in its player's colour with a lighter ring and their drawn mark, which turns with it (.pkroll).
const chipG = (p, roll) => `<ellipse class="pksh" cx=".9" cy="${n1(-PK.chip + 1.1)}" rx="${PK.chip}" ry="${PK.chip}"/><g class="pkroll"${roll ? ` style="${roll}"` : ''}><circle class="pkdisc" cy="${-PK.chip}" r="${PK.chip}"/><circle class="pkring" cy="${-PK.chip}" r="${n1(PK.chip - 1.25)}"/><g transform="translate(0 ${-PK.chip})">${CHIP_MARK[p] || ''}</g></g>`;
const STAR = 'M0 -5 L1.4 -1.6 5 -1.5 2.2 .8 3.1 4.4 0 2.4 -3.1 4.4 -2.2 .8 -5 -1.5 -1.4 -1.6z';
function plinkoTable(mini, a, o) {
  const pl = a && a.plinko ? a.plinko : null, l = mini.last, turn = o.turn, tg = mini.target || PLINKO_DEFAULTS.target, by = pl ? a.by : null;
  const t = pl ? plinkoTimes(pl) : null, inBin = pl ? t.bin : 0, bp = plinkoBonusPts(mini), col = (PK.w - 2 * PK.pad) / 6;
  const pct = v => (100 * Math.min(1, v / tg)).toFixed(1) + '%';
  const tal = p => {   // the gauge and the total: both take the drop's points as the chip lands in its bin
    const add = pl && by === p ? pl.pts : 0, now = add ? pl.total : mini.pts[p];   // (the mover's total from the move itself)
    return arcTally(p, o, `<span class="wtal"><span class="wbar" aria-hidden="true"><i${add ? ' class="grow"' : ''} style="--w0:${pct(now - add)};--w1:${pct(now)};--t:${inBin}ms;--d:350ms"></i></span><span class="plkpts" aria-label="${now} of ${tg}">${add ? `<b class="cnt" data-from="${now - add}" data-delay="${inBin}" data-ms="350">${now}</b>` : `<b>${now}</b>`}<small>/${tg}</small></span></span>`);
  };
  // the pegs: a stud each (its shadow down and to the right); one the chip touches lights as it is touched
  const touched = pl ? plinkoTouches(pl.slot, pl.path) : [], pegs = [];
  for (let r = 1; r <= PLINKO.rows; r++) for (let x = (r - 1) % 2; x <= 12; x += 2) {
    const hit = pl && touched[r - 1] === x;
    pegs.push(`<g class="pkpeg${hit ? ' hit' : ''}" transform="translate(${n1(pkX(x))} ${n1(pkY(r))})"${hit ? ` style="--t:${t.touch[r - 1]}ms"` : ''}><circle class="pksh" cx=".9" cy="1.2" r="${PK.peg}"/><circle class="pkst" r="${PK.peg}"/><circle class="pkhl" cx="-.6" cy="-.6" r=".55"/></g>`);
  }
  // the bins: a pocket (its inside in shadow) between two posts, over the plate that carries its points; the chip's lights as it lands
  const bins = Array.from({ length: PLINKO.slots }, (_, b) => {
    const cx = pkX(b * 2), x0 = cx - col / 2, lit = pl && pl.bin === b, v = mini.vals[b], st = lit ? ` style="--t:${inBin}ms"` : '';
    return `<g class="pkbin v${v}${lit ? ' lit ' + by : ''}"${st}><rect class="pkpocket" x="${n1(x0)}" y="${PK.pocket}" width="${n1(col)}" height="${n1(PK.plate - PK.pocket)}"/><rect class="pkplate" x="${n1(x0 + 0.9)}" y="${PK.plate}" width="${n1(col - 1.8)}" height="${n1(PK.h - PK.plate - 1.2)}" rx="1.6"/><text class="pkval" x="${n1(cx)}" y="${n1(PK.plate + 6.55)}">${v}</text></g>`;
  }).join('');
  const posts = Array.from({ length: PLINKO.slots + 1 }, (_, k) => { const x = pkX(k * 2) - col / 2; return `<path class="pkpost" d="M${n1(x)} ${PK.pocket - 2.6} V${PK.plate}"/><path class="pkgate" d="M${n1(x)} 0 V${n1(PK.slot + PK.chip + 1.6)}"/>`; }).join('');
  // the bonus peg, gold, its points over it: touched, it bursts, its points lift off, and it stays as a spent peg (ticked) for the rest of the move (the next one shows from the next turn)
  const bq = pl && pl.hit ? pl.bonus : pl ? pl.bonus || mini.bonus : mini.bonus, spent = !!(pl && pl.hit);
  const bonus = bq ? `<g class="pkbonus${spent ? ' hit' : ''}" transform="translate(${n1(pkX(bq.x))} ${n1(pkY(bq.r))})"${spent ? ` style="--t:${t.touch[bq.r - 1]}ms"` : ''} aria-label="Bonus peg: ${spent ? 'hit' : '+' + bp}"><circle class="pkglow" r="${n1(PK.bonus + 2.2)}"/><circle class="pksh" cx=".7" cy=".9" r="${PK.bonus}"/><circle class="pkgold" r="${PK.bonus}"/><circle class="pkhl" cx="-.9" cy="-.9" r=".7"/><path class="pktick" d="M-1.3 .1l.9 1 1.7 -2"/><text class="pkplus" y="${n1(-PK.bonus - 1.6)}">+${bp}</text></g>` : '';
  let chip = '', style = '', burst = '';
  if (pl) {                                                      // the drop: peg to peg along the server's path, timed from the move
    const name = `pk${pl.slot}${pl.path.map(r => (r ? 1 : 0)).join('')}`, fr = plinkoFrames(pl), dur = t.end, at = f => `${Math.max(0, Math.min(100, f.ms / dur * 100)).toFixed(2)}%`;
    style = `<style>@keyframes ${name} { ${fr.map(f => `${at(f)} { transform: translate(${f.x.toFixed(2)}px, ${f.y.toFixed(2)}px) scale(${f.sx}, ${f.sy}); }`).join(' ')} } @keyframes ${name}r { ${fr.map(f => `${at(f)} { transform: rotate(${f.a.toFixed(1)}deg); }`).join(' ')} }</style>`;
    const end = fr[fr.length - 1];
    chip = `<g class="pkchip ${by} drop" style="--path:${name};--d:${dur}ms;transform:translate(${end.x.toFixed(2)}px, ${end.y.toFixed(2)}px)">${chipG(by, `--path:${name}r;--d:${dur}ms;transform:rotate(${end.a.toFixed(1)}deg)`)}</g>`;   // (where it ends, without the motion)
    if (a.kind === 'claim' || a.kind === 'match') burst = `<g class="pkstars" style="--t:${inBin}ms" transform="translate(${n1(end.x)} ${n1(PK.floor - PK.chip)})"><circle class="aring" r="6"/>${[[-17, -15], [16, -17], [-24, -3], [24, -4], [-7, -24], [8, -25]].map(([dx, dy], k) => `<path class="star" d="${STAR}" style="--dx:${dx}px;--dy:${dy}px;--k:${k}"/>`).join('')}</g>`;   // the winning drop: a ring and stars from its bin
  } else if (l && o.view) chip = `<g class="pkchip ${l.by}" style="transform:translate(${n1(pkX(l.bin * 2))}px, ${PK.floor}px)">${chipG(l.by)}</g>`;   // (a square opened shows clear bins; a past game's view keeps its last chip)
  // the slots: a button each over its place on the board; an open one holds a chip in the mover's colour (pressed, it lights its column), a used one is empty
  const slots = o.view ? '' : `<div class="pslots" role="group" aria-label="Drop slots">${Array.from({ length: PLINKO.slots }, (_, k) => {
    const gone = pl && pl.slot === k, used = mini.used[k] || gone, back = pl && pl.reset && !gone;   // (all seven used: the others come back as the chip lands)
    return `<button class="${turn}${used ? ' used' : ''}" data-act="move" ${mv(k)}${o.locked || used ? ' disabled' : ''} aria-label="${used ? `Slot ${k + 1}: used` : `Drop from slot ${k + 1}`}"><i class="pkgh${back ? ' pkre' : ''}"${back ? ` style="--t:${inBin + k * 40}ms"` : ''} aria-hidden="true"></i></button>`; }).join('')}</div>`;
  const res = pl ? `<p ${lateAt('arcres' + (pl.pts >= 3 ? ' ok' : ''), inBin)} role="status">+${pl.pts}${pl.hit ? ` (bonus +${bp})` : ''}: ${pl.total} of ${tg}${a.kind === 'claim' || a.kind === 'match' ? '!' : ''}${pl.reset ? '<br><small>All seven used: every slot opens again</small>' : ''}</p>`
    : l && o.view ? `<p class="arcres"><b class="${l.by}">${N(l.by)}</b> reached ${mini.pts[l.by]}</p>`
    : '<p class="arcnote"></p>';
  return `<div class="g-arc g-plk"><div class="ctals">${tal('X')}${tal('O')}</div><div class="plinko"><div class="pboard pc-${(by || turn) === 'O' ? 'O' : 'X'}">${style}<svg viewBox="0 0 ${PK.w} ${PK.h}" aria-hidden="true">${posts}${bins}${pegs.join('')}${bonus}${chip}${burst}</svg>${slots}</div>${res}</div></div>`;
}
// The miniature: the board small (its pegs, the gold bonus peg, the bins shaded by their points, the last drop's chip in its
// bin in the dropper's colour), and under it each player's mark, a bar to the target and their points.
export function miniature(mini, final) {
  const pts = mini.pts || { X: 0, O: 0 }, tg = mini.target || PLINKO_DEFAULTS.target, vals = mini.vals || [], l = mini.last, b = mini.bonus;
  const X = x => 6 + x * 6, Y = r => 5 + (r - 1) * 5.4, pegs = [];
  for (let r = 1; r <= 4; r++) for (let x = (r - 1) % 2; x <= 12; x += 2) pegs.push(`<circle class="tpkp" cx="${X(x)}" cy="${n1(Y(r))}" r="1.5"/>`);
  const bins = vals.map((v, k) => `<rect class="tpkb v${v}" x="${X(k * 2) - 5.4}" y="28" width="10.8" height="11" rx="1.6"/>`).join('');
  const gold = b && b.r <= 4 ? `<circle class="tpkg" cx="${X(b.x)}" cy="${n1(Y(b.r))}" r="2.4"/>` : '';
  const chip = l && (l.by === 'X' || l.by === 'O') ? `<circle class="tpkc ${l.by}" cx="${X(l.bin * 2)}" cy="33.5" r="4"/>` : '';
  return `<div class="tplk" aria-label="Peg Drop: X ${pts.X}, O ${pts.O} of ${tg} points"><svg class="tpkbd" viewBox="0 0 84 41" aria-hidden="true">${pegs.join('')}${gold}${bins}${chip}</svg>
    <div class="trun bscore">${['X', 'O'].map(p => `<div class="tr ${p}"><b class="${p}">${p}</b><i style="--w:${(100 * Math.min(1, pts[p] / tg)).toFixed(1)}%"></i><span>${Math.min(tg, pts[p])}</span></div>`).join('')}</div></div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = plinkoTable(mini, a, { view, locked, turn, zoom: state.zoom }); return g;
}
export function moveText(f, who) {
  return f.plinko ? `${who} dropped from slot ${f.plinko.slot + 1}: +${f.plinko.pts}${f.plinko.hit ? ' with the bonus' : ''}` : `${who} dropped`;
}
// The chip let go (a soft click); a click on every peg it touches, each at its own moment, higher as it nears the bins and a
// shade higher still going right than left; a ding on the bonus peg; the thunk into its bin, then its points; the winning
// drop sparkles.
export function sounds(f, add, won, mini, last) {
  const pl = f.plinko;
  if (!pl) return;
  const t = plinkoTimes(pl);
  add('marker', 0, 0.8);
  t.touch.forEach((ms, k) => add('peg', ms, 0.86 + 0.045 * k + (pl.path[k] ? 0.05 : 0)));
  if (pl.hit) add('ding', t.touch[pl.bonus.r - 1]);
  add('point', t.bin + 150, 1 + 0.05 * Math.min(6, pl.pts));
  add('thunk', t.bin);                                            // (last of the results: the buzz comes with the landing)
  if (won) add('sparkle', t.end);
}
