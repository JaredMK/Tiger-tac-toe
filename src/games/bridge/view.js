// Glass Bridge: the screen, the miniature, the move's words and sounds.
// The bridge runs up the screen from the near bank to the far bank (the finish: solid ground past a checkered line, a
// flag planted in it): a row of glass platforms a line, each a button while it is in the mover's next row. Glass
// nobody has stood on is pale blue, and so is glass that held; glass that broke is gone (its shards fall away). A hop:
// the mover's token crouches where it stands, leaps in an arc onto the platform and lands with a squash (BRIDGE.hop,
// `jump`: Web Animations from the platform it left, measured); a break: it lands, the glass cracks (BRIDGE.crack), gives
// way and the token drops through (BRIDGE.drop), then stands back on the near bank (BRIDGE.back: v 2 starts its next
// turn from the beginning). The winning hop (onto the last row) lands there, and after a beat (BRIDGE.off) the token
// leaps off onto the far bank, lands with the same squash and does its victory dance (BRIDGE.dance: arms up, two hops,
// a twirl, a pose); a player across stands on the far bank from then on, arms up. Shared: one bridge with both tokens;
// separate: one each, side by side under its player's mark. Everything is timed from the move (rules.js BRIDGE).
import { BRIDGE, bridgeBankAt, bridgeSeen } from './rules.js';
import { N, REDUCED, app, mv } from '../../ui/app.js';
import { fx, fxAt } from '../../ui/fx.js';
import { arcTally, lateAt, pips } from '../../ui/progress.js';
import { pipRows, thumbArt } from '../../ui/thumbs.js';
import { tok } from '../../ui/tok.js';

export const ownLine = true;
export const hold = f => (f.kind === 'again' ? 0 : null);         // a hop that holds: the next one at once
const SHARDS = '<svg class="gbsh" viewBox="0 0 40 24" aria-hidden="true"><path d="M3 4l9 3-4 6zM22 3l7 5-9 2zM30 14l7-2-3 8zM12 15l8 2-6 5z"/></svg>';
// The far bank's flag: a pole planted in the ground, a checkered flag flying from it.
const FLAG = '<svg class="gbflag" viewBox="0 0 24 40" aria-hidden="true"><path class="gbfk" d="M5 4.5q5-2.6 9.5 0t9 0v12q-4.5 2.6-9 0t-9.5 0z"/><path class="gbfc" d="M5 4.5L9.8 3.2V9.2L5 10.5zM9.8 9.2L14.5 10.5V16.5L9.8 15.2zM14.5 4.5L19 5.8V11.8L14.5 10.5zM19 11.8L23.5 10.5V16.5L19 17.8z"/><path class="gbfo" d="M5 4.5q5-2.6 9.5 0t9 0v12q-4.5 2.6-9 0t-9.5 0z"/><path class="gbpole" d="M5 3v36"/><circle class="gbknob" cx="5" cy="2.7" r="2.2"/></svg>';
// The winner's arms (drawn only for the victory: up from behind the token, a hand in their colour) and the sparkles of
// the dance's pose.
const ARM = '<svg viewBox="0 0 12 15" aria-hidden="true"><path class="gbarml" d="M11 13.6Q6.4 12.6 4.2 4.9"/><circle class="gbhand" cx="4" cy="3.5" r="3"/></svg>';
const SPARKS = '<svg class="gbsp" viewBox="-30 -30 60 60" aria-hidden="true"><path d="M-21-13l1.6 3.8 3.8 1.6-3.8 1.6-1.6 3.8-1.6-3.8-3.8-1.6 3.8-1.6zM20-17l1.3 3 3 1.3-3 1.3-1.3 3-1.3-3-3-1.3 3-1.3zM-24 10l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1zM23 6l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5zM-3-28l1.2 2.8 2.8 1.2-2.8 1.2-1.2 2.8-1.2-2.8-2.8-1.2 2.8-1.2z"/></svg>';
const winner = (p, dance) => `<span class="gbwin ${p}${dance ? ' dance' : ''}"><i class="gbarm l">${ARM}</i><i class="gbarm r">${ARM}</i>${tok(p)}${dance ? SPARKS : ''}</span>`;
function bridge(mini, o, a, own) {                               // own: whose bridge (separate), null the shared one
  const R = mini.n.length, s = a && a.gb && (!own || a.by === own) ? a.gb : null, by = s ? a.by : null;
  const seen = own ? mini.seen[own] : mini.seen, who = own ? [own] : ['X', 'O'], mover = o.turn;
  const next = !o.view && !o.locked && (!own || own === mover) ? mini.at[mover] + 1 : -1;
  const across = p => mini.at[p] === R - 1;                       // across (the square is theirs): on the far bank, never on the last row
  const here = (p, r, i) => (r < 0 ? mini.at[p] < 0 : !across(p) && mini.at[p] === r && mini.pos[p] === i);
  const fromKey = s ? (s.r > 0 && s.from >= 0 ? `${s.r - 1}:${s.from}` : 'bank') : '';   // where the jump took off: the platform stood on, or the near bank
  const jump = (p, cls) => `<span class="gbj${cls ? ' ' + cls : ''}" data-gbj="${fromKey}">${tok(p)}</span>`;
  const far = () => who.filter(across).map(p => (s && by === p && !s.fall && s.r === R - 1
    ? `<span class="gbj across" data-gbj="${fromKey}" data-gbm="${s.r}:${s.i}">${winner(p, true)}</span>`   // just won: onto the last row, then off it onto the far bank, and the dance
    : winner(p, false))).join('');
  const tokens = (r, i) => who.filter(p => here(p, r, i)).map(p => {
    if (s && by === p && !s.fall && s.r === r && s.i === i) return jump(p);                    // just landed here
    if (s && by === p && s.fall) return tok(p, 'backin');                                       // fell: back at the start once the fall has played
    return tok(p);
  }).join('') + (s && s.fall && s.r === r && s.i === i ? jump(by, 'fallin') : '');
  const row = r => `<div class="gbrow" style="--n:${mini.n[r]}">${seen[r].map((v, i) => {
    const fresh = s && s.r === r && s.i === i ? ' fresh' : '', cls = `gbp s${v === 2 ? 2 : 0}${fresh}`, inner = `${v === 2 && fresh ? SHARDS : ''}${tokens(r, i)}`;   // (glass that held looks like glass not tried: players remember it)
    return r === next && v !== 2 ? `<button class="${cls} nx ${mover}" data-gba="${r}:${i}" data-act="move" ${mv(i)} aria-label="Row ${r + 1}, platform ${i + 1}">${inner}</button>` : `<div class="${cls}" data-gba="${r}:${i}">${inner}</div>`;
  }).join('')}</div>`;
  let rows = ''; for (let r = R - 1; r >= 0; r--) rows += row(r);
  return `<div class="gbb${own ? ' own ' + own : ''}" style="--rows:${R}"><div class="gbend far">${FLAG}${far()}</div>${rows}<div class="gbend near" data-gba="bank">${tokens(-1, -1)}</div></div>`;
}
// The jump, once drawn (a frame after the render): each jumping token is carried from the middle of the platform it
// took off from to its own place, crouching there first, then up and over in an arc (its peak above the higher end)
// and down with a squash; timed from the move, so a redraw mid-jump picks it up where it is. A token that breaks the
// glass then drops through it (its own CSS, after the landing). The winning token is drawn on the far bank and its
// jump has two legs: the hop onto the last row's glass (from the platform it left, as any hop), a beat standing there
// (BRIDGE.off), then the same jump on up onto the bank, a lower arc (the bank is close); its dance is its own CSS
// (styles.css gbdance), after it.
let jumped = new WeakSet();
function jumpNext(a) { if (typeof requestAnimationFrame === 'function' && !REDUCED) requestAnimationFrame(() => jumpRun(a)); }
const at2 = (x, y, sx, sy) => `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${sx == null ? 1 : sx}, ${sy == null ? sx == null ? 1 : sx : sy})`;
// One leg of a jump, from offset o0 to o1 of the whole animation: from A to B (each the token's place less its own, px).
function leg(frames, o0, o1, A, B, lift) {
  const c = BRIDGE.crouch, of = x => o0 + (o1 - o0) * x, [ax, ay] = A, [bx, by] = B, h = Math.abs(ay - by) / 2 + lift;
  const P = u => [bx + (ax - bx) * (1 - u), by + (ay - by) * (1 - u) - 4 * h * u * (1 - u)];   // the arc: its peak well above the higher end
  frames.push({ offset: of(0), transform: at2(ax, ay) }, { offset: of(c * 0.6), transform: at2(ax, ay + 3, 1.14, 0.78) }, { offset: of(c), transform: at2(ax, ay, 0.92, 1.12) });
  for (let j = 1; j <= 6; j++) { const u = j / 7, [x, y] = P(u); frames.push({ offset: of(c + (0.86 - c) * u), transform: at2(x, y, +(1 + 0.12 * Math.sin(Math.PI * u)).toFixed(3)) }); }
  frames.push({ offset: of(0.86), transform: at2(bx, by, 1.16, 0.8) }, { offset: of(0.94), transform: at2(bx, by - 2, 0.96, 1.06) }, { offset: of(1), transform: at2(bx, by) });
}
function jumpRun(a) {
  if (!app || !app.querySelectorAll) return;
  app.querySelectorAll('.g-gb .gbj').forEach(el => {
    if (jumped.has(el) || typeof el.animate !== 'function') return;
    jumped.add(el);
    const bb = el.closest('.gbb'), src = bb && bb.querySelector(`[data-gba="${el.dataset.gbj}"]`); if (!src) return;
    const a1 = el.getBoundingClientRect(), k = (bb.getBoundingClientRect().width / (bb.offsetWidth || 1)) || 1;
    const rel = e => { const b = e.getBoundingClientRect(); return [(b.left + b.width / 2 - (a1.left + a1.width / 2)) / k, (b.top + b.height / 2 - (a1.top + a1.height / 2)) / k]; };
    const mid = el.dataset.gbm ? bb.querySelector(`[data-gba="${el.dataset.gbm}"]`) : null, frames = [];
    let T = BRIDGE.hop;
    if (mid) {                                                   // the winning hop: onto the last row, a beat, then off onto the far bank
      const M = rel(mid), h1 = BRIDGE.hop, h2 = h1 + BRIDGE.off; T = h2 + BRIDGE.hop;
      leg(frames, 0, h1 / T, rel(src), M, 26);
      leg(frames, h2 / T, 1, M, [0, 0], 12);
    } else leg(frames, 0, 1, rel(src), [0, 0], 26);
    const an = el.animate(frames, { duration: T, fill: 'both', easing: 'linear' });
    const at = fxAt('move', a), rate = (fx.move && fx.move.rate) || 1;
    if (at != null) { try { an.playbackRate = rate; an.currentTime = Math.max(0, performance.now() - at); } catch (e) { /* (kept) */ } }
  });
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const R = mini.n.length, s = a && a.gb ? a.gb : null, o = { view, locked, turn }, T = BRIDGE;
  const tal = p => arcTally(p, o, pips(p, mini.at[p] + 1, R, !!(s && !s.fall && a.by === p), T.hop));
  const say = s ? (s.fall ? [s.home ? 'Crack! Back to the start' : 'Crack! It broke', 'no', T.hop + T.crack] : fresh ? ['Across!', 'ok', bridgeBankAt()] : ['Safe!', 'ok', T.hop]) : null;   // (across: as the token lands on the far bank)
  const line = say ? `<p ${lateAt('gbline ' + say[1], say[2])} role="status">${say[0]}</p>` : '<p class="gbline"></p>';
  const br = mini.sep ? bridge(mini, o, a, 'X') + bridge(mini, o, a, 'O') : bridge(mini, o, a, null);
  if (s) jumpNext(a);
  return `<div class="g-gb${mini.sep ? ' sep' : ''}" style="--hop:${T.hop}ms;--crk:${T.hop + T.crack}ms;--bk:${T.hop + T.crack + T.drop}ms;--dr:${T.drop}ms;--dc:${bridgeBankAt()}ms;--dn:${T.dance}ms"><div class="ctals two">${tal("X")}${tal("O")}</div><div class="gbwrap">${br}</div>${line}</div>`;
}
export function heldSub(mini, turn, f, a) { return f ? '' : `<b class="${turn}">${N(turn)}</b> hops again`; }
// The miniature: the bridge from above (its rows of glass: untried, safe, broken; a dot where each player stands),
// beside each player's rows crossed as pips.
export function miniature(mini, final) {
  const R = mini.n.length, one = (own, x0, w) => {
    const seen = own ? mini.seen[own] : mini.seen, h = 56 / R; let out = '';
    for (let r = 0; r < R; r++) for (let i = 0; i < mini.n[r]; i++) {
      const cw = w / mini.n[r], x = x0 + i * cw, y = 58 - (r + 1) * h;
      if (seen[r][i] === 2) continue;   // (a broken pane is gone; one that held looks untried)
      out += `<rect class="tgbp" x="${(x + 0.8).toFixed(1)}" y="${(y + 0.8).toFixed(1)}" width="${(cw - 1.6).toFixed(1)}" height="${(h - 1.6).toFixed(1)}" rx="1.5"/>`;
      for (const p of own ? [own] : ['X', 'O']) if (mini.at[p] === r && mini.pos[p] === i) out += `<circle class="tgbt ${p}" cx="${(x + cw / 2 + (own ? 0 : p === 'X' ? -cw * 0.18 : cw * 0.18)).toFixed(1)}" cy="${(y + h / 2).toFixed(1)}" r="${Math.min(3.4, h * 0.34).toFixed(1)}"/>`;
    }
    return out;
  };
  const art = `<svg class="tgb" viewBox="0 0 60 60">${mini.sep ? one('X', 2, 26) + one('O', 32, 26) : one(null, 8, 44)}</svg>`;
  return thumbArt(art, pipRows({ X: mini.at.X + 1, O: mini.at.O + 1 }, R), 'tgbw', `Glass Bridge: X on row ${mini.at.X + 1}, O on row ${mini.at.O + 1} of ${R}`);
}
export function moveText(f, who) { const s = f.gb; return !s ? `${who} hopped` : s.fall ? `${who} broke the glass on row ${s.r + 1}` : `${who} reached row ${s.r + 1}`; }
// The jump, then its landing: a glass tink where it holds; a crack, the smash and the drop where it breaks. The winning
// hop goes on: the leap off (the jump again), the landing on the far bank (a soft thump), the dance's two hops (a springy
// pip each, the second higher) and its twirl (a rising whirl); the square's won chime rings with its pose (wonAt).
export function sounds(f, add, won, mini, last) {
  const s = f.gb; if (!s) return;
  add('gbJump', 0);
  if (s.fall) { add('gbCrack', BRIDGE.hop); add('gbSmash', BRIDGE.hop + BRIDGE.crack); add('thud', BRIDGE.hop + BRIDGE.crack + BRIDGE.drop); } else add('gbTink', BRIDGE.hop);
  if (won && !s.fall) {
    const D = bridgeBankAt();
    add('gbJump', BRIDGE.hop + BRIDGE.off); add('gbLand', D);
    add('gbHop', D + BRIDGE.hop1); add('gbHop', D + BRIDGE.hop2, 1.12); add('gbTwirl', D + BRIDGE.twirl);
  }
}
export const wonAt = (f, total) => (f.gb && !f.gb.fall ? bridgeBankAt() + BRIDGE.pose : total - 600);
