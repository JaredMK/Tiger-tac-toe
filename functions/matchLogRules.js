'use strict';
// Match logs, for debugging (pure: no database; functions/index.js writes what these work out). Every
// online match (Find Match, a friend room, Super Chaos in a friend room) and every Super Chaos match
// against the computer keeps a compact, timestamped log of what happened: its start, each round's start
// and result, each move accepted or refused (and why), timeouts, a phone dropping off and coming back,
// the phones' errors, each phone's app version and device (hashed, never a name), and a player's
// "Report a problem". The server writes what it sees itself (matchmaking moves, the friend rooms' record,
// presence); the phones send the rest through the device log (devlog: error, mlog, report).
//
// Stored as matchLogs/{key}/{pushId} = event and matchLogIndex/{key} = the match's summary (mode, players,
// started, last, n events, reported, notes): the admin's match inspector lists the index and opens one
// log. Logs older than LOG_KEEP_MS (from their last event) are deleted by the sweep.
// An event: { t: ms, k: kind, ... }: s side, r round, q square, g mini-game, why a refusal's reason, src
// where it came from ('srv' the server, 'cli' a phone), dev a device (hashed), v an app version.

const LOG_KEEP_MS = 30 * 24 * 3600 * 1000;   // 30 days
const LOG_CAP = 3000;                        // events kept per match: far beyond any real match (a phone sending junk stops here)
const MODES = ['match', 'bot', 'friend', 'friend-sc', 'chaos', 'local', 'cpu', 'cvc'];
const KEY_RE = /^[mfl][-\w]{3,60}$/;         // m: a Find Match game; f: a friend room's match (code_id); l: a match on one phone
const keyOk = k => typeof k === 'string' && KEY_RE.test(k);
const mmKey = id => 'm' + id;
const friendKey = (code, id) => 'f' + code + '_' + id;
const sideOk = s => (s === 'X' || s === 'O' ? s : undefined);
const clean = o => { const r = {}; for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== false) r[k] = v; return r; };
const short = (v, n) => String(v == null ? '' : v).replace(/[^\x20-\x7e]/g, '?').slice(0, n);

// A move as the record keeps it (a recent entry, or the flash a move made): one line of the log.
function entryEvent(e, t, src) {
  if (!e) return null;
  return clean({ t, k: e.timeout ? 'timeout' : 'move', s: sideOk(e.by), q: Number.isInteger(e.square) ? e.square : undefined, g: e.type || undefined, kind: e.kind && e.kind !== 'move' ? e.kind : undefined, w: sideOk(e.winner), seq: Number.isInteger(e.seq) ? e.seq : undefined, src: src || 'srv' });
}
const types = st => (st && Array.isArray(st.squares) ? st.squares.map(q => (q && q.mini ? q.mini.type : '?')) : []);
const owners = st => (st && Array.isArray(st.squares) ? st.squares.map(q => (q && q.owner) || '').join('') : '');

// A friend room's match, before and after one write to it (parsed states, or null): what happened, as
// log events. A new match; in a normal match each move the record took; in Super Chaos each move sent in
// (or the timeout rule's), each round settled, each round begun; the match's end.
function friendEvents(b, a, t) {
  if (!a) return [];
  const out = [], sc = a.sc && a.sc.online ? a.sc : null, fresh = !b || b.id !== a.id;
  if (fresh) {
    out.push(clean({ t, k: 'start', mode: sc ? 'friend-sc' : 'friend', id: short(a.id, 40), games: types(a).join(' '), src: 'srv' }));
    if (sc) out.push({ t, k: 'round', r: sc.round, dl: sc.deadline || undefined, src: 'srv' });
    b = null;
  }
  if (!sc) {
    const seq0 = b && Number.isInteger(b.seq) ? b.seq : 0;
    for (const e of (a.recent || []).filter(x => x && Number.isInteger(x.seq) && x.seq > seq0).sort((x, y) => x.seq - y.seq)) out.push(entryEvent(e, t));
  } else if (b && b.sc) {
    const bs = b.sc, bm = bs.moves || {}, am = sc.moves || {};
    const moveEv = (side, m, r) => clean({ t, k: m.timeout || m.auto ? 'timeout' : 'move', s: side, r, q: Number.isInteger(m.square) ? m.square : undefined, g: m.mini ? m.mini.type : m.type || undefined, win: !!m.win, auto: !!m.auto, src: 'srv' });
    const settled = sc.recap && (!bs.recap || bs.recap.round !== sc.recap.round) ? sc.recap : null;
    if (settled) {                                              // the round settled in this write: any move that came in with it (the second one, or the deadline's)
      for (const side of ['X', 'O']) { const m = settled.mv && settled.mv[side]; if (!bm[side]) out.push(m ? moveEv(side, m, settled.round) : { t, k: 'timeout', s: side, r: settled.round, missed: true, src: 'srv' }); }
      out.push(clean({ t, k: 'resolve', r: settled.round, claims: (settled.claims || []).map(c => c.square + c.by).join(' ') || undefined, resets: (settled.resets || []).map(x => `${x.square}:${x.why}`).join(' ') || undefined, owners: owners(a), src: 'srv' }));
    } else for (const side of ['X', 'O']) if (am[side] && !bm[side]) out.push(moveEv(side, am[side], sc.round));
    if (bs.deadline == null && sc.deadline != null && !settled) out.push({ t, k: 'round', r: sc.round, dl: sc.deadline, src: 'srv' });
  }
  if (a.winner && !(b && b.winner)) out.push(clean({ t, k: 'end', w: a.winner, why: a.winReason || undefined, resigned: sideOk(a.resigned), owners: owners(a), src: 'srv' }));
  return out.filter(Boolean);
}

// An event a phone sends for the log (devlog's mlog: what only the phone knows, a match against the
// computer above all): kept only in a known shape, short. Returns the event (t and src added) or null.
const CLIENT_KINDS = ['round', 'resolve', 'timeout', 'move', 'reject', 'reconnect', 'offline', 'note', 'resync'];
function clientEvent(e, t) {
  if (!e || typeof e !== 'object' || !CLIENT_KINDS.includes(e.k)) return null;
  const out = { t, k: e.k, src: 'cli' };
  for (const [k, v] of Object.entries(e)) {
    if (k === 'k' || k === 't' || k === 'src' || !/^[a-z]{1,8}$/i.test(k)) continue;
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.round(v * 1000) / 1000;
    else if (typeof v === 'boolean') { if (v) out[k] = true; }
    else if (typeof v === 'string' && v) out[k] = short(v, 80);
    if (Object.keys(out).length > 14) break;
  }
  return JSON.stringify(out).length <= 600 ? out : null;
}

// The match's summary, merged with what the server knows (meta) and n more events. undefined when the log
// is full (nothing written). meta: { mode, players: { X: { name, uid }, O }, room, ver, dev, report: { t, note } }.
function indexMerge(cur, meta, n, t) {
  const x = Object.assign({}, cur || {});
  if ((x.n || 0) + n > LOG_CAP) return undefined;
  x.n = (x.n || 0) + n;
  x.started = x.started || t; x.last = Math.max(x.last || 0, t);
  const m = meta || {};
  if (m.mode && MODES.includes(m.mode) && (!x.mode || m.srv)) x.mode = m.mode;   // (the server's word over a phone's)
  if (m.players) for (const s of ['X', 'O']) { const p = m.players[s]; if (p && (p.name || p.uid)) x.players = Object.assign({}, x.players, { [s]: clean({ name: p.name ? short(p.name, 24) : undefined, uid: p.uid ? short(p.uid, 40) : undefined }) }); }
  if (m.room && !x.room) x.room = short(m.room, 8);
  if (m.ver) x.vers = uniq((x.vers || '').split(' ').concat(short(m.ver, 20))).join(' ');
  if (m.dev) x.devs = uniq((x.devs || '').split(' ').concat(short(m.dev, 24))).slice(-6).join(' ');
  if (m.report) { x.reported = m.report.t; x.reports = (x.reports || 0) + 1; if (m.report.note) x.note = reportNote(m.report.note); }
  x.who = [x.players && x.players.X && x.players.X.name, x.players && x.players.O && x.players.O.name, x.players && x.players.X && x.players.X.uid, x.players && x.players.O && x.players.O.uid, x.devs, x.room].filter(Boolean).join(' ').toLowerCase().slice(0, 300);
  return x;
}
const uniq = a => [...new Set(a.filter(Boolean))];
// A report's note: trimmed, printable, at most 140 characters.
const reportNote = v => (typeof v === 'string' ? v.trim() : '').replace(/[\x00-\x1f\x7f]/g, ' ').slice(0, 140);

module.exports = { LOG_KEEP_MS, LOG_CAP, MODES, keyOk, mmKey, friendKey, entryEvent, friendEvents, clientEvent, CLIENT_KINDS, indexMerge, reportNote };
