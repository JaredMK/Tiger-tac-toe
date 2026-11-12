// Higher/Lower: the screen, the miniature, the move's words and sounds, and the inputs.
import { HILO, hiloLeft, hiloLimit, hiloOpen, hiloPart, hiloTarget, hiloTop } from './rules.js';
import { N, esc, mv } from '../../ui/app.js';
import { cfAnchor, cfFrom } from '../../ui/cardfly.js';
import { raceBar, raceBoards, raceMe, raceThumb } from '../../ui/race.js';

// A move's timings, ms into the move (the stylesheet's .g-hilo delays are these figures; sounds() below keeps to them):
// the guess leaves its pad button for the number line at once and lands as a pin (`fly`), the ruled-out side of the
// line closes (`sweep`, as the pad's numbers shut one after the other away from the guess), and the answer, its arrow
// and its sound arrive (`say`).
export const HILOT = { fly: 240, sweep: 220, say: 260 };
const RES = { higher: 'up', lower: 'dn', hit: 'hit' };
const lastOf = part => part.guesses[part.guesses.length - 1];
// The range as it is drawn: the right guess closes it onto its number (a Shared square keeps its last range).
const shown = part => { const g = lastOf(part); return g && g.res === 'hit' ? [g.n, g.n] : [part.lo, part.hi]; };
// Each player's guesses left, as pips (filled: left; hollow: used; `spent`: the one this move used up, emptying as it lands). A square from before the limit: none.
const pips = (mini, p, spent) => { const k = hiloLimit(mini), left = hiloLeft(mini, p); return `<i class="hpips ${p}" aria-label="${p}: ${left} guess${left === 1 ? '' : 'es'} left">${Array.from({ length: k }, (_, j) => `<i class="${j < left ? 'on' : spent && j === left ? 'use' : ''}"></i>`).join('')}</i>`; };
// The miniature: the numbers as a line with the range still open on it and each guess a pin in its guesser's colour
// (the target never), the range's ends as figures, and each player's guesses left.
export function miniature(mini, final) {
  if (mini.race) {                                                                        // a race: each player's numbers still possible, a bar that shrinks as they narrow in (and once the square is won, the numbers they were after)
    if (mini.rv !== 2) return raceThumb(p => raceBar(p, 1), 'thilo2', 'Race');            // (a square from before the rework: dealt again as it is met)
    const top = hiloTop(mini);
    return raceThumb(p => { const n = hiloOpen(mini, p), t = final ? hiloTarget(mini, p) : null; return `${raceBar(p, n / top, 'hlbar')}<b class="hlmn">${Number.isInteger(t) ? t : n}</b>`; }, 'thilo2', `Race: ${['X', 'O'].map(p => `${p} ${hiloOpen(mini, p)} numbers possible`).join(', ')}`);
  }
  const top = hiloTop(mini), span = Math.max(1, top - HILO.lo), x = n => (3 + 94 * (n - HILO.lo) / span).toFixed(1), [lo, hi] = shown(mini);
  const line = `<svg viewBox="0 0 100 15" aria-hidden="true"><rect class="rail" x="2" y="6" width="96" height="6" rx="3"/><rect class="open" x="${(Number(x(lo)) - (lo === hi ? 1.5 : 0)).toFixed(1)}" y="4.5" width="${Math.max(3, Number(x(hi)) - Number(x(lo))).toFixed(1)}" height="9" rx="3"/>${mini.guesses.slice(-8).map(g => `<path class="tk ${g.by}" d="M${x(g.n)} 3v12"/><circle class="tkh ${g.by}" cx="${x(g.n)}" cy="2.6" r="2.2"/>`).join('')}</svg>`;
  const left = hiloLimit(mini) ? `<span class="thpips">${['X', 'O'].map(p => `<span><b class="${p}">${p}</b>${pips(mini, p)}</span>`).join('')}</span>` : `<small>${mini.guesses.length} guess${mini.guesses.length === 1 ? '' : 'es'}</small>`;
  return `<div class="thl thilo" aria-label="${lo === hi ? lo : `Between ${lo} and ${hi}`}">${line}<b>${lo === hi ? lo : `${lo}–${hi}`}</b>${left}</div>`;
}
// The number line (the hero of the square): every number from end to end, the window still open on it, and each guess
// a pin in its guesser's colour where it was made, the newest tagged with its number. A fresh guess (`a`: the move to
// animate) flies from its pad button to its pin (`o.pad`: this board has the pad; ui/cardfly.js, else it drops in) and
// the side it ruled out sweeps closed. `o.p`: a race board's player (the window in their colour).
function numLine(part, mini, a, o) {
  const top = hiloTop(mini), span = top - HILO.lo + 1, gs = part.guesses, [lo, hi] = shown(part);
  const x = n => ((n - HILO.lo + 0.5) / span * 100).toFixed(2);
  const pct = (l, h) => [`${((l - HILO.lo) / span * 100).toFixed(2)}%`, `${((h - l + 1) / span * 100).toFixed(2)}%`];
  const [l, w] = pct(lo, hi), was = a ? a.range : null;                                 // (the range before this guess)
  const seg = was ? `<i class="seg shrink" style="--l:${l};--w:${w};--pl:${pct(was[0], was[1])[0]};--pw:${pct(was[0], was[1])[1]}"></i>` : `<i class="seg" style="--l:${l};--w:${w}"></i>`;
  const pins = gs.map((g, k) => { const nw = k === gs.length - 1, fr = !!a && nw; return `<i class="hlt ${g.by}${fr ? ' fresh' : ''}" data-r="${RES[g.res] || ''}"${nw ? ' data-tag=""' : ''} style="--at:${x(g.n)}%"${fr && o.pad ? cfFrom('hpad:' + g.n, 0, { d: HILOT.fly }) : ''}>${nw ? `<b>${g.n}</b>` : ''}</i>`; }).join('');
  return `<div class="hline${o.p ? ' ' + o.p : ''}${lo === hi && gs.length ? ' found' : ''}">${seg}${pins}</div>`;
}
// The card over the line: the range in figures (a bound this guess moved counts over to its new value as the line
// closes), or, once it is found, the number itself.
function head(part, a) {
  const first = !part.guesses.length, was = a ? a.range : null, g = lastOf(part), [lo, hi] = shown(part);
  const fig = (v, old) => (was && Number.isInteger(old) && old !== v ? `<b class="cnt" data-from="${old}" data-delay="${HILOT.sweep}" data-ms="400">${v}</b>` : `<b>${v}</b>`);
  const between = (l, h, w) => `<small>${first ? 'A number from' : 'It is between'}</small>${fig(l, w && w[0])}<span>${first ? 'to' : 'and'}</span>${fig(h, w && w[1])}`;
  if (g && g.res === 'hit') return `<div class="hlhd found${a ? ' fresh' : ''}">${was ? `<div class="hlwas"><small>It is between</small><b>${was[0]}</b><span>and</span><b>${was[1]}</b></div>` : ''}<div class="hlnow"><small>It is</small><b class="hlnum">${g.n}</b></div></div>`;
  return `<div class="hlhd"><div class="hlnow">${between(lo, hi, was)}</div></div>`;
}
// One player's board: the range still open to them on the number line, the latest guess and its answer (else the last few), the pad.
function board(part, mini, p, locked, a, d, view, turn) {
  const by = {};
  for (const x of part.guesses) by[x.n] = x;
  const top = hiloTop(mini), [lo, hi] = shown(part);
  const was = a ? a.range : null;                                                       // the range before this guess
  const lastG = lastOf(part), hit = !!lastG && lastG.res === 'hit';
  const hist = part.guesses.slice(-3).map(x => `<span class="he">${mini.race ? '' : `<b class="${x.by} hn">${N(x.by)}</b> `}${x.n}: ${x.res === 'hit' ? 'yes!' : esc(x.res)}</span>`).join('');   // (each guess whole on its line; the newest always shows: styles.css .hist; a race board's guesses are all its own player's: no names, one line)
  const t = view && !hit ? hiloTarget(mini, p) : null;
  const result = (a || d) && lastG                                                      // the fresh guess, with its arrow (held while the result stays up)
    ? `<div class="guess${a ? ' fresh' : ''}">${(a || d).note === 'out' ? `<b class="n ${lastG.by}">${lastG.n}</b>` : `<b class="${lastG.by} hn">${N(lastG.by)}</b> said <b class="n">${lastG.n}</b>`}${hit ? '<span class="arrow yes">✓</span><b class="hres">Yes!</b>'
          : `<span class="arrow ${lastG.res === 'higher' ? 'up' : 'dn'}">${lastG.res === 'higher' ? '▲' : '▼'}</span><b class="hres">${lastG.res === 'higher' ? 'Higher' : 'Lower'}!</b>${(a || d).note === 'out' ? '<span class="hout">No guesses left</span>' : ''}`}</div>`
    : Number.isInteger(t) ? `<div class="hist">The number was <b class="n">${t}</b></div>`  // (a finished square: the number, revealed; a race: this side's own)
    : `<div class="hist">${hist || 'No guesses yet'}</div>`;
  const out = n => !!(was && lastG && n !== lastG.n && n >= was[0] && n <= was[1] && (n < lo || n > hi));   // numbers this guess ruled out
  const left = hiloLimit(mini) ? `<div class="hleft">${['X', 'O'].map(q => `<span class="${q}"><b class="${q}">${N(q)}</b>${pips(mini, q, !!a && a.by === q)}</span>`).join('')}</div>` : '';   // each player's guesses left (always there: the pad never moves; a race has no limit)
  // The pad: a number still possible is a raised key (pressed flat while it is not this phone's move); one ruled out is
  // shut (a fresh one shuts in its turn, away from the guess: --d); a guessed one carries its guesser's colour and its answer.
  const key = n => {
    const g = by[n], fresh = !!a && !!lastG && n === lastG.n;
    const cls = g ? `${g.by} ${RES[g.res] || ''}${fresh ? ' me' : ''}` : out(n) ? 'shut out' : n < lo || n > hi ? 'shut' : '';
    return `<button class="${cls}" data-act="move" ${mv(n)}${n < lo || n > hi || g || locked ? ' disabled' : ''}${!g && out(n) ? ` style="--d:${Math.min(22, Math.abs(n - lastG.n))}"` : ''}${fresh ? cfAnchor('hpad:' + n) : ''}>${n}</button>`;
  };
  return `<div class="g-hilo${top > 20 ? ' t30' : ''}${mini.race ? ' race' : ''}${turn && !locked ? ' t' + turn : ''}" style="--cols:${top <= 20 ? 5 : top <= 30 ? 6 : top <= 40 ? 8 : top <= 60 ? 10 : 11}"><div class="range">${head(part, a)}${numLine(part, mini, a, { pad: true, p: mini.race ? p : null })}</div>
        ${left}${result}
        <div class="pad">${Array.from({ length: top }, (_, k) => k + 1).map(key).join('')}</div></div>`;
}
// The other player's board in a race (read-only, smaller): their range on the number line, narrowing with each guess, their
// guesses as pins in their colour, and their latest guess and its answer in its own reserved line.
function oppBoard(part, mini, p, a, view) {
  const [lo, hi] = shown(part), last = lastOf(part), t = view ? hiloTarget(mini, p) : null;
  const said = last ? `<b class="n">${last.n}</b>${last.res === 'hit' ? '<span class="arrow yes">✓</span> Yes!' : `<span class="arrow ${last.res === 'higher' ? 'up' : 'dn'}">${last.res === 'higher' ? '▲' : '▼'}</span> ${last.res === 'higher' ? 'Higher' : 'Lower'}`}` : 'No guesses yet';
  return `<div class="hlo"><div class="hlr"><b>${lo}</b><span>–</span><b>${hi}</b></div>${numLine(part, mini, a, { p })}`
    + `<div class="hlsaid${a ? ' fresh' : ''}">${Number.isInteger(t) ? `Their number was <b class="n">${t}</b>` : said}</div></div>`;
}
const blank = mini => ({ lo: HILO.lo, hi: hiloTop(mini), guesses: [] });
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  if (!mini.race) return board(mini, mini, null, locked, a, d, view, turn);
  const me = raceMe(), them = me === 'X' ? 'O' : 'X';
  const mine = hiloPart(mini, me) || blank(mini), theirs = hiloPart(mini, them) || blank(mini);   // (each side's own range and guesses, both open; a square from before the rework: what this copy has)
  const mineA = a && a.by === me ? a : null, mineD = d && d.by === me ? d : null, theirA = a && a.by === them ? a : null;      // the move to animate, on the board of the side that made it
  const n = theirs.guesses.length;
  return raceBoards(board(mine, mini, me, locked, mineA, mineD, view, me), oppBoard(theirs, mini, them, theirA, view), `${n} guess${n === 1 ? '' : 'es'}`, { cls: 'rb-hilo' });
}
export function moveText(f, who) {
  if (f.n == null) return 'Guessed';                           // (a redacted move from before the race rework: nothing to say)
  if (f.res === 'hit') return `${f.n}? Yes!`;
  const dir = (f.res || f.note) === 'higher' ? 'Higher' : 'Lower';
  return f.note === 'out' ? `${f.n}? ${dir}! Out of guesses` : `${f.n}? ${dir}!`;
}
export function sounds(f, add, won, mini, last) {
  if (!last && mini && mini.race) { const part = hiloPart(mini, f.by); last = part ? part.guesses[part.guesses.length - 1] : null; }   // (a race: the mover's own last guess, open to both)
  add('hiloBlip', 0);                                         // the guess leaves the pad; its answer sounds as it lands on the line
  if (last) { if (last.res === 'hit') add('ding', HILOT.say); else if (last.res) add(last.res === 'higher' ? 'higher' : 'lower', HILOT.say); }
  if (f.note === 'out') add('thud', 700);                     // the last guess gone: the square goes to the other player
  return;
}
