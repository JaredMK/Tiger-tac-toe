// Treasure Hunt: the screen, the miniature, the move's words and sounds, and the inputs.
import { huntClue, huntSize } from './rules.js';
import { mv } from '../../ui/app.js';

// Treasure hunt: a dug cell shows its band (Hot 1 step, Warm 2-3, Cool 4-5, Cold 6+), never the distance.
const BAND = [{ name: 'Found!', bg: '#ffd166', fg: '#1a1a1a' }, { name: 'Hot', bg: '#ff4d4d', fg: '#fff', steps: '1 step' }, { name: 'Warm', bg: '#ffb627', fg: '#1a1a1a', steps: '2–3 steps' },
  { name: 'Cool', bg: '#4cc9c0', fg: '#1a1a1a', steps: '4–5 steps' }, { name: 'Cold', bg: '#3b6fd6', fg: '#fff', steps: '6+ steps' }];
// The key under the grid: each band's colour and how many steps it means (always there: nothing moves).
const HKEY = `<div class="hkey" aria-label="Key: ${BAND.slice(1).map(b => `${b.name} ${b.steps}`).join(', ')}">${BAND.slice(1).map(b => `<span><i style="background:${b.bg}"></i><b>${b.name}</b>&nbsp;=&nbsp;${b.steps.replace(' steps', '')}</span>`).join('')}</div>`;
const GEM = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20" stroke="rgba(0,0,0,.25)" stroke-width="1.5"/></svg>';
// a dug cell's distance: from the treasure here, or from the clues the host sent (the treasure itself stays with the host)
function clueAt(mini, i) { return mini.clues ? mini.clues[i] : huntClue(mini, i); }   // a band, 1 to 4
export function miniature(mini, final) {
  return `<div class="tg g5x5" style="--hn:${huntSize(mini)}">${mini.dug.map((d, i) => {
      if (!d) return '<i></i>';
      const k = clueAt(mini, i), b = BAND[k] || BAND[4];
      return `<i style="background:${b.bg};color:${b.fg}">${k ? '' : GEM}</i>`;
    }).join('')}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const hn = huntSize(mini);
  g = `<div class="g-hunt"><div class="hgrid" style="--hn:${hn}">${mini.dug.map((dg, i) => {
        const found = (dg || view) && i === mini.treasure;
        const k = dg ? clueAt(mini, i) : -1;
        const b = dg ? BAND[k] || BAND[4] : view && found ? BAND[0] : null;
        const style = b ? ` style="--dbg:${b.bg};--dfg:${b.fg};background:var(--dbg);color:var(--dfg)"` : '';
        const r = Math.floor(i / hn) + 1, c = i % hn + 1;
        return `<button class="dig${found ? ' found' : ''}${anim === i ? ' open' : ''}" data-act="move" ${mv(i)}${style} aria-label="Row ${r} column ${c}${found ? ', treasure' : dg ? `, ${b.name.toLowerCase()}` : ''}"${dg || locked ? ' disabled' : ''}>${found ? GEM : dg ? `<span>${b.name}</span>` : ''}</button>`;
      }).join('')}</div>${HKEY}</div>`;   // the colour key under the grid, in every mode

  return g;
}
export function moveText(f, who) {
  return `${who} dug · ${(BAND[f.band] || BAND[4]).name}`;
}
export function sounds(f, add, won, mini, last) {
  add('dig', 0); if (f.band === 0 || won) add('sparkle', 800); else add('band', 380, [0, 1100, 880, 660, 440][f.band] / 880); return;
}
