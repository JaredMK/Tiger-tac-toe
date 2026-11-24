'use strict';
// The copy of the game inside the Xcode project: ios/App/web.nosync/public, which is the folder the project puts in the app
// (scripts/ios-setup.js). Run by every `npx cap copy` and `npx cap sync` (package.json's capacitor:copy:after), never by hand.
// Not Capacitor's own ios/App/App/public: the project sits in iCloud Drive (~/Documents), and iCloud put an old build back
// there seconds after a new one was written (November 2026: the 3 November game, on the phone for weeks). iCloud never touches
// a name ending in .nosync, so the build (_app.nosync) and this copy both end so, and Capacitor's own copy is removed.
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, '_app.nosync'), PUBLIC = path.join(ROOT, 'ios', 'App', 'web.nosync', 'public'), CAP_PUBLIC = path.join(ROOT, 'ios', 'App', 'App', 'public');
const CAP_FILES = ['cordova.js', 'cordova_plugins.js'];           // (empty: Capacitor's page loads them where they are)
function place(out, pub) {
  if (!fs.existsSync(path.join(out, 'index.html'))) throw new Error(`no build in ${out}: npm run ios:update makes one`);
  fs.rmSync(pub, { recursive: true, force: true });
  fs.cpSync(out, pub, { recursive: true });
  for (const f of CAP_FILES) fs.writeFileSync(path.join(pub, f), '');
}
module.exports = { OUT, PUBLIC, CAP_FILES, place };
if (require.main === module) {
  place(OUT, PUBLIC);
  try { fs.rmSync(CAP_PUBLIC, { recursive: true, force: true }); } catch (e) { /* (iCloud at it: nothing reads it) */ }
  console.log('The game placed in ios/App/web.nosync/public (out of iCloud\'s reach).');
}
