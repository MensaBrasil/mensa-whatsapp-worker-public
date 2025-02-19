import { jest } from '@jest/globals';

// Mock environment variables
process.env.TELEGRAM_BOT_TOKEN = 'test-token';
process.env.TELEGRAM_CHAT_ID = 'test-chat-id';
process.env.PG_DB_HOST = 'localhost';
process.env.PG_DB_PORT = '5432';
process.env.PG_DB_NAME = 'test_db';
process.env.PG_DB_USER = 'test_user';
process.env.PG_DB_PASSWORD = 'test_password';
process.env.TWILIO_ACCOUNT_SID = 'ACtestSid';
process.env.TWILIO_AUTH_TOKEN = 'testAuthToken';
process.env.TWILIO_FLOW_SID = 'testFlowSid';
process.env.TWILIO_WHATSApp_NUMBER = '1122334455';
process.env.CONSTANT_WAITING_PERIOD = '1000';

// Mock process.stdin for tests
process.stdin = {
    setRawMode: jest.fn(),
    on: jest.fn(),
};

// Mock WhatsApp Web Client
const eventHandlers = {};
jest.mock('whatsapp-web.js', () => ({
    Client: jest.fn().mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue(),
        on: jest.fn((event, handler) => {
            eventHandlers[event] = handler;
            return this;
        }),
        getChats: jest.fn().mockResolvedValue([]),
        getChatById: jest.fn(),
        setAutoDownloadDocuments: jest.fn(),
        setAutoDownloadAudio: jest.fn(),
        setAutoDownloadPhotos: jest.fn(),
        setAutoDownloadVideos: jest.fn(),
        info: { wid: { user: 'bot-user' } }
    })),
    LocalAuth: jest.fn()
}));

// Export event handlers for tests
global.__whatsappEventHandlers = eventHandlers;

// Mock Telegram Bot
jest.mock('node-telegram-bot-api', () => {
    return jest.fn().mockImplementation(() => ({
        sendMessage: jest.fn().mockResolvedValue(true)
    }));
});

// Mock PostgreSQL Pool
jest.mock('pg', () => ({
    Pool: jest.fn(() => ({
        query: jest.fn(),
        end: jest.fn(),
        on: jest.fn(),
    }))
}));

// Global test timeout
jest.setTimeout(30000);