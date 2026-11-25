// Hot Potato: the screen, the miniature, the move's words and sounds, and the bomb's ticks on the board.
// The square: a table split in two, each player's half with their token and name; the bomb sits on the holder's half
// (in the middle before the first toss), its fuse lit; under it the tick count and the next tick's chance; the
// reserved line; Toss (the holder's colour; anyone's before the first toss). A toss: the bomb arcs over to the other
// half (HPT.toss) and lands with a wobble.
// The board: the miniature shows the bomb over the holder's mark and the next tick's chance. After every board turn
// the bomb ticks (core/board.js tickBombs): it shakes with its fuse flaring (HPT.tick), then either settles or BOOMs (a
// comic burst over the square, HPT.boom; the square then stamps in for the other player as any claim does). The tick is
// timed from the moment this phone's board first shows it (boardWatch, called before each render: ui/render.js), once: a re-render
// never starts it again, a reload or a first look at a match shows it at rest.
import { HPT, canMove, hpCfg, hpChance } from './rules.js';
import { N, mv, state } from '../../ui/app.js';
import { fxAttr, zoomLeft } from '../../ui/fx.js';
import { lateAt } from '../../ui/progress.js';
import { thumbArt, tokSvg } from '../../ui/thumbs.js';
import { tok } from '../../ui/tok.js';
import { SND } from '../../audio/sound.js';
import { dur } from '../../core/timer.js';

export const ownLine = true;
// The bomb (original drawing): a round ink body with a highlight, a cap, a curled fuse and its spark.
const BOMB = `<g class="hpbody"><circle class="hpball" cx="0" cy="4" r="15"/><path class="hpshine" d="M-8 -3a10 10 0 0 1 7-6"/><rect class="hpcap" x="-5" y="-14" width="10" height="6" rx="1.6"/><path class="hpfuse" d="M0 -14c1-5 6-6 8-3s5 1 6-3"/></g><g class="hpspark" transform="translate(14 -21)"><path d="M0 -6L1.6 -1.6 6 0 1.6 1.6 0 6 -1.6 1.6 -6 0 -1.6 -1.6Z"/></g>`;
export const bombSvg = cls => `<svg class="hpbomb${cls ? ' ' + cls : ''}" viewBox="-22 -30 44 52" aria-hidden="true">${BOMB}</svg>`;
// The comic BOOM burst (the same jagged star as the board's bursts, its own drawing).
const BURST = '<path class="hpburst" d="M0 -30L7 -14 24 -22 15 -6 30 2 13 7 19 25 3 14 -6 29 -9 12 -27 18 -15 3 -29 -8 -12 -9 -18 -25 -3 -14Z"/>';
// A tick first seen on this phone's board: when (key: the tick's own number and roll, unique to it). seen: false until
// the first scan of a match (that one is quiet: the bombs as they stand, no animation, no sound).
const TICKS = new Map();
let scanned = null;
const tickKey = m => (m.tick ? `${m.tick.n}:${m.tick.roll}:${m.tick.holder}` : null);
export function boardWatch() {
  const id = state.id || 'm', sqs = state.squares || [];
  if (scanned !== id) {                                             // a match looked at for the first time here: everything at rest
    scanned = id; TICKS.clear();
    sqs.forEach(s => { if (s && s.mini && s.mini.type === 'hot-potato' && s.mini.tick) TICKS.set(tickKey(s.mini), -Infinity); });
    return;
  }
  if (state.screen !== 'board') return;                            // (the board shows it: a tick during a move's result waits for the board)
  for (const s of sqs) {
    if (!s || !s.mini || s.mini.type !== 'hot-potato' || !s.mini.tick) continue;
    const k = tickKey(s.mini);
    if (TICKS.has(k)) continue;
    const z = zoomLeft(), at = performance.now() + z;
    TICKS.set(k, at);
    SND.play('hpTick', { at: z / 1000 });
    if (s.mini.tick.boom) SND.play('hpBoom', { at: (z + dur(HPT.tick)) / 1000 });
  }
}
const tickAt = m => { const at = TICKS.get(tickKey(m)); return at == null || !Number.isFinite(at) ? null : at; };
const nextPct = m => hpChance(m.n + 1, hpCfg(m));
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const s = a && a.hp ? a.hp : null, h = mini.holder, boom = mini.boom;
  const may = !view && !boom && canMove(mini, turn);
  const side = p => `<div class="hpside ${p}${h === p ? ' hold' : ''}${boom && boom.holder === p ? ' lost' : ''}">${tok(p)}<b class="${p} hpnm">${N(p)}</b></div>`;
  const at = s ? `fly from${s.by} to${s.to}` : h ? 'at' + h : 'mid';
  const bomb = boom ? `<div class="hpboom">${`<svg viewBox="-32 -32 64 64" aria-hidden="true">${BURST}</svg>`}<b>BOOM!</b></div>` : `<div class="hpwhere ${at}">${bombSvg(s ? 'toss' : '')}</div>`;
  const words = boom ? 'BOOM!' : s ? `Tossed to ${N(s.to)}!` : '';   // (the square's winner is the header's to say: ui/mini.js)
  const line = s ? `<p ${lateAt('hpline', HPT.toss)} role="status">${words}</p>` : `<p class="hpline">${words}</p>`;
  const info = `<div class="hpinfo${boom ? ' gone' : ''}"><span class="hpchip">Tick <b>${mini.n}</b></span><span class="hpchip${mini.holder ? '' : ' off'}">Next <b>${nextPct(mini)}%</b></span></div>`;
  const btn = view ? '' : `<div class="cbtns one"><button class="big ${turn} hpgo" data-act="move" ${mv('toss')}${!may || locked ? ' disabled' : ''}>Toss!</button></div>`;
  return `<div class="g-hp"><div class="hptable">${side('X')}${side('O')}${bomb}</div>${info}${line}${btn}</div>`;
}
// The miniature: the two marks at the foot of a little table, the bomb over the holder's (in the middle before the
// first toss; a burst once it has gone off) and the next tick's chance beside it.
export function miniature(mini, final) {
  const h = mini.holder, x = h === 'X' ? 27 : h === 'O' ? 73 : 50, t = mini.tick, at = tickAt(mini);
  const boom = mini.boom;
  const tk = !final && at != null ? ` class="hptk${t && t.boom ? ' bm' : ''}"${fxAttr(at)}` : '';
  const bombG = boom ? `<g class="hpmboom" transform="translate(${boom.holder === 'X' ? 27 : 73} 36) scale(1.2)">${BURST}</g>` : `<g transform="translate(${x} 37) scale(1.18)"><g${tk}>${BOMB}</g></g>`;
  const art = `<svg class="thp" viewBox="0 0 100 88">${tokSvg('X', 24, 76, 11)}${tokSvg('O', 76, 76, 11)}${bombG}</svg>`;
  const rows = boom ? `<div class="hppct boom">BOOM</div>` : `<div class="hppct">${h ? nextPct(mini) + '%' : '—'}</div>`;
  return thumbArt(art, rows, 'thpw', `Hot Potato: ${boom ? `exploded on ${boom.holder}` : h ? `${h} holds the bomb, next tick ${nextPct(mini)}%` : 'nobody holds the bomb yet'}`);
}
export function moveText(f, who) { return f.hp ? `${who} tossed the bomb` : `${who} played`; }
export function sounds(f, add) { if (f.hp) add('hpToss', 0); }
