import { configDotenv } from 'dotenv';
import WAWebJS from 'whatsapp-web.js'; // eslint-disable-line no-unused-vars

import { getMemberPhoneNumbers, recordUserEntryToGroup, registerWhatsappAddFulfilled, registerWhatsappAddAttempt } from '../database/pgsql.mjs';
import { getFromAddQueue } from '../database/redis.mjs';
import { addMemberToGroup } from '../utils/clientOperations.mjs';
import { delay } from '../utils/misc.mjs';

configDotenv();

const addDelay = Number(process.env.ADD_DELAY) || 15;
const delayOffset = Number(process.env.DELAY_OFFSET) || 3;

/**
 * Processes a queue of members to be added to a WhatsApp group
 * @async
 * @param {WAWebJS.Client} client - The WhatsApp Web client
 * @returns {Promise<{
 *  added: boolean,  // Whether the member was successfully added
 *  inviteSent: boolean,  // Whether an invite link was sent instead of direct add
 *  alreadyInGroup: boolean,  // Whether the member was already in the group
 *  processedPhones: number,  // Number of phone numbers successfully processed
 *  totalPhones: number  // Total number of phone numbers attempted
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
    return { added: false, inviteSent: false, alreadyInGroup: false, processedPhones: 0, totalPhones: 0 };
  }
  console.log(`\x1b[96mProcessing addition request by member: ${item.registration_id} to group: ${item.group_id}\x1b[0m`);
  const chats = await client.getChats();
  const conversations = chats.filter((chat) => !chat.isGroup);
  const last8DigitsFromChats = conversations.map((chat) => chat.id.user).map((number) => number.slice(-8));
  const memberPhones = await getMemberPhoneNumbers(item.registration_id);

  const group = await client.getChatById(item.group_id);
  const botChatObj = group.participants.find((chatObj) => chatObj.id.user === client.info.wid.user);

  if (!botChatObj.isAdmin) {
    console.log(`\x1b[31mBot is not an admin in group ${group.name} id: ${item.group_id} skipping...\x1b[0m`);
    return { added: false, inviteSent: false, alreadyInGroup: false, processedPhones: 0, totalPhones: 0 };
  }

  if (!memberPhones.length) {
    console.log(`\x1b[31mNo phone numbers found for registration ID: ${item.registration_id}\x1b[0m`);
    return { added: false, inviteSent: false, alreadyInGroup: false, processedPhones: 0, totalPhones: 0 };
  }

  const results = {
    added: false,
    inviteSent: false,
    alreadyInGroup: false,
    processedPhones: 0,
    totalPhones: memberPhones.length,
  };

  for (const phone of memberPhones) {
    if (!phone.phone) continue;
    if (!phone.is_legal_rep && item.group_type === 'RJB') {
      console.log(`\x1b[31mPhone ${phone.phone} is not a legal representative, skipping...\x1b[0m`);
      continue;
    }
    const newPhone = phone.phone.replace(/\D/g, '');
    if (last8DigitsFromChats.includes(newPhone.slice(-8))) {
      const added = await addMemberToGroup(client, newPhone, item.group_id);
      if (added.added) {
        console.log(`\x1b[32mMember ${item.registration_id} was added to group ${item.group_id} with phone ${newPhone}\x1b[0m`);
        await recordUserEntryToGroup(item.registration_id, newPhone, item.group_id, 'Active');
        results.added = true;
        results.processedPhones++;
        await delay(addDelay, delayOffset);
      } else if (added.isInviteV4Sent) {
        console.log(
          `\x1b[32mMember can't be added to groups from someone that is not in the contact list.\nInvite link sent to ${newPhone} for group ${item.group_id}\x1b[0m`
        );
        await recordUserEntryToGroup(item.registration_id, newPhone, item.group_id, 'Active');
        results.inviteSent = true;
        results.processedPhones++;
      } else if (added.alreadyInGroup) {
        console.log(`\x1b[32mPhone ${newPhone} is already in group ${item.group_id}\x1b[0m`);
        await recordUserEntryToGroup(item.registration_id, newPhone, item.group_id, 'Active');
        results.alreadyInGroup = true;
        results.processedPhones++;
      }
    } else {
      console.log(`\x1b[31mPhone ${newPhone} not found in the active chat list.\x1b[0m`);
    }
  }

  if (results.processedPhones > 0) {
    await registerWhatsappAddFulfilled(item.request_id);
    console.log(`\x1b[92mRequest nº: ${item.request_id} by member: ${item.registration_id} to group ${item.group_id} was fulfilled!\x1b[0m`);
    console.log(`\x1b[97mAdded ${results.processedPhones} out of ${results.totalPhones} phone numbers.\x1b[0m`);
    return results;
  }
  await registerWhatsappAddAttempt(item.request_id);
  console.log(`\x1b[31mCould not fullfill request nº: ${item.request_id} by member: ${item.registration_id} to group ${item.group_id}\x1b[0m`);
  return results;
}

export { processAddQueue };
