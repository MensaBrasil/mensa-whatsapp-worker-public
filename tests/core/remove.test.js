const { getGroupIdByName, getGroupParticipants, removeParticipantByPhoneNumber } = require("../../src/utils/chat");
const { recordUserExitFromGroup } = require("../../src/database/pgsql");
const { checkPhoneNumber } = require("../../src/utils/phone-check");
const { triggerTwilioOrRemove } = require("../../src/utils/twilio");
const { logAction, delay } = require("../../src/utils/misc");
const removeMembersFromGroups = require("../../src/core/removeMode");

// Mock all dependencies
jest.mock("../../src/utils/chat", () => ({
    getGroupIdByName: jest.fn(),
    getGroupParticipants: jest.fn(),
    removeParticipantByPhoneNumber: jest.fn(),
}));

jest.mock("../../src/database/pgsql", () => ({
    recordUserExitFromGroup: jest.fn(),
}));

jest.mock("../../src/utils/phone-check", () => ({
    checkPhoneNumber: jest.fn(),
}));

jest.mock("../../src/utils/twilio", () => ({
    triggerTwilioOrRemove: jest.fn(),
}));

jest.mock("../../src/utils/misc", () => ({
    logAction: jest.fn(),
    delay: jest.fn().mockResolvedValue(),
}));

global.fetch = jest.fn(() => Promise.resolve());

describe('removeMembersFromGroups', () => {
    const client = {};
    const phoneNumbersFromDB = [{ phone: '1234567890', status: 'active' }];

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => { });
        jest.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        console.log.mockRestore();
        console.error.mockRestore();
    });

    it('should skip removal for adults or ambiguous JB status', async () => {
        const groupNames = ["test_group", "test_group2"];

        // Mock dependencies
        getGroupIdByName.mockResolvedValue('test_group');
        getGroupParticipants.mockResolvedValue([{ id: { _serialized: '1234567890' } }]);
        checkPhoneNumber.mockReturnValue({
            found: true,
            is_adult: true,
            jb_under_10: false,
            jb_over_10: false
        });

        await removeMembersFromGroups(client, groupNames, phoneNumbersFromDB);

        expect(console.log).toHaveBeenCalledWith(
            'Skipping JB removal for 1234567890 (adult or ambiguous JB status).'
        );
        expect(removeParticipantByPhoneNumber).not.toHaveBeenCalled();
    });

    it('should apply JB removal rules correctly', async () => {
        const groupNames = { "M.JB Test Group": true };

        // Mock dependencies
        getGroupIdByName.mockResolvedValue('group1');
        getGroupParticipants.mockResolvedValue([{ id: { _serialized: '1234567890' } }]);
        checkPhoneNumber.mockReturnValue({
            found: true,
            jb_over_10: true,
            jb_under_10: false,
            is_adult: false
        });
        removeParticipantByPhoneNumber.mockResolvedValue(true);

        await removeMembersFromGroups(client, groupNames, phoneNumbersFromDB);

        expect(console.log).toHaveBeenCalledWith(
            'Removing 1234567890 (User is JB over 10 in M.JB group) from M.JB Test Group.'
        );
        expect(logAction).toHaveBeenCalledWith(
            'M.JB Test Group',
            '1234567890',
            'Removal',
            'User is JB over 10 in M.JB group'
        );
        expect(delay).toHaveBeenCalledWith(300000);
        expect(recordUserExitFromGroup).toHaveBeenCalledWith(
            '1234567890',
            'group1',
            'User is JB over 10 in M.JB group'
        );
    });

    it('should handle inactive members with Twilio check', async () => {
        const groupNames = { "MB | Xadrez": true };

        // Mock dependencies
        getGroupIdByName.mockResolvedValue('group1');
        getGroupParticipants.mockResolvedValue([{ id: { _serialized: '1234567890' } }]);
        checkPhoneNumber.mockReturnValue({
            found: true,
            status: 'Inactive',
            mb: '123'
        });
        triggerTwilioOrRemove.mockResolvedValue(true);
        removeParticipantByPhoneNumber.mockResolvedValue(true);

        await removeMembersFromGroups(client, groupNames, phoneNumbersFromDB);

        expect(console.log).toHaveBeenCalledWith(
            'Number 1234567890, MB 123 is inactive.'
        );
        expect(triggerTwilioOrRemove).toHaveBeenCalledWith('1234567890', 'mensa_inactive');
        expect(logAction).toHaveBeenCalledWith(
            'MB | Xadrez',
            '1234567890',
            'Removal',
            'Inactive'
        );
        expect(delay).toHaveBeenCalledWith(300000);
        expect(recordUserExitFromGroup).toHaveBeenCalledWith(
            '1234567890',
            'group1',
            'Inactive'
        );
    });

    it('should remove members not found in database after Twilio check', async () => {
        const groupNames = { "Regular Group": true };

        // Mock dependencies
        getGroupIdByName.mockResolvedValue('group1');
        getGroupParticipants.mockResolvedValue([{ id: { _serialized: '0987654321' } }]);
        checkPhoneNumber.mockReturnValue({ found: false });
        triggerTwilioOrRemove.mockResolvedValue(true);
        removeParticipantByPhoneNumber.mockResolvedValue(true);

        await removeMembersFromGroups(client, groupNames, phoneNumbersFromDB);

        expect(console.log).toHaveBeenCalledWith(
            'Number 0987654321 not found in the database.'
        );
        expect(logAction).toHaveBeenCalledWith(
            'Regular Group',
            '0987654321',
            'Removal',
            'Not found in database'
        );
    });

    it('should skip removal for specific member (18653480874)', async () => {
        const groupNames = { "Special Group": true };

        // Mock dependencies
        getGroupIdByName.mockResolvedValue('group1');
        getGroupParticipants.mockResolvedValue([{ id: { _serialized: '18653480874' } }]);
        checkPhoneNumber.mockReturnValue({ found: false });

        await removeMembersFromGroups(client, groupNames, phoneNumbersFromDB);

        expect(triggerTwilioOrRemove).not.toHaveBeenCalled();
        expect(removeParticipantByPhoneNumber).not.toHaveBeenCalled();
    });

    it('should handle errors during group processing', async () => {
        const groupNames = { "Error Group": true };

        // Mock dependencies
        getGroupIdByName.mockRejectedValue(new Error('Group fetch failed'));

        await removeMembersFromGroups(client, groupNames, phoneNumbersFromDB);

        expect(console.error).toHaveBeenCalledWith(
            'Error in group Error Group: Error: Group fetch failed'
        );
        expect(fetch).toHaveBeenCalled();
    });

    it('should call uptime URL after each group', async () => {
        const groupNames = { "Group1": true, "Group2": true };

        // Mock dependencies
        getGroupIdByName.mockResolvedValue('group1');
        getGroupParticipants.mockResolvedValue([]);

        await removeMembersFromGroups(client, groupNames, phoneNumbersFromDB);

        expect(fetch).toHaveBeenCalledTimes(2);
        expect(fetch).toHaveBeenCalledWith(process.env.UPTIME_URL);
    });

    it('should always call recordUserExitFromGroup', async () => {
        const groupNames = { "Test Group": true };

        // Mock dependencies
        getGroupIdByName.mockResolvedValue('group1');
        getGroupParticipants.mockResolvedValue([{ id: { _serialized: '1234567890' } }]);
        checkPhoneNumber.mockReturnValue({ found: true, is_adult: true });

        await removeMembersFromGroups(client, groupNames, phoneNumbersFromDB);

        expect(recordUserExitFromGroup).toHaveBeenCalledWith(
            '1234567890',
            'group1',
            null
        );
    });
});