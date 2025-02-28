import WAWebJS from 'whatsapp-web.js'; // eslint-disable-line no-unused-vars

/**
 * Generates a randomized delay time in milliseconds with an offset
 * @param {number} time - Base delay time in minutes
 * @param {number} offset - Maximum random offset in minutes (both positive and negative)
 * @returns {number} Final delay time in milliseconds, minimum 0
 */
function getRandomizedDelay(time, offset = 3) {
  const randomOffset = Math.floor((Math.random() * (offset * 2) - offset) * 60);
  return Math.max(0, (time * 60 * 1000) + (randomOffset * 1000));
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
  let remainingTime = delayTime / 1000;

  console.log(`Waiting for ${remainingTime} seconds...`);
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      remainingTime--;
      process.stdout.write(`\rTime left: ${remainingTime} seconds`);

      if (remainingTime <= 0) {
        process.stdout.write('\n');
        clearInterval(interval);
        resolve();
      }
    }, 1000);
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
  const conversations = (await client.getChats()).filter(chat => !chat.isGroup);

  // Trying to find the number as is (If the number in db is the same as the one in the chat.)
  const matchingChat = conversations.find(chat => chat.id.user && chat.id.user.endsWith(phone));
  if (matchingChat) {
    return matchingChat.id._serialized;
  }

  // Checking if the number is brazilian and has the country code
  if (phone.startsWith('55')) {

    // Assuming the number have region code and adding the 9th digit
    if (phone.length === 12) {
      const newPhone = phone.slice(0, 4) + '9' + phone.slice(4);
      const matchingChat = conversations.find(chat => chat.id.user && chat.id.user.endsWith(newPhone));
      if (matchingChat) {
        return matchingChat.id._serialized;
      }
    }

    // If everything fails check until last 8 digits
    for (let i = phone.length; i >= 8; i--) {
      const lastDigits = phone.slice(-i);
      const matchingChat = conversations.find(chat => chat.id.user && chat.id.user.endsWith(lastDigits));
      if (matchingChat) {
        return matchingChat.id._serialized;
      }
    }
  }

  return false;
}

export { delay, getSerializedPhone };
