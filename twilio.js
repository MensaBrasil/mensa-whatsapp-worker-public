// twilioClient.js

const twilio = require('twilio');
const { getLastCommunication, logCommunication, resolveCommunication } = require('./pgsql'); 
require('dotenv').config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const flowSid = process.env.TWILIO_FLOW_SID;
const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER;
const twilioClient = twilio(accountSid, authToken);


// Function to trigger the Twilio Flow for a specific reason, checking the waiting period
async function triggerTwilioOrRemove(phoneNumber, reason) {
    try {
        const waitingPeriod = process.env.CONSTANT_WAITING_PERIOD

        // Check the last unresolved communication for this phone number and specific reason
        const lastComm = await getLastCommunication(phoneNumber, reason);
        const now = new Date();

        if (!lastComm || now - new Date(lastComm.timestamp) > waitingPeriod) {
            // Trigger Twilio Flow if outside the waiting period
            const execution = await twilioClient.studio.v2.flows(flowSid)
                .executions
                .create({
                    to: phoneNumber,
                    from: `whatsapp:${twilioWhatsAppNumber}`,
                    parameters: { "reason": reason }  
                });

            console.log(`Twilio Flow triggered for ${phoneNumber} with reason: ${reason}, Execution SID: ${execution.sid}`);
            
            // Log the communication with the specified reason and 'unresolved' status
            await logCommunication(phoneNumber, reason);

            // Return true to indicate that the waiting period was over, and removal should proceed
            return true;
        } else {
            console.log(`Skipped Twilio Flow for ${phoneNumber} with reason: ${reason}. Waiting period has not yet expired.`);
            // Return false to indicate that the user should not be removed yet
            return false;
        }
    } catch (error) {
        console.error('Error in triggerTwilioOrRemove function:', error);
        // In case of an error, default to removal
        return true; 
    }
    }


// Function to resolve previous 'unknown_number' communications when a user's information is updated
async function handleUserUpdate(phoneNumber) {
    try {
        await resolveCommunication(phoneNumber, 'unknown_number');
        console.log(`Resolved 'unknown_number' communications for ${phoneNumber}.`);
    } catch (error) {
        console.error(`Error resolving communications for ${phoneNumber}:`, error);
    }
}

// Function to handle a user's phone number update
async function onUserPhoneNumberUpdate(oldPhoneNumber, newPhoneNumber) {
    // Mark previous 'unknown_number' communications as resolved for the old phone number
    await handleUserUpdate(oldPhoneNumber);
    
    // Log the update event for the new phone number (optional)
    console.log(`User updated phone number from ${oldPhoneNumber} to ${newPhoneNumber}`);
}

// Comprehensive usage example for managing communications
async function manageUserStatus(phoneNumber, isMemberActive) {
    if (isMemberActive) {
        // If member is active, no removal is needed; handle user updates if necessary
        await onUserPhoneNumberUpdate(phoneNumber, phoneNumber); // For demonstration, assuming an update is the same number
    } else {
        // If membership is expired, handle removal using 'expired_membership' reason
        const removalTriggered = await triggerTwilioOrRemove(phoneNumber, 'expired_membership');
        if (removalTriggered) {
            console.log(`Removal process initiated for ${phoneNumber} due to expired membership.`);
        } else {
            console.log(`Removal not required for ${phoneNumber}; waiting period active or no issues.`);
        }
    }
}

module.exports = { 
    triggerTwilioOrRemove,
    handleUserUpdate,
    onUserPhoneNumberUpdate,
    manageUserStatus  // Export the status management function
};
