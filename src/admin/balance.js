// The admin's Balance report and the stats by settings version (December 2026). Pure: the numbers come from the server's
// counters (stats/bal: functions/statsRules.js balanceUpdates) and, for version 1, the older totals (stats/mini: sums only),
// the version numbers and their log from config/versions and config/versionLog (core/tune.js). admin.js draws the page.
//
// stats/bal/sq/{type}/v{n}/{day}/{seg}/ { n, won, draw, open, moves, fd, fm, wm/m{k}, tn, tsum, t/s{edge} }
// stats/bal/ml/{day}/{seg}/{mode}/{timer}/{fin|ab}/ { n, tsum, turns/t{edge}, mn, msum, mi/m{edge} }
// seg 'p': only players; 'a': an admin played in the match. Practice and Test play are never reported (nothing to filter).

export const FLAG_MOVES = 6, FLAG_SAMPLE = 30;
export const MODE_LABEL = { cpu: 'vs Computer', local: 'Same phone', friend: 'Friend', match: 'Find Match', bot: 'Find Match vs computer', cvc: 'Computer vs computer', casual: 'Find Match (old casual)', ranked: 'Find Match (old ranked)' };
export const MODE_GROUP = { cpu: 'vs Computer', local: 'Friend', friend: 'Friend', match: 'Find Match', bot: 'Find Match', casual: 'Find Match', ranked: 'Find Match' };
const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

// ---------- histograms ----------
// A histogram as the server keeps it ({ m5: 3, s30: 2, ... }: the key's number is the value, or the bucket's upper edge)
// as sorted [value, count] pairs.
export function histPairs(h) {
  return Object.entries(h && typeof h === 'object' ? h : {}).map(([k, c]) => [Number(String(k).replace(/^[a-z]+/i, '')), num(c)]).filter(([v, c]) => Number.isFinite(v) && c > 0).sort((a, b) => a[0] - b[0]);
}
export function histAdd(into, h) { for (const [k, c] of Object.entries(h && typeof h === 'object' ? h : {})) into[k] = num(into[k]) + num(c); return into; }
// The q-th quantile (0..1). exact: the values are the values themselves (moves); else each bucket spans from the edge
// before it to its own edge and the quantile is placed in it linearly (times, turns, minutes). null when empty.
export function quantile(h, q, exact, edges) {
  const pairs = histPairs(h), total = pairs.reduce((n, [, c]) => n + c, 0);
  if (!total) return null;
  const want = q * total;
  let seen = 0;
  for (let i = 0; i < pairs.length; i++) {
    const [v, c] = pairs[i];
    if (seen + c >= want) {
      if (exact) return v;
      const lo = prevEdge(edges, v), hi = v === 9999 ? lo * 1.5 : v;
      return lo + (hi - lo) * Math.min(1, Math.max(0, (want - seen) / c));
    }
    seen += c;
  }
  return pairs[pairs.length - 1][0];
}
function prevEdge(edges, v) { const e = (edges || []).filter(x => x < v); return e.length ? e[e.length - 1] : 0; }
export const SQ_SECS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 300, 420, 600, 900, 1200, 1800, 3600];
export const MATCH_TURNS = [10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 100, 120, 160, 200];
export const MATCH_MINS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 90, 120, 180];
const histMean = h => { const p = histPairs(h), n = p.reduce((s, [, c]) => s + c, 0); return n ? p.reduce((s, [v, c]) => s + v * c, 0) / n : null; };

// ---------- filters ----------
// opts: { from, to } ('YYYY-MM-DD', inclusive, either may be empty), admin (true: an admin's matches included; default
// false: left out).
const inRange = (day, o) => (!o.from || day >= o.from) && (!o.to || day <= o.to);
const segs = o => (o.admin ? ['p', 'a'] : ['p']);
// One version's square counters over the days and segments the filters keep, summed.
export function sqSum(vNode, o) {
  o = o || {};
  const out = { n: 0, won: 0, draw: 0, open: 0, moves: 0, fd: 0, fm: 0, tn: 0, tsum: 0, wm: {}, t: {} };
  for (const [day, bySeg] of Object.entries(vNode && typeof vNode === 'object' ? vNode : {})) {
    if (!inRange(day, o)) continue;
    for (const s of segs(o)) {
      const c = bySeg && bySeg[s];
      if (!c) continue;
      for (const k of ['n', 'won', 'draw', 'open', 'moves', 'fd', 'fm', 'tn', 'tsum']) out[k] += num(c[k]);
      histAdd(out.wm, c.wm); histAdd(out.t, c.t);
    }
  }
  return out;
}
// A game's row: the sample, the winner's moves and the time in the square (25th percentile, median, 75th), the rates.
export function sqRow(sum) {
  const s = sum || sqSum(null), rate = (a, b) => (b ? a / b : null);
  const row = {
    n: s.n, won: s.won, draw: s.draw, open: s.open,
    moves: { p25: quantile(s.wm, 0.25, true), med: quantile(s.wm, 0.5, true), p75: quantile(s.wm, 0.75, true), mean: histMean(s.wm) },
    secs: { p25: quantile(s.t, 0.25, false, SQ_SECS), med: quantile(s.t, 0.5, false, SQ_SECS), p75: quantile(s.t, 0.75, false, SQ_SECS), mean: s.tn ? s.tsum / s.tn : null, n: s.tn },
    openRate: rate(s.open, s.n), resetRate: rate(s.draw, s.n), firstMover: rate(s.fm, s.fd), firstMoverN: s.fd,
  };
  row.flags = [];
  if (row.moves.med != null && row.moves.med > FLAG_MOVES) row.flags.push('slow');
  if (s.n < FLAG_SAMPLE) row.flags.push('small');
  return row;
}
// Version 1's older totals (stats/mini/{mode}/{type}: sums only, from before versions were kept; every mode but Super
// Chaos, the admin's own play included, no dates): the averages they allow.
export function legacyRow(mini, type) {
  const s = { played: 0, won: 0, draw: 0, open: 0, winMoves: 0, xWins: 0, oWins: 0 };
  for (const [mode, byType] of Object.entries(mini && typeof mini === 'object' ? mini : {})) {
    if (mode === 'chaos' || mode === 'testingSc') continue;
    const c = byType && byType[type];
    if (c) for (const k of Object.keys(s)) s[k] += num(c[k]);
  }
  return { n: s.played, won: s.won, draw: s.draw, open: s.open, movesMean: s.won ? s.winMoves / s.won : null, openRate: s.played ? s.open / s.played : null, resetRate: s.played ? s.draw / s.played : null, legacy: true };
}

// ---------- versions ----------
export const curVersion = (versions, type) => { const v = Number(versions && versions[type]); return Number.isInteger(v) && v >= 1 ? v : 1; };
// The versions a game has stats for (and its current one), newest first.
export function versionsOf(balSq, versions, type) {
  const vs = new Set([curVersion(versions, type)]);
  for (const k of Object.keys((balSq && balSq[type]) || {})) { const v = Number(k.slice(1)); if (Number.isInteger(v) && v >= 1) vs.add(v); }
  return [...vs].sort((a, b) => b - a);
}
// A version's log line: when and what changed ({ at, by, ch: { key: { from, to } } }), as text.
export function changeText(entry, labelOf) {
  const ch = (entry && entry.ch) || {}, keys = Object.keys(ch);
  if (!keys.length) return entry && entry.note ? String(entry.note) : 'no setting changed (a reset or a tuning card)';
  return keys.map(k => `${labelOf ? labelOf(k) : k}: ${ch[k].from} → ${ch[k].to}`).join('; ');
}
// The comparison of a game's current version against the one before: the four measures side by side.
export function versionCompare(stats, versions, type, o) {
  const bal = (stats && stats.bal && stats.bal.sq) || {}, cur = curVersion(versions, type), prev = cur - 1;
  const row = v => sqRow(sqSum((bal[type] || {})['v' + v], o));
  const out = { type, cur, prev: prev >= 1 ? prev : null, now: row(cur), before: prev >= 1 ? row(prev) : null };
  if (prev === 1 || cur === 1) out.legacy = legacyRow(stats && stats.mini, type);   // (version 1's older totals: averages only)
  return out;
}

// ---------- match length ----------
// Every reported match the filters keep, by mode, timer and finished or abandoned: its turns and minutes (25th
// percentile, median, 75th).
export function matchRows(ml, o) {
  o = o || {};
  const acc = {};
  for (const [day, bySeg] of Object.entries(ml && typeof ml === 'object' ? ml : {})) {
    if (!inRange(day, o)) continue;
    for (const s of segs(o)) {
      for (const [mode, byTimer] of Object.entries((bySeg && bySeg[s]) || {})) {
        for (const [timer, byEnd] of Object.entries(byTimer || {})) {
          for (const [end, c] of Object.entries(byEnd || {})) {
            for (const key of [`${mode}|${timer}|${end}`, `${mode}|*|${end}`, `${MODE_GROUP[mode] || mode}|group|${end}`]) {
              const a = (acc[key] = acc[key] || { n: 0, tsum: 0, mn: 0, msum: 0, turns: {}, mi: {} });
              a.n += num(c.n); a.tsum += num(c.tsum); a.mn += num(c.mn); a.msum += num(c.msum); histAdd(a.turns, c.turns); histAdd(a.mi, c.mi);
            }
          }
        }
      }
    }
  }
  return Object.entries(acc).map(([key, a]) => {
    const [mode, timer, end] = key.split('|');
    return {
      mode, timer, end, n: a.n,
      turns: { p25: quantile(a.turns, 0.25, false, MATCH_TURNS), med: quantile(a.turns, 0.5, false, MATCH_TURNS), p75: quantile(a.turns, 0.75, false, MATCH_TURNS), mean: a.n ? a.tsum / a.n : null },
      mins: { p25: quantile(a.mi, 0.25, false, MATCH_MINS), med: quantile(a.mi, 0.5, false, MATCH_MINS), p75: quantile(a.mi, 0.75, false, MATCH_MINS), mean: a.mn ? a.msum / 60 / a.mn : null, n: a.mn },
    };
  }).sort((x, y) => (x.timer === 'group') - (y.timer === 'group') || x.mode.localeCompare(y.mode) || (x.timer === '*' ? -1 : y.timer === '*' ? 1 : x.timer.localeCompare(y.timer)) || x.end.localeCompare(y.end));
}

// ---------- the report ----------
// stats: the stats node; ctx: { versions, log, types (the games to list), names ({ type: name }), env }.
export function balanceReport(stats, ctx, o) {
  o = Object.assign({ admin: false, from: '', to: '', version: 'current' }, o || {});
  const bal = (stats && stats.bal) || {}, sq = bal.sq || {};
  const games = (ctx.types || []).map(type => {
    const cur = curVersion(ctx.versions, type);
    const pick = o.version === 'all' ? versionsOf(sq, ctx.versions, type) : o.version === 'previous' ? (cur > 1 ? [cur - 1] : []) : [cur];
    const sum = sqSum(null);
    for (const v of pick) { const s = sqSum((sq[type] || {})['v' + v], o); for (const k of Object.keys(s)) if (typeof s[k] === 'number') sum[k] += s[k]; histAdd(sum.wm, s.wm); histAdd(sum.t, s.t); }
    const entry = ctx.log && ctx.log[type] && ctx.log[type]['v' + cur];
    return Object.assign({ type, name: (ctx.names && ctx.names[type]) || type, version: cur, versions: pick, since: entry ? entry.at : null }, sqRow(sum), { compare: versionCompare(stats, ctx.versions, type, o) });
  });
  return { generatedAt: ctx.now || null, env: ctx.env || null, filters: { admin: !!o.admin, practice: false, testPlay: false, from: o.from || null, to: o.to || null, version: o.version }, games, matches: matchRows(bal.ml, o), notes: REPORT_NOTES };
}
export const REPORT_NOTES = [
  'Moves are a side\'s turns in the square (a bonus move within the same turn counts once).',
  'Time in the square: from the move before (anywhere on the board) to each move made in it, summed over the square; gaps over 2 minutes count as 2 minutes. Recorded from this version of the game on; squares from before have none.',
  'Left open: the match ended with the square unclaimed. Reset: the square ended level and a new game was dealt.',
  'First mover: of decided squares, the share won by the side that moved first in it.',
  'Flags: "slow" when the winner\'s median is above 6 moves; "small" when fewer than 30 squares.',
  'Practice and Test play are never recorded. Super Chaos matches are left out.',
];

// ---------- the page ----------
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const f1 = v => (v == null ? '—' : (Math.round(v * 10) / 10).toString());
const pc = v => (v == null ? '—' : Math.round(v * 100) + '%');
const secs = v => (v == null ? '—' : v < 90 ? Math.round(v) + 's' : (Math.round(v / 6) / 10) + 'm');
const trio = (o, fmt) => `${fmt(o.p25)} · <b>${fmt(o.med)}</b> · ${fmt(o.p75)}`;
const dt = t => (t ? new Date(t).toISOString().slice(0, 10) : '');
export function balanceHtml(rep, o) {
  o = o || {};
  const flag = r => r.flags.map(f => `<span class="bflag ${f}" title="${f === 'slow' ? 'Median above 6 moves' : 'Fewer than 30 squares'}">${f === 'slow' ? 'slow' : 'small sample'}</span>`).join('');
  const rows = rep.games.map(g => `<tr class="${g.flags.length ? 'flagged' : ''}"><th scope="row"><a href="#games/${esc(g.type)}">${esc(g.name)}</a> <small>v${g.version}${g.versions.length > 1 ? ' (all)' : ''}</small> ${flag(g)}</th>
    <td>${g.n}</td><td>${trio(g.moves, f1)}</td><td>${trio(g.secs, secs)}<small>${g.secs.n !== g.won ? ` (${g.secs.n} timed)` : ''}</small></td><td>${pc(g.openRate)}</td><td>${pc(g.resetRate)}</td><td>${pc(g.firstMover)}</td></tr>`).join('');
  const cmp = rep.games.filter(g => g.compare.before || g.compare.legacy).map(g => {
    const c = g.compare, b = c.before, L = c.legacy;
    const cell = (r, f) => (r ? f(r) : '—');
    return `<tr><th scope="row">${esc(g.name)}</th>
      <td>v${c.cur}: ${c.now.n}</td><td>${b ? `v${c.prev}: ${b.n}` : '—'}${L ? `<small> · older totals: ${L.n}</small>` : ''}</td>
      <td>${f1(c.now.moves.med)} / ${cell(b, r => f1(r.moves.med))}${L ? `<small> · avg ${f1(L.movesMean)}</small>` : ''}</td>
      <td>${secs(c.now.secs.med)} / ${cell(b, r => secs(r.secs.med))}</td>
      <td>${pc(c.now.openRate)} / ${cell(b, r => pc(r.openRate))}${L ? `<small> · ${pc(L.openRate)}</small>` : ''}</td>
      <td>${pc(c.now.firstMover)} / ${cell(b, r => pc(r.firstMover))}</td></tr>`;
  }).join('');
  const mrow = m => `<tr><th scope="row">${m.timer === 'group' ? `<b>${esc(m.mode)}</b>` : esc(MODE_LABEL[m.mode] || m.mode)}</th><td>${m.timer === 'group' || m.timer === '*' ? 'all' : esc(m.timer)}</td><td>${m.end === 'fin' ? 'finished' : 'abandoned'}</td><td>${m.n}</td><td>${trio(m.turns, f1)}</td><td>${m.mins.n ? trio(m.mins, f1) : '—'}</td></tr>`;
  const groups = rep.matches.filter(m => m.timer === 'group'), detail = rep.matches.filter(m => m.timer !== 'group');
  const fl = rep.filters;
  return `<div class="card balance"><div class="row"><h2>Balance report</h2><button class="btn" data-balexport="1">Export JSON</button></div>
    <form class="bfilters" data-balform="1">
      <label><input type="checkbox" data-balf="noadmin"${fl.admin ? '' : ' checked'}> Leave out matches an admin played in</label>
      <label><input type="checkbox" checked disabled> Leave out Practice and Test play <small>(never recorded)</small></label>
      <label>From <input type="date" data-balf="from" value="${esc(fl.from || '')}"></label>
      <label>To <input type="date" data-balf="to" value="${esc(fl.to || '')}"></label>
      <label>Settings <select data-balf="version">${[['current', 'Current version'], ['previous', 'Previous version'], ['all', 'All versions']].map(([v, l]) => `<option value="${v}"${fl.version === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      ${o.allGames != null ? `<label><input type="checkbox" data-balf="allgames"${o.allGames ? ' checked' : ''}> Admin-only games too</label>` : ''}
    </form>
    <h3>Mini-games${fl.version === 'current' ? ', current settings version' : ''}</h3>
    <div class="tbl"><table><thead><tr><th>Game</th><th>Squares</th><th>Winner's moves<br><small>25th · median · 75th</small></th><th>Time in square<br><small>25th · median · 75th</small></th><th>Left open</th><th>Reset</th><th>First mover wins</th></tr></thead><tbody>${rows || '<tr><td colspan="7">No games.</td></tr>'}</tbody></table></div>
    <h3>Current against previous version</h3>
    ${cmp ? `<div class="tbl"><table><thead><tr><th>Game</th><th>Squares now</th><th>Squares before</th><th>Median moves<br><small>now / before</small></th><th>Median time</th><th>Left open</th><th>First mover wins</th></tr></thead><tbody>${cmp}</tbody></table></div>` : '<p class="note">No game has a previous version yet: the first Save of a game\'s settings makes version 2.</p>'}
    <h3>Match length</h3>
    <div class="tbl"><table><thead><tr><th>Mode</th><th>Timer</th><th>Ended</th><th>Matches</th><th>Turns<br><small>25th · median · 75th</small></th><th>Minutes<br><small>25th · median · 75th</small></th></tr></thead><tbody>${groups.concat(detail).map(mrow).join('') || '<tr><td colspan="6">No matches in this range.</td></tr>'}</tbody></table></div>
    <ul class="note">${rep.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>`;
}
// A game's own page (admin.js gamePage): its settings version, the log of its saves, and the current against previous.
export function versionCard(type, versions, log, labelOf) {
  const cur = curVersion(versions, type), entries = Object.entries((log && log[type]) || {}).map(([k, e]) => [Number(k.slice(1)), e]).filter(([v]) => v >= 2).sort((a, b) => b[0] - a[0]);
  const lines = entries.map(([v, e]) => `<li><b>v${v}</b> ${esc(dt(e.at))}${e.by ? ` <small>${esc(e.by)}</small>` : ''}: ${esc(changeText(e, labelOf))}</li>`).join('');
  return `<div class="card"><h3>Settings version ${cur}</h3><p class="note">Every Save (or Reset) makes a new version; squares dealt from then on are filed under it, so the Balance report can compare the versions. v1: the settings before versions were kept.</p>${lines ? `<ul class="vlog">${lines}</ul>` : '<p class="note">No save since versions were kept.</p>'}</div>`;
}
export const exportName = (env, t) => `balance-${env || 'env'}-${new Date(t || 0).toISOString().slice(0, 10)}.json`;
