// Higher/Lower: the screen, the miniature, the move's words and sounds, and the inputs.
import { HILO, hiloLeft, hiloLimit, hiloOpen, hiloPart, hiloTarget, hiloTop } from './rules.js';
import { N, esc, mv } from '../../ui/app.js';
import { raceBar, raceBoards, raceMe, raceThumb } from '../../ui/race.js';

// Each player's guesses left, as pips (filled: left; hollow: used). A square from before the limit: none.
const pips = (mini, p) => { const k = hiloLimit(mini), left = hiloLeft(mini, p); return `<i class="hpips ${p}" aria-label="${p}: ${left} guess${left === 1 ? '' : 'es'} left">${Array.from({ length: k }, (_, j) => `<i class="${j < left ? 'on' : ''}"></i>`).join('')}</i>`; };
// The miniature: the numbers as a line with the range still open on it and each guess a tick in its guesser's colour
// (the target never), the range's ends as figures, and each player's guesses left.
export function miniature(mini, final) {
  if (mini.race) {                                                                        // a race: each player's numbers still possible, a bar that shrinks as they narrow in (and once the square is won, the numbers they were after)
    if (mini.rv !== 2) return raceThumb(p => raceBar(p, 1), 'thilo2', 'Race');            // (a square from before the rework: dealt again as it is met)
    const top = hiloTop(mini);
    return raceThumb(p => { const n = hiloOpen(mini, p), t = final ? hiloTarget(mini, p) : null; return `${raceBar(p, n / top, 'hlbar')}<b class="hlmn">${Number.isInteger(t) ? t : n}</b>`; }, 'thilo2', `Race: ${['X', 'O'].map(p => `${p} ${hiloOpen(mini, p)} numbers possible`).join(', ')}`);
  }
  const top = hiloTop(mini), span = Math.max(1, top - HILO.lo), x = n => (3 + 94 * (n - HILO.lo) / span).toFixed(1);
  const line = `<svg viewBox="0 0 100 14" aria-hidden="true"><rect class="rail" x="2" y="4" width="96" height="6" rx="3"/><rect class="open" x="${x(mini.lo)}" y="2.5" width="${Math.max(2, Number(x(mini.hi)) - Number(x(mini.lo))).toFixed(1)}" height="9" rx="3"/>${mini.guesses.slice(-8).map(g => `<path class="tk ${g.by}" d="M${x(g.n)} 0v14"/>`).join('')}</svg>`;
  const left = hiloLimit(mini) ? `<span class="thpips">${['X', 'O'].map(p => `<span><b class="${p}">${p}</b>${pips(mini, p)}</span>`).join('')}</span>` : `<small>${mini.guesses.length} guess${mini.guesses.length === 1 ? '' : 'es'}</small>`;
  return `<div class="thl thilo" aria-label="Between ${mini.lo} and ${mini.hi}">${line}<b>${mini.lo}–${mini.hi}</b>${left}</div>`;
}
// One player's board: the range still open to them, the line of guesses (their fresh one, else the last few), the pad.
function board(part, mini, p, locked, a, d, view) {
  const by = {};
  for (const x of part.guesses) by[x.n] = x.by;
  const first = !part.guesses.length;
  const top = hiloTop(mini), span = top - HILO.lo + 1;
  const pct = (lo, hi) => [`${(lo - HILO.lo) / span * 100}%`, `${(hi - lo + 1) / span * 100}%`];
  const [l, w] = pct(part.lo, part.hi);
  const was = a ? a.range : null;                                                       // the range before this guess
  const seg = was ? `<i class="seg shrink" style="--l:${l};--w:${w};--pl:${pct(was[0], was[1])[0]};--pw:${pct(was[0], was[1])[1]}"></i>` : `<i class="seg" style="--l:${l};--w:${w}"></i>`;
  const lastG = part.guesses[part.guesses.length - 1];
  const hist = part.guesses.slice(-3).map(x => `<span class="he"><b class="${x.by} hn">${N(x.by)}</b> ${x.n}: ${x.res === 'hit' ? 'yes!' : esc(x.res)}</span>`).join('');   // (each guess whole on its line; the newest always shows: styles.css .hist)
  const t = mini.race && view ? hiloTarget(mini, p) : null;
  const result = (a || d) && lastG                                                      // the fresh guess, with its arrow (held while the result stays up)
    ? `<div class="guess${a ? ' fresh' : ''}"><b class="${lastG.by} hn">${N(lastG.by)}</b> said <b class="n">${lastG.n}</b>${lastG.res === 'hit' ? '<span class="arrow yes">✓</span> Yes!'
          : `<span class="arrow ${lastG.res === 'higher' ? 'up' : 'dn'}">${lastG.res === 'higher' ? '▲' : '▼'}</span> ${lastG.res === 'higher' ? 'Higher' : 'Lower'}!${(a || d).note === 'out' ? ' No guesses left' : ''}`}</div>`
    : Number.isInteger(t) ? `<div class="hist">The number was <b class="n">${t}</b></div>`  // (a finished race square: this side's own number, revealed)
    : `<div class="hist">${hist || 'No guesses yet'}</div>`;
  const out = n => !!(was && lastG && n !== lastG.n && n >= was[0] && n <= was[1] && (n < part.lo || n > part.hi));   // numbers this guess ruled out
  const left = hiloLimit(mini) ? `<div class="hleft">${['X', 'O'].map(q => `<span class="${q}"><b class="${q}">${N(q)}</b>${pips(mini, q)}</span>`).join('')}</div>` : '';   // each player's guesses left (always there: the pad never moves; a race has no limit)
  return `<div class="g-hilo${top > 20 ? ' t30' : ''}${mini.race ? ' race' : ''}" style="--cols:${top <= 20 ? 5 : top <= 30 ? 6 : top <= 40 ? 8 : top <= 60 ? 10 : 11}"><div class="range"><small>${first ? 'A number from' : 'It is between'}</small><b>${part.lo}</b><span>${first ? 'to' : 'and'}</span><b>${part.hi}</b><div class="rbar">${seg}</div></div>
        ${left}${result}
        <div class="pad">${Array.from({ length: top }, (_, k) => k + 1).map(n =>
          `<button class="${by[n] || ''}${out(n) ? ' out' : ''}" data-act="move" ${mv(n)}${n < part.lo || n > part.hi || locked ? ' disabled' : ''}>${n}</button>`
        ).join('')}</div></div>`;
}
// The other player's board in a race (read-only, smaller): their range on the number line, narrowing with each guess, their
// guesses as ticks in their colour, and their latest guess and its answer in its own reserved line.
function oppBoard(part, mini, p, a, view) {
  const top = hiloTop(mini), span = top - HILO.lo + 1, x = n => ((n - HILO.lo + 0.5) / span * 100).toFixed(2);
  const pct = (lo, hi) => [`${((lo - HILO.lo) / span * 100).toFixed(2)}%`, `${((hi - lo + 1) / span * 100).toFixed(2)}%`];
  const [l, w] = pct(part.lo, part.hi), was = a ? a.range : null;
  const seg = was ? `<i class="seg shrink" style="--l:${l};--w:${w};--pl:${pct(was[0], was[1])[0]};--pw:${pct(was[0], was[1])[1]}"></i>` : `<i class="seg" style="--l:${l};--w:${w}"></i>`;
  const last = part.guesses[part.guesses.length - 1], t = view ? hiloTarget(mini, p) : null;
  const ticks = part.guesses.map((g, k) => `<i class="hlt ${p}${a && k === part.guesses.length - 1 ? ' fresh' : ''}${g.res === 'hit' ? ' hit' : ''}" style="--x:${x(g.n)}%"></i>`).join('');
  const said = last ? `<b class="n">${last.n}</b>${last.res === 'hit' ? '<span class="arrow yes">✓</span> Yes!' : `<span class="arrow ${last.res === 'higher' ? 'up' : 'dn'}">${last.res === 'higher' ? '▲' : '▼'}</span> ${last.res === 'higher' ? 'Higher' : 'Lower'}`}` : 'No guesses yet';
  return `<div class="hlo"><div class="hlr"><b>${part.lo}</b><span>–</span><b>${part.hi}</b></div><div class="rbar hlrail">${seg}${ticks}</div>`
    + `<div class="hlsaid${a ? ' fresh' : ''}">${Number.isInteger(t) ? `Their number was <b class="n">${t}</b>` : said}</div></div>`;
}
const blank = mini => ({ lo: HILO.lo, hi: hiloTop(mini), guesses: [] });
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  if (!mini.race) return board(mini, mini, null, locked, a, d, view);
  const me = raceMe(), them = me === 'X' ? 'O' : 'X';
  const mine = hiloPart(mini, me) || blank(mini), theirs = hiloPart(mini, them) || blank(mini);   // (each side's own range and guesses, both open; a square from before the rework: what this copy has)
  const mineA = a && a.by === me ? a : null, mineD = d && d.by === me ? d : null, theirA = a && a.by === them ? a : null;      // the move to animate, on the board of the side that made it
  const n = theirs.guesses.length;
  return raceBoards(board(mine, mini, me, locked, mineA, mineD, view), oppBoard(theirs, mini, them, theirA, view), `${n} guess${n === 1 ? '' : 'es'}`, { cls: 'rb-hilo' });
}
export function moveText(f, who) {
  if (f.n == null) return 'Guessed';                           // (a redacted move from before the race rework: nothing to say)
  const dir = (f.res || f.note) === 'higher' ? 'Higher' : 'Lower';
  return f.note === 'out' ? `${f.n}? ${dir}! Out of guesses` : `${f.n}? ${dir}!`;
}
export function sounds(f, add, won, mini, last) {
  if (!last && mini && mini.race) { const part = hiloPart(mini, f.by); last = part ? part.guesses[part.guesses.length - 1] : null; }   // (a race: the mover's own last guess, open to both)
  add('hiloBlip', 0); if (last) { if (last.res === 'hit') add('ding', 260); else if (last.res) add(last.res === 'higher' ? 'higher' : 'lower', 260); }
  if (f.note === 'out') add('thud', 700);                     // the last guess gone: the square goes to the other player
  return;
}
