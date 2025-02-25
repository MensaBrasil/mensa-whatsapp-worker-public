const { getLastMessageTimestamp, insertNewWhatsAppMessages } = require('../database/pgsql.cjs');
const { checkPhoneNumber } = require('../utils/phone-check.cjs');
const { convertTimestampToDate } = require('../utils/misc.cjs');
const { configDotenv } = require('dotenv');

configDotenv();

async function fetchMessagesFromGroups(groups, phoneNumbersFromDB) {
  for (const group of groups) {
    try {
      console.log('Fetching messages for group: ', group.name);
      const groupId = group.id._serialized;
      const batchSize = process.env.BATCH_SIZE || 300;
      let currentBatchSize = batchSize;
      let reachedTimestamp = false;
      let req_count = 0;
      let db_count = 0;

      const lastMessageTimestampInDb = await getLastMessageTimestamp(groupId);
      const timeLimitTimestamp = 0;

      console.log('Last message date in db: ', (await convertTimestampToDate(lastMessageTimestampInDb)).toLocaleDateString('pt-BR'), ' - timestamp: ', lastMessageTimestampInDb);
      console.log('Time limit date: ', (await convertTimestampToDate(timeLimitTimestamp)).toLocaleDateString('pt-BR'), ' - timestamp: ', timeLimitTimestamp);

      async function sendMessageBatchToDb(messages) {
        const phoneNumbers = messages.map(message => {
          const author = message.author || null;
          if (!author) {
            return null;
          }
          const parts = author.split('@');
          if (parts.length !== 2) {
            return null;
          }
          return parts[0];
        }).filter(phone => phone !== null); // Remove null entries

        const batch = [];

        for (let i = 0; i < phoneNumbers.length; i++) {
          const phone = phoneNumbers[i];

          const resp = checkPhoneNumber(phoneNumbersFromDB, phone);

          if (resp.found) {
            const message = messages[i];
            const message_id = message.id.id;
            const group_id = groupId;
            const datetime = new Date(message.timestamp * 1000).toISOString();

            batch.push([
              message_id,
              group_id,
              resp.mb,
              datetime,
              phone,
              message.type,
              message.deviceType,
              message.type === 'chat' ? message.body : null
            ]);
          }
        }

        if (batch.length > 0) {
          await insertNewWhatsAppMessages(batch);
        }

        console.log(`${batch.length} messages added to db!`);
        return batch.length;
      }

      while (reachedTimestamp === false) {
        try {
          const options = { limit: currentBatchSize };
          console.log('Fetching up to: ', options.limit, ' messages...');
          let messages = await group.fetchMessages(options);
          console.log('Fetched: ', messages.length, ' messages');
          req_count += 1;

            if (messages[0]) {
            console.log('Oldest message from this batch date: ', (await convertTimestampToDate(messages[0].timestamp)).toLocaleDateString('pt-BR'), ' - timestamp: ', messages[0].timestamp);
            }

          if (messages.length === 0) {
            console.log('No messages found. Skipping...');
            break;
          }

          if (messages.length < batchSize && req_count === 1) {
            console.log('First batch reached maximum messages!');
            reachedTimestamp = true;
            const filteredMessages = messages.filter(
              (message) => message.timestamp > lastMessageTimestampInDb,
            );
            db_count += await sendMessageBatchToDb(filteredMessages);
            break;
          }

          if (req_count > 1) {
            if (currentBatchSize > messages.length) {
              console.log('Last batch reached! Batch count: ', req_count);
              const difference = messages.length - (req_count - 1) * batchSize;
              console.log(difference, ' remaining messages!');
              messages = messages.slice(0, difference);
              const filteredMessages = messages.filter(
                (message) => message.timestamp > lastMessageTimestampInDb,
              );
              db_count += await sendMessageBatchToDb(filteredMessages);
              break;
            }
          }

          if (messages.length === currentBatchSize) {
            console.log('Selecting first ', batchSize, ' messages from batch nº', req_count);
            messages = messages.slice(0, batchSize);
          }

          if (
            messages[0].timestamp > lastMessageTimestampInDb &&
            messages[0].timestamp > timeLimitTimestamp
          ) {
            console.log('Time limit NOT reached in current batch! Batch count: ', req_count);
            console.log('Sending batch nº', req_count, ' with ', messages.length, ' messages to db...');
            currentBatchSize += batchSize;
            db_count += await sendMessageBatchToDb(messages);
          } else {
            console.log('Timestamp limit reached. Checking timestamps in current batch! batch count: ', req_count);
            let filteredMessages = messages.filter(
              (message) => message.timestamp > lastMessageTimestampInDb,
            );
            console.log(filteredMessages.length, ' new messages found! Sending batch to db...');
            db_count += await sendMessageBatchToDb(filteredMessages);
            reachedTimestamp = true;
            messages = null;
            filteredMessages = null;

            break;
          }
        } catch (error) {
          console.error('Error fetching messages:', error);
          break;
        }
      }

      console.log('All messages processed successfully for group: ', group.name, ' ~', db_count, ' messages added to db!');
    } catch (error) {
      console.error(`Error saving messages for ${group.name}: `, error);
    }
  }
}
module.exports = { fetchMessagesFromGroups };
