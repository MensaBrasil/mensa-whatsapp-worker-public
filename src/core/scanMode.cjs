const { getPreviousGroupMembers, recordUserExitFromGroup, recordUserEntryToGroup } = require('../database/pgsql.cjs');
const { checkPhoneNumber } = require('../utils/phone-check.cjs');

async function scanGroups(groups, phoneNumbersFromDB) {
  for (const group of groups) {
    try {
      console.log(`Scanning group: ${group.name}`);
      const groupId = group.id._serialized;
      const previousMembers = await getPreviousGroupMembers(groupId);

      const participants = group.participants;
      const groupMembers = participants.map((participant) => participant.id.user);
      const currentMembers = groupMembers.filter((member) => checkPhoneNumber(phoneNumbersFromDB, member).found);

      for (const previousMember of previousMembers) {
        if (!currentMembers.includes(previousMember)) {
          console.log(`Number ${previousMember} is no longer in the group.`);
          // await recordUserExitFromGroup(previousMember, groupId, 'Left group');
        }
      }
      for (const member of groupMembers) {
        const checkResult = checkPhoneNumber(phoneNumbersFromDB, member);
        if (!previousMembers.includes(member)) {
          console.log(`Number ${member}, is new to the group, but no match found in the database.`);
          if (checkResult.status){
            console.log(`Number ${member}, MB ${checkResult.mb} is new to the group.`);
            // await recordUserEntryToGroup(checkResult.mb, member, groupId, checkResult.status);
          }
        }
      }
    } catch (error) {
      console.error(`Error scanning group ${group.name}: ${error.message}`);
      continue;
    }
  }
}

module.exports = { scanGroups };
