

function checkPhoneNumber(phoneNumbersFromDB, inputPhoneNumber) {
    let matchedEntries = [];

    for (const entry of phoneNumbersFromDB) {
        let phoneNumber = entry.phone_number;

        // Check if the phone number is international
        if (phoneNumber.includes('+')) {
            phoneNumber = phoneNumber.replace(/\D/g, ''); // Remove any non-numeric characters
        } else {
            // Remove leading zeros before adding the Brazilian country code
            phoneNumber = '55' + phoneNumber.replace(/\D/g, '').replace(/^0+/, '');
        }
        

        // Check matches for Brazilian numbers (with/without the ninth digit)
        if (phoneNumber.startsWith('55')) {
            let numberWithoutNinthDigit = phoneNumber.slice(0, 4) + phoneNumber.slice(5);
            let numberWithNinthDigit = phoneNumber.slice(0, 4) + '9' + phoneNumber.slice(4);

            if ([phoneNumber, numberWithoutNinthDigit, numberWithNinthDigit].includes(inputPhoneNumber)) {
                matchedEntries.push(entry);
            }
        } else if (phoneNumber === inputPhoneNumber) {
            matchedEntries.push(entry);
        }
    }

    // Decide based on collected matched entries
    if (matchedEntries.length > 0) {
        let isJovemBrilhante = true;
        for (const entry of matchedEntries) {
            if (!entry.jovem_brilhante) {
                isJovemBrilhante = false;
                break;
            }
        }
        return {found: true, status: matchedEntries[0].status, mb: matchedEntries[0].registration_id, jovem_brilhante: isJovemBrilhante};
    }

    return {found: false};
}


module.exports = checkPhoneNumber;

