// Letter Hive: the screen, the miniature, the move's words and sounds, and this phone's burst.
// From the top: the two tallies (points to the target), under each its player's found words (two columns of chips, a
// full-hive word inked; a box scrolls inside itself once it is full, the newest kept in view), the time bar, the
// word being made, the reserved line, the hive (an SVG of seven hexagon cells, the centre one blue: never a player's
// colour) and the buttons: Go! before a burst, Delete / Shuffle / Enter during it. This phone's burst is live from
// Go! (ui/round.js) on its own clock, real time whatever the Animation setting: a press on a cell adds its letter
// (taken on the press itself, so two thumbs can type), Enter checks the word at once against the puzzle's list and
// the words found (rules.js hiveWhy): accepted, it joins the list with its points and a chime (a full-hive word
// waves the hive); refused, the line says why in a word or two and the letters go. Shuffle re-arranges the outer
// letters on this phone only. A keyboard types, deletes (Backspace), enters (Enter) and shuffles (Space) too. During
// the burst the page is changed in place (no redraw), and a redraw draws the same from the burst's state. The burst
// goes in as it stands when its time is up, when Board is pressed or the turn's clock runs out, and at once when
// it reaches the target. Anyone else's burst is never streamed: its words land in their finder's list one after
// another, the points counting on (rules.js hiveWordAt), then the line says what it came to.
import { HIVE, hiveBeat, hiveCfg, hiveFull, hivePts, hivePuzzle, hiveShowMs, hiveWhy, hiveWordAt } from './rules.js';
import { SND, ownPress } from '../../audio/sound.js';
import { haptic } from '../../net/platform.js';
import { N, RNG, app, entering, esc, menuOpen, state } from '../../ui/app.js';
import { ownMove } from '../../ui/haptics.js';
import { arcTally, gaugeBar, lateAt } from '../../ui/progress.js';
import { makeRound } from '../../ui/round.js';
import { runInputAt } from '../../ui/runner.js';
import { thumbArt } from '../../ui/thumbs.js';
import { barRows } from '../../ui/tok.js';
import { flashAnimating, skipFlash } from '../../ui/turns.js';

export const ownLine = true;
export const replay = { synth: () => [] };                         // the move is a burst's result: shown from the flash, never the typing
// The view's own moments (ms; the stylesheet's .hv* animations mirror them): a refusal or a "+5" stays in the line
// `say`; the burst's last word is shown `last` before it goes in at the target; a burst sent stands in for its
// record `sent` at most (online: until the server's answer lands); a press holds a cell down `press`.
export const HIVEV = { say: 1300, last: 550, sent: 8000, press: 110, wave: 700 };
const LONG = 11;                                                   // a word being made past this many letters is set smaller (.hvent.long), so 15 fit a narrow phone
const WHY = { short: 'Too short', centre: 'Needs the centre letter', word: 'Not a word', found: 'Already found' };
let src = null, hooked = false, skipped = null, downAt = -1e9, raf = 0;
let lay = null;                                                    // the outer letters as this phone has shuffled them: { key, o }
let sent = null;                                                   // this phone's burst on its way: { sq, pz, p, n, by, w, pts, full, sum, at }
let stuck = { key: '', X: -1, O: -1 };                             // the lists' lengths as last scrolled to their ends
const round = makeRound('hive', {
  mine: () => !!src && src.mine,
  begin: (mini, p) => { const c = hiveCfg(mini); return { c, pz: hivePuzzle(mini.pz), from: mini.pts[p], n: mini.n[p], all: mini.found.slice(), w: [], pts: [], sum: 0, cur: '', msg: null, done: null, T: c.secs * 1000 }; },
  step: (L, ms) => !(L.done != null ? ms > L.done + HIVEV.last : ms > L.T),
  move(L) {
    sent = { sq: L.sq, pz: L.mini.pz, p: L.p, n: L.n, by: L.p, w: L.w.slice(), pts: L.pts.slice(), full: L.w.filter(w => hiveFull(L.pz.letters, w)).length, sum: L.sum, at: performance.now() };
    if (L.done == null) SND.play('hvEnd');
    return { w: L.w.slice() };
  },
  go: () => loop(),
});
const msOf = L => performance.now() - L.t0;
const orderOf = (zoom, mini) => { const key = `${zoom}:${mini.pz}`; if (!lay || lay.key !== key) lay = { key, o: [...hivePuzzle(mini.pz).letters.slice(1)] }; return lay.o; };

// ---- this phone's burst: its inputs ----
function type(ch) {
  const L = round.live; if (!L || L.done != null || !L.pz.letters.includes(ch)) return;
  if (L.cur.length >= HIVE.max) { SND.play('hvNo', { vol: 0.5 }); return; }
  L.cur += ch; if (L.msg && L.msg.cls === 'no') L.msg = null;
  SND.play('hvKey', { rate: 1 + Math.min(10, L.cur.length) * 0.045 }); haptic('tap'); paint('key');
}
function del() {
  const L = round.live; if (!L || L.done != null || !L.cur) return;
  L.cur = L.cur.slice(0, -1); SND.play('hvDel'); haptic('tap'); paint('del');
}
function shuffle() {
  const L = round.live; if (!L || L.done != null) return;
  const o = orderOf(L.sq, L.mini), was = o.join('');
  for (let tries = 0; tries < 6 && o.join('') === was; tries++) for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(RNG() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
  SND.play('hvShuf'); haptic('tap'); paint('shuf');
}
function enter() {
  const L = round.live; if (!L || L.done != null || !L.cur) return;
  const w = L.cur, ms = msOf(L), why = hiveWhy(L.pz, L.all, w);
  L.cur = '';
  if (why) { L.msg = { cls: 'no', text: WHY[why], t: ms, was: w }; SND.play('hvNo'); haptic('error'); paint('no'); return; }
  const v = hivePts(L.c, L.pz, w), full = hiveFull(L.pz.letters, w);
  L.w.push(w); L.pts.push(v); L.all.push(w); L.sum += v;
  L.msg = { cls: full ? 'full' : 'ok', text: full ? `Full hive! +${v}` : `+${v}`, t: ms };
  SND.play(full ? 'hvFull' : 'hvWord', { rate: full ? 1 : 0.9 + Math.min(6, L.w.length) * 0.05 }); haptic(full ? 'success' : 'medium');
  if (L.from + L.sum >= L.c.target || L.w.length >= HIVE.cap) L.done = ms;   // the target reached (or a burst as long as one may be): it goes in after a beat
  paint(full ? 'full' : 'word');
}
const KEYS = { del, shuf: shuffle, ent: enter };
// The burst's frame loop: its clock (ui/round.js ends it), the time bar, a line that has had its say.
function loop() {
  if (typeof requestAnimationFrame !== 'function' || raf) return;
  const frame = now => {
    raf = 0; round.tick(now);
    const L = round.live; if (!L) return;
    const ms = now - L.t0, root = app.querySelector ? app.querySelector('.g-hv') : null;
    if (root) {
      const bar = root.querySelector('.hvbar'), left = Math.max(0, 1 - ms / L.T);
      if (bar) { bar.firstElementChild.style.width = (left * 100).toFixed(2) + '%'; bar.classList.toggle('mid', left <= 0.5 && left > 0.25); bar.classList.toggle('low', left <= 0.25); }
      if (L.msg && ms - L.msg.t > HIVEV.say) { L.msg = null; const line = root.querySelector('.hvline'); if (line) { line.className = 'hvline'; line.textContent = ''; } }
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
}
// The page changed in place for an input of the burst (a redraw would cut a press short and restart every animation).
function paint(kind) {
  const L = round.live, root = app.querySelector ? app.querySelector('.g-hv') : null;
  if (!L || !root) return;
  const set = (sel, html) => { const el = root.querySelector(sel); if (el) el.innerHTML = html; return el; };
  const ent = set('.hvent', entry(L.pz, L.cur, true, kind === 'key', kind === 'no' && L.msg ? L.msg.was : ''));
  if (ent) ent.classList.toggle('long', L.cur.length > LONG);
  const line = root.querySelector('.hvline');
  if (line) { line.className = 'hvline' + (L.msg ? ` ${L.msg.cls} pop` : ''); line.textContent = L.msg ? L.msg.text : ''; }
  if (kind === 'shuf') set('.hvbox', hiveSvg(L.pz, orderOf(L.sq, L.mini), 'on shuf'));
  if (kind === 'word' || kind === 'full') {
    const list = set(`.hvlist.${L.p}`, chips(L.pz, L.mini.found.filter((w, i) => L.mini.by[i] === L.p).concat(L.w), L.p, 1));
    if (list) list.scrollTop = list.scrollHeight;
    const num = root.querySelector(`.ctal.${L.p} .npts b`), bar = root.querySelector(`.ctal.${L.p} .wbar i`), to = L.from + L.sum;
    if (num) { num.textContent = to; num.classList.remove('hvbump'); void num.offsetWidth; num.classList.add('hvbump'); }
    if (bar) { const pct = (100 * Math.min(1, to / Math.max(1, L.c.target))).toFixed(1) + '%'; bar.classList.remove('grow'); bar.style.setProperty('--w0', pct); bar.style.setProperty('--w1', pct); }
    if (kind === 'full') { const hv = root.querySelector('.hvhive'); if (hv) { hv.classList.remove('wave'); void hv.getBoundingClientRect(); hv.classList.add('wave'); setTimeout(() => hv.classList.remove('wave'), HIVEV.wave); } }
  }
}
function hook() {
  if (hooked || !app || typeof app.addEventListener !== 'function') return;
  hooked = true;
  app.addEventListener('pointerdown', e => {
    if (state.screen !== 'mini' || !e.target.closest || !runInputAt(e.target)) return;
    const cell = e.target.closest('.hvc'), key = e.target.closest('.hvk');
    if (!cell && !key) return;
    if (!round.live || !round.on(state.zoom)) {                    // not begun: Go! gives a nod
      if (cell && src && src.mine) { const go = app.querySelector('.hvgo'); if (go) { go.classList.remove('nod'); void go.offsetWidth; go.classList.add('nod'); } }
      return;
    }
    e.preventDefault(); ownPress(); downAt = performance.now();
    if (cell) { cell.classList.add('dn'); setTimeout(() => cell.classList.remove('dn'), HIVEV.press); type(cell.dataset.k); }
    else if (KEYS[key.dataset.hv]) KEYS[key.dataset.hv]();
  }, { passive: false });
  app.addEventListener('click', e => {                               // Board, pressed mid-burst: the burst goes in as it stands first (its result shows, then the board comes by itself)
    if (!round.live || !round.on(state.zoom) || state.screen !== 'mini' || !e.target.closest || !e.target.closest('[data-act="back"]')) return;
    e.stopPropagation(); e.preventDefault(); round.end();
  }, true);
  if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('keydown', e => {   // a keyboard, where there is one
    const L = round.live;
    if (!L || state.screen !== 'mini' || !round.on(state.zoom) || menuOpen || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const k = e.key, f = /^[a-zA-Z]$/.test(k) ? () => type(k.toLowerCase()) : k === 'Backspace' ? del : k === 'Enter' ? enter : k === ' ' ? shuffle : null;
    if (!f) return;
    e.preventDefault(); if (!e.repeat || k === 'Backspace') f();
  });
}
// A click with no press before it (a keyboard's Enter on a focused button): the same input.
const byClick = f => () => { if (performance.now() - downAt > 700) f(); };
export const actions = {
  'hive-go': () => { ownPress(); if (!round.live && round.start()) SND.play('hvGo'); },
  'hive-del': byClick(del), 'hive-shuf': byClick(shuffle), 'hive-ent': byClick(enter),
};

// ---- the drawing ----
// The hive: seven flat-topped hexagons, the centre letter in the middle and the other six round it (cell k at
// k x 60 degrees from the top), each a shadow, a top and its letter; `mini`: the miniature's (no shadows, its own classes).
const GEO = { R: 30, gap: 1.08, drop: 5 };
const hexAt = (cx, cy, R) => [0, 1, 2, 3, 4, 5].map(k => `${(cx + R * Math.cos(k * Math.PI / 3)).toFixed(1)},${(cy + R * Math.sin(k * Math.PI / 3)).toFixed(1)}`).join(' ');
const cellAt = k => { if (k < 0) return [0, 0]; const d = GEO.R * Math.sqrt(3) * GEO.gap, a = (k * 60 - 90) * Math.PI / 180; return [d * Math.cos(a), d * Math.sin(a)]; };
const BOX = (() => { const d = GEO.R * Math.sqrt(3) * GEO.gap, w = 2 * (d * Math.cos(Math.PI / 6) + GEO.R) + 6, h = 2 * (d + GEO.R * Math.sqrt(3) / 2) + 6 + GEO.drop; return [-w / 2, -(h - GEO.drop) / 2, w, h].map(v => +v.toFixed(1)); })();
function hiveSvg(pz, order, cls) {
  const cell = (ch, k) => { const [x, y] = cellAt(k); return `<g class="hvc${k < 0 ? ' mid' : ''}" data-k="${ch}" style="--i:${k + 1}"><polygon class="hvsh" points="${hexAt(x, y + GEO.drop, GEO.R)}"/><g class="hvtop"><polygon class="hvhx" points="${hexAt(x, y, GEO.R)}"/><text x="${x.toFixed(1)}" y="${(y + 10.6).toFixed(1)}">${ch.toUpperCase()}</text></g></g>`; };
  return `<svg class="hvhive${cls ? ' ' + cls : ''}" viewBox="${BOX.join(' ')}" role="group" aria-label="The hive: ${pz.centre.toUpperCase()} in the centre, ${order.join(' ').toUpperCase()} round it">${order.map(cell).join('')}${cell(pz.centre, -1)}</svg>`;
}
// The word being made: its letters (the centre letter in the centre's colour), the one just typed popping in, the
// caret; `gone`: a refused word on its way out.
const letters = (pz, w, cls) => [...w].map((ch, i) => `<b class="${ch === pz.centre ? 'mid' : ''}${cls && i === w.length - 1 ? ' ' + cls : ''}">${ch.toUpperCase()}</b>`).join('');
const entry = (pz, cur, live, fresh, gone) => (gone && !cur ? `<span class="hvout">${letters(pz, gone)}</span>` : letters(pz, cur, fresh ? 'new' : '')) + (live ? '<i class="hvcar"></i>' : '');
// A player's words as chips, in the order found; `fresh`: the last `fresh` just found here (they pop in); `show`: a
// burst landing, its words each at its moment.
const chips = (pz, ws, p, fresh, show) => ws.map((w, i) => {
  const k = show ? i - (ws.length - show.w.length) : -1, cls = `hvw${hiveFull(pz.letters, w) ? ' full' : ''}${fresh && i >= ws.length - fresh ? ' new' : ''}`;
  return `<li ${k >= 0 ? lateAt(cls, hiveWordAt(show, k), 'land') : `class="${cls}"`}>${esc(w)}</li>`;
}).join('');
const tally = (p, o, goal, now, was, at, ms) => {
  const moved = was != null && was !== now;
  return arcTally(p, o, `<span class="wtal">${gaugeBar({ goal, now: Math.min(goal, now), was: Math.min(goal, moved ? was : now), at: at || 0, ms: ms || 300 })}<span class="npts" aria-label="${now} of ${goal}">${moved ? `<b class="cnt" data-from="${was}" data-delay="${Math.round(at || 0)}" data-ms="${Math.round(ms || 300)}">${now}</b>` : `<b>${now}</b>`}<small>/${goal}</small></span></span>`);
};
const sum = l => l.pts.reduce((a, v) => a + v, 0);
const words = l => (!l.w.length ? 'No words' : `${l.full ? 'Full hive! ' : ''}${l.w.length} word${l.w.length === 1 ? '' : 's'} · +${sum(l)}`);
// The lists kept at their ends when they have grown (after the page is drawn).
function stick() {
  if (typeof requestAnimationFrame !== 'function') return;
  requestAnimationFrame(() => {
    if (!src || !app.querySelector) return;
    const key = `${src.zoom}:${src.mini.pz}`; if (stuck.key !== key) stuck = { key, X: -1, O: -1 };
    for (const p of ['X', 'O']) { const el = app.querySelector(`.g-hv .hvlist.${p}`); if (!el) continue; const n = Number(el.dataset.n); if (n !== stuck[p]) { stuck[p] = n; if (!el.querySelector('.land')) el.scrollTop = el.scrollHeight; } }
    follow();
  });
}
// Someone else's burst landing: its list scrolled along, so each word is in view as it lands (a box of two rows holds
// about five words, a burst can be more). Read off the page: a chip that has begun to show is one that has landed.
function follow() {
  const step = () => {
    const chips = app.querySelectorAll ? [...app.querySelectorAll('.g-hv .hvw.land')] : [];
    if (!chips.length || typeof getComputedStyle !== 'function') return;
    const el = chips[0].parentElement, rows = c => Math.max(0, c.offsetTop + c.offsetHeight + 3 - el.clientHeight);
    let last = null, more = false;
    for (const c of chips) { if (Number(getComputedStyle(c).opacity) > 0.02) last = c; else more = true; }
    const to = rows(last || chips[0]);
    if (last ? el.scrollTop < to : Math.abs(el.scrollTop - to) > 1) el.scrollTop = to;
    if (more) requestAnimationFrame(step);
  };
  step();
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  hook();
  const c = hiveCfg(mini), pz = hivePuzzle(mini.pz), s = a && a.hv ? a.hv : null, own = !!s && ownMove(a), o = { view, locked, turn };
  const L = round.on(state.zoom) ? round.live : null;
  if (s && own && skipped !== a && flashAnimating()) { skipped = a; setTimeout(() => { if (state.flash === a) skipFlash(); }, 0); }   // (a burst played here was seen and heard live: straight to its result)
  const show = s && !own ? s : null;                               // someone else's burst, landing word by word
  if (sent && (s || mini.n[sent.p] !== sent.n || mini.pz !== sent.pz || performance.now() - sent.at > HIVEV.sent)) sent = null;
  const wait = !L && !s && !d && !view && sent && sent.sq === state.zoom ? sent : null;   // this phone's burst on its way (online): it stays on show until its record lands
  const rest = !s && (view || d) && mini.last ? mini.last : null, l = s || rest || wait, by = s ? a.by : rest ? rest.by : turn;   // (l: the burst the line speaks of; this phone's own at once)
  const mine = !view && !s && !locked && !d && !wait;
  src = { mini, mine, zoom: state.zoom };
  const end = show ? hiveShowMs(show) : 0, first = show ? hiveWordAt(show, 0) : 0, span = show ? show.w.length * hiveBeat(show.w.length) : 0;
  const more = p => (L && L.p === p ? L : wait && wait.p === p ? wait : null);
  const tal = p => { const m = more(p); return tally(p, o, c.target, mini.pts[p] + (m ? m.sum : 0), show && show.by === p ? show.from : null, first, span); };
  const list = p => { const m = more(p), ws = mini.found.filter((w, i) => mini.by[i] === p).concat(m ? m.w : []); return `<ul class="hvlist ${p}" data-n="${ws.length}" data-keep-scroll="hv${p}" aria-label="${esc(N(p).replace(/<[^>]*>/g, ''))}: ${ws.length} word${ws.length === 1 ? '' : 's'}">${chips(pz, ws, p, 0, show && show.by === p ? show : null)}</ul>`; };
  const ms = L ? msOf(L) : 0, left = L ? Math.max(0, 1 - ms / L.T) : 1, msg = L && L.msg && ms - L.msg.t <= HIVEV.say ? L.msg : null;
  const line = L ? `<p class="hvline${msg ? ' ' + msg.cls : ''}" role="status">${msg ? esc(msg.text) : ''}</p>`
    : show ? `<p ${lateAt('hvline ' + (show.full ? 'full' : show.w.length ? 'ok' : 'no'), end)} role="status">${words(show)}</p>`
      : `<p class="hvline${l ? (l.full ? ' full' : l.w.length ? ' ok' : ' no') : ''}">${l ? words(l) : ''}</p>`;
  const btns = view ? '' : L
    ? `<div class="hvbtns"><button class="big hvk" data-act="hive-del" data-hv="del">Delete</button><button class="big hvk" data-act="hive-shuf" data-hv="shuf">Shuffle</button><button class="big hvk ${L.p}" data-act="hive-ent" data-hv="ent">Enter</button></div>`
    : `<div class="hvbtns"><button class="big ${turn} hvgo" data-act="hive-go"${mine ? '' : ' disabled'}>Go!</button></div>`;
  if (L) loop();
  if (entering) stuck.key = '';                                    // (the square just opened: both lists at their ends)
  stick();
  return `<div class="g-hv pc-${by}${L ? ' live' : ''}"><div class="ctals two">${tal('X')}${tal('O')}</div><div class="hvfound">${list('X')}${list('O')}</div>`
    + `<div class="hvbar${L ? ' on' : ''}${left <= 0.25 ? ' low' : left <= 0.5 ? ' mid' : ''}" aria-hidden="true"><i style="width:${(left * 100).toFixed(2)}%"></i></div>`
    + `<div class="hvent${L && L.cur.length > LONG ? ' long' : ''}" aria-live="polite">${L ? entry(pz, L.cur, true) : ''}</div>${line}<div class="hvbox">${hiveSvg(pz, orderOf(state.zoom, mini), L ? 'on' : '')}</div>${btns}</div>`;
}
// The miniature: a little honeycomb with the seven letters, the centre one marked, beside each player's points as a bar.
export function miniature(mini, final) {
  const c = hiveCfg(mini), pz = hivePuzzle(mini.pz), R = 13, d = R * Math.sqrt(3) * 1.06;
  const cell = (ch, k) => { const a = (k * 60 - 90) * Math.PI / 180, x = k < 0 ? 0 : d * Math.cos(a), y = k < 0 ? 0 : d * Math.sin(a); return `<polygon class="thvc${k < 0 ? ' mid' : ''}" points="${hexAt(x, y, R)}"/><text class="thvl${k < 0 ? ' mid' : ''}" x="${x.toFixed(1)}" y="${(y + 6.6).toFixed(1)}">${ch.toUpperCase()}</text>`; };
  const w = 2 * (d * Math.cos(Math.PI / 6) + R) + 3, h = 2 * (d + R * Math.sqrt(3) / 2) + 3;
  const art = `<svg class="thv" viewBox="${(-w / 2).toFixed(1)} ${(-h / 2).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}">${[...pz.letters.slice(1)].map(cell).join('')}${cell(pz.centre, -1)}</svg>`;
  return thumbArt(art, barRows(mini.pts, c.target), 'thvw', `Letter Hive: X ${mini.pts.X}, O ${mini.pts.O} of ${c.target} points`);
}
export function moveText(f, who) { const s = f.hv; return !s || !s.w.length ? `${who} found no words` : `${who} found ${s.w.length} word${s.w.length === 1 ? '' : 's'} for ${sum(s)}`; }
export function heldSub(mini, turn, f, a) { return f || state.lockBy === 'open' ? '' : `<b class="${turn}">${N(turn)}</b> filled the hive · goes again`; }
// Someone else's burst, as its result is laid out: a pop as each word lands in the list (rising a little word by
// word; the flourish for a full-hive word), then a chime for points or a thud for none. A burst played here was heard live.
export function sounds(f, add, won, mini, last) {
  const s = f.hv; if (!s || ownMove(f)) return;
  const pz = mini ? hivePuzzle(mini.pz) : null;
  s.w.forEach((w, k) => add(pz && hiveFull(pz.letters, w) ? 'hvFull' : 'hvLand', hiveWordAt(s, k), 1 + Math.min(8, k) * 0.04));
  add(s.w.length ? 'ding' : 'thud', hiveShowMs(s));
}
