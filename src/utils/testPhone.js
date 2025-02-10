#!/usr/bin/env node
const { getPhoneNumbersWithStatus } = require('../database/pgsql');
const { preprocessPhoneNumbers, checkPhoneNumber } = require('./phone-check');

async function runPhoneCheck(phoneNumberToCheck) {
  try {
    const phoneNumbersFromDB = await getPhoneNumbersWithStatus();
    const phoneNumberMap = preprocessPhoneNumbers(phoneNumbersFromDB);
    const result = checkPhoneNumber(phoneNumberMap, phoneNumberToCheck);
    console.log(`Result for phone number ${phoneNumberToCheck}:`, result);
  } catch (err) {
    console.error("Error running phone check:", err);
  }
}

const phoneNumberArg = process.argv[2];
if (!phoneNumberArg) {
  console.error("Usage: node phoneCheckRunner.js <phone_number>");
  process.exit(1);
}

runPhoneCheck(phoneNumberArg);
