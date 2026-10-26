#!/usr/bin/env node
// Player-facing help text <-> docs/help-text.md.
//   npm run export:help            writes docs/help-text.md from the sources
//   npm run import:help [-- file]  reads the file (default docs/help-text.md) and writes the edited text back
//   add --dry to the import to report the changes without writing anything
// The sources are edited in place, only inside the text itself (a string's quotes, the code around it and its comments stay as they are).
// A source file is changed only when one of its texts changed. Entries are found by their [id] in the heading; names are not imported.
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const DOC = 'docs/help-text.md';
const EXPLAINER = 'src/ui/explainer.js', ACCOUNT = 'src/ui/screens/account.js', ENVJS = 'src/env.js', TUTORIAL = 'src/ui/tutorial.js';

/* ----- reading and writing JS string literals ----- */
const isQuote = c => c === "'" || c === '"' || c === '`';
const decode = raw => Function('"use strict";return ' + raw)();
function readLiteral(src, i) {                     // the literal starting at src[i] (a quote): { start, end, value, quote }, or null
  const q = src[i];
  if (!isQuote(q)) return null;
  for (let j = i + 1; j < src.length; j++) {
    const c = src[j];
    if (c === '\\') { j++; continue; }
    if (q === '`' && c === '$' && src[j + 1] === '{') return null;
    if (c === '\n' && q !== '`') return null;
    if (c === q) return { start: i, end: j + 1, value: decode(src.slice(i, j + 1)), quote: q };
  }
  return null;
}
function encode(value, q) {
  let s = value.replace(/\\/g, '\\\\');
  if (q === '`') return '`' + s.replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '`';
  return q + s.replace(new RegExp(q, 'g'), '\\' + q) + q;
}
const lineEnd = (src, i) => { const e = src.indexOf('\n', i); return e < 0 ? src.length : e; };
function allLiterals(src, from, to) {
  const out = [];
  for (let i = from; i < to;) {
    const l = isQuote(src[i]) && readLiteral(src, i);
    if (l) { out.push(l); i = l.end; } else i++;
  }
  return out;
}
function keyLiteral(src, from, to, key) {         // the literal after `key:` between from and to (strings skipped)
  for (let i = from; i < to;) {
    if (isQuote(src[i])) { const l = readLiteral(src, i); i = l ? l.end : i + 1; continue; }
    if (src.startsWith(key, i) && !/[\w$]/.test(src[i - 1] || '')) {
      let j = i + key.length;
      while (src[j] === ' ') j++;
      if (src[j] === ':') {
        j++;
        while (src[j] === ' ') j++;
        return isQuote(src[j]) ? readLiteral(src, j) : null;
      }
    }
    i++;
  }
  return null;
}
function constLit(src, name) {                     // `export const name = '...'`
  const m = new RegExp('^export const ' + name + ' = ', 'm').exec(src);
  return m ? readLiteral(src, m.index + m[0].length) : null;
}

/* ----- sources: the model of every text ----- */
// A site is where a text sits: { file, start, end, mode }. mode 'lit': a whole JS string literal (quotes included);
// 'sq' / 'tpl': the text inside a single-quoted string / a template literal; ph: { name: code } placeholders shown as {name}.
// A field is one labelled text (one or more sites that must read the same); an entry is a heading with fields.
function loadModel(read, oldTypes) {
  const entries = [];
  const sec = (section, id, title, fields, extra) => entries.push({ section, id, title, fields, ...extra });
  const site = (file, lit) => ({ file, start: lit.start, end: lit.end, mode: 'lit' });
  const fld = (label, sites, extra) => ({ label, sites: [].concat(sites), ...extra });
  const region = (file, re, mode, ph, group = 1) => {   // the text sits in capture group `group`; the pattern names its code around it, never the text, so an edited text is found again
    const src = read(file), ms = [...src.matchAll(new RegExp(re.source, 'dg'))];
    if (ms.length !== 1) throw new Error(`${file}: expected one place for ${re}, found ${ms.length}`);
    const s = { file, start: ms[0].indices[group][0], end: ms[0].indices[group][1], mode, ph };
    noCode(read, s, re);
    return s;
  };
  const after = (file, re) => {                       // the string literal right after the code `re` matches
    const src = read(file), ms = [...src.matchAll(new RegExp(re.source, 'g'))];
    if (ms.length !== 1) throw new Error(`${file}: expected one place for ${re}, found ${ms.length}`);
    const l = readLiteral(src, ms[0].index + ms[0][0].length);
    if (!l) throw new Error(`${file}: no string after ${re}`);
    return site(file, l);
  };

  // How to Play
  const ex = read(EXPLAINER);
  let i = ex.indexOf('const RULES_CORE = [') + 'const RULES_CORE = ['.length;
  const rules = allLiterals(ex, i, ex.indexOf('];', i));
  if (rules.length !== 3) throw new Error('RULES_CORE: expected 3 rules');
  sec('howto', 'rules', 'Core rules', rules.map((l, n) => fld(`Rule ${n + 1}`, site(EXPLAINER, l))));
  const hl = '<div class="games-h"><span>(.*?)</span>';
  sec('howto', 'howto-screen', 'How to Play screen', [
    fld('Modes heading', region(EXPLAINER, new RegExp(hl + '<small>.*?</small></div>\\n\\s+<div class="games howlist"><button'), 'tpl')),
    fld('Modes hint', region(EXPLAINER, new RegExp(hl.replace('(.*?)', '.*?') + '<small>(.*?)</small></div>\\n\\s+<div class="games howlist"><button'), 'tpl')),
    fld('Mini-games heading', region(EXPLAINER, new RegExp(hl + '<small>.*?</small></div>\\n\\s+<div class="games howlist">\\$\\{visibleTypes'), 'tpl')),
    fld('Mini-games hint', region(EXPLAINER, new RegExp(hl.replace('(.*?)', '.*?') + '<small>(.*?)</small></div>\\n\\s+<div class="games howlist">\\$\\{visibleTypes'), 'tpl')),
    fld('Credits heading', region(EXPLAINER, new RegExp(hl + '</div><div class="rulecard credits">'), 'tpl')),
    fld('Replay button', region(EXPLAINER, /data-act="tut-replay">(.*?)<\/button>/, 'tpl')),
  ]);
  // The tutorial (src/ui/tutorial.js CAPTION: a caption per step, the last card's texts and the buttons' labels)
  const tu = read(TUTORIAL), ta = tu.indexOf('const CAPTION = {'), tb = tu.indexOf('\n};', ta);
  if (ta < 0 || tb < 0) throw new Error(`${TUTORIAL}: no CAPTION block`);
  const TUT_FIELDS = [['intro', 'Board'], ['zoom', 'Tap a square'], ['play', 'In the square'], ['yours', 'Your turn'], ['cpu', 'Computer turn'],
    ['won', 'You won a square'], ['lost', 'Computer won a square'], ['claim', 'No square won yet'], ['line', 'Three in a row'],
    ['ready', 'Card title'], ['go', 'Card play'], ['menu', 'Card main menu'], ['skip', 'Skip label'], ['next', 'Next label'], ['gotit', 'Got it label']];
  sec('howto', 'tutorial', 'Tutorial', TUT_FIELDS.map(([k, label]) => {
    const l = keyLiteral(tu, ta, tb, k);
    if (!l) throw new Error(`${TUTORIAL}: CAPTION has no ${k}`);
    return fld(label, site(TUTORIAL, l));
  }));

  // Modes
  let a = ex.indexOf('const SC_EXPLAIN = {'), b = lineEnd(ex, a);
  sec('modes', 'superchaos', 'Super Chaos', [
    fld('Play', site(EXPLAINER, keyLiteral(ex, a, b, 'play'))), fld('Win', site(EXPLAINER, keyLiteral(ex, a, b, 'win')))]);
  a = ex.indexOf('const MODE_EXPLAIN = {'); b = lineEnd(ex, a);
  const ml = allLiterals(ex, a + ex.slice(a, b).indexOf('lines:'), b);
  if (ml.length !== 4) throw new Error('MODE_EXPLAIN: expected 4 strings');
  sec('modes', 'mode', 'Mode selector', [fld(ml[0].value, site(EXPLAINER, ml[1])), fld(ml[2].value, site(EXPLAINER, ml[3]))]);

  // Mini-games
  const lab = (name, keys, labels) => { a = ex.indexOf(`${name} = {`); b = lineEnd(ex, a); return keys.map(k => [k, keyLiteral(ex, a, b, k)]); };
  const cats = lab('const CAT_LABEL', ['luck', 'skill', 'brain']);
  sec('games', 'labels', 'Category labels', cats.map(([k, l]) => fld(`Category ${k}`, site(EXPLAINER, l), { key: k, group: 'cat' })));
  const gameDirs = fs.readdirSync(path.join(ROOT, 'src/games')).filter(d => fs.existsSync(path.join(ROOT, 'src/games', d, 'meta.js')));
  const games = [];
  for (const g of gameDirs) {
    const file = `src/games/${g}/meta.js`, src = read(file);
    const e = /^export const explainer = /m.exec(src);
    if (!e) continue;
    const ea = e.index, eb = lineEnd(src, ea);
    const nameL = keyLiteral(src, ea, eb, 'name'), play = keyLiteral(src, ea, eb, 'play');
    let win = keyLiteral(src, ea, eb, 'win'), winSite = win && site(file, win);
    if (!win) {                                       // a getter returning a template with the game's live setting (Risky Spins): the setting shows as {name}
      const gm = /get win\(\) \{ return `([^`]*)`; \}/d.exec(src.slice(ea, eb));
      if (gm) {
        const ph = {};
        for (const m of gm[1].matchAll(/\$\{([^}]*)\}/g)) ph[/(\w+)\W*$/.exec(m[1])[1]] = m[0];
        winSite = { file, start: ea + gm.indices[1][0], end: ea + gm.indices[1][1], mode: 'tpl', ph };
      }
    }
    if (!nameL || !play || !winSite) throw new Error(`${file}: explainer is not plain name/play/win strings`);
    const fields = [], cat = constLit(src, 'category');
    if (cat) fields.push(fld('Category', site(file, cat), { group: 'catOf' }));
    fields.push(fld('Play', site(file, play), { kind: 'text' }), fld('Win', winSite, { kind: 'text' }));
    const sm = /^export const scExplainer = /m.exec(src);
    if (sm) {
      const sa = sm.index, sb = lineEnd(src, sa), sp = keyLiteral(src, sa, sb, 'play'), sw = keyLiteral(src, sa, sb, 'win');
      if (!sp || !sw) throw new Error(`${file}: scExplainer is not plain play/win strings`);
      fields.push(fld('Super Chaos Play', site(file, sp), { kind: 'text' }), fld('Super Chaos Win', site(file, sw), { kind: 'text' }));
    }
    const ek = /^export const EXPLAIN_KEYS = \[([^\]]*)\]/m.exec(src);   // settings outside TUNE the explainer fills in (Risky Rolls' target, from config/pig)
    const allowed = new Set([...src.matchAll(/\bk: '(\w+)'/g)].map(m => m[1]).concat(ek ? [...ek[1].matchAll(/'(\w+)'/g)].map(m => m[1]) : []));
    for (const f of fields) for (const s of f.sites) for (const m of siteValue(read, s).matchAll(/\{(\w+)\}/g)) allowed.add(m[1]);
    games.push({ id: g, title: nameL.value, fields, allowed, retired: oldTypes.includes(g) });
  }
  games.sort((x, y) => x.title.localeCompare(y.title));
  for (const g of games) sec(g.retired ? 'retired' : 'games', g.id, g.title, g.fields, { allowed: g.allowed });

  // Other
  sec('other', 'popup', 'Mini-game pop-up', [
    fld('Play label', region(EXPLAINER, /<b>([^<>`$]*)<\/b><span>\$\{x\.play\}/, 'tpl')),   // (the label alone: never across the code before it on the line)
    fld('Win label', region(EXPLAINER, /<b>([^<>`$]*)<\/b><span>\$\{x\.win\}/, 'tpl')),
    fld('Close hint', region(EXPLAINER, /<small>(.*?)<\/small><\/div><\/div>`;/, 'tpl')),
  ]);
  sec('other', 'credits', 'Credits', [
    fld('Trivia', after(EXPLAINER, /visibleTypes\(\)\.includes\('trivia'\) \? (?=')/)),
    fld('Physics games', after(EXPLAINER, /t === 'pinball'\) \? (?=')/)),
    fld('Privacy note', region(EXPLAINER, /<p class="priv">(.*?): <a href="\$\{privacyUrl\(\)\}"/, 'tpl')),
    fld('Privacy link', region(EXPLAINER, /<p class="priv">[^<]*<a href="\$\{privacyUrl\(\)\}"[^>]*>(.*?)<\/a>/, 'tpl')),
  ]);
  // The account screens: the login's privacy line and the "Verify your email" screen (ui/screens/account.js).
  sec('other', 'account', 'Account screens', [
    fld('Agree', region(ACCOUNT, /<p class="agree">(.*?)<\/p>/, 'tpl', { link: "${privacyLink('Privacy policy')}" })),
    fld('Verify title', region(ACCOUNT, /verify-scr">\n\s+<div class="bar">.*\n\s+<div class="ttl"><b>(.*?)<\/b>/, 'tpl')),
    fld('Verify banner', region(ACCOUNT, /verify-scr">\n\s+<div class="bar">.*\n\s+<div class="ttl"><b>.*?<\/b><small>(.*?)<\/small>/, 'tpl')),
    fld('Verify hint', region(ACCOUNT, /data-keep-scroll="verify">\n\s+<p class="hint">(.*?)<\/p>/, 'tpl', { email: '${esc(verifyEmail())}' })),
  ]);
  const em = { email: '${esc(gateEmail)}' }, em2 = { email: "${esc(gateEmail || 'This account')}" };
  const shellAt = (title, q, ph) => region(ACCOUNT, new RegExp(`shell\\('${title}', ${q}<p class="hint">(.*?)</p>`), q === '`' ? 'tpl' : 'sq', ph);
  sec('other', 'staging', 'Staging notices', [
    fld('Banner', [region(ACCOUNT, /<div class="ttl"><b>\$\{title\}<\/b><small>(.*?)<\/small>/, 'tpl'),
      region(ACCOUNT, /gated \? '((?:[^'\\]|\\.)+)' :/, 'sq')]),
    fld('Checking', region(ACCOUNT, /shell\('Staging', `[^`]*?<h2>(.*?)<\/h2>/, 'tpl')),
    fld('Not on the list', shellAt('Not on the list', '`', em2)),
    fld('Verify email', shellAt('Verify your email', '`', em)),
    fld('No connection', shellAt('No connection', "'")),
    fld('Badge', region(ENVJS, /b\.textContent = '((?:[^'\\]|\\.)*)'/, 'sq')),
  ]);
  return entries;
}

// A text the pattern found must be text, never code: no template expression or backtick left once its own
// placeholders are taken out (a pattern that reached past its text into the code around it fails the export).
function noCode(read, s, re) {
  if (s.mode === 'lit') return;
  let raw = read(s.file).slice(s.start, s.end);
  for (const code of Object.values(s.ph || {})) raw = raw.split(code).join('');
  if (/\$\{|`|=>|\.join\(/.test(raw)) throw new Error(`${s.file}: ${re} captured code, not text: ${raw.slice(0, 80)}`);
}
// A site's text as shown in the file, and a shown text as source code.
function siteValue(read, s) {
  const raw = read(s.file).slice(s.start, s.end);
  if (s.mode === 'lit') return decode(raw);
  if (s.mode === 'sq') return withPh(decode("'" + raw + "'"), s.ph, true);
  if (raw.includes('\\')) throw new Error(`${s.file}: unexpected escape in ${raw}`);
  return withPh(raw, s.ph, true);
}
function withPh(text, ph, toShown) {
  for (const [name, code] of Object.entries(ph || {})) text = toShown ? text.split(code).join(`{${name}}`) : text.split(`{${name}}`).join(code);
  return text;
}
function siteSource(read, s, shown) {
  if (s.mode === 'lit') return encode(shown, read(s.file)[s.start]);
  if (s.mode === 'sq') return encode(shown, "'").slice(1, -1);
  const parts = Object.keys(s.ph || {}).map(n => `{${n}}`);
  const esc = t => t.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  let out = '', rest = shown;
  while (rest) {
    const hit = parts.map(p => [rest.indexOf(p), p]).filter(([n]) => n >= 0).sort((x, y) => x[0] - y[0])[0];
    if (!hit) { out += esc(rest); break; }
    out += esc(rest.slice(0, hit[0])) + s.ph[hit[1].slice(1, -1)];
    rest = rest.slice(hit[0] + hit[1].length);
  }
  return out;
}

/* ----- the document ----- */
const SECTIONS = [
  ['howto', 'How to Play', 'The core rules and the How to Play screen.'],
  ['modes', 'Modes', 'The explainers for Super Chaos and Classic.'],
  ['games', 'Mini-games', 'Each mini-game\'s "?" explainer, alphabetical: its category, then Play and Win. "Super Chaos" lines appear only where the game\'s rules differ there.'],
  ['retired', 'Retired mini-games (not shown in the app)', ''],
  ['other', 'Other help text', 'The pop-up\'s fixed labels, Credits and the staging notices.'],
];
const NOTE = `Edit the text after each label. Don't change the IDs in brackets.

Keep anything in {braces} (a setting the game fills in) and any <tags> or links as they are. A long text may be wrapped onto more lines. Every label is optional to change; one left out stays as it is. Changing a Category line moves the game to another label from the Category labels entry; to reword a label itself, edit it there.`;

function readFn(root) {
  const cache = {};
  return f => cache[f] ?? (cache[f] = fs.readFileSync(path.join(root, f), 'utf8'));
}
function shownOf(read, f) {
  const vals = f.sites.map(s => siteValue(read, s));
  if (vals.some(v => v !== vals[0])) throw new Error(`${f.label}: its places read differently`);
  if (/\n/.test(vals[0]) || vals[0] !== vals[0].trim()) throw new Error(`${f.label}: text with a line break or edge spaces`);
  return vals[0];
}
function labelMaps(read, entries) {
  const L = entries.find(e => e.id === 'labels'), m = { cat: {} };
  for (const f of L.fields) m[f.group][f.key] = shownOf(read, f);
  return m;
}
async function oldTypesOf(root) {
  return (await import(pathToFileURL(path.join(root, 'src/games/index.js')).href)).OLD_TYPES;
}
async function exportHelp(root = ROOT) {
  const read = readFn(root), entries = loadModel(read, await oldTypesOf(root)), maps = labelMaps(read, entries);
  const out = ['# Tic Tac Chaos: help text', '', NOTE, ''];
  for (const [id, title, blurb] of SECTIONS) {
    const list = entries.filter(e => e.section === id);
    if (!list.length) continue;
    out.push(`# ${title}`, '', ...(blurb ? [blurb, ''] : []));
    for (const e of list) {
      out.push(`## ${e.title} [${e.id}]`);
      for (const f of e.fields) {
        let v = shownOf(read, f);
        if (f.group === 'catOf') v = maps.cat[v] || v;
        out.push(`${f.label}: ${v}`);
      }
      out.push('');
    }
  }
  return out.join('\n');
}

/* ----- the import ----- */
function parseDoc(md, warn) {
  const entries = new Map();
  let cur = null;
  for (const [n, line] of md.split(/\r?\n/).entries()) {
    const h = /^##\s+(.*?)\s*\[([^\]\s]+)\]\s*$/.exec(line);
    if (h) {
      if (entries.has(h[2])) { warn(`line ${n + 1}: the ID [${h[2]}] appears twice; the second one is ignored`); cur = null; continue; }
      cur = { id: h[2], title: h[1], line: n + 1, lines: [] };
      entries.set(h[2], cur);
    } else if (/^#{1,6}\s/.test(line)) cur = null;
    else if (cur) cur.lines.push(line);
  }
  return entries;
}
function readFields(e, labels) {                    // { label: text } for the labels this entry has; other lines continue the text above
  const out = {}, byLower = new Map(labels.map(l => [l.toLowerCase(), l]));
  let last = null;
  for (const line of e.lines) {
    const m = /^([^:]{1,40}):(?:\s+(.*)|\s*)$/.exec(line), l = m && byLower.get(m[1].trim().toLowerCase());
    if (l) { last = l; out[l] = (m[2] || '').trim(); }
    else if (line.trim() && last) out[last] = (out[last] + ' ' + line.trim()).trim();
  }
  return out;
}
async function importHelp(md, { root = ROOT, write = true } = {}) {
  const read = readFn(root), entries = loadModel(read, await oldTypesOf(root));
  const warnings = [], changes = [];
  const warn = w => warnings.push(w);
  const doc = parseDoc(md, warn);
  const known = new Set(entries.map(e => e.id));
  for (const id of doc.keys()) if (!known.has(id)) warn(`unknown ID [${id}] (line ${doc.get(id).line}): not imported`);

  const oldMaps = labelMaps(read, entries), newMaps = JSON.parse(JSON.stringify(oldMaps));
  const labelsDoc = doc.get('labels');
  if (labelsDoc) {
    const L = entries.find(e => e.id === 'labels'), got = readFields(labelsDoc, L.fields.map(f => f.label));
    for (const f of L.fields) if (got[f.label]) newMaps[f.group][f.key] = got[f.label];
  }
  const edits = [];                                   // { file, start, end, text }
  for (const e of entries) {
    const d = doc.get(e.id);
    if (!d) { warn(`missing ID [${e.id}] (${e.title}): left as it is`); continue; }
    const got = readFields(d, e.fields.map(f => f.label));
    for (const f of e.fields) {
      const old = shownOf(read, f);
      let next = got[f.label];
      if (next === undefined) { warn(`[${e.id}] has no "${f.label}:" line: left as it is`); continue; }
      if (next === '') { warn(`[${e.id}] "${f.label}:" is empty: left as it is`); continue; }
      let from = old, shownOld = old, change = null;
      if (f.group === 'catOf') {
        const o = oldMaps.cat, n = newMaps.cat;
        shownOld = n[old] || old;
        if (next === n[old] || next === o[old]) continue;
        const k = Object.keys(n).find(x => n[x] === next) || Object.keys(o).find(x => o[x] === next);
        if (!k) { warn(`[${e.id}] "${f.label}: ${next}" is not one of the labels (${Object.values(n).join(', ')}): left as it is`); continue; }
        change = k;
      } else {
        if (next === old) continue;
        if (f.kind === 'text' && e.allowed) for (const m of next.matchAll(/\{(\w+)\}/g)) if (!e.allowed.has(m[1])) warn(`[${e.id}] "${f.label}" uses {${m[1]}}, which this game does not have`);
        for (const s of f.sites) for (const name of Object.keys(s.ph || {})) if (!next.includes(`{${name}}`)) warn(`[${e.id}] "${f.label}" has lost {${name}}`);
        change = next;
      }
      changes.push({ id: e.id, label: f.label, file: f.sites[0].file, old: f.group ? shownOld : old, next: f.group === 'catOf' ? next : change });
      for (const s of f.sites) edits.push({ file: s.file, start: s.start, end: s.end, text: siteSource(read, s, change) });
    }
  }
  // Apply the edits, last first within each file, and check the result before anything is written.
  const files = new Map();
  for (const ed of edits) (files.get(ed.file) || files.set(ed.file, []).get(ed.file)).push(ed);
  const outFiles = {};
  for (const [file, list] of files) {
    let src = read(file);
    for (const ed of list.sort((x, y) => y.start - x.start)) src = src.slice(0, ed.start) + ed.text + src.slice(ed.end);
    outFiles[file] = src;
  }
  if (edits.length) {
    const read2 = f => outFiles[f] ?? read(f), after = loadModel(read2, await oldTypesOf(root));
    for (const e of entries) {
      const e2 = after.find(x => x.id === e.id);
      e.fields.forEach((f, i) => {
        const was = shownOf(read, f), now = shownOf(read2, e2.fields[i]);
        const c = changes.find(x => x.id === e.id && x.label === f.label);
        if (!c && was !== now && f.group !== 'catOf') throw new Error(`self-check: [${e.id}] "${f.label}" changed without being asked to`);
        if (c && f.group !== 'catOf' && now !== c.next) throw new Error(`self-check: [${e.id}] "${f.label}" did not read back as written`);
      });
    }
    if (write) for (const [file, src] of Object.entries(outFiles)) fs.writeFileSync(path.join(root, file), src);
  }
  return { changes, warnings, files: outFiles };
}

/* ----- command line ----- */
async function main() {
  const args = process.argv.slice(2), cmd = args[0], rest = args.slice(1).filter(a => !a.startsWith('--'));
  if (cmd === 'export') {
    const md = await exportHelp();
    fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, DOC), md);
    console.log(`wrote ${DOC}`);
  } else if (cmd === 'import') {
    const dry = args.includes('--dry'), file = path.resolve(rest[0] || path.join(ROOT, DOC));
    const { changes, warnings, files } = await importHelp(fs.readFileSync(file, 'utf8'), { write: !dry });
    for (const w of warnings) console.log(`WARNING  ${w}`);
    for (const c of changes) console.log(`CHANGED  [${c.id}] ${c.label}  (${c.file})\n  - ${c.old}\n  + ${c.next}`);
    const fl = Object.keys(files);
    console.log(`${changes.length} text${changes.length === 1 ? '' : 's'} changed in ${fl.length} file${fl.length === 1 ? '' : 's'}${dry ? ' (dry run: nothing written)' : ''}, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}.`);
  } else {
    console.log('usage: node scripts/help-text.js export | import [file] [--dry]');
    process.exit(1);
  }
}
if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });
module.exports = { exportHelp, importHelp, parseDoc };
