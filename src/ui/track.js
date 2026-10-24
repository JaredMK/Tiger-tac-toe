// Race tracks (Snakes and Ladders, Candy Race, Bump, the Dice race): the board and the tokens' hops.
import { PLAY } from '../core/timer.js';
import { other } from '../core/util.js';
import { BUMP, BUMP_KNOCK, bumpHops } from '../games/bump/rules.js';
import { CANDY } from '../games/candy/rules.js';
import { DICE_GOAL, diceSlot } from '../games/dice/rules.js';
import { SNL } from '../games/snakes/rules.js';
import { HOP_MS, REDUCED, SPIN_MS, WAAPI, app, esc, state } from './app.js';
import { toonG } from './art.js';

const DIE_MS = PLAY.die;                // the die's tumble before the piece sets off
/* A winding track for the Candy race and the Dice race: rows of spaces joined by curved turns, a path
 * line with direction arrows underneath, a Start before the first space and a Finish after the last.
 * Drawn as SVG so the same picture serves full-size and as the board miniature. Slots: -1 is the
 * Start, 0 to n-1 the spaces, n the Finish. */
const TRACK = { pitch: 13.5, size: 9.5, rowPitch: 19, x0: 7, y0: 8 };
// up: the first row at the bottom, winding upwards (Snakes and Ladders). A Finish after a row that is not
// full sits in the next place along that row.
function trackSpec(n, perRow, up) {
  const rows = Math.ceil(n / perRow), lastRow = rows - 1;
  const cell = i => { const r = Math.floor(i / perRow), c = i % perRow; return { r, c: r % 2 ? perRow - c : c + 1 }; };   // odd rows run right to left
  const Y = r => TRACK.y0 + (up ? lastRow - r : r) * TRACK.rowPitch;
  const at = i => {
    if (i < 0) return [TRACK.x0, Y(0)];
    if (i >= n && n % perRow) { const { r, c } = cell(n); return [TRACK.x0 + c * TRACK.pitch, Y(r)]; }
    if (i >= n) return [lastRow % 2 ? TRACK.x0 : TRACK.x0 + (perRow + 1) * TRACK.pitch, Y(lastRow)];
    const { r, c } = cell(i);
    return [TRACK.x0 + c * TRACK.pitch, Y(r)];
  };
  const right = TRACK.x0 + perRow * TRACK.pitch + (rows > 1 ? TRACK.rowPitch / 2 + 3 : TRACK.size / 2 + 2);
  const w = Math.max(right, at(n)[0] + TRACK.size / 2 + 2), h = TRACK.y0 + lastRow * TRACK.rowPitch + TRACK.size / 2 + 2;
  return { n, perRow, rows, at, cell, w, h, up: !!up };
}
export const CANDY_SPEC = trackSpec(CANDY.len, 6), DICE_SPEC = trackSpec(DICE_GOAL - 1, 5);
export const SNL_SPEC = trackSpec(SNL.n, SNL.perRow, true), BUMP_SPEC = trackSpec(BUMP.n, 5);
// Snakes and Ladders: a ladder (two rails and rungs) or a snake (an S-curve, head at the top) between two
// spaces, drawn over the track. snakeCurve gives the snake's body as cubic Bezier points.
export function snakeCurve(spec, a, b) {
  const [x0, y0] = spec.at(a - 1), [x3, y3] = spec.at(b - 1), dx = x3 - x0, dy = y3 - y0, len = Math.hypot(dx, dy);
  const nx = -dy / len, ny = dx / len, k = Math.min(6, len * .28);
  return [[x0, y0], [x0 + dx * .33 + nx * k, y0 + dy * .33 + ny * k], [x0 + dx * .67 - nx * k, y0 + dy * .67 - ny * k], [x3, y3]];
}
export function bezierAt(P, t) {
  const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [a * P[0][0] + b * P[1][0] + c * P[2][0] + d * P[3][0], a * P[0][1] + b * P[1][1] + c * P[2][1] + d * P[3][1]];
}
// opts: colors (per space, or none for plain numbered spaces), tokens {X, O} as slots (null = none),
// moved (the token hopping right now), finish 'colours' | 'flag', mini (board miniature)
export function trackSvg(spec, opts) {
  const { n, at } = spec, S = TRACK.size, half = S / 2, R = TRACK.rowPitch / 2;
  const pts = [];
  for (let i = -1; i <= (opts.finish === 'none' ? n - 1 : n); i++) pts.push(at(i));   // 'none': the last space is the goal
  let d = `M${pts[0][0]},${pts[0][1]}`, arrows = '';
  const chevron = (x, y, ang) => `<path class="arrow" transform="translate(${x},${y}) rotate(${ang})" d="M-1.3,-1.6 L0.3,0 L-1.3,1.6"/>`;
  for (let k = 1; k < pts.length; k++) {
    const [x1, y1] = pts[k - 1], [x2, y2] = pts[k];
    if (x1 === x2 && y1 !== y2) {                                  // the turn between two rows: a half circle out past the end of the row
      const out = spec.cell(k - 2).r % 2 ? -1 : 1;                   // pts[k - 1] is space k - 2; a row running right turns round the right edge
      d += ` A${R},${R} 0 0 ${(out > 0) !== spec.up ? 1 : 0} ${x2},${y2}`;   // bulging outwards, going down or (up) going up
      for (const t of [-32, 0, 32]) {                                // arrows along the curve, each pointing the way round
        const rad = t * Math.PI / 180, cy = (y1 + y2) / 2;
        arrows += chevron(x1 + out * R * Math.cos(rad), cy + R * Math.sin(rad), 90 + out * t + (spec.up ? 180 : 0));
      }
    } else {
      d += ` L${x2},${y2}`;
      arrows += chevron((x1 + x2) / 2, (y1 + y2) / 2, Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI);
    }
  }
  let spaces = '', nums = '';
  for (let i = 0; i < n; i++) {
    const [x, y] = at(i);
    const color = opts.colors ? opts.colors[i] : opts.goal && i === n - 1 ? 'goal' : 'plain';
    spaces += `<rect class="space ${esc(color)}" x="${x - half}" y="${y - half}" width="${S}" height="${S}" rx="2.2"/>`;
    if (!opts.mini) nums += opts.colors ? `<text class="num" x="${x - half + 1.2}" y="${y - half + 3.2}">${i + 1}</text>` : `<text class="numc" x="${x}" y="${y}">${i + 1}</text>`;
  }
  if (!opts.overlay) { spaces += nums; nums = ''; }                 // with ladders and snakes over the track, the numbers go on top of them
  const pill = (i, cls, inner) => { const [x, y] = at(i); return `<g class="${cls}" transform="translate(${x},${y})">${inner}</g>`; };
  const start = pill(-1, 'start', `<rect class="pill" x="-5.5" y="-3.6" width="11" height="7.2" rx="2.4"/>${opts.mini ? '' : `<text class="lbl" y=".1">${opts.startLabel || 'START'}</text>`}`);
  const cols = ['var(--cr)', 'var(--cy)', 'var(--cg)', 'var(--cb)'];
  const finishFace = opts.finish === 'colours'
    ? cols.map((c, k) => `<rect x="${-5.5 + k * 2.75}" y="-3.6" width="2.75" height="7.2" fill="${c}"/>`).join('')
    : [0, 1, 2, 3].map(k => [0, 1].map(j => `<rect x="${-5.5 + k * 2.75}" y="${-3.6 + j * 3.6}" width="2.75" height="3.6" fill="${(k + j) % 2 ? '#e8e8e8' : '#222'}"/>`).join('')).join('');
  const finish = opts.finish === 'none' ? '' : pill(n, 'finish', `<clipPath id="fin-${spec.n}-${opts.mini ? 'm' : 'f'}"><rect x="-5.5" y="-3.6" width="11" height="7.2" rx="2.4"/></clipPath><g clip-path="url(#fin-${spec.n}-${opts.mini ? 'm' : 'f'})">${finishFace}</g>${opts.mini ? '' : '<rect x="-4.7" y="-1.9" width="9.4" height="3.8" rx="1.9" fill="rgba(0,0,0,.6)"/><text class="lbl" y=".1">FINISH</text>'}`);
  let tokens = '';
  const r = opts.mini ? 4.6 : 3.6;
  for (const p of ['X', 'O']) {
    const slot = opts.tokens[p];
    if (slot == null) continue;
    const [x, y] = at(slot);
    const shared = opts.tokens[other(p)] === slot, dx = shared ? (p === 'X' ? -2.4 : 2.4) : 0;
    const kn = Array.isArray(opts.knocked) ? opts.knocked.includes(p) : opts.knocked === p;
    const moved = Array.isArray(opts.moved) ? opts.moved.includes(p) : opts.moved === p;   // (Super Chaos's round end: both pieces hopping at once)
    tokens += `<g class="tok ${p}${moved ? ' moved' : ''}${kn ? ' knocked' : ''}" data-x="${x + dx}" data-y="${y}" style="transform:translate(${x + dx}px,${y}px)"><g class="pc p${p}" transform="translate(${-r * 1.3} ${-r * 1.3}) scale(${r * 2.6 / 100})">${toonG(p)}</g></g>`;
  }
  return `<svg class="track${opts.mini ? ' small' : ''}${opts.cls ? ' ' + opts.cls : ''}" viewBox="0 0 ${spec.w} ${spec.h}" aria-hidden="true"><path class="path" d="${d}"/>${arrows}${spaces}${opts.overlay || ''}${nums}${start}${finish}${tokens}</svg>`;
}
// Once the wheel stops or the die lands, the piece hops space by space from where it was to where it landed.
// Snakes and Ladders: then up the ladder or down the snake. Bump: the piece landed on is knocked back Home.
export const SLIDE_MS = PLAY.slide, KNOCK_MS = PLAY.knock, SPIN3_MS = PLAY.spin3;
export function hopToken() {
  const f = state.flash;
  if (!f || !['candy', 'dice', 'snakes', 'bump'].includes(f.type) || !WAAPI || REDUCED) return;
  if (f.type === 'bump' && f.scr) { bumpRoundEnd(f); return; }
  if ((f.type === 'candy' || f.type === 'snakes') && f.scr && f.scr.moves) { trackRoundEnd(f); return; }
  const tok = app.querySelector('.gwrap .track .tok.moved');
  if (!tok) return;
  const spec = { candy: CANDY_SPEC, dice: DICE_SPEC, snakes: SNL_SPEC, bump: BUMP_SPEC }[f.type];
  const from = f.type === 'candy' ? f.from : f.type === 'dice' ? diceSlot(f.total - f.roll) : f.from - 1;
  const to = f.type === 'candy' ? f.to : f.type === 'dice' ? diceSlot(f.total) : f.type === 'snakes' ? f.land - 1 : f.to - 1;
  const delay = f.type === 'candy' ? SPIN_MS : f.type === 'bump' ? SPIN3_MS : DIE_MS;
  const stops = [];
  for (let i = from; i <= to; i++) stops.push(spec.at(i));
  const end = [Number(tok.dataset.x), Number(tok.dataset.y)];     // where the piece now sits
  const slide = f.type === 'snakes' && f.via ? (f.via === 'snake'
    ? [.15, .3, .45, .6, .75, .9].map(t => bezierAt(snakeCurve(spec, f.land, f.to), t))
    : [.25, .5, .75].map(t => [stops[stops.length - 1][0] + (end[0] - stops[stops.length - 1][0]) * t, stops[stops.length - 1][1] + (end[1] - stops[stops.length - 1][1]) * t])) : null;
  if (!slide) stops[stops.length - 1] = end;                      // land exactly where the piece now sits
  const hops = stops.length - 1, total = hops * HOP_MS + (slide ? SLIDE_MS : 0), frames = [];
  if (total <= 0) return;
  stops.forEach(([x, y], k) => {
    frames.push({ transform: `translate(${x}px, ${y}px) scale(1)`, offset: k * HOP_MS / total, easing: 'ease-in-out' });
    if (k < hops) {
      const [nx, ny] = stops[k + 1];
      frames.push({ transform: `translate(${(x + nx) / 2}px, ${(y + ny) / 2 - 4}px) scale(1.3)`, offset: (k + .5) * HOP_MS / total, easing: 'ease-in-out' });
    }
  });
  if (slide) {                                                     // up the ladder or along the snake's body, a little bigger
    slide.concat([end]).forEach(([x, y], k, all) => frames.push({ transform: `translate(${x}px, ${y}px) scale(${k === all.length - 1 ? 1 : 1.15})`, offset: (hops * HOP_MS + (k + 1) / all.length * SLIDE_MS) / total, easing: 'linear' }));
  }
  tok.style.animation = 'none';                                    // the CSS pop is only the fallback
  tok.animate(frames, { duration: total, delay, fill: 'both' });
  const hit = f.type === 'bump' && f.bumped && app.querySelector('.gwrap .track .tok.knocked');
  if (hit) {                                                       // knocked back Home: a jolt, then a tumbling arc
    const [lx, ly] = spec.at(f.to - 1), hx = Number(hit.dataset.x), hy = Number(hit.dataset.y);
    hit.style.animation = 'none';
    hit.animate([
      { transform: `translate(${lx}px, ${ly}px) rotate(0deg) scale(1)`, offset: 0 },
      { transform: `translate(${lx + 2}px, ${ly - 2}px) rotate(-25deg) scale(1.25)`, offset: .18 },
      { transform: `translate(${(lx + hx) / 2}px, ${Math.min(ly, hy) - 9}px) rotate(-200deg) scale(1.1)`, offset: .6 },
      { transform: `translate(${hx}px, ${hy}px) rotate(-360deg) scale(1)`, offset: 1 },
    ], { duration: KNOCK_MS, delay: delay + hops * HOP_MS, fill: 'both', easing: 'ease-out' });
  }
}
// Super Chaos's round end in Bump: both pieces hopping at the same time from where the round began (both
// moved here), then any piece knocked from where it landed (side by side, sharing the space) back Home.
function bumpRoundEnd(f) {
  const spec = BUMP_SPEC, scr = f.scr, moves = scr.moves || {}, lead = BUMP_KNOCK.lead, kAt = lead + bumpHops(scr) * HOP_MS;
  const side = p => (p === 'X' ? -2.4 : 2.4), pt = (slot, dx) => { const [x, y] = spec.at(slot - 1); return [x + dx, y]; };
  for (const p of ['X', 'O']) {
    const tok = app.querySelector(`.gwrap .track .tok.${p}`), mv = moves[p], kn = scr.knocked.includes(p), o = other(p);
    if (!tok || (!mv && !kn)) continue;
    const s0 = mv ? mv.from : scr.at[p], so = moves[o] ? moves[o].from : scr.at[o];
    const end = [Number(tok.dataset.x), Number(tok.dataset.y)];
    const land = kn ? pt(scr.at[p], scr.at.X === scr.at.O ? side(p) : 0) : end;
    const keys = [[0, pt(s0, s0 === so ? side(p) : 0), 1, 0], [lead, pt(s0, s0 === so ? side(p) : 0), 1, 0]];   // [time, [x, y], scale, turn]
    if (mv) for (let i = mv.from + 1; i <= mv.to; i++) {
      const a = keys[keys.length - 1][1], b = i === mv.to ? land : pt(i, 0), t = lead + (i - mv.from) * HOP_MS;
      keys.push([t - HOP_MS / 2, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 4], 1.3, 0], [t, b, 1, 0]);
    }
    const total = kAt + (kn ? KNOCK_MS : 0) + 1;
    keys.push([kAt, land, 1, 0]);
    if (kn) {
      const d = p === 'X' ? -1 : 1;
      keys.push([kAt + KNOCK_MS * .18, [land[0] + 2 * d, land[1] - 2], 1.25, 25 * d], [kAt + KNOCK_MS * .6, [(land[0] + end[0]) / 2, Math.min(land[1], end[1]) - 9], 1.1, 200 * d], [kAt + KNOCK_MS, end, 1, 360 * d]);
    }
    keys.sort((a, b) => a[0] - b[0]);
    tok.style.animation = 'none';
    tok.animate(keys.map(([t, [x, y], sc, r]) => ({ transform: `translate(${x}px, ${y}px) rotate(${r}deg) scale(${sc})`, offset: Math.min(1, t / total), easing: 'ease-in-out' })), { duration: total, fill: 'both' });
  }
}
// Super Chaos's round end in Candy Race and Snakes and Ladders: both pieces hopping at the same time from
// where the round began (both moved here), each its own spaces, then, in Snakes and Ladders, each up its ladder
// or down its snake. The wheel or die first, as for one move; a piece that shares a space with the other sits
// a little to its side.
function trackRoundEnd(f) {
  const snl = f.type === 'snakes', spec = snl ? SNL_SPEC : CANDY_SPEC, moves = f.scr.moves, lead = snl ? DIE_MS : SPIN_MS;
  const slot = v => (snl ? v - 1 : v), side = p => (p === 'X' ? -2.4 : 2.4);
  for (const p of ['X', 'O']) {
    const tok = app.querySelector(`.gwrap .track .tok.${p}`), mv = moves[p], o = other(p);
    if (!tok || !mv) continue;
    const from = slot(mv.from), land = slot(snl ? mv.land : mv.to), shared = moves[o] && moves[o].from === mv.from;
    const end = [Number(tok.dataset.x), Number(tok.dataset.y)];     // where the piece now sits (its final space, beside the other's if they share it)
    const stops = [];
    for (let i = from; i <= land; i++) stops.push(spec.at(i));
    if (shared) stops[0] = [stops[0][0] + side(p), stops[0][1]];
    const slide = snl && mv.via ? (mv.via === 'snake'
      ? [.15, .3, .45, .6, .75, .9].map(t => bezierAt(snakeCurve(spec, mv.land, mv.to), t))
      : [.25, .5, .75].map(t => [stops[stops.length - 1][0] + (end[0] - stops[stops.length - 1][0]) * t, stops[stops.length - 1][1] + (end[1] - stops[stops.length - 1][1]) * t])) : null;
    if (!slide) stops[stops.length - 1] = end;
    const hops = stops.length - 1, total = lead + hops * HOP_MS + (slide ? SLIDE_MS : 0) + 1, frames = [];
    frames.push({ transform: `translate(${stops[0][0]}px, ${stops[0][1]}px) scale(1)`, offset: 0 });
    stops.forEach(([x, y], k) => {
      frames.push({ transform: `translate(${x}px, ${y}px) scale(1)`, offset: (lead + k * HOP_MS) / total, easing: 'ease-in-out' });
      if (k < hops) {
        const [nx, ny] = stops[k + 1];
        frames.push({ transform: `translate(${(x + nx) / 2}px, ${(y + ny) / 2 - 4}px) scale(1.3)`, offset: (lead + (k + .5) * HOP_MS) / total, easing: 'ease-in-out' });
      }
    });
    if (slide) slide.concat([end]).forEach(([x, y], k, all) => frames.push({ transform: `translate(${x}px, ${y}px) scale(${k === all.length - 1 ? 1 : 1.15})`, offset: (lead + hops * HOP_MS + (k + 1) / all.length * SLIDE_MS) / total, easing: 'linear' }));
    frames.push({ transform: `translate(${end[0]}px, ${end[1]}px) scale(1)`, offset: 1 });
    tok.style.animation = 'none';
    tok.animate(frames, { duration: total, fill: 'both' });
  }
}
export function trackSounds(f, add, won, mini, last) {
  add('rattle', 0); add('thunk', DIE_MS);
  const mvs = f.type === 'snakes' && f.scr && f.scr.moves ? Object.values(f.scr.moves) : [f];   // (Super Chaos's round end: both pieces at once)
  const steps = f.type === 'snakes' ? Math.max(...mvs.map(mv => Math.max(1, mv.land - mv.from))) : Math.max(1, diceSlot(f.total) - diceSlot(f.total - f.roll));
  for (let k = 0; k < steps; k++) add('hop', DIE_MS + k * HOP_MS);
  if (mvs.some(mv => mv.via === 'ladder')) add('climb', DIE_MS + steps * HOP_MS);
  if (mvs.some(mv => mv.via === 'snake')) add('slide', DIE_MS + steps * HOP_MS);
  return;
}
