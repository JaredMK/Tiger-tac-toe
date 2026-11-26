// Compare environments (November 2026): the admin page's #envs. The admin's settings on staging and production side by
// side (read by the server, functions/index.js envCompare: never a key in the page), the differences by default (Show
// all for every setting), grouped by game and section; each row copies that one setting either way (envCopy), after a
// confirm that shows exactly what the target holds now and what it will hold. Release switches are marked: they change
// what live players are dealt. Pure: HTML from the data and the page's state (admin.js draws it and handles the taps).
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const flatten = (v, at, out = {}) => {
  if (v && typeof v === 'object') { for (const k of Object.keys(v)) flatten(v[k], `${at}/${k}`, out); return out; }
  if (v !== null && v !== undefined) out[at] = v;
  return out;
};
export const same = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);
const CARD_GAME = { wheels: 'wheels', pig: 'pig', bulls: 'bullseye', plinko: 'plinko', oddone: 'oddone', headcount: 'headcount', flash: 'flash', snapshot: 'snapshot', skyhop: 'skyhop', scoop: 'scoop', pinball: 'pinball', roads: 'roads', bowling: 'bowling' };
const SECTION = { features: 'Find Match', 'config/ai': 'Computer difficulty', 'config/anim': 'Pace', 'config/timer': 'Timer', 'config/run': 'Runners (Dash, Lane Rush, Flap, Chopper)', 'admin/config': 'Bots and alerts' };
const REL_WORD = { platform: 'Off on', soon: 'Coming soon', leaving: 'Leaving soon', retire: 'Remove from rotation', depri: 'Deprioritized' };
// A setting's place: { group (a game's id or a section's name), game, label, release }.
export function placeOf(path, games) {
  const p = path.split('/');
  if (p[0] === 'releases') {
    if (p[1] === 'superchaos') return { group: 'Classic / Super Chaos', label: 'Super Chaos switch', release: true };
    if (games[p[1]] && p.length === 2) return { group: p[1], game: p[1], label: 'Released', release: true };
    if (p[1] === 'platform') return { group: games[p[3]] ? p[3] : 'Releases', game: games[p[3]] ? p[3] : null, label: `Released on ${p[2] === 'ios' ? 'iOS' : p[2]}`, release: true };
    if (p[1] === 'retire') return { group: games[p[3]] ? p[3] : 'Releases', game: games[p[3]] ? p[3] : null, label: `${REL_WORD.retire} (${p[2] === 'all' ? 'all platforms' : p[2] === 'ios' ? 'iOS' : p[2]})`, release: true };
    if (REL_WORD[p[1]] && games[p[2]]) return { group: p[2], game: p[2], label: REL_WORD[p[1]] + (p.length > 3 ? ' · ' + p.slice(3).join(' · ') : ''), release: true };
    return { group: 'Releases', label: p.slice(1).join(' · '), release: true };
  }
  if (p[0] === 'config' && (p[1] === 'tune' || p[1] === 'lineup') && games[p[2]]) return { group: p[2], game: p[2], label: (p[1] === 'lineup' ? 'Lineup card · ' : '') + p.slice(3).join(' · '), key: p[1] === 'tune' ? p[3] : null };
  if (p[0] === 'config' && CARD_GAME[p[1]]) return { group: CARD_GAME[p[1]], game: CARD_GAME[p[1]], label: 'Tuning card · ' + p.slice(2).join(' · ') };
  const root = SECTION[p[0]] ? p[0] : p.slice(0, 2).join('/');
  return { group: SECTION[root] || root, label: p.slice(root.split('/').length).join(' · ') || root };
}
// Every setting either side has, as rows: { path, group, game, label, release, stage, prod, diff, tStage, tProd }.
export function envRows(data, games) {
  const side = env => (data.here.env === env ? data.here : data.peer.env === env ? data.peer : null);
  const S = side('staging') || data.peer, P = side('production') || data.here;
  const flat = v => { const out = {}; for (const r of data.roots) flatten(v && v.values ? v.values[r] : null, r, out); return out; };
  const fs = flat(S), fp = flat(P);
  const lastOf = (t, path, game) => {
    let at = game && t && t.tune ? t.tune[game] || null : null;
    for (const e of (t && t.log) || []) if (e && e.path === path && (!at || e.at > at)) at = e.at;
    return at;
  };
  return Array.from(new Set(Object.keys(fs).concat(Object.keys(fp)))).sort().map(path => {
    const pl = placeOf(path, games), tg = path.startsWith('config/tune/') ? pl.game : null;
    return Object.assign({ path, stage: fs[path], prod: fp[path], diff: !same(fs[path], fp[path]), tStage: lastOf(S.times, path, tg), tProd: lastOf(P.times, path, tg) }, pl);
  });
}
const show = v => (v === undefined || v === null ? '<i class="dim">not set</i>' : `<code>${esc(JSON.stringify(v))}</code>`);
const when = t => (t ? new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–');
// The page: c { data, err, all, ask, msg, busy, names (games), gameIcon, label(game, key) }.
export function envsPage(c) {
  const top = `<div class="card ctl"><h2>Compare environments</h2><p class="note">Staging and production's admin settings side by side. Copy one setting at a time; each copy asks first and is logged on both. Release switches (marked <b class="relmark">LIVE</b>) change what players are dealt.</p>
    <div class="row"><label class="chkl"><input type="checkbox" data-envall${c.all ? ' checked' : ''}> Show all settings (not only differences)</label><button class="btn sm" data-envload${c.busy ? ' disabled' : ''}>${c.busy ? 'Reading…' : 'Read again'}</button></div>${c.msg ? `<p class="note" role="status">${esc(c.msg)}</p>` : ''}</div>`;
  if (c.err) return top + setupCard(c.err);
  if (!c.data) return top + '<div class="card"><p>Reading both environments…</p></div>';
  const rows = envRows(c.data, c.names), shown = rows.filter(r => c.all || r.diff);
  const diffs = rows.filter(r => r.diff).length, rel = rows.filter(r => r.diff && r.release).length;
  const groups = new Map();
  for (const r of shown) { if (!groups.has(r.group)) groups.set(r.group, []); groups.get(r.group).push(r); }
  const gname = g => (c.names[g] ? `${c.gameIcon ? c.gameIcon(g) : ''}${esc(c.names[g])}` : esc(g));
  const order = Array.from(groups.keys()).sort((a, b) => (groups.get(b).some(r => r.release && r.diff) - groups.get(a).some(r => r.release && r.diff)) || String(c.names[a] || a).localeCompare(String(c.names[b] || b)));
  const lbl = r => esc(r.key && c.label ? c.label(r.game, r.key) || r.label : r.label);
  const row = r => `<tr class="${r.diff ? 'envdiff' : ''}${r.release ? ' envrel' : ''}"><td style="text-align:left">${r.release ? '<b class="relmark" title="A release switch: live players">LIVE</b> ' : ''}${lbl(r)}<br><small class="dim">${esc(r.path)}</small></td>
    <td style="text-align:left">${show(r.stage)}</td><td style="text-align:left">${show(r.prod)}</td><td style="text-align:left;white-space:nowrap"><small>S ${when(r.tStage)}<br>P ${when(r.tProd)}</small></td>
    <td style="white-space:nowrap"><button class="btn sm${r.release ? ' warn' : ''}" data-envcopy="production" data-path="${esc(r.path)}"${r.diff ? '' : ' disabled'}>Copy to production</button> <button class="btn sm" data-envcopy="staging" data-path="${esc(r.path)}"${r.diff ? '' : ' disabled'}>Copy to staging</button></td></tr>`;
  const body = shown.length ? order.map(g => `<div class="card"><h3>${gname(g)}${groups.get(g).some(r => r.release && r.diff) ? ' <b class="relmark">LIVE</b>' : ''}</h3><div class="tbl"><table><thead><tr><th style="text-align:left">Setting</th><th style="text-align:left">Staging</th><th style="text-align:left">Production</th><th style="text-align:left">Last changed</th><th></th></tr></thead><tbody>${groups.get(g).map(row).join('')}</tbody></table></div></div>`).join('')
    : '<div class="card"><p>No differences: staging and production hold the same settings.</p></div>';
  return top + `<div class="card"><p><b>${diffs}</b> setting${diffs === 1 ? '' : 's'} differ${diffs === 1 ? 's' : ''}${rel ? `, <b class="relwarn">${rel} of them release switch${rel === 1 ? '' : 'es'}</b>` : ''} · ${rows.length} settings in all. You are on ${esc(c.data.here.env)}.</p></div>` + body + (c.ask ? askCard(c.ask) : '');
}
// The confirm: exactly what the target holds now and what it will hold.
function askCard(a) {
  return `<div class="envask" role="dialog" aria-modal="true" aria-label="Copy this setting?"><div class="card"><h2>Copy to ${esc(a.to)}?</h2>
    <p><code>${esc(a.path)}</code>${a.release ? ' <b class="relmark">LIVE</b> a release switch: live players see it at once' : ''}</p>
    <table class="envba"><tr><th>${esc(a.to)} now</th><td>${show(a.was)}</td></tr><tr><th>${esc(a.to)} after</th><td>${show(a.from)}</td></tr></table>
    <div class="row"><button class="btn" data-envno>Cancel</button><button class="btn go${a.release ? ' warn' : ''}" data-envyes${a.busy ? ' disabled' : ''}>${a.busy ? 'Copying…' : `Copy to ${esc(a.to)}`}</button></div></div></div>`;
}
function setupCard(err) {
  const d = err.details || {};
  if (!d.setup) return `<div class="card"><p class="err">${esc(err.message || 'Could not read the environments.')}</p></div>`;
  return `<div class="card"><h3>One-time setup</h3><p>This environment's server can't read ${esc(d.peer || 'the other project')} yet. Give its service account access to the other project's database (once per direction), then read again:</p>
    <pre>gcloud projects add-iam-policy-binding ${esc(d.peer || '&lt;other project&gt;')} \\\n  --member=serviceAccount:${esc(d.account || '&lt;this project\'s functions service account&gt;')} \\\n  --role=${esc(d.role || 'roles/firebasedatabase.admin')}</pre>
    <p class="note">Or in the Google Cloud console: ${esc(d.peer || 'the other project')} → IAM → Grant access → that account → Firebase Realtime Database Admin. Nothing secret is stored or sent to this page.</p></div>`;
}
