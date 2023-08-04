const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { printChats, getGroupParticipants, getGroupIdByName, removeParticipantByPhoneNumber } = require('./chat');
const getWorksheetContents = require('./googlesheets');

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', qr => {
    qrcode.generate(qr, {small: true});
});

client.on('ready', () => {
    console.log('Client is ready!');

    

    getWorksheetContents('1Sv2UVDeOk3C_Zt4Bye6LWrm9G93G57YEyp-RUVcljSw', 'Cadastro completo')
      .then(data => console.log(data))
      .catch(error => console.error(error));
});


client.initialize();
