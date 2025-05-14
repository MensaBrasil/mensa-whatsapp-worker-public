/**
 * Determines the type of a WhatsApp group based on its name.
 *
 * @async
 * @param {import('whatsapp-web.js').Chat} chat - The chat object representing the group (WAWebJS.Chat).
 * @returns {Promise<string|undefined>} The group type ('MJB', 'RJB', 'JB', 'OrgMB', 'MB', 'NotMensa' or 'NotAGroup').
 */
async function checkGroupType(chat) {
  if (!chat.isGroup) {
    return 'NotAGroup';
  }
  const name = chat.name;
  if (/^M[\s.]*JB/i.test(name)) {
    return 'M.JB';
  } else if (/^R[\s.]*JB/i.test(name)) {
    return 'R.JB';
  } else if (/^(?!R[\s.]*JB)(?!M[\s.]*JB)JB/i.test(name)) {
    return 'JB';
  } else if (/^OrgMB/i.test(name)) {
    return 'OrgMB';
  } else if (/^MB/i.test(name)) {
    return 'MB';
  } else {
    return 'NotMensa';
  }
}

export { checkGroupType };
