const { getLastCommunication, logCommunication } = require('../../src/database/pgsql.cjs');
const { triggerTwilioOrRemove } = require('../../src/utils/twilio.cjs');
const twilio = require('twilio');


jest.mock('twilio');
jest.mock('../../src/database/pgsql.cjs', () => ({
    getLastCommunication: jest.fn(),
    logCommunication: jest.fn(() => Promise.resolve()),
}));

jest.useFakeTimers();
const mockExecutionCreate = jest.fn();
twilio.mockImplementation(() => ({
    studio: {
        v2: {
            flows: () => ({
                executions: { create: mockExecutionCreate },
            }),
        },
    },
}));

describe('triggerTwilioOrRemove', () => {
    const phoneNumber = '5511987654321';
    const reason = 'test_reason';
    const now = new Date('2024-02-20T12:00:00Z');

    beforeEach(() => {
        jest.clearAllMocks();
        jest.setSystemTime(now);
    });

    test('skips action if waiting period not expired', async () => {
        const recentTimestamp = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
        getLastCommunication.mockResolvedValue({
            timestamp: recentTimestamp,
            reason: reason,
        });

        const result = await triggerTwilioOrRemove(phoneNumber, reason);
        expect(result).toBe(false);
        expect(mockExecutionCreate).not.toHaveBeenCalled();
    });

    test('returns true (remove user) on error', async () => {
        getLastCommunication.mockRejectedValue(new Error('DB failure'));
        const result = await triggerTwilioOrRemove(phoneNumber, reason);
        expect(result).toBe(true);
    });
});