// twilioClient.js

const twilio = require('twilio');
const { getLastCommunication, logCommunication } = require('./pgsql'); 
require('dotenv').config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const flowSid = process.env.TWILIO_FLOW_SID;
const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER;
const twilioClient = twilio(accountSid, authToken);
async function triggerTwilioOrRemove(phoneNumber, reason) {
    try {
        const waitingPeriod = parseFloat(process.env.CONSTANT_WAITING_PERIOD) * 1.2;
        
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
            
            await logCommunication(phoneNumber, reason);

            return true;
        } else {
            console.log(`Skipped Twilio Flow for ${phoneNumber}. Waiting period has not yet expired.`);
            return false;
        }
    } catch (error) {
        console.error('Error in triggerTwilioOrRemove function:', error);
        
        return true; 
    }
}

module.exports = { 
    triggerTwilioOrRemove,
    handleUserUpdate,
    onUserPhoneNumberUpdate,
    manageUserStatus  // Export the status management function
};
