// Apple Pick: the screen, the miniature, the move's words and sounds, and the inputs.
import { APPLET, appleTimes, appleTree, isBird, isSpill } from './rules.js';
import { N, mv, state, waitLine } from '../../ui/app.js';
import { arcTally, lateAt } from '../../ui/progress.js';

// The screen: both players' tallies up top (name, apples of the target, a small gauge), the orchard (one tree holding both
// players' apples, X's red and O's yellow, and each player's bucket under it, side by side: an SVG, original drawing; a
// move is played in it as it was made), the spinner (ten equal
// segments by default: picks of 1 to 4 in greens, the bird in blue, the spill in sand), the result line (its row
// always reserved) and Spin. A spin turns the wheel a few times, slowing, to stop with the pointer on the segment
// the record's spin landed in (both phones the same); then the apples move, each timed from the move (rules.js
// appleTimes, so a replay plays it all): a pick drops them one by one from the tree into the bucket, the bird swoops
// in over the bucket, lifts its apples and carries them up to the tree, a spill tips the bucket and its apples roll
// back up into the tree. The last apple landing fills the bucket: it bounces, stars burst (the game's own winning
// moment; the claim is the board's). What animates comes from the move being replayed (a: its recorded flash),
// never from the square's last result, which may be the viewer's own.
const SCENE = { w: 240, h: 142, tree: { x: 120, y: 46, rx: 52, ry: 31 }, rim: 108, floor: 134, half: 27, bx: { X: 62, O: 178 } };
// One tree holds both players' apples (X's red, O's yellow): each player's apple i has its own place on the canopy (a
// sunflower spread, X's the even places and O's the odd, the first apples nearest the middle, so the colours mix and the
// outermost go first). Each player's bucket stands below it; its apples heap up from the rim in rows (fixed places, filled
// from the middle of each row outwards), the apples smaller the more a bucket has to hold.
const MAX_AR = 5.4, POOL = { w: 46, h: 31 };
const packs = new Map(), spotsOf = new Map();
function pack(T) {   // the apples' radius for a target of T, and the heap's places (offsets from the bucket's middle, the rim line the zero)
  let hit = packs.get(T); if (hit) return hit;
  const { rx, ry } = SCENE.tree, treeAr = 0.36 * Math.sqrt(Math.PI * rx * ry / (2 * T));
  let ar = Math.min(MAX_AR, treeAr), rows = [];
  for (; ar > 1.4; ar -= 0.1) {
    const per = Math.floor(POOL.w / (2.05 * ar)); if (per < 2) continue;
    rows = []; for (let r = 0, n = 0; n < T; r++) { const k = r % 2 ? per - 1 : per; rows.push(k); n += k; }
    if ((rows.length - 1) * 1.72 * ar + 2 * ar <= POOL.h) break;
  }
  const places = [];
  rows.forEach((k, r) => {
    const row = Array.from({ length: k }, (_, c) => (c - (k - 1) / 2) * 2.05 * ar).sort((u, v) => Math.abs(u) - Math.abs(v) || u - v);
    for (const dx of row) places.push([+dx.toFixed(1), +(-0.1 * ar - r * 1.72 * ar).toFixed(1)]);
  });
  hit = { ar: +ar.toFixed(2), places }; packs.set(T, hit); return hit;
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
const apple = (ar, p, cls, style) => `<g class="apl${p ? ' ' + p : ''}${cls ? ' ' + cls : ''}"${style ? ` style="${style}"` : ''}><path class="aplst" d="M0 ${(-ar * 0.8).toFixed(1)} q.6 -2.4 2.4 -3.2"/><path class="apll" d="M.4 ${(-ar * 1.3).toFixed(1)} q2.6 -2.2 4.6 -.4 q-2.2 2.2 -4.6 .4z"/><circle class="aplb" r="${ar}"/><circle class="aplh" cx="${(-ar * 0.38).toFixed(1)}" cy="${(-ar * 0.4).toFixed(1)}" r="${(ar * 0.22).toFixed(1)}"/></g>`;
const at = ([x, y], inner) => `<g transform="translate(${x} ${y})">${inner}</g>`;
const BIRD_G = '<g class="bbody"><path class="bwing" d="M-1 -1 q-6 -9 -14 -5 q5 1 8 7z"/><ellipse class="bbd" rx="8" ry="5"/><circle class="bbd" cx="7" cy="-3" r="3.8"/><path class="bbk" d="M10.5 -3.6l5 1.4-5 1.8z"/><circle class="beye" cx="8" cy="-3.8" r=".9"/><path class="btail" d="M-7.5 -1 l-6 -3 1 4.5z"/></g>';
// A bucket: its handle, the dark inside, its apples (those staying; those landing, appearing as each drop ends; those going,
// at the grab or the tip), then the front wall (its top edge the rim's near half), the weave and the band with the player's mark.
function bucket(mini, p, own, t, was, now) {
  const T = mini.target, ar = appleRadius(T), cx = SCENE.bx[p], { rim, floor, half } = SCENE, tipping = own && own.kind === 'spill', full = own && now >= T;
  const heap = [];
  for (let i = 0; i < Math.max(was, now); i++) {
    if (i < Math.min(was, now)) heap.push(at(heapSpot(T, p, i), apple(ar, p)));
    else if (i >= was) heap.push(at(heapSpot(T, p, i), apple(ar, p, 'aplin', `--t:${t.start + (i - was) * APPLET.gap + APPLET.fall}ms`)));   // (a pick: landing)
    else heap.push(at(heapSpot(T, p, i), apple(ar, p, 'aplout', `--t:${own.kind === 'bird' ? t.grab : t.tip}ms`)));                         // (a bird or a spill: gone)
  }
  const toTree = p === 'X' ? 1 : -1, style = [`--fx:${cx}px`, `--fy:${floor}px`];   // (a spill tips it towards the tree, about the corner on that side)
  if (tipping) style.push(`--ox:${cx + toTree * (half - 5)}px`, `--oy:${floor}px`, `--rot:${74 * toTree}deg`, `--t:${t.start}ms`, `--t2:${t.land}ms`, `--d2:${APPLET.right}ms`);
  if (full) style.push(`--t:${t.land}ms`);
  return `<g class="bk${tipping ? ' tip' : ''}${full ? ' full' : ''}" style="${style.join(';')}">
      <path class="bkhandle" d="M${cx - 23} ${rim - 1} q23 -26 46 0"/>
      <ellipse class="bkin" cx="${cx}" cy="${rim}" rx="${half}" ry="4.5"/>
      ${heap.join('')}
      <path class="bkwall" d="M${cx - half} ${rim} a${half} 4.5 0 0 0 ${2 * half} 0 L${cx + half - 5} ${floor} h-${2 * half - 10}z"/>
      <path class="bkweave" d="M${cx - 13} ${rim + 5} v${floor - rim - 6} M${cx + 13} ${rim + 5} v${floor - rim - 6}"/>
      <rect class="bkband ${p}" x="${cx - 24.5}" y="${rim + 10}" width="49" height="12"/>
      <text class="bklab ${p}" x="${cx}" y="${rim + 19.6}">${p}</text>
    </g>`;
}
// The orchard: the shared tree with both players' apples, their two buckets under it, and the mover's move (a: its flash's
// apple) played as it was made: a pick drops that player's apples from the tree into their bucket, one by one; the bird
// swoops in over their bucket, lifts two and carries them up to the tree; a spill tips their bucket towards the tree and
// the apples roll up into it; the last apple landing fills the bucket (a bounce and stars).
function orchard(mini, a) {
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
        flying.push(apple(ar, p, 'drop', `--x0:${sp[0]}px;--y0:${sp[1]}px;--x1:${b[0]}px;--y1:${b[1]}px;--t:${t.start + k * APPLET.gap}ms;--d:${APPLET.fall}ms`));
      }
    }
    buckets.push(bucket(mini, p, own, t, was, now));
    if (own && own.kind === 'spill') {   // the apples tumble out of the mouth of the tipped bucket and roll up into the tree
      const cx = SCENE.bx[p], toTree = p === 'X' ? 1 : -1, ang = toTree * 74 * Math.PI / 180, edge = SCENE.half - 5, px = cx + toTree * edge;   // (the bucket tips about its lower corner on the tree's side)
      const dx = -toTree * edge, dy = rim - floor;                                                                                          // from that corner to the rim's middle
      const mx = px + dx * Math.cos(ang) - dy * Math.sin(ang), my = floor + dx * Math.sin(ang) + dy * Math.cos(ang);                        // where the rim's middle ends up: the mouth
      for (let k = 0; k < own.n; k++) { const sp = treeSpot(T, p, treeWas + k); flying.push(apple(ar, p, 'roll', `--x0:${mx.toFixed(1)}px;--y0:${my.toFixed(1)}px;--x1:${sp[0]}px;--y1:${sp[1]}px;--t:${t.tip + k * APPLET.gap}ms;--d:${APPLET.roll}ms`)); }
    }
    if (own && own.kind === 'bird') {
      const cx = SCENE.bx[p], toTree = p === 'X' ? 1 : -1, tr = SCENE.tree;   // (in from the side the bucket is on, over it, up to the tree, away the other side)
      const v = { sx: toTree > 0 ? -30 : SCENE.w + 30, sy: 78, gx: cx, gy: rim - 16, mx: (cx + tr.x) / 2, my: 66, tx: tr.x, ty: tr.y - 8, ex: toTree > 0 ? SCENE.w + 30 : -30, ey: 10, dir: toTree };
      extra.push(`<g class="bird" style="--t:${t.start}ms;--d:${t.end - t.start}ms;${Object.entries(v).map(([k, x]) => `--${k}:${x}${k === 'dir' ? '' : 'px'}`).join(';')}"><g transform="scale(1.3)">${BIRD_G}${Array.from({ length: Math.min(2, own.n) }, (_, k) => `<g class="held" transform="translate(${k ? 4 : -3} ${7 + (k ? 2 : 0)})">${apple(ar * 0.8, p)}</g>`).join('')}</g></g>`);
    }
    if (own && now >= T) {
      const cx = SCENE.bx[p], t0 = t.land;
      extra.push(`<g class="astars" style="--t:${t0}ms">${[[-20, 84], [20, 82], [-27, 104], [27, 106], [0, 72]].map(([dx, y], k) => `<text class="star" x="${cx + dx}" y="${y}" style="--k:${k}">✦</text>`).join('')}</g>`);
    }
  }
  const left = p => T - mini.bucket[p];
  return `<svg class="asvg" viewBox="0 0 ${SCENE.w} ${SCENE.h}" aria-label="X: ${count.X} apple${count.X === 1 ? '' : 's'} in the bucket. O: ${count.O} apple${count.O === 1 ? '' : 's'} in the bucket. ${left('X')} red and ${left('O')} yellow still on the tree">
      <path class="aground" d="M0 144 C0 112 40 100 120 92 C200 100 240 112 240 144z"/>
      <path class="atrunk" d="M108 100 q3 -20 5 -36 h14 q2 16 5 36z"/>
      <circle class="acan" cx="80" cy="54" r="22"/><circle class="acan" cx="160" cy="54" r="22"/><circle class="acan" cx="100" cy="22" r="19"/><circle class="acan" cx="140" cy="22" r="19"/><circle class="acan" cx="120" cy="46" r="38"/>
      <circle class="acan2" cx="106" cy="36" r="16"/><circle class="acan2" cx="148" cy="52" r="10"/>
      ${treeApples.join('')}
      ${buckets.join('')}${flying.join('')}${extra.join('')}
    </svg>`;
}
// The spinner: n equal segments, a pick's number (its apple beside it) on a green by its size, the bird on sky blue,
// the spill on sand; the pointer at the top.
const segShade = v => `hsl(112 42% ${(84 - 11 * v).toFixed(0)}%)`;
function wheelSvg(segs) {
  const R = 46, n = segs.length;
  const pt = (f, r) => { const t = (f * 360 - 90) * Math.PI / 180; return [(50 + r * Math.cos(t)).toFixed(2), (50 + r * Math.sin(t)).toFixed(2)]; };
  const seg = (k, v) => { const [x0, y0] = pt(k / n, R), [x1, y1] = pt((k + 1) / n, R); return `<path d="M50 50 L${x0} ${y0} A${R} ${R} 0 ${n === 1 ? 1 : 0} 1 ${x1} ${y1} Z" class="aseg${isBird(v) ? ' abird' : isSpill(v) ? ' aspill' : ''}"${v > 0 ? ` fill="${segShade(v)}"` : ''}/>`; };
  const lab = (k, v) => {
    const [x, y] = pt((k + 0.5) / n, 32), rot = ((k + 0.5) / n) * 360;
    if (isBird(v)) return `<g transform="translate(${x} ${y}) rotate(${rot.toFixed(1)}) scale(.55)">${BIRD_G}</g>`;
    if (isSpill(v)) return `<g class="aspl" transform="translate(${x} ${y}) rotate(${(rot - 60).toFixed(1)}) scale(.5)"><path class="bkwall" d="M-9 -6 h18 l-3 12 h-12z"/><path class="bkweave" d="M-7 0 h14 M-5.5 3.5 h11"/><ellipse class="bkrim" cy="-6" rx="9" ry="2.2"/>${at([6, -14], apple(2.4))}${at([11, -9], apple(2.4))}</g>`;
    return `<g transform="translate(${x} ${y}) rotate(${rot.toFixed(1)})"><text class="wv${v >= 3 ? ' dk' : ''}" y="4.5">${v}</text></g>`;
  };
  return segs.map((v, k) => seg(k, v)).join('') + `<circle cx="50" cy="50" r="${R}" class="wrim"/>` + segs.map((v, k) => lab(k, v)).join('') + '<circle cx="50" cy="50" r="5" class="whub"/>';
}
const plural = n => `${n} apple${n === 1 ? '' : 's'}`;
export function appleWords(a) {   // the result line's words for a move (a: its flash's apple, or the square's last)
  if (a.kind === 'bird') return a.n ? `Bird! ${plural(a.n)} back on the tree` : 'Bird! Nothing to take';
  if (a.kind === 'spill') return a.n ? `Spill! ${plural(a.n)} back on the tree` : 'Spill! The bucket was empty';
  if (a.bucket >= a.target) return 'Bucket full!';
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
  const s = a && a.apple ? a.apple : null, l = mini.last, T = mini.target, t = s ? appleTimes(s) : null, o = { view, locked, turn, zoom: state.zoom };
  const pct = v => (100 * Math.min(1, v / T)).toFixed(1) + '%';
  const tal = p => {   // the gauge and the count: both take the new total as the last apple lands (or leaves), timed from the move
    const now = mini.bucket[p], was = s && s.by === p ? s.was : now, moved = was !== now;
    return arcTally(p, o, `<span class="wtal"><span class="wbar" aria-hidden="true"><i${moved ? ' class="grow"' : ''} style="--w0:${pct(was)};--w1:${pct(now)};--t:${moved ? t.land : 0}ms;--d:350ms"></i></span><small aria-label="${now} of ${T} apples">${moved ? `<b class="cnt" data-from="${was}" data-delay="${t.land}" data-ms="350">${now}</b>` : now}/${T}</small></span>`);
  };
  const spun = !!s, rest = mini.rest || 0, stop = spun ? s.at : rest, end = (spun ? 1800 : 0) - stop * 360, from = spun ? -(s.from || 0) * 360 : end;
  const wheel = `<div class="aspin"><span class="wbox"><i class="wptr" aria-hidden="true"></i><svg viewBox="0 0 100 100" aria-label="The spinner: ${mini.segs.map(v => (isBird(v) ? 'bird' : isSpill(v) ? 'spill' : 'pick ' + v)).join(', ')}"><g class="wspin${spun ? ' go' : ''}" style="transform:rotate(${end.toFixed(1)}deg)${spun ? `;--from:${from.toFixed(1)}deg;--end:${end.toFixed(1)}deg;--d:${APPLET.spin}ms` : ''}">${wheelSvg(mini.segs)}</g></svg></span></div>`;
  const res = s ? `<p ${lateAt('arcres ' + (s.kind === 'pick' ? 'ok' : 'no'), t.landed)} role="status">${appleWords(s)}</p>`
    : (view || d) && l ? `<p class="arcres ${l.kind === 'pick' ? 'ok' : 'no'}"><b class="${l.by}">${N(l.by)}</b>: ${appleWords(Object.assign({ target: T }, l))}</p>`
    : `<p class="arcnote">${view ? '' : locked ? waitLine(turn) : `<b class="${turn}">${N(turn)}</b>: ${plural(appleTree(mini, turn))} to pick`}</p>`;
  g = `<div class="g-arc g-apple"><div class="ctals">${tal('X')}${tal('O')}</div>
      <div class="ascene">${orchard(mini, s)}</div>
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
// The wheel turns, ticking slower and slower, and stops; then the apples: each one's plop into the bucket (the last one
// fills it: the burst); the bird's swoop and its chirp as it lifts the apples; the bucket tipping and its apples tumbling out.
export function sounds(f, add, won, mini, last) {
  add('rlSpin', 0);
  const ticks = 14;
  for (let k = 1; k <= ticks; k++) add('wheelTick', Math.round(APPLET.spin * (1 - Math.pow(1 - k / ticks, 2.2))));
  const a = f.apple;
  if (!a) return;
  const t = appleTimes(a);
  if (a.kind === 'pick') {
    add(a.n ? 'ding' : 'thud', t.landed);
    for (let k = 0; k < a.n; k++) add('appleDrop', t.start + k * APPLET.gap + APPLET.fall);
    if (won) add('sparkle', t.land + 80);
    return;
  }
  if (a.kind === 'bird') { add('birdSwoop', t.start); add('birdChirp', t.grab); if (a.n) add('appleLift', t.grab + 120); return; }
  add('spill', t.start + APPLET.tip - 120);
  for (let k = 0; k < a.n; k++) add('appleRoll', t.tip + k * APPLET.gap);
}
