// The Sticker book (December 2026): the menus' look, direction B of the December 2026 menu design review. Every menu control is a sticker
// (src/ui/stickers.css: .stk, a white die-cut edge, an ink outline, tilted by --r, slapped down on the screen's entry in
// --k's order), on a dot-grid page, held by strips of tape, with hand-written notes (Patrick Hand) and a highlighter (.hl);
// a choice is circled in red pen (penRing). The pieces every screen shares are here, drawn in the shared tokens.
const S = 'stroke="var(--ink)" stroke-linecap="round" stroke-linejoin="round"';   // (each drawing gives its own stroke-width)

// A strip of tape: 'y' yellow, 'b' blue, 'r' red; `style` places it (left/top/right, --r its tilt).
export const tape = (c = 'y', style = '') => `<i class="tape ${c}" aria-hidden="true"${style ? ` style="${style}"` : ''}></i>`;
// The red pen ring round a choice: drawn once as it is chosen (stickers.css .pen: its stroke runs on from nothing).
export const penRing = (wide = false) => `<svg class="pen${wide ? ' w' : ''}" viewBox="0 0 120 60" preserveAspectRatio="none" aria-hidden="true"><path d="M16 36C8 16 44 4 78 6s40 18 30 32S46 58 22 50 8 26 32 14"/></svg>`;

// The icons of the round stickers: chunky, filled, outlined in ink.
export const ICON = {
  help: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M16 17c0-6 4-9 8.5-9S33 11 33 16c0 6-8 7-8 13" fill="none" ' + S + ' stroke-width="5"/><circle cx="25" cy="38" r="3.4" fill="var(--ink)"/></svg>',
  cog: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 6l3 5 6-2 1 6 6 1-2 6 5 3-5 3 2 6-6 1-1 6-6-2-3 5-3-5-6 2-1-6-6-1 2-6-5-3 5-3-2-6 6-1 1-6 6 2z" fill="var(--paper)" ${S} stroke-width="3"/><circle cx="24" cy="24" r="6" fill="var(--o)" ${S} stroke-width="3"/></svg>`,
  cup: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M14 8h20v10c0 7-4 11-10 11s-10-4-10-11z" fill="var(--o)" ${S} stroke-width="3.5"/><path d="M14 11H7c0 7 3 10 8 10M34 11h7c0 7-3 10-8 10M24 29v7M16 40h16" fill="none" ${S} stroke-width="3.5"/></svg>`,
  share: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 30V7M15 15l9-9 9 9M10 24v15h28V24" fill="none" ${S} stroke-width="4"/></svg>`,
  home: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 22v18h24V22" fill="var(--paper)" ${S} stroke-width="4"/><path d="M7 24L24 9l17 15" fill="none" ${S} stroke-width="4"/></svg>`,
  board: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M18 7v34M30 7v34M7 18h34M7 30h34" fill="none" ${S} stroke-width="4"/><path d="M10 10l6 6M16 10l-6 6" stroke="var(--x)" stroke-linecap="round" stroke-width="3.5"/><circle cx="36" cy="36" r="3.6" fill="none" stroke="#d9a400" stroke-width="3.2"/></svg>`,
  star: '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 4l4.5 10.5 11.5 1.5-8.5 8 2 11.5L20 30l-9.5 5.5 2-11.5-8.5-8 11.5-1.5z"/></svg>',
};
// A round sticker button with its caption under it (the whole of it is the button: 44 px and more).
export function roundStk(act, icon, cap, { r = 0, k = 0, cls = '', attrs = '', label = '' } = {}) {
  return `<button class="stkr${cls ? ' ' + cls : ''}" data-act="${act}"${attrs}${label ? ` aria-label="${label}"` : ''} style="--r:${r}deg;--k:${k}"><span class="stk rd">${icon}</span><small>${cap}</small></button>`;
}
