#!/usr/bin/node
'use strict';

const Gpio = require('onoff').Gpio; //require onoff to control GPIO
const RelayPin = new Gpio(18, 'out'); //declare GPIO5, the muxpin as an output


function on() {
	RelayPin.writeSync(1);
}

function off() {
	RelayPin.writeSync(0);
}



setTimeout(on,1000);
setTimeout(off,2000);
setTimeout(on,3000);
setTimeout(off,4000);
