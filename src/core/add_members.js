
const { getWhatsappQueue, registerWhatsappAddAttempt, registerWhatsappAddFulfilled, getMemberPhoneNumbers } = require('../database/pgsql');


async function add_members_to_group(client, conversations, groupId) {

    // const conversations = chats.filter(chat => !chat.isGroup);
    const queue = await getWhatsappQueue(groupId);
    const last8DigitsFromChats = conversations.map(chat => chat.id.user).map(number => number.slice(-8));
    for (const request of queue.rows) {
        try {
            phones = await getMemberPhoneNumbers(request.registration_id);
            for (const phone of phones) {
                const new_phone = phone.replace(/\D/g, '');
                if (last8DigitsFromChats.includes(new_phone.slice(-8))) {
                    const addResult = await addPhoneNumberToGroup(client, phone, groupId);
                    if (addResult === true) {
                        await registerWhatsappAddFulfilled(request.id);
                        console.log(`Number ${phone} added to group ${groupName}`);
                        logAction(groupName, phone, 'Added', 'Fulfilled');
                        await delay(600000);
                    } else {
                        throw new Error('Addition failed');
                    }
                } else {
                    console.log(`Number ${phone} not found in existing chats. Skipping...`);
                    continue;
                }
            }
        } catch (error) {
            await registerWhatsappAddAttempt(request.id);
            console.error(`Error adding member ${request.registration_id} to group: ${error.message}`);
        }
    }
}


module.exports = add_members_to_group;