const triggerTwilioOrRemove = require('../../src/utils/twilio');
const { getLastCommunication, logCommunication } = require('../../src/database/pgsql');

jest.mock('twilio', () => {
    // Create a mock for twilio client which returns a studio stub.
    const createMock = jest.fn().mockResolvedValue({ sid: 'MOCK_SID' });
    const flowsMock = jest.fn().mockReturnValue({ executions: { create: createMock } });
    return jest.fn(() => ({ studio: { v2: { flows: flowsMock } } }));
});

jest.mock('../../src/database/pgsql', () => ({
    getLastCommunication: jest.fn(),
    logCommunication: jest.fn().mockResolvedValue(undefined)
}));

describe('triggerTwilioOrRemove', () => {
    const testPhone = '1234567890';
    const testReason = 'testReason';

    beforeEach(() => {
        jest.resetAllMocks();
    });

    test('should trigger Twilio immediately when no last communication exists', async () => {
        getLastCommunication.mockResolvedValue(null);
        const result = await triggerTwilioOrRemove(testPhone, testReason);

        expect(getLastCommunication).toHaveBeenCalledWith(testPhone);
        expect(logCommunication).toHaveBeenCalledWith(testPhone, testReason);
        expect(result).toBe(true);
    });

    test('should trigger Twilio immediately when last communication has a different reason', async () => {
        getLastCommunication.mockResolvedValue({ reason: 'otherReason', timestamp: new Date().toISOString() });
        const result = await triggerTwilioOrRemove(testPhone, testReason);
        expect(logCommunication).toHaveBeenCalledWith(testPhone, testReason);
        expect(result).toBe(true);
    });

    test('should retrigger Twilio when one week has passed with the same reason', async () => {
        // Set last communication time to more than one week ago
        const pastDate = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000 + 1000));
        getLastCommunication.mockResolvedValue({ reason: testReason, timestamp: pastDate.toISOString() });
        const result = await triggerTwilioOrRemove(testPhone, testReason);
        expect(logCommunication).toHaveBeenCalledWith(testPhone, testReason);
        expect(result).toBe(true);
    });

    test('should return true to remove user when waiting period ended but one week not passed', async () => {
        // Set last communication time to exceed waiting period (1200ms) but not one week.
        const pastDate = new Date(Date.now() - 2000);
        getLastCommunication.mockResolvedValue({ reason: testReason, timestamp: pastDate.toISOString() });
        const result = await triggerTwilioOrRemove(testPhone, testReason);
        // Should not call Twilio execution
        expect(logCommunication).not.toHaveBeenCalled();
        expect(result).toBe(true);
    });

    test('should skip Twilio Flow when waiting period has not expired', async () => {
        // Set last communication time to less than waiting period.
        const pastDate = new Date(Date.now() - 500);
        getLastCommunication.mockResolvedValue({ reason: testReason, timestamp: pastDate.toISOString() });
        const result = await triggerTwilioOrRemove(testPhone, testReason);
        expect(logCommunication).not.toHaveBeenCalled();
        expect(result).toBe(false);
    });

    test('should remove user when an error occurs', async () => {
        getLastCommunication.mockRejectedValue(new Error('Test error'));
        const result = await triggerTwilioOrRemove(testPhone, testReason);
        expect(result).toBe(true);
    });
});
