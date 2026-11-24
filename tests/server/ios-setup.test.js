'use strict';
// The iOS project file (scripts/ios-setup.js projectText): the Firebase config file whole in it, its file reference,
// its place in the App group and in the app's resources. Its reference was once left out (the "already there?" check
// matched the build file naming it), so Xcode built the app without GoogleService-Info.plist and native Google
// sign-in said "provider is not enabled" (November 2026). The committed project is held to it too.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { projectText } = require('../../scripts/ios-setup.js');

const PBX = path.join(__dirname, '..', '..', 'ios', 'App', 'App.xcodeproj', 'project.pbxproj');
const REF = '5A0F1A00C0DE0000000F0001 /* GoogleService-Info.plist */ = {isa = PBXFileReference;';
const BUILD = '5A0F1A00C0DE0000000F0002 /* GoogleService-Info.plist in Resources */ = {isa = PBXBuildFile;';
const committed = fs.readFileSync(PBX, 'utf8');
const without = s => s.split('\n').filter(l => !/5A0F1A00C0DE0000000F000[12]/.test(l)).join('\n');   // the project before the plist was added

test('ios-setup: the plist goes in whole (reference, App group, resources), from a project without it', () => {
  const s = projectText(without(committed), 7);
  assert.ok(s.includes(REF), 'its file reference');
  assert.ok(s.includes(BUILD), 'its build file');
  assert.ok(s.includes('5A0F1A00C0DE0000000F0001 /* GoogleService-Info.plist */,'), 'in the App group');
  assert.ok(s.includes('5A0F1A00C0DE0000000F0002 /* GoogleService-Info.plist in Resources */,'), 'in the resources');
});
test('ios-setup: a project with the build file but not the reference (the old bug) gets the reference', () => {
  const broken = committed.split('\n').filter(l => !l.includes(REF)).join('\n');
  assert.ok(!broken.includes(REF));
  assert.ok(projectText(broken, 7).includes(REF));
});
test('ios-setup: run twice, the same project (nothing doubled)', () => {
  const once = projectText(without(committed), 7);
  assert.equal(projectText(once, 7), once);
  assert.equal(once.split(REF).length, 2, 'one reference');
});
test('ios-setup: the committed project has the plist whole', () => {
  for (const t of [REF, BUILD, '5A0F1A00C0DE0000000F0001 /* GoogleService-Info.plist */,', '5A0F1A00C0DE0000000F0002 /* GoogleService-Info.plist in Resources */,']) assert.ok(committed.includes(t), t);
});

// The December 2026 iOS audit: the committed project is the current client's (its marketing version is CLIENT_VERSION,
// docs/ios-plan.md), the app is always light (the page is a light one: in Dark Mode the status bar's text would turn white
// over the cream), the web view's own background is the game's cream (no white flash between the launch screen and the
// page), the app is iPhone only and portrait only (December 2026: no iPad build for the first App Store release; an iPad
// runs the iPhone app, portrait too), and the launch screen's picture is the one npm run app-icons draws (the Comic Chaos logo).
test('the committed iOS project: the client\'s version, light appearance, the cream web view, portrait on iPhone, the launch art', () => {
  const root = path.join(__dirname, '..', '..');
  const v = fs.readFileSync(path.join(root, 'src', 'core', 'client.js'), 'utf8').match(/CLIENT_VERSION = '([\d.]+)'/)[1];
  const mv = [...committed.matchAll(/MARKETING_VERSION = ([\d.]+);/g)].map(m => m[1]);
  assert.deepEqual(mv, [v, v], 'MARKETING_VERSION is CLIENT_VERSION in both configurations');
  const info = fs.readFileSync(path.join(root, 'ios', 'App', 'App', 'Info.plist'), 'utf8');
  assert.match(info, /<key>UIUserInterfaceStyle<\/key>\s*<string>Light<\/string>/);
  assert.match(info, /<key>UISupportedInterfaceOrientations<\/key>\s*<array>\s*<string>UIInterfaceOrientationPortrait<\/string>\s*<\/array>/, 'an iPhone: portrait alone');
  assert.equal((info.match(/<key>UISupportedInterfaceOrientations~ipad<\/key>\s*<array>([\s\S]*?)<\/array>/)[1].match(/<string>/g) || []).length, 1, 'an iPad runs the iPhone app: portrait too');
  assert.deepEqual([...committed.matchAll(/TARGETED_DEVICE_FAMILY = ([^;]+);/g)].map(m => m[1]), ['1', '1'], 'iPhone only, both configurations');
  assert.match(info, /<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/, 'no export-compliance question');
  assert.match(fs.readFileSync(path.join(root, 'scripts', 'ios-setup.js'), 'utf8'), /UIUserInterfaceStyle/, 'ios-setup writes it every build');
  const cap = JSON.parse(fs.readFileSync(path.join(root, 'capacitor.config.json'), 'utf8'));
  assert.equal(cap.ios.backgroundColor, '#f4e6c8'); assert.equal(cap.ios.contentInset, 'never'); assert.equal(cap.webDir, '_app.nosync');
  const launch = fs.readFileSync(path.join(root, 'assets', 'app', 'launch-2048.png'));
  for (const f of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) assert.ok(launch.equals(fs.readFileSync(path.join(root, 'ios', 'App', 'App', 'Assets.xcassets', 'Splash.imageset', f))), f + ' is the launch art');
  assert.ok(fs.readFileSync(path.join(root, 'assets', 'app', 'icon-1024.png')).equals(fs.readFileSync(path.join(root, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon-512@2x.png'))), 'the app icon is the Patchwork one');
});

// The app's privacy manifest (App Store Review: required): no tracking, every data type docs/app-privacy-labels.md says the
// code collects, each linked to the account, and the file whole in the project (reference, App group, Resources).
test('the privacy manifest: no tracking, the labels\' data types, in the app\'s resources', () => {
  const root = path.join(__dirname, '..', '..'), { privacyText, COLLECTED } = require('../../scripts/ios-setup.js');
  const xml = fs.readFileSync(path.join(root, 'ios', 'App', 'App', 'PrivacyInfo.xcprivacy'), 'utf8');
  assert.equal(xml, privacyText(), 'the committed manifest is the one ios-setup writes');
  assert.match(xml, /<key>NSPrivacyTracking<\/key>\s*<false\/>/);
  assert.doesNotMatch(xml, /<key>NSPrivacyCollectedDataTypeTracking<\/key>\s*<true\/>/, 'nothing collected for tracking');
  const labels = fs.readFileSync(path.join(root, 'docs', 'app-privacy-labels.md'), 'utf8');
  const named = { EmailAddress: 'Email Address', UserID: 'User ID', DeviceID: 'Device ID', GameplayContent: 'Gameplay Content', CustomerSupport: 'Customer Support', OtherUserContent: 'Other User Content', ProductInteraction: 'Product Interaction', OtherDiagnosticData: 'Other Diagnostic Data' };
  for (const [t] of COLLECTED) assert.match(labels, new RegExp('\\*\\*[^|]*' + named[t] + '\\*\\* \\| Yes'), t + ' is a Yes in the labels');
  for (const t of ['5A0F1A00C0DE0000000F0004 /* PrivacyInfo.xcprivacy */ = {isa = PBXFileReference;', '5A0F1A00C0DE0000000F0004 /* PrivacyInfo.xcprivacy */,', '5A0F1A00C0DE0000000F0005 /* PrivacyInfo.xcprivacy in Resources */,']) assert.ok(committed.includes(t), t);
});
