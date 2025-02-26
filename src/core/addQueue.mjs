import { getWhatsappQueue } from '../database/pgsql.mjs';
import { send_to_queue, get_all_queue_itens } from '../database/redis.mjs';

async function addMembersToGroups(groups) {
  const current_queue = await get_all_queue_itens();
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
          if (current_queue.includes(JSON.stringify(object))) {
            continue;
          }
          await send_to_queue(object);
          console.log(
            `Sent to queue: Addition of ${request.registration_id} to group: ${groupId}`,
          );
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
}

export { addMembersToGroups };
