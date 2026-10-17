// Odd One Out: the screen, the miniature, the move's words and sounds, and the inputs.
import { ODD, setOddConfig } from './rules.js';
import { SND } from '../../audio/sound.js';
import { FIREBASE_CONFIG, configured } from '../../net/connect.js';
import { attemptMove } from '../../net/moves.js';
import { blocked } from '../../net/room.js';
import { N, REDUCED, cpuPlays, mv, state, zoomedType } from '../../ui/app.js';
import { CROSS } from '../../ui/art.js';
import { KEY } from '../../ui/config.js';
import { fxAttr } from '../../ui/fx.js';
import { arcTally, lateAt, pips } from '../../ui/progress.js';
import { render } from '../../ui/render.js';

// Odd One Out's shade differences (config/oddone, the admin's dashboard): likewise.
const ODD_CFG_KEY = KEY + '.oddcfg';
export function fetchOddConfig() {
  try { const v = JSON.parse(localStorage.getItem(ODD_CFG_KEY) || 'null'); if (v && typeof v === 'object') setOddConfig(v); } catch (e) { /* none kept */ }
  if (!configured()) return;
  const hook = window.TTT_FIREBASE, c = (hook && hook.config) || FIREBASE_CONFIG;
  const url = hook && hook.emulator ? `http://${hook.emulator.host}:${hook.emulator.port}/config/oddone.json?ns=${c.projectId}-default-rtdb` : `${c.databaseURL}/config/oddone.json`;
  try {
    fetch(url).then(r => (r.ok ? r.json() : null)).then(v => {
      if (!v || typeof v !== 'object') return;
      setOddConfig(v);
      try { localStorage.setItem(ODD_CFG_KEY, JSON.stringify(v)); } catch (e) { /* no storage: read again next visit */ }
    }).catch(() => {});
  } catch (e) { /* offline: as last known */ }
}
// Odd One Out: the grid waits greyed, with a Reveal button. Reveal shows the shades and starts the
// 5 seconds (a bar runs down): a tap is the move, and no tap in time counts as wrong. From Reveal the
// player stays in the square (no Board button) until the pick goes in; a reload carries on the same
// countdown. Someone else's pick (the computer's, the other phone's) plays as their screen did: the grey
// grid, the shades, a short pause, their pick. After a pick the odd tile is ringed and a wrong one
// crossed, and nothing on the board moves.
const ODD_KEY = 'ttt-odd-revealed';
let oddDraft = null;                                           // { id, sq, at, timer }: the reveal under way (at: Date.now(), so a reload carries on the countdown)
const oddId = (sq, p) => `${state.online ? state.online.matchId || state.online.code || 'on' : 'local'}:${state.moves}:${sq}:${p}:${state.squares[sq].mini.finds[p]}:${state.squares[sq].mini.grid[p].base}`;
export function oddPre(f) { return f && f.type === 'oddone' && f.odd && !f.timeout && !REDUCED && (state.online ? f.by !== state.online.me : cpuPlays(f.by)) ? ODD.show + ODD.pause : 0; }   // someone else's pick: the reveal and the pause play first
export const oddPinned = () => !!(oddDraft && state.screen === 'mini' && state.zoom === oddDraft.sq && !state.flash);
function oddArm() {                                            // the countdown's end: no pick in time is a wrong one
  if (!oddDraft) return;
  clearTimeout(oddDraft.timer);
  const id = oddDraft.id;
  oddDraft.timer = setTimeout(function out() {
    if (!oddDraft || oddDraft.id !== id || state.flash || state.done) return;
    if (blocked()) { oddDraft.timer = setTimeout(out, 400); return; }
    clearTimeout(oddDraft.timer); oddDraft = null; attemptMove('auto');
  }, Math.max(0, oddDraft.at + ODD.secs * 1000 - Date.now()));
}
function oddTable(mini, a, o) {
  const d = a && a.odd ? a.odd : null, l = mini.last, turn = o.turn, pre = d ? oddPre(a) : 0;
  const tal = p => arcTally(p, o, pips(p, Math.min(ODD.goal, mini.finds[p]), ODD.goal, d && d.correct && a.by === p, pre + 250));
  const shown = d || (o.done || o.view ? l : null);
  const mine = !o.view && !shown && !o.locked;                  // this phone's pick to make
  if (!mine) { if (oddDraft) clearTimeout(oddDraft.timer); oddDraft = null; }
  else {
    const id = oddId(o.zoom, turn);
    if (oddDraft && oddDraft.id !== id) { clearTimeout(oddDraft.timer); oddDraft = null; }
    if (!oddDraft) { let v = null; try { v = JSON.parse(localStorage.getItem(ODD_KEY) || 'null'); } catch (e) { /* none kept */ } if (v && v.id === id && Number.isFinite(v.at)) { oddDraft = { id, sq: o.zoom, at: v.at }; oddArm(); } }
  }
  const open = mine && !!oddDraft;
  const grid = shown ? { n: shown.n, tiles: shown.tiles } : mini.grid[turn], n = grid.n;
  const tiles = grid.tiles.map((c, k) => {
    let cls = 'otile', mark = '';
    if (shown) { if (k === shown.pos) cls += ' odd'; else if (k === shown.picked) { cls += ' wrong'; mark = `<i class="ox">${CROSS}</i>`; } }
    if (pre && k === shown.picked) cls += ' picked';
    const cover = !shown && !open ? '<i class="ocv"></i>' : pre ? `<i class="ocv tu" style="--u:${ODD.show}ms"></i>` : '';
    return `<button class="${cls}" style="background:${c}${shown ? `;--t:${pre + 250}ms;--p:${pre}ms` : ''}" data-act="move" ${mv(k)} aria-label="Tile ${k + 1}"${open && !o.locked ? '' : ' disabled'}>${cover}${mark}</button>`;
  }).join('');
  const who = d ? a.by : shown ? l.by : turn, W = p => `<b class="${p}">${N(p)}</b>`;
  const startPerf = open ? performance.now() - (Date.now() - oddDraft.at) : null;
  const res = d ? `<p ${lateAt('arcres ' + (d.correct ? 'ok' : 'no'), pre + 250)} role="status">${pre ? `${W(who)} ${d.correct ? 'found it' : d.picked < 0 ? 'ran out of time' : 'missed it'}` : d.correct ? 'Found it!' : d.picked < 0 ? 'Out of time' : 'Not that one'}</p>`
    : shown ? `<p class="arcres ${shown.correct ? 'ok' : 'no'}">${W(who)} ${shown.correct ? 'found it' : 'missed it'}</p>`
    : open ? `<p class="arcnote onote"${fxAttr(startPerf)}><span class="obar"><i style="--d:${ODD.secs * 1000}ms"></i></span></p>`
    : mine ? '<p class="arcnote"></p>'
    : `<p class="arcnote">${o.view ? '' : `${W(who)}'s turn`}</p>`;
  const go = mine && !open;
  const btn = o.view ? '' : `<div class="cbtns one${go ? '' : ' hold'}"><button class="big" data-act="odd-reveal"${go ? '' : ' disabled tabindex="-1" aria-hidden="true"'}>Reveal</button></div>`;   // the row stays (hidden) so the grid never moves
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="odd"><div class="ogrid${!shown && !open ? ' wait' : ''}" style="grid-template-columns:repeat(${n}, 1fr)">${tiles}</div>${res}</div>${btn}</div>`;
}
export function miniature(mini, final) {
  return `<div class="tpip">${['X', 'O'].map(p => `<div class="tr ${p}"><b class="${p}">${p}</b>${Array.from({ length: ODD.goal }, (_, k) => `<i class="${k < mini.finds[p] ? 'on' : ''}"></i>`).join('')}</div>`).join('')}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = oddTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
export function moveText(f, who) {
  return f.odd ? `${who} ${f.odd.correct ? 'found the odd one' : 'missed it'}` : `${who} tapped`;
}
export function sounds(f, add, won, mini, last) {
  const pre = oddPre(f); if (pre) { add('reveal', ODD.show); if (f.odd.picked >= 0) add('tap', pre); } if (f.odd) add(f.odd.correct ? 'ding' : 'thud', pre + 250); return;
}
// Odd One Out: the shades show and the 5 seconds start; from now the player stays in the square until the pick goes in
export function oddRevealAct(el, e, act) {
  if (zoomedType() !== 'oddone' || oddDraft || state.flash || state.done || blocked()) return;
  const id = oddId(state.zoom, state.turn), at = Date.now();
  oddDraft = { id, sq: state.zoom, at };
  try { localStorage.setItem(ODD_KEY, JSON.stringify({ id, at })); } catch (err) { /* no storage */ }
  oddArm(); SND.play('reveal'); render();
}
// Its own controls (data-act): the page's click handler hands them here.
export const actions = { 'odd-reveal': oddRevealAct };
