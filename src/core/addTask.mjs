import WAWebJS from 'whatsapp-web.js'; // eslint-disable-line no-unused-vars

import { getMemberPhoneNumbers, recordUserEntryToGroup, registerWhatsappAddFulfilled, registerWhatsappAddAttempt } from '../database/pgsql.mjs';
import { getFromAddQueue } from '../database/redis.mjs';
import { addMemberToGroup } from '../utils/clientOperations.mjs';


/**
 * Processes a queue of members to be added to a WhatsApp group
 * @async
 * @param {WAWebJS.Client} client - The WhatsApp Web client
 * @returns {Promise<{
 *  added: boolean,  // Whether the member was successfully added or invite sent
 *  inviteSent: boolean  // Whether an invite link was sent instead of direct add
 *  alreadyInGroup: boolean  // Whether the member was already in the group
 * }>}
 * @throws {Error} If there are issues accessing chats or adding members
 * @description
 * This function:
 * 1. Gets next item from add queue
 * 2. Checks if bot is admin in target group
 * 3. Gets member phone numbers from registration
 * 4. Attempts to add members to group or send invite
 * 5. Records successful additions to database
 */
async function processAddQueue(client) {
    const item = await getFromAddQueue();
    if (!item) {
        console.log('No items in the addQueue');
        return { added: false, inviteSent: false, alreadyInGroup: false };
    }
    const chats = await client.getChats();
    const conversations = chats.filter(chat => !chat.isGroup);
    const last8DigitsFromChats = conversations.map(chat => chat.id.user).map(number => number.slice(-8));
    const memberPhones = await getMemberPhoneNumbers(item.registration_id);

    const group = await client.getChatById(item.group_id);
    const botChatObj = group.participants.find(chatObj => chatObj.id.user === client.info.wid.user);

    if (!botChatObj.isAdmin) {
        console.log(`Bot is not an admin in group ${group.name} id: ${item.group_id} skipping...`);
        return { added: false, inviteSent: false, alreadyInGroup: false };
    }

    for (const phone of memberPhones) {
        const newPhone = phone.replace(/\D/g, '');
        if (last8DigitsFromChats.includes(newPhone.slice(-8))) {
            const added = await addMemberToGroup(client, phone, item.group_id);
            if (added.added) {
                console.log(`Member ${phone} added to group ${item.group_id}`);
                await recordUserEntryToGroup(item.registration_id, phone, item.group_id, 'Active');
                await registerWhatsappAddFulfilled(item.request_id);
                return { added: true, inviteSent: false, alreadyInGroup: false };
            }
            if (added.isInviteV4Sent) {
                console.log(`Member can't be added to groups from someone that is not in the contact list.\nInvite link sent to ${phone} for group ${item.group_id}`);
                await recordUserEntryToGroup(item.registration_id, phone, item.group_id, 'Active');
                await registerWhatsappAddFulfilled(item.request_id);
                return { added: false, inviteSent: true, alreadyInGroup: false };
            }
            if (added.alreadyInGroup) {
                console.log(`Member ${phone} is already in group ${item.group_id}`);
                await recordUserEntryToGroup(item.registration_id, phone, item.group_id, 'Active');
                await registerWhatsappAddFulfilled(item.request_id);
                return { added: false, inviteSent: false, alreadyInGroup: true };
            }
        }
        console.log(`Member ${phone} not found in the active chat list.`);
    }
    await registerWhatsappAddAttempt(item.request_id);
    console.log(`Could not add ${phone} to group ${item.group_id}`);
    return { added: false, inviteSent: false, alreadyInGroup: false };
}

export { processAddQueue };
