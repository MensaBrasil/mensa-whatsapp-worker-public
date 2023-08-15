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



const groupNames = [
    // // Avisos
    'Avisos Mensa JB SP CIDADE',
    'Avisos Mensa JB SUL',
    'Avisos Mensa JB C.O/N',
    'Avisos Mensa JB Nordeste ',
    'Avisos Mensa JB SP ESTADO',
    'Avisos Mensa -  SUL',
    'Avisos Mensa - C.O/N',
    'Avisos Mensa - NORDESTE', // parou aqui de enviar as mensagens
    'Avisos Mensa SP CIDADE',
    'Avisos Mensa - SUDESTE',
    'Avisos Mensa JB SUDESTE ',
    'Avisos Mensa SP ESTADO',

    // SIGs
    'MB | Autismo e Outras Neurodiversidades',
    'MB | Xadrez',
    'MB | Nerd',
    'MB | Business',
    'MB | Data Science & IT',
    'MB Scholar',
    'MB Matemática',
    'MB | SIG Medicina e Saúde',
    'MB | Idiomas',
    'MB | Direito',
    'MB | SIGamers',
    'MB | Carreiras e Desenvolvimento Profissional',
    'MB | Gen Z',

    // // Regionais
    'Mensa Paraná',
    'Mensa Rio Grande do Sul',
    'Mensa Rio Grande do Norte',
    'Mensa Rio de Janeiro',
    'Mensa DF',
    //'MB | Coordenação Nacional',
    'Mensa Minas Gerais',
    'Mensa Bahia',
    'Mensa Rio Grande do Sul',
    'MB | Espírito Santo',
    'Mensampa',
    'Mensa Rio Grande do Norte',
    // JBs
    'Mensa RJ pais JB',
    'Mensa SC pais JB',
    'Mensa MG pais JB',
    'Mensa Campinas pais JB',
    'Mensa DF pais JB', 
];


// groupNames = ["Mensa SC pais JB"];

// Groups where JB are alloweds
const jbGroupNames = [

    //TODO: Add JB groups here         <----------------------------------------------------

];


// Merge both lists og groups
const allGroupNames = groupNames.concat(jbGroupNames);


client.on('ready', async () => {
    console.log('Client is ready!');


    //TODO: Replace 'groupNames' with 'allGroupNames' ???       <----------------------------------------------------
    for (const groupName of groupNames) {
        console.log(`Processing group: ${groupName}`);
        try {
            const groupId = await getGroupIdByName(client, groupName);
            const participants = await getGroupParticipants(client, groupId);
            const groupMembers = participants.map(participant => participant.phone);
            let df;
            try {
                df = await getWorksheetContents('1Sv2UVDeOk3C_Zt4Bye6LWrm9G93G57YEyp-RUVcljSw', 'Cadastro completo');
            } catch (err) {
                console.error('Error loading getWorksheetContents:', err);
                await clientMongo.close();  // Closing MongoDB connection before exiting.
                process.exit(1);
            }


            let checkResults = await Promise.all(groupMembers.map(member => checkPhoneNumber(df, member)));

            let resultsMap = {};
            groupMembers.forEach((member, i) => {
                resultsMap[member] = checkResults[i];
            });

            let notFoundNumbers = groupMembers.filter((member, i) => !checkResults[i].found);
            let inactiveNumbers = groupMembers.filter((member, i) => checkResults[i].found && checkResults[i].status !== 'Ativo' && checkResults[i].status !== 'Transferido'); // Transferido is a special case for now. Convidados
          
            //Get all JB's numbers
            let jbNumbers = groupMembers.filter((member, i) => checkResults[i].found && checkResults[i].status === 'Ativo' && checkResults[i].isMemberJb);

            for (let inactiveNumber of inactiveNumbers) {
                const result = resultsMap[inactiveNumber];
                const alreadySent = await isMessageAlreadySent(clientMongo, dbName, 'communicated_inactive', inactiveNumber);
                await removeParticipantByPhoneNumber(client, groupId, inactiveNumber);
                console.log(`Number ${inactiveNumber} is inactive`);
                if (!alreadySent) {
                    //console.log(`Sending message to ${inactiveNumber} because it is inactive.`);
                    await sendMessageToNumberAPI(client, inactiveNumber, "membroinativo");
                    await saveMessageToMongoDB(clientMongo, dbName, 'communicated_inactive', result.mb, inactiveNumber, groupName);
                }
                await delay(60000);
                // Remove the inactive member from the group
                //await removeParticipantByPhoneNumber(client, groupId, inactiveNumber);
            }

            for (let notFoundNumber of notFoundNumbers) {
                const result = resultsMap[notFoundNumber];
                const alreadySent = await isMessageAlreadySent(clientMongo, dbName, 'communicated_not_found_removed', notFoundNumber);
                // skip removing 447810094555 and (+49)15122324805
                if (notFoundNumber === '447810094555' || notFoundNumber === '4915122324805' || notFoundNumber === '62999552046' || notFoundNumber === '15142676652' || notFoundNumber === '556296462065') {
                    continue;
                }
                await removeParticipantByPhoneNumber(client, groupId, notFoundNumber);
                console.log(`Unknown number ${notFoundNumber}`);
                if (!alreadySent) {
                    //console.log(`Sending message to ${notFoundNumber} because it was not found in the spreadsheet.`);
                    await sendMessageToNumberAPI(client, notFoundNumber, "naoencontradoremovido");
                    await saveMessageToMongoDB(clientMongo, dbName, 'communicated_not_found_removed', result.mb, notFoundNumber, groupName);
                }
                await delay(60000);
            }


            //Remove JB's from groups where they are not alloweds
            for (let jbNumber of jbNumbers) {
                
                //TODO: Change collectionName to the correct one        <----------------------------------------------------
                let collectionName = 'communicated_jbs';
                const alreadySent = await isMessageAlreadySent(clientMongo, dbName, collectionName, jbNumber);
                await saveMessageToMongoDB(clientMongo, dbName, collectionName, jbNumber, groupName);
                if (!alreadySent) {
                    await delay(100);
                }

                // Check if the group is in the list of groups where JB are alloweds
                if (!jbGroupNames.includes(groupName)) {


                    // Remove the JB member from the group
                    //await removeParticipantByPhoneNumber(client, groupId, jbNumber);        <----------------------------------------------------


                    
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
