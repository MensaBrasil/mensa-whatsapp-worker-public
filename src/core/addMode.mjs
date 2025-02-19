import { getWhatsappQueue } from '../database/pgsql.mjs';
import { send_to_queue } from '../database/redis.mjs';

async function addMembersToGroups(groups) {
    for (const group of groups) {
        try {
            const groupId = group.id._serialized;
            const queue = await getWhatsappQueue(groupId);

            for (const request of queue.rows) {
                try {
                    const object = { type: 'add', registration_id: request.registration_id, group_id: groupId };
                    await send_to_queue(object);
                    console.log(`Sent to queue: type=add, registration_id=${request.registration_id}, group_id=${groupId}`);
                } catch (error) {
                    console.error(`Error sending request to add: ${request.registration_id} to group: ${groupId} - ${error.message}`);
                }
            }

        } catch (error) {
            console.error(`Error adding members to group ${group.name}: ${error.message}`);
        }
    }
}

export { addMembersToGroups };
