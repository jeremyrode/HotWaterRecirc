#!/usr/bin/node
'use strict';
const fs = require('fs');
const {google} = require('googleapis');
const {Gpio} = require('onoff'); //require onoff to control GPIO
const RelayPin = new Gpio(18, 'out'); //declare GPIO5, the muxpin as an output
const FlowSensor = new Gpio(5, 'in', 'rising');
const Sensor = require('ds18b20-raspi');

process.title = 'HotWaterRecircDaemon';

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
const TOKEN_PATH = '/home/pi/token.json';
const SECRET_PATH = '/home/pi/client_secret.json';
const ERR_LOG_FILE = '/home/pi/ErrLogRecirc.txt';
const TEMP_LOG_FILE = '/home/pi/TempValLogRecirc.txt';
const DEMAND_LOG_FILE = '/home/pi/DemandLogRecirc.txt';
const GOOGLE_CAL_ID = 'jecipp6euikf2bvk8m7rjn14co@group.calendar.google.com';
const CAL_UPDATE_INTERVAL = 120; //How often to poll Goolge canlendar In mins
const CAL_INTERVAL_OVERLAP = 1; //In mins to be sure we don't miss anything
const TEMP_UPDATE_INTERVAL = 10; //How often to run temp loop in seconds
const TEMP_HEATER_ON = 95; //temp threshold for heater running
const RECIRC_OFF_TO_ON_DELAY = 900000; //in milliseconds 15 mins
const TEMP_THRESHOLD_DELAY = 90000; //90 s
const PUMP_OFF_TO_FLOW_MONITOR_DELAY = 60000;
//Globals
let errorsInAPI = 0; //Counter to limit requests to Google
let calendarRequestedRecirc = false; //We are recirculating due to calendar
let pumpOnState = false;
let pumpOffTime = 0;
let lastTemp = 0;

process.on('SIGINT', _ => { //If interrupted, turn pump off
  RelayPin.writeSync(0);
  RelayPin.unexport();
  FlowSensor.unexport();
  process.exit();
});

// Log file for testing purposes
let errlogfile = fs.createWriteStream(ERR_LOG_FILE, {flags:'a'});
let templogfile = fs.createWriteStream(TEMP_LOG_FILE, {flags:'a'});
let demandlogfile = fs.createWriteStream(DEMAND_LOG_FILE, {flags:'a'});
//Main Loop, we don't actually need to be doing this when pump is off
function doTempLoop() {
	const curTemp = Sensor.readSimpleF();
  if (!pumpOnState) { //If the Pump is Off
    if (calendarRequestedRecirc && (pumpOffTime + RECIRC_OFF_TO_ON_DELAY < Date.now()) ) {
      combinedLog('Calendar Trigger');
      pumpOn(); //Calendar Trigger
    }
  } else if (curTemp < TEMP_HEATER_ON && lastTemp >= TEMP_HEATER_ON) { //Stop circ
    combinedLog('Falling Temp Threshold');
    pumpOff();
  }
  //Log and save temp
  templogfile.write(Date.now()/1000 + ',' + curTemp + ',' + pumpOnState + '\n'); //Posix Time
  lastTemp = curTemp;
}
// Error logging function
function combinedLog(message) {
  let curDate = new Date();
  let dateStr = curDate.toString();
  message = dateStr.slice(0,dateStr.length-31) + ':' + curDate.getMilliseconds() + ': ' + message; //Prepend Time to message
  console.log(message);
  errlogfile.write(message + '\n')
}
// Google Calendar Functions
function main(oAuth2Client) { //What to do after authentication
  planEvents(oAuth2Client); //Do a plan now
  setInterval(planEvents, CAL_UPDATE_INTERVAL*60000, oAuth2Client); //Replan
  setInterval(doTempLoop, TEMP_UPDATE_INTERVAL*1000); //Check the temp
  FlowSensor.watch(demandCallback);
  combinedLog('New Session');
}
// Load client secrets from a local file.
fs.readFile(SECRET_PATH, (err, clientSecret) => {
  if (err) {
    combinedLog('Error loading client secret file');
    return console.log('Error loading client secret file:', err);
  }
  // Authorize a client with credentials, then call the Google Calendar API.
  authorize(JSON.parse(clientSecret), main);
});
// Authorize a client with credentials, then call the Google Calendar API
function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) {
      combinedLog('Error loading OAuth Token');
      return console.log('Error loading OAuth Token:', err);
    }
    let parsedToken = JSON.parse(token);
    oAuth2Client.setCredentials(parsedToken);
    callback(oAuth2Client);
  });
}

function planEvents(auth) { //Plan out the current interval
  const calendar = google.calendar({version: 'v3', auth});
  const planStartDate = new Date;
  planStartDate.setSeconds(planStartDate.getSeconds() + 10); //Give us a ten sec delay for causality
  const planEndDate = new Date(planStartDate.getTime()); //Clone current time
  planEndDate.setMinutes(planStartDate.getMinutes() + CAL_UPDATE_INTERVAL + CAL_INTERVAL_OVERLAP); // Next interval
  calendar.events.list({
    calendarId: GOOGLE_CAL_ID,
    timeMin: planStartDate.toISOString(),
    timeMax: planEndDate.toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime',
  }, (err, res) => {
    if (err) {
      combinedLog('The Google API request returned an error: ' + err);
      errorsInAPI += 1;
      combinedLog('We have ' + errorsInAPI + ' running errors');
      if (errorsInAPI < 10) { //For now limit us to 10 extra requests
        setTimeout(planEvents,60000,auth); //Call ourself one min in the future
        combinedLog('Recall planEvents() in one min');
      }
      return; //don't plan
    }
    errorsInAPI = 0; //Reset error counter
    const events = res.data.items;
    //combinedLog('Got ' + events.length + ' events!' );
    for (let event of events) {
      const eventStart = new Date(event.start.dateTime);
      const eventEnd = new Date(event.end.dateTime);
      // Need to schedule here
      if ( eventStart >= planStartDate ) { //If the event starts after interval start, enable
        combinedLog('Enable Event Found at start: ' + eventStart.toString());
        setTimeout(enableCalendarDemand, eventStart - Date.now() )
      }
      if ( eventEnd <= planEndDate ) { //If the event ends before the interval end, disable
        combinedLog('Disable Event Found at end: ' + eventEnd.toString());
        setTimeout(disableCalendarDemand, eventEnd - Date.now() )
      }
    }
  });
}

// Worker Functions

function enableCalendarDemand() {
  calendarRequestedRecirc = true;
  combinedLog('Begin Calendar Demand');
}

function disableCalendarDemand() {
  calendarRequestedRecirc = false;
  combinedLog('End Calendar Demand');
}

function pumpOn() {
  FlowSensor.unwatch(); //No need to watch for flow anymore
  RelayPin.writeSync(1);
  pumpOnState = true;
  setTimeout(failedToMeetTemp,TEMP_THRESHOLD_DELAY); //If we don't make temp, go off
  combinedLog('Pump On');
}

function demandCallback(err, state) {
  combinedLog('Demand Trigger');
  demandlogfile.write(Date.now()/1000 + ',\n'); //Posix Time
  pumpOn(); //Demand Trigger
}

function watchForDemand() {
  FlowSensor.watch(demandCallback);
}

function pumpOff() {
  pumpOffTime = Date.now();
  RelayPin.writeSync(0);
  pumpOnState = false;
  setTimeout(watchForDemand,PUMP_OFF_TO_FLOW_MONITOR_DELAY); //don't look for flow right away
  combinedLog('Pump Off');
}

function failedToMeetTemp() {
  if (lastTemp < TEMP_HEATER_ON) {
    combinedLog('Trigger failed to meet threshold');
    pumpOff();
  }
}
