// Race tracks (Snakes and Ladders, Candy Race, Bump, the Dice race): the board and the tokens' hops.
import { PLAY } from '../core/timer.js';
import { other } from '../core/util.js';
import { BUMP, BUMP_KNOCK, bumpHops } from '../games/bump/rules.js';
import { CANDY } from '../games/candy/rules.js';
import { DICE_GOAL, diceSlot } from '../games/dice/rules.js';
import { HOPS, hopAt } from '../games/shared/hops.js';
import { SNL } from '../games/snakes/rules.js';
import { REDUCED, SPIN_MS, WAAPI, app, esc, state } from './app.js';
import { toonG } from './art.js';
import { DIE_BOUNCE } from './dice.js';

const DIE_MS = PLAY.die;                // the die's tumble before the piece sets off
/* A winding track for the Candy race and the Dice race: rows of spaces joined by curved turns, a path
 * line with direction arrows underneath, a Start before the first space and a Finish after the last.
 * Drawn as SVG so the same picture serves full-size and as the board miniature. Slots: -1 is the
 * Start, 0 to n-1 the spaces, n the Finish. Every space is a raised tile (an ink lip under it: the light
 * comes from above), every piece a round counter with its player's drawn mark and a shadow on the board. */
const TRACK = { pitch: 13.5, size: 10.2, rowPitch: 19, x0: 7, y0: 8, lip: 1.1 };
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
  const w = Math.max(right, at(n)[0] + TRACK.size / 2 + 2), h = TRACK.y0 + lastRow * TRACK.rowPitch + TRACK.size / 2 + TRACK.lip + 1.2;
  return { n, perRow, rows, at, cell, w, h, up: !!up };
}
export const CANDY_SPEC = trackSpec(CANDY.len, 6), DICE_SPEC = trackSpec(DICE_GOAL - 1, 5);
export const SNL_SPEC = trackSpec(SNL.n, SNL.perRow, true), BUMP_SPEC = trackSpec(BUMP.n, 5);
// The board's miniature folds the same track into shorter rows, so its spaces and pieces are as big as the square allows.
export const CANDY_MINI = trackSpec(CANDY.len, 4), BUMP_MINI = trackSpec(BUMP.n, 3);
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
// Two pieces on one space sit side by side, a little smaller, X up and to the left, O down and to the right:
// neither ever hides the other. [x, y, scale] of piece p on a slot.
const SHARE = { dx: 3, dy: 1.4, s: 0.86 };
export function seatOf(spec, slot, p, shared) {
  const [x, y] = spec.at(slot), d = p === 'X' ? -1 : 1;
  return shared ? [x + d * SHARE.dx, y + d * SHARE.dy, SHARE.s] : [x, y, 1];
}
// Candy Race: each colour has its own shape too (on its spaces and on the wheel), so a colour is never told by its hue alone.
export const CANDY_SYM = {
  red: '<circle class="sym" r="2.1"/>',
  yellow: '<path class="sym" d="M0,-2.7 L.8,-.9 2.7,-.8 1.2,.5 1.7,2.4 0,1.3 -1.7,2.4 -1.2,.5 -2.7,-.8 -.8,-.9Z"/>',
  green: '<path class="sym" d="M0,-2.4 L2.5,1.9 -2.5,1.9Z"/>',
  blue: '<path class="sym" d="M0,-2.6 L2.3,0 0,2.6 -2.3,0Z"/>',
};
const STAR = 'M0,-3 L.9,-1 3,-.9 1.4,.6 1.9,2.7 0,1.5 -1.9,2.7 -1.4,.6 -3,-.9 -.9,-1Z';
// A burst at a space (the finish reached, a piece bumped): eight rays and a star that pop and are gone. d: its moment (ms into the move).
const burst = (x, y, cls, d) => `<g class="tburst ${cls}" transform="translate(${x},${y})"><g style="--d:${Math.round(d)}ms">${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<path class="ray" transform="rotate(${a})" d="M0,-5.2 L0,-8"/>`).join('')}<path class="bst" d="${STAR}" transform="scale(1.5)"/></g></g>`;
// opts: colors (per space, or none for plain numbered spaces), tokens {X, O} as slots (null = none),
// moved (the token hopping right now), finish 'colours' | 'flag' | 'none', mini (board miniature), marks { space: class }
// (a ladder's foot, a snake's head, the spaces in reach), trail { by, slots, at } (the spaces a move left behind: a dot
// on each in the mover's colour, `at` each one's moment in ms while the move plays, none once it has), pow { x, y, d, cls }
// (a burst), sym (Candy Race's shapes), home (Bump's Start is a little house), turn (the player to move: their piece bobs)
export function trackSvg(spec, opts) {
  const { n, at } = spec, S = TRACK.size, half = S / 2, R = TRACK.rowPitch / 2, lip = TRACK.lip, mini = !!opts.mini;
  const pts = [];
  for (let i = -1; i <= (opts.finish === 'none' ? n - 1 : n); i++) pts.push(at(i));   // 'none': the last space is the goal
  let d = `M${pts[0][0]},${pts[0][1]}`, arrows = '';
  const chevron = (x, y, ang) => `<path class="arrow" transform="translate(${x},${y}) rotate(${ang})" d="M-1.1,-1.5 L.4,0 L-1.1,1.5"/>`;
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
    const [x, y] = at(i), goal = !opts.colors && opts.goal && i === n - 1;
    const color = opts.colors ? opts.colors[i] : goal ? 'goal' : 'plain', mark = opts.marks && opts.marks[i] ? ' ' + opts.marks[i] : '';
    spaces += `<rect class="lip" x="${x - half}" y="${y - half + lip}" width="${S}" height="${S}" rx="2.4"/><rect class="space ${esc(color)}${esc(mark)}" x="${x - half}" y="${y - half}" width="${S}" height="${S}" rx="2.4"/>`;
    if (opts.colors) spaces += `<path class="gl" d="M${x - half + 1.5},${y - half + 3.6} q0,-2.1 2.1,-2.1 h1.6"/>${opts.sym && CANDY_SYM[color] ? `<g transform="translate(${x},${y + .3})${mini ? ' scale(1.15)' : ''}">${CANDY_SYM[color]}</g>` : ''}`;
    else if (goal) spaces += `<path class="gstar" d="${STAR}" transform="translate(${x},${y + .1})"/>`;
    else if (!mini && !/\bsnk\b/.test(mark)) nums += `<text class="numc" x="${x}" y="${y}">${i + 1}</text>`;   // (a snake's head lies on its space: no number over its face)
  }
  if (!opts.overlay) { spaces += nums; nums = ''; }                 // with ladders and snakes over the track, the numbers go on top of them
  let trail = '';
  if (opts.trail && !mini) for (const [k, slot] of opts.trail.slots.entries()) {
    if (slot < 0 || slot >= n) continue;
    const [x, y] = at(slot), t = opts.trail.at ? opts.trail.at(k) : null;
    trail += `<circle class="trl ${opts.trail.by}${t == null ? '' : ' go'}" cx="${x}" cy="${y + half - 1.7}" r="1.15"${t == null ? '' : ` style="--d:${Math.round(t)}ms"`}/>`;
  }
  const pill = (i, cls, inner) => { const [x, y] = at(i); return `<g class="${cls}" transform="translate(${x},${y})"><rect class="lip" x="-5.8" y="${-3.9 + lip}" width="11.6" height="7.8" rx="2.6"/>${inner}</g>`; };
  const start = pill(-1, 'start', `${opts.home ? '<path class="roof" d="M-6.6,-3.3 L0,-7.6 L6.6,-3.3Z"/>' : ''}<rect class="pill" x="-5.8" y="-3.9" width="11.6" height="7.8" rx="2.6"/>${mini ? '' : `<text class="lbl" y=".1">${opts.startLabel || 'START'}</text>`}`);
  const cols = ['var(--cr)', 'var(--cy)', 'var(--cg)', 'var(--cb)'];
  const finishFace = opts.finish === 'colours'
    ? cols.map((c, k) => `<rect x="${-5.8 + k * 2.9}" y="-3.9" width="2.9" height="7.8" fill="${c}"/>`).join('')
    : [0, 1, 2, 3].map(k => [0, 1].map(j => `<rect x="${-5.8 + k * 2.9}" y="${-3.9 + j * 3.9}" width="2.9" height="3.9" fill="${(k + j) % 2 ? '#e8e8e8' : '#222'}"/>`).join('')).join('');
  const fid = `fin-${spec.n}-${spec.perRow}-${mini ? 'm' : 'f'}`;
  const finish = opts.finish === 'none' ? '' : pill(n, 'finish', `<clipPath id="${fid}"><rect x="-5.8" y="-3.9" width="11.6" height="7.8" rx="2.6"/></clipPath><g clip-path="url(#${fid})">${finishFace}</g><rect class="fring" x="-5.8" y="-3.9" width="11.6" height="7.8" rx="2.6"/>${mini ? '' : '<rect x="-5" y="-2" width="10" height="4" rx="2" fill="rgba(0,0,0,.62)"/><text class="lbl" y=".1">FINISH</text>'}`);
  let tokens = '', shadows = '';
  const r = mini ? 5.4 : 4.3;
  for (const p of ['X', 'O']) {
    const slot = opts.tokens[p];
    if (slot == null) continue;
    const [x, y, s] = seatOf(spec, slot, p, opts.tokens[other(p)] === slot);
    const kn = Array.isArray(opts.knocked) ? opts.knocked.includes(p) : opts.knocked === p;
    const moved = Array.isArray(opts.moved) ? opts.moved.includes(p) : opts.moved === p;   // (Super Chaos's round end: both pieces hopping at once)
    shadows += `<g class="tsh ${p}" style="transform:translate(${x}px,${y}px) scale(${s})"><ellipse cy="${r * .82}" rx="${r * .98}" ry="${r * .42}"/></g>`;
    tokens += `<g class="tok ${p}${moved ? ' moved' : ''}${kn ? ' knocked' : ''}${opts.turn === p && !mini ? ' turn' : ''}" data-slot="${slot}" data-x="${x}" data-y="${y}" data-s="${s}" style="transform:translate(${x}px,${y}px) scale(${s})"><circle class="tkl" cy="${r * .2}" r="${r}"/><circle class="tkd" r="${r}"/><g class="pc p${p}" transform="translate(${-r * .98} ${-r * .98}) scale(${r * 1.96 / 100})">${toonG(p)}</g></g>`;
  }
  const pow = opts.pow && !mini ? burst(opts.pow.x, opts.pow.y, opts.pow.cls || '', opts.pow.d) : '';
  return `<svg class="track${mini ? ' small' : ''}${opts.cls ? ' ' + opts.cls : ''}" viewBox="0 0 ${spec.w} ${spec.h}" aria-hidden="true"><path class="path" d="${d}"/>${arrows}${spaces}${trail}${opts.overlay || ''}${nums}${start}${finish}${shadows}${pow}${tokens}</svg>`;
}

/* ----- the hops -----
 * Once the wheel stops or the die lands, the piece hops space by space from where it was to where it landed, each
 * hop an arc with its shadow staying on the board, the long ones quicker and quicker (games/shared/hops.js), and it
 * comes down on its last space with a squash. Snakes and Ladders: then rung by rung up the ladder or down along the
 * snake's body. Bump: the piece landed on is knocked back Home, tumbling. A square won: the piece jumps for joy.
 * One Web Animation a piece (and one for its shadow), built from keys { t, x, y, up, sx, sy, r, s, e }: the moment
 * (ms into the move), the spot on the board, the height off it, the squash, the turn, the piece's size (two on one
 * space are smaller) and the easing to the next key. The move's event sets their time (ui/fx.js anchorFx), so a
 * redraw part way carries on and a replay plays the same. */
export const SLIDE_MS = PLAY.slide, KNOCK_MS = PLAY.knock, SPIN3_MS = PLAY.spin3;
const UP = 'cubic-bezier(.2, .7, .4, 1)', DOWN = 'cubic-bezier(.6, 0, .85, .45)', EASE = 'cubic-bezier(.4, 0, .2, 1)', HOP_UP = 4.6;
const key = (t, [x, y, s], o) => Object.assign({ t, x, y, s: s == null ? 1 : s, up: 0, sx: 1, sy: 1, r: 0, e: EASE }, o);
// A crouch where it stands, then a hop onto each next spot; the last landing squashed. Returns the moment it lands.
function hopKeys(K, t0, pts) {
  const n = pts.length - 1;
  if (n < 1) return t0;
  K.push(key(Math.max(0, t0 - 110), pts[0]), key(t0, pts[0], { sx: 1.14, sy: .84, e: UP }));
  for (let k = 1; k <= n; k++) {
    const a = pts[k - 1], b = pts[k], ta = t0 + hopAt(k - 1), tb = t0 + hopAt(k);
    K.push(key((ta + tb) / 2, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, ((a[2] == null ? 1 : a[2]) + (b[2] == null ? 1 : b[2])) / 2], { up: HOP_UP, sx: .94, sy: 1.1, e: DOWN }));
    K.push(key(tb, b, k < n ? { sx: 1.1, sy: .9, e: UP } : { sx: 1.26, sy: .74, e: UP }));
  }
  return t0 + hopAt(n);
}
// Back to its shape after a landing: a small rebound, then still.
function settleKeys(K, t, pt) { K.push(key(t + HOPS.land * .5, pt, { up: .9, sx: .93, sy: 1.09, e: DOWN }), key(t + HOPS.land, pt)); return t + HOPS.land; }
// Up a ladder, rung by rung, rocking from side to side.
function climbKeys(K, t, a, b) {
  const n = 6;
  for (let i = 1; i <= n; i++) { const u = i / n; K.push(key(t + u * SLIDE_MS, [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, b[2]], i < n ? { up: i % 2 ? 1.1 : .3, r: i % 2 ? -9 : 9, sx: 1.06, sy: 1.06, e: 'ease-in-out' } : { sx: 1.2, sy: .8, e: UP })); }
  return t + SLIDE_MS;
}
// Down a snake, along its body: slow at the head, faster and faster, wriggling.
function slideKeys(K, t, curve, end) {
  const n = 8;
  for (let i = 1; i <= n; i++) { const u = i / n, v = Math.pow(u, 1.6); K.push(key(t + u * SLIDE_MS, i < n ? bezierAt(curve, v) : end, i < n ? { r: i % 2 ? 14 : -14, sx: .9, sy: .9, e: 'linear' } : { sx: 1.26, sy: .74, e: UP })); }
  return t + SLIDE_MS;
}
// Knocked back Home: a jolt where it stood, then a tumbling arc, landing with a squash.
function knockKeys(K, t, a, b, dir) {
  K.push(key(t, a, { e: UP }), key(t + KNOCK_MS * .16, [a[0] + 2.2 * dir, a[1] - 1.5, a[2]], { r: 30 * dir, sx: 1.25, sy: 1.25, e: UP }),
    key(t + KNOCK_MS * .58, [(a[0] + b[0]) / 2, Math.min(a[1], b[1]), 1], { up: 11, r: 220 * dir, sx: 1.1, sy: 1.1, e: DOWN }),
    key(t + KNOCK_MS * .88, b, { r: 360 * dir, sx: 1.28, sy: .72, e: UP }), key(t + KNOCK_MS, b, { r: 360 * dir }));
  return t + KNOCK_MS;
}
// The square is won: a jump and a turn on the last space.
function winKeys(K, t, pt) {
  K.push(key(t + HOPS.win * .42, pt, { up: 7.5, r: 180, sx: 1.12, sy: 1.12, e: DOWN }), key(t + HOPS.win * .8, pt, { r: 360, sx: 1.24, sy: .76, e: UP }), key(t + HOPS.win, pt, { r: 360 }));
  return t + HOPS.win;
}
// A piece that stays on its space while the other leaves it or joins it: it moves over (or back to the middle) then.
function shiftKeys(K, t, a, b) { K.push(key(Math.max(0, t - 1), a), key(t + 140, b)); return t + 140; }
function fly(p, K) {
  const tok = app.querySelector(`.gwrap .track .tok.${p}`), sh = app.querySelector(`.gwrap .track .tsh.${p}`);
  if (!tok || K.length < 2) return;
  K.sort((a, b) => a.t - b.t);
  const total = Math.max(1, K[K.length - 1].t), first = K[0], last = K[K.length - 1];
  if (first.t > 0) K.unshift(Object.assign({}, first, { t: 0, sx: 1, sy: 1, up: 0, r: 0 }));
  const off = k => Math.min(1, Math.max(0, k.t / total));
  tok.style.animation = 'none';                                    // the CSS pop is only the fallback
  tok.animate(K.map(k => ({ transform: `translate(${k.x}px, ${k.y - k.up}px) rotate(${k.r}deg) scale(${k.sx * k.s}, ${k.sy * k.s})`, offset: off(k), easing: k.e })), { duration: total, fill: 'both' });
  if (sh) sh.animate(K.map(k => ({ transform: `translate(${k.x}px, ${k.y}px) scale(${k.s * Math.max(.45, 1 - k.up * .07)})`, opacity: Math.max(.35, 1 - k.up * .06), offset: off(k), easing: k.e })), { duration: total, fill: 'both' });
  return last;
}
const endOf = p => { const t = app.querySelector(`.gwrap .track .tok.${p}`); return t ? [Number(t.dataset.x), Number(t.dataset.y), Number(t.dataset.s) || 1] : null; };
export function hopToken() {
  const f = state.flash;
  if (!f || !['candy', 'dice', 'snakes', 'bump'].includes(f.type) || !WAAPI || REDUCED) return;
  if (f.type === 'bump' && f.scr) { bumpRoundEnd(f); return; }
  if ((f.type === 'candy' || f.type === 'snakes') && f.scr && f.scr.moves) { trackRoundEnd(f); return; }
  if (!app.querySelector('.gwrap .track .tok.moved')) return;
  const spec = { candy: CANDY_SPEC, dice: DICE_SPEC, snakes: SNL_SPEC, bump: BUMP_SPEC }[f.type], p = f.by, o = other(p);
  const from = f.type === 'candy' ? f.from : f.type === 'dice' ? diceSlot(f.total - f.roll) : f.from - 1;
  const to = f.type === 'candy' ? f.to : f.type === 'dice' ? diceSlot(f.total) : f.type === 'snakes' ? f.land - 1 : f.to - 1;
  const delay = f.type === 'candy' ? SPIN_MS : f.type === 'bump' ? SPIN3_MS : DIE_MS;
  const end = endOf(p), oEnd = endOf(o), won = f.kind === 'claim' || f.kind === 'match';
  if (!end || to <= from) return;
  // where the other piece stood as the move began (Bump: on the space landed on, before it was knocked Home) and stands now
  const oTok = app.querySelector(`.gwrap .track .tok.${o}`), oNow = oTok ? Number(oTok.dataset.slot) : null;
  const oWas = f.type === 'bump' && f.bumped ? to : oNow;
  const pts = [seatOf(spec, from, p, oWas === from)];
  for (let i = from + 1; i <= to; i++) pts.push(spec.at(i));
  const slide = f.type === 'snakes' && f.via ? f.via : null;
  if (!slide) pts[pts.length - 1] = end;                          // land exactly where the piece now sits
  const K = [];
  let t = hopKeys(K, delay, pts);
  if (slide === 'ladder') t = climbKeys(K, t, pts[pts.length - 1], end);
  if (slide === 'snake') t = slideKeys(K, t, snakeCurve(spec, f.land, f.to), end);
  t = won ? winKeys(K, t, end) : settleKeys(K, t, end);
  fly(p, K);
  if (!oEnd) return;
  const KO = [];
  if (f.type === 'bump' && f.bumped) { KO.push(key(0, spec.at(to))); knockKeys(KO, delay + hopAt(pts.length - 1), spec.at(to), oEnd, p === 'X' ? 1 : -1); }   // the piece landed on: knocked Home
  else if (oWas === from && oNow === from) shiftKeys(KO, delay, seatOf(spec, from, o, true), oEnd);          // the mover left the space they shared
  else if (oEnd[2] !== 1) shiftKeys(KO, t - (won ? HOPS.win : HOPS.land) - 60, spec.at(oNow), oEnd);          // the mover joins it on its space, as it comes down
  if (KO.length) fly(o, KO);
}
// Super Chaos's round end in Bump: both pieces hopping at the same time from where the round began (both
// moved here), then any piece knocked from where it landed (side by side, sharing the space) back Home.
function bumpRoundEnd(f) {
  const spec = BUMP_SPEC, scr = f.scr, moves = scr.moves || {}, lead = BUMP_KNOCK.lead, kAt = lead + bumpHops(scr) * PLAY.hop;
  for (const p of ['X', 'O']) {
    const mv = moves[p], kn = scr.knocked.includes(p), o = other(p), end = endOf(p);
    if (!end || (!mv && !kn)) continue;
    const s0 = mv ? mv.from : scr.at[p], so = moves[o] ? moves[o].from : scr.at[o];
    const land = kn ? seatOf(spec, scr.at[p] - 1, p, scr.at.X === scr.at.O) : end;
    const K = [key(0, seatOf(spec, s0 - 1, p, s0 === so))];
    if (mv) {
      const pts = [seatOf(spec, mv.from - 1, p, s0 === so)];
      for (let i = mv.from + 1; i <= mv.to; i++) pts.push(i === mv.to ? land : spec.at(i - 1));
      settleKeys(K, hopKeys(K, lead, pts), land);
    }
    if (kn) knockKeys(K, Math.max(kAt, K[K.length - 1].t), land, end, p === 'X' ? -1 : 1);
    fly(p, K);
  }
}
// Super Chaos's round end in Candy Race and Snakes and Ladders: both pieces hopping at the same time from
// where the round began (both moved here), each its own spaces, then, in Snakes and Ladders, each up its ladder
// or down its snake. The wheel or die first, as for one move; a piece that shares a space with the other sits
// a little to its side.
function trackRoundEnd(f) {
  const snl = f.type === 'snakes', spec = snl ? SNL_SPEC : CANDY_SPEC, moves = f.scr.moves, lead = snl ? DIE_MS : SPIN_MS;
  const slot = v => (snl ? v - 1 : v);
  for (const p of ['X', 'O']) {
    const mv = moves[p], o = other(p), end = endOf(p);              // end: where the piece now sits (its final space, beside the other's if they share it)
    if (!end || !mv) continue;
    const from = slot(mv.from), land = slot(snl ? mv.land : mv.to), shared = !!moves[o] && moves[o].from === mv.from;
    const pts = [seatOf(spec, from, p, shared)];
    for (let i = from + 1; i <= land; i++) pts.push(spec.at(i));
    const slide = snl && mv.via ? mv.via : null;
    if (!slide) pts[pts.length - 1] = end;
    const K = [key(0, pts[0])];
    let t = hopKeys(K, lead, pts);
    if (slide === 'ladder') t = climbKeys(K, t, pts[pts.length - 1], end);
    if (slide === 'snake') t = slideKeys(K, t, snakeCurve(spec, mv.land, mv.to), end);
    settleKeys(K, t, end);
    fly(p, K);
  }
}
// The sounds of a roll (Snakes and Ladders, the Dice race): the die, a hop for each space (a little higher each
// time), the ladder or the snake, and the piece set down on its last space.
export function trackSounds(f, add, won, mini, last) {
  add('rattle', 0); if (f.type === 'snakes') add('diceTap', Math.round(DIE_MS * DIE_BOUNCE)); add('thunk', DIE_MS);   // (Snakes and Ladders' die is the shared 3-D one: its first bounce, then its landing)
  const mvs = f.type === 'snakes' && f.scr && f.scr.moves ? Object.values(f.scr.moves) : [f];   // (Super Chaos's round end: both pieces at once)
  const steps = f.type === 'snakes' ? Math.max(...mvs.map(mv => Math.max(1, mv.land - mv.from))) : Math.max(1, diceSlot(f.total) - diceSlot(f.total - f.roll));
  hopSounds(add, DIE_MS, steps);
  const via = mvs.some(mv => mv.via);
  if (mvs.some(mv => mv.via === 'ladder')) add('climb', DIE_MS + hopAt(steps));
  if (mvs.some(mv => mv.via === 'snake')) add('slide', DIE_MS + hopAt(steps));
  add('c4drop', DIE_MS + hopAt(steps) + (via ? SLIDE_MS : 0));
  return;
}
// A hop's sound as the piece springs off for each space, a little higher each time (the last landing is the piece set down: the caller's sound).
export function hopSounds(add, t0, steps) { for (let k = 0; k < steps; k++) add('hop', t0 + hopAt(k), 1 + Math.min(k, 8) * .045); }
// The moments (ms into the move) a move's trail shows: the dot on the k-th space left behind, as the piece leaves it.
export const trailAt = lead => k => lead + hopAt(k) + 40;
