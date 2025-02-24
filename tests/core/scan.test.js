const { scanGroups } = require('../../src/core/scanMode.cjs');
const { getPreviousGroupMembers, recordUserExitFromGroup, recordUserEntryToGroup } = require('../../src/database/pgsql.cjs');
const { getGroupParticipants } = require('../../src/utils/chat.cjs');
const { checkPhoneNumber } = require('../../src/utils/phone-check.cjs');

jest.mock('../../src/database/pgsql.cjs', () => ({
    getPreviousGroupMembers: jest.fn().mockResolvedValue([]),
    recordUserExitFromGroup: jest.fn().mockResolvedValue(true),
    recordUserEntryToGroup: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../src/utils/chat.cjs', () => ({
    getGroupParticipants: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../src/utils/phone-check.cjs', () => ({
    checkPhoneNumber: jest.fn().mockReturnValue({ found: false }),
}));

describe('scanGroups', () => {
    const mockClient = {};
    const groups = [
        { id: { _serialized: 'group1' }, name: 'Test Group 1' },
        { id: { _serialized: 'group2' }, name: 'Test Group 2' },
    ];
    const phoneNumbersFromDB = new Map();

    beforeEach(() => {
        jest.clearAllMocks();
        phoneNumbersFromDB.clear();
    });


    test('should detect departed and new members', async () => {
        getPreviousGroupMembers.mockResolvedValue(['1111']);

        getGroupParticipants.mockResolvedValue([
            { phone: '2222', isAdmin: false },
            { phone: '3333', isAdmin: true }
        ]);

        checkPhoneNumber.mockImplementation((map, phone) => ({
            found: true,
            mb: `mb-${phone}`,
            status: 'Active'
        }));

        const consoleSpy = jest.spyOn(console, 'log');

        await scanGroups(mockClient, [groups[0]], phoneNumbersFromDB);

        expect(recordUserExitFromGroup).toHaveBeenCalledWith(
            '1111',
            'group1',
            'Left group'
        );
        expect(consoleSpy).toHaveBeenCalledWith(
            'Number 1111 is no longer in the group.'
        );

        expect(recordUserEntryToGroup).toHaveBeenCalledTimes(2);
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('Number 2222, MB mb-2222 is new to the group')
        );
    });

    test('should handle members that stayed in group', async () => {
        getPreviousGroupMembers.mockResolvedValue(['1111']);
        getGroupParticipants.mockResolvedValue([{ phone: '1111' }]);
        checkPhoneNumber.mockReturnValue({ found: true, mb: 'mb-1111' });

        await scanGroups(mockClient, [groups[0]], phoneNumbersFromDB);

        expect(recordUserExitFromGroup).not.toHaveBeenCalled();
        expect(recordUserEntryToGroup).not.toHaveBeenCalled();
    });

    test('should skip invalid current members', async () => {
        getGroupParticipants.mockRejectedValue(new Error('DB Error'));
        checkPhoneNumber.mockReturnValue({ found: false });

        await scanGroups(mockClient, [groups[0]], phoneNumbersFromDB);

        expect(recordUserEntryToGroup).not.toHaveBeenCalled();
        expect(recordUserExitFromGroup).not.toHaveBeenCalled();
    });

    test('should process multiple groups independently', async () => {
        getGroupParticipants.mockResolvedValue([{ phone: '1111' }]).mockResolvedValue([{ phone: '2222' }]);

        checkPhoneNumber.mockReturnValue({ found: true, mb: 'mb-123' });

        await scanGroups(mockClient, groups, phoneNumbersFromDB);

        expect(getPreviousGroupMembers).toHaveBeenCalledTimes(2);
        expect(recordUserEntryToGroup).toHaveBeenCalledTimes(2);
    });

    test('should handle group processing errors', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error');
        getGroupParticipants.mockRejectedValue(new Error('API Failure'));

        await scanGroups(mockClient, [groups[0]], phoneNumbersFromDB);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining('Error scanning group')
        );
    });

    test('should handle database entry conflicts', async () => {
        getPreviousGroupMembers.mockResolvedValue([]);
        getGroupParticipants.mockResolvedValue([{ phone: '1111' }]);
        checkPhoneNumber.mockReturnValue({ found: true, mb: 'mb-1111' });
        recordUserEntryToGroup.mockRejectedValueOnce(new Error('DB Conflict'));

        const consoleErrorSpy = jest.spyOn(console, 'error');

        await scanGroups(mockClient, [groups[0]], phoneNumbersFromDB);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining('Error scanning group')
        );
    });
});