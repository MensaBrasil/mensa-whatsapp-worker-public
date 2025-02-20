const { getGroupParticipants } = require('../../src/utils/chat.cjs');

describe('getGroupParticipants', () => {
    test('should return empty array if chat is not a group', async () => {
        const mockClient = {
            getChatById: jest.fn().mockResolvedValue({
                isGroup: false
            })
        };
        const result = await getGroupParticipants(mockClient, 'fake-group-id');
        expect(result).toEqual([]);
    });

    test('should return array of participants with phone and admin status', async () => {
        const mockParticipants = [
            {
                id: { user: '1234567890' },
                isAdmin: true
            },
            {
                id: { user: '0987654321' }, 
                isAdmin: false
            }
        ];

        const mockClient = {
            getChatById: jest.fn().mockResolvedValue({
                isGroup: true,
                participants: mockParticipants
            })
        };

        const result = await getGroupParticipants(mockClient, 'fake-group-id');
        
        expect(result).toEqual([
            { phone: '1234567890', isAdmin: true },
            { phone: '0987654321', isAdmin: false }
        ]);
    });
});
