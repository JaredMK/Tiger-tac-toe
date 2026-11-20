// Mahjong: the screen, the miniature, the move's words and sounds, and the pick of a pair.
// The mover's layout: tiles laid by their place (half-tile steps) and layer, each layer set up and to the left of the
// one under it with its edge showing; a free tile is a button, a blocked one is shaded. A tap picks a free tile (it
// lifts, ringed in the mover's colour); a tap on its match takes the pair; a tap on another free tile picks that one
// instead. A pair taken: the two tiles lift together (MAHJ.lift) and fly off (MAHJ.fly). The pictures are original
// drawings (a sun, a moon, a leaf, a drop and so on), one colour each.
import { MAHJ, mahjCfg, mahjFree } from './rules.js';
import { SND, ownPress } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { haptic } from '../../net/platform.js';
import { blocked } from '../../net/room.js';
import { N, mv, state } from '../../ui/app.js';
import { lateAt } from '../../ui/progress.js';
import { render } from '../../ui/render.js';
import { thumbArt } from '../../ui/thumbs.js';
import { barRows, ptsTally } from '../../ui/tok.js';

export const ownLine = true;
export const hold = f => (f.kind === 'again' ? 0 : null);
export const replay = { synth: () => [] };                         // the move is its pair: shown from the flash, never pressed in
const PIC = [
  ['#f59f00', '<circle cx="12" cy="12" r="4.600"/><path d="M12 2.500v3M12 18.500v3M2.500 12h3M18.500 12h3M5.300 5.300l2.100 2.100M16.600 16.600l2.100 2.100M5.300 18.700l2.100-2.100M16.600 7.400l2.100-2.100" fill="none" stroke-width="2.400" stroke-linecap="round"/>'],
  ['#5c6bc0', '<path d="M16.500 3.500a9 9 0 1 0 4 13.500 7.500 7.500 0 0 1-4-13.500z"/>'],
  ['#2e9e4f', '<path d="M4 20c0-9 6-15 16-16 0 10-6 16-16 16z"/><path d="M5 19 15 9" fill="none" stroke="#fff" stroke-width="1.600" stroke-linecap="round"/>'],
  ['#1e88e5', '<path d="M12 2.500c4.500 5.500 7 9 7 12.500a7 7 0 0 1-14 0c0-3.500 2.500-7 7-12.500z"/>'],
  ['#e53935', '<path d="M12 20.500C5 15.500 3 12 3 8.500a4.500 4.500 0 0 1 9-1.500 4.500 4.500 0 0 1 9 1.500c0 3.500-2 7-9 12z"/>'],
  ['#f4b400', '<path d="M13.500 2 5 13.500h5.500L9.500 22l9-12.500h-6z"/>'],
  ['#00897b', '<path d="M2.500 9c3-4 5-4 7.500 0s4.500 4 7.500 0 3.500-2 4-1.500M2.500 16c3-4 5-4 7.500 0s4.500 4 7.500 0 3.500-2 4-1.500" fill="none" stroke-width="2.800" stroke-linecap="round"/>'],
  ['#d81b60', '<circle cx="12" cy="6.500" r="3.300"/><circle cx="17.300" cy="10.300" r="3.300"/><circle cx="15.300" cy="16.500" r="3.300"/><circle cx="8.700" cy="16.500" r="3.300"/><circle cx="6.700" cy="10.300" r="3.300"/><circle cx="12" cy="12" r="2.600" fill="#ffe082"/>'],
  ['#8e24aa', '<path d="M12 2.500l2.800 6.200 6.700.700-5 4.600 1.400 6.600L12 17.200l-5.900 3.400 1.400-6.600-5-4.600 6.700-.700z"/>'],
  ['#6d4c41', '<path d="M12 2.500 5 12h4l-4.500 6h6V21.500h3V18h6L15 12h4z"/>'],
  ['#3949ab', '<path d="M3 12c3-5 9-6 13-2l5-3.500v11L16 14c-4 4-10 3-13-2z"/><circle cx="8" cy="11" r="1.300" fill="#fff"/>'],
  ['#ef6c00', '<path d="M12 3 21 12 12 21 3 12z"/><path d="M12 7.500 16.500 12 12 16.500 7.500 12z" fill="#fff" opacity=".55"/>'],
  ['#546e7a', '<circle cx="8" cy="8.500" r="5"/><path d="M11.500 12 20.500 21M16.500 17l2.500-2.500M19 19.500l2-2" fill="none" stroke-width="2.800" stroke-linecap="round"/><circle cx="8" cy="8.500" r="1.800" fill="#fff"/>'],
  ['#c0ca33', '<path d="M12 4c-4 0-6.500 3-6.500 7.500 0 3.500-2 4.500-3 6h19c-1-1.500-3-2.500-3-6C18.500 7 16 4 12 4z"/><circle cx="12" cy="20" r="2"/>'],
  ['#00acc1', '<path d="M7 18.500a4.500 4.500 0 0 1-.500-9 6 6 0 0 1 11.500 1.200 4 4 0 0 1-.500 7.800z"/>'],
  ['#7cb342', '<circle cx="8" cy="15.500" r="5"/><circle cx="16.500" cy="16.500" r="4"/><path d="M8 10.500c1-4 4-6.500 8-7M16.500 12.500c0-3.500.500-6 0-9" fill="none" stroke-width="2.200" stroke-linecap="round"/>'],
];
export const mjPic = k => { const [col, body] = PIC[((k % PIC.length) + PIC.length) % PIC.length]; return `<svg class="mjpic" viewBox="0 0 24 24" aria-hidden="true" fill="${col}" stroke="${col}" stroke-width="0">${body}</svg>`; };
let sel = null;                                                    // this phone's pick: { sq, p, n (pairs cleared then), i }
const selOf = (sq, p, n) => (sel && sel.sq === sq && sel.p === p && sel.n === n ? sel.i : -1);
function pickAct(el) {
  const sq = state.squares && state.squares[state.zoom], m = sq && sq.mini;
  if (!m || m.type !== 'mahjong' || state.flash || state.done || blocked()) return;
  const p = state.turn, i = Number(el.dataset.i), tiles = m.lay[p], on = m.on[p];
  if (!(i >= 0 && i < tiles.length) || !mahjFree(tiles, on, i)) return;
  const cur = selOf(state.zoom, p, m.got[p]);
  if (cur === i) { sel = null; SND.play('mjTap', { rate: 0.85 }); render(); return; }
  if (cur >= 0 && tiles[cur].k === tiles[i].k && mahjFree(tiles, on, cur)) { sel = null; attemptMove([cur, i]); return; }
  sel = { sq: state.zoom, p, n: m.got[p], i }; SND.play('mjTap'); haptic('tap'); render();
}
export const actions = { 'mj-pick': el => { ownPress(); pickAct(el); } };
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const c = mahjCfg(mini), s = a && a.mj ? a.mj : null, o = { view, locked, turn };
  const who = s ? a.by : (view || d) && mini.last ? mini.last.by : turn, tiles = mini.lay[who], on = mini.on[who];
  const tal = p => ptsTally(p, o, c.goal, mini.got[p], s && a.by === p ? s.got - 1 : null, MAHJ.lift + MAHJ.fly);
  const cols = Math.max(...tiles.map(t => t.x)) + 2, rows = Math.max(...tiles.map(t => t.y)) + 2, zs = Math.max(...tiles.map(t => t.z));
  const live = !view && !locked && who === turn, picked = live ? selOf(state.zoom, turn, mini.got[turn]) : -1;
  const claim = live && mini.final && mini.final.by === turn;
  const tile = (t, i) => {
    const leaving = s && (i === s.i || i === s.j);
    if (!on[i] && !leaving) return '';
    const free = on[i] && mahjFree(tiles, on, i), st = `left:${(t.x / cols * 100).toFixed(2)}%;top:${(t.y / rows * 100).toFixed(2)}%;--z:${t.z};z-index:${t.z * 100 + t.y * 4 + t.x}`;
    const cls = `mjt${free ? ' free' : ' blk'}${picked === i ? ' sel ' + turn : ''}${leaving ? ' off' : ''}`;
    return live && free && !claim ? `<button class="${cls}" style="${st}" data-act="mj-pick" data-i="${i}" aria-label="Tile ${i + 1}" aria-pressed="${picked === i}">${mjPic(t.k)}</button>` : `<div class="${cls}" style="${st}">${mjPic(t.k)}</div>`;
  };
  const answer = mini.final && !s ? (mini.final.by === turn ? '' : 'Last turn to answer!') : '';
  const say = s ? (s.again ? ['Uncovered! Go again', 'ok'] : null) : null;
  const line = say ? `<p ${lateAt('mjline ' + say[1], MAHJ.lift + MAHJ.fly)} role="status">${say[0]}</p>` : `<p class="mjline${answer ? ' warn' : ''}">${answer}</p>`;
  const take = claim ? `<button class="big ${turn} mjtake" data-act="move" ${mv([0, 1])}>Take the square</button>` : '';
  return `<div class="g-mj pc-${who}" style="--tl:${MAHJ.lift}ms;--tf:${MAHJ.fly}ms"><div class="ctals two">${tal('X')}${tal('O')}</div><div class="mjbox"><div class="mjlay" style="--cols:${cols};--rows:${rows};--zs:${zs}">${tiles.map(tile).join('')}</div>${take}</div>${line}</div>`;
}
export function heldSub(mini, turn, f, a) { return f ? '' : `<b class="${turn}">${N(turn)}</b> goes again`; }
// The miniature: a little stack of tiles, over each player's pairs cleared as a bar.
export function miniature(mini, final) {
  const c = mahjCfg(mini), k = mini.lay.X[0] ? mini.lay.X[0].k : 0;
  const art = `<div class="tmj"><i class="a">${mjPic(k + 1)}</i><i class="b">${mjPic(k + 2)}</i><i class="c">${mjPic(k)}</i></div>`;
  return thumbArt(art, barRows(mini.got, c.goal), 'tmjw col', `Mahjong: X ${mini.got.X}, O ${mini.got.O} of ${c.goal} pairs`);
}
export function moveText(f, who) { return f.note === 'unanswered' || f.note === 'held' ? `${who} keeps the lead` : `${who} cleared a pair`; }
// The two tiles clacking together as they lift, a swish as they go; a chime when the pair uncovers a tile.
export function sounds(f, add, won, mini, last) {
  const s = f.mj; if (!s || s.i < 0) return;
  add('mjClack', 0); add('mjOff', MAHJ.lift);
  if (s.again) add('ding', MAHJ.lift + MAHJ.fly); else add('pop', MAHJ.lift + MAHJ.fly);
}
