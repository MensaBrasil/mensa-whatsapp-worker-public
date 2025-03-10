import WAWebJS from 'whatsapp-web.js'; // eslint-disable-line no-unused-vars

import { getSerializedPhone } from './misc.mjs';

/**
 * Attempts to add a member to a WhatsApp group
 * @async
 * @param {WAWebJS.Client} client - The WhatsApp client instance
 * @param {string} phone - The phone number of the member to add
 * @param {string} groupId - The ID of the group to add the member to
 * @returns {Promise<{
 *   added: boolean,
 *   isInviteV4Sent: boolean,
 *   alreadyInGroup: boolean
 * }>} Result object where:
 *   - added: true if member was successfully added
 *   - isInviteV4Sent: true if an invite link was sent instead
 *   - alreadyInGroup: true if member is already in the group
 * @throws {Error} When there's an error adding the member to the group
 */
async function addMemberToGroup(client, phone, groupId) {
    try {
        const group = await client.getChatById(groupId);
        if (!group) {
            console.log(`Group ${groupId} not found`);
            return { added: false, isInviteV4Sent: false , alreadyInGroup : false};
        }

        const serializePhone = await getSerializedPhone(client, phone);
        if (serializePhone) {
            console.log(`Trying to add member ${phone} --> ${serializePhone} to group ${groupId} --> ${group.name}`);
            const result = await group.addParticipants([serializePhone]);
            console.log(`Add member result: ${JSON.stringify(result)}`);
            if (!result || !result[serializePhone]) {
                return { added: false, isInviteV4Sent: false , alreadyInGroup : false};
            }
            if (result[serializePhone].code === 200) {
                return { added: true, isInviteV4Sent: false , alreadyInGroup : false};
            }
            if (result[serializePhone].code === 409) {
                return { added: false, isInviteV4Sent: false , alreadyInGroup : true};
            }
            if (result[serializePhone].code === 403 && result[serializePhone].isInviteV4Sent) {
                return { added: false, isInviteV4Sent: true , alreadyInGroup : false};
            }
            return { added: false, isInviteV4Sent: false , alreadyInGroup : false};
        } else {
            console.log(`Phone number ${phone} not found in chats`);
            return { added: false, isInviteV4Sent: false , alreadyInGroup : false};
        }

    } catch (error) {
        console.error(`Error adding member ${phone} to group ${groupId}: ${error} ${error.stack}`);
        return { added: false, isInviteV4Sent: false , alreadyInGroup : false};
    }
}

/**
 * Removes a member from a WhatsApp group and optionally from a community
 * @async
 * @param {WAWebJS.Client} client  - The WhatsApp client instance
 * @param {string} phone - The phone number of the member to remove
 * @param {string} groupId - The ID of the group to remove the member from
 * @returns {Promise<{
 *   removed: boolean,
 *   groupName: string | null
 * }>} Result object where:
 *   - removed: true if member was successfully removed
 *   - groupName: name of the group or null if group not found/error occurred
 * @throws {Error} When there's an error during the removal process
 */
async function removeMemberFromGroup(client, phone, groupId) {
    try {
        const group = await client.getChatById(groupId);
        if (!group) {
            console.log(`Group ${groupId} not found`);
            return { removed: false, groupName: null};
        }

        const participantId = group.participants.find(participant => participant.id._serialized.includes(phone)).id._serialized;
        if (!participantId) {
            console.log(`Participant ${phone} not found in group ${groupId} -> ${group.name}`);
            return { removed: false, groupName: group.name};
        }

        console.log(`Trying to remove member ${phone} from group ${groupId} -> ${group.name}`);
        const result = await group.removeParticipants([participantId]);
        if (result.status === 200) {
            return { removed: true, groupName: group.name};
        }

        return { removed: false, groupName: group.name};
    } catch (error) {
        console.error(`Error removing member ${phone} from group ${groupId}: ${error} ${error.stack}`);
        return { removed: false, groupName: null};
    }
}

export { addMemberToGroup, removeMemberFromGroup };
