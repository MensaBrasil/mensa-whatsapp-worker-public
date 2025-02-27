import { configDotenv } from 'dotenv';

import { sendToQueue, getAllFromQueue, disconnect } from '../database/redis.mjs';
import { checkPhoneNumber } from '../utils/phone-check.mjs';
import { triggerTwilioOrRemove } from '../utils/twilio.mjs';

configDotenv();

const dont_remove = process.env.DONT_REMOVE_NUMBERS.split(',');

const jbGroupNames = ['MB | N-SIGs Mensa Brasil', 'MB | Xadrez'];

const JBRemovalRules = [
  {
    groupCheck: (groupName) =>
      groupName.includes('M.JB') && !groupName.includes('R. JB'),
    condition: (checkResult) =>
      checkResult.jb_over_10 && !checkResult.jb_under_10,
    actionMessage: 'User is JB over 10 in M.JB group',
  },
  {
    groupCheck: (groupName) =>
      groupName.includes('JB') &&
      !groupName.includes('M.JB') &&
      !groupName.includes('R. JB'),
    condition: (checkResult) =>
      checkResult.jb_under_10 && !checkResult.jb_over_10,
    actionMessage: 'User is JB under 10 in JB group',
  },
  {
    groupCheck: (groupName) =>
      !groupName.includes('JB') && !jbGroupNames.includes(groupName),
    condition: (checkResult) =>
      checkResult.jb_under_10 || checkResult.jb_over_10,
    actionMessage: 'User is JB in non-JB group',
  },
];

/**
 * Processes groups and their members to identify individuals who should be removed based on various criteria,
 * then adds removal requests to a queue.
 * @async
 * @param {Array<Object>} groups - Array of group objects containing group information and participants
 * @param {Array<Object>} phoneNumbersFromDB - Is a map of processed phone numbers from the database
 * @returns {Promise<void>} - Resolves when all groups have been processed
 * @throws {Error} - Logs error if there's an issue processing a group
 * The function:
 * - Checks each group member against database records
 * - Evaluates removal criteria based on:
 *   - JB (Jovem Brilhante) membership rules
 *   - Member activity status
 *   - Presence in database
 * - Filters out duplicate queue items
 * - Adds filtered removal requests to the queue
 */
async function removeMembersFromGroups(groups, phoneNumbersFromDB) {
  const queueItems = [];
  for (const group of groups) {
    try {
      const groupId = group.id._serialized;
      const participants = group.participants;
      const groupMembers = participants.map((participant) => participant.id.user);

      for (const member of groupMembers) {
        const checkResult = checkPhoneNumber(phoneNumbersFromDB, member);

        if (checkResult.found) {
          if (!(checkResult.is_adult || (checkResult.jb_under_10 && checkResult.jb_over_10))) {
            for (const rule of JBRemovalRules) {
              if (rule.groupCheck(group.name) && rule.condition(checkResult)) {
                const object = {
                  type: 'remove',
                  registration_id: checkResult.mb,
                  groupId: groupId,
                  phone: checkResult.id.user,
                  reason: rule.actionMessage,
                };
                queueItems.push(object);
              }
            }
          } else if (checkResult.status === 'Inactive') {
            const shouldRemove = await triggerTwilioOrRemove(member, 'mensa_inactive');
            if (shouldRemove) {
              const object = {
                type: 'remove',
                registration_id: checkResult.mb,
                groupId: groupId,
                phone: checkResult.id.user,
                reason: 'Inactive',
                communityId: group.announceGroup
              };
              queueItems.push(object);
            }
          }
        } else {
          if (!dont_remove.includes(member)) {
            const object = {
              type: 'remove',
              registration_id: null,
              groupId: groupId,
              phone: member,
              reason: 'Not found in DB',
              communityId: group.announceGroup
            };
            queueItems.push(object);
          }
        }
      }
    } catch (error) {
      console.error(`Error processing group ${group.name}: ${error}`);
    }
  }
  const currentQueue = await getAllFromQueue();
  const filteredQueueItems = queueItems.filter(
    (item) =>
      !currentQueue.some(
        (i) =>
          i.type === item.type &&
          i.registration_id === item.registration_id &&
          i.groupId === item.groupId &&
          i.phone === item.phone,
      ),
  );
  const result = await sendToQueue(filteredQueueItems);
  if (result) {
    console.log(`Added ${filteredQueueItems.length} removal requests to queue!`);
  } else {
    console.error('Error adding requests to queue!');
  }
  await disconnect();
}

export { removeMembersFromGroups };
