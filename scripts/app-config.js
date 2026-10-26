'use strict';
// The iOS app's identity (docs/ios-plan.md): its Apple Developer Team ID and its bundle ID, once they exist. While either
// is empty nothing app-specific is published. With both set, every site build (scripts/build-site.js) serves the Universal
// Links file, /.well-known/apple-app-site-association, so tictacchaos.com/?room=CODE (and the alert's ?play=find) open the
// app where it is installed, and the page where it is not; scripts/build-app.js writes the same ids into the app's files.
module.exports = {
  teamId: '',            // e.g. 'A1B2C3D4E5' (developer.apple.com → Membership details)
  bundleId: '',          // e.g. 'com.example.tictacchaos' (chosen once, in App Store Connect; never changes after the first upload)
};
