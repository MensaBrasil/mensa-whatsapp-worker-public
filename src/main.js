// Imports
import { configDotenv } from 'dotenv';
import qrcode from 'qrcode-terminal';
import WAWebJS from 'whatsapp-web.js';
const { Client, LocalAuth } = WAWebJS;

configDotenv();

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

  console.log('Client is ready!');

  console.log('All tasks completed. Exiting...');
  await fetch(process.env.UPTIME_URL);
  process.exit(0);
});
