// Tunable settings: a game's defaults, the admin's values checked against their limits (cfgKit).

export function cfgKit(defaults, limits, fix) {                      // a config's checks: each value a number in its range (else the default), then any cross-checks
  const box = { cfg: null };
  const norm = raw => { const out = {}; for (const k of Object.keys(defaults)) { const [lo, hi, step] = limits[k], x = raw && raw[k] != null ? Number(raw[k]) : NaN; out[k] = Number.isFinite(x) && x >= lo && x <= hi ? (step ? Math.round(x / step) * step : x) : defaults[k]; } return fix ? fix(out) : out; };
  return { box, norm, set: raw => { box.cfg = raw && typeof raw === 'object' ? norm(raw) : null; }, get: () => Object.assign({}, box.cfg || defaults) };
}
export const lohi = keys => out => { for (const [a, b] of keys) if (out[b] < out[a]) out[b] = out[a]; return out; };
// Super Chaos (simultaneous rounds) is off everywhere, for everyone, admins included: no mode selector, no Super Chaos
// match from Play Computer, a friend room or Find Match (the page and the server read this one switch). Its code and
// settings stay, for when it comes back: set this true (and its release switch, releases/superchaos, as before).
export const SUPER_CHAOS_ENABLED = false;
