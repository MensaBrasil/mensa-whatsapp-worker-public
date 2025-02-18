async function getGroupParticipants(client, groupId) {
  // Fetch the GroupChat by its ID
  const groupChat = await client.getChatById(groupId);

  if (!groupChat.isGroup) {
    console.log('Chat is not a group chat');
    return [];
  }

  return groupChat.participants.map(participant => ({
    phone: participant.id.user,
    isAdmin: participant.isAdmin
  }));
}

module.exports = getGroupParticipants;
