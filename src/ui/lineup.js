// The Game lineup (December 2026): a reason to come back. On the main menu's top row, left (so Play never moves), a small
// skewed panel: a fan of three game previews and GAME LINEUP in Bangers, a NEW burst on its corner while a game is new to
// either list since this device last opened it (kept on the device, KEY + '.lineup': the lists as last seen; never opened:
// NEW). Hidden until this device has finished a match (ui/onboard.js matchesDone), so never on a first visit.
// A tap opens the lineup over the menu, full screen and loud (the menu's own red and yellow page, its turning rays and
// halftone): "Coming soon" first, as big cards (the game's art large, its name, a tilted release sticker from the date,
// core/games.js soonSticker, as this phone's own day has it), popping in one after another; then "In rotation now", a grid
// of cards (each game's art and name). The art is each game's own board miniature (its view's `miniature`, the very
// drawing a square of the board shows), dealt fresh and drawn at the card's real size, so it is as sharp as the board's
// (the miniatures size from their container: cq units), never a picture scaled up; a game with no miniature yet (its view
// not loaded, or a drawing that fails) is a mystery card: a dark silhouette, a big "?", its name and its sticker.
// Released here: core/games.js releasedOn (the release switches, the platform's own); coming soon: soonOn (the admin's
// flag and date, releases/soon/{type}, never on a platform the game is released on). The cards are information: flat,
// outlined, never shadowed or skewed; the stickers flat and tilted.
import { clientHas } from '../core/client.js';
import { lineup, soonDate, soonSticker } from '../core/games.js';
import { applyMove, newMini, randomLegalMove } from '../core/minis.js';
import { makeRng } from '../core/random.js';
import { INFO, VIEWS, viewOf } from '../games/index.js';
import { PLATFORM, clientInfo } from '../net/platform.js';
import { nowReleases, releases } from '../net/releases.js';
import { esc } from './app.js';
import { softName } from './board.js';
import { rays } from './comic.js';
import { KEY } from './config.js';
import { fxAttr } from './fx.js';
import { matchesDone } from './onboard.js';

const LU_KEY = KEY + '.lineup';
const lu = (() => { try { const v = JSON.parse(localStorage.getItem(LU_KEY) || 'null'); if (v && typeof v === 'object' && v.seen && typeof v.seen === 'object') return { seen: v.seen }; } catch (e) { /* none kept */ } return { seen: null }; })();
const save = () => { try { localStorage.setItem(LU_KEY, JSON.stringify(lu)); } catch (e) { /* no storage: NEW again next visit */ } };
export const luState = lu;

// The lists for this platform and client (an older app leaves out the games it does not have).
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };   // (this phone's own day)
export const lineupNow = () => lineup(nowReleases(), PLATFORM, t => clientHas(clientInfo(), t), todayStr());
const keysOf = L => L.now.map(t => 'r:' + t).concat(L.soon.map(t => 's:' + t));
// Shown on the menu: once this device has finished a match.
export const lineupShown = () => matchesDone() >= 1;
// NEW: never opened, or a game in a list it was not in when the lineup was last opened.
export function lineupNew(L = lineupNow()) {
  if (!lu.seen) return true;
  return keysOf(L).some(k => !lu.seen[k]);
}
export function markSeen(L = lineupNow()) { lu.seen = Object.fromEntries(keysOf(L).map(k => [k, 1])); save(); }

// ----- the art: a game's own board miniature, dealt fresh (a move or two in, so it looks played), once a visit -----
const artMemo = new Map();
export function gameArt(t) {
  if (artMemo.has(t)) return artMemo.get(t);
  const view = viewOf(t);
  if (!VIEWS.ready || !view || !view.miniature) return '';            // (not loaded yet: a mystery card until it is, not remembered)
  let html = '';
  try {
    const rng = makeRng('lineup-' + t), mini = newMini(t, rng, { shared: true });
    for (const p of ['X', 'O']) {                                       // a move each where a random one plays cleanly and leaves the game open
      try {
        const copy = JSON.parse(JSON.stringify(mini)), m = randomLegalMove(copy, p, rng);
        if (m == null) break;
        const r = applyMove(copy, p, m, rng);
        if (!r || !r.ok || r.outcome !== 'continue') break;
        Object.keys(mini).forEach(k => delete mini[k]); Object.assign(mini, copy);
      } catch (e) { break; }
    }
    html = view.miniature(mini, false) || '';
  } catch (e) { html = ''; }
  artMemo.set(t, html);
  return html;
}
// A preview: the board square's own frame (its classes) at a board square's size, ART_PX, so the drawing is exactly the
// board's (its sizes from that square: cq units, and the px floors the board's text keeps), then scaled to its box
// (fitLineupArt, after each render and on a resize): a scaled drawing, never a picture, so it stays sharp at any size.
export const ART_PX = 128;
const preview = t => { const a = gameArt(t); return a ? `<div class="sq luart" aria-hidden="true"><div class="thumb">${a}</div></div>` : `<div class="lumys" aria-hidden="true"><b>?</b></div>`; };
export function fitLineupArt(root) {
  if (!root || !root.querySelectorAll) return;
  for (const e of root.querySelectorAll('.lupage .sq.luart, .lucard .sq.luart')) {
    const box = e.parentElement, w = box ? box.clientWidth : 0;
    if (w > 0) e.style.scale = String(Math.round((w / ART_PX) * 1000) / 1000);
  }
}
let fitOn = false;
function fitWatch() { if (fitOn || typeof window === 'undefined' || !window.addEventListener) return; fitOn = true; window.addEventListener('resize', () => { try { fitLineupArt(document.getElementById('app')); } catch (e) { /* (none) */ } }); }
const sticker = t => `<i class="lustk">${esc(soonSticker(soonDate(t, releases)))}</i>`;

// ----- the full-screen lineup -----
export let lineupOpen = false;
let openAt = 0;
export function setLineupOpen(v) { lineupOpen = !!v; if (lineupOpen) { openAt = performance.now(); markSeen(); fitWatch(); } }
const name = t => softName(esc(INFO[t].name));
const soonCard = (t, k) => `<li class="lusoonc${gameArt(t) ? '' : ' mys'}" style="--k:${k}"><div class="lubig">${preview(t)}</div><div class="lutxt"><b>${name(t)}</b>${sticker(t)}</div></li>`;
const nowCard = (t, k) => `<li class="lunowc${gameArt(t) ? '' : ' mys'}" style="--k:${k}"><div class="lusm">${preview(t)}</div><b>${name(t)}</b></li>`;
export function renderLineup(screen) {
  if (screen !== 'menu') lineupOpen = false;          // (shut once the menu is left)
  if (!lineupOpen) return '';
  const L = lineupNow();
  return `<div class="lupage cc loud" role="dialog" aria-modal="true" aria-label="Game lineup"${fxAttr(Math.round(openAt))}><div class="luback" aria-hidden="true">${rays()}</div>
    <div class="luhead"><h1 class="lutitle ccpunch"><span>Game</span> <span>lineup</span></h1><button class="pn y gdone" data-act="lineup"><b>Done</b></button></div>
    <div class="lubody" data-keep-scroll="lineup">
      ${L.soon.length ? `<h2 class="cap luh">Coming soon</h2><ul class="lusoonl">${L.soon.map((t, k) => soonCard(t, k)).join('')}</ul>` : ''}
      <h2 class="cap luh">In rotation now</h2><ul class="lunowl">${L.now.map((t, k) => nowCard(t, k + L.soon.length)).join('')}</ul>
    </div></div>`;
}
// The menu's card (its top row, left): a fan of three previews (coming soon first, then in rotation) and GAME LINEUP.
export function lineupButton() {
  if (!lineupShown()) return '';
  const L = lineupNow(), isNew = lineupNew(L), fan = L.soon.concat(L.now).slice(0, 3);
  return `<button class="btn lucard" data-act="lineup" aria-haspopup="dialog" aria-label="Game lineup${isNew ? ': new games' : ''}"><span class="lufan" aria-hidden="true">${fan.map((t, k) => `<span class="lufc f${k}">${preview(t)}</span>`).join('')}</span><span class="luword"><b>Game</b><b>Lineup</b></span>${isNew ? '<i class="lunew" aria-hidden="true">NEW</i>' : ''}</button>`;
}
