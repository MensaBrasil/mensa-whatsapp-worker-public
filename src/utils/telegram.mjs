import { configDotenv } from 'dotenv';

configDotenv();

/**
 * Sends a formatted removal failure message to a Telegram chat using the telegramBot instance.
 *
 * @async
 * @function
 * @param {Object} memberInfo - Information about the member who could not be removed
 * @param {string} memberInfo.phone - The phone number of the member
 * @param {string} memberInfo.registration_id - The registration ID of the member
 * @param {string} memberInfo.groupId - The ID of the group the member could not be removed from
 * @param {string} memberInfo.communityId - The ID of the community (if applicable)
 * @param {string} memberInfo.reason - The reason for attempting removal
 * @param {Object} result - The result object containing details of the removal attempt
 * @param {boolean} result.removed - Whether the member was removed (false in this case)
 * @param {string} result.error - The error message explaining why removal failed
 * @param {string} [result.groupName] - The name of the group (if available)
 * @param {Object} telegramBot - The Telegram bot instance to use for sending the message
 * @returns {Promise<void>} Resolves when the message has been sent to Telegram
 */
async function sendRemovalFailureNotification(memberInfo, result, telegramBot) {
  const timestamp = new Date().toISOString();

  const groupInfo = result.groupName ? `${result.groupName} (${memberInfo.groupId})` : `${memberInfo.groupId}`;

  const communityInfo = memberInfo.communityId ? `\n<b>Community ID:</b> ${memberInfo.communityId}` : '';

  const warningText =
    '<b>⚠️ MEMBER REMOVAL FAILED ⚠️</b>\n' +
    `<b>Time:</b> ${timestamp}\n` +
    `<b>Member Phone:</b> ${memberInfo.phone}\n` +
    `<b>Registration ID:</b> ${memberInfo.registration_id}\n` +
    `<b>Group:</b> ${groupInfo}${communityInfo}\n` +
    `<b>Removal Reason:</b> ${memberInfo.reason}\n` +
    `<b>Error:</b> ${result.error}`;

  try {
    await telegramBot.sendMessage(process.env.TELEGRAM_CANTREMOVE_CHAT_ID, warningText, {
      parse_mode: 'HTML',
    });
    console.log(`Sent removal failure notification to Telegram for member ${memberInfo.phone}`);
  } catch (err) {
    console.error('Failed to send removal failure notification to Telegram:', err);
  }
}

export { sendRemovalFailureNotification };
