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
            END as status
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
            END as status
        FROM legal_representatives lr
        LEFT JOIN MaxExpirationDates med ON lr.registration_id = med.registration_id
        LEFT JOIN registration reg ON lr.registration_id = reg.registration_id
    )
    
    SELECT 
        phone_number,
        MAX(status) AS status
    FROM PhoneNumbers 
    WHERE phone_number IS NOT NULL
    GROUP BY phone_number;
    
    `;
  
    const { rows } = await pool.query(query, [currentDate]);
    return rows;
  };
  
  

module.exports = { getPhoneNumbersWithStatus };
