import {
  updateWhatsappAuthorizations,
  getAllWhatsAppWorkers,
} from '../database/pgsql.mjs';

/**
 * Updates WhatsApp authorization for a single phone number.
 * Ensures the worker exists in the database and upserts the authorization.
 * @async
 * @param {string} phoneNumber - A single phone number
 * @param {string} workerPhone - The phone number of the WhatsApp worker
 * @returns {Promise<{success: boolean}>} Result of the operation
 */
async function checkAuth(phoneNumber, workerPhone) {
  try {
    // Input validation
    if (!workerPhone || typeof workerPhone !== 'string') {
      throw new Error('workerPhone is required and must be a string');
    }
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      throw new Error('phoneNumber is required and must be a string');
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

    // Upsert the authorization
    const authUpdate = {
      phone_number: String(phoneNumber),
      worker_id: workerId,
    };

    try {
      await updateWhatsappAuthorizations([authUpdate]);
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to update authorization: ${error.message}`);
    }
  } catch (error) {
    throw new Error(`checkAuth failed: ${error.message}`);
  }
}

export { checkAuth };
