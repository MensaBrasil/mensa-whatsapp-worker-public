const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { printChats, getGroupParticipants, getGroupIdByName, removeParticipantByPhoneNumber, sendMessageToNumber, sendMessageToNumberAPI } = require('./chat');
const getWorksheetContents = require('./googlesheets');
const fs = require('fs');
const checkPhoneNumber = require('./phone-check');
const { ObjectId } = require('mongodb');
const { isMessageAlreadySent, saveMessageToMongoDB } = require('./mongo');
const MongoClient = require('mongodb').MongoClient;
const { getInactiveMessage, getNotFoundMessage } = require('./messages');

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
function getRandomDelay(baseDelay) {
    // Calculate the random variation as 20% of the baseDelay
    const variation = baseDelay * 0.2;
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



const groupNames = [
    // Avisos
    'Avisos Mensa JB SP CIDADE',
    'Avisos Mensa JB SUL',
    'Avisos Mensa JB C.O/N',
    'Avisos Mensa JB Nordeste ',
    'Avisos Mensa JB SP ESTADO',
    'Avisos Mensa -  SUL',
    'Avisos Mensa - C.O/N',
    'Avisos Mensa - NORDESTE',
    'Avisos Mensa SP CIDADE',
    'Avisos Mensa - SUDESTE',
    'Avisos Mensa JB SUDESTE ',
    'Avisos Mensa SP ESTADO',
    // SIGs
    'MB | Autismo e Outras Neurodiversidades',
    'MB | Xadrez',
    'MB | Nerd',
    // Regionais
    'Mensa Minas Gerais',
    'Mensa Rio de Janeiro',
    'Mensa DF',
    'MB | Coordenação Nacional',

];




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
                 const alreadySent = await isMessageAlreadySent(clientMongo, dbName, 'communicated_inactive', inactiveNumber);
                 await saveMessageToMongoDB(clientMongo, dbName, 'communicated_inactive', inactiveNumber, groupName);
                 if (!alreadySent) {
                     //await sendMessageToNumber(client, inactiveNumber, getInactiveMessage(inactiveNumber));
                     //await saveMessageToMongoDB(clientMongo, dbName, 'communicated_inactive', inactiveNumber, inactiveMessage, groupName);
                     await delay(100);
                 }

                 // Remove the inactive member from the group
                 //await removeParticipantByPhoneNumber(client, groupId, inactiveNumber);
            }



            for (let notFoundNumber of notFoundNumbers) {
                const alreadySent = await isMessageAlreadySent(clientMongo, dbName, 'communicated_not_found', notFoundNumber);
                await saveMessageToMongoDB(clientMongo, dbName, 'communicated_not_found', notFoundNumber, groupName);
                if (!alreadySent) {
                    console.log(`Sending message to ${notFoundNumber} because it was not found in the spreadsheet.`);
                    await sendMessageToNumberAPI(client, notFoundNumber, getNotFoundMessage(notFoundNumber));
                    await delay(100); 
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
