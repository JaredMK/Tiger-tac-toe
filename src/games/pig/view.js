// Risky Rolls: the screen, the miniature, the move's words and sounds, and the inputs.
import { pigGoal, pigMaxRolls, pigSides, setPigConfig } from './rules.js';
import { FIREBASE_CONFIG, configured } from '../../net/connect.js';
import { N, mv } from '../../ui/app.js';
import { dieFace } from '../../ui/art.js';
import { KEY } from '../../ui/config.js';

// The die and the target (config/pig, the admin's dashboard): read at every start, kept for the next visit.
const PIG_KEY = KEY + '.pigcfg';
export function fetchPigConfig() {
  try { const v = JSON.parse(localStorage.getItem(PIG_KEY) || 'null'); if (v && typeof v === 'object') setPigConfig(v); } catch (e) { /* none kept */ }
  if (!configured()) return;
  const hook = window.TTT_FIREBASE, c = (hook && hook.config) || FIREBASE_CONFIG;
  const url = hook && hook.emulator ? `http://${hook.emulator.host}:${hook.emulator.port}/config/pig.json?ns=${c.projectId}-default-rtdb` : `${c.databaseURL}/config/pig.json`;
  try {
    fetch(url).then(r => (r.ok ? r.json() : null)).then(v => {
      if (!v || typeof v !== 'object') return;
      setPigConfig(v);
      try { localStorage.setItem(PIG_KEY, JSON.stringify(v)); } catch (e) { /* no storage: read again next visit */ }
    }).catch(() => {});
  } catch (e) { /* offline: as last known */ }
}
// A face of the die: pips on a d6; on a d8, an eight-sided die seen face on (a triangle face and the two
// facets beside it, in a six-sided outline) with the number on the face.
export function pigFace(n, sides) {
  if (sides !== 8) return dieFace(n);
  return `<svg class="d8" viewBox="0 0 100 100" aria-hidden="true"><path class="d8o" d="M50 4 91 28 91 72 50 96 9 72 9 28Z"/><path class="d8f" d="M50 4 91 72 9 72Z"/><path class="d8l" d="M9 72 50 96 91 72"/><text x="50" y="${n === 1 ? 61 : 62}" text-anchor="middle">${n}</text></svg>`;
}

// The die as it rolls: it tumbles, showing other faces one after another, and lands on the number rolled
// (styles.css: .die.rr). The faces on the way follow from the result, so a redraw shows the same ones.
const PIG_FLICK = [3, 1, 4, 2, 5];
function pigTumble(n, sides) {
  const on = PIG_FLICK.map(k => ((n - 1 + k) % sides) + 1);
  return on.map((v, k) => `<span class="rface fl f${k}" aria-hidden="true">${pigFace(v, sides)}</span>`).join('') + `<span class="rface fin">${pigFace(n, sides)}</span>`;
}

export function miniature(mini, final) {
  const goal = pigGoal(mini);
  return `<div class="tdice"><div class="tmd8">${pigFace(pigSides(mini), pigSides(mini))}</div>${['X', 'O'].map(p => `<div class="tr ${p}"><b class="${p}">${p}</b><div class="bar"><i style="width:${Math.min(100, mini.bank[p] / goal * 100)}%"></i></div><span>${mini.bank[p]}</span></div>`).join('')}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  // Risky Rolls. The two scores, with this turn's points at risk as a small +N by the roller's score; the
  // dice rolled this turn in a row; the die; Roll again and Bank (only Bank once it would reach the goal).
  // A roll tumbles the die, and the +N it adds to stays up through the tumble, taking the new points as
  // the die lands; a bank only moves the +N into the score (the die is left as it was); a bust knocks
  // the +N out. A winning bank is a bank too (an older record says so only through mini.last).
  const note = a ? a.note || ((a.kind === 'claim' || a.kind === 'match') && mini.last && mini.last.kind === 'bank' ? 'bank' : null) : null;
  const goal = pigGoal(mini), sides = pigSides(mini), face = n => pigFace(n, sides);
  const t = mini.turn, over = note === 'bust' || note === 'bank';   // a bust or a bank: the turn is already over, show the pot it had, then watch it go
  const rolls = over ? a.rolls : t ? t.rolls : [], pot = over ? a.pot : t ? t.pot : 0, by = over ? a.by : t ? t.by : null;
  const score = p => {
    const banked = mini.bank[p], gain = note === 'bank' && a.by === p;
    const prev = gain ? banked - a.pot : banked;
    const was = note === 'roll' ? pot - a.roll : pot;                 // the +N before this roll
    const risk = by === p && pot ? `<span class="risk${note === 'roll' ? (was ? ' grow' : ' grow first') : note === 'bank' ? ' bank' : note === 'bust' ? ' lost' : ''}">+${note === 'roll' && was ? `<b class="cnt" data-from="${was}" data-delay="600" data-ms="400">${pot}</b>` : pot}</span>` : '';
    return `<div class="pscore ${p}${!view && turn === p ? ' now' : ''}${gain ? ' gain' : ''}"><div class="nm"><b class="${p}">${N(p)}</b></div><div class="val"><span><b class="vnum">${gain ? `<b class="cnt" data-from="${prev}" data-delay="350" data-ms="500">${banked}</b>` : banked}</b> <small>/ ${goal}</small></span>${risk}</div><div class="bar"><i style="width:${Math.min(100, banked / goal * 100)}%;--pw:${Math.min(100, prev / goal * 100)}%"></i></div></div>`;
  };
  const fresh1 = note === 'roll', bust = note === 'bust';
  const dice = rolls.map((n, k) => `<span class="sdie${sides === 8 ? ' d8' : ''}${(fresh1 || bust) && k === rolls.length - 1 ? (bust ? ' dup' : ' fresh') : ''}" aria-label="${n}">${face(n)}</span>`).join('');
  const shown = a && a.roll ? a.roll : mini.last ? mini.last.roll : null;   // the last number rolled, until the next roll (while a roll plays: the move's own number, the mover's, whoever's the square's last was)
  const rolling = (note === 'roll' || note === 'bust') && shown != null;
  // The number a roll adds is not shown before the die has landed: through the tumble the Bank button still says what it said, and takes the new points as they land (the same moment as the +N); the Roll button too stays as it was.
  const potBefore = note === 'roll' ? pot - a.roll : t ? t.pot : 0;
  const enough = !!(t && t.by === turn && mini.bank[turn] + potBefore >= goal);      // Bank wins it: no more rolling
  const bankPot = note === 'roll' ? (potBefore ? `<b class="cnt" data-from="${potBefore}" data-delay="600" data-ms="400">${pot}</b>` : `<b class="bpot">${pot}</b>`) : pot && !over ? String(pot) : '';
  const rollBtn = enough ? '' : `<button class="big ${turn}" data-act="move" ${mv('roll')}${locked || rolls.length >= pigMaxRolls(mini) ? ' disabled' : ''}>${rolls.length && !over ? 'Roll again' : 'Roll'}</button>`;
  g = `<div class="g-risky"><div class="rrscores">${score('X')}${score('O')}</div>
        <div class="rrrolls${bust ? ' bust' : ''}" aria-label="Rolled this turn">${dice || '<small>No rolls this turn</small>'}</div>
        <div class="dieWrap"><div class="die${sides === 8 ? ' d8' : ''}${rolling ? ' roll rr' : ''}" aria-label="${sides === 8 ? 'Eight-sided die' : 'Die'}${shown ? ': ' + shown : ''}">${rolling ? pigTumble(shown, sides) : shown ? face(shown) : sides === 8 ? pigFace('?', 8) : '<span class="q">?</span>'}</div></div>
        <div class="rrbtns${enough ? ' one' : ''}">${rollBtn}
          <button class="big bank" data-act="move" ${mv('bank')}${locked || !pot || over ? ' disabled' : ''}>Bank${bankPot ? ' ' + bankPot : ''}</button></div></div>`;
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
