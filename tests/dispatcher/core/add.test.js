const addMembersToGroups = require('../../../dispatcher/src/core/addMode');
const { getWhatsappQueue, getMemberPhoneNumbers } = require('../../../dispatcher/src/database/pgsql');
const sqs_client = require('../../../dispatcher/src/utils/sqs_conn');

// Mock the dependencies
jest.mock('../../../dispatcher/src/database/pgsql');
jest.mock('../../../dispatcher/src/utils/sqs_conn');

describe('addMembersToGroups', () => {
    const mockGroups = [
        {
            id: { _serialized: 'group1' },
            name: 'Test Group 1'
        }
    ];

    const mockChats = [
        { isGroup: false, id: { user: '12345678' } },
        { isGroup: true, id: { user: '87654321' } },
        { isGroup: false, id: { user: '11112222' } }
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        console.error = jest.fn();
    });

    it('should process groups and call getWhatsappQueue with correct group ID', async () => {
        getWhatsappQueue.mockResolvedValue({ rows: [] });
        await addMembersToGroups(mockChats, mockGroups);
        expect(getWhatsappQueue).toHaveBeenCalledWith('group1');
    });

    it('should filter non-group chats and extract last 8 digits', async () => {
        getWhatsappQueue.mockResolvedValue({ rows: [] });
        await addMembersToGroups(mockChats, mockGroups);

        const expectedDigits = ['12345678', '11112222'];
        expect(mockChats.filter(chat => !chat.isGroup).length).toBe(2);
        expect(mockChats.filter(chat => !chat.isGroup).map(chat => chat.id.user.slice(-8)))
            .toEqual(expectedDigits);
    });

    it('should send SQS message when phone number matches', async () => {
        const mockQueue = {
            rows: [{ registration_id: 'reg1' }]
        };

        getWhatsappQueue.mockResolvedValue(mockQueue);
        getMemberPhoneNumbers.mockResolvedValue(['5512345678']);

        await addMembersToGroups(mockChats, mockGroups);

        expect(sqs_client.sendMessage).toHaveBeenCalledWith({
            QueueUrl: process.env.SQS_URL,
            MessageBody: JSON.stringify({
                type: 'add',
                groupId: 'group1',
                phone: '5512345678',
                registration_id: 'reg1'
            })
        });
    });

    it('should throw error when phone number not found in chats', async () => {
        const mockQueue = {
            rows: [{ registration_id: 'reg1' }]
        };

        getWhatsappQueue.mockResolvedValue(mockQueue);
        getMemberPhoneNumbers.mockResolvedValue(['5544332211']); // Not in mockChats

        await addMembersToGroups(mockChats, mockGroups);

        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('Error sending request to add: reg1 to group')
        );
    });

    it('should handle errors in getWhatsappQueue', async () => {
        const error = new Error('DB error');
        getWhatsappQueue.mockRejectedValue(error);

        await addMembersToGroups(mockChats, mockGroups);

        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('Error adding members to group Test Group 1')
        );
    });

    it('should handle errors in getMemberPhoneNumbers', async () => {
        const mockQueue = {
            rows: [{ registration_id: 'reg1' }]
        };
        const error = new Error('Phone number error');

        getWhatsappQueue.mockResolvedValue(mockQueue);
        getMemberPhoneNumbers.mockRejectedValue(error);

        await addMembersToGroups(mockChats, mockGroups);

        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('Error sending request to add: reg1 to group')
        );
    });

    it('should process multiple queue entries and phone numbers', async () => {
        const mockQueue = {
            rows: [
                { registration_id: 'reg1' },
                { registration_id: 'reg2' }
            ]
        };

        getWhatsappQueue.mockResolvedValue(mockQueue);
        getMemberPhoneNumbers.mockResolvedValueOnce(['5512345678']).mockResolvedValueOnce(['5511112222']);

        await addMembersToGroups(mockChats, mockGroups);

        expect(getMemberPhoneNumbers).toHaveBeenCalledTimes(2);
        expect(sqs_client.sendMessage).toHaveBeenCalledTimes(2);
    });
});