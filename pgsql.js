// pgsql.js

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.PG_DB_HOST,
  port: process.env.PG_DB_PORT,
  database: process.env.PG_DB_NAME,
  user: process.env.PG_DB_USER,
  password: process.env.PG_DB_PASSWORD
});

const getPhoneNumbersWithStatus = async () => {
    const currentDate = new Date().toISOString().split('T')[0]; // Format as YYYY-MM-DD
    const query = `
    WITH MaxExpirationDates AS (
        SELECT
            registration_id,
            MAX(expiration_date) AS max_expiration_date
        FROM membership_payments
        GROUP BY registration_id
    ),
    
    PhoneNumbers AS (
        SELECT 
            p.phone_number AS phone_number,
            p.registration_id AS registration_id,
            CASE
                WHEN med.max_expiration_date > $1 THEN 'Active'
                WHEN r.transferred IS TRUE THEN 'Active'
                ELSE 'Inactive'
            END as status,
            CASE
                WHEN DATE_PART('year', AGE(r.birth_date)) < 18 THEN TRUE
                ELSE FALSE
            END as jovem_brilhante
        FROM phones p 
        LEFT JOIN MaxExpirationDates med ON p.registration_id = med.registration_id
        LEFT JOIN registration r ON p.registration_id = r.registration_id
    
        UNION ALL
    
        SELECT 
            lr.phone AS phone_number,
            lr.registration_id,
            CASE
                WHEN med.max_expiration_date > $1 THEN 'Active'
                WHEN reg.transferred IS TRUE THEN 'Active'
                ELSE 'Inactive'
            END as status,
            CASE
                WHEN DATE_PART('year', AGE(reg.birth_date)) < 18 THEN TRUE
                ELSE FALSE
            END as jovem_brilhante
        FROM legal_representatives lr
        LEFT JOIN MaxExpirationDates med ON lr.registration_id = med.registration_id
        LEFT JOIN registration reg ON lr.registration_id = reg.registration_id
    )
    
    SELECT 
        phone_number,
        registration_id,
        MAX(status) AS status,
        BOOL_OR(jovem_brilhante) AS jovem_brilhante
    FROM PhoneNumbers 
    WHERE phone_number IS NOT NULL
    GROUP BY phone_number, registration_id;
    `;
  
    const { rows } = await pool.query(query, [currentDate]);
    return rows;
};

const recordUserExitFromGroup = async (phone_number, group_id, reason) => {
    const query = `
        UPDATE member_groups
        SET exit_date = CURRENT_DATE, removal_reason = $3
        WHERE phone_number = $1 AND group_id = $2 AND exit_date IS NULL;
    `;
    await pool.query(query, [phone_number, group_id, reason]);
};

const recordUserEntryToGroup = async (registration_id, phone_number, group_id, status) => {
    const query = `
        INSERT INTO member_groups (registration_id, phone_number, group_id, status)
        VALUES ($1, $2, $3, $4);
    `;
    await pool.query(query, [registration_id, phone_number, group_id, status]);
};

async function getLastCommunication(phoneNumber) {
    const query = `
        SELECT * FROM whatsapp_comms 
        WHERE phone_number = $1
        ORDER BY timestamp DESC LIMIT 1
    `;
    const result = await pool.query(query, [phoneNumber]);
    return result.rows[0];
}


async function logCommunication(phoneNumber, reason) {
    const query = `
        INSERT INTO whatsapp_comms (phone_number, reason, timestamp, status)
        VALUES ($1, $2, NOW(), 'unresolved')
        ON CONFLICT (phone_number, reason) 
        DO UPDATE SET timestamp = NOW(), status = 'unresolved';
    `;
    await pool.query(query, [phoneNumber, reason]);
}

async function getPreviousGroupMembers(groupId) {
    const query = `SELECT phone_number FROM member_groups WHERE group_id = $1 AND exit_date IS NULL`;
    const values = [groupId];
    const result = await pool.query(query, values);
    return result.rows.map(row => row.phone_number);
}

async function saveGroupsToList(groupNames, groupIds) {
    await pool.query(`DELETE FROM group_list`);
    
    const query = `INSERT INTO group_list (group_name, group_id) VALUES ($1, $2)`;
    for (let i = 0; i < groupNames.length; i++) {
        await pool.query(query, [groupNames[i], groupIds[i]]);
    }
}

async function getWhatsappQueue(group_id) {
    const query = `
        SELECT * 
        FROM group_requests 
        WHERE 
            no_of_attempts < 3 
            AND group_id = $1 
            AND fulfilled = false 
            AND (last_attempt < NOW() - INTERVAL '1 day' OR last_attempt IS NULL)
    `;
    return await pool.query(query, [group_id]);
}

// Register WhatsApp add attempt, incrementing the number of attempts and updating last_attempt
async function registerWhatsappAddAttempt(request_id) {
    const query = `UPDATE group_requests SET no_of_attempts = no_of_attempts + 1, last_attempt = NOW() WHERE id = $1`;
    await pool.query(query, [request_id]);
}

// Register that a WhatsApp add was fulfilled and update last_attempt
async function registerWhatsappAddFulfilled(id) {
    const query = `UPDATE group_requests SET fulfilled = true, last_attempt = NOW() WHERE id = $1`;
    await pool.query(query, [id]);
}

async function getMemberName(registration_id) {
    const query = `SELECT name FROM registration WHERE registration_id = $1`;
    const result = await pool.query(query, [registration_id]);
    return result.rows[0].name;
}

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
    return result.rows.map(row => row.phone);
}

module.exports = { 
    getPhoneNumbersWithStatus, 
    recordUserExitFromGroup, 
    recordUserEntryToGroup, 
    getPreviousGroupMembers,
    saveGroupsToList,
    getWhatsappQueue,
    registerWhatsappAddAttempt,
    getMemberPhoneNumbers,
    registerWhatsappAddFulfilled,
    getLastCommunication,  
    logCommunication,
    getMemberName
};
