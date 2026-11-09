// Higher/Lower: the screen, the miniature, the move's words and sounds, and the inputs.
import { HILO, hiloLeft, hiloLimit, hiloPart, hiloTop } from './rules.js';
import { N, esc, mv, viewer } from '../../ui/app.js';

// Race mode (core/race.js): the square this view gets holds this phone's own part alone (its range and guesses) and both
// players' shapes (guesses used, how close); the other side's move arrives redacted (`a.race`: their shape after it).
const HEAT = { cold: 'Cold', warm: 'Warm', hot: 'Hot', hit: 'Got it!' };
const heatOf = (mini, p) => (mini.shape && mini.shape[p] && mini.shape[p].heat) || null;
const heatChip = (mini, p) => { const h = heatOf(mini, p); return `<em class="hheat ${h || 'none'}">${h ? HEAT[h] : '–'}</em>`; };   // (always there: the row never moves)

// Each player's guesses left, as pips (filled: left; hollow: used). A square from before the limit: none.
const pips = (mini, p) => { const k = hiloLimit(mini), left = hiloLeft(mini, p); return `<i class="hpips ${p}" aria-label="${p}: ${left} guess${left === 1 ? '' : 'es'} left">${Array.from({ length: k }, (_, j) => `<i class="${j < left ? 'on' : ''}"></i>`).join('')}</i>`; };
// The miniature: the numbers as a line with the range still open on it and each guess a tick in its guesser's colour
// (the target never), the range's ends as figures, and each player's guesses left.
export function miniature(mini, final) {
  if (mini.race && !final) {                                                              // a race: each player's guesses used and how close they are (the numbers are theirs alone)
    return `<div class="thl thilo trace" aria-label="Race: ${['X', 'O'].map(p => `${p} ${hiloLimit(mini) ? hiloLeft(mini, p) + ' guesses left' : ''} ${heatOf(mini, p) ? HEAT[heatOf(mini, p)] : 'no guess yet'}`).join(', ')}">${['X', 'O'].map(p => `<span class="trr"><b class="${p}">${p}</b>${hiloLimit(mini) ? pips(mini, p) : ''}${heatChip(mini, p)}</span>`).join('')}</div>`;
  }
  const top = hiloTop(mini), span = Math.max(1, top - HILO.lo), x = n => (3 + 94 * (n - HILO.lo) / span).toFixed(1);
  const line = `<svg viewBox="0 0 100 14" aria-hidden="true"><rect class="rail" x="2" y="4" width="96" height="6" rx="3"/><rect class="open" x="${x(mini.lo)}" y="2.5" width="${Math.max(2, Number(x(mini.hi)) - Number(x(mini.lo))).toFixed(1)}" height="9" rx="3"/>${mini.guesses.slice(-8).map(g => `<path class="tk ${g.by}" d="M${x(g.n)} 0v14"/>`).join('')}</svg>`;
  const left = hiloLimit(mini) ? `<span class="thpips">${['X', 'O'].map(p => `<span><b class="${p}">${p}</b>${pips(mini, p)}</span>`).join('')}</span>` : `<small>${mini.guesses.length} guess${mini.guesses.length === 1 ? '' : 'es'}</small>`;
  return `<div class="thl thilo" aria-label="Between ${mini.lo} and ${mini.hi}">${line}<b>${mini.lo}–${mini.hi}</b>${left}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const race = !!mini.race, me = race ? (viewer() || turn) : null;
  const part = race ? (hiloPart(mini, me) || hiloPart(mini, 'X') || { lo: HILO.lo, hi: hiloTop(mini), guesses: [] }) : mini;   // (a race: this side's own range and guesses; a finished square reviewed: X's, both revealed)
  const theirs = race && a && a.race && a.by !== me ? a : race && d && d.race && d.by !== me ? d : null;   // the other side's move, as its shape
  const by = {};
  for (const x of part.guesses) by[x.n] = x.by;
  const first = !part.guesses.length;
  const top = hiloTop(mini), span = top - HILO.lo + 1;
  const pct = (lo, hi) => [`${(lo - HILO.lo) / span * 100}%`, `${(hi - lo + 1) / span * 100}%`];
  const [l, w] = pct(part.lo, part.hi);
  const was = a && !theirs ? a.range : null;                                            // the range before this guess
  const seg = was ? `<i class="seg shrink" style="--l:${l};--w:${w};--pl:${pct(was[0], was[1])[0]};--pw:${pct(was[0], was[1])[1]}"></i>` : `<i class="seg" style="--l:${l};--w:${w}"></i>`;
  const lastG = part.guesses[part.guesses.length - 1];
  const hist = part.guesses.slice(-3).map(x => `<span class="he"><b class="${x.by} hn">${N(x.by)}</b> ${x.n}: ${x.res === 'hit' ? 'yes!' : esc(x.res)}</span>`).join('');   // (each guess whole on its line; the newest always shows: styles.css .hist)
  const result = theirs                                                                 // the other side's guess in a race: how close they are now, never the number
    ? `<div class="guess${a ? ' fresh' : ''}"><b class="${theirs.by} hn">${N(theirs.by)}</b> guessed <span class="hheat ${theirs.race.heat || 'none'}">${theirs.race.heat ? HEAT[theirs.race.heat] : ''}</span>${theirs.race.left === 0 ? ' · no guesses left' : ''}</div>`
    : (a || d) && lastG                                                                 // the fresh guess, with its arrow
    ? `<div class="guess${a ? ' fresh' : ''}"><b class="${lastG.by} hn">${N(lastG.by)}</b> said <b class="n">${lastG.n}</b>${lastG.res === 'hit' ? '<span class="arrow yes">✓</span> Yes!'
          : `<span class="arrow ${lastG.res === 'higher' ? 'up' : 'dn'}">${lastG.res === 'higher' ? '▲' : '▼'}</span> ${lastG.res === 'higher' ? 'Higher' : 'Lower'}!${a && a.note === 'out' ? ' No guesses left' : ''}`}</div>`
    : `<div class="hist">${hist || (race ? 'Your guesses are yours alone' : 'No guesses yet')}</div>`;
  const out = n => !!(was && lastG && n !== lastG.n && n >= was[0] && n <= was[1] && (n < part.lo || n > part.hi));   // numbers this guess ruled out
  const left = hiloLimit(mini) || race ? `<div class="hleft${race ? ' race' : ''}">${['X', 'O'].map(p => `<span class="${p}"><b class="${p}">${N(p)}</b>${hiloLimit(mini) ? pips(mini, p) : ''}${race ? heatChip(mini, p) : ''}</span>`).join('')}</div>` : '';   // each player's guesses left (always there: the pad never moves); a race: how close each is
  g = `<div class="g-hilo${top > 20 ? ' t30' : ''}" style="--cols:${top <= 20 ? 5 : top <= 30 ? 6 : top <= 40 ? 8 : top <= 60 ? 10 : 11}"><div class="range"><small>${first ? 'A number from' : 'It is between'}</small><b>${part.lo}</b><span>${first ? 'to' : 'and'}</span><b>${part.hi}</b><div class="rbar">${seg}</div></div>
        ${left}${result}
        <div class="pad">${Array.from({ length: top }, (_, k) => k + 1).map(n =>
          `<button class="${by[n] || ''}${out(n) ? ' out' : ''}" data-act="move" ${mv(n)}${n < part.lo || n > part.hi || locked ? ' disabled' : ''}>${n}</button>`
        ).join('')}</div></div>`;
  return g;
}
export function moveText(f, who) {
  if (f.race && f.n == null) return `Guess ${f.race.n}${f.race.heat ? ` · ${HEAT[f.race.heat]}` : ''}${f.race.left === 0 ? ' · out of guesses' : ''}`;   // the other side's guess in a race: its shape alone
  const dir = (f.res || f.note) === 'higher' ? 'Higher' : 'Lower';
  return f.note === 'out' ? `${f.n}? ${dir}! Out of guesses` : `${f.n}? ${dir}!`;
}
export function sounds(f, add, won, mini, last) {
  if (!last && mini && mini.race) { const part = hiloPart(mini, f.by); last = part ? part.guesses[part.guesses.length - 1] : (f.race && f.race.heat === 'hit' ? { res: 'hit' } : null); }   // (a race: this side's own last guess; the other side's, its shape: a hit alone is heard)
  add('hiloBlip', 0); if (last) { if (last.res === 'hit') add('ding', 260); else if (last.res) add(last.res === 'higher' ? 'higher' : 'lower', 260); }
  if (f.note === 'out') add('thud', 700);                     // the last guess gone: the square goes to the other player
  return;
}
