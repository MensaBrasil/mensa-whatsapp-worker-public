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

    console.log(`Processing removal of member ${item.registration_id} with phone ${item.phone} from group ${item.groupId}...`);
    const result = await removeMemberFromGroup(client, item.phone, item.groupId);

    if (result.removed) {
        console.log(`Member ${item.phone} successfully removed from ${item.groupId} -> ${result.groupName} for reason: ${item.reason}`);
        await recordUserExitFromGroup(item.phone, item.groupId, item.reason);
        return true;
    }
    return false;
}

export { processRemoveQueue };
