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

const {
    recordUserEntryToGroup,
    recordUserExitFromGroup,
    getPreviousGroupMembers
} = require('./pgsql');

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

// Groups where JB are alloweds
const jbGroupNames = [

    //TODO: Add JB groups here         <----------------------------------------------------

];


// Merge both lists og groups
const allGroupNames = groupNames.concat(jbGroupNames);



client.on('ready', async () => {
    console.log('Client is ready!');

    while (true) {
    const phoneNumbersFromDB = await getPhoneNumbersWithStatus();
    //sanity check. if no numbers, exit
    if (phoneNumbersFromDB.length === 0) {
        console.log('No phone numbers found in the database. Exiting.');
        process.exit(0);
    }

    const chats = await client.getChats();
    const groups = chats.filter(chat => chat.isGroup);
    const groupNames = groups.map(group => group.name);

   
        for (const groupName of groupNames) {
            console.log(`Processing group: ${groupName}`);
            const previousMembers = await getPreviousGroupMembers(groupName);

            try {
                const groupId = await getGroupIdByName(client, groupName);
                const participants = await getGroupParticipants(client, groupId);

                const groupMembers = participants.map(participant => participant.phone);

                for (const member of groupMembers) {
                    const checkResult = checkPhoneNumber(phoneNumbersFromDB, member);

                    if (checkResult.found) {
                        if (!previousMembers.includes(member)) {
                            await recordUserEntryToGroup(checkResult.mb, member, groupName, checkResult.status);
                        }

                        if (checkResult.status === 'Inactive') {
                            console.log(`Number ${member}, MB ${checkResult.mb} is inactive.`);
                            if (!scanMode) {
                                await delay(60000);
                                await removeParticipantByPhoneNumber(client, groupId, member);
                                await saveMessageToMongoDB(clientMongo, dbName, 'inactive', checkResult.mb, member, groupName);
                            }
                        }
                    } else {
                        console.log(`Number ${member} not found in the database.`);
                        if (!scanMode && member !== '447810094555' && member !== '4915122324805' && member !== '62999552046' && member !== '15142676652' && member !== "556299552046" && member !== '447810094555' && member != '555496875059') {
                            await delay(60000);
                            await removeParticipantByPhoneNumber(client, groupId, member);
                            await saveMessageToMongoDB(clientMongo, dbName, 'notfound', null, member, groupName);
                        }
                    }
                }
                const currentMembers = groupMembers.filter(member => checkPhoneNumber(phoneNumbersFromDB, member).found);
                for (const previousMember of previousMembers) {
                    if (!currentMembers.includes(previousMember)) {
                        await recordUserExitFromGroup(previousMember, groupName);
                    }
                }


                console.log(`Finished processing group: ${groupName}`);
            } catch (error) {
                console.error(`Error processing group ${groupName}:`, error);
            }
            delay(10000);
        }
        console.log('All groups processed!');
        await delay(600000);
    }
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
