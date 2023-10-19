
function checkPhoneNumber(phoneNumbersFromDB, inputPhoneNumber) {
    for (const entry of phoneNumbersFromDB) {
        let phoneNumber = entry.phone_number;
        let status = entry.status;

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
                    return {found: true, status: status, mb: entry.registration_id};
                }
            } else if (phoneNumber.length === 12) {
                // If it has 12 digits, it doesn't include the ninth digit. Let's try with it too
                let numberWithNinthDigit = phoneNumber.slice(0, 4) + '9' + phoneNumber.slice(4);
                if (phoneNumber === inputPhoneNumber || numberWithNinthDigit === inputPhoneNumber) {
                    return {found: true, status: status, mb: entry.registration_id};
                }
            }
        } else {
            if (phoneNumber === inputPhoneNumber) {
                return {found: true, status: status, mb: entry.registration_id};
            }
        }
    }

    return {found: false};
}

module.exports = checkPhoneNumber;

