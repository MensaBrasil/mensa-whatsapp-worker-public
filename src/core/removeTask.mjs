import { configDotenv } from 'dotenv';
import WAWebJS from 'whatsapp-web.js'; // eslint-disable-line no-unused-vars

import { recordUserExitFromGroup } from '../database/pgsql.mjs';
import { getFromRemoveQueue } from '../database/redis.mjs';
import { removeMemberFromGroup } from '../utils/clientOperations.mjs';
import { delay } from '../utils/misc.mjs';

configDotenv();

const removeDelay = Number(process.env.REMOVE_DELAY) || 10;
const delayOffset = Number(process.env.DELAY_OFFSET) || 3;

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
  console.log(`\x1b[96mProcessing removal of member ${item.registration_id} with phone ${item.phone} from group ${item.groupId}...\x1b[0m`);
  const result = await removeMemberFromGroup(client, item.phone, item.groupId, item.communityId);

  if (result.removed && result.removalType === 'Community') {
    console.log(`\x1b[92mMember ${item.phone} successfully removed from community ${item.groupId} -> ${result.groupName} for reason: ${item.reason}\x1b[0m`);
    await recordUserExitFromGroup(item.phone, item.communityId, item.reason);
    await delay(removeDelay, delayOffset);
    return true;
  } else if (result.removed && result.removalType === 'Group') {
    console.log(`\x1b[92mMember ${item.phone} successfully removed from group ${item.groupId} -> ${result.groupName} for reason: ${item.reason}\x1b[0m`);
    await recordUserExitFromGroup(item.phone, item.groupId, item.reason);
    await delay(removeDelay, delayOffset);
    return true;
  }
  return false;
}

export { processRemoveQueue };
