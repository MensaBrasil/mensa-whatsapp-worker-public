const { Pool } = require('pg');
const {
    getPhoneNumbersWithStatus,
    recordUserExitFromGroup,
    recordUserEntryToGroup,
    getLastCommunication,
    logCommunication,
    getPreviousGroupMembers,
    saveGroupsToList,
    getWhatsappQueue,
    registerWhatsappAddAttempt,
    registerWhatsappAddFulfilled,
    getMemberName,
    getMemberPhoneNumbers,
    getLastMessageTimestamp,
    insertNewWhatsAppMessages,
} = require('../../src/database/pgsql.cjs');

jest.mock('pg', () => {
    const mockQuery = jest.fn();
    return {
        Pool: jest.fn(() => ({
            query: mockQuery,
        })),
    };
});

describe('Database Functions', () => {
    let pool;

    beforeEach(() => {
        pool = new Pool();
        pool.query.mockClear();
    });

    describe('getPhoneNumbersWithStatus', () => {
        test('should execute the correct SQL query and return rows', async () => {
            const mockRows = [{ phone_number: '1234567890', status: 'Active' }];
            pool.query.mockResolvedValue({ rows: mockRows });

            const result = await getPhoneNumbersWithStatus();

            expect(pool.query).toHaveBeenCalledTimes(1);
            expect(pool.query).toHaveBeenCalledWith(expect.any(String), [expect.any(String)]);
            expect(result).toEqual(mockRows);
        });
    });

    describe('recordUserExitFromGroup', () => {
        test('should execute the correct SQL query to update member_groups', async () => {
            const phoneNumber = '1234567890';
            const groupId = 1;
            const reason = 'Inactive';

            await recordUserExitFromGroup(phoneNumber, groupId, reason);

            expect(pool.query).toHaveBeenCalledTimes(1);
            expect(pool.query).toHaveBeenCalledWith(expect.any(String), [phoneNumber, groupId, reason]);
        });
    });

    describe('recordUserEntryToGroup', () => {
        test('should execute the correct SQL query to insert into member_groups', async () => {
            const registrationId = 1;
            const phoneNumber = '1234567890';
            const groupId = 1;
            const status = 'Active';

            await recordUserEntryToGroup(registrationId, phoneNumber, groupId, status);

            expect(pool.query).toHaveBeenCalledTimes(1);
            expect(pool.query).toHaveBeenCalledWith(expect.any(String), [registrationId, phoneNumber, groupId, status]);
        });
    });

    describe('getLastCommunication', () => {
        test('should execute the correct SQL query and return the last communication', async () => {
            const mockRow = { phone_number: '1234567890', reason: 'Test', timestamp: new Date() };
            pool.query.mockResolvedValue({ rows: [mockRow] });

            const result = await getLastCommunication('1234567890');

            expect(pool.query).toHaveBeenCalledTimes(1);
            expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['1234567890']);
            expect(result).toEqual(mockRow);
        });
    });

    describe('logCommunication', () => {
        test('should execute the correct SQL query to log communication', async () => {
            const phoneNumber = '1234567890';
            const reason = 'Test';

            await logCommunication(phoneNumber, reason);

            expect(pool.query).toHaveBeenCalledTimes(1);
            expect(pool.query).toHaveBeenCalledWith(expect.any(String), [phoneNumber, reason]);
        });
    });

    describe('getPreviousGroupMembers', () => {
        test('should execute the correct SQL query and return phone numbers', async () => {
            const mockRows = [{ phone_number: '1234567890' }, { phone_number: '0987654321' }];
            pool.query.mockResolvedValue({ rows: mockRows });

            const result = await getPreviousGroupMembers(1);

            expect(pool.query).toHaveBeenCalledTimes(1);
            expect(pool.query).toHaveBeenCalledWith(expect.any(String), [1]);
            expect(result).toEqual(['1234567890', '0987654321']);
        });
    });

    describe('saveGroupsToList', () => {
        test('should delete existing groups and insert new ones', async () => {
            const groupNames = ['Group1', 'Group2'];
            const groupIds = [1, 2];

            await saveGroupsToList(groupNames, groupIds);

            expect(pool.query).toHaveBeenCalledTimes(3); // 1 DELETE + 2 INSERTs
            expect(pool.query).toHaveBeenNthCalledWith(1, 'DELETE FROM group_list');
            expect(pool.query).toHaveBeenNthCalledWith(2, 'INSERT INTO group_list (group_name, group_id) VALUES ($1, $2)', ['Group1', 1]);
            expect(pool.query).toHaveBeenNthCalledWith(3, 'INSERT INTO group_list (group_name, group_id) VALUES ($1, $2)', ['Group2', 2]);
        });
    });

    describe('getMemberPhoneNumbers', () => {
        test('should execute the correct SQL query and return phone numbers', async () => {
            const mockRows = [{ phone: '1234567890' }, { phone: '0987654321' }];
            pool.query.mockResolvedValue({ rows: mockRows });

            const result = await getMemberPhoneNumbers(1);

            expect(pool.query).toHaveBeenCalledTimes(1);
            expect(pool.query).toHaveBeenCalledWith(expect.any(String), [1]);
            expect(result).toEqual(['1234567890', '0987654321']);
        });
    });

    describe('getLastMessageTimestamp', () => {
        test('should execute the correct SQL query and return the timestamp', async () => {
            const mockRow = { unix_timestamp: 1672531199 };
            pool.query.mockResolvedValue({ rows: [mockRow] });

            const result = await getLastMessageTimestamp(1);

            expect(pool.query).toHaveBeenCalledTimes(1);
            expect(pool.query).toHaveBeenCalledWith(expect.any(String), [1]);
            expect(result).toEqual(1672531199);
        });
    });

    describe('insertNewWhatsAppMessages', () => {
        test('should execute the correct SQL query to insert messages', async () => {
            const messages = [
                {
                    message_id: '1',
                    group_id: 1,
                    registration_id: 1,
                    timestamp: new Date(),
                    phone: '1234567890',
                    message_type: 'text',
                    device_type: 'mobile',
                },
            ];

            await insertNewWhatsAppMessages(messages);

            expect(pool.query).toHaveBeenCalledTimes(1);
            expect(pool.query).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining([]));
        });
    });
});