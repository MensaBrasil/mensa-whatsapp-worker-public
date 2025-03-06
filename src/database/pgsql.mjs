import { configDotenv } from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;

configDotenv();

const pool = new Pool({
  host: process.env.PG_DB_HOST,
  port: process.env.PG_DB_PORT,
  database: process.env.PG_DB_NAME,
  user: process.env.PG_DB_USER,
  password: process.env.PG_DB_PASSWORD,
});

/**
 * Updates member_groups table to record when a user exits a group
 * @async
 * @param {string} phone_number - The phone number of the user who left the group
 * @param {string} group_id - The ID of the group the user left
 * @param {string} reason - The reason why the user left or was removed from the group
 * @returns {Promise<void>} - Promise that resolves when the database update is complete
 */
const recordUserExitFromGroup = async (phone_number, group_id, reason) => {
  const query = `
        UPDATE member_groups
        SET exit_date = CURRENT_DATE, removal_reason = $3
        WHERE phone_number = $1 AND group_id = $2 AND exit_date IS NULL;
    `;
  await pool.query(query, [phone_number, group_id, reason]);
};

/**
 * Records a user entry into a group in the database
 * @async
 * @param {string} registration_id - The registration ID of the user
 * @param {string} phone_number - The phone number of the user
 * @param {string} group_id - The ID of the group
 * @param {string} status - The status of the user "Active" or "Inactive"
 * @returns {Promise<void>} - A promise that resolves when the entry is recorded
 */
const recordUserEntryToGroup = async (
  registration_id,
  phone_number,
  group_id,
  status,
) => {
  const query = `
        INSERT INTO member_groups (registration_id, phone_number, group_id, status)
        VALUES ($1, $2, $3, $4);
    `;
  await pool.query(query, [registration_id, phone_number, group_id, status]);
};

/**
 * Retrieves all phone numbers associated with a specific registration ID.
 * This includes primary phone numbers from the phones table and both primary
 * and alternative phone numbers from legal representatives.
 * @async
 * @param {number} registration_id - The registration ID to search for
 * @returns {Promise<string[]>} An array of phone numbers associated with the registration
 * @throws {Error} If there's an error executing the database query
 */
async function getMemberPhoneNumbers(registration_id) {
  const query = `SELECT 
                    phone_number AS phone
                FROM 
                    phones
                WHERE 
                    registration_id = $1
                UNION ALL
                SELECT 
                    phone
                FROM 
                    legal_representatives
                WHERE 
                    registration_id = $1
                UNION ALL
                SELECT 
                    alternative_phone AS phone
                FROM 
                    legal_representatives
                WHERE 
                    registration_id = $1
                    AND alternative_phone IS NOT NULL;
    `;
  const result = await pool.query(query, [registration_id]);
  return result.rows.map((row) => row.phone);
}

/**
 * Updates a group request status to fulfilled in the database.
 * @async
 * @param {number} id - The ID of the group request to update.
 * @returns {Promise<void>} A promise that resolves when the update is complete.
 */
async function registerWhatsappAddFulfilled(id) {
  const query = 'UPDATE group_requests SET fulfilled = true, last_attempt = NOW() WHERE id = $1';
  await pool.query(query, [id]);
}

export {
  recordUserExitFromGroup,
  recordUserEntryToGroup,
  getMemberPhoneNumbers,
  registerWhatsappAddFulfilled
};
