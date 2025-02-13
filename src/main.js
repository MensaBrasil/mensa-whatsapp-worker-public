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
const modes = { '--add': 'Add', '--remove': 'Remove', '--scan': 'Scan', '--report': 'Report', '--fetch': 'Fetch Messages' };
const selected = Object.entries(modes).reduce((acc, [flag, name]) => process.argv.includes(flag) ? acc.concat(name) : acc, []);

const addMode = process.argv.includes('--add');
const removeMode = process.argv.includes('--remove');
const scanMode = process.argv.includes('--scan');
const reportMode = process.argv.includes('--report');
const fetchMessagesMode = process.argv.includes('--fetch');

if (!selected.length) {
    console.log("You should select at least 1 service. Exiting...\nPlease choose from " + Object.keys(modes).join(', '));
    process.exit(1);
}

console.log("Services selected:", selected.join(', '));

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
client.on('ready', async () => {

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
