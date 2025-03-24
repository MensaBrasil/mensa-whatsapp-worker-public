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
            return { added: false, isInviteV4Sent: false, alreadyInGroup: false };
        }

        const serializePhone = await getSerializedPhone(client, phone);
        if (serializePhone) {
            console.log(`Trying to add member ${phone} --> ${serializePhone} to group ${groupId} --> ${group.name}`);
            const result = await group.addParticipants([serializePhone]);
            console.log(`Add member result: ${JSON.stringify(result)}`);
            if (!result || !result[serializePhone]) {
                return { added: false, isInviteV4Sent: false, alreadyInGroup: false };
            }
            if (result[serializePhone].code === 200) {
                return { added: true, isInviteV4Sent: false, alreadyInGroup: false };
            }
            if (result[serializePhone].code === 409) {
                return { added: false, isInviteV4Sent: false, alreadyInGroup: true };
            }
            if (result[serializePhone].code === 403 && result[serializePhone].isInviteV4Sent) {
                return { added: false, isInviteV4Sent: true, alreadyInGroup: false };
            }
            return { added: false, isInviteV4Sent: false, alreadyInGroup: false };
        } else {
            console.log(`Phone number ${phone} not found in chats`);
            return { added: false, isInviteV4Sent: false, alreadyInGroup: false };
        }

    } catch (error) {
        console.error(`Error adding member ${phone} to group ${groupId}: ${error} ${error.stack}`);
        return { added: false, isInviteV4Sent: false, alreadyInGroup: false };
    }
}

/**
 * Removes a member from a WhatsApp group and optionally from a community
 * @async
 * @param {WAWebJS.Client} client  - The WhatsApp client instance
 * @param {string} phone - The phone number of the member to remove
 * @param {string} groupId - The ID of the group to remove the member from
 * @param {string|boolean} [communityId=false] - The ID of the community to remove the member from (optional)
 * @returns {Promise<{
 *   removed: boolean,
 *   groupName: string | null
 * }>} Result object where:
 *   - removed: true if member was successfully removed
 *   - groupName: name of the group or null if group not found/error occurred
 * @throws {Error} When there's an error during the removal process
 */
async function removeMemberFromGroup(client, phone, groupId, communityId = false) {
    try {
        const group = await client.getChatById(groupId);
        if (communityId !== null && communityId !== undefined && communityId) {
            const community = await client.getChatById(communityId);
            if (!community) {
                console.log(`Community ${communityId} not found... Skipping community removal.`);
            } else {
                const participant = community.participants.find(participant => participant?.id?._serialized?.includes(phone));
                const participantId = participant?.id?._serialized || false;
                if (!participantId) {
                    console.log(`Participant ${phone} not found in community ${communityId}`);
                }
                if (participant.isAdmin) {
                    console.log(`Admins can't be removed from communities... Skipping removal of ${phone} from community ${community.name} --> ID: ${communityId}`);
                    return { removed: false, removalType: null, groupName: community.name };
                }
                console.log(`Trying to remove member ${phone} from community ${communityId}`);
                const result = await community.removeParticipants([participantId]);
                if (result.status === 200) {
                    return { removed: true, removalType: 'Community', groupName: community.name };
                }
            }
        }

        if (!group) {
            console.log(`Group ${groupId} not found`);
            return { removed: false, removalType: null, groupName: null };
        }

        const participant = group.participants.find(participant => participant?.id?._serialized?.includes(phone));
        const participantId = participant?.id?._serialized || false;
        if (!participantId) {
            console.log(`Participant ${phone} not found in group ${groupId}`);
            return { removed: false, removalType: null, groupName: group.name };
        }

        if (participant.isAdmin) {
            console.log(`Admins can't be removed from groups... Skipping removal of ${phone} from group ${group.name} --> ID: ${groupId}`);
            return { removed: false, removalType: null, groupName: group.name };
        }

        console.log(`Trying to remove member ${phone} from group ${groupId}`);
        const result = await group.removeParticipants([participantId]);
        if (result.status === 200) {
            return { removed: true, removalType: 'Group', groupName: group.name };
        }

        return { removed: false, removalType: null, groupName: group.name };
    } catch (error) {
        console.error(`Error removing member ${phone} from group ${groupId}: ${error} ${error.stack}`);
        return { removed: false, removalType: null, groupName: null };
    }
}

export { addMemberToGroup, removeMemberFromGroup };
