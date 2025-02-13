const { getGroupIdByName, getGroupParticipants, removeParticipantByPhoneNumber } = require("../utils/chat");
const { recordUserExitFromGroup } = require("../database/pgsql");
const { checkPhoneNumber } = require("../utils/phone-check");
const { triggerTwilioOrRemove } = require("../utils/twilio");
const { logAction, delay } = require("../utils/misc");

const jbGroupNames = [
    "MB | N-SIGs Mensa Brasil",
    "MB | Xadrez",
];

const JBRemovalRules = [
    {
        groupCheck: (groupName) =>
            groupName.includes("M.JB") &&
            !groupName.includes("R. JB"),
        condition: (checkResult) =>
            checkResult.jb_over_10 && !checkResult.jb_under_10,
        actionMessage: 'User is JB over 10 in M.JB group'
    },
    {
        groupCheck: (groupName) =>
            groupName.includes("JB") &&
            !groupName.includes("M.JB") &&
            !groupName.includes("R. JB"),
        condition: (checkResult) =>
            checkResult.jb_under_10 && !checkResult.jb_over_10,
        actionMessage: 'User is JB under 10 in JB group'
    },
    {
        groupCheck: (groupName) =>
            !groupName.includes("JB") &&
            !jbGroupNames.includes(groupName),
        condition: (checkResult) =>
            checkResult.jb_under_10 || checkResult.jb_over_10,
        actionMessage: 'User is JB in non-JB group',
    },
];

async function removeMembersFromGroups(client, groupNames, phoneNumbersFromDB) {
    for (const groupName in groupNames) {
        try {
            const groupId = await getGroupIdByName(client, groupName);
            const participants = await getGroupParticipants(client, groupId);
            const groupMembers = participants.map(participant => participant.id._serialized);
            for (const member of groupMembers) {
                const checkResult = checkPhoneNumber(phoneNumbersFromDB, member);
                let reason = null;

                if (checkResult.found) {
                    if (checkResult.is_adult || (checkResult.jb_under_10 && checkResult.jb_over_10)) {
                        console.log(`Skipping JB removal for ${member} (adult or ambiguous JB status).`);
                    } else {
                        for (const rule of JBRemovalRules) {
                            if (rule.groupCheck(groupName) && rule.condition(checkResult)) {
                                console.log(`Removing ${member} (${rule.actionMessage}) from ${groupName}.`);
                                const removed = await removeParticipantByPhoneNumber(client, groupId, member);
                                if (removed) {
                                    reason = rule.actionMessage;
                                    logAction(groupName, member, 'Removal', reason);
                                    await delay(300000);
                                }
                            }
                        }
                    }

                    if (checkResult.status === 'Inactive') {
                        console.log(`Number ${member}, MB ${checkResult.mb} is inactive.`);
                        const shouldRemove = await triggerTwilioOrRemove(member, "mensa_inactive");
                        if (shouldRemove) {
                            const removed = await removeParticipantByPhoneNumber(client, groupId, member);
                            if (removed) {
                                reason = 'Inactive';
                                logAction(groupName, member, 'Removal', reason);
                                await delay(300000);
                            }
                        }
                    }

                } else {
                    if (member !== '+33681604260' && member !== '18653480874' && member !== '36705346911' && member !== '351926855059' && member !== '447863603673' && member !== '4915122324805' && member !== '62999552046' && member !== '15142676652' && member !== "556299552046" && member !== '447782796843' && member !== '555496875059' && member !== '34657489744' && member !== '5511914206718') {
                        console.log(`Number ${member} not found in the database.`);
                        const shouldRemove = await triggerTwilioOrRemove(member, "mensa_not_found");
                        if (shouldRemove) {
                            const removed = await removeParticipantByPhoneNumber(client, groupId, member);
                            if (removed) {
                                reason = 'Not found in database';
                                logAction(groupName, member, 'Removal', reason);
                                await delay(300000);
                            }
                        }
                    }
                }

                await recordUserExitFromGroup(member, groupId, reason);

            }

        } catch (error) {
            console.error(`Error in group ${groupName}: ${error}`);
        }
        await fetch(process.env.UPTIME_URL);
    }
}

module.exports = removeMembersFromGroups;
