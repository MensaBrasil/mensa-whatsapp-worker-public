import TelegramBot from 'node-telegram-bot-api'; // eslint-disable-line no-unused-vars
import OpenAI from 'openai';  // eslint-disable-line no-unused-vars
import WAWebJS from 'whatsapp-web.js';  // eslint-disable-line no-unused-vars

/**
 * Sends a formatted flagged message log to a Telegram chat using the telegramBot instance.
 *
 * @async
 * @function
 * @param {Object} message - The message object containing details about the flagged message.
 * @param {number} message.timestamp - The Unix timestamp (in seconds) of when the message was sent.
 * @param {string} [message.author] - The author of the message (optional).
 * @param {string} [message.from] - The sender of the message (optional, used if author is not present).
 * @param {string} message.body - The content of the message.
 * @param {Object} chat - The chat object containing group information.
 * @param {string} chat.name - The name of the group where the message was sent.
 * @param {Object} flaggedResult - The result object containing flagged categories and scores.
 * @param {Object.<string, boolean>} flaggedResult.categories - An object mapping category names to boolean flags indicating if they were triggered.
 * @param {Object.<string, number>} flaggedResult.category_scores - An object mapping category names to their respective scores.
 * @param {Object.<string, string[]>} [flaggedResult.category_applied_input_types] - An optional object mapping category names to arrays of input modality types.
 * @param {Object} telegramBot - The Telegram bot instance to use for sending the message.
 * @returns {Promise<void>} Resolves when the message has been sent to Telegram.
 */
async function sendTelegramFlaggedLog(message, chat, flaggedResult, telegramBot) {
  const flaggedCatsInline = Object.entries(flaggedResult.categories)
    .filter(([, flag]) => flag)
    .map(
      ([cat]) =>
        `<b>${cat}</b> (<code>${flaggedResult.category_scores[cat].toFixed(
          3
        )}</code>)`
    )
    .join(', ');
  const modalitiesSet = new Set();
  if (flaggedResult.category_applied_input_types) {
    Object.values(flaggedResult.category_applied_input_types).forEach(
      (types) => {
        types.forEach((t) => modalitiesSet.add(t));
      }
    );
  }
  const modalitiesLine = Array.from(modalitiesSet).join(', ');

  const flaggedText =
    '<b>Flagged Message</b>\n' +
    `<b>Time:</b> ${new Date(message.timestamp * 1000).toISOString()}\n` +
    `<b>Sender:</b> ${message.author ?? message.from}\n` +
    `<b>Group:</b> ${chat.name}\n` +
    `<b>Message:</b>\n<pre>${message.body}</pre>\n` +
    `<b>Flagged Categories:</b> ${flaggedCatsInline}\n` +
    `<b>Input Modalities:</b> ${modalitiesLine}`;
  telegramBot.sendMessage(process.env.TELEGRAM_CHAT_ID, flaggedText, {
    parse_mode: 'HTML',
  });
}

/**
 * Checks the content of a WhatsApp message for moderation purposes.
 * - Analyzes text and image content using OpenAI moderation API.
 * - Flags and logs messages that violate moderation policies.
 * - Deletes messages containing WhatsApp group invite links if sent by non-admins.
 *
 * @async
 * @param {WAWebJS.Message} message - The WhatsApp message object.
 * @param {TelegramBot} telegramBot - The Telegram bot instance for logging flagged messages.
 * @param {OpenAI} openai - The OpenAI API client instance.
 * @returns {Promise<void>} Resolves when moderation checks are complete.
 */
async function checkMessageContent(message, telegramBot, openai) {
  const chat = await message.getChat();
  if (!chat.isGroup) return;

  const inputs = [];
  if (message.body && message.body.trim().length > 0) {
    inputs.push({ type: 'text', text: message.body });
  }
  if (message.hasMedia) {
    const media = await message.downloadMedia();
    if (media && media.mimetype.startsWith('image/')) {
      const dataUrl = `data:${media.mimetype};base64,${media.data}`;
      inputs.push({ type: 'image_url', image_url: { url: dataUrl } });
    }
  }
  if (inputs.length === 0) return;

  try {
    const moderationResponse = await openai.moderations.create({
      model: 'omni-moderation-latest',
      input: inputs,
    });
    const resData = moderationResponse.data || moderationResponse;
    if (!resData.results) return;
    const flaggedResult = resData.results.find((r) => r.flagged);
    if (flaggedResult) {
      await sendTelegramFlaggedLog(message, chat, flaggedResult, telegramBot);
      console.log('Message flagged and logged to Telegram.');
      return;
    }
  } catch (err) {
    console.error('Moderation error:', err);
  }

  if (!/\bchat\.\s*whatsapp\.\s*com\b/i.test(message.body)) return;
  const senderId = message.author;
  if (!senderId) return;
  const participant = chat.participants.find(
    (p) => p.id._serialized === senderId
  );
  if (participant && (participant.isAdmin || participant.isSuperAdmin)) return;
  message
    .delete(true)
    .then(() => console.log('Message deleted'))
    .catch((err) => console.error('Failed to delete message', err));
}

export { checkMessageContent };
