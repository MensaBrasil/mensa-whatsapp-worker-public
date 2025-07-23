import {
  getAllWhatsAppAuthorizations,
  updateWhatsappAuthorizations,
  deleteWhatsappAuthorization,
  getAllWhatsAppWorkers,
} from '../database/pgsql.mjs';

/**
 * Updates WhatsApp authorizations based on active chats.
 * Ensures the worker exists in the database and updates authorizations using both phone_number and worker_id.
 * @async
 * @param {import('whatsapp-web.js').Chat | import('whatsapp-web.js').Chat[]} chatInput
 * @param {string} workerPhone - The phone number of the WhatsApp worker
 * @returns {Promise<{added: number, removed: number}>} Statistics about authorization changes
 */
async function checkAuth(chatInput, workerPhone) {
  try {
    // Input validation
    if (!workerPhone || typeof workerPhone !== 'string') {
      throw new Error('workerPhone is required and must be a string');
    }
    if (!chatInput) {
      throw new Error('chatInput is required');
    }

    // Ensure worker exists in DB
    let allWorkers;
    try {
      allWorkers = await getAllWhatsAppWorkers();
    } catch (error) {
      throw new Error(
        `Failed to retrieve workers from database: ${error.message}`,
      );
    }

    const worker = allWorkers.find((w) => w.worker_phone === workerPhone);
    if (!worker) {
      throw new Error(`Worker not found for phone number: ${workerPhone}`);
    }
    const workerId = worker.id;

    const chats = Array.isArray(chatInput) ? chatInput : [chatInput];
    const userChats = chats.filter(
      (chat) => chat && chat.id && !chat.isGroup && !chat.isReadOnly,
    );
    const numbers = userChats
      .map((chat) => chat.id.user)
      .filter(Boolean)
      .map(String);

    if (numbers.length === 0) return { added: 0, removed: 0 };

    // Get current authorizations for this worker
    let currentAuthorizations;
    try {
      currentAuthorizations = await getAllWhatsAppAuthorizations();
    } catch (error) {
      throw new Error(
        `Failed to retrieve authorizations from database: ${error.message}`,
      );
    }

    const currentAuthSet = new Set(
      currentAuthorizations
        .filter((auth) => auth.worker_id === workerId)
        .map((auth) => auth.phone_number),
    );

    // Prepare updates (add new authorizations)
    const updates = numbers
      .filter((number) => !currentAuthSet.has(number))
      .map((number) => ({
        phone_number: number,
        worker_id: workerId,
      }));

    // Prepare deletions (remove authorizations not in active chats)
    let deletions = [];
    if (Array.isArray(chatInput)) {
      deletions = Array.from(currentAuthSet)
        .filter((phone) => !numbers.includes(phone))
        .map((phone) => ({
          phone_number: phone,
          worker_id: workerId,
        }));
    }

    // Execute DB operations with error handling
    let addedCount = 0;
    let removedCount = 0;

    if (updates.length > 0) {
      try {
        await updateWhatsappAuthorizations(updates);
        addedCount = updates.length;
      } catch (error) {
        throw new Error(`Failed to add authorizations: ${error.message}`);
      }
    }

    if (deletions.length > 0) {
      try {
        await Promise.all(
          deletions.map(({ phone_number, worker_id }) =>
            deleteWhatsappAuthorization(phone_number, worker_id),
          ),
        );
        removedCount = deletions.length;
      } catch (error) {
        throw new Error(`Failed to remove authorizations: ${error.message}`);
      }
    }

    return { added: addedCount, removed: removedCount };
  } catch (error) {
    // Re-throw with context
    throw new Error(`checkAuth failed: ${error.message}`);
  }
}

export { checkAuth };
