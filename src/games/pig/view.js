// Risky Rolls: the screen, the miniature, the move's words and sounds, and the inputs.
import { pigGoal, pigMaxRolls, pigSides, setPigConfig } from './rules.js';
import { FIREBASE_CONFIG, configured } from '../../net/connect.js';
import { N, mv } from '../../ui/app.js';
import { dieFace } from '../../ui/art.js';
import { KEY } from '../../ui/config.js';
import { DIE_BOUNCE, die3d } from '../../ui/dice.js';
import { lateAt } from '../../ui/progress.js';

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
// The die's face, flat (the miniature's): pips on a d6; on a d8, an eight-sided die seen face on (a triangle face and
// the two facets beside it, in a six-sided outline) with the number on the face (none for n null: too small a die for
// its number to be read). The square's own die is the shared 3-D one (ui/dice.js die3d).
export function pigFace(n, sides) {
  if (sides !== 8) return dieFace(n);
  return `<svg class="d8" viewBox="0 0 100 100" aria-hidden="true"><path class="d8o" d="M50 4 91 28 91 72 50 96 9 72 9 28Z"/><path class="d8f" d="M50 4 91 72 9 72Z"/><path class="d8l" d="M9 72 50 96 91 72"/>${n == null ? '' : `<text x="50" y="${n === 1 ? 61 : 62}" text-anchor="middle">${n}</text>`}</svg>`;
}
// A move's timings (ms from the move; the stylesheet reads them off the screen's own style, sounds() below uses the
// same ones; all inside rules.js flashMs): a roll's die lands at `land`, its points fly to the pot and are in it at
// `pot`, counted on over `count`; a bank's pot reaches the score at `bank`; a bust's pot breaks at `lose`.
export const PIG_T = { land: 560, pot: 800, count: 250, bank: 350, lose: 700 };

// The miniature: the tray with the die and the pot (a token while a turn has points in it), and each player's banked
// points as a bar to the target with its number.
export function miniature(mini, final) {
  const goal = pigGoal(mini), sides = pigSides(mini);
  const tray = `<div class="tmtray" aria-hidden="true"><i class="tmd8${sides === 8 ? '' : ' d6'}">${pigFace(sides === 8 ? null : sides, sides)}</i><i class="tmpot${mini.turn && mini.turn.pot ? ' on' : ''}"></i></div>`;
  return `<div class="tdice">${tray}${['X', 'O'].map(p => `<div class="tr ${p}"><b class="${p}">${p}</b><div class="bar"><i style="width:${Math.min(100, mini.bank[p] / goal * 100)}%"></i></div><span>${mini.bank[p]}</span></div>`).join('')}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  // Risky Rolls. The two scores, each a bar to the target, the roller's with this turn's points at risk as a striped
  // stretch beyond what is banked; the die's numbers in a row, the ones rolled this turn filled in (a second time
  // loses the turn's points); the tray with the die and the pot, the turn's points; a line for the move's words;
  // Roll (what it puts at risk) and Bank (what it makes). A roll throws the die in: it lands on the number
  // rolled, the number is filled in, its points fly to the pot and the pot counts on; a bank sends the pot up into the
  // score, which counts on as its bar fills; a bust shakes the number rolled twice and the pot breaks and drops away.
  // (Reduced motion: the stylesheet plays none of it and hides what only an animation takes away.)
  // A winning bank is a bank too (an older record says so only through mini.last).
  const note = a ? a.note || ((a.kind === 'claim' || a.kind === 'match') && mini.last && mini.last.kind === 'bank' ? 'bank' : null) : null;
  const goal = pigGoal(mini), sides = pigSides(mini);
  const t = mini.turn, over = note === 'bust' || note === 'bank';   // a bust or a bank: the turn is already over, show the pot it had, then watch it go
  const rolls = over ? a.rolls : t ? t.rolls : [], pot = over ? a.pot : t ? t.pot : 0, by = over ? a.by : t ? t.by : null;
  const was = note === 'roll' ? pot - a.roll : pot;                 // the pot before this roll
  const pct = n => Math.max(0, Math.min(100, n / goal * 100)).toFixed(2);
  const score = p => {
    const banked = mini.bank[p], gain = note === 'bank' && a.by === p, prev = gain ? banked - a.pot : banked;
    const ghost = by === p && pot ? `<u class="rrgh${note === 'roll' ? ' grow' : note === 'bust' ? ' lost' : ''}" style="left:${pct(prev)}%;width:${pct(Math.min(pot, goal - prev))}%;--w0:${pct(Math.min(was, goal - prev))}%"></u>` : '';
    return `<div class="pscore ${p}${!view && turn === p ? ' now' : ''}${gain ? ' gain' : ''}"><div class="nm"><b class="${p}">${N(p)}</b></div><div class="val"><span><b class="vnum">${gain ? `<b class="cnt" data-from="${prev}" data-delay="${PIG_T.bank}" data-ms="500">${banked}</b>` : banked}</b> <small>/ ${goal}</small></span></div><div class="bar">${ghost}<i style="width:${pct(banked)}%;--pw:${pct(prev)}%"></i></div></div>`;
  };
  // the die's numbers: the ones rolled this turn taken (the one just rolled as its die lands; the one rolled twice in red)
  const nums = Array.from({ length: sides }, (_, k) => k + 1).map(n => `<i class="${rolls.includes(n) ? 'on' : ''}${note === 'roll' && n === a.roll ? ' new' : ''}${note === 'bust' && n === a.roll ? ' dup' : ''}">${n}</i>`).join('');
  // the die: the number of the move on show (while a roll plays: the move's own number, the mover's, whoever's the square's last was), else the turn's latest; none rolled yet: a "?"
  const shown = a && a.roll ? a.roll : !a && d && d.type === 'pig' && d.roll ? d.roll : t && t.rolls.length ? t.rolls[t.rolls.length - 1] : view && mini.last ? mini.last.roll : null;
  const rolling = (note === 'roll' || note === 'bust') && shown != null;
  const die = `<div class="rrdie${note === 'bust' ? ' bust' : ''}" role="img" aria-label="${sides === 8 ? 'Eight-sided die' : 'Die'}${shown ? ': ' + shown : ''}">${die3d(shown, { sides, roll: rolling ? PIG_T.land : 0 })}</div>`;
  // the pot: nothing in it, an empty ring; the turn's points on a token, counted on as a roll's points reach it
  const potNum = note === 'roll' ? `<b class="cnt" data-from="${was}" data-delay="${PIG_T.pot}" data-ms="${PIG_T.count}">${pot}</b>` : pot;
  const potCls = note === 'roll' ? (was ? ' bump' : ' first') : note === 'bank' ? ` bank to${a.by}` : note === 'bust' ? ' lost' : '';
  const shards = note === 'bust' ? `<i class="rrsh l" aria-hidden="true">+${pot}</i><i class="rrsh r" aria-hidden="true">+${pot}</i>` : '';
  const potHtml = `<div class="rrpotw" role="img" aria-label="This turn's points: ${note === 'bank' || note === 'bust' ? 0 : pot}"><i class="rrpot0"></i>${pot ? `<div class="rrpot${potCls}"><span>+${potNum}</span></div>${shards}` : ''}</div>`;
  const fly = note === 'roll' ? `<b class="rrfly" aria-hidden="true">+${a.roll}</b>` : '';
  const say = note === 'bust' ? [`Bust! ${a.pot} lost`, 'no', PIG_T.land] : note === 'bank' ? [`Banked ${a.pot}`, 'ok', PIG_T.bank] : null;
  const line = say ? `<p ${lateAt('rrline ' + say[1], say[2])} role="status">${say[0]}</p>` : '<p class="rrline"></p>';
  // The number a roll adds is not shown before its points are in the pot: until then the Bank button still says what it said and counts on with the pot; the buttons' small lines (what a roll puts at risk, what a bank makes) stay as they were until the move is over.
  const potBefore = note === 'roll' ? was : t ? t.pot : 0, rolledBefore = note === 'roll' ? rolls.length - 1 : over ? 0 : rolls.length;
  const enough = !!(t && t.by === turn && mini.bank[turn] + potBefore >= goal) || (note === 'bank' && mini.bank[a.by] >= goal);      // Bank wins it: no more rolling (and none while that bank plays)
  const bankPot = note === 'roll' ? (potBefore ? `<b class="cnt" data-from="${potBefore}" data-delay="${PIG_T.pot}" data-ms="${PIG_T.count}">${pot}</b>` : `<b class="bpot">${pot}</b>`) : pot && !over ? String(pot) : '';
  const riskSub = potBefore && !over ? `${rolledBefore} in ${sides} loses ${potBefore}` : '', bankSub = potBefore && !over ? `makes ${Math.min(goal, mini.bank[turn] + potBefore)} of ${goal}` : '';
  const rollBtn = enough ? '' : `<button class="big ${turn} rrb" data-act="move" ${mv('roll')}${locked || rolls.length >= pigMaxRolls(mini) ? ' disabled' : ''}>${rolledBefore ? 'Roll again' : 'Roll'}<small>${riskSub}</small></button>`;
  g = `<div class="g-risky" style="--land:${PIG_T.land}ms;--pot:${PIG_T.pot}ms;--bank:${PIG_T.bank}ms;--lose:${PIG_T.lose}ms"><div class="rrscores">${score('X')}${score('O')}</div>
        <div class="rrnums${note === 'bank' ? ' clear' : ''}" style="--n:${sides}" role="img" aria-label="Rolled this turn: ${rolls.length ? rolls.join(', ') : 'nothing'}">${nums}</div>
        <div class="rrtray"><div class="rrfelt">${die}</div>${fly}${potHtml}</div>
        ${line}
        <div class="rrbtns${enough ? ' one' : ''}">${rollBtn}
          <button class="big bank rrb" data-act="move" ${mv('bank')}${locked || !pot || over ? ' disabled' : ''}>Bank${bankPot ? ' ' + bankPot : ''}<small>${bankSub}</small></button></div></div>`;
  return g;
}
export function moveText(f, who) {
  return f.note === 'bust' ? `Bust! ${f.pot} point${f.pot === 1 ? '' : 's'} lost` : `Banked ${f.pot}`;
}
export function sounds(f, add, won, mini, last) {   // a roll: the rattle, the die's first touch of the tray, its landing, then its points in the pot (or the pot breaking); a bank: the pot reaching the score
  if (f.note === 'bank') { add('bank', PIG_T.bank); return; }
  add('rattle', 0); add('diceTap', Math.round(PIG_T.land * DIE_BOUNCE)); add('thunk', PIG_T.land);
  add(f.note === 'bust' ? 'bust' : 'point', f.note === 'bust' ? PIG_T.lose : PIG_T.pot);
}
