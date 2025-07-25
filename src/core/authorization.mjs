import WAWebJS from 'whatsapp-web.js'; // eslint-disable-line no-unused-vars

import { updateWhatsappAuthorizations, getAllWhatsAppWorkers } from '../database/pgsql.mjs';

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
      throw new Error(`Failed to retrieve workers from database: ${error.message}`);
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

/**
 * Upsert authorizations for multiple phone numbers extracted from chats.
 * @async
 * @param {String} workerPhone - The ID of the WhatsApp worker
 * @param {WAWebJS.Client} client - The WhatsApp Web client
 */
async function addNewAuthorizations(client, workerPhone) {
  try {
    if (!workerPhone || typeof workerPhone !== 'string') {
      throw new Error('workerPhone is required and must be a string');
    }

    const allChats = await client.getChats();
    console.log(`Found ${allChats.length} chats.`);
    const privateChats = allChats.filter((chat) => !chat.isGroup && chat.isReadOnly === false);
    console.log(`Found ${privateChats.length} private chats (non-group chats).`);
    const phone_numbers = [];
    for (const chat of privateChats) {
      const contact = await chat.getContact();
      if (contact && contact.number) {
        phone_numbers.push(contact.number);
      }
    }
    console.log(`Extracted ${phone_numbers.length} phone numbers for authorization from private chats`);

    const allWorkers = await getAllWhatsAppWorkers();
    const worker = allWorkers.find((w) => w.worker_phone === workerPhone);
    const workerId = worker.id;

    if (phone_numbers.length === 0) {
      console.log('No phone numbers found for authorization');
      return;
    }

    const updates = [];
    for (const number of phone_numbers) {
      if (number) {
        updates.push({
          phone_number: String(number),
          worker_id: workerId,
        });
      }
    }

    if (updates.length === 0) {
      console.log('No valid contacts found for authorization');
      return;
    }

    await updateWhatsappAuthorizations(updates);
    console.log(`Successfully updated authorizations for ${updates.length} contacts.`);
  } catch (error) {
    console.error(`Error updating authorizations: ${error.message}`);
    return;
  }
}

export { checkAuth, addNewAuthorizations };
