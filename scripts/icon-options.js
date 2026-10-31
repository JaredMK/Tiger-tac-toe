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
// crooked; the X in the middle.
function patchwork() {
  const T = '#e5432a', M = '#f6c21b', C = '#2346d8', P = '#ff5fa2', L = '#9ee03a', CR = '#fff1d0', OR = '#ff8a1f', GR = '#2f9e55';
  const step = 400, x0 = -88;   // three 400px tiles from -88 (the board is turned, so it runs past every edge)
  const pat = {
    stripes: (x, y, c) => Array.from({ length: 6 }, (_, k) => `<rect x="${x + k * 70}" y="${y - 40}" width="30" height="${step + 80}" fill="${c}" transform="rotate(25 ${x + step / 2} ${y + step / 2})"/>`).join(''),
    dots: (x, y, c) => Array.from({ length: 16 }, (_, k) => `<circle cx="${x + 60 + (k % 4) * 92}" cy="${y + 60 + Math.floor(k / 4) * 92}" r="22" fill="${c}"/>`).join(''),
    checks: (x, y, c) => Array.from({ length: 16 }, (_, k) => ((k + Math.floor(k / 4)) % 2 ? '' : `<rect x="${x + (k % 4) * 100}" y="${y + Math.floor(k / 4) * 100}" width="100" height="100" fill="${c}"/>`)).join(''),
    zig: (x, y, c) => Array.from({ length: 4 }, (_, k) => `<path d="M${x} ${y + 70 + k * 100}${Array.from({ length: 8 }, (_, j) => `L${x + 50 * (j + 1)} ${y + 70 + k * 100 + (j % 2 ? 0 : -40)}`).join('')}" stroke="${c}" stroke-width="22" fill="none" stroke-linejoin="round"/>`).join(''),
    none: () => '',
  };
  const tiles = [[T, 'stripes', CR], [M, 'dots', INK], [C, 'none'], [P, 'checks', '#ff86b9'], [CR, 'none'], [L, 'zig', GR], [GR, 'dots', L], [INK, 'none'], [OR, 'stripes', M]];
  let body = '';
  tiles.forEach(([bg, p, c], k) => {
    const x = x0 + (k % 3) * step, y = x0 + Math.floor(k / 3) * step;
    body += `<clipPath id="t${k}"><rect x="${x}" y="${y}" width="${step}" height="${step}"/></clipPath><g clip-path="url(#t${k})"><rect x="${x}" y="${y}" width="${step}" height="${step}" fill="${bg}"/>${pat[p](x, y, c)}</g>`;
  });
  const gut = [x0 + step, x0 + 2 * step].flatMap(v => [line(v, -200, v, 1300, INK, 40), line(-200, v, 1300, v, INK, 40)]).join('');
  const mid = x0 + step * 1.5;
  return wrap(INK, g(`rotate(-6 512 512)`, body + gut + xMark(mid, mid, 110, T, 76, 34) + oMark(x0 + step * 2.5, x0 + step * 0.5, 82, CR, 52, 30) + oMark(x0 + step * 1.5, x0 + step * 2.5, 82, M, 52, 30)));
}
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
module.exports = { OPTIONS, INK };
