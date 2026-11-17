// The Find Match screen and its intro.
import { acct } from '../../net/accounts.js';
import { OFFER_MS, mmIntro, search } from '../../net/matchmaking.js';
import { bubble, burstBadge, cap, panel, rays } from '../comic.js';
import { burstSvg } from '../fx.js';
import { startShuffle } from '../../net/room.js';
import { net } from '../../net/room.js';
import { esc, state } from '../app.js';
import { CHEV, toon } from '../art.js';
import { fmtClock } from '../clock.js';
import { RATINGS_ENABLED } from '../config.js';
import { record } from './profile.js';

export function renderIntro() {
  const sh = !mmIntro ? startShuffle() : null;
  if (sh) return `<div class="vsintro shuffle" role="dialog" aria-label="Drawing sides"><div class="vscard"><h2 class="vstitle">Drawing sides…</h2><div class="vsp"><span class="vsflip a">${toon('X')}${toon('O')}</span><b>${esc(sh.a)}</b></div><div class="vsmid">VS</div><div class="vsp"><span class="vsflip b">${toon('O')}${toon('X')}</span><b>${esc(sh.b)}</b></div>
    <p class="hint">Starting the match…</p></div></div>`;   // the host's Start, at once: the sides drawn while the server makes the match (net/room.js startShuffle)
  if (!mmIntro || state.screen !== 'board') return '';
  const me = mmIntro.me;
  const side = s => { const p = mmIntro.players[s] || {}; return `<div class="vsp ${s}">${toon(s)}<b>${esc(p.name || s)}</b>${p.record ? `<small>${record(p.record)}</small>` : ''}${me === s ? '<i>You</i>' : ''}</div>`; };
  const title = me ? `You are ${me}` : `${esc((mmIntro.players.X || {}).name || 'X')} is X · ${esc((mmIntro.players.O || {}).name || 'O')} is O`;
  return `<div class="vsintro" data-act="intro-close" role="dialog" aria-label="${me ? `You are ${me}` : 'Who plays X and O'}"><div class="vscard"><h2 class="vstitle">${title}</h2>${side('X')}<div class="vsmid">VS</div>${side('O')}
    <p class="hint">${me === 'X' ? 'You go first' : `${esc((mmIntro.players.X || {}).name || 'X')} goes first`}</p></div></div>`;
}
// Comic Chaos (December 2026): a VS card (this player's character, name and record against a rival still to come: a
// "?" that shakes while the search runs, the rival's character once found), the state shouted under it (Searching… with
// its clock in a caption box; Match found! on a burst with the rays behind), Cancel a white panel, the computer's offer
// a bubble and a yellow panel. Information is flat (the card, the clock, the bubbles); the panels are the taps.
export function renderFind() {
  const p = acct.profile || {}, me = esc(p.username || 'You'), rec = RATINGS_ENABLED ? `rating ${p.rating || 1200}` : `record ${record(p)}`;
  const back = `<div class="bar">${search.on ? '' : `<button class="back" data-act="menu" aria-label="Back to the main menu">${CHEV}Menu</button>`}<div class="ttl"><b>Find Match</b></div></div>`;
  const card = found => `<div class="fmcard${found ? ' found' : ''}"><div class="fmside"><span class="fmface">${toon('X')}</span><b>${me}</b>${cap(rec, 'fmrec')}</div>
      <span class="fmvs" aria-hidden="true">${burstSvg('VS', 'w', 120, 80, 40)}</span>
      <div class="fmside">${found ? `<span class="fmface">${toon('O')}</span><b>Rival</b>${cap('found!', 'fmrec')}` : '<span class="fmface fmq" aria-hidden="true">?</span><b>Rival</b>' + cap('searching', 'fmrec')}</div></div>`;
  if (search.found) {
    return `<main class="scr setup acct-scr find-scr cc calm">${back}<div class="setup-box"><div class="searching found" role="status">${card(true)}
      <div class="fmshout">${rays()}${burstBadge('Match found!', 'y fmbang')}</div><p class="fmhint">${esc(net.msg || 'Loading the match…')}</p></div></div></main>`;
  }
  if (search.on) {
    return `<main class="scr setup acct-scr find-scr cc calm">${back}<div class="setup-box"><div class="searching" role="status" aria-live="polite">${card(false)}
      <div class="fmshout"><h2>Searching…</h2>${cap(`<span id="mmwait">${fmtClock(Date.now() - search.since)}</span>`, 'fmclock')}</div>
      ${search.msg ? `<div class="warn">${esc(search.msg)}</div>` : ''}
      ${Date.now() - search.since >= OFFER_MS ? `<div class="botoffer">${bubble('No one around right now.', '')}${panel('search-bot', 'Play the Computer', { tag: 'while you wait', cls: 'y', k: 1, attrs: search.bot ? ' disabled' : '', aria: 'Play the computer instead (it is not a person)' })}</div>` : ''}
      ${panel('search-cancel', 'Cancel', { cls: 'w fmcancel', k: 2 })}</div></div></main>`;
  }
  // (not searching: only if a search could not start; Search tries again)
  return `<main class="scr setup acct-scr find-scr cc calm">${back}<div class="setup-box"><div class="searching" role="status">${card(false)}
      ${search.msg ? `<div class="warn">${esc(search.msg)}</div>` : ''}
      ${panel('search-go', 'Search', { cls: 'y fmgo', k: 2 })}</div></div></main>`;
}
