function preprocessPhoneNumbers(phoneNumbersFromDB) {
    const phoneNumberMap = {};

    for (const entry of phoneNumbersFromDB) {
        let phoneNumber = entry.phone_number;

        // Normalize the phone number
        if (phoneNumber.includes('+')) {
            phoneNumber = phoneNumber.replace(/\D/g, ''); // Remove non-numeric characters
        } else {
            // Remove leading zeros before adding the Brazilian country code
            phoneNumber = '55' + phoneNumber.replace(/\D/g, '').replace(/^0+/, '');
        }

        if (phoneNumber.startsWith('55')) {
            // Add variations for Brazilian numbers
            const numberWithoutNinthDigit = phoneNumber.slice(0, 4) + phoneNumber.slice(5);
            const numberWithNinthDigit = phoneNumber.slice(0, 4) + '9' + phoneNumber.slice(4);

            phoneNumberMap[phoneNumber] = phoneNumberMap[phoneNumber] || [];
            phoneNumberMap[phoneNumber].push(entry);

            phoneNumberMap[numberWithoutNinthDigit] = phoneNumberMap[numberWithoutNinthDigit] || [];
            phoneNumberMap[numberWithoutNinthDigit].push(entry);

            phoneNumberMap[numberWithNinthDigit] = phoneNumberMap[numberWithNinthDigit] || [];
            phoneNumberMap[numberWithNinthDigit].push(entry);
        } else {
            // Add as-is for non-Brazilian numbers
            phoneNumberMap[phoneNumber] = phoneNumberMap[phoneNumber] || [];
            phoneNumberMap[phoneNumber].push(entry);
        }
    }

    return phoneNumberMap;
}

function checkPhoneNumber(phoneNumberMap, inputPhoneNumber) {
    const matchedEntries = phoneNumberMap[inputPhoneNumber] || [];

    // Decide based on collected matched entries
    if (matchedEntries.length > 0) {
        let isJovemBrilhante = true;
        for (const entry of matchedEntries) {
            if (!entry.jovem_brilhante) {
                isJovemBrilhante = false;
                break;
            }
        }
        return {
            found: true,
            status: matchedEntries[0].status,
            mb: matchedEntries[0].registration_id,
            jovem_brilhante: isJovemBrilhante
        };
    }

    return { found: false };
}

module.exports = { preprocessPhoneNumbers, checkPhoneNumber };
