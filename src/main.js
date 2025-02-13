// Imports
const { preprocessPhoneNumbers, checkPhoneNumber } = require('./utils/phone-check');
const fetchMessagesFromGroups = require('./core/fetchMessagesMode');
const { getPhoneNumbersWithStatus } = require('./database/pgsql');
const removeMembersFromGroups = require('./core/removeMode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const reportMembersInfo = require('./core/reportMode');
const addMembersToGroups = require('./core/addMode');
const scanGroups = require('./core/scanMode');
const qrcode = require('qrcode-terminal');

// Global error handler
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
});

// Cli args
const addMode = process.argv.includes('--add');
const removeMode = process.argv.includes('--remove');
const scanMode = process.argv.includes('--scan');
const reportMode = process.argv.includes('--report');
const fetchMessagesMode = process.argv.includes('--fetch');

if ([addMode, removeMode, scanMode, reportMode, fetchMessagesMode].filter(Boolean).length < 1) {
    console.log("\x1b[0mYou should select at least 1 service. Exiting...\x1b[97m\nPlease chose from \x1b[32m--add\x1b[0m, \x1b[31m--remove\x1b[0m, \x1b[33m--add-remove\x1b[0m, \x1b[93m--scan\x1b[0m, \x1b[94m--report\x1b[0m, \x1b[96m--fetch\x1b[0m");
    process.exit(1);
}

const selectedModes = [];
if (addMode) selectedModes.push('\x1b[32mAdd\x1b[0m');
if (removeMode) selectedModes.push('\x1b[31mRemove\x1b[0m');
if (scanMode) selectedModes.push('\x1b[93mScan\x1b[0m');
if (reportMode) selectedModes.push('\x1b[94mReport\x1b[0m');
if (fetchMessagesMode) selectedModes.push('\x1b[96mFetch Messages\x1b[0m');

console.log("\x1b[97mServices selected: \x1b[0m", selectedModes.join(', '));

// Initialize client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: "new",
        args: ["--no-sandbox", '--disable-setuid-sandbox', "--disable-gpu"],
        protocolTimeout: 1200000
    }
});

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.initialize();

// Main loop
client.once('ready', async () => {

    client.setAutoDownloadDocuments(false)
    client.setAutoDownloadAudio(false)
    client.setAutoDownloadPhotos(false)
    client.setAutoDownloadVideos(false)

    console.log('Client is ready!');

    // Initial Setup
    const chats = await client.getChats();
    const groups = chats.filter(chat => chat.isGroup && !chat.isReadOnly);
    const groupNames = groups.map(group => group.name);
    const groupIds = groups.map(group => group.id._serialized);

    if ((chats.length == 0) || (groups.length == 0)) {
        console.log('No groups found. Exiting.');
        process.exit(1);
    }

    await saveGroupsToList(groupNames, groupIds);
    console.log(`Total chats retrieved: ${chats.length}`);
    console.log(`Groups retrieved: ${groups.length}`);

    // Initial checks
    const phoneNumbersFromDB = preprocessPhoneNumbers(await getPhoneNumbersWithStatus());
    if (phoneNumbersFromDB.length === 0) {
        console.log('No phone numbers found in the database. Exiting.');
        process.exit(1);
    }

    const checkResult = checkPhoneNumber(phoneNumbersFromDB, '447474660572');
    if (!checkResult.found) {
        console.log('Number 447474660572 not found in the database. Sanity check failed. Exiting.');
        process.exit(1);
    }

    if (scanMode) {
        console.log('Scanning groups...');
        await scanGroups(client, groupNames, phoneNumbersFromDB);
    }

    if (reportMode) {
        await reportMembersInfo(client, chats, groupNames, phoneNumbersFromDB);
    }

    if (fetchMessagesMode) {
        console.log('Fetching messages...');
        await fetchMessagesFromGroups(client, groupNames, phoneNumbersFromDB);
    }

    if (addMode) {
        console.log('Adding members...');
        await addMembersToGroups(client, chats, groupNames);
    }

    if (removeMode) {
        console.log('Removing members...');
        await removeMembersFromGroups(client, groupNames, phoneNumbersFromDB);
    }

    console.log("All tasks completed. Exiting...");
    process.exit(0);

});
