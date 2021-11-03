#!/usr/bin/node
'use strict';

const sensor = require('ds18b20-raspi');




function printTemp() {
  console.log(`${sensor.readSimpleF()} deg`);
}

setInterval(printTemp,1000);
