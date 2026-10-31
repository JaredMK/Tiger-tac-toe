'use strict';
// The app icon options (scripts/icon-options.js): each written as assets/icon-options/<id>.svg and rendered to
// <id>.png (1024x1024, opaque) with the Chromium that Playwright carries, and the comparison page icons.html (served
// on staging only, scripts/build-site.js): every option on an iPhone home screen among plain stand-in icons, on a
// light and a dark wallpaper, in an App Store search result, at 60 and 180 px, with its rationale.
//   node scripts/make-icon-options.js        (npm run icon-options)
const fs = require('node:fs');
const path = require('node:path');
const { OPTIONS } = require('./icon-options.js');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'assets', 'icon-options');

// Stand-in neighbours on the home screen: flat colours with a plain white shape, nobody's app.
const STAND = [['#3a7bd5', 'M30 70V30h40v40z'], ['#f2994a', 'M50 25l25 45H25z'], ['#27ae60', 'M50 22a28 28 0 1 0 .1 0z'], ['#eb5757', 'M28 30h44v10H28zM28 46h44v10H28zM28 62h30v10H28z'],
  ['#9b51e0', 'M50 24l8 18 20 2-15 13 5 20-18-11-18 11 5-20-15-13 20-2z'], ['#2d9cdb', 'M25 60q25-40 50 0z'], ['#f2c94c', 'M30 30h40v40H30zM40 40v20h20V40z'], ['#4f4f4f', 'M35 25h30v50H35z'],
  ['#56ccf2', 'M25 50h50M50 25v50'], ['#219653', 'M30 65l20-35 20 35z'], ['#bb6bd9', 'M30 30l40 40M70 30L30 70'], ['#f2994a', 'M50 28a22 22 0 1 0 .1 0zM50 40a10 10 0 1 0 .1 0z']];
const LABELS = ['Notes', 'Peaks', 'Ring', 'Lists', 'Star', 'Hills', 'Frame', 'Door', 'Plus', 'Trail', 'Cross', 'Dial'];
const stand = k => `<span class="ic"><svg viewBox="0 0 100 100"><rect width="100" height="100" fill="${STAND[k][0]}"/><path d="${STAND[k][1]}" fill="#fff" stroke="#fff" stroke-width="6" stroke-linejoin="round"/></svg></span>`;
const app = (src, label, cls = '') => `<div class="app ${cls}">${src}<b>${label}</b></div>`;
const mine = id => `<span class="ic"><img src="assets/icon-options/${id}.png" alt=""></span>`;
function phone(id, dark) {
  const cells = [];
  for (let k = 0; k < 16; k++) cells.push(k === 5 ? app(mine(id), 'Tic Tac Chaos', 'me') : app(stand(k % 12), LABELS[k % 12]));
  return `<div class="phone ${dark ? 'dark' : 'light'}"><div class="notch"></div><div class="home">${cells.join('')}</div><div class="dock">${[0, 3, 6, 9].map(k => `<span class="ic">${stand(k).slice(16, -7)}</span>`).join('')}</div></div>`;
}
const row = (src, name, sub, rate) => `<div class="srow"><span class="ic big">${src}</span><div class="sinfo"><b>${name}</b><small>${sub}</small><i>${'★'.repeat(rate)}${'☆'.repeat(5 - rate)}</i></div><span class="get">GET</span></div>`;
function pageHtml() {
  const cards = OPTIONS.map((o, k) => `<section class="opt" id="${o.id}">
  <h2><span>${k + 1}</span> ${o.name}</h2>
  <p class="why">${o.why}</p>
  <div class="sizes"><figure><span class="ic s180"><img src="assets/icon-options/${o.id}.png" alt="${o.name} at 180 px"></span><figcaption>180 px</figcaption></figure>
    <figure><span class="ic s60"><img src="assets/icon-options/${o.id}.png" alt="${o.name} at 60 px"></span><figcaption>60 px</figcaption></figure>
    <figure><span class="ic s40"><img src="assets/icon-options/${o.id}.png" alt="${o.name} at 40 px"></span><figcaption>40 px</figcaption></figure>
    <figure class="raw"><img src="assets/icon-options/${o.id}.png" alt="${o.name}, full square"><figcaption>the square as made (iOS rounds it)</figcaption></figure></div>
  <div class="phones">${phone(o.id, false)}${phone(o.id, true)}</div>
  <div class="store"><div class="sbar">Search: <b>tic tac</b></div>${row(stand(1).slice(16, -7), 'Grid Party', 'Puzzle', 4)}${row(`<img src="assets/icon-options/${o.id}.png" alt="">`, 'Tic Tac Chaos', 'Every square is a mini-game', 5)}${row(stand(8).slice(16, -7), 'Noughts Classic', 'Board', 4)}</div>
  <p class="files"><a href="assets/icon-options/${o.id}.svg">SVG</a> · <a href="assets/icon-options/${o.id}.png">PNG 1024</a></p>
</section>`).join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tic Tac Chaos: app icon options</title>
<link rel="stylesheet" href="src/ui/fonts.css">
<style>
:root { --ink: #161210; --cream: #f4e6c8; --paper: #fff8e8; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--cream); color: var(--ink); font-family: 'Patrick Hand', 'Comic Sans MS', cursive; font-size: 18px; }
header { padding: 24px 16px 8px; max-width: 1100px; margin: 0 auto; }
h1 { font-family: 'Luckiest Guy', sans-serif; font-weight: 400; font-size: 34px; margin: 0 0 6px; }
header p { margin: 4px 0; }
nav { display: flex; flex-wrap: wrap; gap: 10px; padding: 8px 16px 0; max-width: 1100px; margin: 0 auto; }
nav a { display: flex; align-items: center; gap: 8px; color: var(--ink); text-decoration: none; background: var(--paper); border: 3px solid var(--ink); border-radius: 14px; padding: 4px 12px 4px 4px; }
nav a img { width: 40px; height: 40px; border-radius: 22.37%; display: block; }
.opt { max-width: 1100px; margin: 22px auto; padding: 18px 16px 22px; background: var(--paper); border: 3px solid var(--ink); border-radius: 22px; box-shadow: 0 5px 0 var(--ink); }
@media (min-width: 1132px) { .opt { margin: 22px auto; } }
@media (max-width: 1131px) { .opt { margin: 22px 16px; } }
.opt h2 { font-family: 'Luckiest Guy', sans-serif; font-weight: 400; font-size: 28px; margin: 0; display: flex; align-items: center; gap: 10px; }
.opt h2 span { display: inline-grid; place-items: center; width: 38px; height: 38px; border-radius: 50%; background: var(--ink); color: var(--paper); font-size: 22px; }
.why { margin: 6px 0 14px; font-size: 20px; }
.ic { display: block; overflow: hidden; border-radius: 22.37%; background: #ddd; }
.ic img, .ic svg { display: block; width: 100%; height: 100%; }
.sizes { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 22px; margin-bottom: 18px; }
.sizes figure { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.sizes figcaption { font-size: 15px; }
.s180 { width: 180px; height: 180px; box-shadow: 0 6px 18px rgba(0,0,0,.18); } .s60 { width: 60px; height: 60px; } .s40 { width: 40px; height: 40px; }
.raw img { width: 140px; height: 140px; display: block; border: 1px dashed var(--ink); }
.phones { display: flex; flex-wrap: wrap; gap: 18px; margin-bottom: 18px; }
.phone { position: relative; width: 300px; max-width: 100%; aspect-ratio: 390 / 844; border-radius: 42px; border: 9px solid #111; padding: 46px 14px 0; overflow: hidden; }
.phone.light { background: #e9e4dc; background-image: radial-gradient(circle at 20% 15%, #f7d9c4 0 22%, transparent 23%), radial-gradient(circle at 85% 70%, #cfe0e8 0 30%, transparent 31%); }
.phone.dark { background: #15171c; background-image: radial-gradient(circle at 75% 20%, #2b2f3a 0 25%, transparent 26%), radial-gradient(circle at 10% 80%, #23262e 0 28%, transparent 29%); }
.notch { position: absolute; top: 9px; left: 50%; width: 92px; height: 26px; margin-left: -46px; border-radius: 14px; background: #111; }
.home { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px 8px; }
.app { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0; }
.app .ic { width: 52px; height: 52px; }
.app b { font-family: -apple-system, system-ui, sans-serif; font-weight: 400; font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.light .app b { color: #222; } .dark .app b { color: #f2f2f2; }
.dock { position: absolute; left: 10px; right: 10px; bottom: 12px; display: flex; justify-content: space-around; padding: 10px; border-radius: 28px; }
.light .dock { background: rgba(255,255,255,.45); } .dark .dock { background: rgba(255,255,255,.12); }
.dock .ic { width: 52px; height: 52px; }
.store { max-width: 420px; background: #fff; border-radius: 16px; border: 1px solid #ddd; font-family: -apple-system, system-ui, sans-serif; overflow: hidden; }
.sbar { padding: 10px 14px; background: #f2f2f7; font-size: 14px; color: #555; }
.srow { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-top: 1px solid #eee; }
.ic.big { width: 64px; height: 64px; flex: none; }
.sinfo { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.sinfo b { font-size: 15px; font-weight: 600; color: #111; } .sinfo small { font-size: 13px; color: #777; } .sinfo i { font-style: normal; font-size: 11px; color: #999; }
.get { background: #eef0f5; color: #0a66ff; font-weight: 700; font-size: 14px; border-radius: 999px; padding: 5px 16px; }
.files { margin: 12px 0 0; font-size: 15px; } .files a { color: var(--ink); }
.lineup { max-width: 1100px; margin: 0 auto; padding: 0 16px; }
.lineup .strip { display: flex; flex-wrap: wrap; gap: 14px; padding: 14px; border-radius: 18px; }
.lineup .strip.l { background: #e9e4dc; } .lineup .strip.d { background: #15171c; margin-top: 10px; }
.lineup .ic { width: 60px; height: 60px; }
</style></head><body>
<header><h1>App icon options</h1>
<p>Six concepts for the Tic Tac Chaos icon. Each is a full-bleed 1024 px square with no transparency; iOS rounds the corners itself, as shown here. The current icon stays until one is picked.</p></header>
<nav>${OPTIONS.map((o, k) => `<a href="#${o.id}"><img src="assets/icon-options/${o.id}.png" alt="">${k + 1}. ${o.name}</a>`).join('')}</nav>
<div class="lineup"><h2 style="font-family:'Luckiest Guy',sans-serif;font-weight:400;font-size:22px;margin:18px 0 8px">All six at 60 px</h2>
<div class="strip l">${OPTIONS.map(o => mine(o.id)).join('')}${stand(0)}${stand(4)}</div>
<div class="strip d">${OPTIONS.map(o => mine(o.id)).join('')}${stand(0)}${stand(4)}</div></div>
${cards}
</body></html>
`;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const { chromium } = require('playwright');
  const b = await chromium.launch();
  for (const o of OPTIONS) {
    const svg = o.draw();
    fs.writeFileSync(path.join(OUT, o.id + '.svg'), svg);
    const p = await b.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
    await p.setContent(`<!doctype html><style>html,body{margin:0;width:1024px;height:1024px;overflow:hidden}svg{display:block}</style>${svg}`);
    fs.writeFileSync(path.join(OUT, o.id + '.png'), await p.screenshot({ type: 'png', omitBackground: false }));
    await p.close();
  }
  await b.close();
  fs.writeFileSync(path.join(ROOT, 'icons.html'), pageHtml());
  console.log('Wrote', OPTIONS.map(o => o.id).join(', '), 'and icons.html');
}
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { pageHtml };
