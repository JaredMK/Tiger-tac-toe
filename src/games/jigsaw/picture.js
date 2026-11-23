// Puzzle Build: the picture and its cut (pure: a seed in, SVG markup out; no page, no clock, no Math.random).
// The picture is original procedural art in the game's comic style (thick ink outlines, flat colours): one of several
// scenes (SCENES), each drawn afresh from the seed (its colours, where things stand, how many), half of them mirrored.
// It is drawn on a sheet 300 by 300 with a margin of PIC.pad all round (the pieces' outer knobs show a little of it),
// and it is made to be cut up: every part of the sheet holds something, and long things (a string of bubbles, a beam,
// a road, a row of hills, a tail of smoke) run on from one piece into the next, so a careful look finds a piece's
// place and a hurried one sometimes does not.
// The cut (jigCut) is the classic one, every side of every piece a knob or a socket, the sheet's outer sides too: a
// piece's outline says nothing of where on the sheet it lies (a flat side would give an edge piece away at a glance;
// on a 3 by 3 grid every piece but the middle one is an edge piece), only what its neighbours' sides must look like.
import { makeRng } from '../../core/random.js';

export const PIC = { size: 300, pad: 30, knob: 0.09 };             // knob: a knob's neck as a share of a piece's side (it stands about 0.21 of the side proud)
const INK = '#161210';
const r1 = v => String(Math.round(v * 10) / 10);
const at = (x, y) => `${r1(x)} ${r1(y)}`;
const pick = (rng, a) => a[Math.floor(rng() * a.length)];
const span = (rng, lo, hi) => lo + rng() * (hi - lo);
// The drawing's words: everything inherits the ink outline from the scene's <g>; `bare` shapes have none.
const tail = o => `${o && o.w ? ` stroke-width="${o.w}"` : ''}${o && o.s ? ` stroke="${o.s}"` : ''}${o && o.op ? ` opacity="${o.op}"` : ''}${o && o.dash ? ` stroke-dasharray="${o.dash}"` : ''}${o && o.bare ? ' stroke="none"' : ''}`;
const P = (d, fill, o) => `<path d="${d}" fill="${fill || 'none'}"${tail(o)}/>`;
const C = (x, y, r, fill, o) => `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}" fill="${fill || 'none'}"${tail(o)}/>`;
const E = (x, y, rx, ry, fill, o) => `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(rx)}" ry="${r1(ry)}" fill="${fill || 'none'}"${tail(o)}/>`;
const R = (x, y, w, h, fill, o) => `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" fill="${fill || 'none'}"${tail(o)}/>`;
const G = (x, y, rot, s, inner) => `<g transform="translate(${at(x, y)})${rot ? ` rotate(${r1(rot)})` : ''}${s && s !== 1 ? ` scale(${r1(s)})` : ''}">${inner}</g>`;
// A band right across the sheet from a wavy top edge down to the foot (a hill, a layer of sky or sea).
const wave = (y, amp, k, ph) => { let d = ''; for (let x = -40; x <= 340; x += 10) d += `${x === -40 ? 'M' : 'L'}${at(x, y + amp * Math.sin((x / 300) * Math.PI * 2 * k + ph))}`; return d; };
const band = (y, amp, k, ph, fill, o) => P(`${wave(y, amp, k, ph)}L340 340L-40 340Z`, fill, o);
const waveY = (x, y, amp, k, ph) => y + amp * Math.sin((x / 300) * Math.PI * 2 * k + ph);
// A jittered grid of spots over a box: one in every cell of it, so no part of the sheet is left bare.
function spots(rng, x0, y0, x1, y1, cols, rows, jit = 0.34) {
  const out = [], w = (x1 - x0) / cols, h = (y1 - y0) / rows;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push([x0 + (c + 0.5 + (rng() - 0.5) * 2 * jit) * w, y0 + (r + 0.5 + (rng() - 0.5) * 2 * jit) * h]);
  return out;
}
const cloud = (x, y, s, fill, o) => P(`M${at(x - 26 * s, y)}a${r1(11 * s)} ${r1(11 * s)} 0 0 1 ${at(13 * s, -12 * s)}a${r1(15 * s)} ${r1(15 * s)} 0 0 1 ${at(27 * s, -4 * s)}a${r1(11 * s)} ${r1(11 * s)} 0 0 1 ${at(12 * s, 16 * s)}z`, fill, o);
const star4 = (x, y, r, fill, o) => P(`M${at(x, y - r)}L${at(x + r * 0.28, y - r * 0.28)}L${at(x + r, y)}L${at(x + r * 0.28, y + r * 0.28)}L${at(x, y + r)}L${at(x - r * 0.28, y + r * 0.28)}L${at(x - r, y)}L${at(x - r * 0.28, y - r * 0.28)}Z`, fill, o);
const bird = (x, y, s) => P(`M${at(x - 9 * s, y - 3 * s)}q${at(5 * s, -5 * s)} ${at(9 * s, 3 * s)}q${at(4 * s, -8 * s)} ${at(9 * s, -3 * s)}`, null, { w: 2.6 });
const tuft = (x, y, s, col) => P(`M${at(x - 6 * s, y)}l${at(2 * s, -8 * s)}l${at(3 * s, 6 * s)}l${at(2 * s, -10 * s)}l${at(3 * s, 9 * s)}l${at(3 * s, -6 * s)}l${at(1 * s, 9 * s)}z`, col, { w: 2 });
const rock = (x, y, s, col) => P(`M${at(x - 10 * s, y)}q${at(1 * s, -11 * s)} ${at(9 * s, -11 * s)}q${at(9 * s, -1 * s)} ${at(11 * s, 11 * s)}z`, col, { w: 2.4 });

// ---------- the scenes: each (rng) => markup on the sheet (-pad .. 300 + pad) ----------
// An island at sea: a sun with long rays, clouds and gulls, a far shore, a sand island with a leaning palm, a sailing
// boat, wave marks on every stretch of water, a buoy and a jumping fish in the swell at the front.
function island(rng) {
  const sky = pick(rng, [['#8fd3f4', '#c9ecfb'], ['#f7b89a', '#fbe3c4'], ['#9fdcd2', '#dff5ee']]), sea = pick(rng, [['#58a8cf', '#3f8fbf', '#2f78a8'], ['#52b8b0', '#36a09a', '#2a837f']]);
  const sx = span(rng, 40, 110), ix = span(rng, 130, 185), bx = span(rng, 215, 262);
  let s = R(-40, -40, 380, 200, sky[0], { bare: 1 }) + band(96, 7, 1.5, span(rng, 0, 6), sky[1], { bare: 1 });
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2 + 0.2, r0 = 36, r2 = k % 2 ? 66 : 92; s += P(`M${at(sx + r0 * Math.cos(a), 52 + r0 * Math.sin(a))}L${at(sx + r2 * Math.cos(a), 52 + r2 * Math.sin(a))}`, null, { s: '#ffcf70', w: 5 }); }
  s += C(sx, 52, 27, '#ffb347');
  for (const [x, y] of spots(rng, 110, 6, 310, 112, 2, 2, 0.26)) s += rng() < 0.6 ? cloud(x + 14, y, span(rng, 0.7, 1.1), '#fff') : bird(x, y, span(rng, 0.9, 1.3));
  s += cloud(span(rng, 300, 330), span(rng, 10, 40), 0.9, '#fff');
  s += bird(span(rng, 20, 90), span(rng, 108, 128), 1) + cloud(span(rng, -10, 40), span(rng, 120, 132), 0.6, '#fff');
  s += P(`M-40 150L-40 141Q${at(span(rng, 20, 60), 118)} ${at(span(rng, 90, 120), 140)}T${at(span(rng, 170, 200), 143)}L340 146L340 150Z`, '#9bbf8a', { w: 2.4 });
  s += R(-40, 148, 380, 200, sea[0]) + band(186, 5, 2.5, span(rng, 0, 6), sea[1], { w: 2.4 }) + band(268, 6, 3, span(rng, 0, 6), sea[2], { w: 2.4 });
  for (const [x, y] of spots(rng, -30, 156, 330, 330, 6, 5)) s += P(`M${at(x - 8, y)}q${at(4, -5)} ${at(8, 0)}q${at(4, -5)} ${at(8, 0)}`, null, { s: '#eaf8ff', w: 2.4 });
  // the boat
  const hull = pick(rng, ['#7a5230', '#2f6b8a', '#8a4f7d']), sail = pick(rng, ['#fff', '#ffe9b8', '#c9f0d6']);
  s += G(bx, 178, span(rng, -4, 4), 1, P('M-30 0L30 0L20 16L-22 16Z', hull) + P('M0 0L0 -62', null, { w: 3.4 }) + P('M4 -58L4 -8L34 -8Z', sail) + P('M-4 -50L-4 -8L-26 -8Z', sail) + P('M0 -62l14 5l-14 5', '#3fa7d6', { w: 2 }));
  // the island and its palm
  s += E(ix, 236, span(rng, 78, 96), 30, '#f2d08a') + E(ix - 30, 240, 9, 4, '#e3b96a', { w: 2 }) + rock(ix + 52, 238, 1.1, '#9a8f86') + tuft(ix - 54, 226, 1.2, '#4e9d3a');
  const lean = span(rng, -26, 26), tx = ix + lean, ty = 112;
  s += P(`M${at(ix - 6, 214)}Q${at(ix + lean * 0.2 - 8, 160)} ${at(tx - 5, ty)}L${at(tx + 5, ty)}Q${at(ix + lean * 0.2 + 8, 160)} ${at(ix + 8, 214)}Z`, '#a9713d');
  for (let k = 1; k < 6; k++) { const y = 214 - k * 17, x = ix + lean * ((214 - y) / 102) ** 1.6 * 0.9; s += P(`M${at(x - 7, y)}q${at(7, 4)} ${at(14, 0)}`, null, { w: 2 }); }
  for (const a of [-160, -118, -62, -20, 22]) { const g = pick(rng, ['#4e9d3a', '#3d8a3a', '#62b04a']); s += G(tx, ty, a, 1, P('M0 0Q26 -20 62 -4Q34 8 0 0Z', g, { w: 2.6 })); }
  s += C(tx - 5, ty + 7, 5.5, '#6b4a2b', { w: 2 }) + C(tx + 6, ty + 9, 5.5, '#6b4a2b', { w: 2 });
  // the front: a buoy and a fish
  const fx = span(rng, 30, 80);
  s += G(span(rng, 222, 268), 286, span(rng, -12, 12), 1, P('M-10 8L-6 -14L6 -14L10 8Z', '#f08a4b') + R(-6, -8, 12, 6, '#fff', { w: 2 }) + P('M0 -14L0 -26', null, { w: 3 }) + C(0, -29, 4, '#ffe58a', { w: 2 }));
  s += G(fx, 292, span(rng, -30, -10), 1, P('M-18 0Q0 -14 18 0Q0 14 -18 0Z', '#ff9f6b') + P('M-18 0l-10 -8v16z', '#ff9f6b') + C(9, -2, 2, INK, { bare: 1 })) + P(`M${at(fx - 22, 312)}q${at(22, -12)} ${at(44, 0)}`, null, { s: '#eaf8ff', w: 3 });
  return s;
}
// A rocket among planets: a starry sky with drifts of colour, a ringed planet, a cratered moon, a comet, the rocket on
// its long trail of puffs from the ground, and the grey ground with its craters and a flag.
function rocket(rng) {
  const dark = pick(rng, ['#1d2540', '#231d3f', '#14283a']), drift = pick(rng, [['#3a2f6b', '#2a3a7a'], ['#4a2a5e', '#2f3f80'], ['#1f4a66', '#3a2f6b']]);
  let s = R(-40, -40, 380, 380, dark, { bare: 1 });
  s += P(`M-40 ${r1(span(rng, 30, 70))}Q90 ${r1(span(rng, -20, 20))} 180 ${r1(span(rng, 70, 110))}T340 ${r1(span(rng, 20, 60))}L340 ${r1(span(rng, 120, 150))}Q230 ${r1(span(rng, 170, 200))} 140 ${r1(span(rng, 130, 160))}T-40 ${r1(span(rng, 150, 190))}Z`, drift[0], { bare: 1 });
  s += P(`M-40 ${r1(span(rng, 190, 220))}Q80 ${r1(span(rng, 150, 180))} 170 ${r1(span(rng, 215, 240))}T340 ${r1(span(rng, 170, 200))}L340 300L-40 300Z`, drift[1], { bare: 1 });
  for (const [x, y] of spots(rng, -30, -30, 330, 262, 7, 6, 0.42)) { const k = rng(); s += k < 0.3 ? star4(x, y, span(rng, 5, 9), '#fff3b0', { w: 1.6 }) : k < 0.75 ? C(x, y, span(rng, 1.6, 3), '#fff', { bare: 1 }) : C(x, y, span(rng, 2.5, 4), pick(rng, ['#8fd3f4', '#ffc9de', '#fff3b0']), { w: 1.4 }); }
  const px = span(rng, 48, 92), py = span(rng, 52, 96), pr = span(rng, 34, 44), pc = pick(rng, [['#f2a65a', '#d9793a'], ['#7fd1ae', '#4fa58a'], ['#c79bf2', '#9a6fd6']]);
  s += G(px, py, span(rng, -28, -8), 1, P(`M${r1(-pr * 1.9)} 0A${r1(pr * 1.9)} ${r1(pr * 0.42)} 0 0 1 ${r1(pr * 1.9)} 0`, null, { s: '#ffe9a3', w: 7 }) + P(`M${r1(-pr * 1.9)} 0A${r1(pr * 1.9)} ${r1(pr * 0.42)} 0 0 1 ${r1(pr * 1.9)} 0`, null, { w: 1.6 })
    + C(0, 0, pr, pc[0]) + P(`M${r1(-pr * 0.93)} ${r1(-pr * 0.3)}Q0 ${r1(-pr * 0.62)} ${r1(pr * 0.93)} ${r1(-pr * 0.3)}`, null, { s: pc[1], w: 6 }) + P(`M${r1(-pr * 0.8)} ${r1(pr * 0.55)}Q0 ${r1(pr * 0.22)} ${r1(pr * 0.8)} ${r1(pr * 0.55)}`, null, { s: pc[1], w: 5 }) + C(0, 0, pr, null)
    + P(`M${r1(-pr * 1.9)} 0A${r1(pr * 1.9)} ${r1(pr * 0.42)} 0 0 0 ${r1(pr * 1.9)} 0`, null, { w: 10 }) + P(`M${r1(-pr * 1.9)} 0A${r1(pr * 1.9)} ${r1(pr * 0.42)} 0 0 0 ${r1(pr * 1.9)} 0`, null, { s: '#ffe9a3', w: 6 }));
  const mx = span(rng, 222, 262), my = span(rng, 150, 186), mr = span(rng, 20, 27);
  s += C(mx, my, mr, '#d8dbe6') + C(mx - mr * 0.3, my - mr * 0.2, mr * 0.26, '#b4b8c9', { w: 2 }) + C(mx + mr * 0.35, my + mr * 0.3, mr * 0.2, '#b4b8c9', { w: 2 }) + C(mx + mr * 0.2, my - mr * 0.5, mr * 0.13, '#b4b8c9', { w: 1.6 });
  const cx = span(rng, 205, 250), cy = span(rng, 22, 52);
  s += P(`M${at(cx, cy)}L${at(cx + 96, cy - 30)}L${at(cx + 8, cy + 10)}Z`, '#bfe9ff', { w: 2 }) + P(`M${at(cx + 14, cy + 2)}L${at(cx + 70, cy - 14)}`, null, { s: '#fff', w: 3 }) + C(cx, cy + 4, 9, '#fff');
  // the ground
  s += band(262, 7, 1.6, span(rng, 0, 6), '#9aa0b5') + band(292, 5, 2.4, span(rng, 0, 6), '#7d8399', { w: 2.4 });
  for (const [x, y] of spots(rng, -20, 268, 320, 322, 5, 2)) s += E(x, y, span(rng, 8, 15), span(rng, 3, 5.5), '#7d8399', { w: 2 });
  const gx = span(rng, 30, 86);
  s += P(`M${at(gx, 268)}L${at(gx, 226)}`, null, { w: 3.4 }) + P(`M${at(gx, 228)}l26 6l-26 9z`, pick(rng, ['#58c7a0', '#ff9fc0', '#8fd3f4']), { w: 2.4 });
  // the rocket and its trail
  const rx = span(rng, 135, 178), ry = span(rng, 112, 142), rot = span(rng, 18, 48), body = pick(rng, ['#f4f1e8', '#cfe6f7', '#ffe3c2']), trim = pick(rng, ['#3fa7d6', '#7b5ea7', '#2a9d8f', '#f08a4b']);
  const ax = Math.sin((rot * Math.PI) / 180), ay = -Math.cos((rot * Math.PI) / 180);
  for (let k = 0; k < 7; k++) { const d = 66 + k * 24, wob = (k % 2 ? 7 : -7) * (1 + k * 0.2); s += C(rx - ax * d + ay * wob, ry - ay * d - ax * wob, 8 + k * 2.3, k % 2 ? '#e8e3f2' : '#fff', { w: 2.2 }); }
  s += G(rx, ry, rot, 1, P('M-9 44Q0 78 9 44Z', '#ff8a3d', { w: 2.4 }) + P('M-5 44Q0 62 5 44Z', '#ffe58a', { bare: 1 })
    + P('M-16 20L-34 46L-16 40Z', trim) + P('M16 20L34 46L16 40Z', trim) + P('M0 -58Q-24 -22 -17 42L17 42Q24 -22 0 -58Z', body) + P('M0 -58Q-11 -44 -14.500 -30L14.500 -30Q11 -44 0 -58Z', trim)
    + C(0, -8, 9.500, '#8fd3f4') + C(0, -8, 9.500, null, { w: 2 }) + P('M-17 26L17 26', null, { w: 2.4 }) + P('M0 26L0 44', null, { w: 4, s: trim }) + P('M0 26L0 44', null, { w: 1.4 }));
  return s;
}
// A hot-air balloon over hills: a banded sky with a sun and clouds, the striped balloon and a far one, a string of
// little flags, three rows of hills with trees and houses, and a road winding up from the front.
function balloon(rng) {
  const sky = pick(rng, [['#7cc4f0', '#a8dcf7', '#d8f1fb'], ['#f6c1a0', '#fbdcbf', '#fdf0dc'], ['#b9a7e8', '#d7caf3', '#f0e9fb']]), hills = pick(rng, [['#a8d98a', '#6fbf6a', '#3f9a4e'], ['#d6cf7a', '#a9b85a', '#6f9440'], ['#9fd6c2', '#5fb79a', '#2f8f78']]);
  let s = R(-40, -40, 380, 300, sky[0], { bare: 1 }) + band(70, 8, 1.2, span(rng, 0, 6), sky[1], { bare: 1 }) + band(140, 7, 1.7, span(rng, 0, 6), sky[2], { bare: 1 });
  const sx = span(rng, 232, 280);
  s += C(sx, 44, 40, '#ffe7b0', { bare: 1 }) + C(sx, 44, 25, '#ffb347');
  for (const [x, y] of spots(rng, -30, -24, 210, 170, 3, 3)) s += rng() < 0.7 ? cloud(x, y, span(rng, 0.7, 1.2), '#fff') : bird(x, y, 1.1);
  s += cloud(span(rng, 230, 290), span(rng, 108, 150), 0.9, '#fff') + bird(span(rng, 190, 230), span(rng, 84, 100), 1);
  // the flags' string, corner to corner of the sky
  const f0 = span(rng, 150, 190), sag = span(rng, 24, 40);
  s += P(`M-40 ${r1(f0)}Q150 ${r1(f0 + sag * 2 - 120)} 340 ${r1(f0 - 96)}`, null, { w: 2 });
  for (let k = 0; k < 11; k++) { const t = (k + 0.5) / 11, x = -40 + 380 * t, y = (1 - t) * (1 - t) * f0 + 2 * t * (1 - t) * (f0 + sag * 2 - 120) + t * t * (f0 - 96); s += P(`M${at(x - 8, y - 1)}l16 -4l-6 16z`, ['#58c7a0', '#ff9fc0', '#8fd3f4', '#c79bf2'][k % 4], { w: 2 }); }
  // the hills
  const h1 = span(rng, 0, 6), h2 = span(rng, 0, 6), h3 = span(rng, 0, 6);
  s += band(196, 14, 1.3, h1, hills[0]);
  for (const [x] of spots(rng, -30, 0, 330, 1, 6, 1)) { const y = waveY(x, 196, 14, 1.3, h1) + 3; s += P(`M${at(x, y)}l0 -14`, null, { w: 2.6 }) + C(x, y - 20, 9, '#4e9d3a', { w: 2.2 }); }
  s += band(228, 12, 1.8, h2, hills[1]);
  const hx = span(rng, 30, 100), hy = waveY(hx, 228, 12, 1.8, h2) + 6, roof = pick(rng, ['#c0603f', '#7b5ea7', '#3f7fa6']);
  s += R(hx - 15, hy - 20, 30, 22, '#fff4dc') + P(`M${at(hx - 20, hy - 20)}L${at(hx, hy - 38)}L${at(hx + 20, hy - 20)}Z`, roof) + R(hx - 4, hy - 10, 8, 12, '#8a5a3c', { w: 2 });
  const wx = span(rng, 210, 270), wy = waveY(wx, 228, 12, 1.8, h2) + 4;
  s += P(`M${at(wx - 8, wy)}L${at(wx - 5, wy - 34)}L${at(wx + 5, wy - 34)}L${at(wx + 8, wy)}Z`, '#f4f1e8') + G(wx, wy - 34, span(rng, 0, 80), 1, P('M0 0L4 -26L-4 -26ZM0 0L26 4L26 -4ZM0 0L-4 26L4 26ZM0 0L-26 -4L-26 4Z', '#fff', { w: 2 })) + C(wx, wy - 34, 3, INK, { bare: 1 });
  s += band(262, 10, 2.3, h3, hills[2]);
  const r0 = span(rng, 100, 200), r1x = span(rng, 60, 240), ry = waveY(r1x, 262, 10, 2.3, h3) + 2;
  s += P(`M${at(r0 - 24, 340)}Q${at(r0 - 40, 300)} ${at(r1x - 5, ry)}L${at(r1x + 5, ry)}Q${at(r0 + 10, 300)} ${at(r0 + 26, 340)}Z`, '#f3e3b6', { w: 2.6 }) + P(`M${at(r0, 336)}Q${at(r0 - 16, 300)} ${at(r1x, ry + 6)}`, null, { s: '#fff', w: 2.4, dash: '7 8' });
  const px = Math.max(112, Math.min(188, r0 + (r0 < 150 ? 40 : -40)));
  s += P(`M${at(px, 296)}v-24`, null, { w: 3.4 }) + P(`M${at(px - 13, 272)}h22l6 5l-6 5h-22z`, '#fff4dc', { w: 2 }) + rock(px + (r0 < 150 ? 16 : -16), 298, 0.8, '#b9b0a2');
  for (const [x, y] of spots(rng, -30, 276, 330, 330, 5, 2)) { if (Math.abs(x - r0) < 44 || Math.abs(x - px) < 18) continue; s += rng() < 0.5 ? tuft(x, y, 1.2, '#2f7a3a') : C(x, y, 4, pick(rng, ['#fff', '#ff9fc0', '#ffe58a']), { w: 2 }) + P(`M${at(x, y + 4)}l0 9`, null, { w: 2 }); }
  // the far balloon, then the balloon
  const dx = span(rng, 28, 70), dy = span(rng, 60, 112), dc = pick(rng, ['#58c7a0', '#c79bf2', '#ff9fc0']);
  s += P(`M${at(dx - 9, dy + 16)}L${at(dx - 3, dy + 27)}M${at(dx + 9, dy + 16)}L${at(dx + 3, dy + 27)}`, null, { w: 1.6 }) + C(dx, dy, 19, dc) + E(dx, dy, 7.500, 19, '#fff', { w: 1.8 }) + R(dx - 4, dy + 27, 8, 6, '#a9713d', { w: 1.8 });
  const bx = span(rng, 118, 182), by = span(rng, 86, 110), br = span(rng, 50, 58), c1 = pick(rng, ['#3fa7d6', '#7b5ea7', '#2a9d8f', '#ef7fa8']), c2 = pick(rng, ['#fff4dc', '#ffe58a', '#c9f0d6']);
  s += P(`M${at(bx - br * 0.55, by + br * 0.82)}L${at(bx - 11, by + br + 34)}M${at(bx + br * 0.55, by + br * 0.82)}L${at(bx + 11, by + br + 34)}M${at(bx, by + br)}L${at(bx, by + br + 34)}`, null, { w: 2 });
  s += P(`M${at(bx - br, by)}A${r1(br)} ${r1(br)} 0 1 1 ${at(bx + br, by)}Q${at(bx + br, by + br * 0.7)} ${at(bx + 13, by + br * 1.18)}L${at(bx - 13, by + br * 1.18)}Q${at(bx - br, by + br * 0.7)} ${at(bx - br, by)}Z`, c1);
  s += P(`M${at(bx, by - br)}Q${at(bx - br * 0.74, by - br * 0.5)} ${at(bx - br * 0.62, by + br * 0.1)}Q${at(bx - br * 0.5, by + br * 0.8)} ${at(bx - 7, by + br * 1.18)}L${at(bx + 7, by + br * 1.18)}Q${at(bx + br * 0.5, by + br * 0.8)} ${at(bx + br * 0.62, by + br * 0.1)}Q${at(bx + br * 0.74, by - br * 0.5)} ${at(bx, by - br)}Z`, c2, { w: 2.4 });
  s += P(`M${at(bx, by - br)}Q${at(bx - br * 0.26, by)} ${at(bx - 2, by + br * 1.18)}L${at(bx + 2, by + br * 1.18)}Q${at(bx + br * 0.26, by)} ${at(bx, by - br)}Z`, c1, { w: 2.4 });
  s += R(bx - 13, by + br + 34, 26, 18, '#b9814a') + P(`M${at(bx - 13, by + br + 40)}h26M${at(bx - 4, by + br + 34)}v18M${at(bx + 5, by + br + 34)}v18`, null, { w: 1.6 });
  return s;
}
// A lighthouse at night: a deep sky with a moon and stars, two long beams from the lamp, the tower on its cliff, the
// sea with glints, rocks and a little boat with a lantern.
function lighthouse(rng) {
  const sky = pick(rng, [['#232a52', '#3a3f78', '#5a4a8a'], ['#1f3350', '#2f4f73', '#4a6a8a'], ['#2b2148', '#4a2f6b', '#7a4a7d']]), sea = pick(rng, [['#1f4e79', '#173d61'], ['#1f5a6b', '#164552']]);
  let s = R(-40, -40, 380, 300, sky[0], { bare: 1 }) + band(72, 9, 1.3, span(rng, 0, 6), sky[1], { bare: 1 }) + band(140, 7, 1.8, span(rng, 0, 6), sky[2], { bare: 1 });
  const lx = span(rng, 196, 236), top = span(rng, 74, 90), lampY = top + 13;
  // the beams first (behind everything but the sky)
  const b1 = span(rng, 150, 200), b2 = span(rng, 20, 60);
  s += P(`M${at(lx, lampY)}L-40 ${r1(b1 - 40)}L-40 ${r1(b1 + 8)}Z`, '#fff3b0', { bare: 1, op: 0.5 }) + P(`M${at(lx, lampY)}L340 ${r1(b2 - 16)}L340 ${r1(b2 + 30)}Z`, '#fff3b0', { bare: 1, op: 0.5 });
  for (const [x, y] of spots(rng, -30, -30, 330, 150, 6, 4, 0.42)) { const k = rng(); s += k < 0.3 ? star4(x, y, span(rng, 4, 8), '#fff3b0', { w: 1.6 }) : k < 0.8 ? C(x, y, span(rng, 1.6, 2.8), '#fff', { bare: 1 }) : cloud(x, y, 0.6, sky[1], { w: 2 }); }
  const mx = span(rng, 34, 92), my = span(rng, 36, 70);
  s += C(mx, my, 24, '#fdf3c4') + C(mx + 10, my - 6, 21, sky[0], { bare: 1 }) + P(`M${at(mx + 2, my - 23.500)}A21 21 0 0 0 ${at(mx + 14, my + 14.500)}`, null, { w: 2.4 });
  for (const [x, y] of spots(rng, 0, 108, 300, 168, 3, 1, 0.28)) s += rng() < 0.6 ? cloud(x, y, span(rng, 0.6, 0.9), sky[1], { w: 2 }) : star4(x, y, span(rng, 5, 8), '#fff3b0', { w: 1.6 }) + C(x + 16, y + 12, 2, '#fff', { bare: 1 });
  for (const [x] of spots(rng, 0, 0, 300, 1, 3, 1, 0.3)) s += P(`M${at(x - 26, 187)}q${at(8, -14)} ${at(22, -12)}t${at(30, 12)}z`, sky[1], { w: 2.2 });
  // the sea
  s += R(-40, 186, 380, 200, sea[0]) + band(246, 6, 2.6, span(rng, 0, 6), sea[1], { w: 2.4 });
  for (const [x, y] of spots(rng, -30, 194, 330, 332, 6, 4)) s += P(`M${at(x - 9, y)}q${at(4.500, -5)} ${at(9, 0)}q${at(4.500, -5)} ${at(9, 0)}`, null, { s: rng() < 0.4 ? '#fdf3c4' : '#7fb4d9', w: 2.4 });
  // the boat
  const bx = span(rng, 40, 110), by = span(rng, 206, 226);
  s += G(bx, by, span(rng, -5, 5), 1, P('M-26 0L26 0L18 13L-18 13Z', '#7a5230') + P('M-4 0L-4 -30', null, { w: 3 }) + P('M-4 -30L-4 -6L-24 -6Z', '#e9e2d0', { w: 2.4 }) + P('M10 0L10 -12', null, { w: 2 }) + C(10, -16, 5, '#ffe58a', { w: 2 }));
  // the cliff and the tower
  const cl = lx - span(rng, 66, 92), ct = span(rng, 186, 198);
  s += P(`M${at(cl, 340)}Q${at(cl - 6, 250)} ${at(cl + 16, ct + 14)}Q${at(cl + 30, ct - 6)} ${at(lx - 26, ct)}L${at(lx + 40, ct - 4)}Q${at(lx + 62, ct - 12)} 340 ${r1(ct - 10)}L340 340Z`, '#6b5a55');
  s += P(`M${at(cl + 24, ct + 30)}l14 26l-10 30M${at(lx - 4, ct + 28)}l-12 30l16 34M${at(lx + 50, ct + 20)}l10 38l-14 30`, null, { w: 2.2 });
  s += tuft(lx - 40, ct + 3, 1.2, '#4e8f5a') + tuft(lx + 56, ct - 5, 1.3, '#4e8f5a') + tuft(span(rng, 285, 310), ct - 8, 1.1, '#4e8f5a');
  const stripe = pick(rng, ['#2a9d8f', '#ef7fa8', '#3f7fa6', '#f08a4b']);
  s += P(`M${at(lx - 21, ct + 2)}L${at(lx - 12, top + 26)}L${at(lx + 12, top + 26)}L${at(lx + 21, ct + 2)}Z`, '#f4f1e8');
  for (const t of [0.14, 0.52]) { const y0 = top + 26 + (ct - top - 24) * t, y1 = y0 + (ct - top - 24) * 0.22, w0 = 12 + 9 * t, w1 = 12 + 9 * (t + 0.22); s += P(`M${at(lx - w0, y0)}L${at(lx + w0, y0)}L${at(lx + w1, y1)}L${at(lx - w1, y1)}Z`, stripe, { w: 2.4 }); }
  s += R(lx - 4, ct - 16, 8, 16, '#3a2f2a', { w: 2 }) + R(lx - 16, top + 21, 32, 6, '#3a2f2a', { w: 2 }) + R(lx - 9, top + 4, 18, 18, '#ffe9a3') + P(`M${at(lx - 12, top + 4)}L${at(lx, top - 12)}L${at(lx + 12, top + 4)}Z`, stripe) + P(`M${at(lx, top + 4)}v18`, null, { w: 2 });
  // the rocks in the swell
  for (const [x, y] of spots(rng, -20, 272, cl - 10, 322, 3, 1)) s += rock(x, y, span(rng, 1.2, 2), '#57494a') + P(`M${at(x - 22, y + 2)}q${at(6, -6)} ${at(12, 0)}M${at(x + 12, y + 2)}q${at(6, -6)} ${at(12, 0)}`, null, { s: '#fdf3c4', w: 2.2 });
  return s;
}
// A fish under the sea: shafts of light, layers of water, a big striped fish and a shoal, a jellyfish, bubbles rising
// right up the sheet, tall weeds, coral and a chest on the sandy floor.
function undersea(rng) {
  const sea = pick(rng, [['#7fd6e8', '#4fb7d6', '#2f92bd', '#236f9b'], ['#8fe0c8', '#56bfae', '#2f9a94', '#1f6f78'], ['#9fc4f2', '#6f9fe0', '#4a78c4', '#35579a']]);
  let s = R(-40, -40, 380, 380, sea[0], { bare: 1 }) + band(66, 8, 1.4, span(rng, 0, 6), sea[1], { bare: 1 }) + band(150, 9, 1.1, span(rng, 0, 6), sea[2], { bare: 1 }) + band(224, 7, 1.9, span(rng, 0, 6), sea[3], { bare: 1 });
  for (let k = 0; k < 3; k++) { const x = span(rng, -10 + k * 100, 60 + k * 100), w = span(rng, 22, 38), lean = span(rng, 40, 90); s += P(`M${at(x, -40)}L${at(x + w, -40)}L${at(x + w + lean + 20, 250)}L${at(x + lean - 14, 250)}Z`, '#fff', { bare: 1, op: 0.16 }); }
  for (const [x, y] of spots(rng, 0, 4, 300, 30, 3, 1, 0.3)) s += P(`M${at(x - 20, y)}q${at(10, -7)} ${at(20, 0)}t${at(20, 0)}`, null, { s: '#fff', w: 2.6, op: 0.8 });
  for (const [x, y] of spots(rng, 0, 30, 300, 210, 3, 3, 0.3)) { const k = rng(); s += k < 0.45 ? star4(x, y, span(rng, 4, 6.500), '#fff', { w: 1.4 }) : C(x, y, span(rng, 3, 5), '#dff6ff', { w: 1.8 }) + C(x + 9, y - 7, 2.4, '#dff6ff', { w: 1.6 }); }
  // the floor and what grows on it
  const fp = span(rng, 0, 6);
  for (const [x] of spots(rng, -30, 0, 330, 1, 5, 1)) { const h = span(rng, 70, 150), y = 272, g = pick(rng, ['#2f8f5a', '#3fa56a', '#1f7a5a']); let d = `M${at(x, y)}`; for (let k = 1; k <= 6; k++) d += `Q${at(x + (k % 2 ? 11 : -11), y - (k - 0.5) * (h / 6))} ${at(x, y - k * (h / 6))}`; s += P(d, null, { w: 9 }) + P(d, null, { s: g, w: 5 }); }
  s += band(268, 6, 2.2, fp, '#f0d9a0') + band(302, 5, 3, fp + 2, '#e3c684', { w: 2.2 });
  for (const [x, y] of spots(rng, -20, 284, 320, 326, 6, 2)) s += rng() < 0.5 ? E(x, y, span(rng, 4, 8), 3, '#cdb06e', { w: 1.8 }) : star4(x, y, 7, pick(rng, ['#ff9fc0', '#f08a4b', '#c79bf2']), { w: 2 });
  const kx = span(rng, 34, 90), kc = pick(rng, ['#ff8fa8', '#f08a4b', '#c79bf2']);
  s += P(`M${at(kx, 280)}v-34M${at(kx, 262)}q-16 -6 -18 -26M${at(kx, 256)}q16 -8 20 -30M${at(kx - 9, 250)}q-12 -4 -10 -18M${at(kx + 12, 244)}q10 -2 14 -14`, null, { w: 11 }) + P(`M${at(kx, 280)}v-34M${at(kx, 262)}q-16 -6 -18 -26M${at(kx, 256)}q16 -8 20 -30M${at(kx - 9, 250)}q-12 -4 -10 -18M${at(kx + 12, 244)}q10 -2 14 -14`, null, { s: kc, w: 6 });
  const tx = span(rng, 206, 262);
  s += R(tx - 22, 258, 44, 26, '#a9713d') + P(`M${at(tx - 22, 258)}q22 -22 44 0z`, '#c08a4f') + P(`M${at(tx - 22, 268)}h44M${at(tx - 10, 248)}v36M${at(tx + 10, 248)}v36`, null, { w: 2 }) + R(tx - 4, 262, 8, 9, '#ffe58a', { w: 2 });
  // bubbles, right up the sheet
  for (const x0 of [span(rng, 20, 110), span(rng, 190, 280)]) for (let k = 0; k < 8; k++) s += C(x0 + (k % 2 ? 7 : -6) + k * span(rng, -1, 2), 250 - k * 36 - span(rng, 0, 10), 3 + (k % 3) * 1.6, '#dff6ff', { w: 1.8 });
  // the jellyfish and the shoal
  const jx = span(rng, 30, 86), jy = span(rng, 40, 78), jc = pick(rng, ['#ffc9de', '#d9c2f7', '#fff3b0']);
  for (let k = 0; k < 4; k++) { const x = jx - 15 + k * 10; s += P(`M${at(x, jy + 4)}q-7 14 0 28t0 28q-5 10 0 20`, null, { w: 2.2 }); }
  s += P(`M${at(jx - 24, jy + 6)}A24 24 0 0 1 ${at(jx + 24, jy + 6)}q-6 7 -12 0q-6 7 -12 0q-6 7 -12 0q-6 7 -12 0Z`, jc) + C(jx - 7, jy - 6, 2.2, INK, { bare: 1 }) + C(jx + 7, jy - 6, 2.2, INK, { bare: 1 });
  const fishy = (x, y, sc, rot, col, flip) => G(x, y, rot, sc, `<g transform="scale(${flip ? -1 : 1} 1)">${P('M-16 0Q0 -13 16 0Q0 13 -16 0Z', col, { w: 2 })}${P('M-16 0l-9 -7v14z', col, { w: 2 })}${C(8, -2, 1.8, INK, { bare: 1 })}</g>`);
  const sc0 = pick(rng, ['#ffe58a', '#ffb0c8', '#b8f0d0']), sxx = span(rng, 196, 250), syy = span(rng, 36, 70);
  for (let k = 0; k < 5; k++) s += fishy(sxx + (k % 3) * 26 - (k > 2 ? 12 : 0), syy + Math.floor(k / 3) * 22 + (k % 2) * 6, 1, 0, sc0, true);
  s += fishy(span(rng, 222, 280), span(rng, 196, 226), 1.3, span(rng, -10, 10), pick(rng, ['#8fd3f4', '#ffb0c8']), false) + fishy(span(rng, 20, 70), span(rng, 150, 190), 1.2, span(rng, -10, 10), pick(rng, ['#ffe58a', '#b8f0d0']), false);
  // the big fish
  const bx = span(rng, 128, 176), by = span(rng, 124, 158), bc = pick(rng, [['#ff9f43', '#fff'], ['#7b5ea7', '#ffe58a'], ['#2a9d8f', '#c9f0d6'], ['#ef7fa8', '#fff']]), dir = rng() < 0.5 ? -1 : 1;
  s += G(bx, by, span(rng, -9, 9), 1, `<g transform="scale(${dir} 1)">${P('M-50 0L-82 -26Q-72 0 -82 26Z', bc[0])}${P('M-8 -27Q10 -52 30 -22Z', bc[0])}${P('M-6 24Q4 44 20 22Z', bc[0])}${P('M-56 0Q-20 -40 34 -22Q58 -10 62 2Q54 20 30 24Q-22 38 -56 0Z', bc[0])}${P('M-24 -24Q-12 0 -26 22', null, { s: bc[1], w: 8 })}${P('M6 -27Q18 -2 4 27', null, { s: bc[1], w: 8 })}${P('M-56 0Q-20 -40 34 -22Q58 -10 62 2Q54 20 30 24Q-22 38 -56 0Z', null)}${C(40, -6, 6.500, '#fff', { w: 2 })}${C(41.500, -6, 2.600, INK, { bare: 1 })}${P('M50 8q6 2 10 -3', null, { w: 2.2 })}${P('M14 4q-12 6 -4 14', null, { w: 2.2 })}</g>`);
  return s;
}
// A cabin in snowy woods: a dusk sky with a moon and falling snow, a range of capped mountains, drifts of snow, pines,
// the cabin with its lit window and a long tail of smoke, a path of footprints, a snowman.
function cabin(rng) {
  const sky = pick(rng, [['#3b4a8a', '#7a6fb0', '#f2a6a0'], ['#2f5a7a', '#5f93ad', '#bfe0e6'], ['#4a3a78', '#9a6fa8', '#f7c08a']]), pine = pick(rng, [['#2f6b4f', '#245a41'], ['#356f6a', '#28585a']]);
  let s = R(-40, -40, 380, 300, sky[0], { bare: 1 }) + band(60, 8, 1.3, span(rng, 0, 6), sky[1], { bare: 1 }) + band(122, 6, 1.9, span(rng, 0, 6), sky[2], { bare: 1 });
  const mx = span(rng, 214, 268), my = span(rng, 28, 58);
  s += C(mx, my, 30, '#fff', { bare: 1, op: 0.25 }) + C(mx, my, 20, '#fdf3c4') + C(mx - 6, my - 4, 4, '#eadfa6', { bare: 1 }) + C(mx + 7, my + 6, 3, '#eadfa6', { bare: 1 });
  for (const [x, y] of spots(rng, -30, -30, 330, 120, 6, 3, 0.42)) s += rng() < 0.3 ? star4(x, y, span(rng, 4, 7), '#fff3b0', { w: 1.6 }) : C(x, y, span(rng, 1.8, 3), '#fff', { bare: 1 });
  // the mountains, right across
  let px = -50;
  const peaks = [];
  while (px < 340) { const w = span(rng, 70, 120), h = span(rng, 60, 104); peaks.push([px, w, h]); px += w * span(rng, 0.5, 0.75); }
  peaks.forEach(([x, w, h], k) => { const c = k % 2 ? '#8fa3c8' : '#6f86b5', ax = x + w / 2, ay = 190 - h; s += P(`M${at(x, 196)}L${at(ax, ay)}L${at(x + w, 196)}Z`, c) + P(`M${at(ax, ay)}L${at(ax - w * 0.17, ay + h * 0.34)}l${at(w * 0.08, -h * 0.07)}l${at(w * 0.07, h * 0.1)}l${at(w * 0.08, -h * 0.1)}l${at(w * 0.11, h * 0.07)}Z`, '#fff', { w: 2.2 }); });
  // the snow, the far pines
  const d1 = span(rng, 0, 6), d2 = span(rng, 0, 6);
  s += band(192, 8, 1.4, d1, '#eaf4fb');
  const tree = (x, y, h, c) => { let t = R(x - h * 0.04, y - h * 0.16, h * 0.08, h * 0.18, '#7a5230', { w: 2 }); for (let k = 0; k < 3; k++) { const w = h * (0.3 - k * 0.07), y0 = y - h * (0.14 + k * 0.26), top = y0 - h * 0.36; t += P(`M${at(x - w, y0)}L${at(x, top)}L${at(x + w, y0)}Z`, c[k % 2], { w: 2.4 }) + P(`M${at(x - w * 0.5, y0 - h * 0.18)}L${at(x, top)}L${at(x + w * 0.5, y0 - h * 0.18)}q${at(-w * 0.25, h * 0.05)} ${at(-w * 0.5, 0)}q${at(-w * 0.25, h * 0.05)} ${at(-w * 0.5, 0)}Z`, '#fff', { w: 1.6 }); } return t; };
  for (const [x] of spots(rng, -30, 0, 330, 1, 5, 1)) s += tree(x, waveY(x, 192, 8, 1.4, d1) + 8, span(rng, 50, 74), pine);
  s += band(236, 9, 1.7, d2, '#d5e6f3');
  // the cabin and its smoke
  const cx = span(rng, 112, 180), cy = waveY(cx, 236, 9, 1.7, d2) + 8, wall = pick(rng, ['#a9713d', '#8a5a3c', '#b5835a']), cs = rng() < 0.5 ? -1 : 1;
  const chx = cx + cs * 22;
  for (let k = 0; k < 8; k++) s += C(chx + cs * (k * k * 1.5) + (k % 2 ? 6 : -5), cy - 96 - k * 26, 7 + k * 2.4, k % 2 ? '#f2f4f8' : '#dfe5ee', { w: 2.2 });
  s += R(chx - 7, cy - 84, 14, 30, '#8f8a86') + R(chx - 9, cy - 88, 18, 6, '#fff', { w: 2 });
  s += R(cx - 40, cy - 46, 80, 46, wall) + P(`M${at(cx - 40, cy - 34)}h80M${at(cx - 40, cy - 22)}h80M${at(cx - 40, cy - 10)}h80`, null, { w: 1.8 });
  s += P(`M${at(cx - 50, cy - 44)}L${at(cx, cy - 82)}L${at(cx + 50, cy - 44)}Z`, '#fff') + P(`M${at(cx - 50, cy - 44)}q8 8 16 0q8 8 17 0q8 8 17 0q8 8 17 0q8 8 17 0q8 8 16 0`, '#fff', { w: 2.4 });
  s += R(cx - cs * 24 - 9, cy - 34, 18, 18, '#ffd98a') + P(`M${at(cx - cs * 24, cy - 34)}v18M${at(cx - cs * 24 - 9, cy - 25)}h18`, null, { w: 2 }) + R(cx + cs * 12 - 8, cy - 28, 16, 28, '#5a3a22') + C(cx + cs * 12 + 4, cy - 14, 1.8, '#ffe58a', { bare: 1 });
  // the path of footprints, the near pines, the snowman
  const ex = span(rng, 90, 210);
  for (let k = 0; k < 9; k++) { const t = (k + 0.5) / 9, x = (1 - t) * (cx + cs * 12) + t * ex + Math.sin(t * 5) * 14, y = cy + 6 + t * (336 - cy); s += E(x + (k % 2 ? 5 : -5), y, 3.6, 5, '#b9cfe2', { w: 1.4 }); }
  s += tree(span(rng, -6, 44), span(rng, 312, 330), span(rng, 130, 160), pine) + tree(span(rng, 262, 306), span(rng, 300, 326), span(rng, 104, 136), pine);
  const nx = cx + (cx < 150 ? span(rng, 76, 104) : -span(rng, 76, 104)), ny = span(rng, 280, 296);
  s += C(nx, ny, 16, '#fff') + C(nx, ny - 24, 11, '#fff') + P(`M${at(nx - 8, ny - 34)}h16v-10h-11z`, '#3a2f2a', { w: 2 }) + C(nx - 4, ny - 26, 1.6, INK, { bare: 1 }) + C(nx + 4, ny - 26, 1.6, INK, { bare: 1 }) + P(`M${at(nx, ny - 22)}l9 2l-9 2z`, '#f08a4b', { w: 1.4 }) + P(`M${at(nx - 14, ny - 6)}l-14 -10M${at(nx + 14, ny - 6)}l14 -10`, null, { w: 2.2 }) + P(`M${at(nx - 9, ny - 15)}q9 5 18 0`, null, { s: '#3fa7d6', w: 4 });
  for (const [x, y] of spots(rng, -30, 130, 330, 330, 6, 5, 0.45)) s += C(x, y, span(rng, 1.6, 2.6), '#fff', { w: 1 });
  return s;
}
// A castle on a hill: a morning sky with a rainbow right across, clouds and a kite on its long string, the castle with
// its towers and flags, a moat with a bridge, and a field of flowers at the front.
function castle(rng) {
  const sky = pick(rng, [['#9fd8f5', '#d3eefb'], ['#ffd2b0', '#ffeeda'], ['#bfe6d2', '#e6f6ee']]), stone = pick(rng, [['#d9d2c4', '#bdb5a6'], ['#e6cfc0', '#c9ad9c'], ['#cfd6e0', '#aeb8c6']]), roof = pick(rng, ['#7b5ea7', '#3f7fa6', '#2a9d8f', '#c0603f']);
  let s = R(-40, -40, 380, 300, sky[0], { bare: 1 }) + band(108, 8, 1.4, span(rng, 0, 6), sky[1], { bare: 1 });
  const ax = span(rng, 120, 180), ay = span(rng, 250, 290);
  ['#ef7fa8', '#ffb347', '#fff3b0', '#58c7a0', '#8fd3f4', '#c79bf2'].forEach((c, k) => { const r = 250 - k * 9; s += P(`M${at(ax - r, ay)}A${r} ${r} 0 0 1 ${at(ax + r, ay)}`, null, { s: c, w: 9.500 }); });
  s += P(`M${at(ax - 254.500, ay)}A254.500 254.500 0 0 1 ${at(ax + 254.500, ay)}M${at(ax - 200.500, ay)}A200.500 200.500 0 0 1 ${at(ax + 200.500, ay)}`, null, { w: 2 });
  for (const [x, y] of spots(rng, -30, -24, 330, 120, 4, 2)) s += rng() < 0.6 ? cloud(x, y, span(rng, 0.7, 1.15), '#fff') : bird(x, y, 1.1);
  // the kite and its string, from the sky down to the field
  const kx = span(rng, 36, 96), ky = span(rng, 40, 84), hx = span(rng, 20, 70), kc = pick(rng, [['#58c7a0', '#fff3b0'], ['#8fd3f4', '#ffc9de'], ['#c79bf2', '#fff3b0']]);
  s += P(`M${at(kx, ky + 22)}Q${at(kx + 60, ky + 120)} ${at(hx, 300)}`, null, { w: 1.8 });
  s += P(`M${at(kx, ky - 26)}L${at(kx + 18, ky)}L${at(kx, ky + 22)}L${at(kx - 18, ky)}Z`, kc[0]) + P(`M${at(kx, ky - 26)}L${at(kx + 18, ky)}L${at(kx, ky)}Z`, kc[1], { w: 2 }) + P(`M${at(kx, ky - 26)}v48M${at(kx - 18, ky)}h36`, null, { w: 1.8 });
  for (let k = 1; k < 5; k++) s += P(`M${at(kx - 6 + k * 13, ky + 22 + k * 22)}l10 -5v10z`, kc[k % 2], { w: 1.8 });
  // the far hills, the castle's hill
  const h1 = span(rng, 0, 6);
  s += band(190, 10, 1.6, h1, '#a8d98a');
  for (const [x] of spots(rng, -30, 0, 330, 1, 6, 1)) { const y = waveY(x, 190, 10, 1.6, h1) + 3; s += P(`M${at(x, y)}l0 -12`, null, { w: 2.4 }) + C(x, y - 17, 8, '#4e9d3a', { w: 2.2 }); }
  const cx = span(rng, 150, 206), cy = 214;
  s += P(`M${at(cx - 130, 250)}Q${at(cx - 40, cy - 34)} ${at(cx, cy - 30)}T${at(cx + 130, 250)}Z`, '#6fbf6a');
  const tower = (x, w, h, flag) => { let t = R(x - w / 2, cy - 22 - h, w, h + 8, stone[0]); t += P(`M${at(x - w / 2 - 4, cy - 22 - h)}L${at(x, cy - 22 - h - w * 1.1)}L${at(x + w / 2 + 4, cy - 22 - h)}Z`, roof); t += R(x - 3, cy - 22 - h * 0.62, 6, 10, '#3a2f2a', { w: 1.6 }); t += P(`M${at(x, cy - 22 - h - w * 1.1)}v-16`, null, { w: 2.2 }) + P(`M${at(x, cy - 38 - h - w * 1.1)}l14 4l-14 5z`, flag, { w: 1.8 }); return t; };
  s += tower(cx - 46, 22, span(rng, 56, 74), '#ffb347') + tower(cx + 46, 22, span(rng, 56, 74), '#8fd3f4');
  s += R(cx - 38, cy - 62, 76, 48, stone[0]);
  for (let k = 0; k < 5; k++) s += R(cx - 38 + k * 16.500, cy - 71, 10, 10, stone[0], { w: 2.2 });
  s += P(`M${at(cx - 30, cy - 46)}h14M${at(cx + 12, cy - 46)}h16M${at(cx - 22, cy - 34)}h12M${at(cx + 18, cy - 30)}h12`, null, { s: stone[1], w: 3 });
  s += P(`M${at(cx - 12, cy - 14)}v-18a12 12 0 0 1 24 0v18z`, '#5a3a22') + P(`M${at(cx, cy - 14)}v-30`, null, { w: 1.8 }) + tower(cx, 26, span(rng, 84, 100), '#ef7fa8');
  // the moat, the bridge, the field
  const m1 = span(rng, 0, 6);
  s += band(236, 6, 1.5, m1, '#58a8cf') + band(264, 8, 1.8, m1 + 1.3, '#4e9d3a');
  for (const [x, y] of spots(rng, -30, 242, 330, 258, 6, 1)) s += P(`M${at(x - 8, y)}q4 -5 8 0q4 -5 8 0`, null, { s: '#eaf8ff', w: 2.2 });
  s += P(`M${at(cx - 15, cy - 16)}L${at(cx - 24, 276)}L${at(cx + 24, 276)}L${at(cx + 15, cy - 16)}Z`, '#b9814a') + P(`M${at(cx - 17, cy)}h34M${at(cx - 19, cy + 14)}h38M${at(cx - 21, cy + 30)}h42M${at(cx - 23, cy + 46)}h46`, null, { w: 1.8 });
  for (const [x, y] of spots(rng, -30, 276, 330, 332, 7, 2)) { if (Math.abs(x - cx) < 34 && y < 290) continue; const k = rng(); s += k < 0.3 ? tuft(x, y, 1.2, '#2f7a3a') : P(`M${at(x, y + 3)}l0 11`, null, { w: 2 }) + C(x, y, 4.500, pick(rng, ['#fff', '#ff9fc0', '#ffe58a', '#c79bf2', '#8fd3f4']), { w: 2 }) + C(x, y, 1.4, INK, { bare: 1 }); }
  return s;
}
// A train in the desert: a hot sky with a big sun, mesas right across, a viaduct with a little train and its smoke,
// cacti, a winding stream and rocks.
function desert(rng) {
  const sky = pick(rng, [['#ffcf9a', '#ffe6c2'], ['#f7a88a', '#fbd2b0'], ['#a8d8f0', '#e3f3fb']]), sand = pick(rng, [['#f0c27a', '#e3a85a', '#d18f48'], ['#f2d08a', '#e6b96a', '#c99a50']]), mesa = pick(rng, [['#d9795a', '#b85a44'], ['#c98a5a', '#a86a40'], ['#b97fa0', '#96607f']]);
  let s = R(-40, -40, 380, 300, sky[0], { bare: 1 }) + band(88, 8, 1.2, span(rng, 0, 6), sky[1], { bare: 1 });
  const sx = span(rng, 50, 250);
  s += C(sx, 52, 46, '#fff3c4', { bare: 1, op: 0.7 }) + C(sx, 52, 30, '#ffb347');
  for (const [x, y] of spots(rng, 0, 4, 300, 108, 3, 2, 0.28)) s += Math.abs(x - sx) < 60 && Math.abs(y - 52) < 56 ? bird(x + (x < sx ? -30 : 30), y, 1.1) : rng() < 0.55 ? cloud(x + 12, y, span(rng, 0.6, 1), '#fff') : bird(x, y, 1.1);
  s += cloud(span(rng, -30, -10), span(rng, 20, 60), 0.8, '#fff') + bird(span(rng, 306, 326), span(rng, 30, 70), 1);
  // the mesas
  let px = -50, k = 0;
  while (px < 340) { const w = span(rng, 60, 110), h = span(rng, 44, 86), c = mesa[k++ % 2]; s += P(`M${at(px - 10, 196)}L${at(px + 6, 196 - h)}L${at(px + w - 8, 196 - h - span(rng, -6, 6))}L${at(px + w + 10, 196)}Z`, c) + P(`M${at(px + 4, 196 - h * 0.66)}h${r1(w - 2)}M${at(px, 196 - h * 0.33)}h${r1(w + 6)}`, null, { w: 1.8, op: 0.55 }); px += w * span(rng, 0.8, 1.25); }
  const d1 = span(rng, 0, 6), d2 = span(rng, 0, 6);
  s += band(192, 6, 1.4, d1, sand[0]);
  // the viaduct and the train
  const vy = span(rng, 196, 208), tx = span(rng, 60, 170), eng = pick(rng, ['#2a9d8f', '#3f7fa6', '#7b5ea7']);
  for (let x = -30; x < 340; x += 44) s += P(`M${at(x, vy + 6)}v30a16 16 0 0 1 32 0v-30`, '#b9a58f', { w: 2.4 });
  s += R(-40, vy, 380, 8, '#8f7a66', { w: 2.4 });
  for (let i = 0; i < 6; i++) s += C(tx + 44 + i * i * 2.4 + (i % 2 ? 5 : -4), vy - 46 - i * 20, 7 + i * 2.6, i % 2 ? '#f2f4f8' : '#dfe5ee', { w: 2.2 });
  s += R(tx, vy - 24, 54, 20, eng) + R(tx - 2, vy - 38, 24, 16, eng) + R(tx + 4, vy - 34, 12, 9, '#ffe9a3', { w: 2 }) + R(tx + 38, vy - 38, 10, 14, '#3a2f2a', { w: 2 }) + P(`M${at(tx + 54, vy - 12)}l10 8h-10z`, '#3a2f2a', { w: 2 });
  for (const wx of [tx + 10, tx + 28, tx + 46]) s += C(wx, vy - 3, 6, '#3a2f2a', { w: 2 }) + C(wx, vy - 3, 1.8, '#d8dbe6', { bare: 1 });
  for (let c = 1; c <= 2; c++) { const x0 = tx - c * 46; s += R(x0, vy - 24, 40, 20, ['#f08a4b', '#58c7a0', '#ef7fa8'][c % 3]) + P(`M${at(x0 + 40, vy - 8)}h6`, null, { w: 2.4 }) + R(x0 + 6, vy - 20, 10, 8, '#fff4dc', { w: 1.8 }) + R(x0 + 24, vy - 20, 10, 8, '#fff4dc', { w: 1.8 }) + C(x0 + 9, vy - 3, 6, '#3a2f2a', { w: 2 }) + C(x0 + 31, vy - 3, 6, '#3a2f2a', { w: 2 }); }
  // the near ground: the dry river, the cacti, the rocks
  s += band(244, 8, 1.6, d2, sand[1]) + band(296, 6, 2.3, d2 + 2, sand[2], { w: 2.4 });
  const r0 = span(rng, 60, 240), r1x = span(rng, 40, 260);
  s += P(`M${at(r0 - 30, 340)}Q${at(r0 + 50, 300)} ${at(r1x, 282)}T${at(r0 + 20, 250)}`, null, { w: 16 }) + P(`M${at(r0 - 30, 340)}Q${at(r0 + 50, 300)} ${at(r1x, 282)}T${at(r0 + 20, 250)}`, null, { s: '#9fd6e8', w: 11 });
  const cactus = (x, y, h, c) => P(`M${at(x - h * 0.3, y - h * 0.34)}v${r1(-h * 0.2)}M${at(x + h * 0.3, y - h * 0.5)}v${r1(-h * 0.22)}`, null, { w: h * 0.19 + 5 }) + P(`M${at(x, y)}v${r1(-h)}M${at(x, y - h * 0.3)}h${r1(-h * 0.3)}v${r1(-h * 0.24)}M${at(x, y - h * 0.46)}h${r1(h * 0.3)}v${r1(-h * 0.26)}`, null, { w: h * 0.19 + 5 }) + P(`M${at(x, y)}v${r1(-h)}M${at(x, y - h * 0.3)}h${r1(-h * 0.3)}v${r1(-h * 0.24)}M${at(x, y - h * 0.46)}h${r1(h * 0.3)}v${r1(-h * 0.26)}`, null, { s: c, w: h * 0.19 }) + C(x, y - h - 4, 4, '#ff9fc0', { w: 1.8 });
  for (const [x, y] of spots(rng, -30, 262, 330, 330, 5, 2)) { if (Math.abs(x - r1x) < 40 && y > 270) continue; const q = rng(); s += q < 0.45 ? cactus(x, y, span(rng, 34, 58), pick(rng, ['#4e9d3a', '#3d8a5a'])) : q < 0.8 ? rock(x, y, span(rng, 0.9, 1.5), mesa[1]) : tuft(x, y, 1.2, '#8a9a3a'); }
  return s;
}
export const SCENES = [['island', island], ['rocket', rocket], ['balloon', balloon], ['lighthouse', lighthouse], ['undersea', undersea], ['cabin', cabin], ['castle', castle], ['desert', desert]];
const seedOf = seed => (Number.isFinite(Number(seed)) ? Math.abs(Math.floor(Number(seed))) : 0);
export const jigSceneName = seed => SCENES[seedOf(seed) % SCENES.length][0];
// The whole picture's markup (the inside of an <svg viewBox="-30 -30 360 360">): the scene of this seed, mirrored for
// half the seeds. Pure: the same seed gives the same markup everywhere. Numbers and the palettes above only: nothing
// from outside reaches the markup.
const memo = new Map();
export function jigPicture(seed) {
  const sd = seedOf(seed);
  if (memo.has(sd)) return memo.get(sd);
  const rng = makeRng('jig-pic:' + sd), flip = rng() < 0.5, body = SCENES[sd % SCENES.length][1](rng);
  const out = `<g stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"${flip ? ' transform="translate(300 0) scale(-1 1)"' : ''}>${body}</g>`;
  if (memo.size > 24) memo.clear();
  memo.set(sd, out);
  return out;
}

// ---------- the cut ----------
// Every side of every piece, the sheet's outer sides too: which way its knob points (1: down for a side that runs
// across, right for one that runs down) and its little irregularities, from the seed. H[r][c]: the side across the top
// of row r under column c (r 0..n); V[r][c]: the side down the left of column c beside row r (c 0..n).
export function jigCut(seed, n) {
  const rng = makeRng(`jig-cut:${seedOf(seed)}:${n}`), side = () => ({ d: rng() < 0.5 ? 1 : -1, a: span(rng, -0.03, 0.03), b: span(rng, -0.05, 0.05), c: span(rng, -0.02, 0.02), e: span(rng, -0.03, 0.03) });
  const H = Array.from({ length: n + 1 }, () => Array.from({ length: n }, side)), V = Array.from({ length: n }, () => Array.from({ length: n + 1 }, side));
  return { n, H, V };
}
// One side's ten points (the classic knob: a shoulder, a neck, a round head), from (x0, y0) along (ux, uy) for a
// length s, the knob standing out along (vx, vy).
function sidePts(e, s, x0, y0, ux, uy, vx, vy) {
  const t = PIC.knob, f = e.d, pt = (l, w) => [x0 + ux * l * s + vx * w * s * f, y0 + uy * l * s + vy * w * s * f];
  return [pt(0, 0), pt(0.2, e.a), pt(0.5 + e.b + t, -t + e.c), pt(0.5 - t + e.b, t + e.c), pt(0.5 - 2 * t + e.b - 0.02, 3 * t + e.c), pt(0.5 + 2 * t + e.b + 0.02, 3 * t + e.c), pt(0.5 + t + e.b, t + e.c), pt(0.5 + e.b - t, -t + e.c), pt(0.8, e.e), pt(1, 0)];
}
const fwd = p => `C${at(...p[1])} ${at(...p[2])} ${at(...p[3])}C${at(...p[4])} ${at(...p[5])} ${at(...p[6])}C${at(...p[7])} ${at(...p[8])} ${at(...p[9])}`;
const back = p => `C${at(...p[8])} ${at(...p[7])} ${at(...p[6])}C${at(...p[5])} ${at(...p[4])} ${at(...p[3])}C${at(...p[2])} ${at(...p[1])} ${at(...p[0])}`;
// A piece's outline on the sheet (a closed path): its top side left to right, its right side downwards, its bottom
// side right to left, its left side upwards. Two neighbours share a side point for point, so they meet exactly.
const paths = new Map();
export function jigPiecePath(seed, n, i) {
  const key = `${seedOf(seed)}:${n}`;
  let all = paths.get(key);
  if (!all) {
    const cut = jigCut(seed, n), s = PIC.size / n;
    all = Array.from({ length: n * n }, (_, k) => {
      const r = Math.floor(k / n), c = k % n, x = c * s, y = r * s;
      const top = sidePts(cut.H[r][c], s, x, y, 1, 0, 0, 1), bot = sidePts(cut.H[r + 1][c], s, x, y + s, 1, 0, 0, 1), left = sidePts(cut.V[r][c], s, x, y, 0, 1, 1, 0), right = sidePts(cut.V[r][c + 1], s, x + s, y, 0, 1, 1, 0);
      return `M${at(x, y)}${fwd(top)}${fwd(right)}${back(bot)}${back(left)}Z`;
    });
    if (paths.size > 12) paths.clear();
    paths.set(key, all);
  }
  return all[i] || '';
}
// A piece's box on the sheet with room for its knobs: [x, y, width, height] (a square, the same for every piece of a grid).
export function jigPieceBox(n, i) { const s = PIC.size / n, m = s * 0.26; return [(i % n) * s - m, Math.floor(i / n) * s - m, s + 2 * m, s + 2 * m]; }

// ---------- the edge marks (the `edges` setting) ----------
// A piece on the picture's outer border carries a bold stripe along each of its sides that lie on the border (inside
// its outline, following the side's knob or socket, an ink line on its inner edge) and a little pennant flag in one of
// its corners. Drawn in the piece's own place on the sheet, so they turn with it. `sides`: the piece's border sides,
// 't', 'r', 'b', 'l' (rules.js jigBorder). The flag's corner: the picture's own corner where the piece has one, else one
// beside its border side, never the top left (where a placed piece carries its layer's mark): the top right, then the
// bottom right, then the bottom left. A corner's square a third of the side across is the piece's own whatever its cut
// (a knob or socket stays within the middle third of its side), so the flag never runs over a neighbour's knob.
export const EDGE = { band: 0.18, ink: 0.035 };                    // the stripe's width (centred on the outline: half of it shows), its inner ink line (shares of a piece's side)
export function jigFlagCorner(sides) {
  const has = k => (sides.includes(k) ? 1 : 0), score = { tr: has('t') + has('r'), br: has('b') + has('r'), bl: has('b') + has('l') };
  return ['tr', 'br', 'bl'].reduce((a, k) => (score[k] > score[a] ? k : a), 'tr');
}
const FLAG = { tr: [0.88, 0.04, -1], br: [0.88, 0.68, -1], bl: [0.12, 0.68, 1] };   // the pole's top (shares of the piece's side, from its top left) and the way the pennant flies (inwards): pole 0.28 long, pennant 0.2 by 0.17, inside the corner's square
const edgeMemo = new Map();
export function jigEdgeArt(seed, n, i, sides) {
  if (!sides || !sides.length) return null;
  const key = `${seedOf(seed)}:${n}:${i}:${sides.join('')}`;
  if (edgeMemo.has(key)) return edgeMemo.get(key);
  const cut = jigCut(seed, n), s = PIC.size / n, r = Math.floor(i / n), c = i % n, x = c * s, y = r * s;
  const side = { t: () => sidePts(cut.H[r][c], s, x, y, 1, 0, 0, 1), r: () => sidePts(cut.V[r][c + 1], s, x + s, y, 0, 1, 1, 0), b: () => sidePts(cut.H[r + 1][c], s, x, y + s, 1, 0, 0, 1), l: () => sidePts(cut.V[r][c], s, x, y, 0, 1, 1, 0) };
  const d = sides.filter(k => side[k]).map(k => { const p = side[k](); return `M${at(...p[0])}${fwd(p)}`; }).join('');
  const band = `<path class="jgek" d="${d}" stroke-width="${r1(s * (EDGE.band + 2 * EDGE.ink))}"/><path class="jgeg" d="${d}" stroke-width="${r1(s * EDGE.band)}"/>`;
  const [px, py, dx] = FLAG[jigFlagCorner(sides)], P = (u, v) => at(x + u * s, y + v * s);
  const pole = `M${P(px, py)}L${P(px, py + 0.28)}`, pen = `M${P(px, py)}L${P(px + dx * 0.2, py + 0.085)}L${P(px, py + 0.17)}Z`;
  const flag = `<g class="jgflag"><path class="jgfh" d="${pole}${pen}"/><path class="jgfp" d="${pole}"/><path class="jgfn" d="${pen}"/><path class="jgfs" d="M${P(px + dx * 0.04, py + 0.045)}L${P(px + dx * 0.12, py + 0.078)}"/></g>`;
  if (edgeMemo.size > 200) edgeMemo.clear();
  edgeMemo.set(key, { band, flag });
  return edgeMemo.get(key);
}
