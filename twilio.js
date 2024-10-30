// twilioClient.js

const twilio = require('twilio');
const { getLastCommunication, logCommunication } = require('./pgsql'); // Import the comms functions
require('dotenv').config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const flowSid = process.env.TWILIO_FLOW_SID;
const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER;
const twilioClient = twilio(accountSid, authToken);

// Function to trigger the Twilio Flow with a reason, checking the waiting period
async function triggerTwilioOrRemove(phoneNumber, reason) {
    try {
        const waitingPeriod = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

        // Check the last communication for this phone number
        const lastComm = await getLastCommunication(phoneNumber);
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
            
            // Log this communication event in comms table
            await logCommunication(phoneNumber, reason);

            // Return true to indicate that the waiting period was over, and removal should proceed
            return true;
        } else {
            console.log(`Skipped Twilio Flow for ${phoneNumber}. Waiting period has not yet expired.`);
            // Return false to indicate that the user should not be removed yet
            return false;
        }
    } catch (error) {
        console.error('Error in triggerTwilioOrRemove function:', error);
        // In case of an error, assume no removal should happen
        return false;
    }
}

module.exports = { triggerTwilioOrRemove }; // Export the function
