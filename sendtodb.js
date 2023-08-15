const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { printChats, getGroupParticipants, getGroupIdByName, removeParticipantByPhoneNumber, sendMessageToNumber, sendMessageToNumberAPI } = require('./chat');
const getWorksheetContents = require('./googlesheets');
const fs = require('fs');
const checkPhoneNumber = require('./phone-check');
const { ObjectId } = require('mongodb');
const { isMessageAlreadySent, saveMessageToMongoDB } = require('./mongo'); // If you don't use these functions anywhere else, consider removing them.
const { getInactiveMessage, getNotFoundMessage } = require('./messages');

require('dotenv').config();

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', qr => {
    qrcode.generate(qr, {small: true});
});

// The list of numbers you provided
// const numbers = [
//     "553189629302",
//     "5521968851440",
// "554198748796",
// "554591026995",
// "554796512850",
// "554991700495",
// "555481216896",
// "556496462129",
// "5521995583244",
// "556199995652",
// "556599463868",
// "556599723208",
// "558688010860",
// "559188863330",
// "557391091189",
// "557798411050",
// "558182442783",
// "558399209628",
// "558399519789",
// "558488770610",
// "558688010860",
// "5511949820318",
// "5511977538898",
// "5511996553685",
// "5513997849564",
// "5516992032342",
// "5516997114803",
// "5516997477050",
// "554191411114",
// "554192761110",
// "554499759685",
// "554899920681",
// "554999145454",
// "555180170176",
// "555191132364",
// "555391673229",
// "5511982549750",
// "5511995514995",
// "556185441103",
// "556196596589",
// "556584277509",
// "556592144572",
// "559187320920",
// "5511982957526",
// "31682724218",
// "5511964457525",
// "5511973180299",
// "5511975139050",
// "5511981011633",
// "5511982460209",
// "558496483635",
// "557788488888",
// "5511932108031",
// ];

async function sendMessagesToInactiveMembers() {
    try {
        for (const number of numbers) {
            // Call the function to send the message
            await sendMessageToNumberAPI(client, number, "membroinativo"); // Change "membroinativo" if needed.
            console.log(`Message sent to ${number}`);
        }
    } catch (error) {
        console.error('Error while sending messages:', error);
    }
}

// Call the function
sendMessagesToInactiveMembers();
