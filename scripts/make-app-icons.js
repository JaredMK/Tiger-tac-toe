'use strict';
// The iOS app's artwork, drawn like the share images (scripts/make-share-images.js: the game's fonts, colours and X and O
// characters) and rendered with the Chromium that Playwright carries. Writes assets/app/*:
//   icon-1024.png        the App Store icon: Patchwork (scripts/icon-options.js, picked October 2026; full-bleed, no transparency;
//                        Apple rounds the corners), also copied into ios/'s AppIcon set (its one Single Size slot), and
//   icons/icon-<n>.png   the same at the iPhone sizes (180, 120, 87, 80, 60, 58, 40) for checking it small
//   launch-2048.png      the launch screen's image: the title (TIC TAC CHAOS!) centred on the cream background
//   jarhad-mark-512.png  a small JarHad Labs mark (the studio's logo, assets/brand/jarhad-labs-logo.svg, without its background)
// docs/ios-plan.md ("App icon and launch screen") says where each goes in Xcode.
//   node scripts/make-app-icons.js        (npm run app-icons)
const fs = require('node:fs');
const path = require('node:path');
const { INK, CREAM, O, X, fonts, toonX, toonO, svg, burst, ol2 } = require('./make-share-images.js');
const { OPTIONS } = require('./icon-options.js');
const ICON_SVG = OPTIONS.find(o => o.id === 'patchwork').draw();   // the app's icon (the icon options' round 1, /icons.html)
const IOS_ICON = path.join(__dirname, '..', 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon-512@2x.png');
const SIZES = [180, 120, 87, 80, 60, 58, 40];
const OUT = path.join(__dirname, '..', 'assets', 'app');
const LOGO = fs.readFileSync(path.join(__dirname, '..', 'assets', 'brand', 'jarhad-labs-logo.svg'), 'utf8');

const page = (w, h, css, body, bg = CREAM) => `<!doctype html><meta charset="utf-8"><style>${fonts}
*{box-sizing:border-box;margin:0} html,body{width:${w}px;height:${h}px;overflow:hidden}
body{background:${bg};position:relative;font-family:'Patrick Hand',cursive;color:${INK}}
.rays{position:absolute;inset:0;background:repeating-conic-gradient(from 0deg at 50% 50%, rgba(246,194,27,.20) 0 7.5deg, transparent 7.5deg 15deg)}
.vig{position:absolute;inset:0;background:radial-gradient(circle at 50% 50%, transparent 55%, rgba(22,18,16,.14))}
${css}</style>${body}`;
// The icon: the Patchwork drawing at any size (an SVG, so every size is drawn, not scaled down from a picture).
const ICON = s => `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:${s}px;height:${s}px;overflow:hidden}svg{display:block;width:${s}px;height:${s}px}</style>${ICON_SVG}`;
// The launch screen: the title alone, centred (the same title as the share image, at the launch image's scale), with the two
// characters either side, on the plain cream (no rays: the phone shows it centred over the same cream, docs/ios-plan.md, so
// its edges never show).
const LAUNCH = s => page(s, s, `
.title{position:absolute;left:0;right:0;top:${s * .30}px;display:flex;flex-direction:column;align-items:center;gap:${s * .005}px}
.tt{font-family:'Luckiest Guy',sans-serif;font-size:${s * .14}px;line-height:1;color:${O};text-shadow:${ol2},${s * .006}px ${s * .009}px 0 ${INK};letter-spacing:${s * .003}px;transform:rotate(-2deg)}
.bw{width:${s * .46}px;height:${s * .23}px;transform:rotate(3deg)} .bw svg{width:100%;height:100%;overflow:visible}
.bt{font-family:'Luckiest Guy',sans-serif;fill:#fff8e8;stroke:${INK};stroke-width:5;paint-order:stroke fill;letter-spacing:2px}
.pal{position:absolute;top:${s * .43}px;width:${s * .15}px;height:${s * .15}px} .pal svg{width:100%;height:100%;overflow:visible}
.pal.l{left:${s * .14}px;transform:rotate(-10deg)} .pal.r{right:${s * .14}px;transform:rotate(10deg)}`,
`<div class="title"><div class="tt">TIC TAC</div><div class="bw">${burst('CHAOS!', 300, 150, 66)}</div></div>
<div class="pal l">${svg(toonX())}</div><div class="pal r">${svg(toonO())}</div>`);
// The studio's mark: the logo's drawing without its background square, on a transparent canvas.
const MARK = s => `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:${s}px;height:${s}px;overflow:hidden;background:transparent}svg{width:${s}px;height:${s}px;display:block}</style>${LOGO.replace(/<rect width="1024" height="1024"[^>]*\/>\s*/, '')}`;

async function main() {
  const { chromium } = require('playwright');
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const shot = async (html, w, h, file, transparent) => {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await p.setContent(html); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(200);
    const buf = await p.screenshot({ type: 'png', omitBackground: !!transparent }); await p.close();
    fs.writeFileSync(path.join(OUT, file), buf);
  };
  await shot(ICON(1024), 1024, 1024, 'icon-1024.png');
  fs.mkdirSync(path.join(OUT, 'icons'), { recursive: true });
  for (const n of SIZES) await shot(ICON(n), n, n, path.join('icons', `icon-${n}.png`));
  if (fs.existsSync(path.dirname(IOS_ICON))) fs.copyFileSync(path.join(OUT, 'icon-1024.png'), IOS_ICON);   // (ios/ committed: in step without a full npm run ios:build)
  await shot(LAUNCH(2048), 2048, 2048, 'launch-2048.png');
  await shot(MARK(512), 512, 512, 'jarhad-mark-512.png', true);
  await b.close();
  console.log('Wrote', fs.readdirSync(OUT).join(', '));
}
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
