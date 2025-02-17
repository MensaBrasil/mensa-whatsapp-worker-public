const getGroupParticipants = require('../../../dispatcher/src/utils/chat');

// Mock the client object with Jest
const client = {
    getChatById: jest.fn()
};

describe('getGroupParticipants', () => {
    // Mock console.log to track calls without output
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => { });
    });

    // Clear all mocks after each test
    afterEach(() => {
        jest.clearAllMocks();
        console.log.mockRestore();
    });

    test('should return formatted participants for a valid group chat', async () => {
        // Mock participants data
        const mockParticipants = [
            { id: { user: '123' }, isAdmin: true },
            { id: { user: '456' }, isAdmin: false }
        ];

        // Setup mock group chat response
        client.getChatById.mockResolvedValue({
            isGroup: true,
            participants: mockParticipants
        });

        // Call the function and assert results
        const result = await getGroupParticipants(client, 'group123');
        expect(result).toEqual([
            { phone: '123', isAdmin: true },
            { phone: '456', isAdmin: false }
        ]);
        expect(client.getChatById).toHaveBeenCalledWith('group123');
    });

    test('should return empty array and log message for non-group chat', async () => {
        // Setup mock non-group chat response
        client.getChatById.mockResolvedValue({ isGroup: false });

        // Call the function and assert results
        const result = await getGroupParticipants(client, 'not_a_group');
        expect(result).toEqual([]);
        expect(console.log).toHaveBeenCalledWith('Chat is not a group chat');
    });

    test('should throw error when fetching chat fails', async () => {
        // Setup mock error response
        const errorMessage = 'Failed to fetch chat';
        client.getChatById.mockRejectedValue(new Error(errorMessage));

        // Assert the function rejects with the error
        await expect(getGroupParticipants(client, 'invalid_group'))
            .rejects
            .toThrow(errorMessage);
    });
});