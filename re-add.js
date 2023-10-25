const { Client, LocalAuth } = require('whatsapp-web.js');
const { ObjectId } = require('mongodb');
const MongoClient = require('mongodb').MongoClient;
const { getGroupIdByName, getGroupParticipants } = require('./chat');
const qrcode = require('qrcode-terminal');

require('dotenv').config();

const username = encodeURIComponent(process.env.DB_USER);
const password = encodeURIComponent(process.env.DB_PASS);
const dbName = process.env.DB_NAME;
const dbHost = process.env.DB_HOST;

const uri = `mongodb+srv://${username}:${password}@${dbHost}/${dbName}`;
const clientMongo = new MongoClient(uri, { useUnifiedTopology: true });

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

async function getGroupsRemovedFrom(clientMongo, databaseName, phoneNumber) {
    const communicatedInactive = clientMongo.db(databaseName).collection('inactive');
    const communicatedNotFoundRemoved = clientMongo.db(databaseName).collection('not_found');

    const inactiveDocument = await communicatedInactive.findOne({ phoneNumber });
    const notFoundDocument = await communicatedNotFoundRemoved.findOne({ phoneNumber });

    let groups = [];

    if (inactiveDocument) {
        groups = groups.concat(inactiveDocument.groups);
    }

    if (notFoundDocument) {
        groups = groups.concat(notFoundDocument.groups);
    }

    return Array.from(new Set(groups)); // to ensure unique groups
}

async function reAddParticipantToGroups(phoneNumber, specificGroupName = null) {
    await delay(3000); 
    try {
        let groups = [];

        if (specificGroupName) {
            groups.push(specificGroupName); // Use the provided group name directly
        } else {
            await clientMongo.connect();
            groups = await getGroupsRemovedFrom(clientMongo, dbName, phoneNumber);
        }

        if (groups.length === 0) {
            console.log(`No groups found for number: ${phoneNumber}`);
            return;
        }

        for (const groupName of groups) {
            console.log(groupName)
            const groupId = await getGroupIdByName(client, groupName); 
            const chat = await client.getChatById(groupId);
            
            if (chat) {
                //console.log(await chat.getInviteCode());
                // Check if the user is already in the group
                const participants = await getGroupParticipants(client, groupId);

                const isAlreadyInGroup = participants.some(participant => participant.phone === phoneNumber);


                if (isAlreadyInGroup) {
                    console.log(`${phoneNumber} is already in group: ${groupName}`);
                    continue;
                }

                if (chat.addParticipants) {
                    chat.sendSeen();
                    await delay(1500);
                    await chat.addParticipants([`${phoneNumber}@c.us`]);
                    console.log(`Added ${phoneNumber} to group: ${groupName}`);

                    // Verification Step
                    await delay(1500);
                    const newParticipants = await getGroupParticipants(client, groupId);
                    const isAdded = newParticipants.some(participant => participant.phone === phoneNumber);
                    if (isAdded) {
                        console.log(`${phoneNumber} verified in group: ${groupName}`);
                    } else {
                        console.error(`Failed to verify ${phoneNumber} in group: ${groupName}`);
                    }

                } else {
                    console.error(`Failed to add ${phoneNumber} to group: ${groupName}`);
                }
            } else {
                console.error(`Chat not found for group: ${groupName}`);
            }

            await delay(10000); // Delay after processing each group
        }
        console.log('Ended');
        if (!specificGroupName) {
            await clientMongo.close();
        }
    } catch (error) {
        console.error(`Error adding ${phoneNumber} back to groups:`, error);
    } finally {
        if (!specificGroupName) {
            await clientMongo.close();
        }
    }
}



// Entry point
client.on('ready', async () => {
    console.log("ready");
    const phoneNumbers = process.argv.slice(2); // Retrieve all arguments after the script name
    const specificGroupName = process.argv[2 + phoneNumbers.length] || null; // Retrieve the group name argument

    if (phoneNumbers.length === 0) {
        console.log("Please provide at least one phone number as arguments.");
        process.exit(1);
    }

    for (const phoneNumber of phoneNumbers) {
        await reAddParticipantToGroups(phoneNumber, specificGroupName);
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

