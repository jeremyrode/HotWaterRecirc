#!/usr/bin/node
'use strict';

const Sensor = require('ds18b20-raspi');
const Gpio = require('onoff').Gpio; //require onoff to control GPIO
const RelayPin = new Gpio(18, 'out'); //declare GPIO5, the muxpin as an output
const fs = require('fs');
const LOG_FILE = '/home/pi/TempLog.txt';
let logfile = fs.createWriteStream(LOG_FILE, {flags:'a'});
let state = false;

function toggleRelay() {
	if (state) {
		RelayPin.writeSync(0);
		state = false;
		console.log('Relay Off');
	}
	else {
		RelayPin.writeSync(1);
		state = true;
		console.log('Relay On');
	}
}

function logTemp() {
	const curTemp = Sensor.readSimpleF();
  const curDate = new Date();
  const dateStr = curDate.toString();
  console.log(dateStr.slice(0,dateStr.length-31) + ' is ' + curTemp + 'F Pump: ' + state); //Prepend Time to message
  logfile.write(curDate/1000 + ',' + curTemp + ',' + state + '\n'); //Posix Time
}

function logStart() {
	const curDate = new Date();
	const message = 'New Session at ' + curDate.toString();
	console.log(message);
	logfile.write(message + '\n')
}

RelayPin.writeSync(0); //Make sure we're off
logStart();
//setInterval(toggleRelay,60*60*1000); //Toggle The relay every hour
setInterval(logTemp,10000); //Log Temp every 10 sec
