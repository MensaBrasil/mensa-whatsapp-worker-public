import WAWebJS from 'whatsapp-web.js'; // eslint-disable-line no-unused-vars

import { getMemberPhoneNumbers , recordUserEntryToGroup } from '../database/pgsql.mjs';
import { getFromAddQueue, testRedisConnection } from '../database/redis.mjs';
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
    await testRedisConnection();
    const item = await getFromAddQueue();
    if (!item) {
        console.log('No items in the addQueue');
        return false;
    }
    const chats = await client.getChats();
    const conversations = chats.filter(chat => !chat.isGroup);
    const last8DigitsFromChats = conversations.map(chat => chat.id.user).map(number => number.slice(-8));
    const memberPhones = (await getMemberPhoneNumbers(item.registration_id)).map(phone => phone.replace(/\D/g, ''));
    for (const phone of memberPhones) {
        if (last8DigitsFromChats.includes(phone.slice(-8))) {
            const addResult = addMemberToGroup(client, phone, item.group_id);
            if (addResult.added) {
                console.log(`Member ${phone} added to group ${item.group_id}`);
                await recordUserEntryToGroup(item.registration_id, phone, item.group_id, 'Active');
                return true;
            }
            if (addResult.isInviteV4Sent) {
                console.log(`Member can't be added to groups from someone that is not in the contact list.\nInvite link sent to ${phone} for group ${item.group_id}`);
                return true;
            }
        }
        return false;
    }
    return false;
}

export { processAddQueue };
