// Point Roll: the screen, the miniature, the move's words and sounds.
// The felt: the move's rolls thrown one after another (the shared 3-D die, each pair in the last one's place, its
// total popping beside it: green when it is the pick, dark for a 7), the totals so far in a row under them (a "+N"
// chip first when the move had earlier rolls that are not shown). Under it the reserved result line, then the ten
// numbers, each a button with its points. All timed from the move (rules.js prollTimes).
import { PICKS, PROLL, prollCfg, prollTimes } from './rules.js';
import { mv } from '../../ui/app.js';
import { DIE_BOUNCE, die3d } from '../../ui/dice.js';
import { lateAt } from '../../ui/progress.js';
import { thumbArt } from '../../ui/thumbs.js';
import { barRows, ptsTally } from '../../ui/tok.js';

export const ownLine = true;
const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
const dieSvg = (n, x, y, s, rot) => `<g transform="translate(${x} ${y}) rotate(${rot})"><rect class="tprd" x="${-s / 2}" y="${-s / 2}" width="${s}" height="${s}" rx="${s * 0.2}"/>${PIPS[n].map(([a, b]) => `<circle class="tprp" cx="${a * s * 0.27}" cy="${b * s * 0.27}" r="${s * 0.1}"/>`).join('')}</g>`;
const words = s => (s.hit ? `${s.pick}! +${s.pts}` : 'Seven! Nothing');
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const c = prollCfg(mini), s = a && a.pr ? a.pr : null, o = { view, locked, turn }, rest = !s && (view || d) && mini.last ? mini.last : null, l = s || rest;
  const by = s ? a.by : rest ? rest.by : turn, n = l ? l.rolls.length : 0, tim = s ? prollTimes(n) : null;
  const tal = p => ptsTally(p, o, c.target, mini.score[p], s && a.by === p ? s.from : null, s ? tim.judge : 0);
  const kind = k => (k === n - 1 ? (l.hit ? 'w' : 'o') : 'x');
  let dice;
  if (l) {
    dice = l.rolls.map((r, k) => {
      if (!s && k < n - 1) return '';
      const t0 = s ? tim.at[k] : null, t1 = s && k < n - 1 ? tim.at[k + 1] : null, last = k === n - 1;
      return `<div class="kpair${t1 != null ? ' gone' : ''}${last ? (l.hit ? ' cheer' : ' sad') : ''}" style="${t1 != null ? `--t2:${t1}ms;` : ''}${s && last ? `--d:${tim.land[k]}ms` : ''}" aria-hidden="${!last}"><div class="kdice"><span class="kd">${die3d(r[0], { roll: s ? PROLL.land : 0, t: t0, v: 0 })}</span><span class="kd b">${die3d(r[1], { roll: s ? PROLL.land : 0, t: t0, v: 1 })}</span></div><b ${lateAt('ktot ' + kind(k), s ? tim.land[k] : null)}>${r[0] + r[1]}</b></div>`;
    }).join('');
  } else dice = `<div class="kpair idle" aria-hidden="true"><div class="kdice"><span class="kd">${die3d(null, { v: 0 })}</span><span class="kd b">${die3d(null, { v: 1 })}</span></div></div>`;
  const more = l ? l.nr - n : 0;
  const log = `<div class="prlog" aria-label="The rolls">${l ? `<b class="prpick ${l.by}">${l.pick}</b>` : ''}${more > 0 ? `<i class="prmore">+${more}</i>` : ''}${l ? l.rolls.map((r, k) => `<span ${lateAt(kind(k), s ? tim.land[k] : null)}>${r[0] + r[1]}</span>`).join('') : ''}</div>`;
  const line = s ? `<p ${lateAt('prline ' + (s.hit ? 'ok' : 'no'), tim.judge)} role="status">${words(s)}</p>` : `<p class="prline${l ? (l.hit ? ' ok' : ' no') : ''}">${l ? words(l) : ''}</p>`;
  const btn = k => `<button class="btn prnum${l && l.pick === k && l.by === by ? ' on' : ''}" data-act="move" ${mv(k)}${locked ? ' disabled' : ''} aria-label="${k}: ${c.pts[k]} points"><b>${k}</b><i>+${c.pts[k]}</i></button>`;
  const pad = view ? '' : `<div class="prpad">${[2, 3, 4, 5, 6, 12, 11, 10, 9, 8].map(btn).join('')}</div>`;
  return `<div class="g-pr pc-${by}"><div class="ctals two">${tal('X')}${tal('O')}</div><div class="kfelt prfelt${l ? (l.hit ? ' win' : ' lose') + (s ? ' late' : '') : ''}"${s ? ` style="--d:${tim.judge}ms"` : ''}>${dice}</div>${log}${line}${pad}</div>`;
}
// The miniature: two dice on the felt (the last roll's faces), over each player's points as a bar.
export function miniature(mini, final) {
  const c = prollCfg(mini), r = mini.last ? mini.last.rolls[mini.last.rolls.length - 1] : [5, 4];
  const art = `<svg class="tpr" viewBox="0 0 60 40"><rect class="tprf" x="1.500" y="1.500" width="57" height="37" rx="8"/>${dieSvg(r[0], 20, 21, 19, -9)}${dieSvg(r[1], 41, 19, 19, 11)}</svg>`;
  return thumbArt(art, barRows(mini.score, c.target), 'tprw col', `Point Roll: X ${mini.score.X}, O ${mini.score.O} of ${c.target} points`);
}
export function moveText(f, who) { const s = f.pr; return !s ? `${who} rolled` : s.hit ? `${who} rolled a ${s.pick} for ${s.pts}` : `${who} picked ${s.pick} and rolled a 7`; }
// Each roll: the rattle, the dice's first touch of the felt and their landing; then the verdict as the last pair lands.
export function sounds(f, add, won, mini, last) {
  const s = f.pr; if (!s) return;
  const tim = prollTimes(s.rolls.length);
  s.rolls.forEach((r, k) => { add('rattle', tim.at[k]); add('diceTap', tim.at[k] + Math.round(PROLL.land * DIE_BOUNCE)); add('thunk', tim.land[k]); });
  add(s.hit ? 'diceWin' : 'diceLose', tim.judge);
}
