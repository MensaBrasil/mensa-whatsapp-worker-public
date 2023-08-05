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
    const phoneNumberColumns = ['TELEFONE - CELULAR', 'TELEFONE - COMERCIAL', 'TELEFONE - RESIDENCIAL'];
    const inputPhoneNumber = "447523905463"; // replace with the number you're looking for
    
    getWorksheetContents('1Sv2UVDeOk3C_Zt4Bye6LWrm9G93G57YEyp-RUVcljSw', 'Cadastro completo')
        .then(df => {
            let matchFound = false;
            for (let i = 0; i < df.shape[0]; i++) {
                for (let column of phoneNumberColumns) {
                    let phoneNumber = df.at(i, column);
    
                    // Check if phone number is present in the current column
                    if (!phoneNumber) continue;
    
                    // Check if the phone number is international
                    if (phoneNumber.includes('+')) {
                        // Remove any non-numeric characters
                        phoneNumber = phoneNumber.replace(/\D/g, '');
                    } else {
                        // If the number doesn't contain a '+', assume it's Brazilian (55)
                        phoneNumber = '55' + phoneNumber.replace(/\D/g, '');
                    }
    
                    // If it's a Brazilian number, try with and without the ninth digit (which is actually the fifth digit in this case)
                    if (phoneNumber.startsWith('55')) {
                        if (phoneNumber.length === 13) {
                            // If it has 13 digits, it includes the ninth digit. Let's try without it too
                            let numberWithoutNinthDigit = phoneNumber.slice(0, 4) + phoneNumber.slice(5);
                            if (phoneNumber === inputPhoneNumber || numberWithoutNinthDigit === inputPhoneNumber) {
                                console.log('Match found!');
                                console.log('N DE CADASTRO:', df.at(i, ' N° DE CADASTRO'));  // Output the N DE CADASTRO value
                                matchFound = true;
                                break;
                            }
                        } else if (phoneNumber.length === 12) {
                            // If it has 12 digits, it doesn't include the ninth digit. Let's try with it too
                            let numberWithNinthDigit = phoneNumber.slice(0, 4) + '9' + phoneNumber.slice(4);
                            if (phoneNumber === inputPhoneNumber || numberWithNinthDigit === inputPhoneNumber) {
                                console.log('Match found!');
                                console.log('N DE CADASTRO:', df.at(i, ' N° DE CADASTRO'));  // Output the N DE CADASTRO value
                                matchFound = true;
                                break;
                            }
                        }
                    } else {
                        if (phoneNumber === inputPhoneNumber) {
                            console.log('Match found!');
                            console.log('N DE CADASTRO:', df.at(i, 'N DE CADASTRO'));  // Output the N DE CADASTRO value
                            matchFound = true;
                            break;
                        }
                    }
                }
                if (matchFound) break;  // Break the outer loop if a match is found
            }
            if (!matchFound) {
                console.log('No match found.');
            }
        })
        .catch(error => console.error(error));
    

    

});


client.initialize();
