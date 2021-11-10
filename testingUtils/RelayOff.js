#!/usr/bin/node
'use strict';

const Gpio = require('onoff').Gpio; //require onoff to control GPIO
const RelayPin = new Gpio(18, 'out'); //declare GPIO5, the muxpin as an output

RelayPin.writeSync(0);
