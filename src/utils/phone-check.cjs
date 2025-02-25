/**
 * Preprocesses a list of phone number entries to handle various formats and create a mapping.
 * For Brazilian numbers (starting with '55'), it creates variations with and without the ninth digit.
 * For international numbers, it preserves the format after basic normalization.
 * 
 * @param {Array<{phone_number: string}>} phoneNumbersFromDB - Array of objects containing phone numbers
 * @returns {Map<string, Array<{phone_number: string}>>} A Map where keys are normalized phone numbers
 *         and values are arrays of original entries that match that number
 * 
 */
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
      const numberWithoutNinthDigit =
        phoneNumber.slice(0, 4) + phoneNumber.slice(5);
      const numberWithNinthDigit =
        phoneNumber.slice(0, 4) + '9' + phoneNumber.slice(4);

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

/**
 * Checks a phone number against a map of registered numbers and returns detailed status information
 * @param {Map<string, Array<Object>>} phoneNumberMap - Map containing phone numbers as keys and arrays of registration entries as values
 * @param {string} inputPhoneNumber - The phone number to check
 * @returns {Object} An object containing:
 *   - found {boolean} - Whether the phone number was found in the map
 *   - status {string} - [If found] The status from the first matched entry
 *   - mb {number} - [If found] The registration ID from the first matched entry
 *   - jb_under_10 {boolean} - [If found] Whether any entry has jb_under_10 flag
 *   - jb_over_10 {boolean} - [If found] Whether any entry has jb_over_10 flag
 *   - is_adult {boolean} - [If found] Whether any entry has is_adult flag
 */
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
