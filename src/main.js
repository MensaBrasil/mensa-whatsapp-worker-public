// Imports
import { configDotenv } from 'dotenv';
import qrcode from 'qrcode-terminal';
import WAWebJS from 'whatsapp-web.js';

import { processAddQueue } from './core/addTask.mjs';
import { processRemoveQueue } from './core/removeTask.mjs';
import { delay } from './utils/misc.mjs';
const { Client, LocalAuth } = WAWebJS;

configDotenv();

const addDelay = Number(process.env.ADD_DELAY) || 15;
const removeDelay = Number(process.env.REMOVE_DELAY) || 10;
const delayOffset = Number(process.env.DELAY_OFFSET) || 3;
const uptimeUrl = process.env.UPTIME_URL;

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

  // Main loop
  while (true) {
    const addResult = await processAddQueue(client);
    if (addResult) {
      delay(addDelay, delayOffset);
    } else {
      delay(0.25, 0);
    }
    const removeResult = await processRemoveQueue(client);
    if (removeResult) {
      delay(removeDelay, delayOffset);
    } else {
      delay(0.25, 0);
    }
    await fetch(uptimeUrl);
  }
});
