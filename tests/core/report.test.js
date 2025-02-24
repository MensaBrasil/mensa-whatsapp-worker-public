const { reportMembersInfo } = require('../../src/core/reportMode.cjs');
const { getWhatsappQueue, getMemberPhoneNumbers } = require('../../src/database/pgsql.cjs');
const { getGroupParticipants } = require('../../src/utils/chat.cjs');
const { checkPhoneNumber } = require('../../src/utils/phone-check.cjs');
const fs = require('fs');


jest.mock('../../src/database/pgsql.cjs');
jest.mock('../../src/utils/chat.cjs');
jest.mock('../../src/utils/phone-check.cjs');
jest.mock('fs');

describe('reportMembersInfo', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const mockClient = {

    };

    const mockChats = [
        { isGroup: false, id: { user: '12345678' } },
        { isGroup: false, id: { user: '87654321' } }
    ];

    const mockGroups = [
        {
            name: 'MB | General',
            id: { _serialized: 'group1' }
        },
        {
            name: 'MB | M.JB',
            id: { _serialized: 'group2' }
        }
    ];

    test('should handle inactive members correctly', async () => {

        getGroupParticipants.mockResolvedValue([
            { id: { _serialized: '5511999999999' } }
        ]);

        checkPhoneNumber.mockReturnValue({
            found: true,
            status: 'Inactive',
            is_adult: true
        });

        getWhatsappQueue.mockResolvedValue({ rows: [] });

        await reportMembersInfo(mockClient, mockChats, mockGroups, new Map());


        expect(fs.writeFileSync).toHaveBeenCalled();
        const writtenData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
        expect(writtenData['5511999999999'].inactive).toBeDefined();
    });

    test('should handle JB members in wrong groups', async () => {
        getGroupParticipants.mockResolvedValue([
            { id: { _serialized: '5511888888888' } }
        ]);

        checkPhoneNumber.mockReturnValue({
            found: true,
            status: 'Active',
            jb_over_10: true,
            jb_under_10: false,
            is_adult: false
        });

        getWhatsappQueue.mockResolvedValue({ rows: [] });

        await reportMembersInfo(mockClient, mockChats, [mockGroups[0]], new Map());

        expect(fs.writeFileSync).toHaveBeenCalled();
        const writtenData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
        expect(writtenData['5511888888888']['User is JB in non-JB group']).toBeDefined();
    });

    test('should handle pending additions', async () => {
        getGroupParticipants.mockResolvedValue([]);
        checkPhoneNumber.mockReturnValue({ found: true });

        getWhatsappQueue.mockResolvedValue({
            rows: [{ registration_id: 'reg1' }]
        });

        getMemberPhoneNumbers.mockResolvedValue(['12345678']);

        await reportMembersInfo(mockClient, mockChats, mockGroups, new Map());

        expect(fs.writeFileSync).toHaveBeenCalled();
        const writtenData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
        expect(writtenData['12345678']['Pending valid additions']).toBeDefined();
    });

    test('should not flag numbers in DONT_REMOVE list', async () => {
        getGroupParticipants.mockResolvedValue([
            { id: { _serialized: '1234567890' } }
        ]);

        checkPhoneNumber.mockReturnValue({ found: false });
        getWhatsappQueue.mockResolvedValue({ rows: [] });

        await reportMembersInfo(mockClient, mockChats, mockGroups, new Map());

        expect(fs.writeFileSync).toHaveBeenCalled();
        const writtenData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
        expect(writtenData['1234']?.not_found).toBeUndefined();
    });

    test('should generate correct summary statistics', async () => {
        getGroupParticipants.mockResolvedValue([
            { id: { _serialized: '5511999999999' } },
            { id: { _serialized: '5511888888888' } }
        ]);

        checkPhoneNumber.mockReturnValueOnce({ found: true, status: 'Inactive', is_adult: true }).mockReturnValueOnce({ found: false });

        getWhatsappQueue.mockResolvedValue({ rows: [] });

        await reportMembersInfo(mockClient, mockChats, mockGroups, new Map());

        expect(fs.writeFileSync).toHaveBeenCalled();
        const writtenData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);

        expect(writtenData.summary).toBeDefined();
        expect(writtenData.summary.totalUniqueMembers).toBe(2);
        expect(writtenData.summary.issues.inactive.uniqueMembers).toBe(1);
        expect(writtenData.summary.issues.notFound.uniqueMembers).toBe(2);
    });
});
