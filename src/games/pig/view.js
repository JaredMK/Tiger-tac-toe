// Risky Rolls: the screen, the miniature, the move's words and sounds, and the inputs.
import { RISKY } from './rules.js';
import { N, mv } from '../../ui/app.js';
import { dieFace } from '../../ui/art.js';

export function miniature(mini, final) {
  return `<div class="tdice">${['X', 'O'].map(p => `<div class="tr ${p}"><b class="${p}">${p}</b><div class="bar"><i style="width:${Math.min(100, mini.bank[p] / RISKY.goal * 100)}%"></i></div><span>${mini.bank[p]}</span></div>`).join('')}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  // Risky Rolls. The two scores, with this turn's points at risk as a small +N by the roller's score; the
  // dice rolled this turn in a row; the die; Roll again and Bank (only Bank once it would reach the goal).
  // A roll tumbles the die, and the +N it adds to stays up through the tumble, taking the new points as
  // the die lands; a bank only moves the +N into the score (the die is left as it was); a bust knocks
  // the +N out. A winning bank is a bank too (an older record says so only through mini.last).
  const note = a ? a.note || ((a.kind === 'claim' || a.kind === 'match') && mini.last && mini.last.kind === 'bank' ? 'bank' : null) : null;
  const t = mini.turn, over = note === 'bust' || note === 'bank';   // a bust or a bank: the turn is already over, show the pot it had, then watch it go
  const rolls = over ? a.rolls : t ? t.rolls : [], pot = over ? a.pot : t ? t.pot : 0, by = over ? a.by : t ? t.by : null;
  const score = p => {
    const banked = mini.bank[p], gain = note === 'bank' && a.by === p;
    const prev = gain ? banked - a.pot : banked;
    const was = note === 'roll' ? pot - a.roll : pot;                 // the +N before this roll
    const risk = by === p && pot ? `<span class="risk${note === 'roll' ? (was ? ' grow' : ' grow first') : note === 'bank' ? ' bank' : note === 'bust' ? ' lost' : ''}">+${note === 'roll' && was ? `<b class="cnt" data-from="${was}" data-delay="600" data-ms="400">${pot}</b>` : pot}</span>` : '';
    return `<div class="pscore ${p}${!view && turn === p ? ' now' : ''}${gain ? ' gain' : ''}"><div class="nm"><b class="${p}">${N(p)}</b></div><div class="val"><span><b class="vnum">${gain ? `<b class="cnt" data-from="${prev}" data-delay="350" data-ms="500">${banked}</b>` : banked}</b> <small>/ ${RISKY.goal}</small></span>${risk}</div><div class="bar"><i style="width:${Math.min(100, banked / RISKY.goal * 100)}%;--pw:${Math.min(100, prev / RISKY.goal * 100)}%"></i></div></div>`;
  };
  const fresh1 = note === 'roll', bust = note === 'bust';
  const dice = rolls.map((n, k) => `<span class="sdie${(fresh1 || bust) && k === rolls.length - 1 ? (bust ? ' dup' : ' fresh') : ''}" aria-label="${n}">${dieFace(n)}</span>`).join('');
  const shown = mini.last ? mini.last.roll : null;                    // the last number rolled, until the next roll
  const enough = !!(t && t.by === turn && mini.bank[turn] + t.pot >= RISKY.goal);          // Bank wins it: no more rolling
  const rollBtn = enough ? '' : `<button class="big ${turn}" data-act="move" ${mv('roll')}${locked || rolls.length >= RISKY.maxRolls ? ' disabled' : ''}>${rolls.length && !over ? 'Roll again' : 'Roll'}</button>`;
  g = `<div class="g-risky"><div class="rrscores">${score('X')}${score('O')}</div>
        <div class="rrrolls${bust ? ' bust' : ''}" aria-label="Rolled this turn">${dice || '<small>No rolls this turn</small>'}</div>
        <div class="dieWrap"><div class="die${note === 'roll' || note === 'bust' ? ' roll' : ''}">${shown ? dieFace(shown) : '<span class="q">?</span>'}</div></div>
        <div class="rrbtns${enough ? ' one' : ''}">${rollBtn}
          <button class="big bank" data-act="move" ${mv('bank')}${locked || !pot || over ? ' disabled' : ''}>Bank${pot && !over ? ' ' + pot : ''}</button></div></div>`;
  return g;
}
export function moveText(f, who) {
  return f.note === 'bust' ? `Bust! ${f.pot} point${f.pot === 1 ? '' : 's'} lost` : `Banked ${f.pot}`;
}
export function sounds(f, add, won, mini, last) {
  if (f.note === 'bust') { add('rattle', 0); add('thunk', 600); add('bust', 650); }
  else if (f.note === 'bank') add('bank', 350);
  else { add('rattle', 0); add('thunk', 600); add('point', 650); }
  return;
}
