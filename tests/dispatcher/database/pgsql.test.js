/* global require, describe, beforeEach, it, expect, jest */

const { Pool } = require('pg');
const {
    getPhoneNumbersWithStatus,
    recordUserExitFromGroup,
    recordUserEntryToGroup,
    getPreviousGroupMembers,
    saveGroupsToList,
    getWhatsappQueue,
    registerWhatsappAddAttempt,
    registerWhatsappAddFulfilled,
    getMemberPhoneNumbers,
    getMemberName,
    getLastMessageTimestamp,
    insertNewWhatsAppMessages,
    getLastCommunication,
    logCommunication
} = require('../../../dispatcher/src/database/pgsql');

// Mock the pg Pool
jest.mock('pg', () => {
    const mockPool = {
        query: jest.fn(),
    };
    return { Pool: jest.fn(() => mockPool) };
});

describe('PostgreSQL Database Operations', () => {
    let pool;

    beforeEach(() => {
        pool = new Pool();
        // Clear all mock implementations
        jest.clearAllMocks();
    });

    describe('getPhoneNumbersWithStatus', () => {
        it('should return phone numbers with their status', async () => {
            const mockRows = [
                { phone_number: '1234567890', registration_id: '123', status: 'Active', jb_under_10: false, jb_over_10: false },
                { phone_number: '0987654321', registration_id: '456', status: 'Inactive', jb_under_10: true, jb_over_10: false }
            ];
            pool.query.mockResolvedValueOnce({ rows: mockRows });

            const result = await getPhoneNumbersWithStatus();
            expect(result).toEqual(mockRows);
            expect(pool.query).toHaveBeenCalledWith(expect.any(String), [expect.any(String)]);
        });
    });

    describe('recordUserExitFromGroup', () => {
        it('should update member_groups table with exit information', async () => {
            const phone = '1234567890';
            const groupId = 'group123';
            const reason = 'Left group';

            await recordUserExitFromGroup(phone, groupId, reason);
            expect(pool.query).toHaveBeenCalledWith(
                expect.any(String),
                [phone, groupId, reason]
            );
        });
    });

    describe('recordUserEntryToGroup', () => {
        it('should insert new entry in member_groups table', async () => {
            const registrationId = '123';
            const phone = '1234567890';
            const groupId = 'group123';
            const status = 'Active';

            await recordUserEntryToGroup(registrationId, phone, groupId, status);
            expect(pool.query).toHaveBeenCalledWith(
                expect.any(String),
                [registrationId, phone, groupId, status]
            );
        });
    });

    describe('getPreviousGroupMembers', () => {
        it('should return list of previous group members', async () => {
            const mockRows = [
                { phone_number: '1234567890' },
                { phone_number: '0987654321' }
            ];
            pool.query.mockResolvedValueOnce({ rows: mockRows });

            const result = await getPreviousGroupMembers('group123');
            expect(result).toEqual(['1234567890', '0987654321']);
            expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['group123']);
        });
    });

    describe('saveGroupsToList', () => {
        it('should save groups to the database', async () => {
            const groupNames = ['Group1', 'Group2'];
            const groupIds = ['id1', 'id2'];

            await saveGroupsToList(groupNames, groupIds);
            expect(pool.query).toHaveBeenCalledTimes(3); // DELETE + 2 INSERTs
        });
    });

    describe('getWhatsappQueue', () => {
        it('should return pending group requests', async () => {
            const mockRows = [
                { id: 1, registration_id: '123', no_of_attempts: 0 },
                { id: 2, registration_id: '456', no_of_attempts: 1 }
            ];
            pool.query.mockResolvedValueOnce({ rows: mockRows });

            const result = await getWhatsappQueue('group123');
            expect(result.rows).toEqual(mockRows);
            expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['group123']);
        });
    });

    describe('registerWhatsappAddAttempt', () => {
        it('should update attempt count for a request', async () => {
            await registerWhatsappAddAttempt(1);
            expect(pool.query).toHaveBeenCalledWith(expect.any(String), [1]);
        });
    });

    describe('registerWhatsappAddFulfilled', () => {
        it('should mark request as fulfilled', async () => {
            await registerWhatsappAddFulfilled(1);
            expect(pool.query).toHaveBeenCalledWith(expect.any(String), [1]);
        });
    });

    describe('getMemberPhoneNumbers', () => {
        it('should return all phone numbers for a member', async () => {
            const mockRows = [
                { phone: '1234567890' },
                { phone: '0987654321' }
            ];
            pool.query.mockResolvedValueOnce({ rows: mockRows });

            const result = await getMemberPhoneNumbers('123');
            expect(result).toEqual(['1234567890', '0987654321']);
            expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['123']);
        });
    });

    describe('getMemberName', () => {
        it('should return member name', async () => {
            pool.query.mockResolvedValueOnce({ rows: [{ name: 'John Doe' }] });

            const result = await getMemberName('123');
            expect(result).toBe('John Doe');
            expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['123']);
        });
    });

    describe('getLastMessageTimestamp', () => {
        it('should return the latest message timestamp', async () => {
            pool.query.mockResolvedValueOnce({ rows: [{ unix_timestamp: 1234567890 }] });

            const result = await getLastMessageTimestamp('group123');
            expect(result).toBe(1234567890);
            expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['group123']);
        });

        it('should return 0 when no messages exist', async () => {
            pool.query.mockResolvedValueOnce({ rows: [{ unix_timestamp: null }] });

            const result = await getLastMessageTimestamp('group123');
            expect(result).toBe(0);
        });
    });

    describe('insertNewWhatsAppMessages', () => {
        it('should insert multiple messages in batch', async () => {
            const messages = [
                ['msg1', 'group1', 'reg1', '2024-01-01', 'phone1', 'chat', 'android', 'content1'],
                ['msg2', 'group1', 'reg2', '2024-01-02', 'phone2', 'chat', 'iphone', 'content2']
            ];

            await insertNewWhatsAppMessages(messages);
            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO whatsapp_messages'),
                expect.arrayContaining(messages.flat())
            );
        });

        it('should handle empty message array', async () => {
            await insertNewWhatsAppMessages([]);
            expect(pool.query).not.toHaveBeenCalled();
        });
    });

    describe('getLastCommunication', () => {
        it('should return the most recent communication for a phone number', async () => {
            const mockCommunication = {
                phone_number: '1234567890',
                reason: 'test reason',
                timestamp: '2024-01-01T00:00:00Z',
                status: 'unresolved'
            };
            pool.query.mockResolvedValueOnce({ rows: [mockCommunication] });

            const result = await getLastCommunication('1234567890');
            expect(result).toEqual(mockCommunication);
            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT * FROM whatsapp_comms'),
                ['1234567890']
            );
        });

        it('should return undefined when no communications exist', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            const result = await getLastCommunication('1234567890');
            expect(result).toBeUndefined();
        });
    });

    describe('logCommunication', () => {
        it('should insert new communication record', async () => {
            const phoneNumber = '1234567890';
            const reason = 'test reason';

            await logCommunication(phoneNumber, reason);
            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO whatsapp_comms'),
                [phoneNumber, reason]
            );
        });

        it('should update existing communication record on conflict', async () => {
            const phoneNumber = '1234567890';
            const reason = 'test reason';

            pool.query.mockResolvedValueOnce({});
            await logCommunication(phoneNumber, reason);

            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('ON CONFLICT'),
                [phoneNumber, reason]
            );
        });
    });
});