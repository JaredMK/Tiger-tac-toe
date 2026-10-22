// Higher/Lower: the screen, the miniature, the move's words and sounds, and the inputs.
import { HILO, hiloLeft, hiloLimit, hiloTop } from './rules.js';
import { N, mv } from '../../ui/app.js';

// Each player's guesses left, as pips (filled: left; hollow: used). A square from before the limit: none.
const pips = (mini, p) => { const k = hiloLimit(mini), left = hiloLeft(mini, p); return `<i class="hpips ${p}" aria-label="${p}: ${left} guess${left === 1 ? '' : 'es'} left">${Array.from({ length: k }, (_, j) => `<i class="${j < left ? 'on' : ''}"></i>`).join('')}</i>`; };
export function miniature(mini, final) {
  if (!hiloLimit(mini)) return `<div class="thilo"><b>${mini.lo}–${mini.hi}</b><small>${mini.guesses.length} guess${mini.guesses.length === 1 ? '' : 'es'}</small></div>`;
  return `<div class="thilo"><b>${mini.lo}–${mini.hi}</b><span class="thpips">${['X', 'O'].map(p => `<span><b class="${p}">${p}</b>${pips(mini, p)}</span>`).join('')}</span></div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const by = {};
  for (const x of mini.guesses) by[x.n] = x.by;
  const first = !mini.guesses.length;
  const top = hiloTop(mini), span = top - HILO.lo + 1;
  const pct = (lo, hi) => [`${(lo - HILO.lo) / span * 100}%`, `${(hi - lo + 1) / span * 100}%`];
  const [l, w] = pct(mini.lo, mini.hi);
  const was = a ? a.range : null;                                                       // the range before this guess
  const seg = was ? `<i class="seg shrink" style="--l:${l};--w:${w};--pl:${pct(was[0], was[1])[0]};--pw:${pct(was[0], was[1])[1]}"></i>` : `<i class="seg" style="--l:${l};--w:${w}"></i>`;
  const lastG = mini.guesses[mini.guesses.length - 1];
  const hist = mini.guesses.slice(-3).map(x => `<b class="${x.by}">${N(x.by)}</b> ${x.n}: ${x.res === 'hit' ? 'yes!' : x.res}`).join(' · ');
  const result = (a || d) && lastG                                                     // the fresh guess, with its arrow
    ? `<div class="guess${a ? ' fresh' : ''}"><b class="${lastG.by}">${N(lastG.by)}</b> said <b class="n">${lastG.n}</b>${lastG.res === 'hit' ? '<span class="arrow yes">✓</span> Yes!'
          : `<span class="arrow ${lastG.res === 'higher' ? 'up' : 'dn'}">${lastG.res === 'higher' ? '▲' : '▼'}</span> ${lastG.res === 'higher' ? 'Higher' : 'Lower'}!${a && a.note === 'out' ? ' No guesses left' : ''}`}</div>`
    : `<div class="hist">${hist || 'No guesses yet'}</div>`;
  const out = n => !!(was && lastG && n !== lastG.n && n >= was[0] && n <= was[1] && (n < mini.lo || n > mini.hi));   // numbers this guess ruled out
  const left = hiloLimit(mini) ? `<div class="hleft">${['X', 'O'].map(p => `<span class="${p}"><b class="${p}">${N(p)}</b>${pips(mini, p)}</span>`).join('')}</div>` : '';   // each player's guesses left (always there: the pad never moves)
  g = `<div class="g-hilo${top > 20 ? ' t30' : ''}" style="--cols:${top <= 20 ? 5 : top <= 30 ? 6 : top <= 40 ? 8 : top <= 60 ? 10 : 11}"><div class="range"><small>${first ? 'A number from' : 'It is between'}</small><b>${mini.lo}</b><span>${first ? 'to' : 'and'}</span><b>${mini.hi}</b><div class="rbar">${seg}</div></div>
        ${left}${result}
        <div class="pad">${Array.from({ length: top }, (_, k) => k + 1).map(n =>
          `<button class="${by[n] || ''}${out(n) ? ' out' : ''}" data-act="move" ${mv(n)}${n < mini.lo || n > mini.hi || locked ? ' disabled' : ''}>${n}</button>`
        ).join('')}</div></div>`;
  return g;
}
export function moveText(f, who) {
  const dir = (f.res || f.note) === 'higher' ? 'Higher' : 'Lower';
  return f.note === 'out' ? `${f.n}? ${dir}! Out of guesses` : `${f.n}? ${dir}!`;
}
export function sounds(f, add, won, mini, last) {
  add('hiloBlip', 0); if (last) { if (last.res === 'hit') add('ding', 260); else add(last.res === 'higher' ? 'higher' : 'lower', 260); }
  if (f.note === 'out') add('thud', 700);                     // the last guess gone: the square goes to the other player
  return;
}
