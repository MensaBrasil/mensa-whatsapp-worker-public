async function printChats(client) {
    const chats = await client.getChats();
    console.log(chats);
}

//get participants of a group
async function getGroupIdByName(client, groupName) {
    // Fetch all chats
    const chats = await client.getChats();
    
    // Filter group chats
    const groupChats = chats.filter(chat => chat.isGroup);
    
    // Find the group chat with the given name
    const groupChat = groupChats.find(chat => chat.name === groupName);
    
    if (groupChat) {
        // Return the group ID
        return groupChat.id._serialized;
    } else {
        // Return null if no group chat with the given name is found
        return null;
    }
}

async function getGroupParticipants(client, groupId) {
    // Fetch the GroupChat by its ID
    const groupChat = await client.getChatById(groupId);

    if (!groupChat.isGroup) {
        console.log('Chat is not a group chat');
        return [];
    }


    // Iterate over participants and map each to an object containing their ID and admin status
    return groupChat.participants.map(participant => ({
        phone: participant.id.user,
        isAdmin: participant.isAdmin
    }));
}


async function removeParticipantByPhoneNumber(client, groupId, phoneNumber) {
    // Fetch the GroupChat by its ID
    console.log(groupId);
    const groupChat = await client.getChatById(groupId);

    if (!groupChat.isGroup) {
        console.log('Chat is not a group chat');
        return;
    }

    // Format the phone number
    const participantId = `${phoneNumber}@c.us`;

    try {
        await groupChat.removeParticipants([participantId]);
        console.log(`Removed participant: ${phoneNumber}`);
    } catch (error) {
        console.log(`Failed to remove participant: ${phoneNumber}`);
        console.log(error);
    }
}




module.exports = {
    printChats,
    getGroupParticipants,
    getGroupIdByName,
    removeParticipantByPhoneNumber
};
