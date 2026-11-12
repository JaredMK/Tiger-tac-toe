// Shut the Box: the screen, the miniature, the move's words and sounds, and the inputs.
import { SHUT, shutCfg, shutDice, shutN, shutSum, shutTimes, shutWays } from './rules.js';
import { SND } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { N, mv, state, waitLine, zoomedType } from '../../ui/app.js';
import { DIE_BOUNCE, die3d } from '../../ui/dice.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { render } from '../../ui/render.js';
import { markSvgG } from '../../ui/thumbs.js';

// One wooden box for the two players: X's rail of tiles along its top, O's along its bottom (each with its owner's
// plate and colour, the one on the move lit, the other dimmed), the felt between them where the dice are thrown. A
// tile stands on its hinge (its number facing the player) or lies shut in front of it (its back, in its owner's
// colour; its number stays engraved behind). Roll throws the dice onto the felt (the shared 3-D die): they land, the
// total pops beside them with a pip for each point, and the open tiles that can still make it light up while the
// others dim. A tap picks a tile (its pips fill; the move goes in the moment the picks add up to the roll, so a pick
// never needs a second button): the tiles then fall shut one after the other, a clack each. No tiles make the roll:
// the total is struck out and the rail shakes. The last tile shut: the lid comes down over the rail.
// Everything is timed from the move (rules.js shutTimes, SHUT_T below) and has its room from the start: nothing moves.
// (Reduced motion: the stylesheet plays none of it, each thing shown as it ends up.)
export const SHUT_T = { no: 120, clack: 0.78, lid: 60, lidMs: 420 };   // no: the struck total after a roll nothing makes lands (ms); clack: a falling tile meets the box (a share of SHUT.flipMs); lid: the lid starts after the last tile, and takes lidMs
let draft = null;                                                  // this phone's pick: { sq, key, sel: [tile numbers] }
const keyOf = (mini, sq) => `${sq}:${mini.roll ? mini.roll.by + mini.rolls[mini.roll.by] : '-'}`;
const picked = (mini, sq) => (draft && draft.sq === sq && draft.key === keyOf(mini, sq) ? draft.sel : []);
// The open tiles a pick can still take: every tile of a way to make `total` that holds the ones picked so far.
export function shutCan(up, total, sel) {
  const can = new Set();
  for (const w of shutWays(up, total)) if (sel.every(n => w.includes(n))) for (const n of w) can.add(n);
  return can;
}
// A rail: its owner's plate, its tiles, and its lid once every tile is down. (Only the rail being picked from carries
// the tiles' data-act: a replayed press is shown on the first control with its act and value, ui/replay.js repMark.)
function rail(mini, p, o) {
  const up = mini.up[p], s = o.s, tim = shutTimes(s), flipNow = s && s.kind === 'flip' && o.by === p ? s.tiles : [];
  const shut = !up.some(Boolean);
  const tiles = up.map((u, k) => {
    const n = k + 1, fl = flipNow.indexOf(n), on = o.sel.includes(n);
    const t = fl >= 0 ? tim.flipAt(fl) : null;
    const pick = !!o.can && u, ok = pick && o.can.has(n);
    const cls = `shxt ${u ? 'up' : 'dn'}${t != null ? ' flip' : ''}${on ? ' sel' : ''}${pick ? (ok ? ' can' : ' off') : ''}${pick && o.soon != null ? ' soon' : ''}`;
    return `<button class="${cls}"${o.can ? ' data-act="shtile"' : ''} data-v="${n}"${t != null ? ` style="--t:${t}ms"` : ''} aria-label="Tile ${n}${u ? (pick && !ok ? ', cannot make the roll' : on ? ', picked' : '') : ', shut'}"${pick && o.tap ? (ok ? '' : ' aria-disabled="true"') : ' disabled tabindex="-1"'}><i class="shxw"><b>${n}</b></i><i class="shxu"><b>${n}</b></i><i class="shxd"></i></button>`;
  }).join('');
  const closing = shut && flipNow.length;
  const lid = shut ? `<i ${lateAt('shxlid', closing ? tim.end - SHUT.hold + SHUT_T.lid : null, 'close')} aria-hidden="true"><u></u></i>` : '';
  const nope = s && s.kind === 'roll' && s.none && o.by === p;
  return `<div class="shxrail ${p}${o.now === p ? ' now' : o.now ? ' rest' : ''}${nope ? ' nope' : ''}${shut ? ' shut' : ''}" style="--n:${up.length};--land:${SHUT.land}ms${nope ? `;--no:${SHUT.land + SHUT_T.no}ms` : ''}"><span class="shxpl"><svg viewBox="-10 -10 20 20" role="img" aria-label="${p}'s tiles">${markSvgG(p, 6.2)}</svg></span><div class="shxrow">${tiles}</div>${lid}</div>`;
}
function shutTable(mini, a, o) {
  const s = a && a.shut ? a.shut : null, held = !s && o.done && o.done.type === 'shut' && o.done.shut ? o.done.shut : null;   // the move playing; else the move made here, still on show
  const by = s ? a.by : held ? o.done.by : null, sq = o.zoom, n = shutN(mini), turn = o.turn, cfg = shutCfg(mini);
  const roll = mini.roll, mineRoll = roll && roll.by === turn && !o.view && !o.locked;
  const sel = mineRoll ? picked(mini, sq) : [];
  const tim = shutTimes(s), tumble = !!(s && s.kind === 'roll');
  // the tallies: a pip a tile shut, each filling as its tile meets the box
  const tal = p => {
    const dn = mini.up[p].filter(u => !u).length, m = s && s.kind === 'flip' && by === p ? s.tiles.length : 0;
    return arcTally(p, o, `<span class="pips" aria-label="${dn} of ${n}">${Array.from({ length: n }, (_, k) => `<i ${lateAt(k < dn ? 'on' : '', k < dn && k >= dn - m ? tim.flipAt(k - (dn - m)) + SHUT.flipMs * SHUT_T.clack : null, 'fillin')}></i>`).join('')}</span>`);
  };
  // the tiles a pick can take: this phone's mover picking now; while their roll plays, the same lit as the dice land
  const rollNow = s && s.kind === 'roll' && !s.none ? by : null, waiting = roll && !s && !o.view ? roll.by : null, picker = waiting || rollNow;   // (a roll waiting for its tiles: lit whoever is looking, tapped only by its roller's phone)
  const can = waiting ? shutCan(mini.up[waiting], shutSum(roll.d), sel) : rollNow ? shutCan(mini.up[rollNow], shutSum(s.d), []) : null;
  const now = o.view ? null : by || (roll ? roll.by : turn);
  const R = p => rail(mini, p, { s, by, now, sel: picker === p ? sel : [], can: picker === p ? can : null, tap: mineRoll, soon: rollNow && tumble ? SHUT.land : null });
  // the felt: the dice of the move on show (its own flash), else the roll waiting for its tiles, else (nothing rolled yet) the dice the mover is about to throw, blank
  const d = s ? s.d : held ? held.d : roll ? roll.d : o.view && mini.last && mini.last.d ? mini.last.d : null;
  const none = !!((s && s.none) || (held && held.none)), total = d ? shutSum(d) : null;
  const nd = d ? d.length : shutDice(mini.up[turn], cfg);
  const dice = Array.from({ length: nd }, (_, k) => die3d(d ? d[k] : null, { roll: tumble ? SHUT.land : 0, v: k })).join('');
  const got = d ? (s && s.kind === 'flip') || (held && held.kind === 'flip') ? total : shutSum(sel) : 0;   // the points of the roll the picked tiles make so far (a flip: all of them)
  const noAt = tumble && none ? SHUT.land + SHUT_T.no : null;
  const tot = d ? `<b ${lateAt(`shxtot${none ? ' no' : ''}`, tumble ? SHUT.land : null, 'pop')} aria-label="${total}">${total}${none ? `<i${noAt != null ? ' class="late"' : ''}></i>` : ''}</b>` : '<b class="shxtot none" aria-hidden="true"></b>';
  const pts = `<span class="shxpts${tumble ? ' late' : ''}" style="--land:${SHUT.land}ms" aria-hidden="true">${d && !none && !o.view ? Array.from({ length: total }, (_, k) => `<i class="${k < got ? 'on' : ''}"></i>`).join('') : ''}</span>`;
  const felt = `<div class="shxfelt${d ? '' : ' idle'}${none ? ' none' : ''}${none && noAt != null ? ' sad' : ''}"${noAt != null ? ` style="--no:${noAt}ms"` : ''} role="img" aria-label="${d ? `Rolled ${total}` : 'The dice'}"><div class="shxthrow"><span class="shxdice">${dice}</span>${tot}</div>${pts}</div>`;
  // the line: what the roll asks for, what the move did
  const said = s || held, late = !!s;
  let line;
  if (said && said.kind === 'roll') line = `<p ${lateAt('arcres ' + (said.none ? 'no' : ''), late ? SHUT.land : null)} role="status">${said.none ? `No tiles make ${shutSum(said.d)}` : `Make ${shutSum(said.d)}`}</p>`;
  else if (said && said.kind === 'flip') line = `<p ${lateAt('arcres ok', late ? tim.end - SHUT.hold : null)} role="status">${o.won ? 'Box shut!' : `Flipped ${said.tiles.join(' + ')}`}</p>`;
  else if (said && said.kind === 'drop') line = `<p class="arcres no" role="status">Time ran out</p>`;
  else if (roll && !o.view) line = `<p class="arcres">${roll.by === turn ? (sel.length ? `${shutSum(sel)} of ${shutSum(roll.d)}` : `Make ${shutSum(roll.d)}`) : waitLine(roll.by)}</p>`;
  else line = `<p class="arcnote">${o.view ? '' : o.locked ? waitLine(turn) : ''}</p>`;
  const canRoll = !o.view && !o.locked && !roll;
  const btn = o.view ? '' : `<div class="cbtns one"><button class="big ${turn}" data-act="move" ${mv('roll')}${canRoll ? '' : ' disabled'}>Roll</button></div>`;
  return `<div class="g-arc shut"><div class="ctals">${tal('X')}${tal('O')}</div><div class="shxbody"><div class="shxbox pc-${now || turn}">${R('X')}${felt}${R('O')}</div>${line}</div>${btn}</div>`;
}
// The miniature: both rails drawn as they stand (a wooden rail each, its owner's drawn mark at the left; a tile still
// up a tall light tile, a tile shut a low slab in its owner's colour in front of its dark place).
export function miniature(mini, final) {
  const n = shutN(mini), W = 100, tw = (W - 21) / n;
  const tray = (p, y) => `<g class="tshb ${p}"><rect class="tshw" x="15" y="${y}" width="${W - 15}" height="28" rx="4"/>${mini.up[p].map((u, k) => {
    const x = (18 + k * tw).toFixed(2), w = (tw - 2).toFixed(2);
    return u ? `<rect class="tsht" x="${x}" y="${y + 3}" width="${w}" height="22" rx="2"/>` : `<rect class="tshg" x="${x}" y="${y + 3}" width="${w}" height="22" rx="2"/><rect class="tsht on" x="${x}" y="${y + 15}" width="${w}" height="10" rx="2"/>`;
  }).join('')}<g transform="translate(7 ${y + 14})">${markSvgG(p, 5.5)}</g></g>`;
  const dn = p => mini.up[p].filter(u => !u).length;
  return `<svg class="tshut" viewBox="0 0 ${W} 64" aria-label="Shut the Box: X ${dn('X')}, O ${dn('O')} of ${n} tiles down">${tray('X', 1)}${tray('O', 35)}</svg>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = shutTable(mini, a, { view, locked, turn, zoom: state.zoom, done: a ? null : d, won: !!fresh }); return g;
}
export function moveText(f, who) {
  const s = f.shut;
  if (!s) return `${who} rolled`;
  if (s.kind === 'roll') return s.none ? `${who} rolled ${shutSum(s.d)}: no tiles make it` : `${who} rolled ${shutSum(s.d)}`;
  if (s.kind === 'flip') return `${who} flipped ${s.tiles.join(' + ')}`;
  return `${who} ran out of time`;
}
// A roll: the rattle, the dice's first touch of the felt and their landing (a buzz), and a slump as the total is struck
// when no tiles make it; a flip: a wooden clack as each tile meets the box, each a little lower than the one before (a
// buzz each, thinned by the haptics); the box shut: the lid's thump and a sparkle.
export function sounds(f, add, won, mini, last) {
  const s = f.shut;
  if (!s) return;
  if (s.kind === 'roll') { add('rattle', 0); add('diceTap', Math.round(SHUT.land * DIE_BOUNCE)); add('thunk', SHUT.land); if (s.none) add('diceLose', SHUT.land + SHUT_T.no); return; }
  if (s.kind === 'flip') {
    const t = shutTimes(s), lid = t.end - SHUT.hold + SHUT_T.lid;
    s.tiles.forEach((x, k) => add('domClick', Math.round(t.flipAt(k) + SHUT.flipMs * SHUT_T.clack), Math.max(0.7, Math.round(100 - k * 7) / 100)));
    if (won) { add('c4drop', Math.round(lid + SHUT_T.lidMs * 0.8), 0.7); add('sparkle', lid + SHUT_T.lidMs); }
  }
}
// A tile tapped: picked or put back; the pick goes in the moment it adds up to the roll. A tile that no way of making
// the roll takes with the ones picked is refused (the error sound).
function tileAct(el) {
  if (zoomedType() !== 'shut' || state.flash || state.done) return;
  const sq = state.squares[state.zoom], mini = sq && sq.mini;
  if (!mini || !mini.roll || mini.roll.by !== state.turn) return;
  const k = keyOf(mini, state.zoom);
  if (!draft || draft.sq !== state.zoom || draft.key !== k) draft = { sq: state.zoom, key: k, sel: [] };
  const n = Number(el.dataset.v), target = shutSum(mini.roll.d);
  if (!mini.up[state.turn][n - 1]) return;
  if (draft.sel.includes(n)) { draft.sel = draft.sel.filter(x => x !== n); SND.play('deselect'); render(); return; }
  if (!shutCan(mini.up[state.turn], target, draft.sel).has(n)) { SND.play('error'); return; }
  draft.sel = draft.sel.concat(n);
  if (shutSum(draft.sel) === target) { const m = draft.sel.slice().sort((x, y) => x - y); draft = null; attemptMove(m); return; }
  SND.play('select'); render();
}
// Someone else's pick replayed (ui/replay.js): their taps as they made them (a tile picked, a tile put back; a tap that
// was refused shows nothing), then the flip.
function replayInput(act, val, r) {
  if (act !== 'shtile' || !/^v=\d$/.test(val || '')) return false;
  const sq = state.squares && state.squares[r.sq], mini = sq && sq.mini;
  if (!mini || !mini.roll) return false;
  const k = keyOf(mini, r.sq);
  if (!draft || draft.sq !== r.sq || draft.key !== k) draft = { sq: r.sq, key: k, sel: [] };
  const n = Number(val.slice(2));
  if (draft.sel.includes(n)) { draft.sel = draft.sel.filter(x => x !== n); SND.play('deselect'); return true; }
  if (!shutCan(mini.up[mini.roll.by], shutSum(mini.roll.d), draft.sel).has(n)) return true;
  draft.sel = draft.sel.concat(n);
  SND.play('select');
  return true;
}
// The computer's moves (and a log that did not come): a roll is one press; a flip, its tiles picked one by one.
const replaySynth = m => (Array.isArray(m) ? m.map((n, k) => [k * 300, 'shtile', 'v=' + n]) : null);
export const replay = { input: replayInput, synth: replaySynth };
export const actions = { shtile: tileAct };
// The square's line while the turn is held to it (ui/mini.js): the roll waiting for its tiles, or a flip with "Go again
// on success" on (a new roll to come).
export function heldSub(mini, turn, f) {
  if (f) return '';
  return mini.roll && mini.roll.by === turn ? `<b class="${turn}">${N(turn)}</b> rolled ${shutSum(mini.roll.d)}` : `<b class="${turn}">${N(turn)}</b> flipped · goes again`;
}
