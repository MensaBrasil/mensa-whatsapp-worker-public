const { send_to_queue, get_all_queue_itens } = require('../database/redis.cjs');
const { getGroupParticipants } = require('../utils/chat.cjs');
const { checkPhoneNumber } = require('../utils/phone-check.cjs');
const { triggerTwilioOrRemove } = require('../utils/twilio.cjs');
const { configDotenv } = require('dotenv');

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

async function removeMembersFromGroups(client, groups, phoneNumbersFromDB) {
  const current_queue = await get_all_queue_itens();
  for (const group of groups) {
    try {
      const groupId = group.id._serialized;
      const participants = await getGroupParticipants(client, groupId);
      const groupMembers = participants.map((participant) => participant.id._serialized);

      for (const member of groupMembers) {
        const checkResult = checkPhoneNumber(phoneNumbersFromDB, member);

        if (checkResult.found) {
          const newObj = {
            type: 'remove',
            registration_id: checkResult.registration_id,
            groupId: groupId,
            phone: checkResult.phone,
          };

          if (current_queue.some(item => {
            const parsed = JSON.parse(item);
            return parsed.type === newObj.type &&
              parsed.registration_id === newObj.registration_id &&
              parsed.groupId === newObj.groupId &&
              parsed.phone === newObj.phone;
          })) {
            continue;
          }

          if (!(checkResult.is_adult || (checkResult.jb_under_10 && checkResult.jb_over_10))) {
            for (const rule of JBRemovalRules) {
              if (rule.groupCheck(group.name) && rule.condition(checkResult)) {
                const object = {
                  type: 'remove',
                  registration_id: checkResult.registration_id,
                  groupId: groupId,
                  phone: checkResult.phone,
                  reason: rule.actionMessage,
                };
                await send_to_queue(object);
                console.log(`Sent to queue: Removal of ${checkResult.phone} from ${group.name} - ${rule.actionMessage}`);
              }
            }
          } else if (checkResult.status === 'Inactive') {
            const shouldRemove = await triggerTwilioOrRemove(member, 'mensa_inactive');
            if (shouldRemove) {
              const object = {
                type: 'remove',
                registration_id: checkResult.registration_id,
                groupId: groupId,
                phone: checkResult.phone,
                reason: 'Inactive',
              };
              await send_to_queue(object);
              console.log(`Sent to queue: Removal of ${checkResult.phone} from ${group.name} - Inactive`);
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
            };
            await send_to_queue(object);
            console.log(`Sent to queue: Removal of ${member} from ${group.name} - Not found in DB`);
          }
        }
      }
    } catch (error) {
      console.error(`Error processing group ${group.name}: ${error}`);
    }
  }
}

module.exports = { removeMembersFromGroups };
