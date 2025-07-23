import WAWebJS from 'whatsapp-web.js'; // eslint-disable-line no-unused-vars

/**
 * Generates a randomized delay time in milliseconds with an offset
 * @param {number} time - Base delay time in minutes
 * @param {number} offset - Maximum random offset in minutes (both positive and negative)
 * @returns {number} Final delay time in milliseconds, minimum 0
 */
function getRandomizedDelay(time, offset = 3) {
  const randomOffset = Math.floor((Math.random() * (offset * 2) - offset) * 60);
  return Math.max(0, time * 60 * 1000 + randomOffset * 1000);
}

/**
 * Creates a delay with a countdown display in the console
 * @param {number} time - The base delay time in minutes
 * @param {number} offset - The random offset range in minutes to add/subtract from base time
 * @returns {Promise<void>} A promise that resolves after the delay
 * @example
 * // Wait for 5 min ±3 min
 * await delay(5, 3);
 */
async function delay(time, offset) {
  const delayTime = getRandomizedDelay(time, offset);
  const endTime = Date.now() + delayTime;

  console.log(`Waiting for ${delayTime / 1000} seconds...`);

  return new Promise((resolve) => {
    const updateDisplay = () => {
      const remainingTime = Math.ceil((endTime - Date.now()) / 1000);
      process.stdout.write(`\rTime left: ${remainingTime} seconds`);

      if (remainingTime <= 0) {
        process.stdout.write('\n');
        resolve();
        return;
      }

      setTimeout(updateDisplay, 1000);
    };

    updateDisplay();
  });
}

/**
 * Retrieves the serialized phone ID from WhatsApp chat conversations
 * @async
 * @param {WAWebJS.Client} client - The WhatsApp client instance
 * @param {string} phone - The phone number to search for
 * @returns {Promise<string|boolean>} The serialized phone ID if found, false otherwise
 * @description Searches for a phone number match in WhatsApp chats using different formats:
 * 1. Exact match
 * 2. Brazilian numbers with country code (55) and 9th digit handling
 * 3. Progressive digit matching from full number down to last 8 digits
 */
async function getSerializedPhone(client, phone) {
  const conversations = (await client.getChats()).filter((chat) => !chat.isGroup);

  // Trying to find the number as is (If the number in db is the same as the one in the chat.)
  const matchingChat = conversations.find((chat) => chat.id.user && chat.id.user.endsWith(phone));
  if (matchingChat) {
    return matchingChat.id._serialized;
  }

  // Using last 8 digits to find serialized number
  const matchingChat8digits = conversations.find((chat) => chat.id.user && chat.id.user.endsWith(phone.slice(-8)));
  if (matchingChat8digits) {
    return matchingChat8digits.id._serialized;
  }

  return false;
}

export { delay, getSerializedPhone };
