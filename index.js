// index.js

const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { printChats, getGroupParticipants, getGroupIdByName, removeParticipantByPhoneNumber, sendMessageToNumber, sendMessageToNumberAPI } = require('./chat');
const fs = require('fs');
const checkPhoneNumber = require('./phone-check');
const { isMessageAlreadySent, saveMessageToMongoDB } = require('./mongo');
const { getInactiveMessage, getNotFoundMessage } = require('./messages');
const dfd = require("danfojs-node");
const { getPhoneNumbersWithStatus, saveGroupsToList, getWhatsappQueue, registerWhatsappAddAttempt, registerWhatsappAddFulfilled } = require('./pgsql');
const { addPhoneNumberToGroup } = require('./re-add');
const { recordUserEntryToGroup, recordUserExitFromGroup, getPreviousGroupMembers, saveCommsRecord, checkCommsRecord } = require('./pgsql'); // Add saveCommsRecord and checkCommsRecord here
const { createObjectCsvWriter } = require('csv-writer');
const readline = require('readline');
const { triggerTwilioOrRemove } = require('./twilioClient'); 
require('dotenv').config();

const username = process.env.DB_USER;
const password = process.env.DB_PASS;
const dbName = process.env.DB_NAME;
const dbHost = process.env.DB_HOST;

const csvWriter = createObjectCsvWriter({
    path: 'action_log.csv',
    header: [
        { id: 'timestamp', title: 'Timestamp' },
        { id: 'groupName', title: 'Group Name' },
        { id: 'member', title: 'Member' },
        { id: 'action', title: 'Action' },
        { id: 'reason', title: 'Reason' }
    ],
    append: true
});

let skipDelay = false;

readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);

process.stdin.on('keypress', (str, key) => {
    if (key.name === 's') {
        console.log('\nSkipping delay...');
        skipDelay = true;
    } else if (key.ctrl && key.name === 'c') {
        process.exit();
    }
});

async function countdown(ms) {
    const seconds = Math.floor(ms / 1000);
    for (let i = seconds; i > 0; i--) {
        if (skipDelay) {
            skipDelay = false;
            console.log('\nDelay skipped!');
            return;
        }
        process.stdout.write(`\rCountdown: ${i} seconds remaining`);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log('\nCountdown finished.');
}

function getRandomDelay(baseDelay) {
    const variation = baseDelay * 0.3;
    const randomDelay = Math.random() * (2 * variation) - variation;
    return baseDelay + randomDelay;
}

async function delay(ms) {
    const totalDelay = getRandomDelay(ms);
    await countdown(totalDelay);
}

function logAction(groupName, member, action, reason) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        groupName,
        member,
        action,
        reason
    };
    csvWriter.writeRecords([logEntry])
        .then(() => console.log(`Action logged: ${action} - ${member} in ${groupName}`));
}

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ["--no-sandbox", "--disable-gpu"],
    },
    webVersionCache: { type: 'remote', remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html' }
});

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

const scanMode = process.argv.includes('--scan');
const addOnlyMode = process.argv.includes('--add-only');
const removeOnlyMode = process.argv.includes('--remove-only');
const addAndRemoveMode = process.argv.includes('--add-and-remove');

if (!scanMode && !addOnlyMode && !removeOnlyMode && !addAndRemoveMode) {
    console.log('No mode specified. Please provide a mode: --scan, --add-only, --remove-only, or --add-and-remove.');
    process.exit(0);
}

if (scanMode) {
    console.log('Scan mode enabled. No changes will be made to the groups.');
} else if (addOnlyMode) {
    console.log('Add-only mode enabled. Only additions will be made to the groups.');
} else if (removeOnlyMode) {
    console.log('Remove-only mode enabled. Only removals will be made from the groups.');
} else if (addAndRemoveMode) {
    console.log('Add-and-remove mode enabled. Additions and removals will be made to/from the groups.');
} else {
    console.log('!!!!!!Scan mode DISABLED. Changes will be made to the groups.!!!!!!!');
}

const jbGroupNames = [
    "N-SIGs Mensa Brasil",
    "MB | Xadrez",
];

client.on('ready', async () => {
    console.log('Client is ready!');

    while (true) {
        const chats = await client.getChats();
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
                await groupChat.sendSeen();
                await delay(10000);

                const botChatObj = groupChat.participants.find(chatObj => chatObj.id.user === client.info.wid.user);
                if (!botChatObj.isAdmin) {
                    console.log("Bot is not an admin in this group. Skipping admin actions.");
                    continue;
                }

                for (const previousMember of previousMembers) {
                    if (!currentMembers.includes(previousMember)) {
                        await recordUserExitFromGroup(previousMember, groupId, 'Left group');
                        logAction(groupName, previousMember, 'Exit', 'Left group');
                    }
                }

                for (const member of groupMembers) {
                    const checkResult = checkPhoneNumber(phoneNumbersFromDB, member);
                    let reason = null;

                    if (checkResult.found) {
                        if (!previousMembers.includes(member)) {
                            console.log(`Number ${member}, MB ${checkResult.mb} is new to the group.`);
                            await recordUserEntryToGroup(checkResult.mb, member, groupId, checkResult.status);
                            logAction(groupName, member, 'Entry', 'New to group');
                        }

                        if (groupName.includes("JB")) {
                            jbGroupNames.push(groupName);
                        }

                        if (checkResult.jovem_brilhante && !jbGroupNames.includes(groupName) && (removeOnlyMode || addAndRemoveMode)) {
                            console.log(`Number ${member}, MB ${checkResult.mb} is JB and is not in a JB group.`);
                            if (!scanMode) {
                                const removed = await removeParticipantByPhoneNumber(client, groupId, member);
                                if (removed) {
                                    reason = 'JB not in JB group';
                                    logAction(groupName, member, 'Removal', reason);
                                    await delay(300000);
                                }
                            }
                        }

                        if (checkResult.status === 'Inactive' && (removeOnlyMode || addAndRemoveMode)) {
                            console.log(`Number ${member}, MB ${checkResult.mb} is inactive.`);
                            if (!scanMode) {
                                const removed = await removeParticipantByPhoneNumber(client, groupId, member);
                                if (removed) {
                                    reason = 'Inactive';
                                    logAction(groupName, member, 'Removal', reason);
                                    await triggerTwilioOrRemove(`whatsapp:+${member}`, "inactive"); // Replaced triggerTwilioFlow
                                    await delay(300000);
                                }
                            }
                        }
                    } else {
                        if (member !== '18653480874' && member !== '36705346911' && member !== '351926855059' && member !== '447863603673' && member !== '4915122324805' && member !== '62999552046' && member !== '15142676652' && member !== "556299552046" && member !== '447782796843' && member !== '555496875059' && member !== '34657489744' && (removeOnlyMode || addAndRemoveMode)) {
                            console.log(`Number ${member} not found in the database.`);
                            if (!scanMode) {
                                const removed = await removeParticipantByPhoneNumber(client, groupId, member);
                                if (removed) {
                                    reason = 'Not found in database';
                                    logAction(groupName, member, 'Removal', reason);
                                    await triggerTwilioOrRemove(`whatsapp:+${member}`, "not_found"); 
                                    await delay(300000);
                                }
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
        }

        const conversations = chats.filter(chat => !chat.isGroup);
        const queue = await getWhatsappQueue(groupId);
        const last8DigitsFromChats = conversations.map(chat => chat.id.user).map(number => number.slice(-8));
        if (!scanMode && (addOnlyMode || addAndRemoveMode)) {
            for (const request of queue.rows) {
                try {
                    request.phone_number = request.phone_number.replace(/\D/g, '');
                    if (last8DigitsFromChats.includes(request.phone_number.slice(-8))) {
                        const addResult = await addPhoneNumberToGroup(client, request.phone_number, groupId);
                        if (addResult === true) {
                            await registerWhatsappAddFulfilled(request.id);
                            console.log(`Number ${request.phone_number} added to group ${groupName}`);
                            logAction(groupName, request.phone_number, 'Added', 'Fulfilled');
                            await delay(1200000);
                        } else {
                            throw new Error('Addition failed');
                        }
                    } else {
                        console.log(`Number ${request.phone_number} not found in existing chats. Skipping...`);
                        continue;
                    }
                } catch (error) {
                    await registerWhatsappAddAttempt(request.id);
                    console.error(`Error adding number ${request.phone_number} to group: ${error.message}`);
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
