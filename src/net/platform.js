// Where the game runs: the web page, or the iOS app (the same files in a Capacitor shell: docs/ios-plan.md). Everything
// that differs between the two goes through here, so nothing else assumes a browser tab: the client it reports (core/client.js),
// sharing, opening a page outside the game, links that open the game (a join link: the address it loaded with, or a
// deep link handed to the app while it runs), and where "Please update" sends a player.
import { CLIENT_VERSION } from '../core/client.js';

const cap = () => (typeof window !== 'undefined' && window.Capacitor) || null;
// The platform: 'ios' inside the app, 'web' anywhere else (a browser, the home screen, the tests).
export const PLATFORM = (() => { try { const c = cap(); return c && c.isNativePlatform && c.isNativePlatform() === true && c.getPlatform() === 'ios' ? 'ios' : 'web'; } catch (e) { return 'web'; } })();
export const NATIVE = PLATFORM !== 'web';
const plugin = name => { const c = NATIVE && cap(); return (c && c.Plugins && c.Plugins[name]) || null; };   // (the app's native plugins: never on the web)
export const clientInfo = () => ({ v: CLIENT_VERSION, p: PLATFORM });
// The game's public address (links and invites point here, wherever the game runs): the page's own on the web (staging's
// on staging), the production site's in the app (its own address is capacitor://localhost, which no one else can open).
export function siteUrl() {
  if (!NATIVE && typeof location !== 'undefined' && /^https?:$/.test(location.protocol)) return location.origin + location.pathname;
  const env = typeof window !== 'undefined' && window.TTC_ENV;
  return env && env.staging ? 'https://staging.tictacchaos.com/' : 'https://tictacchaos.com/';
}
// Share a text (the invite): the share sheet (the app's Share plugin, or the browser's), else false (the caller copies it).
export async function shareText(text) {
  const sh = plugin('Share');
  if (sh) { await sh.share({ text }); return true; }
  if (typeof navigator !== 'undefined' && navigator.share) { await navigator.share({ text }); return true; }
  return false;
}
// Copy a text (the invite): the app's Clipboard plugin, or the browser's clipboard.
export async function copyText(text) {
  const cb = plugin('Clipboard');
  if (cb) { await cb.write({ string: text }); return; }
  await navigator.clipboard.writeText(text);
}
// A buzz under the finger, in the app only (the Haptics plugin; nothing on the web, no navigator.vibrate): 'tap' a square
// opened, 'claim' a square stamped on the board, 'win' and 'loss' the match's end. Each fires once, from its event (the
// click handler's tap, fx.js stampFx, turns.js toWin), never from a render.
const HAPTIC_IMPACT = { tap: 'LIGHT', claim: 'HEAVY' }, HAPTIC_NOTE = { win: 'SUCCESS', loss: 'ERROR' };
export function haptic(kind) {
  const h = plugin('Haptics');
  if (!h) return false;
  try {
    const p = HAPTIC_NOTE[kind] ? h.notification({ type: HAPTIC_NOTE[kind] }) : h.impact({ style: HAPTIC_IMPACT[kind] || 'MEDIUM' });
    if (p && p.catch) p.catch(() => {});
  } catch (e) { /* (a buzz is never worth an error) */ }
  return true;
}
// A page outside the game (credits' sources, the privacy policy, the App Store): the app's in-app browser, or a new tab.
export function openExternal(url) {
  const br = plugin('Browser');
  if (br) { br.open({ url }).catch(() => {}); return; }
  try { window.open(url, '_blank', 'noopener'); } catch (e) { /* (blocked: nothing else to do) */ }
}
// At the start: in the app, a link out of the game (credits, the studio's page: <a href="https://…" target="_blank">) opens in
// the in-app browser instead of replacing the game in its web view.
export function initPlatform() {
  if (!NATIVE) return;
  document.addEventListener('click', e => {
    const a = e.target && e.target.closest && e.target.closest('a[href^="http"]');
    if (!a) return;
    e.preventDefault(); openExternal(a.href);
  }, true);
}
// The links that open the game. The address it loaded with (the web page's own, read once at the start), then, in the app,
// every deep link it is handed while it runs (a Universal Link to tictacchaos.com/?room=CODE: the App plugin's appUrlOpen).
export function startLink() { try { return typeof location !== 'undefined' ? location.href : ''; } catch (e) { return ''; } }
export function onAppLink(fn) {
  const app = plugin('App');
  if (app && app.addListener) app.addListener('appUrlOpen', e => { if (e && e.url) fn(e.url); });
}
// The address with the link's parts taken out (handled once: going back or reopening the page is not a second link).
export function tidyLink(keep) {
  if (NATIVE) return;
  try { const u = new URL(location.href); for (const k of [...u.searchParams.keys()]) if (!keep || !keep.includes(k)) u.searchParams.delete(k); history.replaceState(history.state, '', u.pathname + u.search + u.hash); } catch (e) { /* (an old browser keeps it) */ }
}
// One part of the address taken out (a playtester's ?t=: kept on the device, gone from the address).
export function dropParam(k) {
  if (NATIVE) return;
  try { const u = new URL(location.href); if (!u.searchParams.has(k)) return; u.searchParams.delete(k); history.replaceState(history.state, '', u.pathname + u.search + u.hash); } catch (e) { /* (kept) */ }
}
// "Please update": the App Store in the app (its id, once it has one: docs/ios-plan.md); the web page loads the latest by itself.
export const APP_STORE_ID = '';   // (its Apple id, set once the app is made in App Store Connect)
export function openUpdate() {
  if (NATIVE) { openExternal(APP_STORE_ID ? `https://apps.apple.com/app/id${APP_STORE_ID}` : 'https://apps.apple.com/'); return; }
  try { location.reload(); } catch (e) { /* (nothing else to do) */ }
}
