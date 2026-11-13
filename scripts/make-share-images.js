'use strict';
// The link-preview image (1200x630), the home-screen icon (180x180) and the favicons, drawn in the game's own
// style (its fonts, colours and X and O characters; src/ui/art.js, fx.js, styles.css) and rendered with the
// Chromium that Playwright carries. Writes assets/share/*; the site build copies them in.
//   node scripts/make-share-images.js        (npm run share-images)
const fs = require('node:fs');
const path = require('node:path');
const { hashSvg } = require('../src/ui/hash.js');   // the board's # (one drawing with the page's board)
const OUT = path.join(__dirname, '..', 'assets', 'share');
const fonts = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui', 'fonts.css'), 'utf8');
const INK = '#161210', CREAM = '#f4e6c8', PAPER = '#fff8e8', X = '#e5432a', O = '#f6c21b', SKY = '#58a8cf', GREEN = '#4e9d3a';
const eyes = (y, mx) => `<ellipse cx="${50 - mx}" cy="${y}" rx="6.5" ry="9" fill="#fff" stroke="${INK}" stroke-width="3"/><ellipse cx="${50 + mx}" cy="${y}" rx="6.5" ry="9" fill="#fff" stroke="${INK}" stroke-width="3"/><ellipse cx="${51.5 - mx}" cy="${y + 2}" rx="3.4" ry="5.6" fill="${INK}"/><ellipse cx="${51.5 + mx}" cy="${y + 2}" rx="3.4" ry="5.6" fill="${INK}"/>`;
const toonX = () => `<path d="M22 20 L78 80 M78 20 L22 80" stroke="${INK}" stroke-width="26" stroke-linecap="round" fill="none"/><path d="M22 20 L78 80 M78 20 L22 80" stroke="${X}" stroke-width="15" stroke-linecap="round" fill="none"/>${eyes(44, 8)}<path d="M42 60 Q50 67 58 60" stroke="${INK}" stroke-width="3.5" stroke-linecap="round" fill="none"/>`;
const toonO = () => `<circle cx="50" cy="50" r="32" stroke="${INK}" stroke-width="25" fill="none"/><circle cx="50" cy="50" r="32" stroke="${O}" stroke-width="15" fill="none"/>${eyes(46, 7)}<path d="M43 59 Q50 65 57 59" stroke="${INK}" stroke-width="3.5" stroke-linecap="round" fill="none"/>`;
const svg = (g, cls = '') => `<svg class="${cls}" viewBox="0 0 100 100" overflow="visible">${g}</svg>`;
const ol = (s = 4) => `stroke="${INK}" stroke-width="${s}" stroke-linejoin="round" stroke-linecap="round"`;
// A few mini-games, as small pictures in their squares.
const MINI = {
  coin: `<circle cx="50" cy="50" r="33" fill="${O}" ${ol()}/><circle cx="50" cy="50" r="22" fill="none" stroke="${INK}" stroke-width="3"/><path d="M50 36 l4.5 9.5 10.5 1.2-7.8 7.2 2.2 10.4-9.4-5.4-9.4 5.4 2.2-10.4-7.8-7.2 10.5-1.2z" fill="${X}" ${ol(2.5)}/>`,
  dice: `<rect x="20" y="20" width="60" height="60" rx="13" fill="#fff" ${ol()} transform="rotate(-9 50 50)"/><g fill="${INK}" transform="rotate(-9 50 50)"><circle cx="36" cy="36" r="6"/><circle cx="64" cy="36" r="6"/><circle cx="50" cy="50" r="6"/><circle cx="36" cy="64" r="6"/><circle cx="64" cy="64" r="6"/></g>`,
  wheel: `<g ${ol(3.5)}><circle cx="50" cy="50" r="36" fill="${SKY}"/><path d="M50 50 L50 14 A36 36 0 0 1 81.2 32Z" fill="${X}"/><path d="M50 50 L81.2 68 A36 36 0 0 1 50 86Z" fill="${X}"/><path d="M50 50 L18.8 68 A36 36 0 0 1 18.8 32Z" fill="${O}"/><circle cx="50" cy="50" r="7" fill="#fff"/></g><path d="M50 4 L58 20 L42 20Z" fill="${INK}"/>`,
  golf: `<rect x="12" y="14" width="76" height="72" rx="16" fill="${GREEN}" ${ol()}/><ellipse cx="62" cy="62" rx="9" ry="6" fill="${INK}"/><path d="M62 62 V26" ${ol(3.5)} fill="none"/><path d="M62 26 l17 7-17 7z" fill="${X}" ${ol(3)}/><circle cx="30" cy="72" r="7.5" fill="#fff" ${ol(3.5)}/><path d="M36 66 Q48 50 56 60" stroke="#fff" stroke-width="3" stroke-dasharray="1 7" stroke-linecap="round" fill="none"/>`,
  pins: `<g fill="#fff" ${ol(3.5)}><path d="M50 14c7 0 8 9 5 17 6 8 9 20 0 30H45c-9-10-6-22 0-30-3-8-2-17 5-17z" transform="translate(-24 14) scale(.8)"/><path d="M50 14c7 0 8 9 5 17 6 8 9 20 0 30H45c-9-10-6-22 0-30-3-8-2-17 5-17z" transform="translate(12 14) scale(.8)"/><path d="M50 14c7 0 8 9 5 17 6 8 9 20 0 30H45c-9-10-6-22 0-30-3-8-2-17 5-17z" transform="translate(-6 -2) scale(.8)"/></g><circle cx="50" cy="82" r="11" fill="${SKY}" ${ol(3.5)}/>`,
  cards: `<rect x="14" y="22" width="44" height="60" rx="8" fill="#fff" ${ol(3.5)} transform="rotate(-14 36 52)"/><rect x="40" y="20" width="44" height="60" rx="8" fill="#fff" ${ol(3.5)} transform="rotate(10 62 50)"/><path d="M62 38 c-8-10-17 1-9 8l9 9 9-9c8-7-1-18-9-8z" fill="${X}" ${ol(2.5)}/>`,
};
const square = (k, claim) => `<div class="sq${claim ? ' own ' + claim : ''}">${claim ? svg(claim === 'X' ? toonX() : toonO(), 'big') + svg(MINI[k], 'ghost') : svg(MINI[k])}</div>`;
const cells = [square('coin'), square('dice', 'X'), square('golf'), square('cards', 'O'), square('pins'), square('golf', 'X'), square('dice'), square('wheel'), square('wheel', 'O')].join('');
function burst(word, w, h, size) {
  let seed = word.length * 31 + w; const r = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const n = 12, pts = [];
  for (let k = 0; k < n * 2; k++) { const a = k * Math.PI / n - Math.PI / 2, f = k % 2 === 0 ? 0.88 + r() * 0.12 : 0.62 + r() * 0.08; pts.push(`${(w / 2 + Math.cos(a) * (w / 2 - 3) * f).toFixed(1)},${(h / 2 + Math.sin(a) * (h / 2 - 3) * f).toFixed(1)}`); }
  return `<svg viewBox="0 0 ${w} ${h}"><polygon points="${pts.join(' ')}" fill="${X}" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/><text x="${w / 2}" y="${(h / 2 + size * .36).toFixed(1)}" font-size="${size}" text-anchor="middle" class="bt">${word}</text></svg>`;
}
const ol2 = `3px 0 0 ${INK}, -3px 0 0 ${INK}, 0 3px 0 ${INK}, 0 -3px 0 ${INK}, 2px 2px 0 ${INK}, -2px -2px 0 ${INK}, 2px -2px 0 ${INK}, -2px 2px 0 ${INK}`;
const CSS = `${fonts}
*{box-sizing:border-box;margin:0} html,body{width:1200px;height:630px;overflow:hidden}
body{background:${CREAM};position:relative;font-family:'Patrick Hand',cursive;color:${INK}}
.rays{position:absolute;inset:0;background:repeating-conic-gradient(from 0deg at 50% 52%, rgba(246,194,27,.20) 0 7.5deg, transparent 7.5deg 15deg)}
.vig{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 55%, transparent 55%, rgba(22,18,16,.16))}
.title{position:absolute;left:0;right:0;top:6px;display:flex;justify-content:center;align-items:center;gap:6px;height:130px}
.tt{font-family:'Luckiest Guy',sans-serif;font-size:108px;line-height:1;color:${O};text-shadow:${ol2},6px 9px 0 ${INK};letter-spacing:2px;transform:rotate(-2deg)}
.title .bw{width:290px;height:145px;margin-left:6px;transform:rotate(4deg)} .bw svg{width:100%;height:100%;overflow:visible} .bt{font-family:'Luckiest Guy',sans-serif;fill:${PAPER};stroke:${INK};stroke-width:5;paint-order:stroke fill;letter-spacing:2px}
.board{position:absolute;left:50%;top:142px;width:384px;height:384px;margin-left:-192px;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);gap:0}
.board>.hash{position:absolute;inset:0;width:100%;height:100%;color:${INK};overflow:visible}
.sq{aspect-ratio:1;padding:18px;position:relative}
.sq.own::before{content:'';position:absolute;inset:9%;border-radius:50%}
.sq.own.X::before{background:radial-gradient(closest-side,#f9c7b6 62%,transparent)} .sq.own.O::before{background:radial-gradient(closest-side,#fbe39a 62%,transparent)}
.sq svg{width:100%;height:100%}
.sq .ghost{position:absolute;inset:18px;width:calc(100% - 36px);height:calc(100% - 36px);opacity:.28} .sq .big{position:absolute;inset:12px;width:calc(100% - 24px);height:calc(100% - 24px);z-index:1}
.pal{position:absolute;width:200px;height:200px;top:250px}
.pal.l{left:186px;transform:rotate(-8deg)} .pal.r{right:186px;transform:rotate(8deg)}
.pal svg{width:100%;height:100%}
.tag{position:absolute;left:0;right:0;bottom:12px;text-align:center}
.tag span{display:inline-block;background:${PAPER};border:3.5px solid ${INK};box-shadow:0 5px 0 ${INK};border-radius:22px 16px 20px 14px/16px 22px 14px 20px;padding:2px 28px 4px;font-size:40px;line-height:1.15}`;
const page = (body, css) => `<!doctype html><meta charset="utf-8"><style>${css || CSS}</style>${body}`;
// The link-preview image in the Comic Chaos look (December 2026, with the share card, src/ui/sharecard.js): the loud page
// (red over yellow, rays, a light halftone) in an ink-outlined comic panel, TIC TAC in Bangers over the white CHAOS!
// burst, the # board on a white panel with a comic burst behind each claimed square, the line in Comic Neue on a yellow tag.
const cburst = (fill, seed) => { let sd = seed * 7919 + 13; const r = () => { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; }; const pts = []; for (let k = 0; k < 20; k++) { const a = k * Math.PI / 10 - Math.PI / 2, f = k % 2 === 0 ? 0.9 + r() * 0.1 : 0.64 + r() * 0.08; pts.push(`${(50 + Math.cos(a) * 49 * f).toFixed(1)},${(50 + Math.sin(a) * 49 * f).toFixed(1)}`); } return `<svg class="cb" viewBox="0 0 100 100"><polygon points="${pts.join(' ')}" fill="${fill}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/></svg>`; };
const csquare = (k, claim, i) => `<div class="sq${claim ? ' own ' + claim : ''}">${claim ? cburst(claim === 'X' ? X : O, i + 1) + svg(claim === 'X' ? toonX() : toonO(), 'big') : svg(MINI[k])}</div>`;
const ccells = [['coin'], ['dice', 'X'], ['golf'], ['cards', 'O'], ['pins'], ['golf', 'X'], ['dice'], ['wheel'], ['wheel', 'O']].map((c, i) => csquare(c[0], c[1], i)).join('');
const chaos = `<svg viewBox="0 0 300 150"><polygon points="150,12 176,27 217,19 222,40 276,39 243,63 295,75 249,88 264,107 217,108 218,133 175,121 150,146 124,123 77,137 82,108 35,108 54,88 15,75 57,63 24,39 79,40 83,18 126,31" fill="#fff" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/><text x="150" y="99" font-size="68" text-anchor="middle" class="ct">CHAOS!</text></svg>`;
const CCSS = `${fonts}
*{box-sizing:border-box;margin:0} html,body{width:1200px;height:630px;overflow:hidden}
body{background:${INK};position:relative;font-family:'Comic Neue',sans-serif;font-weight:700;color:${INK}}
.pnl{position:absolute;inset:14px;border:7px solid ${INK};overflow:hidden;background:linear-gradient(168deg, ${X} 0 46%, ${O} 46%)}
.rays{position:absolute;inset:-40%;background:repeating-conic-gradient(from 0deg at 50% 50%, rgba(255,255,255,.16) 0 7.5deg, transparent 7.5deg 15deg)}
.dots{position:absolute;inset:0;background:radial-gradient(rgba(22,18,16,.16) 22%, transparent 24%) 0 0 / 14px 14px;-webkit-mask-image:radial-gradient(ellipse at 50% 45%, transparent 38%, #000 100%);mask-image:radial-gradient(ellipse at 50% 45%, transparent 38%, #000 100%)}
.title{position:absolute;left:40px;top:46px;width:440px;text-align:center}
.tt{font-family:'Bangers',sans-serif;font-size:150px;line-height:.95;color:${O};-webkit-text-stroke:14px ${INK};paint-order:stroke fill;letter-spacing:6px;transform:rotate(-4deg);text-shadow:8px 9px 0 ${INK}}
.bw{width:440px;height:220px;margin:-18px 0 0 6px;transform:rotate(3deg)} .bw svg{width:100%;height:100%;overflow:visible}
.ct{font-family:'Bangers',sans-serif;fill:${X};stroke:${INK};stroke-width:7;paint-order:stroke fill;letter-spacing:4px}
.bpan{position:absolute;right:112px;top:62px;width:420px;height:420px;background:#fff;border:7px solid ${INK};box-shadow:12px 12px 0 ${INK};transform:rotate(2deg)}
.board{position:absolute;inset:14px;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);gap:0}
.board>.hash{position:absolute;inset:0;width:100%;height:100%;color:${INK};overflow:visible}
.sq{position:relative;padding:20px}
.sq svg{width:100%;height:100%}
.sq .cb{position:absolute;inset:6px;width:calc(100% - 12px);height:calc(100% - 12px)} .sq .big{position:absolute;inset:20px;width:calc(100% - 40px);height:calc(100% - 40px);z-index:1}
.sq.own.X .cb polygon{fill:#f9c7b6} .sq.own.O .cb polygon{fill:#fbe39a}
.pal{position:absolute;width:150px;height:150px}
.pal.l{left:86px;bottom:92px;transform:rotate(-10deg)} .pal.r{left:356px;bottom:92px;transform:rotate(9deg)}
.pal svg{width:100%;height:100%}
.tag{position:absolute;left:0;right:0;bottom:26px;text-align:center}
.tag span{display:inline-block;background:${O};border:5px solid ${INK};padding:6px 26px 7px;font-size:36px;line-height:1.1;transform:rotate(-1deg)}`;
const SHARE = page(`<div class="pnl"><div class="rays"></div><div class="dots"></div>
<div class="title"><div class="tt">TIC TAC</div><div class="bw">${chaos}</div></div>
<div class="pal l">${svg(toonX())}</div><div class="pal r">${svg(toonO())}</div>
<div class="bpan"><div class="board">${ccells}${hashSvg('hash', 9)}</div></div>
<div class="tag"><span>Tic-tac-toe, but every square is a mini-game.</span></div></div>`, CCSS);
// The icon: the X character on a cream square (a phone rounds the corners itself, so it fills the square).
const ICON = size => `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:${size}px;height:${size}px;overflow:hidden}body{background:${CREAM};display:grid;place-items:center}svg{width:${Math.round(size * .86)}px;height:${Math.round(size * .86)}px;overflow:visible}</style>${svg(`<circle cx="50" cy="50" r="46" fill="${O}" stroke="${INK}" stroke-width="5"/><g transform="translate(50 50) scale(.78) translate(-50 -50)">${toonX()}</g>`)}`;
// An .ico holding PNGs (16, 32, 48).
function ico(pngs) {
  const head = Buffer.alloc(6); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let off = 6 + 16 * pngs.length; const dir = [], data = [];
  for (const { size, buf } of pngs) { const e = Buffer.alloc(16); e[0] = size; e[1] = size; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(buf.length, 8); e.writeUInt32LE(off, 12); off += buf.length; dir.push(e); data.push(buf); }
  return Buffer.concat([head, ...dir, ...data]);
}
async function main() {
  const { chromium } = require('playwright');
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const shot = async (html, w, h, file) => { const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 }); await p.setContent(html); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(200); const buf = await p.screenshot({ type: 'png' }); await p.close(); if (file) fs.writeFileSync(path.join(OUT, file), buf); return buf; };
  await shot(SHARE, 1200, 630, 'og-image.png');
  await shot(ICON(180), 180, 180, 'apple-touch-icon.png');
  await shot(ICON(512), 512, 512, 'icon-512.png');
  const p32 = await shot(ICON(32), 32, 32, 'favicon-32.png'), p16 = await shot(ICON(16), 16, 16, 'favicon-16.png'), p48 = await shot(ICON(48), 48, 48);
  fs.writeFileSync(path.join(OUT, 'favicon.ico'), ico([{ size: 16, buf: p16 }, { size: 32, buf: p32 }, { size: 48, buf: p48 }]));
  await b.close();
  console.log('Wrote', fs.readdirSync(OUT).join(', '));
}
// The drawing (the colours, the X and O characters, the burst, the fonts): shared with the app's icons (scripts/make-app-icons.js).
module.exports = { INK, CREAM, PAPER, X, O, SKY, GREEN, fonts, toonX, toonO, svg, burst, ol2 };
if (require.main === module) main();
