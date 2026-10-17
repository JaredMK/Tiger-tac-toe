// The turn bar: whose turn, the clock, the network state.
import { other } from '../core/util.js';
import { connected } from '../net/connect.js';
import { REACTS, reactCooling, reactOn, rx } from '../net/reactions.js';
import { awayNote, net, presence, room } from '../net/room.js';
import { N, NAV_SCREENS, esc, menuOpen, state } from './app.js';
import { toon } from './art.js';
import { scTurnText } from './chaos.js';
import { clockText } from './clock.js';
import { fx, fxAt, fxAttr, startFx } from './fx.js';

// The game screen's top: a slim row with Menu and the clock in its own fixed box, then the turn bar:
// X and O with their names on each side (the player on the move bouncing gently), and whose turn it is.
export function renderHeader() {
  if (['setup', 'menu', 'online', 'friend', 'join', 'win'].includes(state.screen) || NAV_SCREENS.includes(state.screen)) return '';   // (the match-end screen: its one menu button is at the bottom)
  const won = state.winner && !state.spot;                      // (a winning move about to be played back: not yet)
  const drawn = won && state.winner === 'draw';                  // a draw: nobody can make a line any more
  const t = won && !drawn ? state.winner : state.turn;
  const sc = !!state.sc && !state.online;                        // Super Chaos: the round and the round's clock
  const clock = sc ? `<span class="clock" id="clock" aria-label="Time left this round">${clockText()}</span>`   // (kept to the results screen: the bar never changes shape)
    : state.timer && state.timer.limit && !state.winner ? `<span class="clock" id="clock" aria-label="Time left this turn">${clockText()}</span>` : '';
  // the reaction bubble hangs by the sender's character; the bubble is always there (hidden when empty), so the bar's shape stays the same
  const card = p => (rx.card && rx.card.side === p && !menuOpen ? rx.card : null);   // (not over the in-game menu)
  const side = p => `<div class="tside ${p}${p === t ? ' on' : ''}"><span class="tg">${toon(p)}<span class="rbub${card(p) ? ' on' : ''}"${card(p) ? fxAttr(card(p).at) : ''} aria-live="polite">${card(p) ? card(p).e : ''}</span></span><b class="nm">${N(p)}</b></div>`;
  const cool = reactCooling();
  const react = reactOn() ? `<button class="rbtn" data-act="react-open" aria-label="Send a reaction" aria-expanded="${rx.tray}"${cool ? ' disabled' : ''}>💬</button>` : '';
  const tray = reactOn() && rx.tray && !menuOpen ? `<div class="rtray" role="group" aria-label="Send a reaction">${REACTS.map(([em, nm], i) => `<button data-act="react-send" data-i="${i}" aria-label="${nm}"${cool ? ' disabled' : ''}>${em}</button>`).join('')}</div>` : '';
  return `<header class="hdr t-${t}${clock ? ' has-clock' : ''}">
    <div class="hdrrow"><button class="menubtn" data-act="pause" aria-label="Menu">Menu</button><div class="tbar">${side('X')}${side('O')}</div>${react}</div>
    <div class="hdrrow2"><div class="turn" aria-live="polite">${drawn ? `<span class="who">Draw · ${state.winReason === 'both' ? 'both made a line' : 'no line left'}</span>` : won ? `<span class="g">${t}</span><span class="who">${N(t)} wins</span>` : sc ? scTurnText() : `<span class="g">${t}</span><span class="who">${N(t)}<i class="suf">'s turn</i></span>`}</div><span class="clockbox">${clock}</span></div>${tray}
  </header>`;
}

// The connection banner during online play: nothing while all is well. It pops in when what it says
// changes (noteNet, called where the connection, the other player's presence or a note change).
function netInfo() {
  const o = state.online;
  if (!o) return null;
  if (net.status === 'error') return { cls: 'error', html: `${esc(net.msg)} <button class="btn" data-act="leave">Leave game</button>` };
  if (net.status === 'connecting') return { cls: 'connecting', html: esc(net.msg || 'Connecting…') };
  if (!connected) return { cls: 'lost', html: 'Reconnecting…' };
  if (awayNote) return { cls: 'note', html: esc(awayNote) };
  if (o.me && o.joined && room && room.status === 'playing' && !state.winner && presence) {   // (presence null: not read yet)
    const them = other(o.me), p = presence[them];
    if (!p || !p.online || p.away) return { cls: 'away', html: `${N(them)} is away` };
  }
  return null;
}
export function noteNet() { const b = netInfo(), k = b ? b.cls + ':' + b.html : null; if (k && !(fx.net && fx.net.key === k)) startFx('net', k); }
export function netBar() {
  const b = netInfo();
  return b ? `<div class="netbar ${b.cls}" role="status"${fxAttr(fxAt('net', b.cls + ':' + b.html))}>${b.html}</div>` : '';
}
