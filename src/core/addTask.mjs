import WAWebJS from 'whatsapp-web.js'; // eslint-disable-line no-unused-vars

import { getMemberPhoneNumbers , recordUserEntryToGroup, registerWhatsappAddFulfilled } from '../database/pgsql.mjs';
import { getFromAddQueue } from '../database/redis.mjs';
import { addMemberToGroup } from '../utils/clientOperations.mjs';

/**
 * Processes one item from the addQueue and returns success or failure
 * @async
 * @param {WAWebJS.Client} client - The WhatsApp Web client
 * @returns {Promise<boolean>} True if the item was successfully processed, false otherwise
 * @example
 * // Process one item from the addQueue
 * const success = await processAddQueue(client);
 */
async function processAddQueue(client) {
    const item = await getFromAddQueue();
    if (!item) {
        console.log('No items in the addQueue');
        return false;
    }
    const chats = await client.getChats();
    const conversations = chats.filter(chat => !chat.isGroup);
    const last8DigitsFromChats = conversations.map(chat => chat.id.user).map(number => number.slice(-8));
    const memberPhones = await getMemberPhoneNumbers(item.registration_id);
    
    const group = await client.getChatById(item.group_id);
    const botChatObj = group.participants.find(chatObj => chatObj.id.user === client.info.wid.user);

    if (!botChatObj.isAdmin) {
        console.log(`Bot is not an admin in group ${group.name} id: ${item.group_id} skipping...`);
        return false;
    }

    for (const phone of memberPhones) {
        const newPhone = phone.replace(/\D/g, '');
        if (last8DigitsFromChats.includes(newPhone.slice(-8))) {
            const addResult = await addMemberToGroup(client, phone, item.group_id);
            if (addResult.added) {
                console.log(`Member ${phone} added to group ${item.group_id}`);
                await recordUserEntryToGroup(item.registration_id, phone, item.group_id, 'Active');
                await registerWhatsappAddFulfilled(item.request_id);
                return true;
            }
            if (addResult.isInviteV4Sent) {
                console.log(`Member can't be added to groups from someone that is not in the contact list.\nInvite link sent to ${phone} for group ${item.group_id}`);
                return true;
            }
        }
        else {
            console.log(`Member ${phone} not found in the active chat list.`);
        }
        console.log(`Could not add ${phone} to group ${item.group_id}`);
        return false;
    }
    return false;
}

export { processAddQueue };
