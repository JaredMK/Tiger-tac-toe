// Every mini-game's tunable values: the admin's Mini-game Settings (config/tune/<type>, read by the page and
// the server). A game lists its settings in its meta.js as TUNE: [{ k, label, def, min, max, step, group,
// opts? }] (def: the value the code had; group: 'Board', 'Rules', 'Timing' or 'Computer'; opts: a choice of
// values instead of a range). A square is dealt with the values of the moment (tuneLive) and keeps them
// (mini.tune: only those that differ from the defaults), so a square plays to the end by what it was dealt
// with, on both phones and the server alike (tune(mini)). Pure: no page, no clock.
const FIELDS = Object.create(null), DEF = Object.create(null), CFG = Object.create(null);

// The registry's list (src/games/index.js, at load): each type's fields.
export function registerTunes(map) {
  for (const t of Object.keys(map)) {
    FIELDS[t] = Array.isArray(map[t]) ? map[t] : [];
    DEF[t] = Object.fromEntries(FIELDS[t].map(f => [f.k, f.def]));
  }
}
export const tuneFields = type => FIELDS[type] || [];
export const tuneDefaults = type => Object.assign({}, DEF[type]);
// One field's value checked: in its range (or one of its choices), on its step; else null.
export function tuneValue(f, v) {
  if (f.opts) { const o = f.opts.find(x => String(x) === String(v)); return o === undefined ? null : o; }
  const n = Number(v);
  if (v === null || v === '' || !Number.isFinite(n)) return null;
  const s = f.step || 1, c = Math.min(f.max, Math.max(f.min, n)), r = Math.round((c - f.min) / s) * s + f.min;
  return Math.min(f.max, Number(r.toFixed(6)));
}
// A config as saved (or as the editor has it): the known fields only, checked, and only where they differ
// from the defaults ({} when all are as the code has them).
export function tuneNorm(type, raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const f of tuneFields(type)) {
    if (raw[f.k] === undefined) continue;
    const v = tuneValue(f, raw[f.k]);
    if (v !== null && v !== f.def) out[f.k] = v;
  }
  return out;
}
export function setTune(type, raw) { CFG[type] = tuneNorm(type, raw); }
export function setTunes(all) { for (const t of Object.keys(FIELDS)) setTune(t, all && all[t]); }
// The values a square is dealt with now (rules.create reads these), and what it keeps of them.
export const tuneLive = type => Object.assign({}, DEF[type], CFG[type]);
export const tuneSnap = type => (CFG[type] && Object.keys(CFG[type]).length ? Object.assign({}, CFG[type]) : null);
// A square's own values: the defaults, with what it was dealt with over them.
const memo = new WeakMap();
export function tune(mini) {
  if (!mini || typeof mini !== 'object') return {};
  const m = memo.get(mini);
  if (m && m.src === mini.tune) return m.v;
  const v = Object.assign({}, DEF[mini.type], mini.tune && typeof mini.tune === 'object' ? tuneNorm(mini.type, mini.tune) : null);
  memo.set(mini, { src: mini.tune, v });
  return v;
}
