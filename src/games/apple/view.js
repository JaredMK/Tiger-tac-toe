// Apple Pick: the screen, the miniature, the move's words and sounds, and the inputs.
import { APPLET, appleTimes, appleTree, isBird, isSpill } from './rules.js';
import { N, mv, state } from '../../ui/app.js';
import { arcTally, lateAt } from '../../ui/progress.js';

// The screen: both players' buckets up top (name, apples of the target, a small gauge), the mover's orchard (their
// tree with its apples left, their bucket with its apples in: an SVG, original drawing), the spinner (ten equal
// segments by default: picks of 1 to 4 in greens, the bird in blue, the spill in sand), the result line (its row
// always reserved) and Spin. A spin turns the wheel a few times, slowing, to stop with the pointer on the segment
// the record's spin landed in (both phones the same); then the apples move, each timed from the move (rules.js
// appleTimes, so a replay plays it all): a pick drops them one by one from the tree into the bucket, the bird swoops
// in over the bucket, lifts its apples and carries them up to the tree, a spill tips the bucket and its apples roll
// back up into the tree. The last apple landing fills the bucket: it bounces, stars burst (the game's own winning
// moment; the claim is the board's). What animates comes from the move being replayed (a: its recorded flash),
// never from the square's last result, which may be the viewer's own.
const SCENE = { w: 200, h: 130, tree: { x: 60, y: 52, r: 27 }, bucket: { x: 150, rim: 92, floor: 118, mouth: [131, 86] } };
// The apples' places: on the tree, a sunflower spread over the canopy (the first apples nearest the middle); in the
// bucket, rows of four and three up from the floor, the apples smaller the more the bucket holds.
export function appleRadius(T) { const rows = Math.ceil(T / 3.5); return Math.min(5.2, 42 / (1.72 * rows)); }
export function treeSpots(T) {
  const { x, y, r } = SCENE.tree, out = [];
  for (let i = 0; i < T; i++) { const d = r * Math.sqrt((i + 0.5) / T), a = i * 2.39996 + 0.6; out.push([+(x + d * Math.cos(a)).toFixed(1), +(y + d * Math.sin(a) * 0.92).toFixed(1)]); }
  return out;
}
export function bucketSpots(T) {
  const ar = appleRadius(T), out = [], { x, floor } = SCENE.bucket;
  let row = 0;
  while (out.length < T) {
    const n = row % 2 ? 3 : 4, y = floor - ar - row * ar * 1.72;
    for (let k = 0; k < n && out.length < T; k++) out.push([+(x + (k - (n - 1) / 2) * ar * 2.05).toFixed(1), +y.toFixed(1)]);
    row++;
  }
  return out;
}
const apple = (ar, cls, style) => `<g class="apl${cls ? ' ' + cls : ''}"${style ? ` style="${style}"` : ''}><path class="aplst" d="M0 ${(-ar * 0.8).toFixed(1)} q.6 -2.4 2.4 -3.2"/><path class="apll" d="M.4 ${(-ar * 1.3).toFixed(1)} q2.6 -2.2 4.6 -.4 q-2.2 2.2 -4.6 .4z"/><circle class="aplb" r="${ar}"/><circle class="aplh" cx="${(-ar * 0.38).toFixed(1)}" cy="${(-ar * 0.4).toFixed(1)}" r="${(ar * 0.22).toFixed(1)}"/></g>`;
const at = ([x, y], inner) => `<g transform="translate(${x} ${y})">${inner}</g>`;
const BIRD_G = '<g class="bbody"><path class="bwing" d="M-1 -1 q-6 -9 -14 -5 q5 1 8 7z"/><ellipse class="bbd" rx="8" ry="5"/><circle class="bbd" cx="7" cy="-3" r="3.8"/><path class="bbk" d="M10.5 -3.6l5 1.4-5 1.8z"/><circle class="beye" cx="8" cy="-3.8" r=".9"/><path class="btail" d="M-7.5 -1 l-6 -3 1 4.5z"/></g>';
// The orchard of one player (p): their tree, their bucket and the apples; a move's journey (a) when it is theirs.
function orchard(mini, p, a) {
  const T = mini.target, ar = appleRadius(T), ts = treeSpots(T), bs = bucketSpots(T), { bucket: B } = SCENE;
  const own = a && a.by === p ? a : null, t = own ? appleTimes(own) : null;
  const was = own ? own.was : mini.bucket[p], now = own ? own.bucket : mini.bucket[p];   // the bucket before and after the move
  const treeWas = T - was, treeNow = T - now;
  const parts = [];
  // the tree's apples: those staying, those to come back (a bird's or a spill's, appearing as they arrive) and those to drop
  for (let i = 0; i < T; i++) {
    const onTree = i < Math.min(treeWas, treeNow), returning = own && own.kind !== 'pick' && i >= treeWas && i < treeNow, dropping = own && own.kind === 'pick' && i >= treeNow && i < treeWas;
    if (onTree) parts.push(at(ts[i], apple(ar)));
    else if (returning) { const k = i - treeWas, when = own.kind === 'bird' ? t.land : t.tip + k * APPLET.gap + APPLET.roll; parts.push(at(ts[i], apple(ar, 'aplin', `--t:${when}ms`))); }
    else if (dropping) {
      const k = treeWas - 1 - i, b = bs[was + k];   // the outermost apple goes first, into the next free place in the bucket
      parts.push(apple(ar, 'drop', `--x0:${ts[i][0]}px;--y0:${ts[i][1]}px;--x1:${b[0]}px;--y1:${b[1]}px;--t:${t.start + k * APPLET.gap}ms;--d:${APPLET.fall}ms`));
    }
  }
  // the bucket, its apples (those staying; those landing, appearing as each drop ends; those going, at the grab or the tip) and the win's burst
  const heap = [];
  for (let i = 0; i < Math.max(was, now); i++) {
    if (i < Math.min(was, now)) heap.push(at(bs[i], apple(ar)));
    else if (i >= was) heap.push(at(bs[i], apple(ar, 'aplin', `--t:${t.start + (i - was) * APPLET.gap + APPLET.fall}ms`)));   // (a pick: landing)
    else heap.push(at(bs[i], apple(ar, 'aplout', `--t:${own.kind === 'bird' ? t.grab : t.tip}ms`)));                                 // (a bird or a spill: gone)
  }
  const spill = own && own.kind === 'spill' ? Array.from({ length: own.n }, (_, k) => apple(ar, 'roll', `--x0:${B.mouth[0]}px;--y0:${B.mouth[1]}px;--x1:${ts[treeWas + k][0]}px;--y1:${ts[treeWas + k][1]}px;--t:${t.tip + k * APPLET.gap}ms;--d:${APPLET.roll}ms`)).join('') : '';
  const full = own && now >= T;
  const stars = full ? `<g class="astars" style="--t:${t.land}ms">${[[122, 70], [178, 66], [112, 96], [186, 98], [150, 60]].map(([x, y], k) => `<text class="star" x="${x}" y="${y}" style="--k:${k}">✦</text>`).join('')}</g>` : '';
  const bk = `<g class="bk${own && own.kind === 'spill' ? ' tip' : ''}${full ? ' full' : ''}" style="${own && own.kind === 'spill' ? `--t:${t.start}ms;--t2:${t.land}ms;--d2:${APPLET.right}ms;` : ''}${full ? `--t:${t.land}ms` : ''}">
      <path class="bkin" d="M126 ${B.rim} h48 l-5 ${B.floor - B.rim + 4} h-38z"/>
      ${heap.join('')}
      <path class="bkwall" d="M124 ${B.rim} h52 l-6 ${B.floor - B.rim + 4} h-40z"/>
      <path class="bkweave" d="M128 101 h44 M130 110 h40 M132 119 h36 M136 ${B.rim} v30 M150 ${B.rim} v30 M164 ${B.rim} v30"/>
      <rect class="bkband ${p}" x="124.5" y="103" width="51" height="7"/>
      <ellipse class="bkrim" cx="${B.x}" cy="${B.rim}" rx="26" ry="4.5"/>
      <path class="bkhandle" d="M128 ${B.rim - 1} q22 -34 44 0"/>
    </g>`;
  const bird = own && own.kind === 'bird' ? `<g class="bird" style="--t:${t.start}ms;--d:${t.end - t.start}ms"><g transform="scale(1.3)">${BIRD_G}${Array.from({ length: Math.min(2, own.n) }, (_, k) => `<g class="held" transform="translate(${k ? 4 : -3} ${7 + (k ? 2 : 0)})">${apple(ar * 0.8)}</g>`).join('')}</g></g>` : '';
  return `<svg class="asvg" viewBox="0 0 ${SCENE.w} ${SCENE.h}" aria-label="${T - now} apple${T - now === 1 ? '' : 's'} on the tree, ${now} in the bucket">
      <ellipse class="aground" cx="100" cy="128" rx="112" ry="13"/>
      <path class="atrunk" d="M52 120 q-1 -22 5 -40 h8 q6 18 5 40z"/>
      <circle class="acan" cx="38" cy="62" r="21"/><circle class="acan" cx="84" cy="60" r="23"/><circle class="acan" cx="60" cy="33" r="20"/><circle class="acan" cx="60" cy="52" r="33"/>
      <circle class="acan2" cx="52" cy="44" r="16"/><circle class="acan2" cx="76" cy="56" r="10"/>
      ${parts.join('')}
      ${bk}${spill}${stars}${bird}
    </svg>`;
}
// The spinner: n equal segments, a pick's number (its apple beside it) on a green by its size, the bird on sky blue,
// the spill on sand; the pointer at the top.
const segShade = v => `hsl(112 42% ${(84 - 11 * v).toFixed(0)}%)`;
function wheelSvg(segs) {
  const R = 46, n = segs.length;
  const pt = (f, r) => { const t = (f * 360 - 90) * Math.PI / 180; return [(50 + r * Math.cos(t)).toFixed(2), (50 + r * Math.sin(t)).toFixed(2)]; };
  const seg = (k, v) => { const [x0, y0] = pt(k / n, R), [x1, y1] = pt((k + 1) / n, R); return `<path d="M50 50 L${x0} ${y0} A${R} ${R} 0 ${n === 1 ? 1 : 0} 1 ${x1} ${y1} Z" class="aseg${isBird(v) ? ' bird' : isSpill(v) ? ' spill' : ''}"${v > 0 ? ` fill="${segShade(v)}"` : ''}/>`; };
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
// The miniature: a tiny orchard, the tree with its apples and, under it, each player's bucket filling in their colour
// against the target (the fill is their apples of the target), so a tile reads at a glance at 360px.
export function miniature(mini, final) {
  const T = mini.target, fill = p => Math.min(1, mini.bucket[p] / T);
  const bucket = (p, x) => { const f = fill(p), hw = (8 + 2 * f).toFixed(1), y = (58 - 16 * f).toFixed(1); return `<g class="tbk ${p}" transform="translate(${x} 0)"><path class="tbbg" d="M-10 42 h20 l-2 16 h-16z"/>${f ? `<path class="tbf" d="M-8 58 h16 L${hw} ${y} H-${hw}z"/>` : ''}<path class="tbw" d="M-8.6 48 h17.2 M-8.2 53 h16.4"/><path class="tbo" d="M-10 42 h20 l-2 16 h-16z"/><ellipse class="tbr" cy="42" rx="10" ry="2.3"/><text class="tbl" y="37">${p}</text></g>`; };
  const apples = [[30, 14], [22, 22], [38, 21], [30, 27], [20, 12], [40, 11]].slice(0, Math.max(2, Math.min(6, Math.round(6 * (T - Math.min(mini.bucket.X, mini.bucket.O)) / T))));   // the fuller the leading bucket, the barer the tree
  return `<svg class="tapple" viewBox="0 0 60 60" aria-label="X has ${mini.bucket.X}, O has ${mini.bucket.O} of ${T} apples">
    <path class="atrunk" d="M27 38 q-1 -8 2 -14 h2 q3 6 2 14z"/><circle class="acan" cx="19" cy="19" r="9"/><circle class="acan" cx="41" cy="18" r="9"/><circle class="acan" cx="30" cy="9" r="8"/><circle class="acan" cx="30" cy="19" r="13"/>
    ${apples.map(([x, y]) => `<circle class="aplb" cx="${x}" cy="${y}" r="3.2"/>`).join('')}
    ${bucket('X', 16)}${bucket('O', 44)}</svg>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const s = a && a.apple ? a.apple : null, l = mini.last, T = mini.target, t = s ? appleTimes(s) : null, o = { view, locked, turn, zoom: state.zoom };
  const who = s ? s.by : view && sq.owner ? sq.owner : turn;   // whose orchard shows: the mover's, a finished square's winner's, else the player on the move
  const pct = v => (100 * Math.min(1, v / T)).toFixed(1) + '%';
  const tal = p => {   // the gauge and the count: both take the new total as the last apple lands (or leaves), timed from the move
    const now = mini.bucket[p], was = s && s.by === p ? s.was : now, moved = was !== now;
    return arcTally(p, o, `<span class="wtal"><span class="wbar" aria-hidden="true"><i${moved ? ' class="grow"' : ''} style="--w0:${pct(was)};--w1:${pct(now)};--t:${moved ? t.land : 0}ms;--d:350ms"></i></span><small aria-label="${now} of ${T} apples">${moved ? `<b class="cnt" data-from="${was}" data-delay="${t.land}" data-ms="350">${now}</b>` : now}/${T}</small></span>`);
  };
  const spun = !!s, rest = mini.rest || 0, stop = spun ? s.at : rest, end = (spun ? 1800 : 0) - stop * 360, from = spun ? -(s.from || 0) * 360 : end;
  const wheel = `<div class="aspin"><span class="wbox"><i class="wptr" aria-hidden="true"></i><svg viewBox="0 0 100 100" aria-label="The spinner: ${mini.segs.map(v => (isBird(v) ? 'bird' : isSpill(v) ? 'spill' : 'pick ' + v)).join(', ')}"><g class="wspin${spun ? ' go' : ''}" style="transform:rotate(${end.toFixed(1)}deg)${spun ? `;--from:${from.toFixed(1)}deg;--end:${end.toFixed(1)}deg;--d:${APPLET.spin}ms` : ''}">${wheelSvg(mini.segs)}</g></svg></span></div>`;
  const res = s ? `<p ${lateAt('arcres ' + (s.kind === 'pick' ? 'ok' : 'no'), t.landed)} role="status">${appleWords(s)}</p>`
    : (view || d) && l ? `<p class="arcres ${l.kind === 'pick' ? 'ok' : 'no'}"><b class="${l.by}">${N(l.by)}</b>: ${appleWords(Object.assign({ target: T }, l))}</p>`
    : `<p class="arcnote">${view ? '' : locked ? `Waiting for <b class="${turn}">${N(turn)}</b>…` : `${plural(appleTree(mini, turn))} on <b class="${turn}">${N(turn)}</b>'s tree`}</p>`;
  g = `<div class="g-arc g-apple"><div class="ctals">${tal('X')}${tal('O')}</div>
      <div class="ascene ${who}">${orchard(mini, who, s)}</div>
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
