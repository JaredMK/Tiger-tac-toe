'use strict';
// Every step from the web files to an Xcode project that is ready to run or archive (docs/ios-plan.md), the same each time:
//   1. npm run build:app: the web files into _app/ (the Firebase SDK is copied in, so this needs the network),
//   2. npx cap add ios, the first time only,
//   3. scripts/ios-setup.js: signing, entitlements, the Firebase plist, icon, launch screen,
//   4. npx cap sync ios: the web files and the plugins into the project.
//   npm run ios:build [-- production|staging] [--open] [--run] [--build N] [--plists DIR]
// production (the default) is the build for TestFlight and the App Store; staging talks to the staging project (a tester's
// build of the staging site's game). --open opens the project in Xcode after; --run runs it in the iOS Simulator (npx cap run).
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2), env = args.includes('staging') ? 'staging' : 'production';
const opt = k => { const i = args.indexOf(k); return i >= 0 ? ` ${k} ${args[i + 1]}` : ''; };
const run = cmd => { console.log(`\n$ ${cmd}`); execSync(cmd, { cwd: ROOT, stdio: 'inherit' }); };
if (!fs.existsSync(path.join(ROOT, 'node_modules', '@capacitor', 'ios'))) run('npm ci');
run(`node scripts/build-app.js ${env}`);
if (!fs.existsSync(path.join(ROOT, 'ios', 'App', 'App.xcodeproj'))) run('npx cap add ios');
run(`node scripts/ios-setup.js ${env}${opt('--build')}${opt('--plists')}`);
run('npx cap sync ios');
console.log(`\nThe ${env} app is ready in ios/App (open it with: npx cap open ios).`);
if (args.includes('--open')) run('npx cap open ios');
if (args.includes('--run')) run('npx cap run ios');
