const phoneNumberColumns = ['TELEFONE - CELULAR', 'TELEFONE - COMERCIAL', 'TELEFONE - RESIDENCIAL', 'TELEFONE - EXTRA'];

function checkPhoneNumber(df, inputPhoneNumber) {
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

            let status = df.at(i, 'STATUS');

            // If it's a Brazilian number, try with and without the ninth digit (which is actually the fifth digit in this case)
            if (phoneNumber.startsWith('55')) {
                if (phoneNumber.length === 13) {
                    // If it has 13 digits, it includes the ninth digit. Let's try without it too
                    let numberWithoutNinthDigit = phoneNumber.slice(0, 4) + phoneNumber.slice(5);
                    if (phoneNumber === inputPhoneNumber || numberWithoutNinthDigit === inputPhoneNumber) {
                        return {found: true, status: status};
                    }
                } else if (phoneNumber.length === 12) {
                    // If it has 12 digits, it doesn't include the ninth digit. Let's try with it too
                    let numberWithNinthDigit = phoneNumber.slice(0, 4) + '9' + phoneNumber.slice(4);
                    if (phoneNumber === inputPhoneNumber || numberWithNinthDigit === inputPhoneNumber) {
                        return {found: true, status: status};
                    }
                }
            } else {
                if (phoneNumber === inputPhoneNumber) {
                    return {found: true, status: status};
                }
            }
        }
    }
    return {found: false};
}

module.exports = checkPhoneNumber;
