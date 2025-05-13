// Imports
import { configDotenv } from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import OpenAI from 'openai';
import qrcode from 'qrcode-terminal';
import WAWebJS from 'whatsapp-web.js';

import { processAddQueue } from './core/addTask.mjs';
import { checkMessageContent } from './core/moderations.mjs';
import { processRemoveQueue } from './core/removeTask.mjs';
import { testRedisConnection } from './database/redis.mjs';
import { checkGroupType } from './utils/checkGroupType.mjs';

const { Client, LocalAuth } = WAWebJS;

configDotenv();

const uptimeUrl = process.env.UPTIME_URL;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
  polling: false,
});

// Mode select
let addMode = process.argv.includes('--add');
let removeMode = process.argv.includes('--remove');
let moderationMode = process.argv.includes('--moderation');

if (!addMode && !removeMode && !moderationMode) {
  console.log('Normal mode selected! Additions, removals, and moderation tasks will be processed.');
  addMode = true;
  removeMode = true;
  moderationMode = true;
} else if (addMode && !removeMode && !moderationMode) {
  console.log('Add mode selected! Only additions will be processed.');
} else if (!addMode && removeMode && !moderationMode) {
  console.log('Remove mode selected! Only removals will be processed.');
} else if (moderationMode) {
  console.log('Moderation mode selected! Only moderation tasks will be processed.');
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

if (moderationMode) {
  client.on('message', async (message) => {
    const chat = await message.getChat();
    const groupType = await checkGroupType(chat);
    if (groupType === 'M.JB' || groupType === 'JB') {
      await checkMessageContent(message, telegramBot, openai);
    }
  });
}

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
  const startTime = Date.now();
  while (true) {
    if (addMode) {
      await processAddQueue(client);
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
    if (removeMode) {
      await processRemoveQueue(client);
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      await fetch(uptimeUrl, { signal: controller.signal });

      clearTimeout(timeoutId);
    } catch (error) {
      console.error('Uptime check failed:', error);
    }
    // Check if the process has been running for more than 1 hour
    const currentTime = Date.now();
    if (startTime && currentTime - startTime > 3600000) {
      console.log('Process has been running for more than 1 hour, shutting down...');
      client.destroy();
      process.exit(0);
    }
    if (startTime && currentTime - startTime < 3600000) {
      console.log(`Process has been running for ${Math.floor((currentTime - startTime) / 60000)} minutes`);
    }
  }
});
