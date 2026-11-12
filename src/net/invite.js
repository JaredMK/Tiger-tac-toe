// The room invite: the one place an invite's text is built (CLAUDE.md: invites are only built by buildInvite and always
// carry the code). "Join my Tic Tac Chaos game! Code: ABCDE https://tictacchaos.com/join/ABCDE": the code in words, then
// a link that carries the code in its path, so the code is still on show when an app drops the message's text and keeps
// only the link (or keeps the text and drops a link it turned into a preview). The link is the site's own (staging's on
// staging, production's in the app: net/platform.js inviteSite); /join/CODE opens the join flow on the web (firebase.json
// redirects it to /?room=CODE) and in the app (a Universal Link: scripts/build-site.js aasa), and ?room=CODE still works
// (ui/input.js linkCode reads both). Shared as this one text, with no separate url field (net/platform.js shareText),
// and copied as the same text (net/room.js copyInvite).
import { inviteSite } from './platform.js';

export const INVITE_HEAD = 'Join my Tic Tac Chaos game!';
// A room code as invites carry it: capitals only (codes are five letters, ui/input.js validCode).
export const inviteCode = code => String(code || '').toUpperCase().replace(/[^A-Z]/g, '');
// The link that opens the join flow for a code: the site's address, then join/CODE.
export function inviteLink(code, site = inviteSite()) {
  const base = String(site || 'https://tictacchaos.com/').replace(/\/*$/, '/');
  return `${base}join/${inviteCode(code)}`;
}
export function buildInvite(code, site) {
  const c = inviteCode(code);
  if (!c) throw new Error('buildInvite: no room code');      // (an invite without its code is never sent)
  return `${INVITE_HEAD} Code: ${c} ${inviteLink(c, site)}`;
}
