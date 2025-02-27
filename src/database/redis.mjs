import { configDotenv } from 'dotenv';
import { createClient } from 'redis';

configDotenv();

const client = createClient(
    {
        password: process.env.REDIS_PASSWORD,
        socket: {
            connectTimeout: 10000,
            reconnectStrategy: function (retries) {
                if (retries > 20) {
                    console.log('Too many attempts to reconnect. Redis connection was terminated');
                    return new Error('Too many retries.');
                } else {
                    return retries * 500;
                }
            }
        }
    }
);

client.on('error', (err) => {
    console.error(err);
    process.exit(1);
});

let isConnected = false;

/**
 * Establishes a connection to the Redis client if not already connected.
 * Uses a global isConnected flag to prevent multiple connections.
 * @async
 * @returns {Promise<void>}
 */
async function connect() {
    if (!isConnected) {
        await client.connect();
        isConnected = true;
    }
}

/**
 * Disconnects from the Redis client if a connection exists.
 * Sets the connection status to false after disconnecting.
 * @async
 * @returns {Promise<void>}
 */
async function disconnect() {
    if (isConnected) {
        await client.quit();
        isConnected = false;
    }
}

/**
 * Tests Redis connection and exits process if connection fails
 * @async
 * @returns {Promise<void>} Resolves if connection successful, exits process if connection fails
 */
async function testRedisConnection() {
    try {
        await connect();
        console.log('Successfully connected to Redis');
        await disconnect();
    } catch (error) {
        console.error('Failed to connect to Redis:', error);
        process.exit(1);
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
        if (!objArray || objArray.length === 0) {
            return false;
        }
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

export { sendToQueue, getAllFromQueue, clearQueue, testRedisConnection, disconnect };
