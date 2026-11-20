// A player's token for the December 2026 games: a round disc in the player's colour with the drawn mark (no text).
import { markSvgG } from './thumbs.js';
export const tok = (p, cls) => `<i class="ntok ${p}${cls ? ' ' + cls : ''}" aria-hidden="true"><svg viewBox="-10 -10 20 20">${markSvgG(p, 5)}</svg></i>`;
