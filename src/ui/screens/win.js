// The end of a match: the win, loss and draw screens.
import { playerName } from '../../core/match.js';
import { other } from '../../core/util.js';
import { connected } from '../../net/connect.js';
import { findOn, isMM } from '../../net/matchmaking.js';
import { room } from '../../net/room.js';
import { N, esc, save, state } from '../app.js';
import { toonT } from '../art.js';
import { RATINGS_ENABLED } from '../config.js';
import { record, signed } from './profile.js';
import { netBar } from '../turnbar.js';

/* ----- win screen ----- */
// The match-end message: one picked at random per match, from the winner's, the loser's or the tie list,
// as this phone sees it; kept in the state so it does not change while the screen is up.
const END_MSGS = {
  win: ['WINNER!', 'CHAMPION!', 'UNSTOPPABLE!', 'VICTORY!', 'TOTAL DOMINATION!', 'MASTER OF CHAOS!'],
  loss: ['BETTER LUCK NEXT TIME', 'SO CLOSE…', 'OUTPLAYED', 'DEFEATED', 'CHAOS WON THIS ONE', 'REMATCH?'],
  tie: ["IT'S A TIE!", 'STALEMATE', 'DEAD EVEN', 'NOBODY WINS', 'EVENLY MATCHED', 'CALL IT A DRAW'],
};
export function endKind() {                                         // { list, name }: whose perspective, and whether to name the winner
  const w = state.winner;
  if (w !== 'X' && w !== 'O') return { list: 'tie', name: null };
  if (state.online) return { list: w === state.online.me ? 'win' : 'loss', name: null };
  if (state.cpu && state.cpu.length === 1) return { list: state.cpu === w ? 'loss' : 'win', name: null };   // a person against the computer
  return { list: 'win', name: playerName(state, w) };      // two people on one phone, or the computer against itself: name the winner
}
function endMessage() {
  const k = endKind(), msgs = END_MSGS[k.list];
  if (!(state.endPick && state.endPick.list === k.list && Number.isInteger(state.endPick.i) && state.endPick.i < msgs.length)) {
    state.endPick = { list: k.list, i: Math.floor(Math.random() * msgs.length) };
    save();
  }
  return { list: k.list, text: msgs[state.endPick.i], name: k.name };
}
// The message in a burst: a line for the name, the message wrapped to short lines, the type sized to fit.
function endBurst(m) {
  const words = m.text.split(' '), lines = [];
  for (const wd of words) { const last = lines[lines.length - 1]; if (last && (last + ' ' + wd).length <= 11) lines[lines.length - 1] = last + ' ' + wd; else lines.push(wd); }
  if (m.name) lines.unshift(m.name.toUpperCase() + ' —');
  const W = 300, H = 150 + (lines.length - 1) * 34;
  const longest = Math.max(...lines.map(l => l.length));
  const size = Math.round(Math.min(50, (W * 0.6) / (longest * 0.62), (H * 0.6) / (lines.length * 1.05)));
  let seed = m.text.length * 31 + lines.length;
  const r = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const pts = [];
  for (let k = 0; k < 28; k++) {
    const a = k * Math.PI / 14 - Math.PI / 2, f = k % 2 === 0 ? 0.88 + r() * 0.12 : 0.66 + r() * 0.08;
    pts.push(`${(W / 2 + Math.cos(a) * (W / 2 - 3) * f).toFixed(1)},${(H / 2 + Math.sin(a) * (H / 2 - 3) * f).toFixed(1)}`);
  }
  const top = H / 2 - (lines.length - 1) * size * 0.525 + size * 0.36;
  const cls = m.list === 'loss' ? 's' : m.list === 'tie' ? 'r' : 'y';
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(lines.join(' '))}"><polygon class="bst ${cls}" points="${pts.join(' ')}"/><text class="bursttxt" font-size="${size}" text-anchor="middle">${lines.map((l, i) => `<tspan x="${W / 2}" y="${(top + i * size * 1.05).toFixed(1)}">${esc(l)}</tspan>`).join('')}</text></svg>`;
}
// A matchmaking game's results: both records after the game (the rating change too, with ratings on) and a
// way to the opponent's profile.
function mmResult() {
  if (!isMM() || !room || !room.pub) return '';
  const pub = room.pub, me = state.online.me, opp = pub.players[other(me)];
  const recs = pub.result && pub.result.records;
  let r = '';
  if (RATINGS_ENABLED && pub.mode === 'ranked') {
    const x = pub.result && pub.result.ratings && pub.result.ratings[me];
    r = x ? `<p class="rchg ${x.delta >= 0 ? 'up' : 'down'}"><b>${signed(x.delta)}</b> Rating ${x.after}</p>` : '<p class="rchg wait">Updating ratings…</p>';
  }
  const mine = recs ? `<p class="rchg rrec">Your record <b>${record(recs[me])}</b></p>` : pub.recorded && pub.recorded.done ? '' : '<p class="rchg wait">Updating records…</p>';   // (a game that ended before records: nothing to wait for)
  return `<div class="mmres">${r}${mine}<p class="vs">vs <button class="link opp" data-act="profile" data-uid="${esc(opp.uid)}">${esc(opp.name)}</button>${recs ? ` <small class="orec">${record(recs[other(me)])}</small>` : ''}</p></div>`;
}
// The buttons that start another match: Find Match again after a matchmaking game; a friend room's Rematch,
// which both players have to tap (the requester waits, and can cancel); a local match's Rematch.
function againBtns() {
  if (isMM()) return findAgainBtn();
  if (!state.online) return '<button class="primary" data-act="rematch">Rematch</button>';
  if (!room || room.status === 'over' || room.left) return '';   // the room closed, or the other player left: no rematch
  const me = state.online.me, rm = room.rematch || {};
  if (rm[me]) return `<button class="primary" disabled>Waiting for ${esc(N(other(me)))}…</button><button class="btn" data-act="rematch-cancel">Cancel</button>`;
  const bub = rm[other(me)] ? `<span class="rmbub" aria-live="polite">${esc(N(other(me)))} wants a rematch</span>` : '';   // their request, in a bubble under the button
  return `<span class="rmwrap"><button class="primary" data-act="rematch"${!connected ? ' disabled' : ''}>Rematch</button>${bub}</span>`;
}
// Under the buttons, in a friend room: the line the rematch bubble hangs into (always there, so nothing moves).
function rematchNote() {
  if (!state.online || isMM() || !room || room.status === 'over' || room.left) return '';
  return '<div class="rmline"></div>';
}
export function renderWin() {
  const w = state.winner;
  if (w === 'draw') return renderDraw();
  const why = state.winReason === 'line' ? 'Three squares in a row'
    : state.winReason === 'timeout' ? `${N(other(w))} forfeited — 2 missed turns`
    : state.winReason === 'resign' ? `${N(other(w))} left the match`
    : `Most squares: ${state.counts[w]} to ${state.counts[other(w)]}`;
  const final = state.squares.map((s, i) =>
    `<i class="${s.owner || ''}${state.winLine && state.winLine.includes(i) ? ' hl' : ''}">${s.owner ? toonT(s.owner) : ''}</i>`
  ).join('');
  return `<main class="scr win-scr">${netBar()}<div class="win-card${isMM() ? ' mm' : ''}">
    <div class="winburst">${endBurst(endMessage())}</div><div class="big-g ${w}">${toonT(w)}</div><h1>${state.winReason === 'timeout' ? `${N(w)} wins` : state.winReason === 'resign' ? `${N(w)} wins — ${why}` : `${N(w)} wins the match!`}</h1><p>${state.winReason === 'timeout' ? why : state.winReason === 'resign' ? 'Leaving a match counts as a loss' : why}</p>${mmResult()}
    <div class="final" aria-hidden="true">${final}</div>
    <div class="row">${againBtns()}<button class="btn" data-act="review">View board</button><button class="btn" data-act="${state.online ? 'leave' : 'menu'}">Main menu</button></div>${rematchNote()}</div></main>`;
}


// A Find Match game's results: another one, or the button greyed while Find Match is switched off.
function findAgainBtn() { return findOn ? '<button class="primary" data-act="find-again">Find Match</button>' : '<button class="primary off" disabled>Find Match<small>Not available at this time</small></button>'; }
// A draw: once neither player could still make three in a row, the match ended there.
function renderDraw() {
  const final = state.squares.map(s => `<i class="${s.owner || ''}">${s.owner ? toonT(s.owner) : ''}</i>`).join('');
  return `<main class="scr win-scr">${netBar()}<div class="win-card${isMM() ? ' mm' : ''}">
    <div class="winburst">${endBurst(endMessage())}</div><div class="big-g both">${toonT('X')}${toonT('O')}</div><h1>It's a draw!</h1><p>${state.winReason === 'both' ? 'Both made three in a row in the same round' : state.winReason === 'timeout' ? 'Both missed two rounds in a row' : 'Nobody could get three in a row any more, so the match ended there'}</p>${mmResult()}
    <div class="final" aria-hidden="true">${final}</div>
    <div class="row">${againBtns()}<button class="btn" data-act="review">View board</button><button class="btn" data-act="${state.online ? 'leave' : 'menu'}">Main menu</button></div>${rematchNote()}</div></main>`;
}
