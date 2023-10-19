const { Client, LocalAuth } = require('whatsapp-web.js');
const getWorksheetContents = require('./googlesheets');
const { printChats, getGroupParticipants, getGroupIdByName, removeParticipantByPhoneNumber, sendMessageToNumber, sendMessageToNumberAPI } = require('./chat');
const MongoClient = require('mongodb').MongoClient;
require('dotenv').config();

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SHEETS_CREDENTIALS_PATH = process.env.GOOGLE_SHEETS_CREDENTIALS_PATH;

const username = encodeURIComponent(process.env.DB_USER);
const password = encodeURIComponent(process.env.DB_PASS);
const dbName = process.env.DB_NAME;
const dbHost = process.env.DB_HOST;

const uri = `mongodb+srv://${username}:${password}@${dbHost}/${dbName}`;
const groupNames = process.env.GROUP_NAMES.split("','").map(name => name.replace(/^'|'$/g, ''));

const clientMongo = new MongoClient(uri, { useUnifiedTopology: true });

const client = new Client({
    authStrategy: new LocalAuth()
});

(async () => {
    try {
        await clientMongo.connect();
        console.log('Connected to MongoDB successfully!');

        await client.initialize();

        const df = await getWorksheetContents(GOOGLE_SHEET_ID, 'Cadastro completo', GOOGLE_SHEETS_CREDENTIALS_PATH);
        const usedPhoneNumbersCollection = clientMongo.db(dbName).collection('usedphonenumbers');

        for (const groupName of groupNames) {
            const groupId = await getGroupIdByName(client, groupName);
            const participants = await getGroupParticipants(client, groupId);
            const groupMembersPhones = participants.map(participant => participant.phone);

            for (let phone of groupMembersPhones) {
                // Using the 'loc' method to get a specific column
                const phoneColumn = df['phone'].data;

            
                const matchingIndices = [];
            
                // Finding the indices of rows with matching phone numbers
                phoneColumn.forEach((value, index) => {
                    if (value === phone) {
                        matchingIndices.push(index);
                    }
                });
            
                if (matchingIndices.length > 0) {
                    const matchingRows = df.iloc({ rows: matchingIndices });
                    const person = matchingRows.row_data[0];
                    const { mb } = person;
            
                    const existingEntry = await usedPhoneNumbersCollection.findOne({ mb });
            
                    if (existingEntry) {
                        console.warn(`Duplicate entry found for MB: ${mb}.`);
                    } else {
                        await usedPhoneNumbersCollection.insertOne({
                            mb,
                            phoneNumbers: [phone],
                            groups: [groupName]
                        });
                    }
                }
            }
            
            
        }

        console.log('Finished processing all phone numbers from all groups!');
        await client.destroy();  // Properly close WhatsApp client
        await clientMongo.close();
    } catch (err) {
        console.error('Error:', err);
        if (clientMongo.isConnected) {

            await clientMongo.close();
        }
        if (client) {
            await client.destroy();
        }
    }
})();
