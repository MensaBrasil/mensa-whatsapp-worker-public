/**
 * Processes WhatsApp chats to categorize and organize different types of groups
 * @param {import('whatsapp-web.js').Client} client - The WhatsApp Web client instance
 * @returns {Promise<{
 *   chats: import('whatsapp-web.js').Chat[],
 *   groups: import('whatsapp-web.js').GroupChat[]
 * }>} Object containing all chats and regular groups
 * @description
 * This function:
 * 1. Retrieves all chats from the WhatsApp client
 * 2. Categorizes groups into:
 *    - allGroups + announce groups + community groups (non-readonly, non-parent groups)
 *    - regularGroups: groups that are not parent groups (non-community groups)
 *    - Announce groups (groups with announce flag and default subgroup)
 *    - groups: regular groups that are not announce groups
 * 
 * 3. Maps groups to their corresponding announce groups if they are subgroups of the same community group
 * 4. Returns all chats and processed regular groups
 */
async function processGroups(client) {
    const chats = await client.getChats();

    const allGroups = chats.filter((chat) => (chat.isGroup && !chat.isReadOnly));
    const regularGroups = allGroups.filter((group) => !group.groupMetadata.isParentGroup);
    const announceGroups = allGroups.filter((group) => group.groupMetadata.announce && group.groupMetadata.defaultSubgroup);
    const groups = regularGroups.filter((group) => !announceGroups.find(announceGroup => announceGroup.id._serialized === group.id._serialized)).sort((a, b) => a.name.localeCompare(b.name));

    for (const group of groups) {
        if (!group.groupMetadata.parentGroup) {
            continue;
        }
        const relatedAnnounceGroup = announceGroups.find(announceGroup => announceGroup.groupMetadata.parentGroup._serialized === group.groupMetadata.parentGroup._serialized);
        if (relatedAnnounceGroup) {
            group.announceGroup = relatedAnnounceGroup.id._serialized;
        }
    }
    return { chats, groups };
}

export { processGroups };
