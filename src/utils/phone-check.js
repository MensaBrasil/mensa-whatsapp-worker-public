function preprocessPhoneNumbers(phoneNumbersFromDB) {
    const phoneNumberMap = new Map();

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

            const addToMap = (num) => {
                if (!phoneNumberMap.has(num)) {
                    phoneNumberMap.set(num, []);
                }
                phoneNumberMap.get(num).push(entry);
            };

            addToMap(phoneNumber);
            addToMap(numberWithoutNinthDigit);
            addToMap(numberWithNinthDigit);
        } else {
            // Add as-is for non-Brazilian numbers
            if (!phoneNumberMap.has(phoneNumber)) {
                phoneNumberMap.set(phoneNumber, []);
            }
            phoneNumberMap.get(phoneNumber).push(entry);
        }
    }

    return phoneNumberMap;
}

function checkPhoneNumber(phoneNumberMap, inputPhoneNumber) {
    const matchedEntries = phoneNumberMap.get(inputPhoneNumber) || [];

    // Decide based on collected matched entries
    if (matchedEntries.length > 0) {
        let hasJbUnder10 = false;
        let hasJbOver10 = false;
        let hasAdult = false;

        for (const entry of matchedEntries) {
            if (entry.jb_under_10) {
                hasJbUnder10 = true;
            }
            if (entry.jb_over_10) {
                hasJbOver10 = true;
            }
            if (entry.is_adult) {
                hasAdult = true;
            }
        }

        return {
            found: true,
            status: matchedEntries[0].status,
            mb: matchedEntries[0].registration_id,
            jb_under_10: hasJbUnder10,
            jb_over_10: hasJbOver10,
            is_adult: hasAdult,
        };
    }

    return { found: false };
}

module.exports = { preprocessPhoneNumbers, checkPhoneNumber };
