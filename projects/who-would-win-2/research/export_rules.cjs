'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { DIMENSIONS, STAGES, TERRAIN, CLASSIC_DIMENSIONS } = require('../web/engine.js');
require('../web/roster.js');
fs.writeFileSync(path.join(__dirname, 'rules.json'), JSON.stringify({
  dimensions: DIMENSIONS, classicDimensions: CLASSIC_DIMENSIONS,
  stages: STAGES, terrain: TERRAIN, roster: globalThis.FightRoster
}) + '\n');
