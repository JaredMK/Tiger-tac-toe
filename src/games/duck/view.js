// Hook-a-Duck: the screen, the miniature, the move's words and sounds, and the inputs.
import { DUKT, duckCfg, duckTimes } from './rules.js';
import { N, REDUCED, mv } from '../../ui/app.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { markSvgG } from '../../ui/thumbs.js';

// The pond: the ducks of the player on the move (or of the move being shown) drift and bob about it on endless loops
// (real time: ui/fx.js anchorFx keeps a loop running through re-renders); a tap on a duck is the move. The hook comes
// down on its line to that duck (`reach`), lifts it out (`lift`), turns it over to show its bottom (`show`: a number
// 1 to 5, or a boot), and the total counts on. A pond fished empty fills again: the new ducks float in. Everything of
// a move comes from its flash, never from the square's last. The values of the ducks still swimming are never in the
// page (the server keeps them): only the hooked duck's, from its move.
// Each slot's home in the pond (x, y in %: three staggered rows of four) and its drift (a loop of its own length).
const HOME = Array.from({ length: 12 }, (_, i) => { const r = Math.floor(i / 4), c = i % 4; return [13 + c * 22 + (r % 2) * 11, 26 + r * 26]; });
const drift = i => `--dd:${(5.2 + ((i * 7) % 5) * 0.55).toFixed(2)}s;--dl:-${((i * 1.37) % 5).toFixed(2)}s;--bd:${(1.6 + ((i * 3) % 4) * 0.2).toFixed(2)}s`;
// An original rubber duck (40x40): a round body, a head with a beak and an eye, a wing, and a ring on its head for the hook.
const DUCK_SVG = '<svg class="dukart" viewBox="0 0 40 40" aria-hidden="true"><circle class="dukring" cx="25" cy="6.6" r="3"/><path class="dukbody" d="M4 24c0-3 2.4-4.6 6-4.6h9.6c.2-4.6 3-7.8 7-7.8 4.2 0 7 3 7 7 0 1.8-.6 3.2-1.6 4.4 2.2 1 3.2 2.6 3.2 4.6 0 4.6-5.4 8-13.6 8H12.4C7.4 35.6 4 30.6 4 24z"/><path class="dukbeak" d="M33 17.4c2.4-.4 4.4.2 5.2 1.6-1 1.4-3 2-5.4 1.6z"/><circle class="dukeye" cx="29" cy="16.4" r="1.5"/><path class="dukwing" d="M11.4 25.4c2.6 3.4 7.4 4 11 1.4"/></svg>';
// A duck's bottom: its value in a disc, or a little boot (worth nothing).
const BOOT_SVG = '<svg class="dukboot" viewBox="0 0 40 40" aria-hidden="true"><path d="M13 6h10v15.6c0 1.6 1 2.6 2.6 3.2l6.4 2.6c2 .8 3 2.2 3 4.2V34H9.6c-1 0-1.6-.6-1.6-1.6V27c0-2.4 1-4.4 3-5.6l2-1.2z"/><path class="dukbootl" d="M13 12h10M8 30h27"/></svg>';
const bottom = v => (v > 0 ? `<span class="dukv">${v}</span>` : BOOT_SVG);
function pondView(mini, a, o) {
  const f = a && a.duck ? a.duck : null, anim = !!f && !REDUCED, T = f ? duckTimes(f) : null, c = duckCfg(mini), goal = c.target;
  const by = f ? a.by : mini.last && (o.done || o.view) ? mini.last.by : o.turn;
  const tal = p => {
    const n = Math.min(goal, mini.score[p]), fresh = f && a.by === p && f.from !== f.to;
    return arcTally(p, o, `<span class="dukt" aria-label="${n} of ${goal} points">${fresh ? `<b class="cnt" data-from="${f.from}" data-delay="${anim ? T.score : 0}">${n}</b>` : `<b>${n}</b>`}<small>/${goal}</small></span>`);
  };
  const can = !o.view && !o.locked && !f && by === o.turn;
  const duck = (i, cls, inner, st) => { const [x, y] = HOME[i] || [50, 50]; return `<span class="dukd${cls ? ' ' + cls : ''}" style="left:${x}%;top:${y}%;--y:${y};${drift(i)}${st ? ';' + st : ''}">${inner}</span>`; };
  const swim = i => `<span class="dukf"><span class="dukfront">${DUCK_SVG}</span></span>`;
  const left = (mini.left[by] || []).map((on, i) => (on ? i : -1)).filter(i => i >= 0);
  let ducks = '';
  if (f && anim) {
    // the hooked duck on its line: down to it, out of the water, over to show its bottom
    const hooked = duck(f.i, 'hk', `<span class="dukline" style="--t:0ms"></span><span class="dukf" style="--tl:${T.lift}ms;--ts:${T.show - DUKT.flip}ms"><span class="dukfront">${DUCK_SVG}</span><span class="dukback">${bottom(f.v)}</span></span><span class="dukrip" style="--t:${T.lift}ms"></span>`);
    const others = f.refill ? left.map(i => duck(i, 'dnew', swim(i), `--t:${T.end - DUKT.refill}ms`)).join('')   // a fresh pond: its ducks float in after the reveal
      : left.map(i => duck(i, '', swim(i))).join('');
    ducks = others + hooked;
  } else {
    ducks = left.map(i => (can ? `<button class="dukd" style="left:${HOME[i][0]}%;top:${HOME[i][1]}%;--y:${HOME[i][1]};${drift(i)}" data-act="move" ${mv(i)} aria-label="Duck ${i + 1}">${swim(i)}</button>` : duck(i, '', swim(i)))).join('');
  }
  // the catch so far from this pond's owner (the latest few), the newest landing as it shows
  const got = (mini.got[by] || []).slice(-8), newest = f && anim ? got.length - 1 : -1;
  const chips = got.map((v, k) => `<i ${k === newest ? lateAt('dukc' + (v ? '' : ' b'), T.show) : `class="dukc${v ? '' : ' b'}"`}>${v ? v : BOOT_SVG}</i>`).join('');
  const say = s => (s.v > 0 ? `<b class="${by}">${N(by)}</b> hooked a ${s.v}!` : 'A boot! Nothing') + (s.refill ? ' · the pond fills again' : '');
  const last = !f && mini.last && mini.last.by === by && (o.done || o.view) ? mini.last : null;
  const res = f ? `<p ${lateAt('dukres' + (f.v > 0 ? ' ok' : ''), anim ? T.show : null)} role="status">${say(f)}</p>` : `<p class="dukres">${last ? say(last) : '&nbsp;'}</p>`;
  return `<div class="g-duk"><div class="ctals">${tal('X')}${tal('O')}</div>
    <p class="duklab">Fishing: <b class="${by}">${N(by)}</b></p>
    <div class="dukpond" aria-label="${left.length} ducks in the pond of ${N(by)}">${ducks}</div>
    <div class="dukcatch" aria-label="Hooked so far">${chips}</div>${res}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = pondView(mini, a, { view, locked, turn, done: !!d }); return g;
}
// The line under the game's name while a duck with points keeps the turn ("Go again on success" on: ui/mini.js heldSub).
export function heldSub(mini, turn, f, a) {
  if (f) return '';
  return `<b class="${turn}">${N(turn)}</b> hooked points · goes again`;
}
// The miniature: each player's pond as a little oval with the ducks still in it, their mark beside it and a bar of their
// points toward the target beside that (a picture: no figures).
export function miniature(mini, final) {
  const goal = duckCfg(mini).target;
  const row = (p, y) => {
    const left = (mini.left[p] || []).map((on, i) => (on ? i : -1)).filter(i => i >= 0), f = Math.max(0, Math.min(1, mini.score[p] / goal));
    const ducks = left.map(i => { const [hx, hy] = HOME[i]; const x = 12 + hx * 0.53, yy = y + 13 + (hy - 52) * 0.3; return `<g transform="translate(${x.toFixed(1)} ${yy.toFixed(1)})"><ellipse class="tdukb" rx="2.5" ry="1.8"/><circle class="tdukb" cx="1.7" cy="-1.8" r="1.2"/></g>`; }).join('');
    return `<g class="tdukm ${p}" transform="translate(5.5 ${y + 13})">${markSvgG(p, 4)}</g><ellipse class="tdukp" cx="38" cy="${y + 13}" rx="26" ry="11"/>${ducks}`
      + `<rect class="tdukt" x="69" y="${y + 9}" width="27" height="8" rx="4"/><rect class="tdukf ${p}" x="69" y="${y + 9}" width="${(27 * f).toFixed(1)}" height="8" rx="4"/>`;
  };
  return `<div class="tduk" aria-label="Hook-a-Duck: X ${mini.score.X}, O ${mini.score.O} of ${goal} points"><svg viewBox="0 0 100 56" aria-hidden="true">${row('X', 0)}${row('O', 29)}</svg></div>`;
}
export function moveText(f, who) {
  const s = f.duck;
  if (!s) return `${who} hooked a duck`;
  return s.v > 0 ? `${who} hooked a ${s.v}` : `${who} hooked a boot`;
}
// The line goes in with a plop, the duck comes out with a splash, then its bottom: a ding for points, a boing for a
// boot; a refilled pond's ducks plop in.
export function sounds(f, add, won, mini, last) {
  const s = f.duck;
  if (!s) return;
  const T = duckTimes(s);
  add('plop', T.lift - 120);
  add('splash', T.lift + 60);
  add(s.v > 0 ? 'ding' : 'boing', T.show);
  if (s.refill) add('plop', T.end - DUKT.refill + 80);
}
