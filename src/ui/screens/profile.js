// Profiles, My Stats, game history and the leaderboard.
import { newState } from '../../core/match.js';
import { upgradeMini } from '../../core/minis.js';
import { topOpponents } from '../../core/stats.js';
import { TYPES } from '../../games/index.js';
import { acct, connectQuiet, delState, needAccount } from '../../net/accounts.js';
import { fb } from '../../net/connect.js';
import { NAV_SCREENS, RNG, commit, esc, state, withView } from '../app.js';
import { CHEV } from '../art.js';
import { renderBoard } from '../board.js';
import { RATINGS_ENABLED } from '../config.js';
import { renderMini } from '../mini.js';
import { viewRec, winPct } from '../pstats.js';
import { render } from '../render.js';

let lb = null;                               // the leaderboard as last loaded: { rows, me, error }
export let prof = null;                             // the profile on show: { uid, user, hist, opps, back, prev, error }
export let hist = null;                             // a past game on the review board: { entry, view, zoom }

/* ----- the leaderboard: the top 100 by rating (players with 5+ ranked games), and your own rank ----- */
export async function openLeaderboard() {
  lb = { rows: null, me: null, error: null };
  state.screen = 'leaderboard'; commit();
  if (!(await connectQuiet())) { lb.error = 'No connection. Check your internet and try again.'; render(); return; }
  try {
    const m = fb.m, top = await m.get(m.query(m.ref(fb.db, 'leaderboard'), m.orderByChild('rating'), m.limitToLast(100)));
    const rows = [];
    top.forEach(c => { rows.push(Object.assign({ uid: c.key }, c.val())); });
    rows.sort((a, b) => b.rating - a.rating || (a.username < b.username ? -1 : 1));
    rows.forEach(r => { r.rank = 1 + rows.filter(x => x.rating > r.rating).length; });   // equal ratings share a rank
    lb.rows = rows;
    const uid = acct.user && acct.user.uid;
    if (uid && !rows.some(r => r.uid === uid)) {
      const mine = (await m.get(m.ref(fb.db, 'leaderboard/' + uid))).val();
      if (mine) {
        const above = await m.get(m.query(m.ref(fb.db, 'leaderboard'), m.orderByChild('rating'), m.startAfter(mine.rating)));
        lb.me = Object.assign({ uid, rank: above.size + 1 }, mine);
      } else lb.me = { uid, unlisted: true, games: acct.profile ? acct.profile.games : 0 };
    }
  } catch (e) { lb.error = "Couldn't load the leaderboard. Try again."; }
  render();
}

/* ----- profiles and game history ----- */
export async function openProfile(uid, back) {
  if (!uid) { if (!(await needAccount('profile'))) return; uid = acct.user.uid; }
  if (prof && prof.uid === uid && prof.user && state.screen === 'profhist') { state.screen = 'profile'; render(); return; }   // back from its game history
  const prev = state.screen === 'profile' && prof && prof.uid !== uid && prof.user ? prof : null;   // a Top opponent's, from a profile: Back returns to that one
  const own = !!(acct.user && uid === acct.user.uid);
  prof = { uid, own, user: null, hist: null, local: null, opps: null, prev, view: prof && prof.uid === uid ? prof.view : 'online', back: back || (NAV_SCREENS.includes(state.screen) ? state.screen : state.screen === 'win' ? 'win' : 'menu'), error: null };
  state.screen = 'profile'; commit();
  if (!(await connectQuiet())) { prof.error = 'No connection. Check your internet and try again.'; render(); return; }
  try {
    const m = fb.m;
    if (!own) {                                                   // someone else: their public profile alone (profiles/{uid}: the username, records, join date); their history and opponents are theirs
      const u = await m.get(m.ref(fb.db, 'profiles/' + uid));
      if (!prof || prof.uid !== uid) return;
      prof.user = u.val();
      if (!prof.user) prof.error = 'This player has no profile.';
      render(); return;
    }
    const last50 = node => m.get(m.query(m.ref(fb.db, `${node}/${uid}`), m.orderByChild('date'), m.limitToLast(50)));
    const [u, h, ls, lh, os] = await Promise.all([m.get(m.ref(fb.db, 'users/' + uid)), last50('history'),
      m.get(m.ref(fb.db, 'localStats/' + uid)).catch(() => null), last50('localHistory').catch(() => null),   // local games: your own, private
      m.get(m.ref(fb.db, 'oppStats/' + uid)).catch(() => null)]);   // the record against each opponent (the server's tally)
    if (!prof || prof.uid !== uid) return;
    prof.user = u.val();
    prof.opps = topOpponents(os ? os.val() : null, 3);
    prof.local = ls ? ls.val() || {} : null;
    if (!prof.user) prof.error = 'This player has no profile.';
    const list = [];
    h.forEach(c => { list.push(Object.assign({ id: c.key }, c.val())); });
    if (lh) lh.forEach(c => { list.push(Object.assign({ id: c.key }, c.val())); });
    prof.hist = list.sort((a, b) => b.date - a.date).slice(0, 80);  // newest first
  } catch (e) { if (prof) prof.error = "Couldn't load this profile. Try again."; }
  render();
}
export function profileBack() {
  if (prof && prof.prev) { prof = prof.prev; state.screen = 'profile'; render(); return; }   // back to the profile it was opened from
  const back = prof && prof.back;
  if (back === 'win' && state.winner) state.screen = 'win';
  else if (back === 'leaderboard' && RATINGS_ENABLED) state.screen = 'leaderboard';
  else state.screen = 'menu';
  commit();
}
// A past game on the read-only review board: the final state with everything revealed.
export function openHistory(id) {
  const e = prof && prof.hist && prof.hist.find(x => x.id === id);
  if (!e) return;
  let f;
  try { f = JSON.parse(e.final); } catch (err) { return; }
  const v = newState(RNG);
  Object.assign(v, { squares: f.squares, winner: f.winner || null, winLine: f.winLine || null, winReason: f.winReason || null, counts: f.counts || null, resigned: f.resigned || null, games: f.games || TYPES.slice(), moves: f.moves || 0, screen: 'review' });
  v.setup.names = Object.assign({ X: 'X', O: 'O' }, f.names || {});
  v.squares.forEach(sq => upgradeMini(sq.mini));
  hist = { entry: e, view: v, zoom: null };
  state.screen = 'hreview'; render();
}
const REVIEW_LIVE = { back: 'results', backLabel: 'Results', backAria: 'Back to the results', sq: 'review-sq', mback: 'review-back', title: 'Final board' };
const REVIEW_HIST = { back: 'hist-close', backLabel: 'Games', backAria: 'Back to the game history', sq: 'hist-sq', mback: 'hist-back', title: 'Final board' };
export let reviewCtx = REVIEW_LIVE;
export function renderHistory() {
  if (!hist) return renderProfile();
  const mini = state.screen === 'hreview-mini' && hist.zoom != null;      // (read before the past game takes the place of the live state)
  reviewCtx = REVIEW_HIST;
  try {
    return withView(hist.view, () => (mini ? renderMini(state.squares[hist.zoom], true) : renderBoard(true)));
  } finally { reviewCtx = REVIEW_LIVE; }
}
const fmtDate = t => { try { return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } };
const HOW_TEXT = { line: 'three in a row', majority: 'most squares', timeout: 'timeout', resign: 'resignation', draw: 'no line left' };
const MODE_TEXT = RATINGS_ENABLED ? { ranked: 'Ranked', casual: 'Casual', match: 'Find Match', friend: 'Unrated', local: 'Local' } : { ranked: 'Find Match', casual: 'Find Match', match: 'Find Match', friend: 'Friend', local: 'Local' };
export function record(u) { u = u || {}; return `${u.wins || 0}-${u.losses || 0}-${u.draws || 0}`; }   // wins-losses-draws
export function signed(d) { return (d > 0 ? '+' : d < 0 ? '−' : '±') + Math.abs(d); }
export function renderLeaderboard() {
  const rowOf = (r, me) => `<button class="lbrow${me ? ' me' : ''}" data-act="profile" data-uid="${esc(r.uid)}" aria-label="#${r.rank} ${esc(r.username)}, rating ${r.rating}, ${record(r)}"><b class="rk">#${r.rank}</b><span class="nm">${esc(r.username)}</span><b class="rt">${r.rating}</b><small class="rc">${record(r)}</small></button>`;
  const uid = acct.user && acct.user.uid;
  let body;
  if (!lb || (!lb.rows && !lb.error)) body = '<p class="hint center">Loading…</p>';
  else if (lb.error) body = `<div class="warn">${esc(lb.error)}</div><button class="btn" data-act="leaderboard">Try again</button>`;
  else if (!lb.rows.length) body = '<p class="hint center">Nobody is listed yet: play five ranked games to be the first.</p>';
  else body = `<div class="lb">${lb.rows.map(r => rowOf(r, r.uid === uid)).join('')}</div>`;
  let mine = '';
  if (lb && lb.me) mine = lb.me.unlisted ? `<p class="lbme hint">Play ${Math.max(1, 5 - (lb.me.games || 0))} more ranked game${5 - (lb.me.games || 0) === 1 ? '' : 's'} to be listed.</p>`
    : `<div class="lbme"><small>Your rank</small>${rowOf(lb.me, true)}</div>`;
  else if (!uid) mine = '<p class="lbme hint"><button class="link" data-act="login">Log in</button> to see your own rank.</p>';
  return `<main class="scr setup acct-scr lb-scr">
    <div class="bar"><button class="back" data-act="menu" aria-label="Back to the main menu">${CHEV}Menu</button>
      <div class="ttl"><b>Leaderboard</b><small>Top 100 by rating · players with 5+ ranked games</small></div></div>
    <div class="setup-box" data-keep-scroll="leaderboard">${body}</div>${mine}</main>`;
}
// A profile (My Stats for your own): the record and win rate (Find Match and vs friends), the top opponents,
// and a way to the game history.
export function renderProfile() {
  const p = prof || {};
  const own = acct.user && p.uid === acct.user.uid;
  const backLabel = p.prev ? 'Back' : p.back === 'win' ? 'Results' : p.back === 'leaderboard' && RATINGS_ENABLED ? 'Leaderboard' : 'Menu';
  const u = p.user;
  let body = '';
  if (p.error) body = `<div class="warn">${esc(p.error)}</div>`;
  else if (!u) body = '<p class="hint center">Loading…</p>';
  else {
    // Your own stats: Online (Find Match and friend games together), Local, or All. Someone else's: online only.
    // (The record by side and the squares per mini-game are the admin's: admin.html's player detail.)
    const view = own ? (p.view || 'online') : 'online';
    const rec = viewRec(u, own ? p.local : null, view);
    const games = rec.wins + rec.losses + rec.draws;
    const tabs = own ? `<div class="ptabs" role="tablist" aria-label="Which games">${[['online', 'Online'], ['local', 'Local'], ['all', 'All']].map(([v, l]) => `<button class="seg${view === v ? ' on' : ''}" role="tab" aria-selected="${view === v}" data-act="pview" data-v="${v}">${l}</button>`).join('')}</div>` : '';
    const label = { online: 'Online record', local: 'Local record', all: 'All games' }[view];
    const card = `${tabs}<div class="pcard rec">${RATINGS_ENABLED ? `<div class="prt"><small>Rating</small><b>${u.rating}</b></div>` : ''}
      <div class="prec"><small>${label}</small><b>${record(rec)}</b><small>wins-losses-draws · ${games} game${games === 1 ? '' : 's'}</small></div>
      <div class="ppct"><small>Win rate</small><b>${winPct(rec)}</b></div>
      ${view === 'online' ? `<div class="pfr"><small>Find Match ${record(u)} · Friends ${record(u.friend)}</small></div>` : ''}
      <small class="pjoin">Joined ${fmtDate(u.joined)}</small></div>`;
    // Top opponents: the three people played most online (never a bot or the computer), each with the record
    // against them; three rows always, so nothing moves whatever there is to show.
    const opps = p.opps || [];
    const oppRow = (r, i) => (r ? `<button class="popp" data-act="profile" data-uid="${esc(r.uid)}" aria-label="${esc(r.name)}: ${r.wins} won, ${r.losses} lost, ${r.draws} drawn. Open their profile"><b class="pk">${i + 1}</b><span class="pn">${esc(r.name)}</span><b class="pr">${record(r)}</b><i class="pc" aria-hidden="true">${CHEV}</i></button>`
      : `<div class="popp${i === 0 ? ' none' : ''}"${i ? ' aria-hidden="true"' : ''}>${i === 0 ? 'No online opponents yet' : ''}</div>`);
    const oppBox = `<h3 class="hh hopp"><span>Top opponents</span><small>W-L-D</small></h3><div class="popps">${[0, 1, 2].map(i => oppRow(opps[i], i)).join('')}</div>`;
    const nh = p.hist ? p.hist.length : null;
    // Someone else's profile: the public record alone; their game history and opponents are theirs to see (security review F9/F11).
    body = own ? `<button class="btn wide phist" data-act="prof-hist"${p.hist ? '' : ' disabled'}>Game history${nh != null ? ` (${nh})` : ''}</button>
      ${card}${oppBox}`   // the game history first, then the record and the top opponents
      : `${card}<p class="hint center ppriv">Game history and opponents are private.</p>`;
  }
  return `<main class="scr setup acct-scr prof-scr">
    <div class="bar"><button class="back" data-act="prof-back" aria-label="Back">${CHEV}${backLabel}</button>
      <div class="ttl"><b>${own ? 'My Stats' : esc(u ? u.username : 'Profile')}</b><small>${own ? esc(u ? u.username : '') : 'Player profile'}</small></div></div>
    <div class="setup-box" data-keep-scroll="profile">${body}${own ? '<button class="link wide" data-act="logout">Log out</button><button class="link wide delacct" data-act="del-account">Delete account</button>' : ''}</div>${own ? deleteDialog() : ''}</main>`;
}
// Delete account: the question first (No / Yes, delete), then the server deletes everything (net/accounts.js deleteAccount);
// refused while the player is in an online match, which the card says.
function deleteDialog() {
  if (!delState) return '';
  const busy = delState === 'busy', err = delState && delState.error;
  return `<div class="flash pause delask" role="dialog" aria-label="Delete your account?"><div class="card"><h2>Delete your account?</h2>
    <p>Your username, records, game history and login are deleted for good. Other players keep their own history of games against you.</p>
    ${err ? `<div class="warn" role="status">${esc(err)}</div>` : '<div class="warn" aria-hidden="true"></div>'}
    <div class="row"><button class="btn" data-act="del-cancel"${busy ? ' disabled' : ''}>No</button><button class="btn go" data-act="del-confirm"${busy ? ' disabled' : ''}>${busy ? 'Deleting…' : 'Yes, delete'}</button></div></div></div>`;
}
// A past game's final main board, small: X, O and empty squares, the profile's own squares outlined.
const SNAP = new Map();                                    // entry id -> its squares' owners (each final parsed once)
function histSnap(h) {
  let own = SNAP.get(h.id);
  if (!own) {
    try { const f = JSON.parse(h.final); own = (f.squares || []).map(q => (q && (q.owner === 'X' || q.owner === 'O') ? q.owner : '')); } catch (e) { own = []; }
    if (own.length !== 9) own = new Array(9).fill('');
    SNAP.set(h.id, own);
  }
  const me = h.side === 'X' || h.side === 'O' ? h.side : null;
  return `<span class="hsnap" aria-hidden="true">${own.map(o => `<i class="${o}${o && o === me ? ' mine' : ''}">${esc(o)}</i>`).join('')}</span>`;
}
// The game history of the profile on show: every online game, newest first, each opening its final board.
export function renderProfHist() {
  const p = prof || {}, u = p.user;
  let list;
  if (!p.hist) list = '<p class="hint center">Loading games…</p>';
  else if (!p.hist.length) list = '<p class="hint center">No games yet.</p>';
  else list = `<div class="hlist">${p.hist.map(h => {
    const r = h.result === 'win' ? 'Won' : h.result === 'loss' ? 'Lost' : 'Draw';
    const chg = RATINGS_ENABLED && h.ratingAfter != null ? `<small class="hchg ${h.ratingAfter >= h.ratingBefore ? 'up' : 'down'}">${h.ratingBefore} → ${h.ratingAfter} (${signed(h.ratingAfter - h.ratingBefore)})</small>` : '';
    return `<button class="hirow ${h.result}" data-act="hist-open" data-id="${esc(h.id)}" aria-label="${r} against ${esc(h.opponent && h.opponent.name)}${h.side === 'X' || h.side === 'O' ? `, you played ${h.side}` : ''}, ${HOW_TEXT[h.how] || ''}, ${fmtDate(h.date)}. Tap to see the final board">
      <span class="hin">${histSnap(h)}<span class="hres">${r}</span><span class="hvs"><span class="hname">vs ${esc(h.opponent && h.opponent.name || '?')}</span><small>${HOW_TEXT[h.how] || ''} · ${fmtDate(h.date)}</small></span><span class="hmeta">${h.side === 'X' || h.side === 'O' ? `<i class="hyou ${h.side}">You: ${h.side}</i>` : ''}<i class="badge ${h.mode}">${MODE_TEXT[h.mode] || ''}</i>${chg}</span></span></button>`;
  }).join('')}</div>`;
  return `<main class="scr setup acct-scr prof-scr">
    <div class="bar"><button class="back" data-act="profile" data-uid="${esc(p.uid || '')}" aria-label="Back to the stats">${CHEV}Stats</button>
      <div class="ttl"><b>Game history</b><small>${esc(u ? u.username : '')}</small></div></div>
    <div class="setup-box" data-keep-scroll="profhist">${list}</div></main>`;
}

// Setters for the names other modules reassign (an imported name is read-only there).
export function setHist(v) { hist = v; }
export function setProf(v) { prof = v; }
