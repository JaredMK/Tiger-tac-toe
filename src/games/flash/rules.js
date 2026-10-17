// Flash: the rules (pure: no page, no clock; the server runs the same code).
import { cfgKit } from '../../core/config.js';
import { FLASH_DEFAULTS } from './meta.js';
export { attentionCreate as create } from '../shared/attention.js';
export { attentionApply as apply } from '../shared/attention.js';
export { attentionMoveFlash as moveFlash } from '../shared/attention.js';
export { attentionFlashMs as flashMs } from '../shared/attention.js';

export const FLASH_LIMITS = { n1: [4, 12, 1], n2: [4, 12, 1], n3: [4, 12, 1], ms1: [150, 3000, 10], ms2: [150, 3000, 10], ms3: [150, 3000, 10] };
export const FLASH_KIT = cfgKit(FLASH_DEFAULTS, FLASH_LIMITS);
export const setFlashConfig = FLASH_KIT.set, flashConfig = FLASH_KIT.get;
export const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];
// The right answer to a question about items, worked out from the question itself (the options aside).
export function flashAnswer(items, q) {
  const n = (f) => items.filter(f).length;
  switch (q.kind) {
    case 'colour': return n(it => it[1] === q.c);
    case 'shape': return n(it => it[0] === q.s);
    case 'combo': return n(it => it[0] === q.s && it[1] === q.c);
    case 'notColour': return n(it => it[1] !== q.c);
    case 'notShape': return n(it => it[0] !== q.s);
    case 'nth': return items[q.i].join(':');
    case 'after': { const k = items.findIndex(it => (q.s ? it[0] === q.s : it[1] === q.c)); return k >= 0 && k < items.length - 1 ? items[k + 1].join(':') : null; }
    case 'before': { let k = -1; items.forEach((it, j) => { if (it[0] === q.s) k = j; }); return k > 0 ? items[k - 1].join(':') : null; }
  }
  return null;
}
export function publicView(mini) {
  return { type: mini.type, right: { X: mini.right.X, O: mini.right.O }, round: JSON.parse(JSON.stringify(mini.round)) };
}
export function randomMove(mini, p, rng, from, empties) {
  return 'auto';   // counts as wrong
}
