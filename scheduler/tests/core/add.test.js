const { getWhatsappQueue, getMemberPhoneNumbers, registerWhatsappAddFulfilled, registerWhatsappAddAttempt } = require('../../src/database/pgsql');
const { getGroupIdByName } = require('../../src/utils/chat');
const { logAction, delay } = require('../../src/utils/misc');
const { addPhoneNumberToGroup } = require('../../src/utils/re-add');
const addMembersToGroups = require('../../src/core/addMode');

// Mock all dependencies
jest.mock('../../src/database/pgsql', () => ({
    getWhatsappQueue: jest.fn(),
    getMemberPhoneNumbers: jest.fn(),
    registerWhatsappAddFulfilled: jest.fn(),
    registerWhatsappAddAttempt: jest.fn(),
}));

jest.mock('../../src/utils/re-add', () => ({
    addPhoneNumberToGroup: jest.fn(),
}));

jest.mock('../../src/utils/chat', () => ({
    getGroupIdByName: jest.fn(),
}));

jest.mock('../../src/utils/misc', () => ({
    logAction: jest.fn(),
    delay: jest.fn().mockResolvedValue(),
}));

global.fetch = jest.fn(() => Promise.resolve());

describe('addMembersToGroups', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => { });
        jest.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        console.log.mockRestore();
        console.error.mockRestore();
    });

    it('should add members to group successfully', async () => {
        const client = {};
        const chats = [{ id: { user: '34567890' }, isGroup: false }];
        const groupNames = { TestGroup: true };

        getGroupIdByName.mockResolvedValue('groupId123');
        getWhatsappQueue.mockResolvedValue({ rows: [{ id: 1, registration_id: 123456789 }] });
        getMemberPhoneNumbers.mockResolvedValue(['1234567890']);
        addPhoneNumberToGroup.mockResolvedValue(true);

        await addMembersToGroups(client, chats, groupNames);

        expect(getGroupIdByName).toHaveBeenCalledWith(client, 'TestGroup');
        expect(getWhatsappQueue).toHaveBeenCalledWith('groupId123');
        expect(getMemberPhoneNumbers).toHaveBeenCalledWith(123456789);
        expect(addPhoneNumberToGroup).toHaveBeenCalledWith(client, '1234567890', 'groupId123');
        expect(registerWhatsappAddFulfilled).toHaveBeenCalledWith(1);
        expect(logAction).toHaveBeenCalledWith('TestGroup', '1234567890', 'Added', 'Fulfilled');
        expect(delay).toHaveBeenCalledWith(600000);
        expect(fetch).toHaveBeenCalledWith(process.env.UPTIME_URL);
    });

    it('should skip adding if phone not found in chats', async () => {
        const client = {};
        const chats = [{ id: { user: '00000000' }, isGroup: false }];
        const groupNames = { TestGroup: true };

        getGroupIdByName.mockResolvedValue('groupId123');
        getWhatsappQueue.mockResolvedValue({ rows: [{ id: 1, registration_id: 100 }] });
        getMemberPhoneNumbers.mockResolvedValue(['1234567890']);

        await addMembersToGroups(client, chats, groupNames);

        expect(console.log).toHaveBeenCalledWith('Number 1234567890 not found in existing chats. Skipping...');
        expect(addPhoneNumberToGroup).not.toHaveBeenCalled();
        expect(registerWhatsappAddFulfilled).not.toHaveBeenCalled();
        expect(registerWhatsappAddAttempt).not.toHaveBeenCalled();
    });

    it('should register attempt when adding fails', async () => {
        const client = {};
        const chats = [{ id: { user: '34567890' }, isGroup: false }];
        const groupNames = { TestGroup: true };

        getGroupIdByName.mockResolvedValue('groupId123');
        getWhatsappQueue.mockResolvedValue({ rows: [{ id: 1, registration_id: 100 }] });
        getMemberPhoneNumbers.mockResolvedValue(['1234567890']);
        addPhoneNumberToGroup.mockResolvedValue(false);

        await addMembersToGroups(client, chats, groupNames);

        expect(registerWhatsappAddAttempt).toHaveBeenCalledWith(1);
        expect(console.error).toHaveBeenCalledWith('Error adding member 100 to group: Addition failed');
    });

    it('should handle errors when fetching phone numbers', async () => {
        const client = {};
        const groupNames = { TestGroup: true };

        getGroupIdByName.mockResolvedValue('groupId123');
        getWhatsappQueue.mockResolvedValue({ rows: [{ id: 1, registration_id: 100 }] });
        getMemberPhoneNumbers.mockRejectedValue(new Error('DB error'));

        await addMembersToGroups(client, [], groupNames);

        expect(registerWhatsappAddAttempt).toHaveBeenCalledWith(1);
        expect(console.error).toHaveBeenCalledWith('Error adding member 100 to group: DB error');
    });

    it('should handle errors when getting group ID', async () => {
        const client = {};
        const groupNames = { TestGroup: true, AnotherGroup: true };

        getGroupIdByName.mockRejectedValueOnce(new Error('Group not found'))
            .mockResolvedValueOnce('groupId456');
        getWhatsappQueue.mockResolvedValue({ rows: [] });

        await addMembersToGroups(client, [], groupNames);

        expect(console.error).toHaveBeenCalledWith('Error adding members to group TestGroup: Group not found');
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should fetch uptime URL after each group', async () => {
        const client = {};
        const groupNames = { Group1: true, Group2: true };

        getGroupIdByName.mockResolvedValue('groupId123');
        getWhatsappQueue.mockResolvedValue({ rows: [] });

        await addMembersToGroups(client, [], groupNames);

        expect(fetch).toHaveBeenCalledTimes(2);
        expect(fetch).toHaveBeenCalledWith(process.env.UPTIME_URL);
    });
    it('should handle empty chats and groupNames', async () => {
        const client = {};
        const chats = [];
        const groupNames = {};
    
        await addMembersToGroups(client, chats, groupNames);
    
        expect(getGroupIdByName).not.toHaveBeenCalled();
        expect(getWhatsappQueue).not.toHaveBeenCalled();
        expect(fetch).not.toHaveBeenCalled();
    });
});