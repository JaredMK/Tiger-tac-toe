'use strict';
// App icon options (October 2026): six concepts for the app's icon, each a full-bleed 1024x1024 square with no
// transparency and no rounded corners (iOS masks them), its drawing kept inside the middle ~84% so the mask never cuts
// it. Plain SVG (no fonts, no gradients, no filters), so each one is also its own source file. Drawn by
// scripts/make-icon-options.js into assets/icon-options/ (SVG and PNG) and shown side by side on staging's /icons.html.
const INK = '#161210';
const S = 1024;
const f = n => (Math.round(n * 10) / 10).toString();
const wrap = (bg, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}"><rect width="${S}" height="${S}" fill="${bg}"/>${body}</svg>\n`;
const star = (cx, cy, ro, ri, n, rot = 0) => Array.from({ length: n * 2 }, (_, k) => {
  const r = k % 2 ? ri : ro, a = (k / (n * 2)) * Math.PI * 2 + rot;
  return f(cx + r * Math.sin(a)) + ',' + f(cy - r * Math.cos(a));
}).join(' ');
const jag = (cx, cy, r, n, amp, seed) => {          // a lumpy, irregular burst: points round a circle, each pushed in or out
  let s = seed; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  return Array.from({ length: n * 2 }, (_, k) => {
    const a = (k / (n * 2)) * Math.PI * 2, rr = k % 2 ? r * (0.55 + 0.1 * rnd()) : r * (1 + amp * (rnd() - 0.3));
    return f(cx + rr * Math.sin(a)) + ',' + f(cy - rr * Math.cos(a));
  }).join(' ');
};
const line = (x1, y1, x2, y2, col, w) => `<path d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;
const xMark = (cx, cy, r, col, w, ow) => {             // an X: ink outline under its colour
  const a = [cx - r, cy - r, cx + r, cy + r], b = [cx + r, cy - r, cx - r, cy + r];
  return (ow ? line(...a, INK, w + ow) + line(...b, INK, w + ow) : '') + line(...a, col, w) + line(...b, col, w);
};
const oMark = (cx, cy, r, col, w, ow) => (ow ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${INK}" stroke-width="${w + ow}"/>` : '') + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${col}" stroke-width="${w}"/>`;
const g = (t, body) => `<g transform="${t}">${body}</g>`;
const pips = (cx, cy, s, n, col) => {                 // a die's face: n pips in a square of side s
  const d = s * 0.28, at = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[n];
  return at.map(([x, y]) => `<circle cx="${f(cx + x * d)}" cy="${f(cy + y * d)}" r="${f(s * 0.1)}" fill="${col}"/>`).join('');
};
const die = (cx, cy, s, fill, pipCol, n, rot, ow = 16) => g(`rotate(${rot} ${cx} ${cy})`, `<rect x="${f(cx - s / 2)}" y="${f(cy - s / 2)}" width="${s}" height="${s}" rx="${f(s * 0.2)}" fill="${fill}" stroke="${INK}" stroke-width="${ow}"/>${pips(cx, cy, s, n, pipCol)}`);
const card = (cx, cy, w, h, fill, mark, rot, ow = 16) => g(`rotate(${rot} ${cx} ${cy})`, `<rect x="${f(cx - w / 2)}" y="${f(cy - h / 2)}" width="${w}" height="${h}" rx="${f(w * 0.14)}" fill="${fill}" stroke="${INK}" stroke-width="${ow}"/><path d="M${cx} ${f(cy - h * 0.22)}L${f(cx + w * 0.22)} ${cy}L${cx} ${f(cy + h * 0.22)}L${f(cx - w * 0.22)} ${cy}Z" fill="${mark}"/>`);
const ball = (cx, cy, r, fill, band, ow = 16) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${INK}" stroke-width="${ow}"/><path d="M${f(cx - r * 0.95)} ${f(cy - r * 0.25)}Q${cx} ${f(cy - r * 0.05)} ${f(cx + r * 0.95)} ${f(cy - r * 0.25)}L${f(cx + r * 0.95)} ${f(cy + r * 0.25)}Q${cx} ${f(cy + r * 0.45)} ${f(cx - r * 0.95)} ${f(cy + r * 0.25)}Z" fill="${band}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${INK}" stroke-width="${ow}"/>`;
const coin = (cx, cy, r, fill, ring, ow = 16) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${INK}" stroke-width="${ow}"/><circle cx="${cx}" cy="${cy}" r="${f(r * 0.66)}" fill="none" stroke="${ring}" stroke-width="${f(r * 0.14)}"/>`;
const eye = (cx, cy, rx, ry, px, py, brow) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff" stroke="${INK}" stroke-width="9"/><ellipse cx="${cx + px}" cy="${cy + py}" rx="${f(rx * 0.5)}" ry="${f(ry * 0.55)}" fill="${INK}"/>${brow ? line(brow[0], brow[1], brow[2], brow[3], INK, 16) : ''}`;

// 1. Blast: the grid, and the middle square going off: a mustard burst throwing out a die, a card, a ball and confetti.
function blast() {
  const BG = '#e5432a', MUS = '#f6c21b', CR = '#fff1d0';
  const a = 188, b = 836, l1 = 404, l2 = 620;
  const grid = [[l1, a, l1, b], [l2, a, l2, b], [a, l1, b, l1], [a, l2, b, l2]];
  const lines = grid.map(p => line(...p, INK, 74)).join('') + grid.map(p => line(...p, CR, 46)).join('');
  const conf = [[512, 200, 20, MUS], [200, 512, 45, MUS], [834, 520, -15, CR], [520, 838, 30, CR], [214, 214, -30, CR], [836, 836, 15, MUS]]
    .map(([x, y, r, c]) => g(`rotate(${r} ${x} ${y})`, `<rect x="${x - 34}" y="${y - 20}" width="68" height="40" rx="9" fill="${c}" stroke="${INK}" stroke-width="12"/>`)).join('');
  return wrap(BG, lines + xMark(296, 296, 50, CR, 34, 22) + oMark(728, 728, 52, CR, 34, 22)
    + `<polygon points="${jag(512, 512, 205, 10, 0.4, 7)}" fill="${MUS}" stroke="${INK}" stroke-width="20" stroke-linejoin="round"/>`
    + `<polygon points="${jag(512, 512, 92, 8, 0.3, 3)}" fill="${CR}" stroke="${INK}" stroke-width="14" stroke-linejoin="round"/>`
    + conf
    + die(728, 300, 128, CR, INK, 5, 18) + card(300, 728, 100, 138, CR, BG, -22));
}
// 2. Scuffle: X and O in a fight cloud: arms, stars and the two of them glaring out of it.
function scuffle() {
  const BG = '#ff2d87', LIME = '#b8f02a', W = '#fffaf0';
  const puffs = [[512, 540, 250], [330, 470, 150], [700, 470, 150], [400, 680, 140], [640, 690, 140], [512, 360, 150], [300, 620, 110], [740, 630, 110]];
  const cloud = puffs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r + 18}" fill="${INK}"/>`).join('') + puffs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${W}"/>`).join('');
  const arm = (x1, y1, x2, y2, fist) => line(x1, y1, x2, y2, INK, 30) + `<circle cx="${x2}" cy="${y2}" r="${fist}" fill="${W}" stroke="${INK}" stroke-width="14"/>`;
  const st = (x, y, r, c, rot) => `<polygon points="${star(x, y, r, r * 0.45, 5, rot)}" fill="${c}" stroke="${INK}" stroke-width="12" stroke-linejoin="round"/>`;
  const X = g('rotate(-14 390 520)', xMark(390, 520, 118, LIME, 70, 34) + eye(366, 498, 22, 28, 6, 6, [334, 452, 392, 474]) + eye(422, 498, 22, 28, -2, 6, [390, 474, 448, 452]));
  const O = g('rotate(12 650 545)', oMark(650, 545, 100, BG, 64, 34) + eye(624, 524, 22, 28, -6, 6, [592, 478, 650, 500]) + eye(680, 524, 22, 28, -8, 6, [648, 500, 706, 478]));
  const puff = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${W}" stroke="${INK}" stroke-width="14"/>`;
  return wrap(BG, cloud + puff(206, 320, 34) + puff(830, 330, 28) + puff(236, 790, 26) + puff(800, 800, 36) + X + O
    + st(196, 540, 66, LIME, 0.2) + st(836, 560, 58, LIME, -0.3) + st(512, 196, 58, LIME, 0.1) + st(512, 850, 50, W, 0.4));
}
// 3. Toybox: black, and one electric orange: a grid whose squares hold a die, a card, the X, a ball and a coin.
function toybox() {
  const BG = '#141414', OR = '#ff5a1f';
  const a = 176, b = 848, l1 = 400, l2 = 624;
  const grid = [[l1, a, l1, b], [l2, a, l2, b], [a, l1, b, l1], [a, l2, b, l2]].map(p => line(...p, OR, 38)).join('');
  const c = [288, 512, 736];
  return wrap(BG, grid
    + die(c[0], c[0], 134, OR, BG, 3, -10, 0)
    + card(c[2], c[0], 110, 150, OR, BG, 10, 0)
    + xMark(c[1], c[1], 60, OR, 50, 0)
    + `<circle cx="${c[0]}" cy="${c[2]}" r="70" fill="${OR}"/><path d="M${c[0] - 66} ${c[2] - 18}Q${c[0]} ${c[2]} ${c[0] + 66} ${c[2] - 18}L${c[0] + 66} ${c[2] + 18}Q${c[0]} ${c[2] + 36} ${c[0] - 66} ${c[2] + 18}Z" fill="${BG}"/>`
    + `<circle cx="${c[2]}" cy="${c[2]}" r="70" fill="${OR}"/><circle cx="${c[2]}" cy="${c[2]}" r="44" fill="none" stroke="${BG}" stroke-width="12"/>`
    + oMark(c[1], c[0], 52, OR, 30, 0));
}
// 4. Patchwork: the whole icon is the board, nine squares each its own colour and pattern (one game each), set
// crooked; the X in the middle. Drawn by quilt() below, which also makes its variations (PATCHWORK).
const PW = { T: '#e5432a', M: '#f6c21b', C: '#2346d8', P: '#ff5fa2', L: '#9ee03a', CR: '#fff1d0', OR: '#ff8a1f', GR: '#2f9e55', SKY: '#58a8cf', BG: '#4e9d3a' };
const PAT = {                                       // a tile's pattern, in the tile's own 400-unit square
  stripes: c => Array.from({ length: 7 }, (_, k) => `<rect x="${k * 70 - 40}" y="-60" width="30" height="520" fill="${c}" transform="rotate(25 200 200)"/>`).join(''),
  dots: c => Array.from({ length: 16 }, (_, k) => `<circle cx="${60 + (k % 4) * 92}" cy="${60 + Math.floor(k / 4) * 92}" r="22" fill="${c}"/>`).join(''),
  checks: c => Array.from({ length: 16 }, (_, k) => ((k + Math.floor(k / 4)) % 2 ? '' : `<rect x="${(k % 4) * 100}" y="${Math.floor(k / 4) * 100}" width="100" height="100" fill="${c}"/>`)).join(''),
  zig: c => Array.from({ length: 4 }, (_, k) => `<path d="M0 ${70 + k * 100}${Array.from({ length: 8 }, (_, j) => `L${50 * (j + 1)} ${70 + k * 100 + (j % 2 ? 0 : -40)}`).join('')}" stroke="${c}" stroke-width="22" fill="none" stroke-linejoin="round"/>`).join(''),
  rings: c => [60, 120, 180].map(r => `<circle cx="200" cy="200" r="${r}" fill="none" stroke="${c}" stroke-width="24"/>`).join(''),
  none: () => '',
};
const TILES = [[PW.T, 'stripes', PW.CR], [PW.M, 'dots', INK], [PW.C, 'none'], [PW.P, 'checks', '#ff86b9'], [PW.CR, 'none'], [PW.L, 'zig', PW.GR], [PW.GR, 'dots', PW.L], [INK, 'none'], [PW.OR, 'stripes', PW.M]];
const face = (cx, cy, r) => eye(cx - r * 0.24, cy - r * 0.12, r * 0.17, r * 0.22, r * 0.04, r * 0.05) + eye(cx + r * 0.24, cy - r * 0.12, r * 0.17, r * 0.22, r * 0.04, r * 0.05)
  + `<path d="M${f(cx - r * 0.16)} ${f(cy + r * 0.2)}Q${cx} ${f(cy + r * 0.34)} ${f(cx + r * 0.16)} ${f(cy + r * 0.2)}" stroke="${INK}" stroke-width="${f(r * 0.07)}" stroke-linecap="round" fill="none"/>`;
// o: tiles (nine [colour, pattern, pattern colour]), step (a tile's size), rot (the board's turn), gap (the gutter),
// radius (a tile's corners: a quilt of separate tiles), marks ([tile, 'X'|'O', colour, size, face]), pop (a tile
// knocked up off the board, drawn last), bg (what shows between tiles).
function quilt(o) {
  const step = o.step || 400, x0 = 512 - step * 1.5, gap = o.gap == null ? 40 : o.gap, rad = o.radius || 0, sc = step / 400;
  const at = k => [x0 + (k % 3) * step + step / 2, x0 + Math.floor(k / 3) * step + step / 2];
  const tile = (k, extra = '') => {
    const [bg, p, c] = (o.tiles || TILES)[k], [cx, cy] = at(k), inset = rad ? gap / 2 / sc : 0;
    return `<clipPath id="q${k}"><rect x="${inset}" y="${inset}" width="${400 - 2 * inset}" height="${400 - 2 * inset}" rx="${rad / sc}"/></clipPath><g transform="translate(${f(cx - step / 2)} ${f(cy - step / 2)}) scale(${f(sc * 1000) / 1000})"><g clip-path="url(#q${k})"><rect width="400" height="400" fill="${bg}"/>${PAT[p](c)}</g>${rad ? `<rect x="${inset}" y="${inset}" width="${400 - 2 * inset}" height="${400 - 2 * inset}" rx="${rad / sc}" fill="none" stroke="${INK}" stroke-width="${f(14 / sc)}"/>` : ''}${extra}</g>`;
  };
  const mark = ([k, t, col, r, fc, dx = 0, dy = 0]) => {   // (dx, dy: off the tile's centre, for a tile mostly off the edge)
    const [cx, cy] = at(k), x = cx + dx, y = cy + dy, rr = r * sc;
    return (t === 'X' ? xMark(x, y, rr, col, rr * 0.7, rr * 0.3) : oMark(x, y, rr, col, rr * 0.64, rr * 0.36)) + (fc ? face(x, y, rr * (t === 'X' ? 1.7 : 1.6)) : '');
  };
  let body = '';
  for (let k = 0; k < 9; k++) if (k !== o.pop) body += tile(k);
  const gut = rad ? '' : [x0 + step, x0 + 2 * step].flatMap(v => [line(v, -400, v, 1424, INK, gap), line(-400, v, 1424, v, INK, gap)]).join('');
  const marks = (o.marks || []).filter(m => m[0] !== o.pop).map(m => mark(m)).join('');
  let pop = '';
  if (o.pop != null) {
    const [cx, cy] = at(o.pop), m = (o.marks || []).find(q => q[0] === o.pop);
    const lifted = `<g transform="translate(${cx} ${cy}) rotate(${o.popRot || 12}) scale(1.1) translate(${-cx} ${-cy})">`;
    pop = `<rect x="${x0 + step + gap / 2}" y="${x0 + step + gap / 2}" width="${step - gap}" height="${step - gap}" fill="${INK}"/>`   // the hole it left
      + `<g transform="translate(26 30)">${lifted}<rect x="${cx - step / 2}" y="${cy - step / 2}" width="${step}" height="${step}" fill="${INK}"/></g></g>`
      + lifted + tile(o.pop) + `<rect x="${cx - step / 2}" y="${cy - step / 2}" width="${step}" height="${step}" fill="none" stroke="${INK}" stroke-width="22"/>` + (m ? mark(m) : '') + '</g>';
  }
  return wrap(o.bg || INK, g(`rotate(${o.rot == null ? -6 : o.rot} 512 512)`, body + gut + marks + pop));
}
const PW_MARKS = [[4, 'X', PW.T, 110], [2, 'O', PW.CR, 82], [7, 'O', PW.M, 82]];
const PW_MARKS2 = [[4, 'X', PW.T, 110], [5, 'O', PW.CR, 82], [7, 'O', PW.M, 82]];   // (the Os off the corners, which iOS rounds away)
function patchwork() { return quilt({ marks: PW_MARKS }); }
// 5. Cracked: one giant safety-orange X on cobalt, split down the middle, its two halves knocked apart, chips flying.
function cracked() {
  const BG = '#1f3fd8', OR = '#ff7a1a';
  const r = 290, cx = 512, cy = 512, w = 190;
  const X = line(cx - r, cy - r, cx + r, cy + r, INK, w + 44) + line(cx + r, cy - r, cx - r, cy + r, INK, w + 44) + line(cx - r, cy - r, cx + r, cy + r, OR, w) + line(cx + r, cy - r, cx - r, cy + r, OR, w);
  const crack = [[600, 60], [560, 300], [610, 400], [470, 520], [560, 600], [430, 760], [470, 980]];
  const path = crack.map(([x, y], k) => (k ? 'L' : 'M') + x + ' ' + y).join('');
  const left = `M-10 -10L${crack[0][0]} -10` + crack.map(([x, y]) => `L${x} ${y}`).join('') + 'L-10 1034Z';
  const right = `M1034 -10L${crack[0][0]} -10` + crack.map(([x, y]) => `L${x} ${y}`).join('') + 'L1034 1034Z';
  const mask = `<mask id="xm" maskUnits="userSpaceOnUse" x="0" y="0" width="${S}" height="${S}">${line(cx - r, cy - r, cx + r, cy + r, '#fff', w + 44)}${line(cx + r, cy - r, cx - r, cy + r, '#fff', w + 44)}</mask>`;
  const half = (id, d, t) => `<clipPath id="${id}"><path d="${d}"/></clipPath><g transform="${t}"><g clip-path="url(#${id})">${X}<path d="${path}" stroke="${INK}" stroke-width="24" fill="none" stroke-linejoin="round" mask="url(#xm)"/></g></g>`;
  const chip = (x, y, s, rot) => g(`rotate(${rot} ${x} ${y})`, `<polygon points="${x},${y - s} ${x + s},${y + s * 0.6} ${x - s * 0.8},${y + s * 0.5}" fill="${OR}" stroke="${INK}" stroke-width="12" stroke-linejoin="round"/>`);
  return wrap(BG, mask + half('l', left, 'translate(-28 10) rotate(-4 512 512)') + half('r', right, 'translate(28 -10) rotate(4 512 512)')
    + chip(512, 190, 40, 20) + chip(600, 168, 26, -30) + chip(476, 846, 34, 50) + chip(560, 860, 22, 10));
}
// 6. Knocked loose: a calm cream grid on deep green, and one square knocked out of it and spinning off, the X on it.
function knocked() {
  const BG = '#0e4d2e', CR = '#f7ebcb', Y = '#ffd23f';
  const a = 176, b = 848, l1 = 400, l2 = 624;
  const grid = [[l1, a, l1, b], [l2, a, l2, b], [a, l1, b, l1], [a, l2, b, l2]].map(p => line(...p, CR, 46)).join('');
  const cx = 742, cy = 290, s = 236;
  const tile = g(`rotate(16 ${cx} ${cy})`, `<rect x="${cx - s / 2 + 22}" y="${cy - s / 2 + 26}" width="${s}" height="${s}" rx="34" fill="${INK}"/><rect x="${cx - s / 2}" y="${cy - s / 2}" width="${s}" height="${s}" rx="34" fill="${Y}" stroke="${INK}" stroke-width="18"/>` + xMark(cx, cy, 58, INK, 44, 0));
  const speed = [[560, 380, 610, 352], [590, 440, 650, 408], [540, 320, 580, 300]].map(p => line(...p, Y, 20)).join('');
  return wrap(BG, grid + oMark(288, 512, 62, CR, 34, 0) + xMark(512, 736, 58, CR, 38, 0) + oMark(736, 736, 62, CR, 34, 0) + speed + tile);
}

const OPTIONS = [
  { id: 'blast', name: 'Blast', draw: blast, why: 'The board you know, with its middle square going off: tic-tac-toe, and every square a game, at a glance.' },
  { id: 'scuffle', name: 'Scuffle', draw: scuffle, why: 'X and O mid-fight: characters and chaos, the loudest pink and lime on any home screen.' },
  { id: 'toybox', name: 'Toybox', draw: toybox, why: 'The grid filled with the mini-games themselves; one electric orange on black stands out from every bright neighbour.' },
  { id: 'patchwork', name: 'Patchwork', draw: patchwork, why: 'The whole icon is the board, nine squares, nine different games, set crooked: chaos as a pattern.' },
  { id: 'cracked', name: 'Cracked', draw: cracked, why: 'One giant X split in two: the simplest shape and the strongest silhouette at 60 px.' },
  { id: 'knocked', name: 'Knocked loose', draw: knocked, why: 'A calm, classic grid with one square knocked out of it: the twist, quiet until you notice.' },
];
// Patchwork's variations (round 2, October 2026): the same board, one change each.
const HOUSE = [[PW.T, 'stripes', PW.CR], [PW.M, 'dots', INK], [PW.SKY, 'none'], [PW.CR, 'checks', '#f4dca6'], [PW.CR, 'none'], [PW.BG, 'zig', '#8cc56a'], [PW.SKY, 'rings', '#8fc6e0'], [INK, 'none'], [PW.M, 'stripes', PW.T]];
const PATCHWORK = [
  { id: 'pw-original', name: 'Original', draw: patchwork, why: 'Round one\'s Patchwork as it was, the reference (its top-right O sits where iOS rounds the corner; the others move it).' },
  { id: 'pw-straight', name: 'Straight', draw: () => quilt({ rot: 0, marks: PW_MARKS2 }), why: 'The same board set square: calmer and tidier, the chaos left to the patterns.' },
  { id: 'pw-closeup', name: 'Close-up', draw: () => quilt({ step: 520, rot: -8, gap: 46, marks: [[4, 'X', PW.T, 120], [7, 'O', PW.M, 64, false, 0, -150]] }), why: 'Zoomed in on the middle square: the X is twice the size, so it reads at 40 px, the neighbours spilling off the edges.' },
  { id: 'pw-popout', name: 'Pop-out', draw: () => quilt({ pop: 4, popRot: 15, marks: PW_MARKS2 }), why: 'The middle square knocked up off the board, the X on it: something is always happening on this board.' },
  { id: 'pw-faces', name: 'Faces', draw: () => quilt({ marks: [[4, 'X', PW.T, 116, true], [7, 'O', PW.M, 86, true], [5, 'O', PW.CR, 86, true]] }), why: 'The game\'s own X and O characters on the board: the most personality, and the link to the art inside the app.' },
  { id: 'pw-house', name: 'House colours', draw: () => quilt({ tiles: HOUSE, marks: [[4, 'X', PW.T, 110], [5, 'O', PW.CR, 82], [7, 'O', PW.M, 82]] }), why: 'Only the game\'s own colours (tomato, mustard, sky, green, cream): it matches the app the moment it opens.' },
  { id: 'pw-quilt', name: 'Quilt', draw: () => quilt({ rot: -5, gap: 34, radius: 44, bg: INK, marks: PW_MARKS2 }), why: 'Nine separate rounded tiles like a set of stickers: a softer, toy-like take that still reads as a board.' },
];
// Round 3 (November 2026): the icon in the game's own Comic Chaos look (src/ui/comic.css, art.js toonG, fx.js burstSvg):
// the X and O characters as the game draws them (the same strokes and faces, the eyes a little bigger to read at 60 px),
// its red, yellow, ink and paper, the sunburst, the halftone and the comic burst. Everything that matters inside the
// middle 80% (iOS rounds the corners). Still plain SVG: no fonts, gradients or filters.
const CC = { X: '#e5432a', O: '#f6c21b', PAPER: '#fff8e8', SOFT: '#fbe39a' };
// The sunburst: n wedges about (cx, cy), every other one filled.
const sunburst = (cx, cy, n, col, op, rot = 0) => Array.from({ length: n }, (_, k) => {
  const a0 = rot + k * 2 * Math.PI / n, a1 = a0 + Math.PI / n, R = 1600;
  return `<polygon points="${cx},${cy} ${f(cx + R * Math.cos(a0))},${f(cy + R * Math.sin(a0))} ${f(cx + R * Math.cos(a1))},${f(cy + R * Math.sin(a1))}" fill="${col}" fill-opacity="${op}"/>`;
}).join('');
// Halftone: dots on a diagonal grid, big at (px, py) and shrinking to nothing `reach` away.
function halftone(px, py, reach, col, op, step = 38, maxR = 14) {
  let out = '';
  for (let j = -2; j * step / 2 < S + step; j++) for (let i = -2; i * step < S + step; i++) {
    const x = i * step + (j % 2 ? step / 2 : 0), y = j * step / 2, d = Math.hypot(x - px, y - py), r = maxR * (1 - d / reach);
    if (r > 1.6) out += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}"/>`;
  }
  return `<g fill="${col}" fill-opacity="${op}">${out}</g>`;
}
// The comic burst (fx.js burstSvg's shape): 2n points round an ellipse, long and short in turn.
function ccPts(cx, cy, rx, ry, n, seed, rot = 0, deep = 0.6) {
  let sd = seed * 7919 + 13; const r = () => { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; };
  const pts = [];
  for (let k = 0; k < n * 2; k++) { const a = k * Math.PI / n - Math.PI / 2 + rot, q = k % 2 === 0 ? 0.88 + r() * 0.12 : deep + r() * 0.08; pts.push(f(cx + Math.cos(a) * rx * q) + ',' + f(cy + Math.sin(a) * ry * q)); }
  return pts.join(' ');
}
const ccBurst = (cx, cy, rx, ry, n, seed, fill, sw, rot = 0) => `<polygon points="${ccPts(cx, cy, rx, ry, n, seed, rot)}" fill="${fill}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>`;
// The game's character (art.js toonG, in its own 100-unit box) at (cx, cy), `size` across its box, turned `rot` degrees.
// o: look [x, y] (where the pupils sit), brows (set for a fight), mouth 'smile' | 'grin' | 'open', eyes (their size, 1 = the game's),
// shadow (a hard ink drop shadow, the panels' own).
function mascot(t, cx, cy, size, rot, o = {}) {
  const es = o.eyes || 1.25, [lx, ly] = o.look || [1.5, 2], ey = t === 'X' ? 44 : 46, mx = (t === 'X' ? 8 : 7.4) * es * 0.96;
  const shape = (col, w) => t === 'X' ? `<path d="M22 20L78 80M78 20L22 80" stroke="${col}" stroke-width="${w}" stroke-linecap="round" fill="none"/>` : `<circle cx="50" cy="50" r="32" stroke="${col}" stroke-width="${w}" fill="none"/>`;
  const eyeAt = x => `<ellipse cx="${f(x)}" cy="${ey}" rx="${f(6.5 * es)}" ry="${f(9 * es)}" fill="#fff" stroke="${INK}" stroke-width="3"/><ellipse cx="${f(x + lx * es)}" cy="${f(ey + ly * es)}" rx="${f(3.4 * es)}" ry="${f(5.6 * es)}" fill="${INK}"/>`;
  const brow = (x, d) => `<path d="M${f(x + d * 7.5 * es)} ${f(ey - 13.5 * es)}L${f(x - d * 5.5 * es)} ${f(ey - 7.5 * es)}" stroke="${INK}" stroke-width="${f(4.2 * es)}" stroke-linecap="round"/>`;
  const my = t === 'X' ? 60 : 59, m0 = my + (es - 1) * 9;
  const mouth = o.mouth === 'open' ? `<path d="M${f(50 - 9 * es)} ${f(m0 - 1)}Q50 ${f(m0 + 17 * es)} ${f(50 + 9 * es)} ${f(m0 - 1)}Z" fill="${INK}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M${f(50 - 4.5 * es)} ${f(m0 + 5.5 * es)}Q50 ${f(m0 + 2.5 * es)} ${f(50 + 4.5 * es)} ${f(m0 + 5.5 * es)}Q50 ${f(m0 + 9.5 * es)} ${f(50 - 4.5 * es)} ${f(m0 + 5.5 * es)}Z" fill="${CC.X}"/>`
    : o.mouth === 'grin' ? `<path d="M${f(50 - 9 * es)} ${f(m0 - 1)}Q50 ${f(m0 + 10 * es)} ${f(50 + 9 * es)} ${f(m0 - 1)}Z" fill="#fff" stroke="${INK}" stroke-width="3.2" stroke-linejoin="round"/>`
      : `<path d="M${f(50 - 8 * es)} ${f(m0)}Q50 ${f(m0 + 7 * es)} ${f(50 + 8 * es)} ${f(m0)}" stroke="${INK}" stroke-width="3.5" stroke-linecap="round" fill="none"/>`;
  const body = (o.shadow ? `<g transform="translate(${o.shadow} ${o.shadow * 1.15})">${shape(INK, t === 'X' ? 26 : 25)}</g>` : '')
    + shape(INK, t === 'X' ? 26 : 25) + (t === 'O' ? `<circle cx="50" cy="50" r="27" fill="${o.fill || CC.PAPER}"/>` : '') + shape(t === 'X' ? CC.X : CC.O, 15)
    + eyeAt(50 - mx) + eyeAt(50 + mx) + (o.brows ? brow(50 - mx, -1) + brow(50 + mx, 1) : '') + mouth;
  return `<g transform="translate(${cx} ${cy}) rotate(${rot}) scale(${f(size / 100 * 1000) / 1000}) translate(-50 -50)">${body}</g>`;
}
// 1. Face-off: X and O head to head across the page's own red and yellow, a clash burst where they meet. One drawing
// for it and its variations (FACEOFF, round 4). o: x / o ([cx, cy, size, turn] of each character), eyes (their size),
// friendly (smiles, no brows), burst (the clash burst's radius), grid (the board's # behind them), bg ('blue': one
// sea-blue sunburst in place of the red and yellow halves), noLine (no ink line between the halves).
function faceoff(o = {}) {
  const X = o.x || [348, 648, 504, -8], O = o.o || [688, 360, 484, 9], es = o.eyes || 1;
  const mood = o.friendly ? { mouth: 'grin' } : { brows: 1, mouth: 'grin' };
  const blue = o.bg === 'blue';
  const back = blue ? sunburst(512, 512, 14, '#58a8cf', 0.85, 0.13) + halftone(0, 0, 520, INK, 0.2) + halftone(1024, 1024, 520, INK, 0.2)
    : `<polygon points="102,0 1024,0 1024,1024 922,1024" fill="${CC.X}"/>` + sunburst(512, 512, 12, '#fff', 0.17, 0.13)
      + halftone(0, 0, 520, INK, 0.22) + halftone(1024, 1024, 520, INK, 0.26) + (o.noLine ? '' : line(102, -20, 922, 1044, INK, 16));
  const grid = o.grid ? g('rotate(-5 512 512)', [[300, -160, 300, 1184], [724, -160, 724, 1184], [-160, 300, 1184, 300], [-160, 724, 1184, 724]].map(p => line(...p, INK, 44)).join('')) : '';
  const br = o.burst || 205;
  return wrap(blue ? '#3f8fbf' : CC.O, back + grid
    + ccBurst(512, 512, br, br, o.burstN || 11, 4, '#fff', 16, 0.2)
    + mascot('O', O[0], O[1], O[2], O[3], { look: o.friendly ? [-1.6, 1.6] : [-2.2, 2.4], shadow: 2.6, eyes: 1.12 * es, ...mood })
    + mascot('X', X[0], X[1], X[2], X[3], { look: o.friendly ? [1.8, 0.4] : [2.3, -0.6], shadow: 2.6, eyes: 1.25 * es, ...mood }));
}
function ccFaceoff() { return faceoff(); }
// Face-off side by side: X on yellow at the left, O on red at the right, a white lightning bolt down the join.
function foBolt() {
  const bolt = '628,56 424,528 552,528 396,972 640,438 512,438 736,56';
  return wrap(CC.O, `<polygon points="700,-20 1044,-20 1044,1044 372,1044 596,483 468,483" fill="${CC.X}"/>`
    + sunburst(512, 500, 12, '#fff', 0.17, 0.13)
    + halftone(0, 1024, 500, INK, 0.22) + halftone(1024, 0, 500, INK, 0.26)
    + `<polygon points="${bolt}" fill="#fff" stroke="${INK}" stroke-width="18" stroke-linejoin="round"/>`
    + mascot('O', 742, 470, 452, 9, { look: [-2.4, 1], brows: 1, mouth: 'grin', shadow: 2.6, eyes: 1.12 })
    + mascot('X', 280, 560, 452, -9, { look: [2.4, -0.4], brows: 1, mouth: 'grin', shadow: 2.6 }));
}
// 2. Stamp: the board's # running off the icon, and the X stamped into its middle square on a white burst.
function ccStamp() {
  const a = 332, b = 692;
  return wrap(CC.O, sunburst(512, 512, 14, CC.SOFT, 0.8, 0.11)
    + halftone(0, 1024, 470, INK, 0.2) + halftone(1024, 0, 470, INK, 0.2)
    + g('rotate(-5 512 512)', [[a, -140, a, 1164], [b, -140, b, 1164], [-140, a, 1164, a], [-140, b, 1164, b]].map(p => line(...p, INK, 50)).join('')
      + ccBurst(512, 512, 318, 318, 12, 2, '#fff', 20))
    + mascot('X', 512, 508, 570, 7, { look: [1.2, 2], mouth: 'grin', shadow: 2.6, eyes: 1.3 }));
}
// 3. Pop-out: the O grown too big for its square and bursting out of it, the # round it snapped at every side.
function ccPopout() {
  const a = 212, b = 812, cut = 236;                 // the square's lines; a line is hidden from 512 - cut to 512 + cut (the O is there)
  const stub = (x1, y1, x2, y2, px, py, turn) => g(`rotate(${turn} ${px} ${py})`, line(x1, y1, x2, y2, INK, 48));
  const stubs = [a, b].map((v, k) => {
    const t = k ? 1 : -1;                              // each end swung a little outwards about its corner, as if snapped
    return stub(v, -160, v, 512 - cut, v, a, 5 * t) + stub(v, 512 + cut, v, 1184, v, b, -5 * t) + stub(-160, v, 512 - cut, v, a, v, -5 * t) + stub(512 + cut, v, 1184, v, b, v, 5 * t);
  }).join('');
  const bits = [[330, 150, 24, 54], [704, 136, -20, 50], [884, 338, 66, 50], [896, 694, -62, 54], [690, 892, 18, 52], [318, 880, -24, 50], [136, 690, 64, 52], [130, 330, -60, 50]]
    .map(([x, y, r, l]) => g(`rotate(${r} ${x} ${y})`, `<rect x="${x - l / 2}" y="${y - 17}" width="${l}" height="34" rx="8" fill="${CC.PAPER}" stroke="${INK}" stroke-width="12" stroke-linejoin="round"/>`)).join('');
  return wrap(CC.X, sunburst(512, 512, 14, '#fff', 0.15, 0.2)
    + halftone(0, 0, 400, INK, 0.26) + halftone(1024, 0, 400, INK, 0.26) + halftone(0, 1024, 400, INK, 0.26) + halftone(1024, 1024, 400, INK, 0.26)
    + g('rotate(-5 512 512)', stubs + bits)
    + mascot('O', 512, 512, 790, -7, { look: [0.6, -1.8], mouth: 'open', shadow: 1.9, eyes: 1.3 }));
}
const COMIC = [
  { id: 'cc-faceoff', name: 'Face-off', draw: ccFaceoff, why: 'X and O head to head across the game\'s own red and yellow, a clash burst where they meet: the rivalry, and both characters.' },
  { id: 'cc-stamp', name: 'Stamp', draw: ccStamp, why: 'The board\'s # with the X stamped into its middle square on a comic burst: tic-tac-toe at a glance, with a punch.' },
  { id: 'cc-popout', name: 'Pop-out', draw: ccPopout, why: 'The O grown too big for its square and bursting out of it, the # snapped round it: one big face, the boldest at 60 px.' },
];
// Face-off's variations (round 4, November 2026): the same two characters head to head, one change each.
const FACEOFF = [
  { id: 'fo-original', name: 'Original', draw: ccFaceoff, why: 'Round 3\'s Face-off as it was, the reference.' },
  { id: 'fo-closeup', name: 'Close-up', draw: () => faceoff({ x: [338, 664, 640, -8], o: [694, 352, 600, 9], eyes: 1.1, burst: 250 }), why: 'Zoomed in: both characters a quarter bigger, their arms running towards the edges, so the two faces carry the icon at 40 px.' },
  { id: 'fo-bolt', name: 'Bolt', draw: foBolt, why: 'Side by side instead of corner to corner, a white lightning bolt down the join: the classic versus card.' },
  { id: 'fo-board', name: 'On the board', draw: () => faceoff({ grid: 1, noLine: 1, burst: 215 }), why: 'The board\'s # behind them: the one thing the original lacks, a tic-tac-toe cue.' },
  { id: 'fo-burst', name: 'Big burst', draw: () => faceoff({ burst: 420, burstN: 14, noLine: 1 }), why: 'A big white comic burst behind both: each character on white, so red and yellow pop the same and the clash is the picture.' },
  { id: 'fo-blue', name: 'Blue corner', draw: () => faceoff({ bg: 'blue' }), why: 'One sea-blue sunburst in place of the red and yellow halves: both characters stand out fully, and it is the only blue among the red and yellow game icons.' },
  { id: 'fo-pals', name: 'Pals', draw: () => faceoff({ friendly: 1 }), why: 'The same meeting with open smiles and no frowns: friendlier, for a game played with friends.' },
];
// The icon in use (picked November 2026: Face-off, as round 3 drew it): the app's (scripts/make-app-icons.js) and the web's
// (scripts/make-share-images.js). Both draw it at each size from this, never scaled down from a picture.
const APP_ICON = ccFaceoff;
// The same at a browser tab's 16 and 32 px, where two faces are a blur: the two marks on the two halves, no faces, rays or dots.
const APP_ICON_SMALL = () => wrap(CC.O, `<polygon points="102,0 1024,0 1024,1024 922,1024" fill="${CC.X}"/>`
  + oMark(706, 318, 176, CC.O, 108, 108) + xMark(316, 704, 176, CC.X, 124, 108));
module.exports = { OPTIONS, PATCHWORK, COMIC, FACEOFF, APP_ICON, APP_ICON_SMALL, INK };
