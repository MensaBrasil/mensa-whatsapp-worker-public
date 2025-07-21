import { getAllWhatsAppAuthorizations, updateWhatsappAuthorizations, deleteWhatsappAuthorization, getAllWhatsAppWorkers } from '../database/pgsql.mjs';

/**
 * Updates WhatsApp authorizations based on active chats
 * @async
 * @param {import('whatsapp-web.js').Chat | import('whatsapp-web.js').Chat[]} chatInput
 * @param {string} workerPhone - The phone number of the WhatsApp worker
 * @returns {Promise<{added: number, removed: number}>} Statistics about authorization changes
 */
async function checkAuth(chatInput, workerPhone) {
  try {
    if (!workerPhone) {
      throw new Error('workerPhone is required');
    }

    if (!chatInput) {
      throw new Error('chatInput is required');
    }

    // Get all workers and find the worker_id for this phone number
    const allWorkers = await getAllWhatsAppWorkers();
    const worker = allWorkers.find((w) => w.phone_number === workerPhone);

    if (!worker) {
      console.warn(`Worker not found for phone number: ${workerPhone}`);
      return { added: 0, removed: 0 };
    }

    const workerId = worker.worker_id;
    const isArray = Array.isArray(chatInput);
    const chats = isArray ? chatInput : [chatInput];

    // Filter and validate chats
    const user_chats = chats.filter((chat) => {
      if (!chat || !chat.id) {
        console.warn('Invalid chat object detected, skipping');
        return false;
      }
      return !chat.isGroup && !chat.isReadOnly;
    });

    const numbers = user_chats
      .map((chat) => chat.id.user)
      .filter((user) => user) // Ensure user is defined
      .map((user) => String(user));

    if (numbers.length === 0) {
      console.log('No valid user chats found for authorization check');
      return { added: 0, removed: 0 };
    }

    console.log(`Processing authorization check for ${numbers.length} chats`);

    const currentAuthorizations = await getAllWhatsAppAuthorizations();
    const currentAuthMap = new Map(currentAuthorizations.filter((auth) => auth.worker_id === workerId).map((auth) => [auth.phone_number, auth]));

    const updates = [];
    const deletions = [];

    // Add authorizations for all active chats that aren't already authorized
    for (const number of numbers) {
      const currentAuth = currentAuthMap.get(number);
      if (!currentAuth) {
        updates.push({
          phone_number: number,
          worker_id: workerId,
        });
      }
    }

    // Only check for deauthorizations when an array of chats is passed
    if (isArray) {
      // Remove authorizations for numbers that no longer have active chats
      for (const [phone, auth] of currentAuthMap) {
        if (!numbers.includes(phone)) {
          deletions.push({
            phone_number: auth.phone_number,
            worker_id: workerId,
          });
        }
      }
    }

    // Execute updates and deletions
    const promises = [];

    if (updates.length > 0) {
      console.log(`Adding ${updates.length} new authorizations`);
      promises.push(updateWhatsappAuthorizations(updates));
    }

    if (deletions.length > 0) {
      console.log(`Removing ${deletions.length} authorizations`);
      promises.push(...deletions.map((deletion) => deleteWhatsappAuthorization(deletion.phone_number, deletion.worker_id)));
    }

    if (promises.length > 0) {
      await Promise.all(promises);
      console.log(`Authorization update completed: ${updates.length} added, ${deletions.length} removed`);
    } else {
      console.log('No authorization changes needed');
    }

    return { added: updates.length, removed: deletions.length };
  } catch (error) {
    console.error('Error in checkAuth:', error);
    throw error;
  }
}

export { checkAuth };
