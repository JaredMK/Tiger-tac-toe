// The admin dashboard's one table (December 2026): every table on every page is this one, so each sorts by any column,
// filters (a search box over every column, and a filter under each heading), exports what it shows as CSV, and shows the
// first rows with a "Show all". Pure: the state is a plain object the page keeps (and may store), the HTML a string.
//   cols: [{ k, label, get: row => value (what sorts, filters and exports), html: row => cell (else the value, escaped),
//            num (right-aligned; its filter takes >, <, >=, <=, = and a-b), tip (the heading's tooltip) }]
//   state: { sort: { k, dir }, q, filt: { k: text }, open (the filter row shown), all (every row shown) }
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const LIMIT = 100;
const LIVE = new Map();                         // the tables on the page: id → { cols, rows } (what CSV exports)

export function newState(def) { return Object.assign({ sort: null, q: '', filt: {}, open: false, all: false }, def || {}); }
const text = v => (v == null ? '' : v instanceof Date ? v.toISOString() : String(v));
// A column filter: a number test on a numeric column (">5", "<=3", "=2", "2-6"), else "contains".
export function matches(col, value, want) {
  const w = String(want).trim();
  if (!w) return true;
  if (col.num) {
    const v = Number(value), m = /^(>=|<=|>|<|=)\s*(-?[\d.]+)$/.exec(w), r = /^(-?[\d.]+)\s*-\s*(-?[\d.]+)$/.exec(w);
    if (m) { if (!Number.isFinite(v)) return false; const x = Number(m[2]); return m[1] === '>' ? v > x : m[1] === '<' ? v < x : m[1] === '>=' ? v >= x : m[1] === '<=' ? v <= x : v === x; }
    if (r) return Number.isFinite(v) && v >= Number(r[1]) && v <= Number(r[2]);
  }
  return text(value).toLowerCase().includes(w.toLowerCase());
}
export function apply(cols, rows, st) {
  st = st || newState();
  const q = (st.q || '').trim().toLowerCase(), fs = Object.entries(st.filt || {}).filter(([, v]) => String(v).trim()).map(([k, v]) => [cols.find(c => c.k === k), v]).filter(([c]) => c);
  let out = rows.filter(r => (!q || cols.some(c => text(c.get(r)).toLowerCase().includes(q))) && fs.every(([c, v]) => matches(c, c.get(r), v)));
  const s = st.sort && cols.find(c => c.k === st.sort.k);
  if (s) {
    const dir = st.sort.dir || 1;
    out = out.slice().sort((a, b) => { const x = s.get(a), y = s.get(b); if (x == null && y == null) return 0; if (x == null || x === '') return 1; if (y == null || y === '') return -1; return (typeof x === 'number' && typeof y === 'number' ? x - y : text(x).localeCompare(text(y), undefined, { numeric: true })) * dir; });
  }
  return out;
}
// A heading tapped: its column ascending (text) or descending (numbers) first, then the other way.
export function sortBy(st, cols, k) { const c = cols.find(x => x.k === k); st.sort = st.sort && st.sort.k === k ? { k, dir: -st.sort.dir } : { k, dir: c && c.num ? -1 : 1 }; return st; }
const cell = v => { const s = text(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
export function csv(cols, rows) { return [cols.map(c => cell(c.label)).join(',')].concat(rows.map(r => cols.map(c => cell(c.csv ? c.csv(r) : c.get(r))).join(','))).join('\r\n') + '\r\n'; }
export const csvOf = id => { const t = LIVE.get(id); return t ? csv(t.cols, t.rows) : ''; };
export const colsOf = id => (LIVE.get(id) || {}).cols || [];

// opts: { title, note, row: r => attributes for its <tr> (a link: data-go="#…"), empty, bare (no toolbar) }
export function html(id, cols, rows, st, opts) {
  st = st || newState(); opts = opts || {};
  const shown = apply(cols, rows, st), lim = st.all ? shown.length : LIMIT, cut = shown.slice(0, lim), any = (st.q || '').trim() || Object.values(st.filt || {}).some(v => String(v).trim());
  LIVE.set(id, { cols, rows: shown });
  const th = c => `<th${c.num ? ' class="num"' : ''}${st.sort && st.sort.k === c.k ? ` aria-sort="${st.sort.dir > 0 ? 'ascending' : 'descending'}"` : ''}><button data-tsort="${esc(id)}" data-k="${esc(c.k)}">${esc(c.label)}</button>${c.tip ? `<i class="tipi" tabindex="0" role="note" data-tip="${esc(c.tip)}" aria-label="${esc(c.tip)}">?</i>` : ''}</th>`;
  const filtRow = st.open ? `<tr class="tbf">${cols.map(c => `<th><input data-tf="${esc(id)}" data-k="${esc(c.k)}" value="${esc((st.filt || {})[c.k] || '')}" placeholder="${c.num ? '>, <, =' : 'contains'}" aria-label="Filter ${esc(c.label)}"></th>`).join('')}</tr>` : '';
  const body = cut.map(r => `<tr${opts.row ? ' ' + opts.row(r) : ''}>${cols.map(c => `<td${c.num ? ' class="num"' : ''}>${c.html ? c.html(r) : esc(text(c.get(r)))}</td>`).join('')}</tr>`).join('');
  const bar = opts.bare ? '' : `<div class="tbbar">${opts.title ? `<h3>${esc(opts.title)}</h3>` : ''}<input type="search" data-tq="${esc(id)}" value="${esc(st.q || '')}" placeholder="Search" aria-label="Search this table">
    <button class="btn sm" data-tfilt="${esc(id)}" aria-pressed="${!!st.open}">Filters</button>${any ? `<button class="btn sm" data-tclear="${esc(id)}">Clear</button>` : ''}
    <span class="tbn">${shown.length === rows.length ? `${rows.length} row${rows.length === 1 ? '' : 's'}` : `${shown.length} of ${rows.length}`}</span><button class="btn sm" data-tcsv="${esc(id)}"${shown.length ? '' : ' disabled'}>CSV</button></div>`;
  return `<div class="tb" data-tb="${esc(id)}">${bar}<div class="tbl"><table><thead><tr>${cols.map(th).join('')}</tr>${filtRow}</thead><tbody>${body || `<tr><td colspan="${cols.length}" class="dim">${esc(opts.empty || (rows.length ? 'Nothing matches' : 'Nothing yet'))}</td></tr>`}</tbody></table></div>
    ${shown.length > lim ? `<button class="btn sm" data-tall="${esc(id)}">Show all ${shown.length}</button>` : ''}${opts.note ? `<p class="note">${opts.note}</p>` : ''}</div>`;
}
