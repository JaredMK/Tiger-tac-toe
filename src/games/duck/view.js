// Hook-a-Duck: the screen, the miniature, the move's words and sounds, and the inputs.
import { DUKT, duckCfg, duckShared, duckTimes, pondOf } from './rules.js';
import { N, REDUCED, mv } from '../../ui/app.js';
import { cfAnchor, cfFrom } from '../../ui/cardfly.js';
import { fx, fxAt, fxAttr } from '../../ui/fx.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { markSvgG } from '../../ui/thumbs.js';

// The pond: one pond both players fish in (v 2; on a square from before, the pond of the player on the move or of the
// move being shown): a tub of water with its rim, the ducks drifting and bobbing about it on endless loops, each over
// its shadow on the water (real time: the swimmers' layer, .dukswim, carries the screen's own event, so a move starting
// or ending never jolts them); a tap on a duck is the move. Everything of a move hangs in the layer over the water
// (.dukair) and is timed by the move (.dukmv): the rod's tip comes in over the duck in the mover's colour and the hook
// runs down its line to the duck's ring (`reach`), lifts it out, swinging, the water rippling and dripping (`lift`),
// and turns it over to show its bottom (`show`: a number 1 to 5, or a boot), which pops; the catch flies from it down
// to the row of catches and the total counts on. A pond fished empty fills again: the new ducks float in. Everything
// of a move comes from its flash, never from the square's last. The values of the ducks still swimming are never in
// the page (the server keeps them): only the hooked duck's, from its move. The rings on the ducks' heads take the
// colour of whoever is fishing (.g-duk.pc-X / .pc-O).
// Each slot's home in the pond (x, y in %: three staggered rows of four) and its drift (a loop of its own length).
const HOME = Array.from({ length: 12 }, (_, i) => { const r = Math.floor(i / 4), c = i % 4; return [13 + c * 22 + (r % 2) * 11, 26 + r * 26]; });
const drift = i => `--dd:${(5.2 + ((i * 7) % 5) * 0.55).toFixed(2)}s;--dl:-${((i * 1.37) % 5).toFixed(2)}s;--bd:${(1.6 + ((i * 3) % 4) * 0.2).toFixed(2)}s`;
// An original rubber duck (40x40): a round body, a head with a beak and an eye, a wing, a gleam on its head and back, and
// a ring on its head for the hook.
const DUCK_SVG = '<svg class="dukart" viewBox="0 0 40 40" aria-hidden="true"><circle class="dukring" cx="25" cy="6.6" r="3"/><path class="dukbody" d="M4 24c0-3 2.4-4.6 6-4.6h9.6c.2-4.6 3-7.8 7-7.8 4.2 0 7 3 7 7 0 1.8-.6 3.2-1.6 4.4 2.2 1 3.2 2.6 3.2 4.6 0 4.6-5.4 8-13.6 8H12.4C7.4 35.6 4 30.6 4 24z"/><path class="dukshade" d="M6.4 29.4c1.6 3 4.4 4.4 8 4.4h7.4c6 0 10.4-2 12.2-5.2-1 4.4-6 7-13.2 7H12.4c-2.8 0-5-2.4-6-6.2z"/><path class="dukbeak" d="M33 17.4c2.4-.4 4.4.2 5.2 1.6-1 1.4-3 2-5.4 1.6z"/><circle class="dukeye" cx="29" cy="16.4" r="1.5"/><path class="dukwing" d="M11.4 25.4c2.6 3.4 7.4 4 11 1.4"/><path class="dukgleam" d="M23.6 15.6c.4-1.4 1.4-2.2 2.6-2.4M8 23.4c.8-.9 1.8-1.2 3-1.2"/></svg>';
// A duck's bottom: its value in a disc, or a little boot (worth nothing).
const BOOT_SVG = '<svg class="dukboot" viewBox="0 0 40 40" aria-hidden="true"><path d="M13 6h10v15.6c0 1.6 1 2.6 2.6 3.2l6.4 2.6c2 .8 3 2.2 3 4.2V34H9.6c-1 0-1.6-.6-1.6-1.6V27c0-2.4 1-4.4 3-5.6l2-1.2z"/><path class="dukbootl" d="M13 12h10M8 30h27"/></svg>';
const bottom = v => (v > 0 ? `<span class="dukv v${v}">${v}</span>` : BOOT_SVG);
function pondView(mini, a, o) {
  const f = a && a.duck ? a.duck : null, anim = !!f && !REDUCED, T = f ? duckTimes(f) : null, c = duckCfg(mini), goal = c.target;
  const by = f ? a.by : mini.last && (o.done || o.view) ? mini.last.by : o.turn;
  const tal = p => {
    const n = Math.min(goal, mini.score[p]), fresh = f && a.by === p && f.from !== f.to;
    return arcTally(p, o, `<span class="dukt" aria-label="${n} of ${goal} points">${fresh ? `<b class="cnt" data-from="${f.from}" data-delay="${anim ? T.score : 0}">${n}</b>` : `<b>${n}</b>`}<small>/${goal}</small></span>`);
  };
  const can = !o.view && !o.locked && !f && by === o.turn;
  const at = ([x, y]) => `left:${x}%;top:${y}%;--y:${y}`;
  const duck = (i, cls, inner, st) => `<span class="dukd${cls ? ' ' + cls : ''}" style="${at(HOME[i] || [50, 50])};${drift(i)}${st ? ';' + st : ''}">${inner}</span>`;
  const swim = i => `<span class="dukf"><span class="dukfront">${DUCK_SVG}</span></span>`;
  const shared = duckShared(mini), left = pondOf(mini, by).left.map((on, i) => (on ? i : -1)).filter(i => i >= 0);
  const mfx = anim ? fxAttr(fxAt('move', a), 'm') : '';             // (what belongs to the move, inside the swimmers' own clock)
  let ducks = '', air = '';
  if (f && anim) {
    // the hooked duck on its line: the hook down to it, out of the water (swinging, dripping), over to show its bottom
    const [hx, hy] = HOME[f.i] || [50, 50];                          // (lifted a little towards the pond's middle, less far from the top row: its bottom shows inside the pond)
    air = duck(f.i, 'hk', `<span class="dukmv"${mfx} style="--tl:${T.lift}ms;--ts:${T.show - DUKT.flip}ms;--tp:${T.show}ms;--lx:${((50 - hx) * 0.3).toFixed(1)}cqw;--ly:${hy < 30 ? 0.42 : 0.7}"><span class="dukshd"></span><span class="dukrip"></span><span class="dukrip r2"></span><span class="dukline"></span><span class="dukf"><span class="dukfront">${DUCK_SVG}</span><span class="dukback">${bottom(f.v)}</span></span><i class="dukdrop"></i><i class="dukdrop d2"></i><i class="dukdrop d3"></i><span class="dukup"${cfAnchor('dukhk')}></span></span>`);
    ducks = f.refill ? left.map((i, k) => duck(i, 'dnew', `<span class="dukf" data-new=""${mfx} style="--t:${T.end - DUKT.refill + k * 14}ms"><span class="dukshn"></span><span class="dukfront">${DUCK_SVG}</span></span>`)).join('')   // a fresh pond: its ducks float in after the reveal
      : left.map(i => duck(i, '', swim(i))).join('');
  } else {
    ducks = left.map(i => (can ? `<button class="dukd" style="${at(HOME[i])};${drift(i)}" data-act="move" ${mv(i)} aria-label="Duck ${i + 1}">${swim(i)}</button>` : duck(i, '', swim(i)))).join('');
  }
  // the catch so far (the latest few): the shared pond's hooks in their hooker's colour; on a square from before, this
  // pond's owner's; the newest flying down from the duck once its bottom has shown (a refilled pond's list starts again:
  // the move's own value is added)
  let got, who;
  if (shared) {
    const pd = pondOf(mini, by);
    got = pd.out.slice(); who = pd.outBy.slice();
    if (f && f.refill) { got = [f.v]; who = [a.by]; }
    got = got.slice(-8); who = who.slice(-8);
  } else { got = (mini.got[by] || []).slice(-8); who = got.map(() => by); }
  const newest = f && anim ? got.length - 1 : -1, land = f ? T.show + DUKT.hold * 0.4 : 0;
  const chips = got.map((v, k) => { const cls = 'dukc' + (v ? '' : ' b') + (shared ? ' ' + who[k] : ''); return `<i ${k === newest ? lateAt(cls, land) + cfFrom('dukhk', land) : `class="${cls}"`}>${v ? v : BOOT_SVG}</i>`; }).join('');
  const say = s => (s.v > 0 ? `<b class="${by}">${N(by)}</b> hooked a ${s.v}!` : 'A boot! Nothing') + (s.refill ? ' · the pond fills again' : '');
  const last = !f && mini.last && mini.last.by === by && (o.done || o.view) ? mini.last : null;
  const rc = s => 'dukres ' + (s.v > 0 ? 'ok' : 'no') + (s.refill ? ' long' : '');
  const res = f ? `<p ${lateAt(rc(f), anim ? T.show : null)} role="status">${say(f)}</p>` : last ? `<p class="${rc(last)}">${say(last)}</p>` : `<p class="dukres">&nbsp;</p>`;
  return `<div class="g-duk pc-${by}"><div class="ctals">${tal('X')}${tal('O')}</div>
    <p class="duklab">Fishing: <b class="${by}">${N(by)}</b></p>
    <div class="dukpond" aria-label="${left.length} ducks in the pond${shared ? '' : ` of ${N(by)}`}"><div class="dukwater"${fxAttr(fx.enter ? fx.enter.at : null, 'rt')}></div><div class="dukswim"${fxAttr(fx.enter ? fx.enter.at : null, 'rt')}>${ducks}</div><div class="dukair"${fxAttr(fx.enter ? fx.enter.at : null, 'rt')}>${air}</div></div>
    ${res}<div class="dukcatch" aria-label="Hooked so far">${chips}</div></div>`;   // (the result's line right under the pond, clear of a replay's Skip and the reactions' button in the corners below; the catches under it)
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = pondView(mini, a, { view, locked, turn, done: !!d }); return g;
}
// The line under the game's name while a duck with points keeps the turn ("Go again on success" on: ui/mini.js heldSub).
export function heldSub(mini, turn, f, a) {
  if (f) return '';
  return `<b class="${turn}">${N(turn)}</b> hooked points · goes again`;
}
// The miniature: the one pond as an oval with the ducks still in it, and under it each player's mark and a bar of their
// points toward the target (a picture: no figures). A square from before: each player's own pond, their bar beside it.
export function miniature(mini, final) {
  const goal = duckCfg(mini).target;
  if (duckShared(mini)) {
    const left = (mini.left || []).map((on, i) => (on ? i : -1)).filter(i => i >= 0);
    const ducks = left.map(i => { const [hx, hy] = HOME[i]; const x = 8 + hx * 0.84, y = 16 + (hy - 52) * 0.42; return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><path class="tdukk" d="M3.4 -2.6l2 .5-2 .7z"/><ellipse class="tdukb" rx="3.2" ry="2.3"/><circle class="tdukb" cx="2.2" cy="-2.3" r="1.5"/></g>`; }).join('');
    const bar = (p, y) => { const f = Math.max(0, Math.min(1, mini.score[p] / goal)); return `<g class="tdukm ${p}" transform="translate(6 ${y + 4})">${markSvgG(p, 4)}</g><rect class="tdukt" x="14" y="${y}" width="82" height="8" rx="4"/><rect class="tdukf ${p}" x="14" y="${y}" width="${(82 * f).toFixed(1)}" height="8" rx="4"/>`; };
    return `<div class="tduk" aria-label="Hook-a-Duck: X ${mini.score.X}, O ${mini.score.O} of ${goal} points, ${left.length} ducks in the pond"><svg viewBox="0 0 100 56" aria-hidden="true"><ellipse class="tdukrim" cx="50" cy="16" rx="48.4" ry="15.6"/><ellipse class="tdukp" cx="50" cy="16" rx="46" ry="13.6"/>${ducks}${bar('X', 34)}${bar('O', 46)}</svg></div>`;
  }
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
// The line runs down with its reel's ticks and the hook goes in with a plop; the duck comes out with a squeak and a
// splash; then its bottom: a ding for points (a sparkle over it for the best duck), a rubber flop for a boot; a
// refilled pond's ducks squeak as they float in.
export function sounds(f, add, won, mini, last) {
  const s = f.duck;
  if (!s) return;
  const T = duckTimes(s);
  add('dukReel', 0);
  add('plop', T.lift - 120);
  add('dukSqueak', T.lift + 30);
  add('splash', T.lift + 60);
  if (s.v > 0) { add('ding', T.show, 0.84 + 0.08 * Math.min(5, s.v)); if (s.v >= 5) add('sparkle', T.show + 90); }
  else add('dukBoot', T.show);
  if (s.refill) { add('dukSqueak', T.end - DUKT.refill + 80); add('dukSqueak', T.end - DUKT.refill + 230); }
}
