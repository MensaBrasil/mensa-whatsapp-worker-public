import { configDotenv } from 'dotenv';
import { Pool } from 'pg';

configDotenv();

const pool = new Pool({
  host: process.env.PG_DB_HOST,
  port: process.env.PG_DB_PORT,
  database: process.env.PG_DB_NAME,
  user: process.env.PG_DB_USER,
  password: process.env.PG_DB_PASSWORD,
});

/**
 * Retrieves phone numbers with their associated status and age-based classifications from the database
 * 
 * @async
 * @function getPhoneNumbersWithStatus
 * @returns {Promise<Array<{
 *   phone_number: string,
 *   registration_id: number,
 *   status: 'Active'|'Inactive',
 *   jb_under_10: boolean,
 *   jb_over_10: boolean,
 *   is_adult: boolean
 * }>>} Array of objects containing phone numbers with their status and age classifications
 * 
 * The function:
 * - Combines phone numbers from both phones and legal_representatives tables
 * - Determines membership status based on expiration dates and transfer status
 * - Classifies registrants by age groups (under 10, 10-18, 18+)
 * - Groups results by phone number and registration ID
 * - Filters out null phone numbers
 */
const getPhoneNumbersWithStatus = async () => {
  const currentDate = new Date().toISOString().split('T')[0]; // Format as YYYY-MM-DD
  const query = `
    WITH MaxExpirationDates AS (
    SELECT
      registration_id,
      MAX(expiration_date) AS max_expiration_date
    FROM
      membership_payments
    GROUP BY
      registration_id
        ),
        PhoneNumbers AS (
    SELECT
      p.phone_number AS phone_number,
      p.registration_id AS registration_id,
      CASE
        WHEN med.max_expiration_date > $1 THEN 'Active'
        WHEN r.transferred IS TRUE THEN 'Active'
        ELSE 'Inactive'
      END AS status,
      CASE
        WHEN DATE_PART('year',
        AGE(r.birth_date)) <= 11 THEN TRUE
        ELSE FALSE
      END AS jb_under_10,
      CASE
        WHEN DATE_PART('year',
        AGE(r.birth_date)) >= 10
        AND DATE_PART('year',
        AGE(r.birth_date)) < 18 THEN TRUE
        ELSE FALSE
      END AS jb_over_10,
      CASE
        WHEN DATE_PART('year',
        AGE(r.birth_date)) >= 18 THEN TRUE
        ELSE FALSE
      END AS is_adult
    FROM
      phones p
    LEFT JOIN MaxExpirationDates med ON
      p.registration_id = med.registration_id
    LEFT JOIN registration r ON
      p.registration_id = r.registration_id
    UNION ALL
    SELECT
      lr.phone AS phone_number,
      lr.registration_id,
      CASE
        WHEN med.max_expiration_date > $1 THEN 'Active'
        WHEN reg.transferred IS TRUE THEN 'Active'
        ELSE 'Inactive'
      END AS status,
      CASE
        WHEN DATE_PART('year',
        AGE(reg.birth_date)) <= 11 THEN TRUE
        ELSE FALSE
      END AS jb_under_10,
      CASE
        WHEN DATE_PART('year',
        AGE(reg.birth_date)) >= 10
        AND DATE_PART('year',
        AGE(reg.birth_date)) < 18 THEN TRUE
        ELSE FALSE
      END AS jb_over_10,
      CASE
        WHEN DATE_PART('year',
        AGE(reg.birth_date)) >= 18 THEN TRUE
        ELSE FALSE
      END AS is_adult
    FROM
      legal_representatives lr
    LEFT JOIN MaxExpirationDates med ON
      lr.registration_id = med.registration_id
    LEFT JOIN registration reg ON
      lr.registration_id = reg.registration_id
        )
        
        SELECT
      phone_number,
      registration_id,
      MAX(status) AS status,
      BOOL_OR(jb_under_10) AS jb_under_10,
      BOOL_OR(jb_over_10) AS jb_over_10,
      BOOL_OR(is_adult) AS is_adult
    FROM
      PhoneNumbers
    WHERE
      phone_number IS NOT NULL
    GROUP BY
      phone_number,
      registration_id;
    `;

  const { rows } = await pool.query(query, [currentDate]);
  return rows;
};

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
 * Retrieves the most recent communication record for a given phone number
 * @async
 * @param {string} phoneNumber - The phone number to search for
 * @returns {Promise<false|{
 *   id: number,
 *   phone_number: string,
 *   communication_date: timestamp,
 *   status: string,
 *   reason: string,
 *   timestamp: timestamp
 * }>} Returns the most recent communication record or false if none exists
 */
async function getLastCommunication(phoneNumber) {
  const query = `
        SELECT
          whatsapp_comms.id,
          whatsapp_comms.phone_number,
          whatsapp_comms.communication_date,
          whatsapp_comms.status,
          whatsapp_comms.reason,
          whatsapp_comms.timestamp
        FROM
          whatsapp_comms
        WHERE
          phone_number = $1
        ORDER BY
          timestamp DESC
        LIMIT 1;
    `;
  const result = await pool.query(query, [phoneNumber]);
  return result.rows[0] || false;
}

/**
 * Logs or updates a communication record in the whatsapp_comms table
 * @async
 * @param {string} phoneNumber - The phone number associated with the communication
 * @param {string} reason - The reason for the communication
 * @returns {Promise<void>} A promise that resolves when the operation is complete
 */
async function logCommunication(phoneNumber, reason) {
  const query = `
        INSERT INTO whatsapp_comms (phone_number, reason, timestamp, status)
        VALUES ($1, $2, NOW(), 'unresolved')
        ON CONFLICT (phone_number, reason) 
        DO UPDATE SET timestamp = NOW(), status = 'unresolved';
    `;
  await pool.query(query, [phoneNumber, reason]);
}

/**
 * Retrieves phone numbers of active members in a specified group saved on db
 * @async
 * @param {string} groupId - The ID of the WhatsApp group to query
 * @returns {Promise<string[]>} A promise that resolves to an array of phone numbers of active members in the specified group
 */
async function getPreviousGroupMembers(groupId) {
  const query =
    'SELECT phone_number FROM member_groups WHERE group_id = $1 AND exit_date IS NULL';
  const values = [groupId];
  const result = await pool.query(query, values);
  return result.rows.map((row) => row.phone_number);
}

/**
 * Saves WhatsApp groups information to the database by first clearing existing entries
 * and then inserting the new group data.
 * @async
 * @param {string[]} groupNames - Array of group names to be saved
 * @param {string[]} groupIds - Array of group IDs corresponding to the group names
 * @returns {Promise<void>} A promise that resolves when all groups have been saved
 */
async function saveGroupsToList(groupNames, groupIds) {
  await pool.query('DELETE FROM group_list');

  const query = 'INSERT INTO group_list (group_name, group_id) VALUES ($1, $2)';
  for (let i = 0; i < groupNames.length; i++) {
    await pool.query(query, [groupNames[i], groupIds[i]]);
  }
}

/**
 * Retrieves pending WhatsApp group requests from the database that meet specific criteria
 * @param {string|number} group_id - The ID of the WhatsApp group to fetch requests for
 * @returns {Promise<Array<{
 *   request_id: number,
 *   registration_id: number,
 *   group_id: string,
 *   no_of_attempts: number,
 *   last_attempt: Date|null
 * }>>} Array of pending group requests that:
 *   - Have been attempted less than 3 times
 *   - Haven't been fulfilled
 *   - Either have no previous attempts or last attempt was more than 24 hours ago
 **/
async function getWhatsappQueue(group_id) {
  const query = `
        SELECT
          group_requests.id AS request_id,
          group_requests.registration_id,
          group_requests.group_id,
          group_requests.no_of_attempts,
          group_requests.last_attempt
        FROM
          group_requests
        WHERE
          no_of_attempts < 3
          AND group_id = $1
          AND fulfilled = FALSE
          AND (last_attempt < NOW() - INTERVAL '1 DAY'
            OR last_attempt IS NULL)
    `;
  return (await pool.query(query, [group_id])).rows;
}

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
 * Retrieves the timestamp of the most recent message from a specific WhatsApp group.
 * This function queries the `whatsapp_messages` table to find the latest message timestamp
 * for the given group ID and returns it as a Unix timestamp.
 * If no messages are found for the group, it returns 0.
 * 
 * @async
 * @param {string} groupId - The ID of the WhatsApp group
 * @returns {Promise<number>} Unix timestamp of the latest message, or 0 if no messages exist
 */
async function getLastMessageTimestamp(groupId) {
  const query = `SELECT
                  EXTRACT(EPOCH
                FROM
                  MAX(timestamp))::INT AS unix_timestamp
                FROM
                  whatsapp_messages
                WHERE
                  group_id = $1;`;

  const result = await pool.query(query, [groupId]);
  return result.rows.length > 0 ? result.rows[0].unix_timestamp : 0;
}

/**
 * Inserts multiple WhatsApp messages into the database
 * @async
 * @param {Array} messages - Array of messages to be inserted. Each message should contain:
 *   message_id: string,
 *   group_id: string,
 *   registration_id: int,
 *   timestamp: Date,
 *   phone: string,
 *   message_type: string,
 *   device_type: string,
 *   content: string
 * @returns {Promise<void>} A promise that resolves when messages are inserted
 */
async function insertNewWhatsAppMessages(messages) {
  if (messages.length === 0) return;

  const query = `
  INSERT INTO whatsapp_messages (
      message_id,
      group_id,
      registration_id,
      timestamp,
      phone,
      message_type,
      device_type,
      content
  )
  VALUES ${messages.map((_, index) => `($${index * 8 + 1}, $${index * 8 + 2}, $${index * 8 + 3}, $${index * 8 + 4}, $${index * 8 + 5}, $${index * 8 + 6}, $${index * 8 + 7}, $${index * 8 + 8})`).join(', ')}
  `;

  const values = messages.flatMap(Object.values);
  await pool.query(query, values);
}

export {
  getPhoneNumbersWithStatus,
  recordUserExitFromGroup,
  recordUserEntryToGroup,
  getLastCommunication,
  logCommunication,
  getPreviousGroupMembers,
  saveGroupsToList,
  getWhatsappQueue,
  getMemberPhoneNumbers,
  getLastMessageTimestamp,
  insertNewWhatsAppMessages,
};
