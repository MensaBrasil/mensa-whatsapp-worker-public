import { getWhatsappQueue } from '../database/pgsql.mjs';
import { sendToQueue, clearQueue, disconnect, testRedisConnection } from '../database/redis.mjs';

/**
 * Processes groups and adds members to a queue for WhatsApp group addition by the workers.
 * @async
 * @param {Array<Object>} groups - Array of WhatsApp group objects containing group information
 * @param {Object} groups[].id - Group ID object
 * @param {string} groups[].id._serialized - Serialized group ID
 * @param {string} groups[].name - Group name
 * @returns {Promise<void>} - Resolves when all queue items have been processed
 * @throws {Error} - If there's an error processing groups or adding to queue
 * @description
 * This function:
 * 1. Retrieves the WhatsApp queue for each group
 * 2. Creates queue items for member additions
 * 3. Filters out duplicate requests
 * 4. Sends filtered requests to the main queue
 * 5. Logs the result of the operation
 */
async function addMembersToGroups(groups) {
  await testRedisConnection();
  const queueItems = [];
  for (const group of groups) {
    try {
      const groupId = group.id._serialized;
      const queue = await getWhatsappQueue(groupId);

      for (const request of queue) {
        try {
          const object = {
            type: 'add',
            registration_id: request.registration_id,
            group_id: groupId,
          };

          queueItems.push(object);
        } catch (error) {
          console.error(
            `Error sending request to add: ${request.registration_id} to group: ${groupId} - ${error.message}`,
          );
        }
      }
    } catch (error) {
      console.error(
        `Error adding members to group ${group.name}: ${error.message}`,
      );
    }
  }
  await clearQueue('addQueue');
  const result = await sendToQueue(queueItems, 'addQueue');
  if (result) {
    console.log(`Added ${queueItems.length} addition requests to queue!`);
  } else {
    console.error('Error adding requests to queue!');
  }
  await disconnect();
}

export { addMembersToGroups };
