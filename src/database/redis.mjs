import { configDotenv } from 'dotenv';
import { createClient } from 'redis';

configDotenv();

const client = createClient(
    {
        password: process.env.REDIS_PASSWORD,
    }
);

client.on('error', (err) => console.error('Redis Client Error', err));

let isConnected = false;

async function connect() {
    if (!isConnected) {
        await client.connect();
        isConnected = true;
    }
}

/**
 * Sends an array of objects to the Redis queue
 * @async
 * @param {Array<Object>} objArray - Array of objects to send to the queue
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
async function sendToQueue(objArray) {
    try {
        await connect();
        const jsonArray = objArray.map(obj => JSON.stringify(obj));
        await client.rPush('queue', jsonArray);
        return true;
    } catch (error) {
        console.error('Error sending to queue:', error);
        return false;
    }
}

/**
 * Retrieves and removes all objects from the Redis queue
 * @async
 * @returns {Promise<Array<Object>>} Array of parsed objects from the queue
 */
async function getAllFromQueue() {
    try {
        await connect();
        const script = `
        local elements = redis.call('LRANGE', KEYS[1], 0, -1)
        return elements
        `;
        const elements = await client.eval(script, {
            keys: ['queue'],
        });
        return elements.map(e => JSON.parse(e));
    } catch (error) {
        console.error('Error getting all from queue:', error);
        return [];
    }
}

/**
 * Clear the queue
 * @async
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
async function clearQueue() {
    try {
        await connect();
        await client.del('queue');
        return true;
    } catch (error) {
        console.error('Error clearing queue:', error);
        return false;
    }
}

export { sendToQueue, getAllFromQueue, clearQueue };
