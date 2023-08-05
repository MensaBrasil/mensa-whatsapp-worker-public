const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { printChats, getGroupParticipants, getGroupIdByName, removeParticipantByPhoneNumber } = require('./chat');
const getWorksheetContents = require('./googlesheets');
const fs = require('fs');
const checkPhoneNumber = require('./phone-check');

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', qr => {
    qrcode.generate(qr, {small: true});
});

client.on('ready', () => {
    console.log('Client is ready!');

    const groupName = 'Avisos Mensa - SUDESTE';  // Replace with your actual group name

    getGroupIdByName(client, groupName)
        .then(groupId => getGroupParticipants(client, groupId))
        .then(participants => {
            // Use phone property from the object returned by getGroupParticipants
            const groupMembers = participants.map(participant => participant.phone);  
            return getWorksheetContents('1Sv2UVDeOk3C_Zt4Bye6LWrm9G93G57YEyp-RUVcljSw', 'Cadastro completo')
                .then(df => {
                    let checkPromises = groupMembers.map(member => checkPhoneNumber(df, member));

                    return Promise.all(checkPromises)
                        .then(results => {
                            let notFoundNumbers = groupMembers.filter((member, i) => !results[i].found);
                            let inactiveNumbers = groupMembers.filter((member, i) => results[i].found && results[i].status !== 'Ativo');
                        
                            // Save numbers not found to a file
                            fs.writeFileSync('not_found_numbers.txt', notFoundNumbers.join('\n'));
                        
                            // Save active numbers to a file
                            fs.writeFileSync('inactive_numbers.txt', inactiveNumbers.join('\n'));
                            
                            console.log('Done!');
                        });
                });
        })
        .catch(console.error);
});

client.initialize();
