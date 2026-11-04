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
