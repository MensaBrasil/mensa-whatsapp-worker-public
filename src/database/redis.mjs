import { configDotenv } from 'dotenv';
import { createClient } from 'redis';

configDotenv();

const client = createClient(
    {
        password: process.env.REDIS_PASSWORD,
        socket: {
            host: process.env.REDIS_HOST,
            port: process.env.REDIS_PORT,
        },
        retryStrategy: function (times) {
            if (times > 20) {
                console.log('Too many attempts to reconnect. Redis connection was terminated');
                return new Error('Too many retries.');
            } else {
                return times * 500;
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
 * Retrieves and removes the first item from addQueue
 * @returns {Promise<{type: string, request_id: number, registration_id: string, group_id: string, group_type: string}|null>} The parsed JSON object from the queue, or null if queue is empty
 * @throws {Error} If Redis connection fails or JSON parsing fails
 */
async function getFromAddQueue() {
    await connect();
    const queueItem = await client.lPop('addQueue');
    return queueItem ? JSON.parse(queueItem) : null;
}

/**
 * Retrieves and removes the first item from removeQueue
 * @returns {Promise<{
 * type: string,
 * registration_id: string,
 * groupId: string,
 * phone: string,
 * reason: string,
 * communityId: string|null}|null>} The parsed JSON object from the queue, or null if queue is empty
 * @throws {Error} If Redis connection fails or JSON parsing fails
 */
async function getFromRemoveQueue() {
    await connect();
    const queueItem = await client.lPop('removeQueue');
    return queueItem ? JSON.parse(queueItem) : null;
}

export { getFromAddQueue, getFromRemoveQueue, testRedisConnection };
