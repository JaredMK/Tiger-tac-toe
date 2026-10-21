// Profiles, My Stats, game history and the leaderboard.
import { newState } from '../../core/match.js';
import { upgradeMini } from '../../core/minis.js';
import { INFO, TYPES } from '../../games/index.js';
import { acct, connectQuiet, needAccount } from '../../net/accounts.js';
import { fb } from '../../net/connect.js';
import { NAV_SCREENS, RNG, commit, esc, state, withView } from '../app.js';
import { CHEV, ICONS, toon } from '../art.js';
import { renderBoard } from '../board.js';
import { RATINGS_ENABLED } from '../config.js';
import { renderMini } from '../mini.js';
import { render } from '../render.js';

let lb = null;                               // the leaderboard as last loaded: { rows, me, error }
export let prof = null;                             // the profile on show: { uid, user, hist, back, error }
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
  prof = { uid, user: null, hist: null, local: null, view: prof && prof.uid === uid ? prof.view : 'online', back: back || (NAV_SCREENS.includes(state.screen) ? state.screen : state.screen === 'win' ? 'win' : 'menu'), error: null };
  state.screen = 'profile'; commit();
  if (!(await connectQuiet())) { prof.error = 'No connection. Check your internet and try again.'; render(); return; }
  try {
    const m = fb.m;
    const own = acct.user && uid === acct.user.uid;
    const last50 = node => m.get(m.query(m.ref(fb.db, `${node}/${uid}`), m.orderByChild('date'), m.limitToLast(50)));
    const [u, h, ls, lh] = await Promise.all([m.get(m.ref(fb.db, 'users/' + uid)), last50('history'),
      own ? m.get(m.ref(fb.db, 'localStats/' + uid)).catch(() => null) : null, own ? last50('localHistory').catch(() => null) : null]);   // local games: your own, private
    if (!prof || prof.uid !== uid) return;
    prof.user = u.val();
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
const winPct = u => { const g = (u && ((u.wins || 0) + (u.losses || 0) + (u.draws || 0))) || 0; return g ? Math.round(100 * (u.wins || 0) / g) + '%' : '–'; };   // of all games, draws included
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
// A profile (My Stats for your own): the Find Match record and win rate, the vs-friends record, squares won
// and lost per mini-game in all online games (most won first), and a way to the game history.
export function renderProfile() {
  const p = prof || {};
  const own = acct.user && p.uid === acct.user.uid;
  const backLabel = p.back === 'win' ? 'Results' : p.back === 'leaderboard' && RATINGS_ENABLED ? 'Leaderboard' : 'Menu';
  const u = p.user;
  let body = '';
  if (p.error) body = `<div class="warn">${esc(p.error)}</div>`;
  else if (!u) body = '<p class="hint center">Loading…</p>';
  else {
    // Your own stats: Online (Find Match and friend games together), Local, or All. Someone else's: online only.
    const view = own ? (p.view || 'online') : 'online';
    const sum = (...rs) => rs.reduce((t, r) => { r = r || {}; for (const k of ['wins', 'losses', 'draws']) t[k] += r[k] || 0; return t; }, { wins: 0, losses: 0, draws: 0 });
    const addMinis = (...ms) => { const out = {}; for (const m of ms) for (const [t, v] of Object.entries(m || {})) { const o = (out[t] = out[t] || { won: 0, lost: 0 }); o.won += (v && v.won) || 0; o.lost += (v && v.lost) || 0; } return out; };
    const loc = own ? p.local || {} : {};
    const online = sum(u, u.friend), local = sum(loc), all = sum(online, local);
    const rec = view === 'local' ? local : view === 'all' ? all : online;
    const minis = view === 'local' ? addMinis(loc.minis) : view === 'all' ? addMinis(u.minis, loc.minis) : addMinis(u.minis);
    const addSides = (...ss) => ({ X: sum(...ss.map(x => x && x.X)), O: sum(...ss.map(x => x && x.O)) });   // games played as X and as O
    const fsides = u.friend && u.friend.sides;
    const sides = view === 'local' ? addSides(loc.sides) : view === 'all' ? addSides(u.sides, fsides, loc.sides) : addSides(u.sides, fsides);
    const games = rec.wins + rec.losses + rec.draws;
    const tabs = own ? `<div class="ptabs" role="tablist" aria-label="Which games">${[['online', 'Online'], ['local', 'Local'], ['all', 'All']].map(([v, l]) => `<button class="seg${view === v ? ' on' : ''}" role="tab" aria-selected="${view === v}" data-act="pview" data-v="${v}">${l}</button>`).join('')}</div>` : '';
    const label = { online: 'Online record', local: 'Local record', all: 'All games' }[view];
    const card = `${tabs}<div class="pcard rec">${RATINGS_ENABLED ? `<div class="prt"><small>Rating</small><b>${u.rating}</b></div>` : ''}
      <div class="prec"><small>${label}</small><b>${record(rec)}</b><small>wins-losses-draws · ${games} game${games === 1 ? '' : 's'}</small></div>
      <div class="ppct"><small>Win rate</small><b>${winPct(rec)}</b></div>
      ${view === 'online' ? `<div class="pfr"><small>Find Match ${record(u)} · Friends ${record(u.friend)}</small></div>` : ''}
      <small class="pjoin">Joined ${fmtDate(u.joined)}</small></div>`;
    const sideRow = p => { const r = sides[p], g = r.wins + r.losses + r.draws; return `<tr><td><span class="pg">${toon(p)}<span>As ${p}</span></span></td><td>${g}</td><td>${record(r)}</td><td>${winPct(r)}</td></tr>`; };
    const sideTable = `<table class="ptab psides" aria-label="Games played as X and as O"><thead><tr><th>Played as</th><th>Games</th><th>W-L-D</th><th>Win rate</th></tr></thead><tbody>${sideRow('X')}${sideRow('O')}</tbody></table>`;
    // Squares count once they end claimed by X or O (a square still open when the match ended, or a board
    // reset after a draw, is not a mini-game won or lost).
    const rows = Object.entries(minis).filter(([t]) => TYPES.includes(t)).map(([t, v]) => ({ t, won: v.won, lost: v.lost }))   // the games in the pool only (not Hexapawn or the Dice race)
      .filter(r => r.won + r.lost).sort((a, b) => b.won - a.won || a.lost - b.lost || INFO[a.t].name.localeCompare(INFO[b.t].name));
    const allWon = rows.reduce((t, r) => t + r.won, 0), allLost = rows.reduce((t, r) => t + r.lost, 0);
    const rate = (w, l) => `${Math.round(100 * w / (w + l))}%`;
    const table = rows.length ? `<table class="ptab pmini"><thead><tr><th>Mini-game</th><th>Won</th><th>Lost</th><th>Win rate</th></tr></thead><tbody><tr class="pall"><td><span class="pg"><span>All mini-games</span></span></td><td>${allWon}</td><td>${allLost}</td><td>${rate(allWon, allLost)}</td></tr>${rows.map(r =>
      `<tr><td><span class="pg">${ICONS[r.t]}<span>${INFO[r.t].name}</span></span></td><td>${r.won}</td><td>${r.lost}</td><td>${rate(r.won, r.lost)}</td></tr>`).join('')}</tbody></table>`
      : `<p class="hint center">No squares won or lost ${view === 'local' ? 'in local games' : view === 'all' ? '' : 'online'} yet.</p>`;
    const nh = p.hist ? p.hist.length : null;
    const what = { online: 'online games: Find Match and friends', local: 'local games (you as player 1)', all: 'every game: online and local' }[view];
    body = `<button class="btn wide phist" data-act="prof-hist"${p.hist ? '' : ' disabled'}>Game history${nh != null ? ` (${nh})` : ''}</button>
      ${card}${sideTable}<h3 class="hh">Mini-games</h3><p class="hint">Squares won and lost in ${what}. Only squares that ended claimed count.</p>${table}`;   // the game history first, then the stats
  }
  return `<main class="scr setup acct-scr prof-scr">
    <div class="bar"><button class="back" data-act="prof-back" aria-label="Back">${CHEV}${backLabel}</button>
      <div class="ttl"><b>${own ? 'My Stats' : esc(u ? u.username : 'Profile')}</b><small>${own ? esc(u ? u.username : '') : 'Player profile'}</small></div></div>
    <div class="setup-box" data-keep-scroll="profile">${body}${own ? '<button class="link wide" data-act="logout">Log out</button>' : ''}</div></main>`;
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
  return `<span class="hsnap" aria-hidden="true">${own.map(o => `<i class="${o}${o && o === me ? ' mine' : ''}">${o}</i>`).join('')}</span>`;
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
      ${histSnap(h)}<span class="hres">${r}</span><span class="hvs"><span class="hname">vs ${esc(h.opponent && h.opponent.name || '?')}</span><small>${HOW_TEXT[h.how] || ''} · ${fmtDate(h.date)}</small></span><span class="hmeta">${h.side === 'X' || h.side === 'O' ? `<i class="hyou ${h.side}">You: ${h.side}</i>` : ''}<i class="badge ${h.mode}">${MODE_TEXT[h.mode] || ''}</i>${chg}</span></button>`;
  }).join('')}</div>`;
  return `<main class="scr setup acct-scr prof-scr">
    <div class="bar"><button class="back" data-act="profile" data-uid="${esc(p.uid || '')}" aria-label="Back to the stats">${CHEV}Stats</button>
      <div class="ttl"><b>Game history</b><small>${esc(u ? u.username : '')}</small></div></div>
    <div class="setup-box" data-keep-scroll="profhist">${list}</div></main>`;
}

// Setters for the names other modules reassign (an imported name is read-only there).
export function setHist(v) { hist = v; }
export function setProf(v) { prof = v; }
