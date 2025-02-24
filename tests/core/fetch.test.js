const { getLastMessageTimestamp, insertNewWhatsAppMessages } = require('../../src/database/pgsql.cjs');
const { checkPhoneNumber } = require('../../src/utils/phone-check.cjs');
const { fetchMessagesFromGroups } = require('../../src/core/fetchMessagesMode.cjs');
const { convertTimestampToDate } = require('../../src/utils/misc.cjs');

jest.mock('../../src/database/pgsql.cjs', () => ({
    getLastMessageTimestamp: jest.fn().mockResolvedValue(0),
    insertNewWhatsAppMessages: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../src/utils/phone-check.cjs', () => ({
    checkPhoneNumber: jest.fn().mockReturnValue({ found: false }),
}));

jest.mock('../../src/utils/misc.cjs', () => ({
    convertTimestampToDate: jest.fn().mockImplementation((ts) => new Date(ts * 1000)),
}));

describe('fetchMessagesFromGroups', () => {
    const mockClient = {
        getChatById: jest.fn().mockImplementation(() => ({
            fetchMessages: jest.fn().mockResolvedValue([]),
        })),
    };
    const phoneNumbersFromDB = new Map();

    const mockGroupChat = {
        fetchMessages: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.BATCH_SIZE = '300';
        phoneNumbersFromDB.clear();
    });

    test('should fetch messages and insert them into the database', async () => {
        const mockGroups = [{ id: { _serialized: 'group1' }, name: 'Test Group' }];
        const mockPhoneNumbersFromDB = new Map([['1234567890', [{ registration_id: '123', status: 'active' }]]]);

        mockClient.getChatById.mockResolvedValue(mockGroupChat);
        mockGroupChat.fetchMessages.mockResolvedValue([
            { author: '1234567890@c.us', timestamp: 1672531199, type: 'text', deviceType: 'phone', id: { id: 'msg1' } },
        ]);

        getLastMessageTimestamp.mockResolvedValue(1672531100);
        checkPhoneNumber.mockReturnValue({
            'found': true,
            'is_adult': true,
            'jb_over_10': false,
            'jb_under_10': false,
            'mb': '123',
            'status': 'active',
        });
        convertTimestampToDate.mockImplementation((timestamp) => new Date(timestamp * 1000));

        await fetchMessagesFromGroups(mockClient, mockGroups, mockPhoneNumbersFromDB);

        expect(mockClient.getChatById).toHaveBeenCalledWith('group1');
        expect(mockGroupChat.fetchMessages).toHaveBeenCalledWith({ limit: '300' });
        expect(getLastMessageTimestamp).toHaveBeenCalledWith('group1');
        expect(checkPhoneNumber).toHaveBeenCalledWith(mockPhoneNumbersFromDB, '1234567890');
    });

    test('should handle no new messages to fetch', async () => {
        const mockGroups = [{ id: { _serialized: 'group1' }, name: 'Test Group' }];
        const mockPhoneNumbersFromDB = new Map();

        mockClient.getChatById.mockResolvedValue(mockGroupChat);
        mockGroupChat.fetchMessages.mockResolvedValue([]);

        getLastMessageTimestamp.mockResolvedValue(1672531100);

        await fetchMessagesFromGroups(mockClient, mockGroups, mockPhoneNumbersFromDB);

        expect(mockClient.getChatById).toHaveBeenCalledWith('group1');
        expect(mockGroupChat.fetchMessages).toHaveBeenCalledWith({ limit: '300' });
        expect(getLastMessageTimestamp).toHaveBeenCalledWith('group1');
        expect(insertNewWhatsAppMessages).not.toHaveBeenCalled();
    });

    test('should handle errors while fetching messages', async () => {
        const mockGroups = [{ id: { _serialized: 'group1' }, name: 'Test Group' }];
        const mockPhoneNumbersFromDB = new Map();

        mockClient.getChatById.mockResolvedValue(mockGroupChat);
        mockGroupChat.fetchMessages.mockRejectedValue(new Error('Network Error'));

        getLastMessageTimestamp.mockResolvedValue(1672531100);

        await fetchMessagesFromGroups(mockClient, mockGroups, mockPhoneNumbersFromDB);

        expect(mockClient.getChatById).toHaveBeenCalledWith('group1');
        expect(mockGroupChat.fetchMessages).toHaveBeenCalledWith({ limit: '300' });
        expect(getLastMessageTimestamp).toHaveBeenCalledWith('group1');
        expect(insertNewWhatsAppMessages).not.toHaveBeenCalled();
    });

    test('should return the last message timestamp from the database', async () => {
        getLastMessageTimestamp.mockResolvedValue(1672531100);

        const timestamp = await getLastMessageTimestamp('group1');

        expect(timestamp).toBe(1672531100);
        expect(getLastMessageTimestamp).toHaveBeenCalledWith('group1');
    });

    test('should correctly check phone number and return matched entries', () => {
        const phoneNumberMap = new Map([
            ['1234567890', [{ registration_id: '123', status: 'active', jb_under_10: false }]],
        ]);

        checkPhoneNumber.mockReturnValue({
            'found': true,
            'is_adult': true,
            'jb_over_10': false,
            'jb_under_10': false,
            'mb': '123',
            'status': 'active',
        });

        const result = checkPhoneNumber(phoneNumberMap, '1234567890');

        expect(result).toEqual({
            found: true,
            status: 'active',
            mb: '123',
            jb_under_10: false,
            jb_over_10: false,
            is_adult: true,
        });
    });

    test('should convert timestamp to date correctly', async () => {
        const timestamp = 1672531100;
        const expectedDate = new Date(timestamp * 1000);

        const date = await convertTimestampToDate(timestamp);

        expect(date).toEqual(expectedDate);
    });

    test('should handle no messages found and skip processing', async () => {
        const mockGroups = [{ id: { _serialized: 'group1' }, name: 'Test Group' }];
        const mockPhoneNumbersFromDB = new Map();

        mockClient.getChatById.mockResolvedValue(mockGroupChat);
        mockGroupChat.fetchMessages.mockResolvedValue([]);

        getLastMessageTimestamp.mockResolvedValue(1672531100);

        console.log = jest.fn();

        await fetchMessagesFromGroups(mockClient, mockGroups, mockPhoneNumbersFromDB);

        expect(console.log).toHaveBeenCalledWith('No messages found. Skipping...');
    });

    test('should handle first batch reaching maximum messages', async () => {
        const mockGroups = [{ id: { _serialized: 'group1' }, name: 'Test Group' }];
        const mockPhoneNumbersFromDB = new Map([['1234567890', [{ registration_id: '123', status: 'active' }]]]);

        mockClient.getChatById.mockResolvedValue(mockGroupChat);
        mockGroupChat.fetchMessages.mockResolvedValue([
            { author: '1234567890@c.us', timestamp: 1672531199, type: 'text', deviceType: 'phone', id: { id: 'msg1' } },
        ]);

        getLastMessageTimestamp.mockResolvedValue(1672531100);
        checkPhoneNumber.mockReturnValue({ found: true, mb: '123' });

        console.log = jest.fn(); // Mock console.log to verify output

        await fetchMessagesFromGroups(mockClient, mockGroups, mockPhoneNumbersFromDB);

        expect(console.log).toHaveBeenCalledWith('First batch reached maximum messages!');
    });

    test('should filter messages based on lastMessageTimestampInDb', async () => {
        const mockGroups = [{ id: { _serialized: 'group1' }, name: 'Test Group' }];
        const mockPhoneNumbersFromDB = new Map([['1234567890', [{ registration_id: '123', status: 'active' }]]]);

        mockClient.getChatById.mockResolvedValue(mockGroupChat);
        mockGroupChat.fetchMessages.mockResolvedValue([
            { author: '1234567890@c.us', timestamp: 1672531200, type: 'text', deviceType: 'phone', id: { id: 'msg1' } }, // Newer than lastMessageTimestampInDb
            { author: '1234567890@c.us', timestamp: 1672531000, type: 'text', deviceType: 'phone', id: { id: 'msg2' } }, // Older than lastMessageTimestampInDb
        ]);

        getLastMessageTimestamp.mockResolvedValue(1672531100);
        checkPhoneNumber.mockReturnValue({ found: true, mb: '123' });

        const dbInsertSpy = jest.spyOn(require('../../src/database/pgsql.cjs'), 'insertNewWhatsAppMessages');

        await fetchMessagesFromGroups(mockClient, mockGroups, mockPhoneNumbersFromDB);

        expect(dbInsertSpy).toHaveBeenCalledTimes(1);
        expect(dbInsertSpy).toHaveBeenCalledWith(expect.arrayContaining([
            ['msg1', 'group1', '123', expect.any(String), '1234567890', 'text', 'phone', null],
        ]));
    });

    test('should process the final batch of filtered messages', async () => {
        const mockGroups = [{ id: { _serialized: 'group1' }, name: 'Test Group' }];
        const mockPhoneNumbersFromDB = new Map([['1234567890', [{ registration_id: '123', status: 'active' }]]]);

        mockClient.getChatById.mockResolvedValue(mockGroupChat);
        mockGroupChat.fetchMessages.mockResolvedValue([
            { author: '1234567890@c.us', timestamp: 1672531200, type: 'text', deviceType: 'phone', id: { id: 'msg1' } },
        ]);

        getLastMessageTimestamp.mockResolvedValue(1672531100);
        checkPhoneNumber.mockReturnValue({ found: true, mb: '123' });

        const dbInsertSpy = jest.spyOn(require('../../src/database/pgsql.cjs'), 'insertNewWhatsAppMessages');

        await fetchMessagesFromGroups(mockClient, mockGroups, mockPhoneNumbersFromDB);

        expect(dbInsertSpy).toHaveBeenCalledTimes(1);
        expect(dbInsertSpy).toHaveBeenCalledWith(expect.arrayContaining([
            ['msg1', 'group1', '123', expect.any(String), '1234567890', 'text', 'phone', null],
        ]));
    });
});
