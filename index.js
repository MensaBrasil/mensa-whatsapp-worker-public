const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { printChats, getGroupParticipants, getGroupIdByName, removeParticipantByPhoneNumber, sendMessageToNumber } = require('./chat');
const getWorksheetContents = require('./googlesheets');
const fs = require('fs');
const checkPhoneNumber = require('./phone-check');
const { ObjectId } = require('mongodb');
const { isMessageAlreadySent, saveMessageToMongoDB } = require('./mongo');
const MongoClient = require('mongodb').MongoClient;
const { inactiveMessage, notFoundMessage } = require('./messages');

require('dotenv').config();

const username = encodeURIComponent(process.env.DB_USER);
const password = encodeURIComponent(process.env.DB_PASS);
const dbName = process.env.DB_NAME;

const uri = `mongodb+srv://${username}:${password}@mensawhatsapp.tpllazx.mongodb.net/${dbName}`;

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
    qrcode.generate(qr, {small: true});
});

// Helper function to introduce a delay
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const groupNames = [
    'Mensa Minas Gerais',
];


//... [rest of the code]

client.on('ready', async () => {
    console.log('Client is ready!');

    for (const groupName of groupNames) {
        console.log(`Processing group: ${groupName}`);
        
        try {
            const groupId = await getGroupIdByName(client, groupName);
            const participants = await getGroupParticipants(client, groupId);
            const groupMembers = participants.map(participant => participant.phone);
            const df = await getWorksheetContents('1Sv2UVDeOk3C_Zt4Bye6LWrm9G93G57YEyp-RUVcljSw', 'Cadastro completo');

            let checkResults = await Promise.all(groupMembers.map(member => checkPhoneNumber(df, member)));

            let notFoundNumbers = groupMembers.filter((member, i) => !checkResults[i].found);
            let inactiveNumbers = groupMembers.filter((member, i) => checkResults[i].found && checkResults[i].status !== 'Ativo' && checkResults[i].status !== 'Transferido'); // Transferido is a special case for now. Convidados


            for (let inactiveNumber of inactiveNumbers) {
                const alreadySent = await isMessageAlreadySent(clientMongo, dbName, 'communicated_inactive', inactiveNumber, inactiveMessage);
                if (!alreadySent) {
                    await sendMessageToNumber(client, inactiveNumber, inactiveMessage);
                    await saveMessageToMongoDB(clientMongo, dbName, 'communicated_inactive', inactiveNumber, inactiveMessage, groupName);
                }
                await delay(10000); // Wait for 10 seconds

                // Remove the inactive member from the group
                await removeParticipantByPhoneNumber(client, groupId, inactiveNumber);
            }

            for (let notFoundNumber of notFoundNumbers) {
                const alreadySent = await isMessageAlreadySent(clientMongo, dbName, 'communicated_not_found', notFoundNumber, notFoundMessage);
                if (!alreadySent) {
                    await sendMessageToNumber(client, notFoundNumber, notFoundMessage);
                    await saveMessageToMongoDB(clientMongo, dbName, 'communicated_not_found', notFoundNumber, notFoundMessage, groupName);
                }
                await delay(10000); // Wait for 10 seconds
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
