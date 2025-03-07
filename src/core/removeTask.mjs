import WAWebJS from 'whatsapp-web.js'; // eslint-disable-line no-unused-vars

import { recordUserExitFromGroup } from '../database/pgsql.mjs';
import { getFromRemoveQueue } from '../database/redis.mjs';
import { removeMemberFromGroup } from '../utils/clientOperations.mjs';

/**
 * Processes one item from the removeQueue and returns success or failure
 * @async
 * @param {WAWebJS.Client} client - The WhatsApp Web client
 * @returns {Promise<boolean>} True if the item was successfully processed, false otherwise
 * @example
 * // Process one item from the removeQueue
 * const success = await processRemoveQueue(client);
 */
async function processRemoveQueue(client) {
    const item = await getFromRemoveQueue();
    if (!item) {
        console.log('No items in the removeQueue');
        return false;
    }
    const group = await client.getChatById(item.groupId);
    const botChatObj = group.participants.find(chatObj => chatObj.id.user === client.info.wid.user);

    if (!botChatObj.isAdmin){
        console.log(`Bot is not admin on group: ${group.name} id: ${item.groupId} skipping removal of member ${item.registration_id}`);
    }

    console.log(`Processing removal of member ${item.registration_id} with phone ${item.phone} from group ${item.groupId}...`);
    const result = await removeMemberFromGroup(client, item.phone, item.groupId, item.communityId);

    if (result.removed && result.removalType === 'Community') {
        console.log(`Member ${item.phone} successfully removed from ${result.removalType} ${item.communityId}`);
        await recordUserExitFromGroup(item.phone, item.communityId, item.reason);
        return true;
    }
    else if (result.removed && result.removalType === 'Group') {
        console.log(`Member ${item.phone} successfully removed from ${result.removalType} ${item.groupId}`);
        await recordUserExitFromGroup(item.phone, item.groupId, item.reason);
        return true;
    }
    return false;
}

export { processRemoveQueue };
