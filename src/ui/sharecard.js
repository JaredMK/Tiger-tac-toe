// The growth loop's result card (Comic Chaos, December 2026: an ink-outlined comic panel, the headline on a burst, the # board with comic claim bursts, X red and O yellow, Bangers and Comic Neue): a match's result as a square picture (1080 x 1080: the board is square, and a square
// fills a chat bubble, a feed or a story without cropping; 1200 x 630 is the link preview's shape, not a picture's) with
// the final board, both names, the result and the site's address (no rematch code: November 2026). The win screen's Share result makes it on a canvas and hands it to the share sheet as a PNG
// (net/platform.js shareFile); where there is none it is saved and its text copied. The text and the layout are worked
// out apart from the canvas (cardData, fitSize, toonSvg: tests/ui/sharecard.test.mjs); paintCard alone draws.
import { hashPath } from './hash.js';
import { playerName } from '../core/match.js';
import { other } from '../core/util.js';
import { copyText, downloadFile, shareFile, siteUrl } from '../net/platform.js';
import { esc, state } from './app.js';
import { toonG } from './art.js';
import { CICON, smallPanel } from './comic.js';
import { render } from './render.js';

export const CARD = 1080;                          // the picture's side, in pixels
export const CARD_FILE = 'tic-tac-chaos-result.png';
const LG = "'Bangers', 'Luckiest Guy', 'Arial Black', sans-serif", PH = "'Comic Neue', 'Comic Sans MS', cursive";   // (Comic Chaos: Bangers for the headline, Comic Neue for small text)

// ----- what the card says (pure) -----
// The side this phone played: ours online, the person's against the computer, none on a shared phone.
export function perspective(st) {
  if (st.online) return st.online.me === 'X' || st.online.me === 'O' ? st.online.me : null;
  if (st.cpu && st.cpu.length === 1) return other(st.cpu);
  return null;
}
const isCpu = (st, p) => !st.online && !!st.cpu && st.cpu.includes(p);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
// Everything the card and its text need, from the finished match. opts: site (the address; siteUrl() by default).
export function cardData(st, opts = {}) {
  const w = st.winner, me = perspective(st), won = w === 'X' || w === 'O';
  const names = { X: playerName(st, 'X'), O: playerName(st, 'O') };
  const said = p => (isCpu(st, p) ? 'the computer' : names[p]);               // in a sentence, the computer is "the computer"
  const counts = { X: (st.counts && st.counts.X) || 0, O: (st.counts && st.counts.O) || 0 };
  const site = opts.site || siteUrl(), link = site;   // (no rematch code on the card or in its link: November 2026)
  const outcome = !won ? 'draw' : me == null ? 'named' : w === me ? 'win' : 'loss';
  let title, text;
  if (!won) {
    title = "It's a draw!";
    text = me ? `I just drew with ${said(other(me))} at Tic Tac Chaos! Play me: ${link}` : `${said('X')} and ${said('O')} just drew at Tic Tac Chaos! Play it: ${link}`;
  } else {
    const l = other(w);
    title = `${said(w)} beat ${said(l)}`;
    text = outcome === 'win' ? `I just beat ${said(l)} at Tic Tac Chaos! Play me: ${link}`
      : outcome === 'loss' ? `${said(w)} just beat me at Tic Tac Chaos! Play me: ${link}`
      : `${said(w)} just beat ${said(l)} at Tic Tac Chaos! Play it: ${link}`;
  }
  title = cap(title); text = cap(text);                                      // ("the computer" at the start of a sentence)
  let host = 'tictacchaos.com';
  try { host = new URL(site).host || host; } catch (e) { /* (the default) */ }
  return {
    outcome, winner: won ? w : null, me, names, counts, site, link, host, title, text,
    owners: (st.squares || []).map(s => (s && (s.owner === 'X' || s.owner === 'O') ? s.owner : null)),
    winLine: Array.isArray(st.winLine) ? st.winLine.slice() : [],
  };
}
// A type size that fits a width: shrunk in steps of 2, never below min. measure(text, size) gives the width at a size.
export function fitSize(measure, text, maxW, size, min = 22) {
  while (size > min && measure(text, size) > maxW) size -= 2;
  return size;
}
// The X or O character as a self-contained SVG (art.js toonG, its classes styled inline from the palette): drawn on the
// canvas through an Image from a data: URL.
export function toonSvg(p, pal) {
  const w = p === 'X' ? 26 : 25, col = p === 'X' ? pal.x : pal.o;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="400" height="400"><style>.ol{stroke:${pal.ink};fill:none;stroke-linecap:round;stroke-width:${w}}.fl{stroke:${col};fill:none;stroke-linecap:round;stroke-width:15}.eye{fill:#fff;stroke:${pal.ink};stroke-width:3}.pup{fill:${pal.ink}}.mouth{fill:none;stroke:${pal.ink};stroke-width:3.5;stroke-linecap:round}</style>${toonG(p)}</svg>`;
}
export const toonUrl = (p, pal) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(toonSvg(p, pal));
// The colours, from the page's style tokens (styles.css :root), with the same values as fallbacks.
const FALLBACK = { bg: '#f4e6c8', paper: '#fff8e8', panel2: '#efe0bf', ink: '#161210', muted: '#6b5a45', x: '#e5432a', o: '#f6c21b', xs: '#f9c7b6', os: '#fbe39a', green: '#4e9d3a' };
const TOKEN = { bg: '--bg', paper: '--paper', panel2: '--panel-2', ink: '--ink', muted: '--muted', x: '--x', o: '--o', xs: '--x-soft', os: '--o-soft', green: '--green' };
export function palette() {
  const pal = Object.assign({}, FALLBACK);
  try {
    const cs = getComputedStyle(document.documentElement);
    for (const k in TOKEN) { const v = cs.getPropertyValue(TOKEN[k]).trim(); if (v) pal[k] = v; }
  } catch (e) { /* (the fallbacks) */ }
  return pal;
}

// ----- the layout (one square: every box in card pixels) -----
export const LAYOUT = {
  frame: { inset: 22, line: 10 },                 // the comic panel's ink outline
  logoY: 112, logoSize: 84,
  burst: { y: 150, h: 190, w: 900 }, titleY: 262, titleSize: 76, titleW: 640,
  board: { top: 372, cell: 156, gap: 12 },        // 156 * 3 + 12 * 2 = 492 wide, in a white panel, centred
  namesY: 942, nameSize: 46, nameW: 330, toon: 66,
  tagY: 1008, tagH: 58, tagSize: 36,
};

// ----- the drawing (the browser only) -----
// A box with hand-drawn corners: radii, one per corner, like the squares' border-radius.
function rrect(ctx, x, y, w, h, r) {
  const [a, b, c, d] = r;
  ctx.beginPath();
  ctx.moveTo(x + a, y);
  ctx.lineTo(x + w - b, y); ctx.quadraticCurveTo(x + w, y, x + w, y + b);
  ctx.lineTo(x + w, y + h - c); ctx.quadraticCurveTo(x + w, y + h, x + w - c, y + h);
  ctx.lineTo(x + d, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - d);
  ctx.lineTo(x, y + a); ctx.quadraticCurveTo(x, y, x + a, y);
  ctx.closePath();
}
// A chunky box: an ink drop shadow under it, its fill, its ink outline.
function box(ctx, x, y, w, h, r, fill, pal, drop = 6) {
  ctx.fillStyle = pal.ink; rrect(ctx, x, y + drop, w, h, r); ctx.fill();
  ctx.fillStyle = fill; rrect(ctx, x, y, w, h, r); ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = pal.ink; ctx.lineJoin = 'round'; ctx.stroke();
}
const font = (fam, size) => `${size}px ${fam}`;
const measurer = (ctx, fam) => (text, size) => { ctx.font = font(fam, size); return ctx.measureText(text).width; };
// Display type with the ink outline (the title's text-shadow, drawn: the shadow, the outline, the fill).
function outlined(ctx, text, x, y, size, fill, pal, width, drop) {
  ctx.font = font(LG, size); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round'; ctx.lineWidth = width; ctx.strokeStyle = pal.ink;
  if (drop) { ctx.fillStyle = pal.ink; ctx.fillText(text, x + drop[0], y + drop[1]); ctx.strokeText(text, x + drop[0], y + drop[1]); }
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill; ctx.fillText(text, x, y);
}
// The character in a square: its picture, or (no picture) the same mark in the same colours, without the face.
function mark(ctx, p, img, x, y, s, pal) {
  if (img) { try { ctx.drawImage(img, x, y, s, s); return; } catch (e) { /* (drawn below) */ } }
  const u = s / 100, col = p === 'X' ? pal.x : pal.o;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const pass = (w, c) => {
    ctx.lineWidth = w * u; ctx.strokeStyle = c; ctx.beginPath();
    if (p === 'X') { ctx.moveTo(x + 22 * u, y + 20 * u); ctx.lineTo(x + 78 * u, y + 80 * u); ctx.moveTo(x + 78 * u, y + 20 * u); ctx.lineTo(x + 22 * u, y + 80 * u); }
    else ctx.arc(x + 50 * u, y + 50 * u, 32 * u, 0, Math.PI * 2);
    ctx.stroke();
  };
  pass(p === 'X' ? 26 : 25, pal.ink); pass(15, col);
}
// A colour at no opacity (a glow fades to its own colour, never through grey): '#rgb', '#rrggbb' or 'rgb(...)'.
export function clear(col) {
  const c = String(col).trim();
  if (c[0] === '#') { const h = c.length === 4 ? c.slice(1).split('').map(x => x + x).join('') : c.slice(1, 7); return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},0)`; }
  const m = c.match(/rgba?\(([^)]+)\)/); if (m) { const v = m[1].split(/[ ,/]+/).filter(Boolean).slice(0, 3); return `rgba(${v.join(',')},0)`; }
  return 'rgba(255,255,255,0)';
}
// A comic burst (spikes) about (x, y): the same 12-point shape as the page's (fx.js burstSvg), pseudo-random by seed.
function burstPath(ctx, x, y, rx, ry, seed) {
  let sd = seed * 7919 + 13; const r = () => { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; };
  const n = 12; ctx.beginPath();
  for (let k = 0; k < n * 2; k++) {
    const a = k * Math.PI / n - Math.PI / 2, f = k % 2 === 0 ? 0.88 + r() * 0.12 : 0.62 + r() * 0.08;
    const px = x + Math.cos(a) * rx * f, py = y + Math.sin(a) * ry * f;
    if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
}
// A light halftone fading out from a corner (decoration: dots, never a pattern a tap could mean).
function halftone(ctx, x0, y0, dx, dy, pal) {
  ctx.save(); ctx.fillStyle = pal.ink; ctx.globalAlpha = 0.13;
  for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
    const fade = 1 - (i + j) / 22; if (fade <= 0) continue;
    ctx.beginPath(); ctx.arc(x0 + dx * i * 16, y0 + dy * j * 16, 6.5 * fade, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
// The whole card on a 2d context (CARD x CARD): d from cardData, pal from palette, imgs the two characters' Images (or null).
// Comic Chaos: a panel with a thick ink outline on cream paper, a light halftone, the headline on a burst, the # board
// on a white panel with a comic burst behind each claimed square, both names with their characters, the logo and the link.
export function paintCard(ctx, d, pal, imgs) {
  const L = LAYOUT, W = CARD, cx = W / 2;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = pal.ink; ctx.fillRect(0, 0, W, W);                          // (the page the panel sits on)
  const f = L.frame.inset, fw = W - 2 * f;
  ctx.fillStyle = pal.bg; ctx.fillRect(f, f, fw, fw);
  ctx.save(); ctx.beginPath(); ctx.rect(f, f, fw, fw); ctx.clip();
  halftone(ctx, f + 6, f + 6, 1, 1, pal); halftone(ctx, W - f - 6, W - f - 6, -1, -1, pal);
  ctx.restore();
  ctx.lineWidth = L.frame.line; ctx.strokeStyle = pal.ink; ctx.lineJoin = 'miter'; ctx.strokeRect(f, f, fw, fw);
  // TIC TAC CHAOS
  outlined(ctx, 'TIC TAC CHAOS', cx, L.logoY, L.logoSize, pal.o, pal, 14, [4, 6]);
  // the headline on a burst: the winner's colour (a draw: white)
  const b = L.burst, bc = d.winner === 'X' ? pal.x : d.winner === 'O' ? pal.o : '#ffffff', by = b.y + b.h / 2;
  ctx.save(); ctx.lineJoin = 'round';
  ctx.fillStyle = pal.ink; burstPath(ctx, cx + 8, by + 10, b.w / 2, b.h / 2, 3); ctx.fill();
  ctx.fillStyle = bc; burstPath(ctx, cx, by, b.w / 2, b.h / 2, 3); ctx.fill(); ctx.lineWidth = 7; ctx.strokeStyle = pal.ink; ctx.stroke();
  ctx.restore();
  const tSize = fitSize(measurer(ctx, LG), d.title, L.titleW, L.titleSize, 34);
  outlined(ctx, d.title.toUpperCase(), cx, L.titleY, tSize, '#ffffff', pal, 12, [3, 5]);
  // the board: a white comic panel, each claimed square a small burst in its colour under its character, the winning
  // line's bursts in the full colour; the # (ui/hash.js, as on the page) over them
  const { cell, gap, top } = L.board, size = cell * 3 + gap * 2, left = (W - size) / 2, sp = size / 3;
  box(ctx, left - 28, top - 26, size + 56, size + 52, [6, 6, 6, 6], '#ffffff', pal, 8);
  for (let i = 0; i < 9; i++) {
    const own = d.owners[i]; if (!own) continue;
    const r = Math.floor(i / 3), c = i % 3, mx = left + c * sp + sp / 2, my = top + r * sp + sp / 2, win = d.winLine.includes(i);
    ctx.save(); ctx.lineJoin = 'round';
    ctx.fillStyle = win ? (own === 'X' ? pal.x : pal.o) : (own === 'X' ? pal.xs : pal.os);
    burstPath(ctx, mx, my, sp * 0.5, sp * 0.5, i + 1); ctx.fill(); ctx.lineWidth = win ? 5 : 3; ctx.strokeStyle = pal.ink; ctx.stroke();
    ctx.restore();
  }
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = pal.ink; ctx.lineWidth = 14;
  hashPath(ctx, left, top, size); ctx.stroke(); ctx.restore();
  for (let i = 0; i < 9; i++) {
    const own = d.owners[i]; if (!own) continue;
    const r = Math.floor(i / 3), c = i % 3, x = left + c * sp, y = top + r * sp;
    mark(ctx, own, imgs && imgs[own], x + sp * 0.17, y + sp * 0.17, sp * 0.66, pal);
  }
  // both names, each beside their character
  const nm = measurer(ctx, LG), tn = L.toon;
  const side = (p, right) => {
    const s = fitSize(nm, d.names[p], L.nameW, L.nameSize, 26);
    ctx.font = font(LG, s); ctx.fillStyle = p === 'X' ? pal.x : pal.o; ctx.textBaseline = 'middle'; ctx.lineWidth = 8; ctx.strokeStyle = pal.ink; ctx.lineJoin = 'round';
    const wN = ctx.measureText(d.names[p]).width, x0 = right ? W - 100 - tn - 14 - wN : 100 + tn + 14;
    ctx.textAlign = 'left'; ctx.strokeText(d.names[p], x0, L.namesY); ctx.fillText(d.names[p], x0, L.namesY);
    mark(ctx, p, imgs && imgs[p], right ? W - 100 - tn : 100, L.namesY - tn / 2, tn, pal);
  };
  side('X', false); side('O', true);
  ctx.font = `bold ${40}px ${PH}`; ctx.fillStyle = pal.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('VS', cx, L.namesY);
  // the site's address, in a tag
  ctx.font = `bold ${L.tagSize}px ${PH}`; const tw = ctx.measureText(d.host).width + 72;
  box(ctx, cx - tw / 2, L.tagY - L.tagH / 2, tw, L.tagH, [4, 4, 4, 4], pal.o, pal, 6);
  ctx.fillStyle = pal.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(d.host, cx, L.tagY + 2);
}
const wait = ms => new Promise(res => setTimeout(res, ms));
// The two fonts (embedded data: fonts, fonts.css: loaded the first time they are asked for), within a short wait.
function fontsReady() {
  try {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([document.fonts.load(`${LAYOUT.logoSize}px 'Bangers'`), document.fonts.load(`bold ${LAYOUT.tagSize}px 'Comic Neue'`)]).catch(() => {});
  } catch (e) { return Promise.resolve(); }
}
function toonImage(p, pal) {
  return new Promise(res => {
    try {
      const img = new Image();
      img.onload = () => res(img); img.onerror = () => res(null);
      img.src = toonUrl(p, pal);
    } catch (e) { res(null); }
  });
}
// The card as a canvas. opts.waitMs caps the wait for the fonts and the pictures (the card is drawn without them after it).
export async function renderCard(d, opts = {}) {
  const pal = palette(), cap = opts.waitMs == null ? 2000 : opts.waitMs;
  const cv = document.createElement('canvas'); cv.width = CARD; cv.height = CARD;
  const ctx = cv.getContext('2d');
  const imgs = {};
  await Promise.race([Promise.all([fontsReady(), toonImage('X', pal).then(i => { imgs.X = i; }), toonImage('O', pal).then(i => { imgs.O = i; })]), wait(cap)]);
  paintCard(ctx, d, pal, imgs);
  return cv;
}
const toBlob = cv => new Promise(res => { try { cv.toBlob(b => res(b || null), 'image/png'); } catch (e) { res(null); } });

// ----- the win screen's Share result -----
export let shareNote = '';                         // the line under the button: what happened when there was no share sheet
let shareBusy = false, noteTimer = null, cache = null;   // cache: the last card made for this result { key, blob, text }
function setNote(text, ms) {
  shareNote = text; clearTimeout(noteTimer); noteTimer = null;
  if (text && ms) noteTimer = setTimeout(() => { shareNote = ''; render(); }, ms);
}
const cancelled = e => !!e && (e.name === 'AbortError' || /cancel/i.test(String(e.message || '')));
export async function shareResult() {
  if (shareBusy || !state.winner) return;
  shareBusy = true; setNote('Making your card…'); render();
  try {
    const d = cardData(state), key = JSON.stringify([d.owners, d.title, d.link]);
    if (!cache || cache.key !== key) {
      const blob = await toBlob(await renderCard(d));
      if (!blob) throw new Error('canvas');
      cache = { key, blob, text: d.text };
    }
    let shared = false;
    try { shared = await shareFile(cache.blob, CARD_FILE, cache.text); }
    catch (e) { if (cancelled(e)) { setNote(''); return; } }
    if (shared) { setNote(''); return; }
    const saved = downloadFile(cache.blob, CARD_FILE);               // no share sheet: the picture saved, its text copied
    let copied = false;
    try { await copyText(cache.text); copied = true; } catch (e) { /* (said below) */ }
    setNote(saved && copied ? 'Card saved · text copied' : saved ? 'Card saved' : copied ? 'Text copied' : "Couldn't share the card", 2500);
  } catch (e) {
    setNote("Couldn't make the card", 2500);
  } finally {
    shareBusy = false; render();
  }
}
// The Share result panel (a small one, in the results screen's row of small panels) and its note line (always
// there, under the row, so nothing moves).
export function shareBtn() {
  return smallPanel('share-result', CICON.share, 'Share', { cls: 'c', k: 9, aria: 'Share result', attrs: shareBusy ? ' disabled' : '' });
}
export function shareLine() { return `<div class="shline" role="status">${esc(shareNote)}</div>`; }
export function resetShare() { cache = null; setNote(''); }
