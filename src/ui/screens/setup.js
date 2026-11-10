// The setup screen: sides, names, the timer and the mini-game checklist.
import { scTypes } from '../../core/chaos.js';
import { SUPER_CHAOS_ENABLED } from '../../core/config.js';
import { restrictGames } from '../../core/games.js';
import { CPU_NAME, NAME_MAX, dealable, enabledGames, normCpu, normLocal } from '../../core/match.js';
import { LEVELS, LEVEL_NAME } from '../../core/aiw.js';
import { TPL_NAME_MAX, acct, deleteTemplate, loggedIn, renameTemplate, saveTemplate, templateList, templates } from '../../net/accounts.js';
import { CLOCK_INCS, CLOCK_MINS, TURN_SECS, setupSpec, specParts } from '../../core/timer.js';
import { other } from '../../core/util.js';
import { GAMES, INFO, NO_SAME_PHONE, SC_ONLY, TYPES } from '../../games/index.js';
import { connected } from '../../net/connect.js';
import { noticeSeq } from '../../net/moves.js';
import { chaosBadge, chaosVisible, scPicked, testBadge, visibleTypes } from '../../net/releases.js';
import { dbSetup, isHost, net, starting } from '../../net/room.js';
import { advOpen, app, esc, save, state } from '../app.js';
import { CHEV, ICONS, toonT } from '../art.js';
import { qBtn } from '../explainer.js';
import { fxAt, fxAttr } from '../fx.js';
import { render } from '../render.js';

/* ----- setup screen ----- */
// Super Chaos (simultaneous rounds) is on for the next match: its switch on (a friend room: the room's, set by the
// host), and the mode visible here (admin only until released). Its checklist holds only the Super Chaos games.
export const chaosSetup = () => (isHost() ? !!state.online.chaos && chaosVisible() : state.setup.vs === 'cpu' && scPicked());   // (Play Local: Super Chaos against the computer is always open; a host's room: only where the switch is on)
export const setupTypes = () => (chaosSetup() ? visibleTypes().filter(t => scTypes().includes(t)) : visibleTypes().filter(t => !SC_ONLY.includes(t) && !(samePhone() && NO_SAME_PHONE.includes(t))));   // (a Super Chaos only game: in its checklist only; Dominoes never on one phone)
export const samePhone = () => !isHost() && state.setup.vs === 'same';   // two people on one phone (Play a Friend's Same phone)
// The Mode selector, Super Chaos | Classic (Play Local, the host's room, Find Match): only where Super Chaos is open
// to this player; its "?" explains Super Chaos.
export const modeRow = sc => (!isHost() || chaosVisible() ? `<div class="timerrow scmode" role="group" aria-label="Mode"><span>Mode ${qBtn('mode', 'sm')}</span><button class="seg${sc ? ' on' : ''}" data-act="gmode" data-v="chaos" aria-pressed="${sc}">Super Chaos${isHost() ? chaosBadge() : ''}</button><button class="seg${sc ? '' : ' on'}" data-act="gmode" data-v="classic" aria-pressed="${!sc}">Classic</button></div>` : '');
// The host's timer: no limit or the admin's Timer (Find Match's clock, the default); an admin host any of them, to test:
// a time per turn (30 or 60 s) or a match clock (3, 5 or 10 minutes each, plus 0, 2 or 5 seconds a move).
function timerRows(cur) {
  const seg = (spec, label, on) => `<button class="seg${on ? ' on' : ''}" data-act="clock" data-v="${spec}" aria-pressed="${on}">${label}</button>`;
  const row = (label, body, q) => `<div class="timerrow" role="group" aria-label="${label}"><span>${label}${q ? qBtn('timer', 'sm') : ''}</span>${body}</div>`;
  const p = specParts(cur), m = p.kind === 'match' ? p : { mins: 5, inc: 5 };
  // Players (November 2026): the match clock, minutes each with +5 s a move, or no limit; the "?" beside it says so.
  if (!acct.admin) return row('Minutes', [['off', 'No limit'], ...CLOCK_MINS.map(v => [`m${v}+5`, `${v}`])].map(([v, l]) => seg(v, l, cur === v)).join(''), true);
  // The admin (testing): a time per turn too, and the match clock's other increments.
  const t = p.kind === 'turn' ? p.secs : 30;
  return row('Timer', seg('off', 'No limit', p.kind === 'off') + seg(`m${m.mins}+${m.inc}`, 'Match clock', p.kind === 'match') + seg('t' + t, 'Per turn', p.kind === 'turn'))
    + (p.kind === 'turn' ? row('Per turn', TURN_SECS.map(v => seg('t' + v, `${v}s/turn`, t === v)).join('')) : '')
    + (p.kind === 'match' ? row('Minutes', CLOCK_MINS.map(v => seg(`m${v}+${m.inc}`, `${v} min`, m.mins === v)).join(''), true) + row('Per move', CLOCK_INCS.map(v => seg(`m${m.mins}+${v}`, `+${v}s/move`, m.inc === v)).join('')) : '');
}
export function renderSetup() {
  const s = state.setup;
  const VT = setupTypes(), on = enabledGames(s).filter(t => VT.includes(t)).length;   // (an admin-only game does not exist here for anyone but the admin)
  const host = isHost();
  const sc = chaosSetup();
  const guest = host ? other(state.online.me) : null;
  // The host's room: the host is Player 1 and the friend Player 2 (X and O are drawn at random when each match starts).
  const field = p => (p === guest
    ? `<div class="field"><span>Player 2 · friend</span><div class="namebox">${state.online.joined ? esc(s.names[p]) : '<i>not joined yet</i>'}</div></div>`
    : `<div class="field"><span>Player 1 · you</span><div class="namebox">${esc((acct.profile && acct.profile.username) || s.names[p] || 'You')}</div></div>`);   // (hosting needs an account: always its username)
  const chk = t => `<label class="chk${s.games[t] ? '' : ' off'}${dealable(t) ? '' : ' wait'}" title="${dealable(t) ? '' : `Loading its ${t === 'trivia' ? 'questions' : 'physics'}… (needs a connection the first time)`}"><input type="checkbox" data-t="${t}"${s.games[t] ? ' checked' : ''}>${ICONS[t]}<span>${INFO[t].name}</span>${testBadge(t)}${dealable(t) ? '' : '<i class="tst wait">Loading</i>'}${qBtn(t, 'sm')}</label>`;
  const timer = host && !sc ? timerRows(setupSpec(s)) : '';
  const room = host ? `<div class="room"><small>Room code</small><b class="code">${esc(state.online.code)}</b>
      <div class="row"><button class="btn" data-act="share">Share invite</button><button class="btn" data-act="copy-invite">Copy invite</button></div>
      ${state.notice ? `<div class="notice" role="status"${fxAttr(fxAt('notice', noticeSeq))}>${esc(state.notice)}</div>` : ''}
      <div class="status${net.status === 'connected' ? ' ok' : net.status === 'error' ? ' bad' : ''}">${net.status === 'connected' ? `<b>${esc(s.names[guest])}</b> joined` : esc(net.msg || 'Waiting for friend…')}</div>
      ${net.status === 'error' ? '<button class="btn" data-act="host-retry">Try again</button>' : ''}</div>` : '';
  const ready = setupReady(s);
  const vsCpu = !host && s.vs === 'cpu';
  const title = host ? 'Host game' : vsCpu ? 'Play Computer' : 'Same phone';
  const sub = host ? 'Share the code, set up, then start once your friend is in' : vsCpu ? 'You vs Computer' : 'Two players taking turns on this phone';
  // Same phone: two people on this phone; player 1 picks X, O or Random, player 2 takes the other side. (The computer is
  // Play Computer's, from the main menu: no Human/Computer choice here.)
  const L = host ? null : normLocal(s), s1 = L && L.pick !== 'random' ? L.pick : null, s2 = s1 ? other(s1) : null;
  const face = side => (side ? toonT(side) : '<span class="rtoon" aria-hidden="true">?</span>');
  const slots = () => {
    const pick = v => `<button class="seg${v === 'random' ? '' : ' ' + v}${L.pick === v ? ' on' : ''}" data-act="lside" data-side="${v}" aria-pressed="${L.pick === v}">${v === 'X' ? 'X' : v === 'O' ? 'O' : 'Random'}</button>`;
    return `<div class="slot ${s1 || 'R'} p1">
      <div class="who-p">${face(s1)}</div>
      <div class="sides three lside" role="group" aria-label="Player 1's side">${pick('X')}${pick('O')}${pick('random')}</div>
      <label class="field ${s1 || ''}"><span>Player 1 name${L.pick === 'random' ? ' · X or O, drawn every match' : ''}</span><input data-ln="n1" value="${esc(L.n1)}" maxlength="${NAME_MAX}" placeholder="${s1 || 'X or O'}" autocomplete="off" autocapitalize="words" aria-label="Player 1 name"></label></div>
    <div class="slot ${s2 || 'R'} p2">
      <div class="who-p">${face(s2)}</div>
      <label class="field ${s2 || ''}"><span>Player 2 name</span><input data-ln="n2" value="${esc(L.n2)}" maxlength="${NAME_MAX}" placeholder="${s2 || 'X or O'}" autocomplete="off" autocapitalize="words" aria-label="Player 2 name"></label></div>`;
  };
  // Play Computer: you (your username, or "You") against the computer; your side X, O or Random, its difficulty.
  const cpuSlots = () => {
    const C = normCpu(s), c1 = C.pick !== 'random' ? C.pick : null, c2 = c1 ? other(c1) : null, you = (loggedIn() && acct.profile.username) || 'You';
    const pick = v => `<button class="seg${v === 'random' ? '' : ' ' + v}${C.pick === v ? ' on' : ''}" data-act="cside" data-side="${v}" aria-pressed="${C.pick === v}">${v === 'random' ? 'Random' : v}</button>`;
    return `<div class="vscpu"><div class="vsme">${face(c1)}<b>${esc(you)}</b></div><i class="vsv" aria-hidden="true">vs</i><div class="vsme">${face(c2)}<b>${CPU_NAME}</b></div></div>
    <div class="timerrow" role="group" aria-label="You play as"><span>You play as:</span>${pick('X')}${pick('O')}${pick('random')}</div>
    <div class="timerrow" role="group" aria-label="Difficulty"><span>Difficulty</span>${LEVELS.map(v => `<button class="seg${C.level === v ? ' on' : ''}" data-act="clevel" data-v="${v}" aria-pressed="${C.level === v}">${LEVEL_NAME[v]}</button>`).join('')}</div>`;
  };
  return `<main class="scr setup">
    <div class="bar">${host ? `<button class="back" data-act="lobby-back" aria-label="Close the room and go back">${CHEV}Back</button>` : vsCpu ? `<button class="back" data-act="menu" aria-label="Back to the main menu">${CHEV}Menu</button>` : `<button class="back" data-act="friend-go" aria-label="Back to Play a Friend">${CHEV}Back</button>`}
      <div class="ttl"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</div></div>
    <div class="setup-box" data-keep-scroll="setup">
    ${room}
    ${host ? `<div class="names">${field(state.online.me)}${field(guest)}</div>` : vsCpu ? cpuSlots() : `<div class="slots">${slots()}</div>`}
    ${SUPER_CHAOS_ENABLED ? modeRow(sc) : ''}
    ${timer}
    ${templatesRow(VT)}
    <div class="adv${advOpen ? ' open' : ''}"><button class="adv-h" data-act="adv" aria-expanded="${advOpen}"><span>Mini-games</span><small>${gamesCount(on, VT.length)}</small><i class="chev">${CHEV}</i></button>
      ${advOpen ? `<div class="games-top"><button class="btn selall" data-act="games-none"${on === 0 ? ' disabled' : ''}>Deselect all</button><button class="btn selall" data-act="games-all"${on === VT.length ? ' disabled' : ''}>Select all</button></div><div class="games">${byName(VT).map(chk).join('')}</div>` : ''}</div>
  </div>
  <div class="setup-foot">${host && starting() ? '<button class="primary busy" data-act="start" disabled aria-busy="true" aria-live="polite"><i class="spinr" aria-hidden="true"></i>Starting…</button>' : `<button class="primary" data-act="start"${ready ? '' : ' disabled'}>Start match</button>`}${(w => `<small class="warn${w ? '' : modeNote ? ' info' : ''}" role="status">${w || modeNote}</small>`)(setupWarn(s))}</div></main>`;
}
// A brief note in the setup's foot (its reserved line): Human chosen for player 2 while Super Chaos was on
// switched the mode to Classic.
let modeNote = '', modeNoteTimer = 0;
export function noteMode(text, ms = 3000) {
  modeNote = text; clearTimeout(modeNoteTimer);
  modeNoteTimer = setTimeout(() => { modeNote = ''; if (state.screen === 'setup') render(); }, ms);
}
/* ----- Templates (admin only for now): named mini-game selections saved on the account (net/accounts.js templates) -----
 * A row above the Mini-games section on every setup screen with the checklist (Play Computer, the host's lobby, Same
 * phone), for an admin alone (acct.admin; nobody else sees a trace of it): the account's templates as a list (name · N
 * games), one chosen at a time, and under it a bar of fixed shape: Use (the template's selection goes onto the checklist,
 * never a game this screen may not deal: setGames, which also writes a lobby's setup), Update (the checklist as it stands
 * saved back to the chosen template: editing is Use, tick or untick, Update), Rename, Delete (asks first), and Save as
 * template (a name typed in place: a field with Save and Cancel, never the browser's prompt). The field's text survives a
 * redraw (read back from the page before the screen is drawn again) and keeps the focus (its id, ui/keyboard.js). */
export const tpl = { sel: null, base: null, mode: null, draft: '', confirm: false, note: '' };   // sel: the chosen template's id; mode: null | 'save' | 'rename' (the name field up); confirm: Delete asked
export const tplOn = () => !!acct.admin && !!state.setup;
// The template the checklist matches exactly (its games among those this screen may deal; the chosen one first), or null: "Custom".
export function tplMatch(VT) {
  if (!templates || !state.setup) return null;
  const mine = VT.filter(t => state.setup.games[t]);
  if (!mine.length) return null;
  const same = t => { const g = VT.filter(k => t.games[k] === true); return g.length === mine.length && g.every(k => state.setup.games[k]); };
  const list = templateList(), first = list.find(t => t.id === tpl.base);
  const hit = (first && same(first) ? first : list.find(same));
  return hit ? hit.id : null;
}
// The row's state after the checklist changed in place: the matching template lit, or Custom; the bar's buttons follow.
export function tplSync() {
  if (!tplOn() || !app.querySelectorAll) return;
  tpl.sel = tplMatch(setupTypes());
  const base = tpl.sel ? tpl.sel : tpl.base;
  for (const b of app.querySelectorAll('.tplrow')) { const on = b.dataset.id === tpl.sel; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }
  const c = app.querySelector('.tplcus'); if (c) c.classList.toggle('off', !!tpl.sel);
  if (tpl.note) { tpl.note = ''; const n = app.querySelector('.tpls .games-h small'); if (n) n.textContent = 'Mini-game selections, on your account'; }   // (an "applied" note is about the last tap)
  for (const a of ['tpl-update', 'tpl-rename', 'tpl-del']) { const b = app.querySelector(`[data-act="${a}"]`); if (b) b.disabled = !(base && templates && templates[base]); }
}
// The checklist's selection as a template's games: the games on, among those this screen may deal.
const tplSelection = VT => Object.fromEntries(TYPES.filter(t => state.setup.games[t] && VT.includes(t)).map(t => [t, true]));
export function templatesRow(VT) {
  if (!tplOn()) return '';
  const f = app.querySelector && app.querySelector('#tplname');                   // (a redraw while a name is being typed: the text as it stands comes along)
  if (f && typeof f.value === 'string') tpl.draft = f.value;
  const list = templateList();
  if (tpl.base && !(templates && templates[tpl.base])) { tpl.base = null; tpl.confirm = false; if (tpl.mode === 'rename') tpl.mode = null; }
  tpl.sel = tplMatch(VT);                                                          // (lit by the checklist itself: a change to any box makes it Custom, the same games again light it)
  const cur = tpl.sel ? templates[tpl.sel] : tpl.base ? templates[tpl.base] : null;   // (what Update, Rename and Delete act on: the lit one, else the last one chosen)
  const n = t => Object.keys(t.games).filter(k => VT.includes(k)).length;
  const rows = list.length ? list.map(t => `<button class="tplrow${t.id === tpl.sel ? ' on' : ''}" data-act="tpl-pick" data-id="${esc(t.id)}" aria-pressed="${t.id === tpl.sel}"><b>${esc(t.name)}</b><small>${n(t)} game${n(t) === 1 ? '' : 's'}</small></button>`).join('')
    : `<i class="tplnone">${templates ? 'No templates yet' : 'Loading your templates…'}</i>`;
  let bar;
  if (tpl.mode) bar = `<label class="tplfield"><input id="tplname" aria-label="Template name" maxlength="${TPL_NAME_MAX}" value="${esc(tpl.draft)}" placeholder="${tpl.mode === 'rename' ? 'New name' : 'Template name'}" autocomplete="off" autocapitalize="words" enterkeyhint="done"></label>
      <div class="tplbtns"><button class="btn tplb go" data-act="tpl-ok">${tpl.mode === 'rename' ? 'Rename' : 'Save'}</button><button class="btn tplb" data-act="tpl-cancel">Cancel</button></div>`;
  else if (tpl.confirm && cur) bar = `<p class="tplask" role="status">Delete “${esc(cur.name)}”?</p>
      <div class="tplbtns"><button class="btn tplb" data-act="tpl-cancel">No</button><button class="btn tplb go" data-act="tpl-del-yes">Yes, delete</button></div>`;
  else bar = `<div class="tplbtns"><button class="btn tplb" data-act="tpl-update"${cur ? '' : ' disabled'}>Update</button><button class="btn tplb" data-act="tpl-rename"${cur ? '' : ' disabled'}>Rename</button><button class="btn tplb" data-act="tpl-del"${cur ? '' : ' disabled'}>Delete</button></div>
      <div class="tplbtns"><button class="btn tplb wide" data-act="tpl-save">Save as template</button></div>`;
  return `<div class="tpls" role="group" aria-label="Templates"><div class="games-h"><span>Templates</span><small>${tpl.note ? esc(tpl.note) : 'Mini-game selections, on your account'}</small><em class="tplcus${tpl.sel ? ' off' : ''}">Custom</em></div>
      <div class="tpllist">${rows}</div><div class="tplbar">${bar}</div></div>`;
}
// The Templates row's buttons (ui/input.js hands every tpl-* action here).
export function tplAct(act, el) {
  if (!tplOn() || state.screen !== 'setup') return;
  const VT = setupTypes(), cur = templates && templates[tpl.sel || tpl.base];
  tpl.note = '';
  if (act === 'tpl-pick') {                                                        // (choosing a template checks exactly its games, at once)
    const id = el && el.dataset.id in (templates || {}) ? el.dataset.id : null, c = id && templates[id];
    tpl.confirm = false; if (tpl.mode === 'rename') tpl.mode = null;
    if (c) { tpl.base = id; setGames(g => { for (const t of TYPES) g[t] = VT.includes(t) && c.games[t] === true; }); tpl.note = `“${c.name}” applied`; }
  }
  else if (act === 'tpl-update' && cur) { tpl.note = saveTemplate(null, tplSelection(VT), tpl.sel || tpl.base, TYPES) ? `“${cur.name}” updated` : 'Tick at least one mini-game'; }
  else if (act === 'tpl-save') { tpl.mode = 'save'; tpl.draft = ''; tpl.confirm = false; }
  else if (act === 'tpl-rename' && cur) { tpl.mode = 'rename'; tpl.draft = cur.name; tpl.confirm = false; }
  else if (act === 'tpl-ok' && tpl.mode) {
    const f = app.querySelector && app.querySelector('#tplname'), name = (f && typeof f.value === 'string' ? f.value : tpl.draft).replace(/\s+/g, ' ').trim();
    if (!name) { tpl.note = 'Type a name first'; render(); return; }
    if (tpl.mode === 'rename') { if (cur && renameTemplate(tpl.sel || tpl.base, name)) tpl.note = 'Renamed'; }
    else { const id = saveTemplate(name, tplSelection(VT), null, TYPES); if (id) { tpl.base = id; tpl.note = `“${name}” saved`; } else tpl.note = 'Tick at least one mini-game'; }
    tpl.mode = null; tpl.draft = '';
  }
  else if (act === 'tpl-cancel') { tpl.mode = null; tpl.confirm = false; tpl.draft = ''; }
  else if (act === 'tpl-del' && cur) tpl.confirm = true;
  else if (act === 'tpl-del-yes' && cur) { deleteTemplate(tpl.sel || tpl.base); tpl.sel = null; tpl.base = null; tpl.confirm = false; tpl.note = 'Deleted'; }
  render();
  if (tpl.mode) { const f = app.querySelector && app.querySelector('#tplname'); if (f && f.focus) f.focus({ preventScroll: true }); }
}
// How many mini-games are on: "All", or "x/N".
export const gamesCount = (on, n) => (on === n ? 'All' : `${on}/${n}`);
// The Mini-games checklist: one list in alphabetical order (a game's kind, meta.js category, is in its "?").
export const byName = types => types.slice().sort((a, b) => INFO[a].name.localeCompare(INFO[b].name));
// Start opens once at least one mini-game is on (online, also once the friend is in).
const onGames = s => enabledGames(s).filter(t => setupTypes().includes(t));   // the games on, among those this player may see (Super Chaos: its own)
function setupReady(s) { const on = onGames(s).length; return isHost() ? !!(on && state.online.joined && connected) : !!on; }
function setupWarn(s) { return !onGames(s).length ? 'Select at least one mini-game to start' : isHost() && !setupReady(s) ? 'Start opens once your friend has joined' : ''; }
// Ticking a mini-game (or Select all) changes the screen in place, with no re-render, so the list
// stays exactly where it was scrolled and Mini-games stays open. The choice is saved for the next match.
export function setGames(change) {
  const s = state.setup;
  change(s.games);
  save();
  const VT = setupTypes(), on = onGames(s).length;
  for (const box of app.querySelectorAll('input[data-t]')) {
    const v = !!s.games[box.dataset.t];
    box.checked = v;
    box.closest('.chk').classList.toggle('off', !v);
  }
  const n = app.querySelector('.adv-h small'); if (n) n.textContent = gamesCount(on, VT.length);
  tplSync();
  const all = app.querySelector('[data-act="games-all"]'); if (all) all.disabled = on === VT.length;
  const none = app.querySelector('[data-act="games-none"]'); if (none) none.disabled = on === 0;
  const start = app.querySelector('[data-act="start"]'); if (start && !start.classList.contains('busy')) start.disabled = !setupReady(s);
  const warn = app.querySelector('.setup-foot .warn'); if (warn) warn.textContent = setupWarn(s);
  dbSetup({ games: restrictGames(Object.assign({}, s.games), VT) });   // (the room never holds a game its host may not deal)
}
