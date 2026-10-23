'use strict';
// src/env.js (the page's plain script that picks the Firebase project by address) for Node: the scripts and tests
// read the same configs and the same choice the page makes. (src/ is ES modules to Node, so it is run here, not required.)
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const m = { exports: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'env.js'), 'utf8'), { module: m });
module.exports = m.exports;   // { pick, CONFIGS, PRODUCTION_HOSTS }
