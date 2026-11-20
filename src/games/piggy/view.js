// Pig: the screen, the miniature, the move's words and sounds.
// The table is Risky Rolls' own (its tray, die, pot, score bars and buttons: the `.g-risky` block of the stylesheet),
// on a pink felt (`.pgd`): the die's numbers in a row with the bust number marked, the die thrown in for every roll, its
// points flying to the pot, a bank sending the pot up into the score, a bust breaking the pot with an oink.
import { DIE_MORE } from '../../core/config.js';
import { piggyCfg } from './rules.js';
import { N, isYou, mv } from '../../ui/app.js';
import { dieFace } from '../../ui/art.js';
import { DIE_BOUNCE, die3d } from '../../ui/dice.js';
import { lateAt } from '../../ui/progress.js';

export const ownLine = true;                                      // its result is said in its own reserved line (ui/mini.js)
// A move's timings (ms from the move; the stylesheet reads them off the screen's own style; inside rules.js flashMs).
export const PGT = { land: 560 + DIE_MORE, pot: 800 + DIE_MORE, count: 250, bank: 350, lose: 700 + DIE_MORE };
export const hold = f => (f.kind === 'again' ? 0 : null);         // a roll that keeps the turn: Roll again the moment its points are in the pot

export function miniature(mini, final) {
  const c = piggyCfg(mini), pct = n => Math.min(100, n / c.target * 100);
  const tray = `<div class="tmtray tpgtray" aria-hidden="true"><i class="tmd8 d6">${dieFace(mini.last && mini.last.roll <= 6 ? mini.last.roll : c.bust <= 6 ? c.bust : 1)}</i><i class="tmpot${mini.turn && mini.turn.pot ? ' on' : ''}"></i></div>`;
  const row = p => { const pend = mini.turn && mini.turn.by === p ? mini.turn.pot : 0, b = pct(mini.bank[p]); return `<div class="tr ${p}"><b class="${p}">${p}</b><div class="bar"><i style="width:${b}%"></i>${pend ? `<i class="mp" style="left:${b}%;width:${Math.min(100 - b, pct(pend))}%"></i>` : ''}</div><span>${mini.bank[p]}</span></div>`; };
  return `<div class="tdice" aria-label="Pig: X ${mini.bank.X}, O ${mini.bank.O} of ${c.target}">${tray}${row('X')}${row('O')}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const c = piggyCfg(mini), goal = c.target, s = a && a.pg ? a.pg : null;
  const note = s ? a.note || (mini.last && mini.last.kind === 'bank' ? 'bank' : null) : null;
  const t = mini.turn, over = note === 'bust' || note === 'bank';   // the turn is already over on the record: show the pot it had, then watch it go
  const pot = over ? s.pot : t ? t.pot : 0, by = over ? a.by : t ? t.by : null, rolled = over ? s.n : t ? t.n : 0;
  const was = note === 'roll' ? pot - s.roll : pot;
  const pct = n => Math.max(0, Math.min(100, n / goal * 100)).toFixed(2);
  const score = p => {
    const banked = mini.bank[p], gain = note === 'bank' && a.by === p, prev = gain ? banked - s.pot : banked;
    const ghost = by === p && pot ? `<u class="rrgh${note === 'roll' ? ' grow' : note === 'bust' ? ' lost' : ''}" style="left:${pct(prev)}%;width:${pct(Math.min(pot, goal - prev))}%;--w0:${pct(Math.min(was, goal - prev))}%"></u>` : '';
    return `<div class="pscore ${p}${!view && turn === p ? ' now' : ''}${gain ? ' gain' : ''}"><div class="nm"><b class="${p}">${N(p)}</b></div><div class="val"><span><b class="vnum">${gain ? `<b class="cnt" data-from="${prev}" data-delay="${PGT.bank}" data-ms="500">${banked}</b>` : banked}</b> <small>/ ${goal}</small></span></div><div class="bar">${ghost}<i style="width:${pct(banked)}%;--pw:${pct(prev)}%"></i></div></div>`;
  };
  // the die's numbers: the bust number marked; the one just rolled pops as its die lands (the bust number shakes)
  const nums = Array.from({ length: c.sides }, (_, k) => k + 1).map(n => `<i class="${n === c.bust ? 'pgbad' : ''}${note === 'roll' && n === s.roll ? ' pgnew' : ''}${note === 'bust' && n === s.roll ? ' dup' : ''}">${n}</i>`).join('');
  const shown = s ? s.roll : t ? t.roll : (view || d) && mini.last ? mini.last.roll : null;
  const rolling = (note === 'roll' || note === 'bust') && shown != null;
  const die = `<div class="rrdie${note === 'bust' ? ' bust' : ''}" role="img" aria-label="Die${shown ? ': ' + shown : ''}">${die3d(shown, { sides: c.sides, roll: rolling ? PGT.land : 0 })}</div>`;
  const potNum = note === 'roll' ? `<b class="cnt" data-from="${was}" data-delay="${PGT.pot}" data-ms="${PGT.count}">${pot}</b>` : pot;
  const potCls = note === 'roll' ? (was ? ' bump' : ' first') : note === 'bank' ? ` bank to${a.by}` : note === 'bust' ? ' lost' : '';
  const shards = note === 'bust' && pot ? `<i class="rrsh l" aria-hidden="true">+${pot}</i><i class="rrsh r" aria-hidden="true">+${pot}</i>` : '';
  const potHtml = `<div class="rrpotw" role="img" aria-label="This turn's points: ${over ? 0 : pot}"><i class="rrpot0"></i>${pot ? `<div class="rrpot${potCls}"><span>+${potNum}</span></div>${shards}` : ''}</div>`;
  const fly = note === 'roll' ? `<b class="rrfly" aria-hidden="true">+${s.roll}</b>` : '';
  const say = note === 'bust' ? [s.pot ? `Oink! ${s.pot} lost` : 'Oink! Nothing this turn', 'no', PGT.land] : note === 'bank' ? [`Banked ${s.pot}`, 'ok', PGT.bank] : null;
  const line = say ? `<p ${lateAt('rrline ' + say[1], say[2])} role="status">${say[0]}</p>` : '<p class="rrline"></p>';
  // A roll's number is not shown before its points are in the pot: until then Bank says what it said and counts on with the pot.
  const potBefore = note === 'roll' ? was : over ? 0 : pot, rolledBefore = note === 'roll' ? rolled - 1 : over ? 0 : rolled;
  const enough = !!(t && t.by === turn && mini.bank[turn] + potBefore >= goal) || (note === 'bank' && mini.bank[a.by] >= goal);
  const capped = !!(c.max && t && rolledBefore >= c.max);
  const bankPot = note === 'roll' ? (potBefore ? `<b class="cnt" data-from="${potBefore}" data-delay="${PGT.pot}" data-ms="${PGT.count}">${pot}</b>` : `<b class="bpot">${pot}</b>`) : pot && !over ? String(pot) : '';
  const riskSub = potBefore && !over ? (capped ? 'no rolls left' : `a ${c.bust} loses ${potBefore}`) : c.max && !over ? `${Math.max(0, c.max - rolledBefore)} rolls` : '';
  const bankSub = potBefore && !over ? `makes ${Math.min(goal, mini.bank[turn] + potBefore)} of ${goal}` : '';
  const rollBtn = enough ? '' : `<button class="big ${turn} rrb" data-act="move" ${mv('roll')}${locked || capped ? ' disabled' : ''}>${rolledBefore ? 'Roll again' : 'Roll'}<small>${riskSub}</small></button>`;
  return `<div class="g-risky pgd" style="--land:${PGT.land}ms;--pot:${PGT.pot}ms;--bank:${PGT.bank}ms;--lose:${PGT.lose}ms"><div class="rrscores">${score('X')}${score('O')}</div>
        <div class="rrnums" style="--n:${c.sides}" role="img" aria-label="A ${c.bust} loses the turn's points">${nums}</div>
        <div class="rrtray"><div class="rrfelt">${die}</div>${fly}${potHtml}</div>
        ${line}
        <div class="rrbtns${enough ? ' one' : ''}">${rollBtn}
          <button class="big bank rrb" data-act="move" ${mv('bank')}${locked || !pot || over ? ' disabled' : ''}>Bank${bankPot ? ' ' + bankPot : ''}<small>${bankSub}</small></button></div></div>`;
}
// The line under the game's name while a turn is held to the square.
export function heldSub(mini, turn, f, a) { return isYou(turn) ? `<b class="${turn}">Your</b> turn` : `<b class="${turn}">${N(turn)}</b>'s turn`; }
export function moveText(f, who) {
  const s = f.pg || {};
  return f.note === 'bust' ? `${who} rolled a ${s.roll} and lost ${s.pot || 0}` : f.note === 'bank' ? `${who} banked ${s.pot}` : `${who} rolled a ${s.roll}`;
}
// A roll: the rattle, the die's first touch of the tray, its landing, then its points in the pot (a bust: the oink as
// the pot breaks); a bank: the pot reaching the score.
export function sounds(f, add, won, mini, last) {
  if (f.note === 'bank') { add('bank', PGT.bank); return; }
  add('rattle', 0); add('diceTap', Math.round(PGT.land * DIE_BOUNCE)); add('thunk', PGT.land);
  if (f.note === 'bust') { add('pgOink', PGT.land + 60); add('bust', PGT.lose); } else add('point', PGT.pot);
}
