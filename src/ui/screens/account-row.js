// The Account row: Log out and Delete account, small, at the foot of Settings and of My Stats (December 2026: two full-width
// buttons there pushed Settings off one screen). Log out is a small pill; Delete account is a quiet text link that only asks
// ("Delete your account?", No / Yes, delete: deleteDialog, from net/accounts.js delState); nothing is deleted by the tap.
import { delState } from '../../net/accounts.js';
import { esc } from '../app.js';

export const accountRow = () => `<div class="acctrow" role="group" aria-label="Account"><span class="setname">Account</span><span class="setctl"><button class="pk" data-act="logout">Log out</button><button class="delq" data-act="del-account">Delete account</button></span></div>`;

// Delete account: the question first (No / Yes, delete), then the server deletes everything (net/accounts.js deleteAccount);
// refused while the player is in an online match, which the card says.
export function deleteDialog() {
  if (!delState) return '';
  const busy = delState === 'busy', err = delState && delState.error;
  return `<div class="flash pause delask" role="dialog" aria-label="Delete your account?"><div class="card"><h2>Delete your account?</h2>
    <p>Your username, records, game history and login are deleted for good. Other players keep their own history of games against you.</p>
    ${err ? `<div class="warn" role="status">${esc(err)}</div>` : '<div class="warn" aria-hidden="true"></div>'}
    <div class="row"><button class="btn" data-act="del-cancel"${busy ? ' disabled' : ''}>No</button><button class="btn go" data-act="del-confirm"${busy ? ' disabled' : ''}>${busy ? 'Deleting…' : 'Yes, delete'}</button></div></div></div>`;
}
