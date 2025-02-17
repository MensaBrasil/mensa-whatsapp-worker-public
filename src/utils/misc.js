const { createObjectCsvWriter } = require('csv-writer');
const TelegramBot = require('node-telegram-bot-api');

const csvWriter = createObjectCsvWriter({
    path: 'action_log.csv',
    header: [
        { id: 'timestamp', title: 'Timestamp' },
        { id: 'groupName', title: 'Group Name' },
        { id: 'member', title: 'Member' },
        { id: 'action', title: 'Action' },
        { id: 'reason', title: 'Reason' }
    ],
    append: true
});

const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;
const telegramBot = new TelegramBot(telegramBotToken);

async function countdown(ms) {
    let skipDelay = false;
    const seconds = Math.floor(ms / 1000);
    for (let i = seconds; i > 0; i--) {
        if (skipDelay) {
            skipDelay = false;
            console.log('\nDelay skipped!');
            return;
        }
        process.stdout.write(`\rCountdown: ${i} seconds remaining`);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log('\nCountdown finished.');
}

function getRandomDelay(baseDelay) {
    const variation = baseDelay * 0.3;
    const randomDelay = Math.random() * (2 * variation) - variation;
    return baseDelay + randomDelay;
}

async function delay(ms) {
    const totalDelay = getRandomDelay(ms);
    await countdown(totalDelay);
}

async function convertTimestampToDate(timestamp) {
    let date = new Date(timestamp * 1000);
    return date;
}

function logAction(groupName, member, action, reason) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        groupName,
        member,
        action,
        reason
    };

    csvWriter.writeRecords([logEntry])
        .then(() => {
            console.log(`Action logged: ${action} - ${member} in ${groupName}`);
            sendTelegramNotification(groupName, member, action, reason);
        })
        .catch(error => {
            console.error('Failed to log action to CSV:', error);
        });
}

function sendTelegramNotification(groupName, member, action, reason) {
    try {
        telegramBot.sendMessage(telegramChatId, `Action logged: ${action} - ${member} in ${groupName} reason: ${reason}`).catch(error => {
            console.error(`Failed to send Telegram notification: ${error}`);
        });
    } catch (error) {
        console.error(`Unexpected error in sendTelegramNotification: ${error}`);
    }
}

module.exports = {
    countdown,
    delay,
    logAction,
    sendTelegramNotification,
    convertTimestampToDate
};

