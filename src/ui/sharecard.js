// The growth loop's result card: a match's result as a square picture (1080 x 1080: the board is square, and a square
// fills a chat bubble, a feed or a story without cropping; 1200 x 630 is the link preview's shape, not a picture's) with
// the final board, both names, the result, the site's address and, in a friend room where a rematch is still possible,
// the room's code. The win screen's Share result makes it on a canvas and hands it to the share sheet as a PNG
// (net/platform.js shareFile); where there is none it is saved and its text copied. The text and the layout are worked
// out apart from the canvas (cardData, fitSize, toonSvg: tests/ui/sharecard.test.mjs); paintCard alone draws.
import { playerName } from '../core/match.js';
import { other } from '../core/util.js';
import { copyText, downloadFile, shareFile, siteUrl } from '../net/platform.js';
import { lobby } from '../net/room.js';
import { esc, state } from './app.js';
import { toonG } from './art.js';
import { render } from './render.js';

export const CARD = 1080;                          // the picture's side, in pixels
export const CARD_FILE = 'tic-tac-chaos-result.png';
const LG = "'Luckiest Guy', 'Arial Black', sans-serif", PH = "'Patrick Hand', 'Comic Sans MS', cursive";

// ----- what the card says (pure) -----
// The side this phone played: ours online, the person's against the computer, none on a shared phone.
export function perspective(st) {
  if (st.online) return st.online.me === 'X' || st.online.me === 'O' ? st.online.me : null;
  if (st.cpu && st.cpu.length === 1) return other(st.cpu);
  return null;
}
// The room's code goes on the card only while a rematch is still possible there: a friend room's match, its room
// still open (not closed by a forfeit) and nobody gone.
export function rematchCode(st, lob) {
  const o = st.online;
  if (!o || !o.room || !lob || lob.status === 'over' || lob.left) return null;
  return o.room;
}
const isCpu = (st, p) => !st.online && !!st.cpu && st.cpu.includes(p);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
// Everything the card and its text need, from the finished match. opts: lobby (the room's node; the live one by default),
// code (set outright), site (the address; siteUrl() by default).
export function cardData(st, opts = {}) {
  const w = st.winner, me = perspective(st), won = w === 'X' || w === 'O';
  const names = { X: playerName(st, 'X'), O: playerName(st, 'O') };
  const said = p => (isCpu(st, p) ? 'the computer' : names[p]);               // in a sentence, the computer is "the computer"
  const counts = { X: (st.counts && st.counts.X) || 0, O: (st.counts && st.counts.O) || 0 };
  const code = opts.code !== undefined ? opts.code : rematchCode(st, opts.lobby === undefined ? lobby : opts.lobby);
  const site = opts.site || siteUrl();
  const link = code ? `${site}?room=${code}` : site;
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
    outcome, winner: won ? w : null, me, names, counts, code, site, link, host, title, text,
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
  logoY: 116, logoSize: 84,
  titleY: 230, titleSize: 66, titleW: 980,
  board: { top: 300, cell: 174, gap: 14 },     // 174 * 3 + 14 * 2 = 550 wide, centred
  namesY: 898, nameSize: 44, nameW: 330, toon: 66,
  codeY: 962, codeSize: 40,
  tagY: 1016, tagH: 66, tagSize: 38,
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
// The whole card on a 2d context (CARD x CARD): d from cardData, pal from palette, imgs the two characters' Images (or null).
export function paintCard(ctx, d, pal, imgs) {
  const L = LAYOUT, W = CARD, cx = W / 2;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, W, W);
  // the rays behind everything, as on the share image
  ctx.save(); ctx.translate(cx, L.board.top + 275); ctx.fillStyle = pal.o; ctx.globalAlpha = 0.16;
  for (let k = 0; k < 24; k++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 1200, k * Math.PI / 12, k * Math.PI / 12 + Math.PI / 24); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  // TIC TAC CHAOS
  outlined(ctx, 'TIC TAC CHAOS', cx, L.logoY, L.logoSize, pal.o, pal, 14, [4, 6]);
  // the result
  const tSize = fitSize(measurer(ctx, LG), d.title, L.titleW, L.titleSize, 30);
  ctx.font = font(LG, tSize); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = pal.ink;
  ctx.fillText(d.title, cx, L.titleY);
  // the board
  const { cell, gap, top } = L.board, size = cell * 3 + gap * 2, left = (W - size) / 2;
  const R1 = [22, 15, 24, 17], R2 = [15, 24, 17, 22];
  for (let i = 0; i < 9; i++) {
    const r = Math.floor(i / 3), c = i % 3, x = left + c * (cell + gap), y = top + r * (cell + gap), own = d.owners[i];
    box(ctx, x, y, cell, cell, i % 2 ? R2 : R1, own === 'X' ? pal.xs : own === 'O' ? pal.os : pal.paper, pal);
    if (own) mark(ctx, own, imgs && imgs[own], x + cell * 0.1, y + cell * 0.1, cell * 0.8, pal);
    if (own && d.winLine.includes(i)) { ctx.lineWidth = 8; ctx.strokeStyle = own === 'X' ? pal.x : pal.o; rrect(ctx, x + 9, y + 9, cell - 18, cell - 18, (i % 2 ? R2 : R1).map(v => v - 6)); ctx.stroke(); }
  }
  // both names, each beside their character
  const nm = measurer(ctx, LG), tn = L.toon;
  const side = (p, right) => {
    const s = fitSize(nm, d.names[p], L.nameW, L.nameSize, 26);
    ctx.font = font(LG, s); ctx.fillStyle = p === 'X' ? pal.x : pal.o; ctx.textBaseline = 'middle'; ctx.lineWidth = 8; ctx.strokeStyle = pal.ink; ctx.lineJoin = 'round';
    const wN = ctx.measureText(d.names[p]).width, x0 = right ? W - 120 - tn - 14 - wN : 120 + tn + 14;
    ctx.textAlign = 'left'; ctx.strokeText(d.names[p], x0, L.namesY); ctx.fillText(d.names[p], x0, L.namesY);
    mark(ctx, p, imgs && imgs[p], right ? W - 120 - tn : 120, L.namesY - tn / 2, tn, pal);
  };
  side('X', false); side('O', true);
  ctx.font = font(PH, 40); ctx.fillStyle = pal.muted; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('vs', cx, L.namesY);
  // the rematch code, when there is one
  if (d.code) {
    ctx.textBaseline = 'alphabetic';
    const lead = 'Rematch code: ';
    ctx.font = font(PH, L.codeSize); const w1 = ctx.measureText(lead).width;
    ctx.font = font(LG, L.codeSize); const w2 = ctx.measureText(d.code).width;
    const x0 = cx - (w1 + w2) / 2;
    ctx.textAlign = 'left'; ctx.font = font(PH, L.codeSize); ctx.fillStyle = pal.ink; ctx.fillText(lead, x0, L.codeY);
    ctx.font = font(LG, L.codeSize); ctx.fillStyle = pal.x; ctx.lineWidth = 6; ctx.strokeStyle = pal.ink; ctx.strokeText(d.code, x0 + w1, L.codeY); ctx.fillText(d.code, x0 + w1, L.codeY);
  }
  // the site's address, in a tag
  ctx.font = font(PH, L.tagSize); const tw = ctx.measureText(d.host).width + 72;
  box(ctx, cx - tw / 2, L.tagY - L.tagH / 2, tw, L.tagH, [24, 18, 22, 16], pal.paper, pal);
  ctx.fillStyle = pal.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(d.host, cx, L.tagY + 2);
}
const wait = ms => new Promise(res => setTimeout(res, ms));
// The two fonts (embedded data: fonts, fonts.css: loaded the first time they are asked for), within a short wait.
function fontsReady() {
  try {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([document.fonts.load(`${LAYOUT.logoSize}px 'Luckiest Guy'`), document.fonts.load(`${LAYOUT.tagSize}px 'Patrick Hand'`)]).catch(() => {});
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
// The button and its note line (always there, so nothing moves), under the win screen's buttons.
export function shareBtn() {
  return `<div class="sharerow"><button class="btn share" data-act="share-result"${shareBusy ? ' disabled' : ''}>Share result</button><div class="shline" role="status">${esc(shareNote)}</div></div>`;
}
export function resetShare() { cache = null; setNote(''); }
