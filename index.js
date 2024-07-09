const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { printChats, getGroupParticipants, getGroupIdByName, removeParticipantByPhoneNumber, sendMessageToNumber, sendMessageToNumberAPI } = require('./chat');
const fs = require('fs');
const checkPhoneNumber = require('./phone-check');
const { isMessageAlreadySent, saveMessageToMongoDB } = require('./mongo');
const { getInactiveMessage, getNotFoundMessage } = require('./messages');
const dfd = require("danfojs-node");
const { getPhoneNumbersWithStatus, saveGroupsToList, getWhatsappQueue, registerWhatsappAddAttempt, registerWhatsappAddFulfilled } = require('./pgsql'); // Renamed function
const { addPhoneNumberToGroup } = require('./re-add');
const {
    recordUserEntryToGroup,
    recordUserExitFromGroup,
    getPreviousGroupMembers
} = require('./pgsql');
const { Console } = require('console');

require('dotenv').config();

const username = process.env.DB_USER;
const password = process.env.DB_PASS;
const dbName = process.env.DB_NAME;
const dbHost = process.env.DB_HOST;

const BOT_NUMBER = "447863603673";

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-gpu",
      ],
    },
    webVersionCache: { type: 'remote', remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html', }
});

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

// Helper function to introduce a delay
function getRandomDelay(baseDelay) {
    const variation = baseDelay * 0.3;
    const randomDelay = Math.random() * (2 * variation) - variation;
    const totalDelay = baseDelay + randomDelay;
    return totalDelay;
}

function delay(ms) {
    const totalDelay = getRandomDelay(ms);
    return new Promise(resolve => setTimeout(resolve, totalDelay));
}

const scanMode = process.argv.includes('--scan');
const addOnlyMode = process.argv.includes('--add-only');

if (scanMode) {
    console.log('Scan mode enabled. No changes will be made to the groups.');
} else if (addOnlyMode) {
    console.log('Add-only mode enabled. Only additions will be made to the groups.');
} else {
    console.log('!!!!!!Scan mode DISABLED. Changes will be made to the groups.!!!!!!!');
}

const jbGroupNames = [
    "SIGs Mensa Brasil",
    "MB | Xadrez",
];

client.on('ready', async () => {
    console.log('Client is ready!');

    while (true) {
        const chats = await client.getChats();
        console.log(chats);
        const groups = chats.filter(chat => chat.isGroup && !chat.isReadOnly);
        const groupNames = groups.map(group => group.name);
        const groupIds = groups.map(group => group.id._serialized);

        await saveGroupsToList(groupNames, groupIds);

        for (const groupName of groupNames) {
            const phoneNumbersFromDB = await getPhoneNumbersWithStatus();
            if (phoneNumbersFromDB.length === 0) {
                console.log('No phone numbers found in the database. Exiting.');
                process.exit(0);
            }
            const checkResult = checkPhoneNumber(phoneNumbersFromDB, '447474660572');
            if (!checkResult.found) {
                console.log('Number 447474660572 not found in the database. Sanity check failed. Exiting.');
                process.exit(0);
            }

            console.log(`Processing group: ${groupName}`);
            const groupId = await getGroupIdByName(client, groupName);
            const previousMembers = await getPreviousGroupMembers(groupId);

            try {
                const participants = await getGroupParticipants(client, groupId);
                const groupMembers = participants.map(participant => participant.phone);
                const currentMembers = groupMembers.filter(member => checkPhoneNumber(phoneNumbersFromDB, member).found);

                const groupChat = await client.getChatById(groupId);
                const botChatObj = groupChat.participants.find(chatObj => chatObj.id.user === BOT_NUMBER);

                const isAdmin = botChatObj && botChatObj.isAdmin;

                for (const previousMember of previousMembers) {
                    if (!currentMembers.includes(previousMember)) {
                        await recordUserExitFromGroup(previousMember, groupId, 'Left group');
                    }
                }

                for (const member of groupMembers) {
                    const checkResult = checkPhoneNumber(phoneNumbersFromDB, member);
                    let reason = null;

                    if (checkResult.found) {
                        if (!previousMembers.includes(member)) {
                            console.log(`Number ${member}, MB ${checkResult.mb} is new to the group.`);
                            await recordUserEntryToGroup(checkResult.mb, member, groupId, checkResult.status);
                        }

                        if (groupName.includes("JB")) {
                            jbGroupNames.push(groupName);
                        }

                        if (checkResult.jovem_brilhante && !jbGroupNames.includes(groupName) && !addOnlyMode && isAdmin) {
                            console.log(`Number ${member}, MB ${checkResult.mb} is JB and is not in a JB group.`);
                            if (!scanMode) {
                                await delay(60000);
                                await removeParticipantByPhoneNumber(client, groupId, member);
                                reason = 'JB not in JB group';
                            }
                        }

                        if (checkResult.status === 'Inactive' && !addOnlyMode && isAdmin) {
                            console.log(`Number ${member}, MB ${checkResult.mb} is inactive.`);
                            if (!scanMode) {
                                await delay(60000);
                                await removeParticipantByPhoneNumber(client, groupId, member);
                                reason = 'Inactive';
                            }
                        }
                    } else {
                        if (member !== '447475084085' && member !== '4915122324805' && member !== '62999552046' && member !== '15142676652' && member !== "556299552046" && member !== '447782796843' && member != '555496875059' && member != '34657489744' && !addOnlyMode && isAdmin) {
                            console.log(`Number ${member} not found in the database.`);
                            await delay(60000);
                            if (!scanMode) {
                                await removeParticipantByPhoneNumber(client, groupId, member);
                                reason = 'Not found in database';
                            }
                        }
                    }
                    if (reason) {
                        if (!scanMode) {
                            await recordUserExitFromGroup(member, groupId, reason);
                        }
                    }
                }

                await delay(10000);
                console.log(`Finished processing group: ${groupName}`);
            } catch (error) {
                console.error(`Error processing group ${groupName}:`, error);
            }
            await delay(10000);

            const conversations = chats.filter(chat => !chat.isGroup);
            const queue = await getWhatsappQueue(groupId);
            const last8DigitsFromChats = conversations.map(chat => chat.id.user).map(number => number.slice(-8));
            if (!scanMode && isAdmin) {
                for (const request of queue.rows) {
                    try {
                        request.phone_number = request.phone_number.replace(/\D/g, '');
                        if (last8DigitsFromChats.includes(request.phone_number.slice(-8))) {
                            const addResult = await addPhoneNumberToGroup(client, request.phone_number, groupId);
                            if (addResult === true) {
                                await registerWhatsappAddFulfilled(request.id);
                                console.log(`Number ${request.phone_number} added to group`);
                            } else {
                                throw new Error('Addition failed');
                            }
                        } else {
                            console.log(`Number ${request.phone_number} not found in existing chats. Skipping...`);
                            delay(60000);
                            continue;
                        }
                    } catch (error) {
                        await registerWhatsappAddAttempt(request.id);
                        console.error(`Error adding number ${request.phone_number} to group: ${error.message}`);
                    }
                    await delay(6000000); // 6,000,000 ms = 100 minutes; adjust as needed
                }
            }
        }
        console.log('All groups processed!');
        await delay(60000);
    }
});

client.initialize();

process.on('SIGINT', async () => {
    try {
        process.exit(0);
    } catch (err) {
        process.exit(1);
    }
});
