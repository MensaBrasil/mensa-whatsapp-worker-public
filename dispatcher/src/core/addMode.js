const { getWhatsappQueue, getMemberPhoneNumbers } = require("../database/pgsql");
const sqs_client = require('../utils/sqs_conn');

async function addMembersToGroups(chats, groups) {
    for (const group of groups) {
        try {
            const groupId = group.id._serialized;
            const conversations = chats.filter(chat => !chat.isGroup);
            const queue = await getWhatsappQueue(groupId);
            const last8DigitsFromChats = conversations.map(chat => chat.id.user).map(number => number.slice(-8));

            for (const request of queue.rows) {
                try {
                    const phones = await getMemberPhoneNumbers(request.registration_id);
                    for (const phone of phones) {
                        const new_phone = phone.replace(/\D/g, '');
                        if (last8DigitsFromChats.includes(new_phone.slice(-8))) {
                            sqs_client.sendMessage({
                                QueueUrl: process.env.SQS_URL,
                                MessageBody: JSON.stringify({
                                    type: 'add',
                                    groupId: groupId,
                                    phone: phone,
                                    registration_id: request.registration_id
                                })
                            });
                        } else {
                            throw new Error('Failed to send request to the queue.');
                        }
                    }
                } catch (error) {
                    console.error(`Error sending request to add: ${request.registration_id} to group: ${error.message}`);
                }
            }
        } catch (error) {
            console.error(`Error adding members to group ${group.name}: ${error.message}`);
        }
    }
}

module.exports = addMembersToGroups;
