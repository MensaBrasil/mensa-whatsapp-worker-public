import { send_to_queue } from '../database/redis.mjs';
import { getGroupParticipants } from '../utils/chat.mjs';
import { checkPhoneNumber } from '../utils/phone-check.mjs';
import { triggerTwilioOrRemove } from '../utils/twilio.mjs';
import { configDotenv } from 'dotenv';

configDotenv();

dont_remove = process.env.DONT_REMOVE_NUMBERS.split(',');

const jbGroupNames = [
    'MB | N-SIGs Mensa Brasil',
    'MB | Xadrez',
];

const JBRemovalRules = [
    {
        groupCheck: (groupName) =>
            groupName.includes('M.JB') &&
            !groupName.includes('R. JB'),
        condition: (checkResult) =>
            checkResult.jb_over_10 && !checkResult.jb_under_10,
        actionMessage: 'User is JB over 10 in M.JB group'
    },
    {
        groupCheck: (groupName) =>
            groupName.includes('JB') &&
            !groupName.includes('M.JB') &&
            !groupName.includes('R. JB'),
        condition: (checkResult) =>
            checkResult.jb_under_10 && !checkResult.jb_over_10,
        actionMessage: 'User is JB under 10 in JB group'
    },
    {
        groupCheck: (groupName) =>
            !groupName.includes('JB') &&
            !jbGroupNames.includes(groupName),
        condition: (checkResult) =>
            checkResult.jb_under_10 || checkResult.jb_over_10,
        actionMessage: 'User is JB in non-JB group',
    },
];

async function removeMembersFromGroups(client, groups, phoneNumbersFromDB) {
    for (const group of groups) {
        try {
            const groupId = group.id._serialized;
            const participants = await getGroupParticipants(client, groupId);
            const groupMembers = participants.map(participant => participant.id._serialized);
            for (const member of groupMembers) {
                const checkResult = checkPhoneNumber(phoneNumbersFromDB, member);

                if (checkResult.found) {
                    if (!(checkResult.is_adult || (checkResult.jb_under_10 && checkResult.jb_over_10))) {
                        for (const rule of JBRemovalRules) {
                            if (rule.groupCheck(group.name) && rule.condition(checkResult)) {
                                const object = {
                                    type: 'remove',
                                    registration_id: checkResult.registration_id,
                                    groupId: groupId,
                                    phone: checkResult.phone,
                                    reason: rule.actionMessage
                                };
                                await send_to_queue(object);
                            }
                        }
                    }

                    if (checkResult.status === 'Inactive') {
                        console.log(`Number ${member}, MB ${checkResult.mb} is inactive.`);
                        const shouldRemove = await triggerTwilioOrRemove(member, 'mensa_inactive');
                        if (shouldRemove) {
                            sqs_client.sendMessage({
                                QueueUrl: process.env.SQS_URL,
                                MessageBody: JSON.stringify({
                                    type: 'remove',
                                    groupId: groupId,
                                    phone: checkResult.phone,
                                    registration_id: checkResult.registration_id,
                                    reason: 'Inactive'
                                })
                            });
                        }
                    }

                } else {
                    if (!dont_remove.includes(member)) {
                        console.log(`Number ${member} not found in the database.`);
                        sqs_client.sendMessage({
                            QueueUrl: process.env.SQS_URL,
                            MessageBody: JSON.stringify({
                                type: 'remove',
                                groupId: groupId,
                                phone: checkResult.phone,
                                registration_id: checkResult.registration_id,
                                reason: 'Not found in database'
                            })
                        });
                    }
                }
            }

        } catch (error) {
            console.error(`Error in group ${group.name}: ${error}`);
        }
    }
}

export { removeMembersFromGroups };
