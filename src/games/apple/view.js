// Apple Pick: the screen, the miniature, the move's words and sounds, and the inputs.
import { APPLET, appleTimes, appleTree, isBird, isSpill } from './rules.js';
import { N, mv, state, waitLine } from '../../ui/app.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { spinTicks } from '../../ui/spin.js';

// The screen: both players' tallies up top (name, a small gauge, the apples of the target), the orchard (a framed scene:
// sky, hills, one tree holding both players' apples, X's red and O's yellow, and each player's bucket under it, left and
// right: an SVG, original drawing; a move is played in it as it was made), the spinner (ten equal segments by default:
// picks of 1 to 4 in greens, the bird in blue, the spill in sand; a tap on it spins too), the result line (its row
// always reserved) and Spin. A spin winds up, runs and settles (ui/spin.js: the pointer flicks and ticks as each peg
// passes, slower and slower) and stops with the pointer on the segment the record's spin landed in (both phones the
// same), which lights; then the apples move, each timed from the move (rules.js appleTimes, appleSteps below, so a
// replay plays it all): a pick drops them one by one from the tree into the bucket, the bucket nodding and its count
// ticking up as each lands; the bird swoops in over the bucket, snatches its apples and carries them up to the tree;
// a spill tips the bucket and its apples roll back up into the tree, one by one. The last apple landing fills the
// bucket: it bounces, a ring and stars burst (the game's own winning moment; the claim is the board's). What animates
// comes from the move being replayed (a: its recorded flash), never from the square's last result, which may be the
// viewer's own.
const SCENE = { w: 280, h: 140, tree: { x: 140, y: 47, rx: 56, ry: 31 }, rim: 100, floor: 131, half: 30, bx: { X: 50, O: 230 } };
// One tree holds both players' apples (X's red, O's yellow): each player's apple i has its own place on the canopy (a
// sunflower spread, X's the even places and O's the odd, the first apples nearest the middle, so the colours mix and the
// outermost go first). Each player's bucket stands below it; its apples heap up from the rim in rows (fixed places, filled
// from the middle of each row outwards: a pile narrowing to its top where the target allows, 4-3-2-1 for ten), every
// place still to fill drawn as an empty outline, so the pile reads against its goal; the apples smaller the more a
// bucket has to hold.
const MAX_AR = 6, POOL = { w: 52, h: 44 };
const packs = new Map(), spotsOf = new Map();
function pack(T) {   // the apples' radius for a target of T, and the heap's places (offsets from the bucket's middle, the rim line the zero)
  let hit = packs.get(T); if (hit) return hit;
  const { rx, ry } = SCENE.tree, treeAr = 0.36 * Math.sqrt(Math.PI * rx * ry / (2 * T));
  let ar = Math.min(MAX_AR, treeAr), rows = [];
  for (; ar > 1.4; ar -= 0.1) {
    const per = Math.floor(POOL.w / (2.05 * ar)); if (per < 2) continue;
    rows = [];
    if (per * (per + 1) / 2 >= T) { for (let k = per, n = 0; n < T; k--) { rows.push(k); n += k; } }   // a pile: each row one shorter
    else for (let r = 0, n = 0; n < T; r++) { const k = r % 2 ? per - 1 : per; rows.push(k); n += k; }   // too many for a pile: rows the bucket's width
    if ((rows.length - 1) * 1.72 * ar + 2 * ar <= POOL.h) break;
  }
  const places = [];
  rows.forEach((k, r) => {
    const row = Array.from({ length: k }, (_, c) => (c - (k - 1) / 2) * 2.05 * ar).sort((u, v) => Math.abs(u) - Math.abs(v) || u - v);
    for (const dx of row) places.push([+dx.toFixed(1), +(-0.1 * ar - r * 1.72 * ar).toFixed(1)]);
  });
  hit = { ar: +ar.toFixed(2), places: places.slice(0, T) }; packs.set(T, hit); return hit;
}
export const appleRadius = T => pack(T).ar;
export function treeSpots(T) {   // 2T places on the canopy
  let hit = spotsOf.get(T); if (hit) return hit;
  const { x, y, rx, ry } = SCENE.tree, total = 2 * T; hit = [];
  for (let i = 0; i < total; i++) { const d = Math.sqrt((i + 0.5) / total), a = i * 2.39996 + 0.6; hit.push([+(x + rx * d * Math.cos(a)).toFixed(1), +(y + ry * d * Math.sin(a)).toFixed(1)]); }
  spotsOf.set(T, hit); return hit;
}
const treeSpot = (T, p, i) => treeSpots(T)[2 * i + (p === 'O' ? 1 : 0)];
const heapSpot = (T, p, i) => { const [dx, dy] = pack(T).places[i]; return [SCENE.bx[p] + dx, SCENE.rim + dy]; };
const appleG = ar => `<path class="aplst" d="M0 ${(-ar * 0.8).toFixed(1)} q.6 -2.4 2.4 -3.2"/><path class="apll" d="M.4 ${(-ar * 1.3).toFixed(1)} q2.6 -2.2 4.6 -.4 q-2.2 2.2 -4.6 .4z"/><circle class="aplb" r="${ar}"/><path class="apls" d="M${(ar * 0.62).toFixed(1)} ${(-ar * 0.5).toFixed(1)} a${ar} ${ar} 0 0 1 ${(-ar * 1.12).toFixed(1)} ${(ar * 1.36).toFixed(1)} a${(ar * 1.25).toFixed(1)} ${(ar * 1.25).toFixed(1)} 0 0 0 ${(ar * 1.12).toFixed(1)} ${(-ar * 1.36).toFixed(1)}z"/><circle class="aplh" cx="${(-ar * 0.38).toFixed(1)}" cy="${(-ar * 0.4).toFixed(1)}" r="${(ar * 0.22).toFixed(1)}"/>`;
const apple = (ar, p, cls, style) => `<g class="apl${p ? ' ' + p : ''}${cls ? ' ' + cls : ''}"${style ? ` style="${style}"` : ''}>${appleG(ar)}</g>`;
// An apple in flight (a drop into the bucket, a roll back up to the tree): across at a steady pace (the outer group), up and
// down under its own weight (.ady) and turning as it goes (.adr): three animations of one length, timed from the move.
const flyer = (ar, p, cls, style) => `<g class="apl ${p} ${cls}" style="${style}"><g class="ady"><g class="adr">${appleG(ar)}</g></g></g>`;
const at = ([x, y], inner) => `<g transform="translate(${x} ${y})">${inner}</g>`;
const BIRD_G = '<g class="bbody"><path class="btail" d="M-7 -1 l-8 -4.5 1.5 6z"/><path class="bwing" d="M-1 -1 q-6 -9 -14 -5 q5 1 8 7z"/><ellipse class="bbd" rx="8" ry="5.2"/><path class="bbel" d="M-5 2.4 q5 4 10 .2 q-5 1.2 -10 -.2z"/><circle class="bbd" cx="7" cy="-3" r="4"/><path class="bbk" d="M10.4 -4l5.6 1.8-5.6 1.8z"/><circle class="beye" cx="8.2" cy="-3.9" r="1"/></g>';
// The bucket's count as a move plays: [[ms into the move, the count from then], ...]: a pick, one more as each apple lands; the
// bird, its apples gone at the snatch; a spill, one fewer as each apple tumbles out.
export function appleSteps(a) {
  const t = appleTimes(a), out = [];
  if (a.kind === 'pick') for (let k = 0; k < a.n; k++) out.push([t.start + k * APPLET.gap + APPLET.fall, a.was + k + 1]);
  else if (a.kind === 'bird') { if (a.n) out.push([t.grab, a.bucket]); }
  else for (let k = 0; k < a.n; k++) out.push([t.tip + k * APPLET.gap, a.was - k - 1]);
  return out;
}
// A number that changes as a move plays, one value on show at a time (el: the tag; each later value pops in at its moment).
const stepped = (el, cls, attrs, was, steps) => !steps.length ? `<${el} class="${cls}"${attrs}>${was}</${el}>`
  : `<${el} class="${cls} tu"${attrs} style="--u:${steps[0][0]}ms">${was}</${el}>` + steps.map(([ms, v], k) => `<${el} class="${cls} acn${k + 1 < steps.length ? '' : ' last'}"${attrs} style="--f:${ms}ms${k + 1 < steps.length ? `;--u:${steps[k + 1][0]}ms` : ''}">${v}</${el}>`).join('');
const MARK = { X: '<path class="bkmk" d="M-3.4 -3.4L3.4 3.4M3.4 -3.4L-3.4 3.4"/>', O: '<circle class="bkmk" r="3.3"/>' };   // the player's mark on their bucket's band, drawn
// A bucket: its ears, the dark inside, the pile's places (an outline each: the goal), its apples (those staying; those
// landing, appearing as each drop ends; those going, at the snatch or as each tumbles out), then the front wall (its top
// edge the rim's near half), the slats and the band with the player's mark and the count.
function bucket(mini, p, own, t, was, now) {
  const T = mini.target, ar = appleRadius(T), cx = SCENE.bx[p], { rim, floor, half } = SCENE, tipping = own && own.kind === 'spill', full = own && now >= T, steps = own ? appleSteps(own) : [];
  const heap = [];
  const ghosts = []; for (let i = 0; i < T; i++) ghosts.push(`<circle class="aplg" cx="${heapSpot(T, p, i)[0]}" cy="${heapSpot(T, p, i)[1]}" r="${(ar - 0.6).toFixed(1)}"/>`);
  for (let i = 0; i < Math.max(was, now); i++) {
    if (i < Math.min(was, now)) heap.push(at(heapSpot(T, p, i), apple(ar, p)));
    else if (i >= was) heap.push(at(heapSpot(T, p, i), apple(ar, p, 'aplin', `--t:${t.start + (i - was) * APPLET.gap + APPLET.fall}ms`)));   // (a pick: landing)
    else heap.push(at(heapSpot(T, p, i), apple(ar, p, 'aplout', `--t:${own.kind === 'bird' ? t.grab : t.tip + (was - 1 - i) * APPLET.gap}ms`)));   // (the bird: all at its snatch; a spill: the top ones first, one by one)
  }
  const toTree = p === 'X' ? 1 : -1, style = [`--fx:${cx}px`, `--fy:${floor}px`];   // (a spill tips it towards the tree, about the corner on that side)
  let cls = '';
  if (tipping) { cls = ' tip'; style.push(`--ox:${cx + toTree * (half - 5)}px`, `--oy:${floor}px`, `--rot:${74 * toTree}deg`, `--t:${t.start}ms`, `--t2:${t.land}ms`, `--d2:${APPLET.right}ms`); }
  else if (own && own.kind === 'bird') { cls = ' snatch'; style.push(`--t:${t.grab}ms`); }
  else if (own && steps.length) style.push(`animation:${steps.map(([ms], k) => (full && k === steps.length - 1 ? `bkfull 600ms ${ms}ms cubic-bezier(.3, 1.6, .5, 1) both` : `bknod 200ms ${ms}ms cubic-bezier(.4, 0, .2, 1)`)).join(',')}`);   // (it nods under each apple; the last of a full one: the bounce)
  const y0 = rim + 9, y1 = rim + 23, w0 = half - 5 * 9 / (floor - rim), w1 = half - 5 * 23 / (floor - rim);
  return `<ellipse class="bksh" cx="${cx}" cy="${floor + 1.5}" rx="${half + 1}" ry="4.5"/><g class="bk${cls}${full ? ' full' : ''}" style="${style.join(';')}">
      <path class="bkear" d="M${cx - half + 1} ${rim + 3} c-8 -1 -8 9 -1.6 9.4M${cx + half - 1} ${rim + 3} c8 -1 8 9 1.6 9.4"/>
      <ellipse class="bkin" cx="${cx}" cy="${rim}" rx="${half}" ry="5"/>
      <g class="aplgs${tipping ? ' fade' : ''}"${tipping ? ` style="--t:${t.start}ms;--t2:${t.end - 160}ms"` : ''}>${ghosts.join('')}</g>${heap.join('')}
      <path class="bkwall" d="M${cx - half} ${rim} a${half} 5 0 0 0 ${2 * half} 0 L${cx + half - 5} ${floor} q${-(half - 5)} 4.5 ${-(2 * half - 10)} 0z"/>
      <path class="bkweave" d="M${cx - 15} ${rim + 5} l1.5 ${floor - rim - 4} M${cx} ${rim + 5.5} v${floor - rim - 3.5} M${cx + 15} ${rim + 5} l-1.5 ${floor - rim - 4}"/>
      <path class="bkband ${p}" d="M${(cx - w0).toFixed(1)} ${y0} q${w0.toFixed(1)} 4.4 ${(2 * w0).toFixed(1)} 0 L${(cx + w1).toFixed(1)} ${y1} q${(-w1).toFixed(1)} 4.4 ${(-2 * w1).toFixed(1)} 0z"/>
      <g class="bklab ${p}" transform="translate(${cx - 15} ${rim + 18.6})" aria-label="${p}">${MARK[p]}</g>
      ${stepped('text', `bkc ${p}`, ` x="${cx + 7}" y="${rim + 22.6}"`, was, steps)}
    </g>`;
}
const STAR = 'M0 -5 L1.4 -1.6 5 -1.5 2.2 .8 3.1 4.4 0 2.4 -3.1 4.4 -2.2 .8 -5 -1.5 -1.4 -1.6z';
// The orchard: the shared tree with both players' apples, their two buckets under it, and the mover's move (a: its flash's
// apple) played as it was made: a pick drops that player's apples from the tree into their bucket, one by one; the bird
// swoops in over their bucket, lifts two and carries them up to the tree; a spill tips their bucket towards the tree and
// the apples roll up into it; the last apple landing fills the bucket (a bounce, a ring and stars). lit: whose bucket
// the ground glows under (the mover's).
function orchard(mini, a, lit) {
  const T = mini.target, ar = appleRadius(T), { rim, floor } = SCENE;
  const treeApples = [], flying = [], buckets = [], extra = [], count = {};
  for (const p of ['X', 'O']) {
    const own = a && a.by === p ? a : null, t = own ? appleTimes(own) : null;
    const was = own ? own.was : mini.bucket[p], now = own ? own.bucket : mini.bucket[p];   // the bucket before and after the move
    const treeWas = T - was, treeNow = T - now; count[p] = now;
    // the tree's apples: those staying, those coming back (a bird's or a spill's, appearing as they arrive) and those to drop
    for (let i = 0; i < T; i++) {
      const sp = treeSpot(T, p, i), onTree = i < Math.min(treeWas, treeNow), returning = own && own.kind !== 'pick' && i >= treeWas && i < treeNow, dropping = own && own.kind === 'pick' && i >= treeNow && i < treeWas;
      if (onTree) treeApples.push(at(sp, apple(ar, p)));
      else if (returning) { const k = i - treeWas, when = own.kind === 'bird' ? t.land : t.tip + k * APPLET.gap + APPLET.roll; treeApples.push(at(sp, apple(ar, p, 'aplin', `--t:${when}ms`))); }
      else if (dropping) {
        const k = treeWas - 1 - i, b = heapSpot(T, p, was + k);   // the outermost apple goes first, into the next free place in the bucket
        flying.push(flyer(ar, p, 'drop', `--x0:${sp[0]}px;--y0:${sp[1]}px;--x1:${b[0]}px;--y1:${b[1]}px;--t:${t.start + k * APPLET.gap}ms;--d:${APPLET.fall}ms;--spin:${(b[0] < sp[0] ? -1 : 1) * 220}deg`));
      }
    }
    buckets.push(bucket(mini, p, own, t, was, now));
    if (own && own.kind === 'spill') {   // the apples tumble out of the mouth of the tipped bucket and roll up into the tree
      const cx = SCENE.bx[p], toTree = p === 'X' ? 1 : -1, ang = toTree * 74 * Math.PI / 180, edge = SCENE.half - 5, px = cx + toTree * edge;   // (the bucket tips about its lower corner on the tree's side)
      const dx = -toTree * edge, dy = rim - floor;                                                                                          // from that corner to the rim's middle
      const mx = px + dx * Math.cos(ang) - dy * Math.sin(ang), my = floor + dx * Math.sin(ang) + dy * Math.cos(ang);                        // where the rim's middle ends up: the mouth
      for (let k = 0; k < own.n; k++) { const sp = treeSpot(T, p, treeWas + k); flying.push(flyer(ar, p, 'roll', `--x0:${mx.toFixed(1)}px;--y0:${my.toFixed(1)}px;--x1:${sp[0]}px;--y1:${sp[1]}px;--t:${t.tip + k * APPLET.gap}ms;--d:${APPLET.roll}ms;--spin:${toTree * 300}deg`)); }
    }
    if (own && own.kind === 'bird') {
      const cx = SCENE.bx[p], toTree = p === 'X' ? 1 : -1, tr = SCENE.tree;   // (in from the side the bucket is on, over it, up to the tree, away the other side)
      const v = { sx: toTree > 0 ? -30 : SCENE.w + 30, sy: 60, gx: cx, gy: rim + (was ? pack(T).places[was - 1][1] : 0) - ar - 9, mx: (cx + tr.x) / 2, my: 58, tx: tr.x, ty: tr.y - 6, ex: toTree > 0 ? SCENE.w + 30 : -30, ey: 6, dir: toTree };
      extra.push(`<g class="bird" style="--t:${t.start}ms;--d:${t.end - t.start}ms;${Object.entries(v).map(([k, x]) => `--${k}:${x}${k === 'dir' ? '' : 'px'}`).join(';')}"><g transform="scale(1.5)">${BIRD_G}${Array.from({ length: Math.min(2, own.n) }, (_, k) => `<g class="held" transform="translate(${k ? 4 : -3} ${7 + (k ? 2 : 0)})">${apple(ar * 0.72, p)}</g>`).join('')}</g></g>`);
    }
    if (own && now >= T) {
      const cx = SCENE.bx[p], cy = rim - 16, t0 = t.land;
      extra.push(`<g class="astars" style="--t:${t0}ms"><circle class="aring" cx="${cx}" cy="${cy}" r="12"/>${[[-34, -22], [32, -26], [-40, 6], [40, 4], [-12, -40], [14, -42], [-26, 24], [28, 22]].map(([dx, dy], k) => `<g transform="translate(${cx} ${cy})"><path class="star" d="${STAR}" style="--dx:${dx}px;--dy:${dy}px;--k:${k}"/></g>`).join('')}</g>`);
    }
  }
  const left = p => T - mini.bucket[p], lx = lit ? SCENE.bx[lit] : 0;
  return `<svg class="asvg" viewBox="0 0 ${SCENE.w} ${SCENE.h}" aria-label="X: ${count.X} apple${count.X === 1 ? '' : 's'} in the bucket. O: ${count.O} apple${count.O === 1 ? '' : 's'} in the bucket. ${left('X')} red and ${left('O')} yellow still on the tree">
      <rect class="asky" x="1.5" y="1.5" width="277" height="137" rx="12"/>
      <path class="acloud" d="M22 30 a7 7 0 0 1 10 -7 a9 9 0 0 1 17 1 a6.5 6.5 0 0 1 5 12 h-28 a6 6 0 0 1 -4 -6z"/><path class="acloud" d="M214 22 a6 6 0 0 1 9 -6 a8 8 0 0 1 15 1.5 a5.5 5.5 0 0 1 4 10 h-25 a5 5 0 0 1 -3 -5.5z"/>
      <path class="ahill" d="M3 118 C30 84 62 84 92 104 C120 86 170 82 196 104 C222 86 256 88 277 112 V124 H3z"/>
      <path class="aground" d="M3 114 C44 99 100 95 140 96 C180 95 236 99 277 114 V127 a10 10 0 0 1 -10 10 H13 a10 10 0 0 1 -10 -10z"/>
      <path class="atuft" d="M96 118 l2 -5 1.5 5 2.5 -4 M176 124 l2 -5 1.5 5 2.5 -4 M116 130 l2 -4 1.5 4 M150 121 l1.5 -4 1.5 4"/>
      <rect class="aframe" x="1.5" y="1.5" width="277" height="137" rx="12"/>
      ${lit ? `<ellipse class="aturn ${lit}" cx="${lx}" cy="${floor + 1}" rx="${SCENE.half + 10}" ry="7.5"/>` : ''}
      <ellipse class="atsh" cx="140" cy="105" rx="40" ry="5.5"/>
      <path class="atrunk" d="M124 107 q8 -5 9 -37 h14 q1 32 9 37 q-16 4 -32 0z"/><path class="atrk" d="M138 100 q1 -12 0 -22 M144 96 q1 -8 .5 -14"/>
      <circle class="acan bk2" cx="92" cy="56" r="24"/><circle class="acan bk2" cx="188" cy="56" r="24"/><circle class="acan bk2" cx="114" cy="25" r="21"/><circle class="acan bk2" cx="166" cy="25" r="21"/><circle class="acan" cx="140" cy="47" r="41"/>
      <path class="acan3" d="M103 62 a41 41 0 0 0 74 0 a44 44 0 0 1 -74 0z"/>
      <circle class="acan2" cx="124" cy="32" r="16"/><circle class="acan2" cx="170" cy="50" r="9"/><circle class="acan2" cx="88" cy="50" r="8"/>
      ${treeApples.join('')}
      ${buckets.join('')}${flying.join('')}${extra.join('')}
    </svg>`;
}
// The spinner: n equal segments, a pick's number (an apple under it, in the spinner's colour) on a green by its size, the
// bird on sky blue, the spill on sand; a peg between every two (the pointer ticks over them); the pointer at the top.
// hit: the segment a spin stopped on (it lights as the wheel stops, at `t` ms into the move).
const segShade = v => `hsl(112 42% ${(84 - 11 * v).toFixed(0)}%)`;
function wheelSvg(segs, p, hit, t) {
  const R = 46, n = segs.length, fs = Math.max(6, Math.min(14, 140 / n));
  const pt = (f, r) => { const a = (f * 360 - 90) * Math.PI / 180; return [(50 + r * Math.cos(a)).toFixed(2), (50 + r * Math.sin(a)).toFixed(2)]; };
  const wedge = k => { const [x0, y0] = pt(k / n, R), [x1, y1] = pt((k + 1) / n, R); return `M50 50 L${x0} ${y0} A${R} ${R} 0 ${n === 1 ? 1 : 0} 1 ${x1} ${y1} Z`; };
  const seg = (k, v) => `<path d="${wedge(k)}" class="aseg${isBird(v) ? ' abird' : isSpill(v) ? ' aspill' : ''}"${v > 0 ? ` fill="${segShade(v)}"` : ''}/>`;
  const lab = (k, v) => {
    const rot = ((k + 0.5) / n) * 360, [x, y] = pt((k + 0.5) / n, isBird(v) || isSpill(v) ? 30 : 35);
    if (isBird(v)) return `<g transform="translate(${x} ${y}) rotate(${rot.toFixed(1)}) scale(.62)">${BIRD_G}</g>`;
    if (isSpill(v)) return `<g class="aspl" transform="translate(${x} ${y}) rotate(${(rot - 60).toFixed(1)}) scale(.56)"><path class="bkwall" d="M-9 -6 h18 l-3 12 h-12z"/><path class="bkweave" d="M-7 0 h14 M-5.5 3.5 h11"/><ellipse class="bkrim" cy="-6" rx="9" ry="2.2"/>${at([6, -14], apple(2.6, p))}${at([11, -9], apple(2.6, p))}</g>`;
    const [ax, ay] = pt((k + 0.5) / n, 20);
    return `<g transform="translate(${x} ${y}) rotate(${rot.toFixed(1)})"><text class="wv${v >= 3 ? ' dk' : ''}" y="${(fs * 0.36).toFixed(1)}" style="font-size:${fs.toFixed(1)}px">${v}</text></g>${n <= 14 ? `<g transform="translate(${ax} ${ay}) rotate(${rot.toFixed(1)})">${apple(3, p)}</g>` : ''}`;
  };
  const peg = k => { const [x, y] = pt(k / n, R - 0.4); return `<circle class="wpeg" cx="${x}" cy="${y}" r="${n <= 14 ? 2 : 1.3}"/>`; };
  return segs.map((v, k) => seg(k, v)).join('') + (hit == null ? '' : `<path class="ahit" d="${wedge(hit)}" style="--t:${t}ms"/>`) + `<circle cx="50" cy="50" r="${R}" class="wrim"/>` + segs.map((v, k) => lab(k, v)).join('') + segs.map((v, k) => peg(k)).join('') + '<circle cx="50" cy="50" r="6" class="whub"/><circle cx="48.6" cy="48.6" r="1.7" class="whubl"/>';
}
// A spin's turn of the wheel (degrees: from where it rested, five turns on to its stop) and the moments its pegs pass the
// pointer (ui/spin.js: the curve the stylesheet plays), for the pointer's flicks and the tick sounds alike.
const SPIN_TURNS = 1800;
const spinEnds = s => ({ from: -(s.from || 0) * 360, end: SPIN_TURNS - (s.at || 0) * 360 });
const wheelTicks = (s, n) => { const e = spinEnds(s); return spinTicks(e.from, e.end, 360 / (n || 10), APPLET.spin); };
const plural = n => `${n} apple${n === 1 ? '' : 's'}`;
export function appleWords(a, picked) {   // the result line's words for a move (a: its flash's apple, or the square's last); picked: the pick's own words, even where it fills the bucket
  if (a.kind === 'bird') return a.n ? `Bird! ${plural(a.n)} back on the tree` : 'Bird! Nothing to take';
  if (a.kind === 'spill') return a.n ? `Spill! ${plural(a.n)} back on the tree` : 'Spill! The bucket was empty';
  if (a.bucket >= a.target && !picked) return 'Bucket full!';
  return `+${plural(a.n)}`;
}
// The miniature: a tiny orchard, the tree with both players' apples left on it (X's red, O's yellow, in proportion) and,
// under it, the two buckets side by side, each filling with its player's apples and carrying its count on the band.
export function miniature(mini, final) {
  const T = mini.target, bX = mini.bucket.X, bO = mini.bucket.O, left = p => T - mini.bucket[p], per = p => (left(p) <= 0 ? 0 : Math.max(1, Math.round(6 * left(p) / T)));
  const spots = [[42, 15], [31, 20], [53, 20], [36, 9], [48, 9], [42, 25], [25, 14], [59, 14], [30, 28], [54, 28], [42, 4], [20, 22]];   // (X's the even places, O's the odd)
  const dots = [];
  for (const p of ['X', 'O']) for (let i = 0; i < per(p); i++) dots.push(`<circle class="aplb ${p}" cx="${spots[2 * i + (p === 'O' ? 1 : 0)][0]}" cy="${spots[2 * i + (p === 'O' ? 1 : 0)][1]}" r="3.1"/>`);
  const bk = (p, cx, n) => {
    const heap = Math.round(6 * Math.min(1, n / T)), pile = [[-5, 0], [0, 0], [5, 0], [-2.5, -4.6], [2.5, -4.6], [0, -9]].slice(0, heap).map(([dx, dy]) => `<circle class="aplb ${p}" cx="${cx + dx}" cy="${44 + dy}" r="2.7"/>`).join('');
    return `<g class="tbk ${p}"><path class="tbbg" d="M${cx - 15} 46 a15 3 0 0 0 30 0 L${cx + 12} 69 h-24z"/>${pile}<path class="tbwall" d="M${cx - 15} 46 a15 3 0 0 0 30 0 L${cx + 12} 69 h-24z"/><rect class="tbband ${p}" x="${cx - 14}" y="51.5" width="28" height="15"/><text class="tbn ${p}" x="${cx}" y="64.6">${n}</text></g>`;   // (the band and its count large: the count at the board's text size)
  };
  return `<svg class="tapple" viewBox="0 0 84 71" aria-label="X has ${bX}, O has ${bO} of ${T} apples in their buckets">
    <ellipse class="aground" cx="42" cy="44" rx="40" ry="5"/><path class="atrunk" d="M39 44 q1 -9 2 -15 h4 q1 6 2 15z"/><circle class="acan" cx="20" cy="22" r="9"/><circle class="acan" cx="64" cy="22" r="9"/><circle class="acan" cx="30" cy="10" r="8"/><circle class="acan" cx="54" cy="10" r="8"/><circle class="acan" cx="42" cy="18" r="15"/>
    ${dots.join('')}
    ${bk('X', 21, bX)}${bk('O', 63, bO)}</svg>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const s = a && a.apple ? a.apple : null, l = mini.last, T = mini.target, t = s ? appleTimes(s) : null, o = { view, locked, turn, zoom: state.zoom }, n = mini.segs.length;
  const steps = s ? appleSteps(s) : [], mover = s ? s.by : turn;
  const pct = v => (100 * Math.min(1, v / T)).toFixed(1) + '%';
  const tal = p => {   // the gauge and the count: both follow the bucket, apple by apple, timed from the move
    const now = mini.bucket[p], mine = s && s.by === p && steps.length, was = mine ? s.was : now, t0 = mine ? steps[0][0] : 0, span = mine ? steps[steps.length - 1][0] - t0 : 0;
    return arcTally(p, o, `<span class="wtal"><span class="wbar" aria-hidden="true"><i${mine ? ' class="grow"' : ''} style="--w0:${pct(was)};--w1:${pct(now)};--t:${t0}ms;--d:${span + 220}ms"></i></span><small aria-label="${now} of ${T} apples"><b class="astep">${stepped('i', 'asn', '', was, mine ? steps : [])}</b>/${T}</small></span>`);
  };
  const spun = !!s, rest = mini.rest || 0, e = spun ? spinEnds(s) : null, end = spun ? e.end : -rest * 360, from = spun ? e.from : end;
  const flick = spun ? ` style="animation:${wheelTicks(s, n).map(ms => `wflick 110ms ${ms}ms`).join(',') || 'none'}"` : '';   // the pointer flicks as each peg passes (the tick sounds are at the same moments: sounds below)
  const hit = spun ? (s.kind === 'pick' && s.n ? ' pay' : s.kind === 'pick' ? '' : ' bust') : '';                              // the stop: a pick swells the wheel a moment, the bird or a spill jolts it
  const wheel = `<div class="aspin"><button class="awheel" data-act="move" ${mv('spin')}${locked || view ? ' disabled' : ''} aria-label="Spin. The spinner: ${mini.segs.map(v => (isBird(v) ? 'bird' : isSpill(v) ? 'spill' : 'pick ' + v)).join(', ')}"><span class="wbox${hit}"${spun ? ` style="--t:${t.landed}ms"` : ''}><i class="wptr" aria-hidden="true"${flick}></i><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="52.6" r="46" class="wshd"/><g class="wspin${spun ? ' go' : ''}" style="transform:rotate(${end.toFixed(1)}deg)${spun ? `;--from:${from.toFixed(1)}deg;--end:${end.toFixed(1)}deg;--d:${APPLET.spin}ms` : ''}">${wheelSvg(mini.segs, mover, spun ? s.seg : null, spun ? t.landed : 0)}</g></svg></span></button></div>`;
  const full = s && s.kind === 'pick' && s.bucket >= s.target && s.n > 0;   // the pick that fills the bucket: its apples first, "Bucket full!" as the last one lands
  const res = s ? (full ? `<p class="arcres ok aswap" role="status"><span class="appear tu" style="--t:${t.landed}ms;--u:${t.land}ms">${appleWords(s, true)}</span><span class="appear" style="--t:${t.land}ms">${appleWords(s)}</span></p>` : `<p ${lateAt('arcres ' + (s.kind === 'pick' ? 'ok' : 'no'), t.landed)} role="status">${appleWords(s)}</p>`)
    : (view || d) && l ? `<p class="arcres ${l.kind === 'pick' ? 'ok' : 'no'}"><b class="${l.by}">${N(l.by)}</b>: ${appleWords(Object.assign({ target: T }, l))}</p>`
    : `<p class="arcnote">${view ? '' : locked ? waitLine(turn) : `<b class="${turn}">${N(turn)}</b>: ${plural(appleTree(mini, turn))} to pick`}</p>`;
  g = `<div class="g-arc g-apple pc-${mover === 'O' ? 'O' : 'X'}"><div class="ctals">${tal('X')}${tal('O')}</div>
      <div class="ascene">${orchard(mini, s, view ? null : mover)}</div>
      ${wheel}${res}
      <div class="wbank"><button class="big ${turn}" data-act="move" ${mv('spin')}${locked || view ? ' disabled' : ''}>Spin for <span class="bnm">${N(turn)}</span></button></div></div>`;
  return g;
}
export function moveText(f, who) {
  const a = f.apple;
  if (!a) return `${who} spun`;
  if (a.kind === 'bird') return `${who} spun the bird${a.n ? `: ${plural(a.n)} back on the tree` : ''}`;
  if (a.kind === 'spill') return `${who} spun a spill${a.n ? `: ${plural(a.n)} back on the tree` : ''}`;
  return `${who} picked ${plural(a.n)}${a.bucket >= a.target ? ' · bucket full!' : ''}`;
}
// The wheel winds up and turns, its pointer ticking over the pegs, slower and slower (each tick as a peg passes: wheelTicks),
// the last ones lower; it stops (a ding on a pick, a thud on the bird, a spill or nothing); then the apples: each one's plop
// into the bucket, a little higher each time (the last one fills it: the burst); the bird's swoop and its caw as it
// snatches the apples; the bucket tipping and its apples tumbling out.
export function sounds(f, add, won, mini, last) {
  add('rlSpin', 0);
  const a = f.apple;
  if (!a) return;
  const ticks = wheelTicks(a, mini && mini.segs ? mini.segs.length : 10), n = ticks.length;
  ticks.forEach((ms, k) => add('wheelTick', ms, n - k <= 3 ? 1 - 0.07 * (4 - (n - k)) : undefined));
  const t = appleTimes(a);
  if (a.kind === 'pick') {
    add(a.n ? 'ding' : 'thud', t.landed);
    for (let k = 0; k < a.n; k++) add('appleDrop', t.start + k * APPLET.gap + APPLET.fall, 1 + 0.06 * k);
    if (won) add('sparkle', t.land + 80);
    return;
  }
  add('thud', t.landed);
  if (a.kind === 'bird') { add('birdSwoop', t.start); add('birdChirp', t.grab - 60); if (a.n) add('appleLift', t.grab + 140); return; }
  add('spill', t.start + APPLET.tip - 120);
  for (let k = 0; k < a.n; k++) add('appleRoll', t.tip + k * APPLET.gap, 1 + 0.05 * k);
}
