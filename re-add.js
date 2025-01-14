const { getGroupParticipants } = require('./chat');


async function addPhoneNumberToGroup(client, inputPhoneNumber, groupId) {
    try {
        await delay(3000);
        let phoneNumber = normalizePhoneNumber(inputPhoneNumber);

        const isBrazilianNumber = phoneNumber.startsWith('55');
        if (isBrazilianNumber) {
            // Try adding the number as is
            if (await tryAddParticipant(client, phoneNumber, groupId)) {
                return true;
            } else {
                // Adjust the number and try again
                phoneNumber = adjustBrazilianPhoneNumber(phoneNumber);
                return await tryAddParticipant(client, phoneNumber, groupId);
            }
        } else {
            // For non-Brazilian numbers, just try once
            return await tryAddParticipant(client, phoneNumber, groupId);
        }

    } catch (error) {
        console.error(`Error processing ${inputPhoneNumber} for group with ID: ${groupId}:`, error);
        return false;
    }
}



function getRandomDelay(baseDelay) {
    // Calculate the random variation as 20% of the baseDelay
    const variation = baseDelay * 0.3;
    // Generate a random number between -variation and variation
    const randomDelay = Math.random() * (2 * variation) - variation;
    // Add the randomDelay to the baseDelay
    const totalDelay = baseDelay + randomDelay;

    return totalDelay;
}

function delay(ms) {
    const totalDelay = getRandomDelay(ms);
    return new Promise(resolve => setTimeout(resolve, totalDelay));
}


// Function to normalize phone numbers
function normalizePhoneNumber(phoneNumber) {
    if (phoneNumber.includes('+')) {
        return phoneNumber.replace(/\D/g, ''); // Remove non-numeric characters
    } else {
        return '55' + phoneNumber.replace(/\D/g, ''); // Assume it's Brazilian (55)
    }
}




// Function to adjust the Brazilian phone number by adding or removing the '9' digit
function adjustBrazilianPhoneNumber(phoneNumber) {
    const regexWithNine = /^55(\d{2})9(\d{8})$/; // Matches Brazilian numbers with the '9' digit
    const regexWithoutNine = /^55(\d{2})(\d{8})$/; // Matches Brazilian numbers without the '9' digit

    if (phoneNumber.match(regexWithNine)) {
        // Remove the '9' if it exists
        return phoneNumber.replace(regexWithNine, '55$1$2');
    } else if (phoneNumber.match(regexWithoutNine)) {
        // Add the '9' after the area code if it's missing
        return phoneNumber.replace(regexWithoutNine, '55$19$2');
    }
    return phoneNumber;
}


// Function to try adding the participant and return success status
async function tryAddParticipant(client, phoneNumber, groupId) {
    console.log(`Trying to add ${phoneNumber} to group with ID: ${groupId}`);
    const chat = await client.getChatById(groupId);

    if (!chat) {
        console.error(`Chat not found for group ID: ${groupId}`);
        return false;
    }

    const participants = await getGroupParticipants(client, groupId);
    const isAlreadyInGroup = participants.some(participant => participant.phone === phoneNumber);

    if (isAlreadyInGroup) {
        console.log(`${phoneNumber} is already in group with ID: ${groupId}`);
        return true;
    }

    if (chat.addParticipants) {
        chat.sendSeen();
        await delay(1500);
        await chat.addParticipants([`${phoneNumber}@c.us`]);

        // Verification Step
        await delay(10000);
        const newParticipants = await getGroupParticipants(client, groupId);
        const isAdded = newParticipants.some(participant => participant.phone === phoneNumber);

        if (isAdded) {
            console.log(`${phoneNumber} verified in group with ID: ${groupId}`);
            return true;
        } else {
            console.error(`Failed to verify ${phoneNumber} in group with ID: ${groupId}`);
            return false;
        }
    } else {
        console.error(`Failed to add ${phoneNumber} to group with ID: ${groupId}`);
        return false;
    }
}



module.exports = {
    addPhoneNumberToGroup
};

