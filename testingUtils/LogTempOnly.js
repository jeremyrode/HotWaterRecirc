#!/usr/bin/node
'use strict';

const Sensor = require('ds18b20-raspi');
const Gpio = require('onoff').Gpio; //require onoff to control GPIO
const RelayPin = new Gpio(18, 'out');
const FlowSensor = new Gpio(5, 'in', 'both');
const fs = require('fs');
const LOG_FILE = '/home/pi/TempLog.txt';
let logfile = fs.createWriteStream(LOG_FILE, {flags:'a'});

let lastTime = 0;
let curFreq = 0;


function logTemp() {
	const curTemp = Sensor.readSimpleF();
	const state = RelayPin.readSync();
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

logStart();
//setInterval(toggleRelay,60*60*1000); //Toggle The relay every hour
setInterval(logTemp,10000); //Log Temp every 10 sec



FlowSensor.watch((err, value) => {
  if (err) {
    throw err;
  }
	let curTime = Date.now();
	curFreq = curFreq * 0.9 + 100 / (curTime - lastTime);
	lastTime = curTime;
	console.log(curFreq);
});


process.on('SIGINT', _ => {
  FlowSensor.unexport();
	process.exit();
});
