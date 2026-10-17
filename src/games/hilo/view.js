// Higher/Lower: the screen, the miniature, the move's words and sounds, and the inputs.
import { HILO } from './rules.js';
import { N, mv } from '../../ui/app.js';

export function miniature(mini, final) {
  return `<div class="thilo"><b>${mini.lo}–${mini.hi}</b><small>${mini.guesses.length} guess${mini.guesses.length === 1 ? '' : 'es'}</small></div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const by = {};
  for (const x of mini.guesses) by[x.n] = x.by;
  const first = !mini.guesses.length;
  const span = HILO.hi - HILO.lo + 1;
  const pct = (lo, hi) => [`${(lo - HILO.lo) / span * 100}%`, `${(hi - lo + 1) / span * 100}%`];
  const [l, w] = pct(mini.lo, mini.hi);
  const was = a ? a.range : null;                                                       // the range before this guess
  const seg = was ? `<i class="seg shrink" style="--l:${l};--w:${w};--pl:${pct(was[0], was[1])[0]};--pw:${pct(was[0], was[1])[1]}"></i>` : `<i class="seg" style="--l:${l};--w:${w}"></i>`;
  const lastG = mini.guesses[mini.guesses.length - 1];
  const hist = mini.guesses.slice(-3).map(x => `<b class="${x.by}">${N(x.by)}</b> ${x.n}: ${x.res === 'hit' ? 'yes!' : x.res}`).join(' · ');
  const result = (a || d) && lastG                                                     // the fresh guess, with its arrow
    ? `<div class="guess${a ? ' fresh' : ''}"><b class="${lastG.by}">${N(lastG.by)}</b> said <b class="n">${lastG.n}</b>${lastG.res === 'hit' ? '<span class="arrow yes">✓</span> Yes!'
          : `<span class="arrow ${lastG.res === 'higher' ? 'up' : 'dn'}">${lastG.res === 'higher' ? '▲' : '▼'}</span> ${lastG.res === 'higher' ? 'Higher' : 'Lower'}!`}</div>`
    : `<div class="hist">${hist || 'No guesses yet'}</div>`;
  const out = n => !!(was && lastG && n !== lastG.n && n >= was[0] && n <= was[1] && (n < mini.lo || n > mini.hi));   // numbers this guess ruled out
  g = `<div class="g-hilo"><div class="range"><small>${first ? 'A number from' : 'It is between'}</small><b>${mini.lo}</b><span>${first ? 'to' : 'and'}</span><b>${mini.hi}</b><div class="rbar">${seg}</div></div>
        ${result}
        <div class="pad">${Array.from({ length: HILO.hi }, (_, k) => k + 1).map(n =>
          `<button class="${by[n] || ''}${out(n) ? ' out' : ''}" data-act="move" ${mv(n)}${n < mini.lo || n > mini.hi || locked ? ' disabled' : ''}>${n}</button>`
        ).join('')}</div></div>`;
  return g;
}
export function moveText(f, who) {
  return `${f.n}? ${f.note === 'higher' ? 'Higher' : 'Lower'}!`;
}
export function sounds(f, add, won, mini, last) {
  add('hiloBlip', 0); if (last) { if (last.res === 'hit') add('ding', 260); else add(last.res === 'higher' ? 'higher' : 'lower', 260); } return;
}
