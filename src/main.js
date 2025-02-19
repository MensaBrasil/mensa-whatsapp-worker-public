// Imports
import { preprocessPhoneNumbers, checkPhoneNumber } from './utils/phone-check.mjs';
import { fetchMessagesFromGroups } from './core/fetchMessagesMode.mjs';
import { getPhoneNumbersWithStatus, saveGroupsToList } from './database/pgsql.mjs';
import { removeMembersFromGroups } from './core/removeQueue.mjs';
import { Client, LocalAuth } from 'whatsapp-web.js';
import { reportMembersInfo } from './core/reportMode.mjs';
import { addMembersToGroups } from './core/addQueue.mjs';
import { scanGroups } from './core/scanMode.mjs';
import qrcode from 'qrcode-terminal';

// Global error handler
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

// Cli args
const modes = {
  '--add': 'Add',
  '--remove': 'Remove',
  '--scan': 'Scan',
  '--report': 'Report',
  '--fetch': 'Fetch Messages',
};
const selected = Object.entries(modes).reduce((acc, [flag, name]) => (process.argv.includes(flag) ? acc.concat(name) : acc), []);

const addMode = process.argv.includes('--add');
const removeMode = process.argv.includes('--remove');
const scanMode = process.argv.includes('--scan');
const reportMode = process.argv.includes('--report');
const fetchMessagesMode = process.argv.includes('--fetch');

if (!selected.length) {
  console.log('You should select at least 1 service. Exiting...\nPlease choose from ' + Object.keys(modes).join(', '));
  process.exit(1);
}

console.log('Services selected:', selected.join(', '));

// Initialize client
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    protocolTimeout: 1200000,
  },
});

client.on('qr', (qr) => {
  qrcode.generate(qr, { small: true });
});

client.on('disconnected', (reason) => {
  console.log('Client was logged out', reason);
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

  // Initial Setup
  const chats = await client.getChats();
  const groups = chats.filter((chat) => chat.isGroup && !chat.isReadOnly);
  const groupNames = groups.map((group) => group.name);
  const groupIds = groups.map((group) => group.id._serialized);

  if (chats.length === 0 || groups.length === 0) {
    console.log('No groups found. Exiting.');
    process.exit(1);
  }

  await saveGroupsToList(groupNames, groupIds);
  console.log(`Total chats retrieved: ${chats.length}`);
  console.log(`Groups retrieved: ${groups.length}`);

  // Initial checks
  const phoneNumbersFromDB = preprocessPhoneNumbers(
    await getPhoneNumbersWithStatus(),
  );
  if (phoneNumbersFromDB.length === 0) {
    console.log('No phone numbers found in the database. Exiting.');
    process.exit(1);
  }

  const checkResult = checkPhoneNumber(phoneNumbersFromDB, '447474660572');
  if (!checkResult.found) {
    console.log('Number 447474660572 not found in the database. Sanity check failed. Exiting.');
    process.exit(1);
  }

  if (scanMode) {
    console.log('Scanning groups...');
    await scanGroups(client, groups, phoneNumbersFromDB);
  }

  if (reportMode) {
    await reportMembersInfo(client, chats, groups, phoneNumbersFromDB);
  }

  if (fetchMessagesMode) {
    console.log('Fetching messages...');
    await fetchMessagesFromGroups(client, groups, phoneNumbersFromDB);
  }

  if (addMode) {
    console.log('Adding members...');
    await addMembersToGroups(chats, groups);
  }

  if (removeMode) {
    console.log('Removing members...');
    await removeMembersFromGroups(client, groups, phoneNumbersFromDB);
  }

  console.log('All tasks completed. Exiting...');
  process.exit(0);
});
