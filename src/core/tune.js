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
export const gameFields = type => tuneFields(type).filter(f => !f.lv);   // (the game's own, its meta.js TUNE: without the per-level ones levelTune adds, marked lv)
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
export const tuneAll = () => Object.assign({}, CFG);   // (as set: for another engine instance, the page's worker)
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
// Settings versions (December 2026): every Save of a game's admin settings makes a new version of that game's settings
// (config/versions/<type>: its number; config/versionLog/<type>/<n>: when and what changed; the admin's Games page). A
// square is dealt under the version of the moment and keeps its number (mini.sv; none = 1: every square from before
// versions were kept counts as version 1), so its stats are filed under the settings it was played with.
const VER = Object.create(null);
const verNum = v => (Number.isInteger(Number(v)) && Number(v) >= 1 ? Number(v) : 1);
export function setTuneVersions(all) { for (const k of Object.keys(VER)) delete VER[k]; if (all && typeof all === 'object') for (const [t, v] of Object.entries(all)) VER[t] = verNum(v); }
export const tuneVersion = type => VER[type] || 1;
export const tuneVersions = () => Object.assign({}, VER);
export const miniVersion = mini => verNum(mini && mini.sv);
// The settings a save changed (old and new values by key, both as the code would deal: defaults filled in), for the log.
export function tuneChanges(type, before, after) {
  const a = Object.assign({}, DEF[type], tuneNorm(type, before)), b = Object.assign({}, DEF[type], tuneNorm(type, after)), out = {};
  for (const f of tuneFields(type)) if (String(a[f.k]) !== String(b[f.k])) out[f.k] = { from: a[f.k], to: b[f.k] };
  return out;
}
// "Go again on success" (November 2026): the games where a success can keep the turn (War, Krabs, 21, Little Wheel,
// Hangman, Sea Battle, Pool, Ride the Bus, Odd One Out, Cup Pong) carry this one switch in their TUNE, off by default:
// off, every move is one action and the turn ends; on, a success keeps the turn. Read from the square (goAgain(mini)).
export const AGAIN_TUNE = { k: 'again', label: 'Go again on success', def: 'off', opts: ['off', 'on'], group: 'Rules' };
export const goAgain = mini => tune(mini).again === 'on';
// The computer's levels in each game (the AI levels pass): every game's settings carry, per difficulty, a mistake
// rate and a thinking time, added to its TUNE at registration (games/index.js, levelTune) in the groups
// 'Computer: Easy', 'Computer: Normal' and 'Computer: Hard' (AI_GROUPS; 'Computer' stays for what the levels share).
//   aiMiss<Level>: % of its moves in this game replaced by a deliberately weaker one (core/ai.js localBest: the game's
//     ai.js `worse`, else any legal move; a game whose move is a run or an attempt gets these only with a `worse`).
//   aiThink<Level>: ms it pauses in the square before its move (feel only: the page's computer turn, ui/turns.js;
//     taken through dur('ui'), so Speed shortens it; added to the usual pause, so 0 is today's pacing).
// A game sets other defaults, or leaves some out, in its meta.js: export const AI_LEVELS = { miss: { easy: 20 },
// think: { hard: 400 } } (miss: false, no mistake settings; AI_LEVELS = false, none at all). A key already in the
// game's own TUNE is kept as the game has it (its label, range and group).
export const AI_LEVELS_LIST = ['easy', 'normal', 'hard'];
export const AI_GROUPS = { easy: 'Computer: Easy', normal: 'Computer: Normal', hard: 'Computer: Hard' };
export const TUNE_GROUPS = ['Board', 'Rules', 'Timing', 'Computer', AI_GROUPS.easy, AI_GROUPS.normal, AI_GROUPS.hard];
const LV_CAP = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };
export const aiMissKey = level => 'aiMiss' + (LV_CAP[level] || 'Normal');
export const aiThinkKey = level => 'aiThink' + (LV_CAP[level] || 'Normal');
export function levelTune(T, opts) {
  const list = Array.isArray(T) ? T.slice() : [], o = opts === undefined ? {} : opts;
  if (o === false) return list;
  const have = new Set(list.map(f => f.k)), pick = (m, l) => (m && typeof m === 'object' && m[l] != null ? m[l] : 0);
  for (const l of AI_LEVELS_LIST) {
    const g = AI_GROUPS[l];
    if (o.miss !== false && o.slip !== false && !have.has(aiMissKey(l))) list.push({ k: aiMissKey(l), label: 'Mistakes: chance a move is a deliberately weaker one (%)', def: pick(o.miss, l), min: 0, max: 100, step: 1, group: g, lv: true });
    if (o.think !== false && !have.has(aiThinkKey(l))) list.push({ k: aiThinkKey(l), label: 'Thinking time: extra pause before its move (ms, for feel only)', def: pick(o.think, l), min: 0, max: 3000, step: 50, group: g, lv: true });
  }
  return list;
}
// A square's (or its public view's) level settings: the mistake chance (0..1) and the extra pause (ms).
export const aiMiss = (mini, level) => { const v = Number(tune(mini)[aiMissKey(level)]); return v > 0 ? Math.min(1, v / 100) : 0; };
export const aiThink = (mini, level) => { const v = Number(tune(mini)[aiThinkKey(level)]); return v > 0 ? v : 0; };
