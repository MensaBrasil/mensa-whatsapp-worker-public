const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { printChats, getGroupParticipants, getGroupIdByName, removeParticipantByPhoneNumber, sendMessageToNumber, sendMessageToNumberAPI } = require('./chat');
const fs = require('fs');
const { checkPhoneNumber, preprocessPhoneNumbers } = require('./phone-check');
const { isMessageAlreadySent, saveMessageToMongoDB } = require('./mongo');
const { getInactiveMessage, getNotFoundMessage } = require('./messages');
const dfd = require("danfojs-node");
const { getPhoneNumbersWithStatus, saveGroupsToList, getWhatsappQueue, registerWhatsappAddAttempt, registerWhatsappAddFulfilled, getMemberPhoneNumbers, getMemberName, getLastMessageTimestamp, insertNewWhatsAppMessages } = require('./pgsql');
const { addPhoneNumberToGroup } = require('./re-add');
const { recordUserEntryToGroup, recordUserExitFromGroup, getPreviousGroupMembers } = require('./pgsql');
const { createObjectCsvWriter } = require('csv-writer');
const readline = require('readline');
const { triggerTwilioOrRemove } = require('./twilio');
const TelegramBot = require('node-telegram-bot-api'); // Telegram bot API
require('dotenv').config();

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

const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;
const telegramBot = new TelegramBot(telegramBotToken);

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
        .then(() => {
            console.log(`Action logged: ${action} - ${member} in ${groupName}`);
            sendTelegramNotification(groupName, member, action, reason);
        })
        .catch(error => {
            console.error('Failed to log action to CSV:', error);
        });
}

function sendTelegramNotification(groupName, member, action, reason) {
    try {
        telegramBot.sendMessage(telegramChatId, `Action logged: ${action} - ${member} in ${groupName} reason: ${reason}`)
            .catch(error => {
                console.error('Failed to send Telegram notification:');
            });
    } catch (error) {
        console.error('Unexpected error in sendTelegramNotification:');
    }
}

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: '.wpp_session'
    }),
    puppeteer: {
        headless: true,
        args: ["--no-sandbox", '--disable-setuid-sandbox', "--disable-gpu"],
    }
});

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

const scanMode = process.argv.includes('--scan');
const addOnlyMode = process.argv.includes('--add-only');
const removeOnlyMode = process.argv.includes('--remove-only');
const addAndRemoveMode = process.argv.includes('--add-and-remove');
const checkAuth = process.argv.includes('--check-auth');

if (!scanMode && !addOnlyMode && !removeOnlyMode && !addAndRemoveMode && !checkAuth) {
    console.log('No mode specified. Please provide a mode: --scan, --add-only, --remove-only, --add-and-remove or --check-auth');
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
} else if (checkAuth) {
    console.log('Check-auth mode enabled. Create a CSV file with authorization status of members that requested to join groups.');
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

        if ((chats.length == 0) || (groups.length == 0)) {
            console.log('No groups found. Exiting.');
            process.exit(0);
        }

        await saveGroupsToList(groupNames, groupIds);
        console.log(`Total chats retrieved: ${chats.length}`);
        console.log(`Groups retrieved: ${groups.length}`);

        // Check if member has a active chat with the bot and save results to a csv file.
        if (checkAuth) {
            console.log('Check-auth mode enabled. Processing authorization requests...');
            const authorizationRequests = [];
            const conversations = chats.filter(chat => !chat.isGroup);
            const last8DigitsFromChats = conversations.map(chat => chat.id.user).map(number => number.slice(-8));

            for (const groupName of groupNames) {
                const groupId = await getGroupIdByName(client, groupName);
                const queue = await getWhatsappQueue(groupId);

                for (const request of queue.rows) {
                    console.log(`Processing request ${request.id}`);
                    try {
                        const phones = await getMemberPhoneNumbers(request.registration_id);
                        for (const phone of phones) {
                            const status = last8DigitsFromChats.includes(phone.slice(-8)) ? 'Authorized' : 'Not Authorized';
                            const name = await getMemberName(request.registration_id);
                            authorizationRequests.push({
                                member_name: name,
                                registration_id: request.registration_id,
                                authorization_status: status
                            });
                        }
                    } catch (error) {
                        console.error(`Error processing request ${request.id}: ${error.message}`);
                    }
                }
            }

            const authorizationCsvWriter = createObjectCsvWriter({
                path: 'authorization_requests.csv',
                header: [
                    { id: 'member_name', title: 'Member Name' },
                    { id: 'registration_id', title: 'Registration ID' },
                    { id: 'authorization_status', title: 'Authorization Status' }
                ],
                append: true
            });

            authorizationCsvWriter.writeRecords(authorizationRequests)
                .then(() => {
                    console.log('Authorization requests saved to CSV.');
                })
                .catch(error => {
                    console.error('Failed to save authorization requests to CSV:', error);
                });
            console.log('Finished processing authorization requests! Exiting...');
            process.exit(0);
        }

        for (const groupName of groupNames) {
            const phoneNumbersFromDB = preprocessPhoneNumbers(await getPhoneNumbersWithStatus());
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

            // Save messages data for all groups to the database.

            async function convertTimestampToDate(timestamp) {
                let date = new Date(timestamp * 1000);
                return date;
            }

            try {
                groupChat = await client.getChatById(groupId);
                console.log("Syncing history for group: ", groupName);
                await groupChat.syncHistory()
                console.log("History synced for group: ", groupName);
                console.log("Fetching messages for group: ", groupName);
                const batchSize = 1000;
                let currentBatchSize = batchSize;
                let reachedTimestamp = false;
                let req_count = 0;
                let db_count = 0;

                const timeoutPromise = (ms) => 
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms));

                let lastMessageTimestampInDb = await getLastMessageTimestamp(groupId);
                let timeLimitTimestamp = Math.floor(new Date().getTime()/1000.0) - (90 * 24 * 60 * 60); // 3 months ago

                console.log("Last message date in db: ", await convertTimestampToDate(lastMessageTimestampInDb), " - timestamp: ", lastMessageTimestampInDb);
                console.log("Time limit date: ", await convertTimestampToDate(timeLimitTimestamp), " - timestamp: ", timeLimitTimestamp);

                while (reachedTimestamp === false) {
                    try {
                        let options = { limit: currentBatchSize };
                        console.log("Fetching up to: ", options.limit, " messages...");
                        let messages = await Promise.race([
                            groupChat.fetchMessages(options),
                            timeoutPromise(240000)
                        ]);
                        console.log("Fetched: ", messages.length, " messages");
                        req_count += 1;

                        console.log("Oldest message from this batch date: ", await convertTimestampToDate(messages[0].timestamp), " - timestamp: ", messages[0].timestamp);

                        if ((messages.length < batchSize) && (req_count == 1)){
                            console.log("First batch reached maximum messages!");
                            reachedTimestamp = true;
                            db_count += await sendMessageBatchToDb(messages);
                            break;
                        }

                        if (req_count > 1){
                            if (currentBatchSize > messages.length){
                                console.log("Last batch reached! Batch count: ", req_count);
                                let difference = messages.length - ((req_count - 1) * batchSize);
                                console.log(difference, " remaining messages!");
                                messages = messages.slice(0, difference);
                                db_count += await sendMessageBatchToDb(messages);
                                break;
                            }
                        }

                        if (messages.length == currentBatchSize) {
                            console.log("Selecting first ", batchSize, " messages from batch nº", req_count);
                            messages = messages.slice(0, batchSize);
                        }

                        if (messages.length === 0) {
                            console.log("No messages found. Skipping...");
                            break;
                        } else if ((messages[0].timestamp > lastMessageTimestampInDb) && (messages[0].timestamp > timeLimitTimestamp)){
                            console.log("Time limit NOT reached in current batch! Batch count: ", req_count);
                            console.log("Sending batch nº", req_count, " with ", messages.length ," messages to db...");
                            currentBatchSize += batchSize;
                            db_count += await sendMessageBatchToDb(messages)

                        } else {
                            console.log("Timestamp limit reached. Checking timestamps in current batch! batch count: ", req_count);
                            let filteredMessages = messages.filter(message => message.timestamp > lastMessageTimestampInDb);
                            console.log(filteredMessages.length, " new messages found! Sending batch to db...");
                            db_count += await sendMessageBatchToDb(filteredMessages);
                            reachedTimestamp = true;
                            break;
                        }
                    } catch (error) {
                        console.error("Error fetching messages:", error);
                        break;
                    }
                }

                async function sendMessageBatchToDb(messages) {
                    const phoneNumbers = messages.map(message => {
                        // Extract the numeric part before '@'
                        const author = message.author || null
                        if (!author) {
                            return null;
                        }
                        const parts = author.split('@');
                        if (parts.length !== 2) {
                            return null;
                        }
                        return parts[0];
                    }).filter(phone => phone !== null); // Remove null entries
                
                    const checkCache = new Map();
                    const batch = [];
                
                    for (let i = 0; i < phoneNumbers.length; i++) {
                        const phone = phoneNumbers[i];
                
                        let resp = checkCache.get(phone);
                        if (!resp) {
                            resp = checkPhoneNumber(phoneNumbersFromDB, phone);
                            checkCache.set(phone, resp);
                        }
                
                        if (resp.found) {
                            const message = messages[i];
                            const message_id = message.id.id;
                            const group_id = groupId;
                            const datetime = new Date(message.timestamp * 1000).toISOString();
                
                            batch.push([
                                message_id,
                                group_id,
                                resp.mb,
                                datetime,
                                phone,
                                message.type,
                                message.deviceType,
                            ]);
                        }
                    }
                

                    if (batch.length > 0) {
                        await insertNewWhatsAppMessages(batch);
                    }

                
                    console.log(`${batch.length} messages added to db!`);
                    return batch.length;
                }
                

                console.log("All messages processed successfully for group: ", groupName, " ~", db_count, " messages added to db!");
                
            } catch (error) {
                console.error(`Error saving messages for ${groupName}: `, error);
            }

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


                        if (
                            groupName.includes("M.JB") &&
                            checkResult.jb_over_10 &&
                            !groupName.includes("Resp") &&
                            !checkResult.jb_under_10 &&
                            (removeOnlyMode || addAndRemoveMode)
                        ) {
                            console.log(`Removing ${member} (JB >=10) from M.JB group.`);
                            if (!scanMode) {
                                const removed = await removeParticipantByPhoneNumber(client, groupId, member);
                                if (removed) {
                                    logAction(groupName, member, 'Removal', 'User is JB over 10 in M.JB group');
                                    await recordUserExitFromGroup(member, groupId, 'JB over 10 in M.JB group');
                                    await delay(300000);
                                }
                            }
                        }

                        if (
                            groupName.includes("JB") &&
                            !groupName.includes("M.JB") &&
                            !groupName.includes("Resp") &&
                            checkResult.jb_under_10 &&
                            !checkResult.jb_over_10 &&
                            (removeOnlyMode || addAndRemoveMode)
                        ) {
                            console.log(`Removing ${member} (JB <10) from JB group.`);
                            if (!scanMode) {
                                const removed = await removeParticipantByPhoneNumber(client, groupId, member);
                                if (removed) {
                                    logAction(groupName, member, 'Removal', 'User is JB under 10 in JB group');
                                    await recordUserExitFromGroup(member, groupId, 'JB under 10 in JB group');
                                    await delay(300000);
                                }
                            }
                        }

                        if (checkResult.status === 'Inactive' && (removeOnlyMode || addAndRemoveMode)) {
                            console.log(`Number ${member}, MB ${checkResult.mb} is inactive.`);
                            if (!scanMode) {
                                const shouldRemove = await triggerTwilioOrRemove(member, "mensa_inactive");
                                if (shouldRemove) {
                                    const removed = await removeParticipantByPhoneNumber(client, groupId, member);
                                    if (removed) {
                                        reason = 'Inactive';
                                        logAction(groupName, member, 'Removal', reason);
                                        await delay(300000);
                                    }
                                }
                            }
                        }

                    } else {
                        if (member !== '+33681604260' && member !== '18653480874' && member !== '36705346911' && member !== '351926855059' && member !== '447863603673' && member !== '4915122324805' && member !== '62999552046' && member !== '15142676652' && member !== "556299552046" && member !== '447782796843' && member !== '555496875059' && member !== '34657489744' && (removeOnlyMode || addAndRemoveMode)) {
                            console.log(`Number ${member} not found in the database.`);
                            if (!scanMode) {
                                const shouldRemove = await triggerTwilioOrRemove(member, "mensa_not_found");
                                if (shouldRemove) {
                                    const removed = await removeParticipantByPhoneNumber(client, groupId, member);
                                    if (removed) {
                                        reason = 'Not found in database';
                                        logAction(groupName, member, 'Removal', reason);
                                        await delay(300000);
                                    }
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


            const conversations = chats.filter(chat => !chat.isGroup);
            const queue = await getWhatsappQueue(groupId);
            const last8DigitsFromChats = conversations.map(chat => chat.id.user).map(number => number.slice(-8));
            if (!scanMode && (addOnlyMode || addAndRemoveMode)) {
                for (const request of queue.rows) {
                    try {
                        phones = await getMemberPhoneNumbers(request.registration_id);
                        for (const phone of phones) {
                            const new_phone = phone.replace(/\D/g, '');
                            if (last8DigitsFromChats.includes(new_phone.slice(-8))) {
                                const addResult = await addPhoneNumberToGroup(client, phone, groupId);
                                if (addResult === true) {
                                    await registerWhatsappAddFulfilled(request.id);
                                    console.log(`Number ${phone} added to group ${groupName}`);
                                    logAction(groupName, phone, 'Added', 'Fulfilled');
                                    await delay(1200000);
                                } else {
                                    throw new Error('Addition failed');
                                }
                            } else {
                                console.log(`Number ${phone} not found in existing chats. Skipping...`);
                                continue;
                            }
                        }
                    } catch (error) {
                        await registerWhatsappAddAttempt(request.id);
                        console.error(`Error adding member ${request.registration_id} to group: ${error.message}`);
                    }
                }
            }

            await delay(10000);
            await fetch(process.env.UPTIME_URL);
        }
        console.log('All groups processed!');
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
