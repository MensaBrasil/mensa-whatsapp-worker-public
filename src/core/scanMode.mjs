import { getPreviousGroupMembers, recordUserExitFromGroup, recordUserEntryToGroup } from '../database/pgsql.mjs';
import { checkPhoneNumber } from '../utils/phone-check.mjs';

const ignoreNumbers = process.env.DONT_REMOVE_NUMBERS || '';

/**
 * Scans WhatsApp groups to track member changes and record entries/exits.
 * @async
 * @param {Array<Object>} groups - Array of WhatsApp group objects containing group information and participants
 * @param {Array<string>} phoneNumbersFromDB - Is a map of processed phone numbers from the database
 * @throws {Error} Logs error message if scanning fails for a specific group
 * @description
 * For each group, this function:
 * - Gets previous group members
 * - Identifies current members present in the database
 * - Records when users leave the group
 * - Records when new users join the group
 * - Skips processing for numbers in ignoreNumbers list
 */
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
          await recordUserExitFromGroup(previousMember, groupId, 'Left group');
        }
      }
      for (const member of groupMembers) {
        if (ignoreNumbers.includes(member)) {
          continue;
        }
        const checkResult = checkPhoneNumber(phoneNumbersFromDB, member);
        if (!previousMembers.includes(member)) {
          console.log(`Number ${member}, is new to the group, but no match found in the database.`);
          if (checkResult.status){
            console.log(`Number ${member}, MB ${checkResult.mb} is new to the group.`);
            await recordUserEntryToGroup(checkResult.mb, member, groupId, checkResult.status);
          }
        }
      }
    } catch (error) {
      console.error(`Error scanning group ${group.name}: ${error.message}`);
      continue;
    }
  }
}

export { scanGroups };
