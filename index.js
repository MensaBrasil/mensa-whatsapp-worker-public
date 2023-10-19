const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { printChats, getGroupParticipants, getGroupIdByName, removeParticipantByPhoneNumber, sendMessageToNumber, sendMessageToNumberAPI } = require('./chat');
const fs = require('fs');
const checkPhoneNumber = require('./phone-check');
const { ObjectId } = require('mongodb');
const { isMessageAlreadySent, saveMessageToMongoDB } = require('./mongo');
const MongoClient = require('mongodb').MongoClient;
const { getInactiveMessage, getNotFoundMessage } = require('./messages');
const dfd = require("danfojs-node");
const { getPhoneNumbersWithStatus } = require('./pgsql'); // Renamed function

require('dotenv').config();

const username = encodeURIComponent(process.env.DB_USER);
const password = encodeURIComponent(process.env.DB_PASS);
const dbName = process.env.DB_NAME;
const dbHost = process.env.DB_HOST;

const uri = `mongodb+srv://${username}:${password}@${dbHost}/${dbName}`;

const clientMongo = new MongoClient(uri, { useUnifiedTopology: true });

(async () => {
    try {
        await clientMongo.connect();
        console.log('Connected to MongoDB successfully!');
    } catch (err) {
        console.error('Error connecting to MongoDB:', err);
    }
})();

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

// Helper function to introduce a delay
function getRandomDelay(baseDelay) {
    // Calculate the random variation as 20% of the baseDelay
    const variation = baseDelay * 0.3;
    // Generate a random number between -variation and variation
    const randomDelay = Math.random() * (2 * variation) - variation;
    // Add the randomDelay to the baseDelay
    const totalDelay = baseDelay + randomDelay;

    return totalDelay;
}

function delay(ms) {
    const totalDelay = getRandomDelay(ms);
    return new Promise(resolve => setTimeout(resolve, totalDelay));
}



const groupNames = process.env.GROUP_NAMES.split("','").map(name => name.replace(/^'|'$/g, ''));

const scanMode = process.argv[2] === '--scan';
//if scan, warn on console. if not, warn too
if (scanMode) {
    console.log('Scan mode enabled. No changes will be made to the groups.');
} else {
    console.log('!!!!!!Scan mode DISABLED. Changes will be made to the groups.!!!!!!!');
}
//const groupNames = ['MB | Coordenação Nacional'];


client.on('ready', async () => {
    console.log('Client is ready!');
    //await sendMessageToNumberAPI(client, "553189629302", "naoencontradoremovido");
    //await sendMessageToNumberAPI(client, "553189629302", "membroinativo");
    //await delay(20000)
    // Retrieve active phone numbers from PostgreSQL
    const phoneNumbersFromDB = await getPhoneNumbersWithStatus(); // Fetch from PostgreSQL

    // Create a map for easy lookup
    const phoneStatusMap = {};
    phoneNumbersFromDB.forEach(row => {
        phoneStatusMap[row.phone_number] = row.status;
    });
    //get list of all groups im in
    const chats = await client.getChats();
    const groups = chats.filter(chat => chat.isGroup);
    const groupNames = groups.map(group => group.name);

    for (const groupName of groupNames) {
        console.log(`Processing group: ${groupName}`);
        try {
            const groupId = await getGroupIdByName(client, groupName);
            const participants = await getGroupParticipants(client, groupId);
            const groupMembers = await participants.map(participant => participant.phone);
            const phoneNumbersFromDB = await getPhoneNumbersWithStatus();

for (const member of groupMembers) {
    const checkResult = checkPhoneNumber(phoneNumbersFromDB, member);
    // using table member_groups, compare current members with previous ones from postgres, and register modifications. Columns are registration_id, phone_number, group_name, entry_date, exit_date, status
    
    if (!checkResult.found) {
        if (member === '447810094555' || member === '4915122324805' || member === '62999552046' || member === '15142676652' || member === '556296462065' && member === "556299552046") {
            continue;
        }
        console.log(`Number ${member} not found in the database.`);
        if (!scan) {
            await delay(120000);
            await removeParticipantByPhoneNumber(client, groupId, member);
            //await sendMessageToNumberAPI(client, member, getNotFoundMessage());
            await saveMessageToMongoDB(clientMongo, dbName, 'notfound', checkResult.mb, member, groupName);
        }
    } else if (checkResult.status === 'Inactive') {
        console.log(`Number ${member} is inactive.`);
        if (!scan) {
            await delay(120000);
            await removeParticipantByPhoneNumber(client, groupId, member);
            //await sendMessageToNumberAPI(client, member, getInactiveMessage());
            await saveMessageToMongoDB(clientMongo, dbName, 'inactive', checkResult.mb, member, groupName);
        }
    }
}
            console.log(`Finished processing group: ${groupName}`);
        } catch (error) {
            console.error(`Error processing group ${groupName}:`, error);
        }
    }
    console.log('All groups processed!');
});





client.initialize();

process.on('SIGINT', async () => {
    try {
        await clientMongo.close();
        console.log('Disconnected from MongoDB.');
        process.exit(0);
    } catch (err) {
        console.error('Error closing MongoDB connection:', err);
        process.exit(1);
    }
});
