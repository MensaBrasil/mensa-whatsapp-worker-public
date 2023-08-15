require('dotenv').config();

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


async function sendMessageToNumber(client, phoneNumber, message) {
    try {
      const chat = await client.getChatById(`${phoneNumber}@c.us`);
      if (chat) {
        await chat.sendMessage(message);
        console.log(`Message sent to ${phoneNumber}`);
      } else {
        console.log(`Failed to send message to ${phoneNumber}: Chat not found.`);
      }
    } catch (error) {
      console.error(`Error sending message to ${phoneNumber}: ${error.message}`);
    }
  }
  

  async function sendMessageToNumberAPI(client, phoneNumber, message) {
    const endpoint = "https://graph.facebook.com/v17.0/106463662546945/messages";
    const token = process.env.FB_TOKEN;
  
    const payload = {
      messaging_product: "whatsapp",
      to: phoneNumber,
      type: "template",
      template: {
        name: message,
        language: {
          code: "pt_BR"
        }
      }
    };
  
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
  
      const result = await response.json();
      //console.log(result)
      return result;
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  }

  async function removeParticipantByPhoneNumber(client, groupId, phoneNumber) {
    try {
        const groupChat = await client.getChatById(groupId);
        const participantId = groupChat.participants.find(participant => participant.id._serialized.includes(phoneNumber)).id._serialized;
        
        if (participantId) {
            console.log(`Attempting to remove participant: ${participantId}`);
            await groupChat.removeParticipants([participantId]);
            console.log(`Successfully removed participant: ${participantId}`);
        } else {
            console.error(`Unable to find participant with phone number ${phoneNumber} in group ${groupId}`);
        }
    } catch (error) {
        console.error(`Failed to remove participant with phone number ${phoneNumber} from group ${groupId}.`, error);
    }
}



module.exports = {
    printChats,
    getGroupParticipants,
    getGroupIdByName,
    removeParticipantByPhoneNumber,
    sendMessageToNumber,
    sendMessageToNumberAPI
};
