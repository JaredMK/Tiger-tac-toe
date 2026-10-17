'use strict';
// The physics for the tests (Mini Golf, Pool, Bowling, Pinball): the page's module, on Matter.js from npm.
module.exports = require('../src/games/shared/physics-sim.js').makePhysics(require('matter-js'));
