const { configDotenv } = require('dotenv');
const { createClient } = require('redis');

configDotenv();

// Create Redis client with password from environment variable
const redisClient = createClient({
  password: process.env.REDIS_PASSWORD,
  socket: {
    reconnectStrategy: function (retries) {
      if (retries > 20) {
        console.log('Too many attempts to reconnect. Redis connection was terminated');
        return new Error('Redis connection terminated after too many retries.');
      } else {
        return retries * 500;
      }
    }
  }
});

module.exports = { redisClient };