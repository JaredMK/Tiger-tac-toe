// A game's settings versions (December 2026): every Save or Reset of a game's settings on the admin page makes a new version
// (config/versions/<type> its number, config/versionLog/<type>/v<n> what changed: admin.js bumpVersion, core/tune.js), and a
// square is filed under the version it was dealt with. This is the card on a game's page that shows the version and the log
// of its saves; the game's numbers by version are the metrics layer's (metrics.js gameStats), drawn below it (pages.js).
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const dt = t => (t ? new Date(t).toISOString().slice(0, 10) : '');
export const curVersion = (versions, type) => { const v = Number(versions && versions[type]); return Number.isInteger(v) && v >= 1 ? v : 1; };
// A version's log line: when and what changed ({ at, by, ch: { key: { from, to } } }), as text.
export function changeText(entry, labelOf) {
  const ch = (entry && entry.ch) || {}, keys = Object.keys(ch);
  if (!keys.length) return entry && entry.note ? String(entry.note) : 'no setting changed (a reset or a tuning card)';
  return keys.map(k => `${labelOf ? labelOf(k) : k}: ${ch[k].from} → ${ch[k].to}`).join('; ');
}
// A game's own page (admin.js gamePage): its settings version and the log of its saves.
export function versionCard(type, versions, log, labelOf) {
  const cur = curVersion(versions, type), entries = Object.entries((log && log[type]) || {}).map(([k, e]) => [Number(k.slice(1)), e]).filter(([v]) => v >= 2).sort((a, b) => b[0] - a[0]);
  const lines = entries.map(([v, e]) => `<li><b>v${v}</b> ${esc(dt(e.at))}${e.by ? ` <small>${esc(e.by)}</small>` : ''}: ${esc(changeText(e, labelOf))}</li>`).join('');
  return `<div class="card"><h3>Settings version ${cur}</h3><p class="note">Every Save (or Reset) makes a new version; squares dealt from then on are filed under it, so the game's numbers below can be read by version. v1: the settings before versions were kept.</p>${lines ? `<ul class="vlog">${lines}</ul>` : '<p class="note">No save since versions were kept.</p>'}</div>`;
}
