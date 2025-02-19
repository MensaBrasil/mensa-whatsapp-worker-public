import { getPreviousGroupMembers, recordUserExitFromGroup, recordUserEntryToGroup } from '../database/pgsql.mjs';
import { checkPhoneNumber } from '../utils/phone-check.mjs';
import { getGroupParticipants } from '../utils/chat.mjs';

async function scanGroups(client, groups, phoneNumbersFromDB) {
  for (const group of groups) {
    try {
      console.log(`Scanning group: ${group.name}`);
      const groupId = group.id._serialized;
      const previousMembers = await getPreviousGroupMembers(groupId);

      const participants = await getGroupParticipants(client, groupId);
      const groupMembers = participants.map((participant) => participant.phone);
      const currentMembers = groupMembers.filter((member) => checkPhoneNumber(phoneNumbersFromDB, member).found);

      for (const previousMember of previousMembers) {
        if (!currentMembers.includes(previousMember)) {
          console.log(`Number ${previousMember} is no longer in the group.`);
          await recordUserExitFromGroup(previousMember, groupId, 'Left group');
        }
      }
      for (const member of groupMembers) {
        const checkResult = checkPhoneNumber(phoneNumbersFromDB, member);
        if (!previousMembers.includes(member)) {
          console.log(`Number ${member}, MB ${checkResult.mb} is new to the group.`);
          await recordUserEntryToGroup(checkResult.mb, member, groupId, checkResult.status);
        }
      }
    } catch (error) {
      console.error(`Error scanning group ${group.name}: ${error.message}`);
      continue;
    }
  }
}

export { scanGroups };
