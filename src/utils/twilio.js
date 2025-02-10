
const twilio = require('twilio');
const { getLastCommunication, logCommunication } = require('../database/pgsql'); 
require('dotenv').config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const flowSid = process.env.TWILIO_FLOW_SID;
const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER;
const twilioClient = twilio(accountSid, authToken);

async function triggerTwilioOrRemove(phoneNumber, reason) {
    try {
        const waitingPeriod = parseFloat(process.env.CONSTANT_WAITING_PERIOD) * 1.2;
        const oneWeek = 7 * 24 * 60 * 60 * 1000; // One week in milliseconds
        const lastComm = await getLastCommunication(phoneNumber);
        const now = new Date();

        if (!lastComm || lastComm.reason !== reason) {
            // Trigger Twilio immediately for a new reason or no previous communication
            await logCommunication(phoneNumber, reason);
            const execution = await twilioClient.studio.v2.flows(flowSid)
                .executions
                .create({
                    to: `whatsapp:+${phoneNumber}`,
                    from: `whatsapp:+${twilioWhatsAppNumber}`,
                    parameters: { "reason": reason, "member_phone": `+${phoneNumber}` }
                });

            console.log(`Twilio Flow triggered for ${phoneNumber} with reason: ${reason}, Execution SID: ${execution.sid}`);
            return false; // User was warned, not removed
        }

        const lastCommTime = new Date(lastComm.timestamp);
        const timeElapsed = now - lastCommTime;

        if (timeElapsed > oneWeek) {
            // Trigger Twilio again if one week has passed for the same reason
            await logCommunication(phoneNumber, reason);
            const execution = await twilioClient.studio.v2.flows(flowSid)
                .executions
                .create({
                    to: `whatsapp:+${phoneNumber}`,
                    from: `whatsapp:+${twilioWhatsAppNumber}`,
                    parameters: { "reason": reason, "member_phone": `+${phoneNumber}` }
                });

            console.log(`Twilio Flow retriggered for ${phoneNumber} with the same reason after one week: ${reason}, Execution SID: ${execution.sid}`);
            return false; // Process begins over, user was warned again, not removed
        }

        if (timeElapsed > waitingPeriod) {
            console.log(`Waiting period ended for ${phoneNumber} with reason: ${reason}. User should be removed.`);
            return true; // Waiting period has ended, user should be removed
        }

        console.log(`Skipped Twilio Flow for ${phoneNumber}. Waiting period has not yet expired for reason: ${reason}`);
        return false; // Waiting period hasn't ended, user was not warned again
    } catch (error) {
        console.error('Error in triggerTwilioOrRemove function:', error);
        return true; // On error, user should be removed
    }
}

module.exports = { 
    triggerTwilioOrRemove,
};
