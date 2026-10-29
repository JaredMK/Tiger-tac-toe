'use strict';
// The iOS project's own settings (docs/ios-plan.md), applied to what `npx cap add ios` generated, the same every time
// (run by `npm run ios:build`; safe to run again). Plain files only (no Xcode, no network), so it can be checked anywhere:
//   - signing: the team, the bundle ID, automatic signing, the marketing version (CLIENT_VERSION) and a build number,
//   - the entitlements file: Sign in with Apple and the Associated Domains (Universal Links) for tictacchaos.com and staging,
//   - the Firebase config for the build: GoogleService-Info.plist (production or staging) copied in and put in the app's
//     resources, with its REVERSED_CLIENT_ID as the Google sign-in URL scheme in Info.plist,
//   - Info.plist: arm64 only, no export-compliance question (the app uses only the system's encryption), the URL scheme,
//   - the app icon and the launch screen from `npm run app-icons` (assets/app/), the launch background the game's cream,
//   - AppDelegate: the ambient audio session (the silent switch mutes the game, as in a web page).
//   node scripts/ios-setup.js [production|staging] [--build N] [--plists DIR]
// The Firebase config files are not in the repository (ios-config/ is ignored): they are looked for in --plists, $IOS_PLIST_DIR,
// ios-config/, ~/Desktop/ttc-ios/ and ~/Downloads/, as GoogleService-Info.production.plist / .staging.plist, or the names
// Firebase gives them (GoogleService-Info.plist for production, "GoogleService-Info staging.plist" for staging).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ROOT = path.join(__dirname, '..'), IOS = path.join(ROOT, 'ios', 'App'), APP = path.join(IOS, 'App');
const PBX = path.join(IOS, 'App.xcodeproj', 'project.pbxproj');
const cfg = require('./app-config.js');
const BEGIN = '<!-- ttc-ios-setup:begin -->', END = '<!-- ttc-ios-setup:end -->';
const rd = f => fs.readFileSync(f, 'utf8'), wr = (f, s) => fs.writeFileSync(f, s);
const log = m => console.log('  ' + m);

function die(m) { console.error('ios-setup: ' + m); process.exit(1); }
function plistValue(xml, key) { const m = xml.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`)); return m ? m[1] : null; }

// The Firebase config for this build.
function findPlist(env, dirs) {
  const names = env === 'staging' ? ['GoogleService-Info.staging.plist', 'GoogleService-Info staging.plist', 'GoogleService-Info-staging.plist', 'GoogleService-Info_staging.plist']
    : ['GoogleService-Info.production.plist', 'GoogleService-Info.plist'];
  for (const d of dirs) for (const n of names) { const f = path.join(d, n); if (fs.existsSync(f)) return f; }
  return null;
}
function firebasePlist(env, extraDir) {
  const dirs = [extraDir, process.env.IOS_PLIST_DIR, path.join(ROOT, 'ios-config'), path.join(os.homedir(), 'Desktop', 'ttc-ios'), path.join(os.homedir(), 'Downloads')].filter(Boolean);
  const f = findPlist(env, dirs);
  if (!f) die(`no GoogleService-Info plist for ${env}: put it in ios-config/ (GoogleService-Info.${env}.plist) or pass --plists DIR (looked in ${dirs.join(', ')})`);
  const xml = rd(f), want = env === 'staging' ? 'tic-tac-chaos-staging' : 'tic-tac-chaos';
  if (plistValue(xml, 'BUNDLE_ID') !== cfg.bundleId) die(`${f} is for the bundle ID ${plistValue(xml, 'BUNDLE_ID')}, not ${cfg.bundleId}: add the iOS app with that bundle ID in the Firebase console and download its plist again`);
  if (plistValue(xml, 'PROJECT_ID') !== want) die(`${f} is for the project ${plistValue(xml, 'PROJECT_ID')}, not ${want}`);
  const rev = plistValue(xml, 'REVERSED_CLIENT_ID');
  if (!rev) die(`${f} has no REVERSED_CLIENT_ID: enable Google sign-in in the Firebase console, then download the plist again`);
  return { file: f, reversed: rev, project: want };
}

// ---- Info.plist
function infoPlist(reversed) {
  const p = path.join(APP, 'Info.plist');
  let s = rd(p);
  s = s.replace(new RegExp(`\\s*${BEGIN}[\\s\\S]*?${END}`), '');
  s = s.replace(/<string>armv7<\/string>/, '<string>arm64</string>');
  const block = `
	${BEGIN}
	<key>CFBundleURLTypes</key>
	<array>
		<dict>
			<key>CFBundleTypeRole</key>
			<string>Editor</string>
			<key>CFBundleURLName</key>
			<string>google-sign-in</string>
			<key>CFBundleURLSchemes</key>
			<array>
				<string>${reversed}</string>
			</array>
		</dict>
	</array>
	<key>ITSAppUsesNonExemptEncryption</key>
	<false/>
	${END}`;
  s = s.replace(/\n<\/dict>\s*<\/plist>\s*$/, `${block}\n</dict>\n</plist>\n`);
  if (!s.includes(reversed)) die('could not write the URL scheme into Info.plist');
  wr(p, s);
  log(`Info.plist: URL scheme ${reversed}, arm64, no export-compliance question`);
}

// ---- Entitlements
function entitlements() {
  wr(path.join(APP, 'App.entitlements'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>com.apple.developer.applesignin</key>
	<array>
		<string>Default</string>
	</array>
	<key>com.apple.developer.associated-domains</key>
	<array>
		<string>applinks:tictacchaos.com</string>
		<string>applinks:staging.tictacchaos.com</string>
	</array>
</dict>
</plist>
`);
  log('App.entitlements: Sign in with Apple, applinks:tictacchaos.com and applinks:staging.tictacchaos.com');
}

// ---- the Xcode project (project.pbxproj): the two files it must know, the signing and version settings
const ID = { plistRef: '5A0F1A00C0DE0000000F0001', plistBuild: '5A0F1A00C0DE0000000F0002', entRef: '5A0F1A00C0DE0000000F0003' };
function clientVersion() {
  const m = rd(path.join(ROOT, 'src', 'core', 'client.js')).match(/CLIENT_VERSION = '(\d+(?:\.\d+){0,2})'/);
  if (!m) die('CLIENT_VERSION not found in src/core/client.js');
  return m[1];
}
function project(build) {
  let s = rd(PBX);
  const add = (marker, section, line) => { if (!s.includes(line.split(' ')[0].trim())) { const at = s.indexOf(marker); if (at < 0) die(`project.pbxproj: no ${marker}`); s = s.slice(0, at + marker.length) + '\n' + line + s.slice(at + marker.length); } };
  add('/* Begin PBXBuildFile section */', 'build', `\t\t${ID.plistBuild} /* GoogleService-Info.plist in Resources */ = {isa = PBXBuildFile; fileRef = ${ID.plistRef} /* GoogleService-Info.plist */; };`);
  add('/* Begin PBXFileReference section */', 'ref', `\t\t${ID.plistRef} /* GoogleService-Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = "GoogleService-Info.plist"; sourceTree = "<group>"; };`);
  add('/* Begin PBXFileReference section */', 'ref', `\t\t${ID.entRef} /* App.entitlements */ = {isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = App.entitlements; sourceTree = "<group>"; };`);
  // the App group's children, and the Resources build phase's files
  const grp = s.match(/(504EC3061FED79650016851F \/\* App \*\/ = \{\s*isa = PBXGroup;\s*children = \(\n)/);
  if (!grp) die('project.pbxproj: the App group was not found');
  for (const [id, name] of [[ID.plistRef, 'GoogleService-Info.plist'], [ID.entRef, 'App.entitlements']]) if (!s.includes(`${id} /* ${name} */,`)) s = s.replace(grp[1], `${grp[1]}\t\t\t\t${id} /* ${name} */,\n`);
  const res = s.match(/(\/\* Resources \*\/ = \{\s*isa = PBXResourcesBuildPhase;[\s\S]*?files = \(\n)/);
  if (!res) die('project.pbxproj: the Resources build phase was not found');
  if (!s.includes(`${ID.plistBuild} /* GoogleService-Info.plist in Resources */,`)) s = s.replace(res[1], `${res[1]}\t\t\t\t${ID.plistBuild} /* GoogleService-Info.plist in Resources */,\n`);
  // signing and versions, in the app target's two configurations (Debug, Release): the ones that name PRODUCT_BUNDLE_IDENTIFIER
  const settings = { CODE_SIGN_ENTITLEMENTS: 'App/App.entitlements', DEVELOPMENT_TEAM: cfg.teamId, CODE_SIGN_STYLE: 'Automatic', PRODUCT_BUNDLE_IDENTIFIER: cfg.bundleId, MARKETING_VERSION: clientVersion(), CURRENT_PROJECT_VERSION: String(build) };
  let n = 0;
  s = s.replace(/(buildSettings = \{\n)((?:(?!\n\t\t\t\};)[\s\S])*?PRODUCT_BUNDLE_IDENTIFIER[\s\S]*?\n)(\t\t\t\};)/g, (m, a, body, z) => {
    n++;
    for (const [k, v] of Object.entries(settings)) {
      const line = `\t\t\t\t${k} = ${/[^\w./-]/.test(v) ? `"${v}"` : v};\n`;
      body = new RegExp(`\\t\\t\\t\\t${k} = [^\\n]*;\\n`).test(body) ? body.replace(new RegExp(`\\t\\t\\t\\t${k} = [^\\n]*;\\n`), line) : body + line;
    }
    return a + body + z;
  });
  if (n !== 2) die(`project.pbxproj: expected the app target's 2 build configurations, found ${n}`);
  wr(PBX, s);
  log(`project: team ${cfg.teamId}, ${cfg.bundleId}, automatic signing, version ${settings.MARKETING_VERSION} (${build}), entitlements, GoogleService-Info.plist in the resources`);
}

// ---- icon and launch screen
function art() {
  const icon = path.join(ROOT, 'assets', 'app', 'icon-1024.png'), launch = path.join(ROOT, 'assets', 'app', 'launch-2048.png');
  for (const f of [icon, launch]) if (!fs.existsSync(f)) die(`${f} is missing: run npm run app-icons`);
  const set = path.join(APP, 'Assets.xcassets', 'AppIcon.appiconset');
  fs.copyFileSync(icon, path.join(set, 'AppIcon-512@2x.png'));          // (the template's one slot, Single Size, now the game's icon)
  const splash = path.join(APP, 'Assets.xcassets', 'Splash.imageset');
  for (const f of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) fs.copyFileSync(launch, path.join(splash, f));
  const sb = path.join(APP, 'Base.lproj', 'LaunchScreen.storyboard');
  let s = rd(sb);
  s = s.replace('contentMode="scaleAspectFill"', 'contentMode="scaleAspectFit"');                          // (the whole picture, its cream edges all round)
  s = s.replace('<color key="backgroundColor" systemColor="systemBackgroundColor"/>', '<color key="backgroundColor" red="0.9568627450980393" green="0.9019607843137255" blue="0.7843137254901961" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>');   // #f4e6c8
  wr(sb, s);
  log('icon (Single Size 1024) and launch screen (cream, picture fitted) from assets/app/');
}

// ---- AppDelegate: the ambient audio session
function appDelegate() {
  const p = path.join(APP, 'AppDelegate.swift');
  let s = rd(p);
  if (s.includes('AVAudioSession')) return;
  s = s.replace('import Capacitor\n', 'import Capacitor\nimport AVFoundation\n');
  s = s.replace('        // Override point for customization after application launch.\n', '        // The game\'s sound is ambient: it mixes with other audio and the silent switch mutes it, as in a web page.\n        try? AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default, options: [.mixWithOthers])\n        try? AVAudioSession.sharedInstance().setActive(true)\n');
  if (!s.includes('AVAudioSession')) die('AppDelegate.swift: the didFinishLaunching override point was not found');
  wr(p, s);
  log('AppDelegate: ambient audio session');
}

function main() {
  const args = process.argv.slice(2), env = args.includes('staging') ? 'staging' : 'production';
  const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  if (!cfg.teamId || !cfg.bundleId) die('scripts/app-config.js needs the teamId and the bundleId');
  if (!fs.existsSync(PBX)) die('no ios/ project: run `npx cap add ios` first (npm run ios:build does)');
  const build = Number(opt('--build') || process.env.IOS_BUILD || new Date().toISOString().replace(/\D/g, '').slice(2, 12));   // (YYMMDDHHMM: rises with every build, as App Store Connect asks)
  if (!Number.isInteger(build) || build < 1) die('--build must be a whole number');
  console.log(`ios-setup (${env}):`);
  const fb = firebasePlist(env, opt('--plists'));
  fs.copyFileSync(fb.file, path.join(APP, 'GoogleService-Info.plist'));
  log(`GoogleService-Info.plist: ${path.basename(fb.file)} (project ${fb.project})`);
  infoPlist(fb.reversed); entitlements(); project(build); art(); appDelegate();
}
if (require.main === module) main();
module.exports = { plistValue, findPlist };
