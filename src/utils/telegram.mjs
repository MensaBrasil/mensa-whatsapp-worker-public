import { configDotenv } from 'dotenv';

configDotenv();

/**
 * Sends a formatted removal failure message to a Telegram chat using the telegramBot instance.
 *
 * @async
 * @function
 * @param {Object} item - Information about the member who could not be removed
 * @param {string} item.phone - The phone number of the member
 * @param {string} item.registration_id - The registration ID of the member
 * @param {string} item.groupId - The ID of the group the member could not be removed from
 * @param {string} item.communityId - The ID of the community (if applicable)
 * @param {string} item.reason - The reason for attempting removal
 * @param {Object} failureResult - The result object containing details of the removal attempt
 * @param {boolean} failureResult.removed - Whether the member was removed (false in this case)
 * @param {string} failureResult.error - The error message explaining why removal failed
 * @param {string} [failureResult.groupName] - The name of the group (if available)
 * @param {Object} telegramBot - The Telegram bot instance to use for sending the message
 * @returns {Promise<void>} Resolves when the message has been sent to Telegram
 */
async function sendRemovalFailureNotification(
  item,
  failureResult,
  telegramBot,
) {
  const timestamp = new Date().toISOString();

  const groupInfo = failureResult.groupName
    ? `${failureResult.groupName} (${item.groupId})`
    : `${item.groupId}`;

  const communityInfo = item.communityId
    ? `\n<b>Community ID:</b> ${item.communityId}`
    : '';

  const warningText =
    '<b>⚠️ MEMBER REMOVAL FAILED ⚠️</b>\n' +
    `<b>Time:</b> ${timestamp}\n` +
    `<b>Member Phone:</b> ${item.phone}\n` +
    `<b>Registration ID:</b> ${item.registration_id}\n` +
    `<b>Group:</b> ${groupInfo}${communityInfo}\n` +
    `<b>Removal Reason:</b> ${item.reason}\n` +
    `<b>Error:</b> ${failureResult.error}`;

  try {
    await telegramBot.sendMessage(
      process.env.TELEGRAM_CANTREMOVE_CHAT_ID,
      warningText,
      {
        parse_mode: 'HTML',
      },
    );
    console.log(
      `Sent removal failure notification to Telegram for member ${item.phone}`,
    );
  } catch (err) {
    console.error(
      'Failed to send removal failure notification to Telegram:',
      err,
    );
  }
}

export { sendRemovalFailureNotification };
