// A move's replay log (pure: the page records and plays it, the server checks and keeps it). What the
// mover did on their screen before the move went in, as timed inputs: [ms, act, val], ms from the first
// input (a long pause between two cut to REP.gap, so a replay never drags), act the control pressed (a
// data-act name), val its value ("m=5": the data-m of a move control, "k=A": a key, "i=3": a card, or a
// drag's reading). The move's own result (the dice, the cards, the hidden word) is in the square and the
// flash already; a real-time game's run or attempt is in its move (its log or recording), so the log here
// is the human part: the selection, typed out or tapped, that the other side never saw. The log rides
// the flash (flash.rep) and, online, the move's entry in the record, so the other phone plays it back
// through the game's normal view before the move's own animation.
export const REP = { max: 48, gap: 1500, press: 420, act: /^[a-z][a-z0-9-]{0,15}$/, val: /^[\w .,:;=|'"\-\[\]{}]{0,60}$/ };
// A log from anywhere (this phone, the computer, the network): the same shape every time, or null.
export function repNorm(raw) {
  if (!Array.isArray(raw) || !raw.length) return null;
  const out = [];
  let last = 0, prev = 0;
  for (const e of raw.slice(-REP.max)) {
    if (!Array.isArray(e) || e.length < 2) return null;
    const ms = Math.round(Number(e[0])), act = String(e[1]), val = e[2] == null ? null : String(e[2]);
    if (!Number.isFinite(ms) || !REP.act.test(act) || (val != null && !REP.val.test(val))) return null;
    const at = out.length ? last + Math.max(0, Math.min(REP.gap, ms - prev)) : 0;   // (each gap as it was, a long one cut to REP.gap)
    out.push(val == null ? [at, act] : [at, act, val]);
    last = at; prev = ms;
  }
  return out;
}
// The move itself, when it is small enough to ride the flash (the control a replay presses when the mover's
// phone sent no log: an older page, a bot); a run or an attempt (a log, a recording) is already in the flash.
export function repMove(m) {
  if (m === undefined || typeof m === 'function') return undefined;
  if (m && typeof m === 'object' && !Array.isArray(m) && ('log' in m || 'rec' in m || 'hits' in m)) return undefined;
  let s;
  try { s = JSON.stringify(m); } catch (e) { return undefined; }
  return s != null && s.length <= 60 ? m : undefined;
}
// A move's value as a log writes it (the data-m of the control that makes it).
export const repOf = m => 'm=' + JSON.stringify(m);
