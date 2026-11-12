// Comic Chaos (December 2026): the menus' pieces, drawn in the shared tokens (src/ui/comic.css). TAPPABLE is a skewed
// panel (.pn: thick ink outline, hard drop shadow, a caption tag), pressed it punches in. INFORMATION is flat: a speech
// bubble (bubble), a caption box (cap), plain text, a burst badge (burstBadge: a fact, never a button). SELECTED is
// inverted to ink and yellow (.pn.on). A screen is main.scr.cc with its intensity: .loud (the main menu, the results)
// or .calm (the working screens).
import { esc } from './app.js';

// A panel: the screen's way into something. `tag` its caption tag (on the panel's top edge), `sub` a short line under the
// label; `cls` its colour (k ink, r red, y yellow, c cyan, w white) and kind; `k` its place in the entrance.
export function panel(act, label, { tag = '', sub = '', cls = 'w', k = 0, attrs = '', on = false, aria = '' } = {}) {
  return `<button class="pn ${cls}${on ? ' on' : ''}" data-act="${act}"${attrs}${aria ? ` aria-label="${aria}"` : ''} style="--k:${k}">${tag ? `<i class="ptag" aria-hidden="true">${tag}</i>` : ''}<b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</button>`;
}
// A speech bubble (information): `tail` 'l', 'r' or '' (none), `cls` more classes.
export const bubble = (html, tail = 'l', cls = '') => `<span class="bub${tail ? ' t' + tail : ''}${cls ? ' ' + cls : ''}">${html}</span>`;
// A caption box (information).
export const cap = (html, cls = '') => `<span class="cap${cls ? ' ' + cls : ''}">${html}</span>`;
// A burst badge (information: a fact, flat; the burst is decoration and takes no tap).
export const burstBadge = (html, cls = '', k = 0) => `<span class="bbadge${cls ? ' ' + cls : ''}" style="--k:${k}"><span>${html}</span></span>`;
// The rays behind a loud screen (decoration).
export const rays = () => '<i class="ccrays" aria-hidden="true"></i>';
// A small panel with an icon over its label (Menu, How to play, Settings, Share, Board): the whole is the button.
export function smallPanel(act, icon, label, { cls = 'w', k = 0, attrs = '', aria = '' } = {}) {
  return `<button class="pn sm ${cls}" data-act="${act}"${attrs}${aria ? ` aria-label="${esc(aria)}"` : ''} style="--k:${k}">${icon}<b>${label}</b></button>`;
}
const S = 'stroke="#161210" stroke-linecap="round" stroke-linejoin="round"';
// Its icons: chunky, filled, outlined in ink.
export const CICON = {
  help: `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="19" fill="#f6c21b" ${S} stroke-width="3.5"/><path d="M18 19c0-4 3-6.5 6.5-6.5S31 15 31 18.5c0 4.5-6 5-6 9.5" fill="none" ${S} stroke-width="4"/><circle cx="25" cy="34.5" r="2.6" fill="#161210"/></svg>`,
  cog: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 6l3 5 6-2 1 6 6 1-2 6 5 3-5 3 2 6-6 1-1 6-6-2-3 5-3-5-6 2-1-6-6-1 2-6-5-3 5-3-2-6 6-1 1-6 6 2z" fill="#ffffff" ${S} stroke-width="3"/><circle cx="24" cy="24" r="6" fill="#35c4e0" ${S} stroke-width="3"/></svg>`,
  share: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 30V7M15 15l9-9 9 9M10 24v15h28V24" fill="none" ${S} stroke-width="4.5"/></svg>`,
  home: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M11 21v19h26V21L24 9z" fill="#ffffff" ${S} stroke-width="3.5"/><path d="M6 24L24 8l18 16" fill="none" ${S} stroke-width="4.5"/><path d="M20 40V29h8v11" fill="#e5432a" ${S} stroke-width="3"/></svg>`,
  board: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M18 7v34M30 7v34M7 18h34M7 30h34" fill="none" ${S} stroke-width="4.5"/><path d="M10 10l6 6M16 10l-6 6" stroke="#e5432a" stroke-linecap="round" stroke-width="3.5"/><circle cx="36" cy="36" r="3.6" fill="none" stroke="#d9a400" stroke-width="3.2"/></svg>`,
};
