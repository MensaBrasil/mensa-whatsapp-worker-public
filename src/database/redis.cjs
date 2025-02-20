const { createClient } = require('redis');
const { configDotenv } = require('dotenv');

configDotenv();

// Create a new Redis client

const client = createClient({
  password: process.env.REDIS_PASSWORD,
});

client.on('error', (err) => {
  console.log('Redis Client Error', err);
  process.exit(1);
});

// Create a new queue item

async function send_to_queue(object) {
  try {
    console.log(object);
    await client.connect();
    await client.rPush('queue', JSON.stringify(object));
    await client.disconnect();
  } catch (err) {
    console.log('Error sending data to queue', err);
    process.exit(1);
  }
}

// Get all queue items

async function get_all_queue_itens() {
  try {
    await client.connect();
    const queue = await client.lRange('queue', 0, -1);
    await client.disconnect();
    if (queue.length > 0) {
      return queue;
    } else {
      return [];
    }
  } catch (err) {
    console.log('Error receiving data from queue', err);
    process.exit(1);
  }
}

module.exports = { send_to_queue, get_all_queue_itens };
