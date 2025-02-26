import { getWhatsappQueue } from '../database/pgsql.mjs';
import { sendToQueue, getAllFromQueue } from '../database/redis.mjs';

async function addMembersToGroups(groups) {
  const queueItems = [];
  for (const group of groups) {
    try {
      const groupId = group.id._serialized;
      const queue = await getWhatsappQueue(groupId);

      for (const request of queue.rows) {
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
  const currentQueue = await getAllFromQueue();
  const filteredQueueItems = queueItems.filter(
    (item) =>
      !currentQueue.some(
        (i) =>
          i.type === item.type &&
          i.registration_id === item.registration_id &&
          i.group_id === item.group_id,
      ),
  );
  const result = await sendToQueue(filteredQueueItems);
  if (result) {
    console.log(`Added ${filteredQueueItems.length} addition requests to queue!`);
  } else {
    console.error('Error adding requests to queue!');
  }
}

export { addMembersToGroups };
