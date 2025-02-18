require('dotenv').config();
let AWS = require('aws-sdk');
const { SQS } = require('@aws-sdk/client-sqs');

AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

const sqs_client = new SQS({
    region: process.env.AWS_REGION,
    endpoint: process.env.AWS_ENDPOINT,

    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

module.exports = sqs_client;
