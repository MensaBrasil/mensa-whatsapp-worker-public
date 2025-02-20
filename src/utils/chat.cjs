async function getGroupParticipants(client, groupId) {
  const groupChat = await client.getChatById(groupId);

  if (!groupChat.isGroup) {
    return [];
  }

  return groupChat.participants.map((participant) => ({
    phone: participant.id.user,
    isAdmin: participant.isAdmin,
  }));
}

module.exports = { getGroupParticipants };
