// Where the game runs: the web page, or the iOS app (the same files in a Capacitor shell: docs/ios-plan.md). Everything
// that differs between the two goes through here, so nothing else assumes a browser tab: the client it reports (core/client.js),
// sharing, opening a page outside the game, links that open the game (a join link: the address it loaded with, or a
// deep link handed to the app while it runs), and where "Please update" sends a player.
import { CLIENT_VERSION } from '../core/client.js';
import { KEY } from '../ui/config.js';

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
// The privacy policy (privacy.html beside the page; scripts/build-site.js copies it to both sites and into the app's build):
// the page's own copy on the web (a relative link, whichever site this is), the live site's in the app (a page inside the
// app opens in its in-app browser, initPlatform below; its own address, capacitor://localhost, is no address to send anyone to).
export function privacyUrl() { return NATIVE ? siteUrl() + 'privacy.html' : 'privacy.html'; }
// Share a text (the invite): the share sheet (the app's Share plugin, or the browser's), else false (the caller copies it).
export async function shareText(text) {
  const sh = plugin('Share');
  if (sh) { await sh.share({ text }); return true; }
  if (typeof navigator !== 'undefined' && navigator.share) { await navigator.share({ text }); return true; }
  return false;
}
// Share a file with a text (the result card, ui/sharecard.js): the app's Share plugin (the file written to the device's
// cache first, through its Filesystem plugin, since the plugin shares a file by its url), or the browser's share sheet where
// it takes files (navigator.canShare), else false (the caller saves the file and copies the text).
export async function shareFile(blob, name, text) {
  const type = blob.type || 'image/png';
  const sh = plugin('Share'), fsys = plugin('Filesystem');
  if (sh && fsys) {
    const w = await fsys.writeFile({ path: name, data: await blobBase64(blob), directory: 'CACHE' });
    if (w && w.uri) { await sh.share({ text, files: [w.uri] }); return true; }
  }
  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare && typeof File === 'function') {
    const files = [new File([blob], name, { type })];
    if (navigator.canShare({ files })) { await navigator.share({ files, text }); return true; }
  }
  return false;
}
const blobBase64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
// Save a file on the web (a download link clicked); the app has no downloads (its share sheet offers Save Image).
export function downloadFile(blob, name) {
  if (NATIVE) return false;
  try {
    const u = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u; a.download = name; a.rel = 'noopener'; a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 5000);
    return true;
  } catch (e) { return false; }
}
// Copy a text (the invite): the app's Clipboard plugin, or the browser's clipboard.
export async function copyText(text) {
  const cb = plugin('Clipboard');
  if (cb) { await cb.write({ string: text }); return; }
  await navigator.clipboard.writeText(text);
}
// A buzz under the finger: the app's Haptics plugin (its distinct styles), or a phone browser's vibration
// (navigator.vibrate, where it has one; nothing where it has not, as Safari). The kinds (the moments: ui/haptics.js):
//   'tap'     light impact: a move made on this phone (a mark placed, a card turned, a letter guessed), a square opened
//   'medium'  medium impact: a result landing (a die, a spin, a hit, a bump), a square claimed on the board
//   'success' the success pattern: a mini-game won;   'win' a heavy impact then success: the match won
//   'error'   the error pattern: a refused move, a bust or crash, a square lost;   'loss' the same: the match lost
//   'turn'    two quick pulses: the turn coming to this player (ui/turns.js turnAlert)
// Each fires once, from its event (the sound's and the animation's), never from a render; none at all with Settings'
// Vibration off (vibOn). Short, and thinned in rapid play: within 70 ms of a buzz as strong or stronger, none.
const HAPTIC = {
  tap: [['impact', 'LIGHT']], medium: [['impact', 'MEDIUM']], claim: [['impact', 'MEDIUM']],
  success: [['notification', 'SUCCESS']], win: [['impact', 'HEAVY'], ['notification', 'SUCCESS', 120]],
  error: [['notification', 'ERROR']], loss: [['notification', 'ERROR']],
  turn: [['impact', 'MEDIUM'], ['impact', 'MEDIUM', 110]],
};
const WEB_VIBE = { tap: 8, medium: 18, claim: 18, success: [20, 50, 30], win: [40, 50, 90], error: [45, 40, 45], loss: [70, 50, 70], turn: [22, 80, 22] };   // (ms: a browser's buzz is all or nothing, so length stands for strength)
const HAPTIC_RANK = { tap: 1, medium: 2, claim: 2, success: 3, error: 3, win: 4, loss: 4, turn: 3 };
export const HAPTIC_GAP_MS = 70;
let lastBuzz = { at: -1e9, rank: 0 };
const VIB_KEY = KEY + '.vib';
export let vibOn = (() => { try { return localStorage.getItem(VIB_KEY) !== 'off'; } catch (e) { return true; } })();
export function setVibOn(on) { vibOn = !!on; try { localStorage.setItem(VIB_KEY, vibOn ? 'on' : 'off'); } catch (e) { /* no storage: this visit */ } }
const webVibe = () => !NATIVE && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
// Whether this device can buzz at all (Settings shows Vibration only then): the app, or a browser with vibration.
export function canVibrate() { return !!plugin('Haptics') || webVibe(); }
export function haptic(kind) {
  if (!vibOn || !HAPTIC[kind]) return false;
  const now = Date.now(), rank = HAPTIC_RANK[kind];
  if (now - lastBuzz.at < HAPTIC_GAP_MS && lastBuzz.rank >= rank) return false;   // (rapid play: one buzz, not a hum)
  lastBuzz = { at: now, rank };
  const h = plugin('Haptics');
  try {
    if (h) {
      for (const [how, v, after] of HAPTIC[kind]) {
        const go = () => { const p = how === 'notification' ? h.notification({ type: v }) : h.impact({ style: v }); if (p && p.catch) p.catch(() => {}); };
        if (after) setTimeout(go, after); else go();
      }
      return true;
    }
    if (webVibe()) return navigator.vibrate(WEB_VIBE[kind]) !== false;
  } catch (e) { /* (a buzz is never worth an error) */ }
  return false;
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
