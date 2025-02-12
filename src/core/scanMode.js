const { getGroupIdByName } = require("../utils/chat");
const { getPreviousGroupMembers, recordUserExitFromGroup, recordUserEntryToGroup } = require("../database/pgsql");
const { checkPhoneNumber } = require("../utils/phone-check");
const { getGroupParticipants } = require("../utils/chat");
const logAction = require("../utils/misc");

async function scanGroups(client, groupNames, phoneNumbersFromDB) {
    for (const groupName of groupNames) {
        try {
            console.log(`Scanning group: ${groupName}`);
            const groupId = await getGroupIdByName(client, groupName);
            const previousMembers = await getPreviousGroupMembers(groupId);

            const participants = await getGroupParticipants(client, groupId);
            const groupMembers = participants.map(participant => participant.phone);
            const currentMembers = groupMembers.filter(member => checkPhoneNumber(phoneNumbersFromDB, member).found);

            for (const previousMember of previousMembers) {
                if (!currentMembers.includes(previousMember)) {
                    console.log(`Number ${previousMember} is no longer in the group.`);
                    await recordUserExitFromGroup(previousMember, groupId, 'Left group');
                    logAction(groupName, previousMember, 'Exit', 'Left group');
                }
            }
            for (const member of groupMembers) {
                const checkResult = checkPhoneNumber(phoneNumbersFromDB, member);
                if (!previousMembers.includes(member)) {
                    console.log(`Number ${member}, MB ${checkResult.mb} is new to the group.`);
                    await recordUserEntryToGroup(checkResult.mb, member, groupId, checkResult.status);
                    logAction(groupName, member, 'Entry', 'New to group');
                }
            }
        } catch (error) {
            console.error(`Error scanning group ${groupName}: ${error.message}`);
            continue;
        }
    }
}

module.exports = scanGroups;