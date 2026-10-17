// Dice Race: the screen, the miniature, the move's words and sounds, and the inputs.
import { DICE_GOAL, diceSlot } from './rules.js';
import { N, mv } from '../../ui/app.js';
import { dieFace } from '../../ui/art.js';
import { DICE_SPEC, trackSvg } from '../../ui/track.js';
export { trackSounds as sounds } from '../../ui/track.js';

export function miniature(mini, final) {
  return trackSvg(DICE_SPEC, { tokens: { X: diceSlot(mini.totals.X), O: diceSlot(mini.totals.O) }, finish: 'flag', mini: true });
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = `<div class="g-dice">${trackSvg(DICE_SPEC, { tokens: { X: diceSlot(mini.totals.X), O: diceSlot(mini.totals.O) }, moved: a ? a.by : null, finish: 'flag' })}
        <div class="dieWrap"><div class="die${a ? ' roll' : ''}">${mini.last ? dieFace(mini.last.roll) : '<span class="q">?</span>'}</div>
          <div class="dielab${a ? ' late' : ''}">${mini.last ? `<b class="${mini.last.by}">${N(mini.last.by)}</b> rolled ${mini.last.roll}` : 'No rolls yet'}</div></div>
        <button class="big ${turn}" data-act="move" ${mv(1)}${locked ? ' disabled' : ''}>Roll for ${N(turn)}</button></div>`;
  return g;
}
export function moveText(f, who) {
  return `${who} rolled ${f.roll} · space ${Math.min(f.total, DICE_GOAL - 1)}`;
}
