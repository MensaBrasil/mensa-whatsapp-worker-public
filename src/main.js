// Imports
import { configDotenv } from 'dotenv';
import qrcode from 'qrcode-terminal';
import WAWebJS from 'whatsapp-web.js';

import { processAddQueue } from './core/addTask.mjs';
import { processRemoveQueue } from './core/removeTask.mjs';
import { testRedisConnection } from './database/redis.mjs';
import { delay } from './utils/misc.mjs';
const { Client, LocalAuth } = WAWebJS;

configDotenv();

const addDelay = Number(process.env.ADD_DELAY) || 15;
const removeDelay = Number(process.env.REMOVE_DELAY) || 10;
const delayOffset = Number(process.env.DELAY_OFFSET) || 3;
const uptimeUrl = process.env.UPTIME_URL;

// Mode select
let addMode = process.argv.includes('--add');
let removeMode = process.argv.includes('--remove');

if (!addMode && !removeMode) {
  console.log('Normal mode selected! Additions and removals will be processed.');
  addMode = true;
  removeMode = true;
} else if (addMode && !removeMode) {
  console.log('Add mode selected! Only additions will be processed.');
}
else if (!addMode && removeMode) {
  console.log('Remove mode selected! Only removals will be processed.');
}

// Global error handler
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

// Initialize client
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    protocolTimeout: 1200000,
  },
});

client.on('qr', (qr) => {
  qrcode.generate(qr, { small: true });
});

client.on('disconnected', (reason) => {
  console.error('Client was logged out', reason);
  process.exit(1);
});

client.initialize();

// Main loop
client.on('ready', async () => {
  client.setAutoDownloadDocuments(false);
  client.setAutoDownloadAudio(false);
  client.setAutoDownloadPhotos(false);
  client.setAutoDownloadVideos(false);

  console.log('Zelador worker is ready!');
  await testRedisConnection();

  // Main loop
  while (true) {
    if (addMode) {
      const addResult = await processAddQueue(client);
      if (addResult) {
        await delay(addDelay, delayOffset);
      }
    }
    if (removeMode) {
      const removeResult = await processRemoveQueue(client);
      if (removeResult) {
        await delay(removeDelay, delayOffset);
      }
    }
    await fetch(uptimeUrl);
  }
});
